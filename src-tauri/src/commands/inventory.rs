#![allow(clippy::too_many_arguments)]

use tauri::State;
use std::sync::Arc;
use libsql::{Connection, params};
use crate::commands::rbac;
use crate::models::InventoryItem;

fn get_f64_safe(row: &libsql::Row, idx: i32) -> f64 {
    match row.get_value(idx) {
        Ok(libsql::Value::Integer(i)) => i as f64,
        Ok(libsql::Value::Real(f)) => f,
        _ => 0.0,
    }
}

fn get_f64_opt(row: &libsql::Row, idx: i32) -> Option<f64> {
    match row.get_value(idx) {
        Ok(libsql::Value::Integer(i)) => Some(i as f64),
        Ok(libsql::Value::Real(f)) => Some(f),
        _ => None,
    }
}

fn calc_stock_pct(stock_qty: f64, min_stock_qty: f64, max_stock_qty: Option<f64>) -> f64 {
    if let Some(max) = max_stock_qty
        && max > 0.0
    {
        return (stock_qty / max * 100.0).clamp(0.0, 100.0);
    }
    if min_stock_qty <= 0.0 {
        return 100.0;
    }
    if stock_qty <= min_stock_qty {
        // at or below min → 0–25% danger zone (linear, capped at 25%)
        (stock_qty / min_stock_qty * 25.0).clamp(0.0, 25.0)
    } else if stock_qty <= min_stock_qty * 3.0 {
        // min to min*3 → 25–75%
        25.0 + ((stock_qty - min_stock_qty) / (min_stock_qty * 2.0) * 50.0)
    } else {
        // above min*3 → 75–100%
        (75.0 + ((stock_qty - min_stock_qty * 3.0) / (min_stock_qty * 3.0) * 25.0)).min(100.0)
    }
}

#[tauri::command]
pub async fn get_inventory_items(
    db: State<'_, Arc<Connection>>,
    restaurant_id: String,
) -> Result<Vec<InventoryItem>, String> {
    let mut rows = db.query(
        "SELECT id, name, khmer_name, unit_label, stock_qty, stock_pct, min_stock_qty, cost_per_unit, created_at, max_stock_qty
         FROM inventory_items
            WHERE restaurant_id = ? AND COALESCE(is_deleted, 0) = 0
         ORDER BY name ASC",
         params![restaurant_id]
    )
    .await
    .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    while let Ok(Some(row)) = rows.next().await {
        let stock_qty = get_f64_safe(&row, 4);
        let min_stock_qty = get_f64_safe(&row, 6);
        let max_stock_qty = get_f64_opt(&row, 9);
        let stock_pct = calc_stock_pct(stock_qty, min_stock_qty, max_stock_qty);
        items.push(InventoryItem {
            id: row.get::<String>(0).unwrap_or_default(),
            name: row.get::<String>(1).unwrap_or_default(),
            khmer_name: row.get::<String>(2).ok(),
            unit_label: row.get::<String>(3).unwrap_or_default(),
            stock_qty,
            stock_pct,
            min_stock_qty,
            max_stock_qty,
            cost_per_unit: get_f64_safe(&row, 7),
            created_at: row.get::<String>(8).unwrap_or_default(),
        });
    }
    
    Ok(items)
}

#[tauri::command]
pub async fn create_inventory_item(
    db: State<'_, Arc<Connection>>,
    name: String,
    khmer_name: Option<String>,
    unit_label: String,
    stock_qty: f64,
    min_stock_qty: f64,
    max_stock_qty: Option<f64>,
    cost_per_unit: f64,
    restaurant_id: String,
) -> Result<InventoryItem, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let stock_pct = calc_stock_pct(stock_qty, min_stock_qty, max_stock_qty);

    let query = "
        INSERT INTO inventory_items (id, name, khmer_name, unit_label, stock_qty, stock_pct, min_stock_qty, max_stock_qty, cost_per_unit, restaurant_id, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, datetime('now'))
        RETURNING id, name, khmer_name, unit_label, stock_qty, stock_pct, min_stock_qty, cost_per_unit, created_at, max_stock_qty
    ";

    let mut rows = db.query(query, params![
        id.clone(),
        name,
        khmer_name.unwrap_or_default(),
        unit_label,
        stock_qty,
        stock_pct,
        min_stock_qty,
        max_stock_qty,
        cost_per_unit,
        restaurant_id
    ]).await.map_err(|e| e.to_string())?;

    let row = rows.next().await.map_err(|e| e.to_string())?.ok_or_else(|| "Insert failed".to_string())?;
    let sq = get_f64_safe(&row, 4);
    let mn = get_f64_safe(&row, 6);
    let mx = get_f64_opt(&row, 9);

    Ok(InventoryItem {
        id: row.get::<String>(0).unwrap_or_default(),
        name: row.get::<String>(1).unwrap_or_default(),
        khmer_name: row.get::<String>(2).ok(),
        unit_label: row.get::<String>(3).unwrap_or_default(),
        stock_qty: sq,
        stock_pct: calc_stock_pct(sq, mn, mx),
        min_stock_qty: mn,
        max_stock_qty: mx,
        cost_per_unit: get_f64_safe(&row, 7),
        created_at: row.get::<String>(8).unwrap_or_default(),
    })
}

