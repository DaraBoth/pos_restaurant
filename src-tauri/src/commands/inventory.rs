use tauri::State;
use std::sync::Arc;
use libsql::{Connection, params};
use crate::models::InventoryItem;

fn get_f64_safe(row: &libsql::Row, idx: i32) -> f64 {
    match row.get_value(idx) {
        Ok(libsql::Value::Integer(i)) => i as f64,
        Ok(libsql::Value::Real(f)) => f,
        _ => 0.0,
    }
}

#[tauri::command]
pub async fn get_inventory_items(
    db: State<'_, Arc<Connection>>,
    restaurant_id: String,
) -> Result<Vec<InventoryItem>, String> {
    let mut rows = db.query(
        "SELECT id, name, khmer_name, unit_label, stock_qty, stock_pct, min_stock_qty, cost_per_unit, created_at 
         FROM inventory_items 
         WHERE restaurant_id = ?
         ORDER BY name ASC",
         params![restaurant_id]
    )
    .await
    .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    while let Ok(Some(row)) = rows.next().await {
        items.push(InventoryItem {
            id: row.get::<String>(0).unwrap_or_default(),
            name: row.get::<String>(1).unwrap_or_default(),
            khmer_name: row.get::<String>(2).ok(),
            unit_label: row.get::<String>(3).unwrap_or_default(),
            stock_qty: get_f64_safe(&row, 4),
            stock_pct: get_f64_safe(&row, 5),
            min_stock_qty: get_f64_safe(&row, 6),
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
    cost_per_unit: f64,
    restaurant_id: String,
) -> Result<InventoryItem, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let stock_pct = if min_stock_qty > 0.0 { (stock_qty / (min_stock_qty * 2.0)) * 100.0 } else { 100.0 };
    
    let query = "
        INSERT INTO inventory_items (id, name, khmer_name, unit_label, stock_qty, stock_pct, min_stock_qty, cost_per_unit, restaurant_id, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'))
        RETURNING id, name, khmer_name, unit_label, stock_qty, stock_pct, min_stock_qty, cost_per_unit, created_at
    ";

    let mut rows = db.query(query, params![
        id.clone(),
        name,
        khmer_name.unwrap_or_default(),
        unit_label,
        stock_qty,
        stock_pct,
        min_stock_qty,
        cost_per_unit,
        restaurant_id
    ]).await.map_err(|e| e.to_string())?;

    let row = rows.next().await.map_err(|e| e.to_string())?.ok_or_else(|| "Insert failed".to_string())?;

    Ok(InventoryItem {
        id: row.get::<String>(0).unwrap_or_default(),
        name: row.get::<String>(1).unwrap_or_default(),
        khmer_name: row.get::<String>(2).ok(),
        unit_label: row.get::<String>(3).unwrap_or_default(),
        stock_qty: get_f64_safe(&row, 4),
        stock_pct: get_f64_safe(&row, 5),
        min_stock_qty: get_f64_safe(&row, 6),
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
    cost_per_unit: f64,
    restaurant_id: String,
) -> Result<InventoryItem, String> {
    let stock_pct = if min_stock_qty > 0.0 { (stock_qty / (min_stock_qty * 2.0)) * 100.0 } else { 100.0 };

    let query = "
        UPDATE inventory_items 
        SET name = ?2, khmer_name = ?3, unit_label = ?4, stock_qty = ?5, stock_pct = ?6, min_stock_qty = ?7, cost_per_unit = ?8, updated_at = datetime('now')
        WHERE id = ?1 AND restaurant_id = ?9
        RETURNING id, name, khmer_name, unit_label, stock_qty, stock_pct, min_stock_qty, cost_per_unit, created_at
    ";

    let mut rows = db.query(query, params![
        id.clone(),
        name,
        khmer_name.unwrap_or_default(),
        unit_label,
        stock_qty,
        stock_pct,
        min_stock_qty,
        cost_per_unit,
        restaurant_id
    ]).await.map_err(|e| e.to_string())?;

    let row = rows.next().await.map_err(|e| e.to_string())?.ok_or_else(|| "Update failed".to_string())?;

    Ok(InventoryItem {
        id: row.get::<String>(0).unwrap_or_default(),
        name: row.get::<String>(1).unwrap_or_default(),
        khmer_name: row.get::<String>(2).ok(),
        unit_label: row.get::<String>(3).unwrap_or_default(),
        stock_qty: get_f64_safe(&row, 4),
        stock_pct: get_f64_safe(&row, 5),
        min_stock_qty: get_f64_safe(&row, 6),
        cost_per_unit: get_f64_safe(&row, 7),
        created_at: row.get::<String>(8).unwrap_or_default(),
    })
}

#[tauri::command]
pub async fn delete_inventory_item(db: State<'_, Arc<Connection>>, id: String, restaurant_id: String) -> Result<(), String> {
    db.execute("DELETE FROM inventory_items WHERE id = ?1 AND restaurant_id = ?2", params![id, restaurant_id])
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