#[tauri::command]
pub async fn update_inventory_item(
    db: State<'_, Arc<Connection>>,
    id: String,
    name: String,
    khmer_name: Option<String>,
    unit_label: String,
    stock_qty: f64,
    min_stock_qty: f64,
    max_stock_qty: Option<f64>,
    cost_per_unit: f64,
    restaurant_id: String,
    user_id: Option<String>,
) -> Result<InventoryItem, String> {
    let stock_pct = calc_stock_pct(stock_qty, min_stock_qty, max_stock_qty);

    // Capture the previous stock level so a manual edit that changes it is logged
    // as an "adjustment" movement (delta = new - old) for the audit trail.
    let prev_stock_qty: Option<f64> = {
        let mut rows = db.query(
            "SELECT stock_qty FROM inventory_items WHERE id = ? AND restaurant_id = ?",
            params![id.clone(), restaurant_id.clone()],
        ).await.map_err(|e| e.to_string())?;
        rows.next().await.map_err(|e| e.to_string())?.map(|row| get_f64_safe(&row, 0))
    };

    let query = "
        UPDATE inventory_items
        SET name = ?2, khmer_name = ?3, unit_label = ?4, stock_qty = ?5, stock_pct = ?6, min_stock_qty = ?7, max_stock_qty = ?8, cost_per_unit = ?9, updated_at = datetime('now')
        WHERE id = ?1 AND restaurant_id = ?10
        RETURNING id, name, khmer_name, unit_label, stock_qty, stock_pct, min_stock_qty, cost_per_unit, created_at, max_stock_qty
    ";

    let mut rows = db.query(query, params![
        id.clone(),
        name,
        khmer_name.unwrap_or_default(),
        unit_label,
        stock_qty,
        stock_pct,
        min_stock_qty,
        max_stock_qty,
        cost_per_unit,
        restaurant_id.clone()
    ]).await.map_err(|e| e.to_string())?;

    let row = rows.next().await.map_err(|e| e.to_string())?.ok_or_else(|| "Update failed".to_string())?;
    let sq = get_f64_safe(&row, 4);
    let mn = get_f64_safe(&row, 6);
    let mx = get_f64_opt(&row, 9);

    if let Some(prev) = prev_stock_qty {
        let delta = sq - prev;
        if delta.abs() > f64::EPSILON {
            let movement_id = uuid::Uuid::new_v4().to_string();
            let _ = db.execute(
                "INSERT INTO inventory_movements (id, inventory_item_id, movement_type, quantity, note, user_id, restaurant_id) VALUES (?, ?, 'adjustment', ?, NULL, ?, ?)",
                params![movement_id, id.clone(), delta, user_id.clone(), restaurant_id.clone()],
            ).await;
        }
    }

    Ok(InventoryItem {
        id: row.get::<String>(0).unwrap_or_default(),
        name: row.get::<String>(1).unwrap_or_default(),
        khmer_name: row.get::<String>(2).ok(),
        unit_label: row.get::<String>(3).unwrap_or_default(),
        stock_qty: sq,
        stock_pct: calc_stock_pct(sq, mn, mx),
        min_stock_qty: mn,
        max_stock_qty: mx,
        cost_per_unit: get_f64_safe(&row, 7),
        created_at: row.get::<String>(8).unwrap_or_default(),
    })
}

#[tauri::command]
pub async fn delete_inventory_item(
    db: State<'_, Arc<Connection>>,
    id: String,
    restaurant_id: String,
    actor_user_id: String,
) -> Result<(), String> {
    let actor_role = rbac::require_delete_permission(&db, &actor_user_id, &restaurant_id).await?;

    db.execute(
        "UPDATE inventory_items SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?1 AND restaurant_id = ?2",
        params![id.clone(), restaurant_id.clone()],
    )
        .await
        .map_err(|e| e.to_string())?;

    rbac::write_audit_log(
        &db,
        &restaurant_id,
        &actor_user_id,
        &actor_role,
        "delete",
        "inventory_item",
        &id,
        None,
    ).await;

    Ok(())
}

#[derive(Debug, serde::Serialize)]
pub struct StockMovement {
    pub id: String,
    pub inventory_item_id: String,
    pub movement_type: String,
    pub quantity: f64,
    pub note: Option<String>,
    pub user_id: Option<String>,
    pub created_at: String,
}

#[tauri::command]
pub async fn receive_stock(
    inventory_item_id: String,
    quantity: f64,
    note: Option<String>,
    user_id: String,
    restaurant_id: String,
    db: State<'_, Arc<Connection>>,
) -> Result<InventoryItem, String> {
    if quantity <= 0.0 {
        return Err("Quantity must be greater than zero".to_string());
    }

    db.execute(
        "UPDATE inventory_items SET stock_qty = stock_qty + ?, updated_at = datetime('now') WHERE id = ? AND restaurant_id = ?",
        params![quantity, inventory_item_id.clone(), restaurant_id.clone()],
    ).await.map_err(|e| format!("Update stock failed: {}", e))?;

    let movement_id = uuid::Uuid::new_v4().to_string();
    db.execute(
        "INSERT INTO inventory_movements (id, inventory_item_id, movement_type, quantity, note, user_id, restaurant_id) VALUES (?, ?, 'receive', ?, ?, ?, ?)",
        params![movement_id, inventory_item_id.clone(), quantity, note.clone(), user_id.clone(), restaurant_id.clone()],
    ).await.map_err(|e| format!("Insert movement failed: {}", e))?;

    let mut rows = db.query(
        "SELECT id, name, khmer_name, unit_label, stock_qty, stock_pct, min_stock_qty, max_stock_qty, cost_per_unit, created_at FROM inventory_items WHERE id = ? AND restaurant_id = ?",
        params![inventory_item_id.clone(), restaurant_id.clone()],
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let row = rows.next().await.map_err(|e| e.to_string())?.ok_or("Item not found")?;
    Ok(InventoryItem {
        id: row.get::<String>(0).unwrap_or_default(),
        name: row.get::<String>(1).unwrap_or_default(),
        khmer_name: row.get::<String>(2).ok(),
        unit_label: row.get::<String>(3).unwrap_or_default(),
        stock_qty: get_f64_safe(&row, 4),
        stock_pct: get_f64_safe(&row, 5),
        min_stock_qty: get_f64_safe(&row, 6),
        max_stock_qty: get_f64_opt(&row, 7),
        cost_per_unit: get_f64_safe(&row, 8),
        created_at: row.get::<String>(9).unwrap_or_default(),
    })
}

#[tauri::command]
pub async fn get_stock_movements(
    inventory_item_id: String,
    restaurant_id: String,
    limit: Option<i64>,
    db: State<'_, Arc<Connection>>,
) -> Result<Vec<StockMovement>, String> {
    let lim = limit.unwrap_or(10);
    let mut rows = db.query(
        "SELECT id, inventory_item_id, movement_type, quantity, note, user_id, created_at
         FROM inventory_movements
         WHERE inventory_item_id = ? AND restaurant_id = ?
         ORDER BY created_at DESC LIMIT ?",
        params![inventory_item_id, restaurant_id, lim],
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let mut movements = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        movements.push(StockMovement {
            id: row.get::<String>(0).unwrap_or_default(),
            inventory_item_id: row.get::<String>(1).unwrap_or_default(),
            movement_type: row.get::<String>(2).unwrap_or_default(),
            quantity: get_f64_safe(&row, 3),
            note: row.get::<String>(4).ok(),
            user_id: row.get::<String>(5).ok(),
            created_at: row.get::<String>(6).unwrap_or_default(),
        });
    }
    Ok(movements)
}

