use tauri::State;
use std::sync::Arc;
use libsql::{Connection, params};
use crate::commands::rbac;
use crate::models::{Order, OrderItem, PaymentInput};

fn get_f64_safe(row: &libsql::Row, idx: i32) -> f64 {
    match row.get_value(idx) {
        Ok(libsql::Value::Integer(i)) => i as f64,
        Ok(libsql::Value::Real(f)) => f,
        _ => 0.0,
    }
}
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevenueSummary {
    pub today_usd: i64,
    pub today_orders: i64,
    pub month_usd: i64,
    pub month_orders: i64,
    pub year_usd: i64,
    pub year_orders: i64,
    pub open_orders: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RevenueByDay {
    pub date: String,
    pub total_usd: i64,
    pub order_count: i64,
}

/// GDT/NBC KHR rounding: if decimal part > 0.5, round up; otherwise round down (truncate)
fn round_khr(usd_cents: i64, rate: f64) -> i64 {
    let total_khr_float = (usd_cents as f64 / 100.0) * rate;
    (total_khr_float / 100.0).round() as i64 * 100
}

#[tauri::command]
pub async fn create_order(
    user_id: String,
    table_id: Option<String>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<String, String> {
    // ── Pre-flight: verify FK targets exist locally ────────────────────────
    // The orders table has FKs on user_id → users(id) and restaurant_id →
    // restaurants(id). If either row hasn't been synced to this device yet
    // (first login on a new install, partial sync, stale session in
    // localStorage), the INSERT later in this function fails with a
    // generic "FOREIGN KEY constraint failed" that the cashier can't act on.
    // Surface a clear, actionable message before we get there.
    {
        let mut u_check = pool.query(
            "SELECT 1 FROM users WHERE id = ?",
            params![user_id.clone()]
        ).await.map_err(|e| format!("Database error: {}", e))?;
        if u_check.next().await.map_err(|e| e.to_string())?.is_none() {
            return Err(format!(
                "Cannot place order: your user account (id={}) is not on this device yet. Wait for initial sync to finish, then log out and back in. If this persists, contact support.",
                user_id
            ));
        }
    }
    {
        let mut r_check = pool.query(
            "SELECT 1 FROM restaurants WHERE id = ?",
            params![restaurant_id.clone()]
        ).await.map_err(|e| format!("Database error: {}", e))?;
        if r_check.next().await.map_err(|e| e.to_string())?.is_none() {
            return Err(format!(
                "Cannot place order: restaurant (id={}) is not on this device yet. Wait for sync to finish, then retry.",
                restaurant_id
            ));
        }
    }

    let mut session_id = None;
    let mut round_number = 1;

    if let Some(table_name) = &table_id {
        let mut trows = pool.query("SELECT id FROM floor_tables WHERE name = ? AND restaurant_id = ?", params![table_name.clone(), restaurant_id.clone()]).await.map_err(|e| e.to_string())?;
        
        let real_table_id = if let Some(trow) = trows.next().await.map_err(|e| e.to_string())? {
            trow.get::<String>(0).unwrap_or_default()
        } else {
            return Err(format!("Table {} does not exist", table_name));
        };

        let mut rows = pool.query(
            "SELECT id FROM orders WHERE table_id = ? AND restaurant_id = ? AND status = 'open' AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1",
            params![table_name.clone(), restaurant_id.clone()]
        ).await.map_err(|e| format!("Query open orders error: {}", e))?;

        if let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
            return Ok(row.get::<String>(0).unwrap_or_default());
        }

        let mut session_rows = pool.query(
            "SELECT id FROM table_sessions WHERE (table_id = ? OR table_id = ?) AND restaurant_id = ? AND status = 'active'",
            params![real_table_id.clone(), table_name.clone(), restaurant_id.clone()]
        ).await.map_err(|e| format!("Query active sessions error: {}", e))?;

        if let Some(s_row) = session_rows.next().await.map_err(|e| e.to_string())? {
            let sid = s_row.get::<String>(0).unwrap_or_default();
            session_id = Some(sid.clone());
            
            let mut round_rows = pool.query(
                "SELECT MAX(round_number) FROM orders WHERE session_id = ? AND is_deleted = 0",
                params![sid]
            ).await.map_err(|e| format!("Query MAX round_number error: {}", e))?;
            
            if let Some(r_row) = round_rows.next().await.map_err(|e| e.to_string())? {
                if let Ok(val) = r_row.get::<i64>(0) {
                    round_number = val + 1;
                }
            }
        } else {
            let sid = uuid::Uuid::new_v4().to_string();
            pool.execute("INSERT INTO table_sessions (id, table_id, status, restaurant_id) VALUES (?, ?, 'active', ?)", 
                         params![sid.clone(), real_table_id.clone(), restaurant_id.clone()]).await.map_err(|e| format!("Insert table_sessions error (sid={}, table_id={}): {}", sid, real_table_id, e))?;
            session_id = Some(sid);
        }
    }

    let id = uuid::Uuid::new_v4().to_string();
    // Use explicit NULL for takeout orders (no table); store "" (empty) only for table orders
    let table_id_val = table_id.clone().unwrap_or_default();
    let session_id_val = session_id.unwrap_or_default();
    pool.execute(
        "INSERT INTO orders (id, user_id, table_id, session_id, round_number, status, restaurant_id) VALUES (?, ?, NULLIF(?, ''), NULLIF(?, ''), ?, 'open', ?)",
        params![id.clone(), user_id.clone(), table_id_val.clone(), session_id_val.clone(), round_number, restaurant_id.clone()]
    ).await.map_err(|e| format!("Insert orders error (id={}, user_id={}, table_id={}, session_id={}): {}", id, user_id, table_id_val, session_id_val, e))?;

    if let Some(table_name) = &table_id {
        let mut trows = pool.query("SELECT id FROM floor_tables WHERE name = ? AND restaurant_id = ?", params![table_name.clone(), restaurant_id.clone()]).await.map_err(|e| e.to_string())?;
        if let Some(trow) = trows.next().await.map_err(|e| e.to_string())? {
            let real_tid = trow.get::<String>(0).unwrap_or_default();
            set_table_status(&real_tid, "busy", &restaurant_id, &pool).await?;
        }
    }

    Ok(id)
}

#[tauri::command]
pub async fn add_order_item(
    order_id: String,
    product_id: String,
    quantity: i64,
    note: Option<String>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<OrderItem, String> {
    // 1. Verify order belongs to restaurant
    let mut ord_rows = pool.query(
        "SELECT id FROM orders WHERE id = ? AND restaurant_id = ? AND is_deleted = 0",
        params![order_id.clone(), restaurant_id.clone()]
    ).await.map_err(|e| e.to_string())?;
    
    if ord_rows.next().await.map_err(|e| e.to_string())?.is_none() {
        return Err("Order not found or access denied".to_string());
    }

    // 2. Verify product belongs to restaurant
    let mut prod_rows = pool.query(
        "SELECT price_cents, name, khmer_name FROM products WHERE id = ? AND restaurant_id = ? AND is_deleted = 0",
        params![product_id.clone(), restaurant_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let prod_row = prod_rows.next().await.map_err(|e| e.to_string())?.ok_or_else(|| "Product not found".to_string())?;
    let price_cents = prod_row.get::<i64>(0).unwrap_or(0);
    let p_name = prod_row.get::<String>(1).unwrap_or_default();
    let p_khmer = prod_row.get::<String>(2).ok();

    // 3. Update existing item if pending
    let mut ext_rows = pool.query(
        "SELECT oi.id, oi.quantity FROM order_items oi 
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.order_id = ? AND oi.product_id = ? AND oi.is_deleted = 0 
           AND oi.kitchen_status = 'pending' AND o.restaurant_id = ?",
        params![order_id.clone(), product_id.clone(), restaurant_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    if let Some(ext_row) = ext_rows.next().await.map_err(|e| e.to_string())? {
        let existing_id = ext_row.get::<String>(0).unwrap_or_default();
        let current_qty = ext_row.get::<i64>(1).unwrap_or(0);
        let new_qty = current_qty + quantity;
        
        let _: u64 = pool.execute(
            "UPDATE order_items SET quantity = ? 
             WHERE id = ? AND order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)", 
            params![new_qty, existing_id.clone(), restaurant_id.clone()]
        )
            .await.map_err(|e| format!("Database error: {}", e))?;

        recalculate_order_totals(&order_id, &restaurant_id, &pool).await?;

        return Ok(OrderItem {
            id: existing_id,
            order_id,
            product_id,
            quantity: new_qty,
            price_at_order: price_cents,
            note,
            kitchen_status: "pending".to_string(),
            product_name: Some(p_name),
            product_khmer: p_khmer,
            image_path: None,
        });
    }

    // 4. Create new item (snapshot product_name + product_khmer so history is preserved even after product deletion)
    let id = uuid::Uuid::new_v4().to_string();
    pool.execute(
        "INSERT INTO order_items (id, order_id, product_id, quantity, price_at_order, note, kitchen_status, product_name, product_khmer) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
        params![id.clone(), order_id.clone(), product_id.clone(), quantity, price_cents, note.clone().unwrap_or_default(), p_name.clone(), p_khmer.clone().unwrap_or_default()]
    ).await.map_err(|e| format!("Insert order_items error (order_id={}, product_id={}): {}", order_id, product_id, e))?;

    recalculate_order_totals(&order_id, &restaurant_id, &pool).await?;

    Ok(OrderItem {
        id,
        order_id,
        product_id,
        quantity,
        price_at_order: price_cents,
        note,
        kitchen_status: "pending".to_string(),
        product_name: Some(p_name),
        product_khmer: p_khmer,
        image_path: None,
    })
}

#[tauri::command]
pub async fn update_order_item_quantity(
    item_id: String,
    quantity: i64,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    let mut rows = pool.query(
        "SELECT oi.order_id FROM order_items oi 
         JOIN orders o ON oi.order_id = o.id 
         WHERE oi.id = ? AND o.restaurant_id = ?", 
        params![item_id.clone(), restaurant_id.clone()]
    )
        .await.map_err(|e| format!("Database error: {}", e))?;

    let row = rows.next().await.map_err(|e| e.to_string())?.ok_or_else(|| "Item not found".to_string())?;
    let order_id = row.get::<String>(0).unwrap_or_default();

    if quantity <= 0 {
        let _: u64 = pool.execute(
            "UPDATE order_items SET is_deleted = 1 
             WHERE id = ? AND order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)", 
            params![item_id, restaurant_id.clone()]
        )
            .await.map_err(|e| format!("Database error: {}", e))?;
    } else {
        let _: u64 = pool.execute(
            "UPDATE order_items SET quantity = ? 
             WHERE id = ? AND order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)", 
            params![quantity, item_id, restaurant_id.clone()]
        )
            .await.map_err(|e| format!("Database error: {}", e))?;
    }
    
    recalculate_order_totals(&order_id, &restaurant_id, &pool).await?;
    Ok(())
}

#[tauri::command]
pub async fn get_order_items(
    order_id: String,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<Vec<OrderItem>, String> {
    // Read from snapshot columns (product_name, product_khmer stored at order time).
    // Fallback to join for legacy rows that were inserted before the snapshot migration.
    let mut rows = pool.query(
        "SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.price_at_order, oi.note,
                oi.kitchen_status,
                COALESCE(NULLIF(oi.product_name, ''), p.name)       AS product_name,
                COALESCE(NULLIF(oi.product_khmer, ''), p.khmer_name) AS product_khmer,
                p.image_path
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ? AND o.restaurant_id = ? AND oi.is_deleted = 0
         ORDER BY oi.created_at",
         params![order_id, restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let mut items = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        items.push(OrderItem {
            id: row.get::<String>(0).unwrap_or_default(),
            order_id: row.get::<String>(1).unwrap_or_default(),
            product_id: row.get::<String>(2).unwrap_or_default(),
            quantity: row.get::<i64>(3).unwrap_or(0),
            price_at_order: row.get::<i64>(4).unwrap_or(0),
            note: row.get::<String>(5).ok(),
            kitchen_status: row.get::<String>(6).unwrap_or_default(),
            product_name: row.get::<String>(7).ok(),
            product_khmer: row.get::<String>(8).ok(),
            image_path: row.get::<String>(9).ok(),
        });
    }

    Ok(items)
}

#[tauri::command]
pub async fn update_order_item_note(
    item_id: String,
    note: Option<String>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    pool.execute(
        "UPDATE order_items SET note = ? 
         WHERE id = ? AND is_deleted = 0 
           AND order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)", 
        params![note.unwrap_or_default(), item_id, restaurant_id]
    )
        .await.map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_orders(
    status: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<Vec<Order>, String> {
    let mut query = String::from(
        "SELECT id, user_id, table_id, session_id, round_number, status, total_usd, total_khr, tax_vat, tax_plt,
                bakong_bill_number, notes, customer_name, customer_phone, created_at, updated_at, completed_at
         FROM orders WHERE is_deleted = 0 AND restaurant_id = ?"
    );

    let mut args = Vec::new();
    args.push(libsql::Value::Text(restaurant_id));

    if let Some(s) = status {
        query.push_str(" AND status = ?");
        args.push(libsql::Value::Text(s));
    }
    if let Some(sd) = start_date {
        query.push_str(" AND created_at >= ?");
        args.push(libsql::Value::Text(format!("{} 00:00:00", sd)));
    }
    if let Some(ed) = end_date {
        query.push_str(" AND created_at <= ?");
        args.push(libsql::Value::Text(format!("{} 23:59:59", ed)));
    }

    query.push_str(" ORDER BY created_at DESC LIMIT 500");

    let mut rows = pool.query(query.as_str(), args)
        .await.map_err(|e| format!("Database error: {}", e))?;

    let mut orders = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        orders.push(Order {
            id: row.get::<String>(0).unwrap_or_default(),
            user_id: row.get::<String>(1).ok(),
            table_id: row.get::<String>(2).ok(),
            session_id: row.get::<String>(3).ok(),
            round_number: row.get::<i64>(4).unwrap_or(1),
            status: row.get::<String>(5).unwrap_or_default(),
            total_usd: row.get::<i64>(6).unwrap_or(0),
            total_khr: row.get::<i64>(7).unwrap_or(0),
            tax_vat: row.get::<i64>(8).unwrap_or(0),
            tax_plt: row.get::<i64>(9).unwrap_or(0),
            bakong_bill_number: row.get::<String>(10).ok(),
            notes: row.get::<String>(11).ok(),
            customer_name: row.get::<String>(12).ok(),
            customer_phone: row.get::<String>(13).ok(),
            created_at: row.get::<String>(14).unwrap_or_default(),
            updated_at: row.get::<String>(15).ok(),
            completed_at: row.get::<String>(16).ok(),
        });
    }

    Ok(orders)
}

#[tauri::command]
pub async fn get_session_rounds(
    session_id: String,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<Vec<Order>, String> {
    let mut rows = pool.query(
        "SELECT id, user_id, table_id, session_id, round_number, status, total_usd, total_khr, tax_vat, tax_plt,
                bakong_bill_number, notes, customer_name, customer_phone, created_at, updated_at, completed_at
         FROM orders
         WHERE session_id = ? AND restaurant_id = ? AND is_deleted = 0
         ORDER BY round_number ASC",
        params![session_id, restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let mut orders = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        orders.push(Order {
            id: row.get::<String>(0).unwrap_or_default(),
            user_id: row.get::<String>(1).ok(),
            table_id: row.get::<String>(2).ok(),
            session_id: row.get::<String>(3).ok(),
            round_number: row.get::<i64>(4).unwrap_or(1),
            status: row.get::<String>(5).unwrap_or_default(),
            total_usd: row.get::<i64>(6).unwrap_or(0),
            total_khr: row.get::<i64>(7).unwrap_or(0),
            tax_vat: row.get::<i64>(8).unwrap_or(0),
            tax_plt: row.get::<i64>(9).unwrap_or(0),
            bakong_bill_number: row.get::<String>(10).ok(),
            notes: row.get::<String>(11).ok(),
            customer_name: row.get::<String>(12).ok(),
            customer_phone: row.get::<String>(13).ok(),
            created_at: row.get::<String>(14).unwrap_or_default(),
            updated_at: row.get::<String>(15).ok(),
            completed_at: row.get::<String>(16).ok(),
        });
    }

    Ok(orders)
}

#[tauri::command]
pub async fn get_session_order_items(
    session_id: String,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<Vec<OrderItem>, String> {
    let mut rows = pool.query(
        "SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.price_at_order, oi.note,
                oi.kitchen_status,
                COALESCE(NULLIF(oi.product_name, ''), p.name)        AS product_name,
                COALESCE(NULLIF(oi.product_khmer, ''), p.khmer_name)  AS product_khmer,
                p.image_path
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE o.session_id = ? AND o.restaurant_id = ? AND oi.is_deleted = 0 AND o.is_deleted = 0
         ORDER BY o.round_number, oi.created_at",
         params![session_id, restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let mut items = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        items.push(OrderItem {
            id: row.get::<String>(0).unwrap_or_default(),
            order_id: row.get::<String>(1).unwrap_or_default(),
            product_id: row.get::<String>(2).unwrap_or_default(),
            quantity: row.get::<i64>(3).unwrap_or(0),
            price_at_order: row.get::<i64>(4).unwrap_or(0),
            note: row.get::<String>(5).ok(),
            kitchen_status: row.get::<String>(6).unwrap_or_default(),
            product_name: row.get::<String>(7).ok(),
            product_khmer: row.get::<String>(8).ok(),
            image_path: row.get::<String>(9).ok(),
        });
    }

    Ok(items)
}

#[tauri::command]
pub async fn get_active_order_for_table(
    table_id: String,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<Option<Order>, String> {
    let mut rows = pool.query(
        "SELECT id, user_id, table_id, session_id, round_number, status, total_usd, total_khr, tax_vat, tax_plt,
                bakong_bill_number, notes, customer_name, customer_phone, created_at, updated_at, completed_at
         FROM orders
         WHERE table_id = ? AND restaurant_id = ? AND status IN ('open', 'pending_payment') AND is_deleted = 0
         ORDER BY created_at DESC
         LIMIT 1",
         params![table_id, restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    if let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        Ok(Some(Order {
            id: row.get::<String>(0).unwrap_or_default(),
            user_id: row.get::<String>(1).ok(),
            table_id: row.get::<String>(2).ok(),
            session_id: row.get::<String>(3).ok(),
            round_number: row.get::<i64>(4).unwrap_or(1),
            status: row.get::<String>(5).unwrap_or_default(),
            total_usd: row.get::<i64>(6).unwrap_or(0),
            total_khr: row.get::<i64>(7).unwrap_or(0),
            tax_vat: row.get::<i64>(8).unwrap_or(0),
            tax_plt: row.get::<i64>(9).unwrap_or(0),
            bakong_bill_number: row.get::<String>(10).ok(),
            notes: row.get::<String>(11).ok(),
            customer_name: row.get::<String>(12).ok(),
            customer_phone: row.get::<String>(13).ok(),
            created_at: row.get::<String>(14).unwrap_or_default(),
            updated_at: row.get::<String>(15).ok(),
            completed_at: row.get::<String>(16).ok(),
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn get_orders_for_table(
    table_id: String,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<Vec<Order>, String> {
    let mut rows = pool.query(
        "SELECT id, user_id, table_id, session_id, round_number, status, total_usd, total_khr, tax_vat, tax_plt,
                bakong_bill_number, notes, customer_name, customer_phone, created_at, updated_at, completed_at
         FROM orders
         WHERE table_id = ? AND restaurant_id = ? AND is_deleted = 0
         ORDER BY created_at DESC",
         params![table_id, restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let mut orders = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        orders.push(Order {
            id: row.get::<String>(0).unwrap_or_default(),
            user_id: row.get::<String>(1).ok(),
            table_id: row.get::<String>(2).ok(),
            session_id: row.get::<String>(3).ok(),
            round_number: row.get::<i64>(4).unwrap_or(1),
            status: row.get::<String>(5).unwrap_or_default(),
            total_usd: row.get::<i64>(6).unwrap_or(0),
            total_khr: row.get::<i64>(7).unwrap_or(0),
            tax_vat: row.get::<i64>(8).unwrap_or(0),
            tax_plt: row.get::<i64>(9).unwrap_or(0),
            bakong_bill_number: row.get::<String>(10).ok(),
            notes: row.get::<String>(11).ok(),
            customer_name: row.get::<String>(12).ok(),
            customer_phone: row.get::<String>(13).ok(),
            created_at: row.get::<String>(14).unwrap_or_default(),
            updated_at: row.get::<String>(15).ok(),
            completed_at: row.get::<String>(16).ok(),
        });
    }

    Ok(orders)
}

#[tauri::command]
pub async fn checkout_order(
    order_id: String,
    payments: Vec<PaymentInput>,
    discount_cents: Option<i64>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<Order, String> {
    let mut tb_rows = pool.query("SELECT table_id, user_id FROM orders WHERE id = ? AND restaurant_id = ?", params![order_id.clone(), restaurant_id.clone()])
        .await.map_err(|e| format!("Database error: {}", e))?;
    let mut table_id = None;
    let mut order_user_id = None;
    if let Some(row) = tb_rows.next().await.map_err(|e| e.to_string())? {
        table_id = row.get::<String>(0).ok();
        order_user_id = row.get::<String>(1).ok();
    }

    let mut sub_rows = pool.query(
        "SELECT COALESCE(SUM(price_at_order * quantity), 0)
         FROM order_items
         WHERE order_id = ? AND is_deleted = 0",
         params![order_id.clone()]
    ).await.map_err(|e| format!("Subtotal error: {}", e))?;
    let done_subtotal = if let Some(row) = sub_rows.next().await.map_err(|e| e.to_string())? {
        row.get::<i64>(0).unwrap_or(0)
    } else { 0 };

    let final_total = (done_subtotal - discount_cents.unwrap_or(0)).max(0);
    
    let mut rate_rows = pool.query("SELECT rate FROM exchange_rates WHERE restaurant_id = ? ORDER BY effective_from DESC LIMIT 1", params![restaurant_id.clone()])
        .await.map_err(|e| e.to_string())?;
    let exch_rate = if let Some(row) = rate_rows.next().await.map_err(|e| e.to_string())? {
        get_f64_safe(&row, 0)
    } else { 4100.0 };
    
    let final_khr = round_khr(final_total, exch_rate);

    pool.execute(
        "UPDATE orders SET total_usd = ?, total_khr = ?, tax_vat = 0, tax_plt = 0,
                status = 'completed', updated_at = datetime('now'), completed_at = datetime('now')
         WHERE id = ? AND restaurant_id = ?",
         params![final_total, final_khr, order_id.clone(), restaurant_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let mut item_rows = pool.query(
        "SELECT product_id, quantity FROM order_items 
         WHERE order_id = ? AND is_deleted = 0
           AND order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)",
        params![order_id.clone(), restaurant_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;
    
    let mut sold_items = Vec::new();
    while let Some(row) = item_rows.next().await.map_err(|e| e.to_string())? {
        sold_items.push((row.get::<String>(0).unwrap_or_default(), row.get::<i64>(1).unwrap_or(0)));
    }

    for (p_id, qty) in sold_items {
        deduct_inventory(&p_id, qty, &restaurant_id, order_user_id.as_deref(), &pool).await?;
    }

    for p in &payments {
        let pid = uuid::Uuid::new_v4().to_string();
        let _: u64 = pool.execute(
            "INSERT INTO payments (id, order_id, method, currency, amount, bakong_transaction_hash)
             VALUES (?, ?, ?, ?, ?, ?)",
            params![pid, order_id.clone(), p.method.clone(), p.currency.clone(), p.amount, p.bakong_transaction_hash.clone().unwrap_or_default()]
        ).await.map_err(|e| format!("Payment insert error: {}", e))?;
    }

    if let Some(table_name) = table_id {
        release_table_if_no_open_orders(&table_name, &restaurant_id, &pool).await?;
    }

    let mut order_rows = pool.query(
        "SELECT id, user_id, table_id, session_id, round_number, status, total_usd, total_khr, tax_vat, tax_plt,
                bakong_bill_number, notes, customer_name, customer_phone, created_at, updated_at, completed_at
         FROM orders WHERE id=? AND restaurant_id = ?",
         params![order_id, restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let row = order_rows.next().await.map_err(|e| e.to_string())?.ok_or_else(|| "Order missing".to_string())?;

    Ok(Order {
        id: row.get::<String>(0).unwrap_or_default(),
        user_id: row.get::<String>(1).ok(),
        table_id: row.get::<String>(2).ok(),
        session_id: row.get::<String>(3).ok(),
        round_number: row.get::<i64>(4).unwrap_or(1),
        status: row.get::<String>(5).unwrap_or_default(),
        total_usd: row.get::<i64>(6).unwrap_or(0),
        total_khr: row.get::<i64>(7).unwrap_or(0),
        tax_vat: row.get::<i64>(8).unwrap_or(0),
        tax_plt: row.get::<i64>(9).unwrap_or(0),
        bakong_bill_number: row.get::<String>(10).ok(),
        notes: row.get::<String>(11).ok(),
        customer_name: row.get::<String>(12).ok(),
        customer_phone: row.get::<String>(13).ok(),
        created_at: row.get::<String>(14).unwrap_or_default(),
        updated_at: row.get::<String>(15).ok(),
        completed_at: row.get::<String>(16).ok(),
    })
}

#[tauri::command]
pub async fn add_round(
    user_id: String,
    session_id: String,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<String, String> {
    let mut rows = pool.query(
        "SELECT table_id, COALESCE(MAX(round_number), 0) FROM orders WHERE session_id = ? AND restaurant_id = ? AND is_deleted = 0",
        params![session_id.clone(), restaurant_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let row = rows.next().await.map_err(|e| e.to_string())?.ok_or_else(|| "Failed to fetch round".to_string())?;
    let table_id = row.get::<String>(0).ok();
    let max_round = row.get::<i64>(1).unwrap_or(0);

    let id = uuid::Uuid::new_v4().to_string();
    pool.execute(
        "INSERT INTO orders (id, user_id, table_id, session_id, round_number, status, restaurant_id) VALUES (?, ?, ?, ?, ?, 'open', ?)",
        params![id.clone(), user_id, table_id.unwrap_or_default(), session_id, max_round + 1, restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    Ok(id)
}

#[tauri::command]
pub async fn checkout_session(
    session_id: String,
    payments: Vec<PaymentInput>,
    discount_cents: Option<i64>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    let mut tb_rows = pool.query("SELECT table_id FROM table_sessions WHERE id = ? AND restaurant_id = ?", params![session_id.clone(), restaurant_id.clone()])
        .await.map_err(|e| format!("Database error: {}", e))?;
    let table_id = if let Some(row) = tb_rows.next().await.map_err(|e| e.to_string())? {
        row.get::<String>(0).ok()
    } else { None };

    let mut session_orders = Vec::new(); // Vec<(id, user_id)>
    let mut so_rows = pool.query(
        "SELECT id, user_id FROM orders WHERE session_id = ? AND restaurant_id = ? AND status IN ('open', 'pending_payment') AND is_deleted = 0",
        params![session_id.clone(), restaurant_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;
    while let Some(row) = so_rows.next().await.map_err(|e| e.to_string())? {
        session_orders.push((row.get::<String>(0).unwrap_or_default(), row.get::<String>(1).ok()));
    }

    let mut sub_rows = pool.query(
        "SELECT COALESCE(SUM(oi.price_at_order * oi.quantity), 0)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.session_id = ? AND o.restaurant_id = ? AND oi.is_deleted = 0 AND o.is_deleted = 0 AND o.status IN ('open', 'pending_payment')",
         params![session_id.clone(), restaurant_id.clone()]
    ).await.map_err(|e| format!("Subtotal error: {}", e))?;
    
    let done_subtotal = if let Some(row) = sub_rows.next().await.map_err(|e| e.to_string())? {
        row.get::<i64>(0).unwrap_or(0)
    } else { 0 };

    let final_total = (done_subtotal - discount_cents.unwrap_or(0)).max(0);
    
    let mut rate_rows = pool.query("SELECT rate FROM exchange_rates WHERE restaurant_id = ? ORDER BY effective_from DESC LIMIT 1", params![restaurant_id.clone()])
        .await.map_err(|e| e.to_string())?;
    let exch_rate = if let Some(row) = rate_rows.next().await.map_err(|e| e.to_string())? {
        get_f64_safe(&row, 0)
    } else { 4100.0 };
    let _final_khr = round_khr(final_total, exch_rate);

    for (o_id, u_id) in &session_orders {
        recalculate_order_totals(o_id, &restaurant_id, &pool).await?;
        
        let _: u64 = pool.execute(
            "UPDATE orders SET status = 'completed', updated_at = datetime('now'), completed_at = datetime('now')
             WHERE id = ? AND restaurant_id = ?",
             params![o_id.clone(), restaurant_id.clone()]
        ).await.map_err(|e| format!("Database error: {}", e))?;

        let mut sold_items = Vec::new();
        let mut sim_rows = pool.query(
            "SELECT product_id, quantity FROM order_items 
             WHERE order_id = ? AND is_deleted = 0
               AND order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)",
            params![o_id.clone(), restaurant_id.clone()]
        ).await.map_err(|e| format!("Database error: {}", e))?;
        while let Some(row) = sim_rows.next().await.map_err(|e| e.to_string())? {
            sold_items.push((row.get::<String>(0).unwrap_or_default(), row.get::<i64>(1).unwrap_or(0)));
        }

        for (p_id, qty) in sold_items {
            deduct_inventory(&p_id, qty, &restaurant_id, u_id.as_deref(), &pool).await?;
        }
    }

    if let Some((first_order_id, _)) = session_orders.first() {
        if discount_cents.unwrap_or(0) > 0 {
            let d_cents = discount_cents.unwrap_or(0);
            let d_khr = round_khr(d_cents, exch_rate);
            let _: u64 = pool.execute(
                "UPDATE orders SET total_usd = MAX(0, total_usd - ?), total_khr = MAX(0, total_khr - ?)
                 WHERE id = ? AND restaurant_id = ?", 
                params![d_cents, d_khr, first_order_id.clone(), restaurant_id.clone()]
            )
                .await.map_err(|e| format!("DB error: {}", e))?;
        }

        for p in &payments {
            let pid = uuid::Uuid::new_v4().to_string();
            let _: u64 = pool.execute(
                "INSERT INTO payments (id, order_id, method, currency, amount, bakong_transaction_hash)
                 VALUES (?, ?, ?, ?, ?, ?)",
                 params![pid, first_order_id.clone(), p.method.clone(), p.currency.clone(), p.amount, p.bakong_transaction_hash.clone().unwrap_or_default()]
            ).await.map_err(|e| format!("Payment insert error: {}", e))?;
        }
    }

    pool.execute(
        "UPDATE table_sessions SET status = 'completed', completed_at = datetime('now') 
         WHERE id = ? AND restaurant_id = ?", 
        params![session_id, restaurant_id.clone()]
    )
        .await.map_err(|e| format!("Session close error: {}", e))?;

    if let Some(table_name) = table_id {
        release_table_if_no_open_orders(&table_name, &restaurant_id, &pool).await?;
    }

    Ok(())
}

#[tauri::command]
pub async fn hold_order(
    order_id: String,
    customer_name: Option<String>,
    customer_phone: Option<String>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    // 1. Fetch table info before changing status
    let mut tb_rows = pool.query(
        "SELECT table_id, session_id FROM orders WHERE id = ? AND restaurant_id = ?",
        params![order_id.clone(), restaurant_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let (table_id, session_id) = if let Some(row) = tb_rows.next().await.map_err(|e| e.to_string())? {
        (row.get::<String>(0).ok(), row.get::<String>(1).ok())
    } else {
        return Err("Order not found".to_string());
    };

    // 2. Mark order as 'hold' with customer contact info
    let c_name = customer_name.unwrap_or_default();
    let c_phone = customer_phone.unwrap_or_default();

    if let Some(sid) = session_id.as_deref().filter(|s| !s.is_empty()) {
        pool.execute(
            "UPDATE orders SET status = 'hold', customer_name = ?, customer_phone = ?,
                    completed_at = datetime('now'), updated_at = datetime('now')
             WHERE session_id = ? AND restaurant_id = ?",
            params![c_name, c_phone, sid, restaurant_id.clone()]
        ).await.map_err(|e| format!("Database error: {}", e))?;
    } else {
        pool.execute(
            "UPDATE orders SET status = 'hold', customer_name = ?, customer_phone = ?,
                    completed_at = datetime('now'), updated_at = datetime('now')
             WHERE id = ? AND restaurant_id = ?",
            params![c_name, c_phone, order_id, restaurant_id.clone()]
        ).await.map_err(|e| format!("Database error: {}", e))?;
    }

    // 3. Close the table session so the table is released
    if let Some(sid) = session_id.as_deref().filter(|s| !s.is_empty()) {
        let _ = pool.execute(
            "UPDATE table_sessions SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now')
             WHERE id = ? AND restaurant_id = ?",
            params![sid, restaurant_id.clone()]
        ).await;
    }

    // 4. Free the table (set back to 'free') so the next customer can sit down
    if let Some(table_name) = table_id.as_deref().filter(|t| !t.is_empty()) {
        let _ = set_table_status(table_name, "free", &restaurant_id, &pool).await;
    }

    Ok(())
}

#[tauri::command]
pub async fn void_order(order_id: String, restaurant_id: String, pool: State<'_, Arc<Connection>>) -> Result<(), String> {
    let mut tb_rows = pool.query("SELECT table_id FROM orders WHERE id = ? AND restaurant_id = ?", params![order_id.clone(), restaurant_id.clone()])
        .await.map_err(|e| format!("Database error: {}", e))?;
    let table_id = if let Some(row) = tb_rows.next().await.map_err(|e| e.to_string())? {
        row.get::<String>(0).ok()
    } else { None };

    pool.execute("UPDATE orders SET status='void', updated_at=datetime('now') WHERE id=? AND restaurant_id = ?", params![order_id, restaurant_id.clone()])
        .await.map_err(|e| format!("Database error: {}", e))?;

    if let Some(table_name) = table_id {
        release_table_if_no_open_orders(&table_name, &restaurant_id, &pool).await?;
    }

    Ok(())
}

async fn set_table_status(table_name: &str, status: &str, restaurant_id: &str, pool: &Arc<Connection>) -> Result<(), String> {
    pool.execute(
        "UPDATE floor_tables SET status = ?, updated_at = datetime('now') 
         WHERE name = ? AND restaurant_id = ?", 
        params![status.to_string(), table_name.to_string(), restaurant_id.to_string()]
    )
        .await.map_err(|e| format!("Table status error: {}", e))?;

    Ok(())
}

async fn release_table_if_no_open_orders(table_name: &str, restaurant_id: &str, pool: &Arc<Connection>) -> Result<(), String> {
    let mut rows = pool.query(
        "SELECT COUNT(*) FROM orders WHERE table_id = ? AND restaurant_id = ? AND status = 'open' AND is_deleted = 0",
        params![table_name.to_string(), restaurant_id.to_string()]
    ).await.map_err(|e| format!("Table release error: {}", e))?;

    let open_count = if let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        row.get::<i64>(0).unwrap_or(0)
    } else { 0 };

    if open_count == 0 {
        set_table_status(table_name, "free", restaurant_id, pool).await?;
    }

    Ok(())
}

async fn deduct_inventory(product_id: &str, qty: i64, restaurant_id: &str, user_id: Option<&str>, pool: &Arc<Connection>) -> Result<(), String> {
    let mut ing_rows = pool.query(
        "SELECT inventory_item_id, usage_quantity FROM product_ingredients WHERE product_id=? AND restaurant_id=?",
        params![product_id.to_string(), restaurant_id.to_string()]
    ).await.map_err(|e| format!("Ingredients fetch error: {}", e))?;

    while let Some(ing_row) = ing_rows.next().await.map_err(|e| e.to_string())? {
        let inv_id: String = ing_row.get(0).unwrap_or_default();
        let usage_amount = get_f64_safe(&ing_row, 1);
        let total_usage = qty as f64 * usage_amount;

        let mut inv_rows = pool.query(
            "SELECT stock_qty, min_stock_qty FROM inventory_items WHERE id = ? AND restaurant_id = ?",
            params![inv_id.clone(), restaurant_id.to_string()]
        ).await.map_err(|e| format!("Inv fetch error: {}", e))?;

        if let Some(inv_row) = inv_rows.next().await.map_err(|e| e.to_string())? {
            let current_qty = get_f64_safe(&inv_row, 0);
            let min_qty = get_f64_safe(&inv_row, 1);
            
            let new_qty = current_qty - total_usage;
            let new_pct = if min_qty > 0.0 { (new_qty / (min_qty * 2.0)) * 100.0 } else { 100.0 };
            
            let _: u64 = pool.execute(
                "UPDATE inventory_items SET stock_qty = ?, stock_pct = ?, updated_at = datetime('now') 
                 WHERE id = ? AND restaurant_id = ?", 
                params![new_qty, new_pct, inv_id.clone(), restaurant_id.to_string()]
            )
            .await.map_err(|e| format!("Inv update error: {}", e))?;

            // Log the deduction
            let log_id = uuid::Uuid::new_v4().to_string();
            let _: u64 = pool.execute(
                "INSERT INTO inventory_logs (id, inventory_item_id, product_id, user_id, quantity_change, change_amount, quantity, change_type, restaurant_id) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'sale', ?)",
                params![log_id, inv_id, product_id.to_string(), user_id.unwrap_or_default().to_string(), -total_usage, -total_usage, -total_usage, restaurant_id.to_string()]
            ).await.map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

async fn recalculate_order_totals(order_id: &str, restaurant_id: &str, pool: &Arc<Connection>) -> Result<(), String> {
    let mut sub_rows = pool.query(
        "SELECT COALESCE(SUM(price_at_order * quantity), 0) FROM order_items 
         WHERE order_id=? AND is_deleted=0 AND order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)",
        params![order_id.to_string(), restaurant_id.to_string()]
    ).await.map_err(|e| format!("Subtotal error: {}", e))?;
    
    let subtotal = if let Some(row) = sub_rows.next().await.map_err(|e| e.to_string())? {
        row.get::<i64>(0).unwrap_or(0)
    } else { 0 };

    let vat = 0;
    let plt = 0;
    let total_usd = subtotal;

    let mut rate_rows = pool.query("SELECT rate FROM exchange_rates WHERE restaurant_id = ? ORDER BY effective_from DESC LIMIT 1", params![restaurant_id.to_string()])
        .await.map_err(|e| format!("Exchange rate error: {}", e))?;
    
    let rate = if let Some(row) = rate_rows.next().await.map_err(|e| e.to_string())? {
        get_f64_safe(&row, 0)
    } else { 4100.0 };

    let total_khr = round_khr(total_usd, rate);

    pool.execute(
        "UPDATE orders SET total_usd=?, total_khr=?, tax_vat=?, tax_plt=?, updated_at=datetime('now') WHERE id=? AND restaurant_id = ?",
        params![total_usd, total_khr, vat, plt, order_id.to_string(), restaurant_id.to_string()]
    ).await.map_err(|e| format!("Update totals error: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_revenue_summary(
    pool: State<'_, Arc<Connection>>,
    restaurant_id: String,
) -> Result<RevenueSummary, String> {
    let mut today_rows = pool.query(
        "SELECT COALESCE(SUM(total_usd),0), COUNT(*) FROM orders WHERE status='completed' AND is_deleted=0 AND restaurant_id = ? AND date(created_at)=date('now')", 
        params![restaurant_id.clone()]
    ).await.map_err(|e| format!("DB error: {}", e))?;
    let (today_usd, today_orders) = if let Some(r) = today_rows.next().await.unwrap_or(None) {
        (r.get::<i64>(0).unwrap_or(0), r.get::<i64>(1).unwrap_or(0))
    } else { (0, 0) };

    let mut month_rows = pool.query(
        "SELECT COALESCE(SUM(total_usd),0), COUNT(*) FROM orders WHERE status='completed' AND is_deleted=0 AND restaurant_id = ? AND strftime('%Y-%m',created_at)=strftime('%Y-%m','now')", 
        params![restaurant_id.clone()]
    ).await.map_err(|e| format!("DB error: {}", e))?;
    let (month_usd, month_orders) = if let Some(r) = month_rows.next().await.unwrap_or(None) {
        (r.get::<i64>(0).unwrap_or(0), r.get::<i64>(1).unwrap_or(0))
    } else { (0, 0) };

    let mut year_rows = pool.query(
        "SELECT COALESCE(SUM(total_usd),0), COUNT(*) FROM orders WHERE status='completed' AND is_deleted=0 AND restaurant_id = ? AND strftime('%Y',created_at)=strftime('%Y','now')", 
        params![restaurant_id.clone()]
    ).await.map_err(|e| format!("DB error: {}", e))?;
    let (year_usd, year_orders) = if let Some(r) = year_rows.next().await.unwrap_or(None) {
        (r.get::<i64>(0).unwrap_or(0), r.get::<i64>(1).unwrap_or(0))
    } else { (0, 0) };

    let mut open_rows = pool.query(
        "SELECT COUNT(*) FROM orders WHERE status IN ('open', 'pending_payment') AND is_deleted = 0 AND restaurant_id = ? AND date(created_at) = date('now')", 
        params![restaurant_id]
    ).await.map_err(|e| format!("DB error: {}", e))?;
    let open_orders = if let Some(r) = open_rows.next().await.unwrap_or(None) {
        r.get::<i64>(0).unwrap_or(0)
    } else { 0 };

    Ok(RevenueSummary { today_usd, today_orders, month_usd, month_orders, year_usd, year_orders, open_orders })
}

#[tauri::command]
pub async fn get_revenue_by_period(
    period: String, 
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>
) -> Result<Vec<RevenueByDay>, String> {
    let date_filter = match period.as_str() {
        "week"    => "created_at >= datetime('now','-7 days')",
        "3months" => "created_at >= datetime('now','-3 months')",
        "year"    => "strftime('%Y',created_at)=strftime('%Y','now')",
        _         => "strftime('%Y-%m',created_at)=strftime('%Y-%m','now')",
    };

    let query = format!(
        "SELECT date(created_at) as date, COALESCE(SUM(total_usd),0) as total_usd, COUNT(*) as order_count \
         FROM orders WHERE status='completed' AND is_deleted=0 AND restaurant_id = ? AND {} \
         GROUP BY date(created_at) ORDER BY date ASC",
        date_filter
    );

    let mut rows = pool.query(query.as_str(), params![restaurant_id])
        .await.map_err(|e| format!("Database error: {}", e))?;

    let mut results = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        results.push(RevenueByDay {
            date: row.get::<String>(0).unwrap_or_default(),
            total_usd: row.get::<i64>(1).unwrap_or(0),
            order_count: row.get::<i64>(2).unwrap_or(0),
        });
    }

    Ok(results)
}

#[tauri::command]
pub async fn save_excel_file(
    content: Vec<u8>,
    filename: String,
) -> Result<String, String> {
    let file_path = rfd::FileDialog::new()
        .set_title("Save Order History Report")
        .set_file_name(&filename)
        .add_filter("Excel Spreadsheet", &["xlsx"])
        .save_file();
    
    if let Some(path) = file_path {
        std::fs::write(&path, content)
            .map_err(|e| format!("Failed to write file: {}", e))?;
        Ok(path.to_string_lossy().to_string())
    } else {
        Err("CANCELLED".to_string())
    }
}

#[tauri::command]
pub async fn delete_order_history(
    session_id: Option<String>,
    order_id: Option<String>,
    restaurant_id: String,
    actor_user_id: String,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, crate::db::RemoteDb>,
) -> Result<(), String> {
    let actor_role = rbac::require_delete_permission(&pool, &actor_user_id, &restaurant_id).await?;

    // 2. Identify target order IDs to soft-delete
    let mut order_ids: Vec<String> = Vec::new();

    if let Some(ref sid) = session_id {
        if !sid.trim().is_empty() {
            let mut rows = pool.query(
                "SELECT id FROM orders WHERE session_id = ? AND restaurant_id = ?",
                params![sid.clone(), restaurant_id.clone()],
            ).await.map_err(|e| format!("Database error fetching session orders: {}", e))?;
            while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
                if let Ok(id) = row.get::<String>(0) {
                    order_ids.push(id);
                }
            }
        }
    }

    if order_ids.is_empty() {
        if let Some(ref oid) = order_id {
            if !oid.trim().is_empty() {
                order_ids.push(oid.clone());
            }
        }
    }

    if order_ids.is_empty() {
        return Err("No valid order_id or session_id provided for deletion.".to_string());
    }

    // 3. Gather table IDs and session IDs before deleting so we can clean up their statuses
    let mut table_names = Vec::new();
    let mut session_ids = Vec::new();

    let order_placeholders = order_ids.iter().map(|_| "?").collect::<Vec<_>>().join(", ");

    // Find associated tables
    {
        let query_tables_sql = format!(
            "SELECT DISTINCT table_id FROM orders WHERE id IN ({}) AND table_id IS NOT NULL",
            order_placeholders
        );
        let mut table_rows = pool.query(&query_tables_sql, order_ids.iter().map(|id| libsql::Value::Text(id.clone())).collect::<Vec<_>>()).await.map_err(|e| e.to_string())?;
        while let Some(row) = table_rows.next().await.map_err(|e| e.to_string())? {
            if let Ok(table_name) = row.get::<String>(0) {
                table_names.push(table_name);
            }
        }
    }

    // Find associated sessions
    {
        let query_sessions_sql = format!(
            "SELECT DISTINCT session_id FROM orders WHERE id IN ({}) AND session_id IS NOT NULL",
            order_placeholders
        );
        let mut session_rows = pool.query(&query_sessions_sql, order_ids.iter().map(|id| libsql::Value::Text(id.clone())).collect::<Vec<_>>()).await.map_err(|e| e.to_string())?;
        while let Some(row) = session_rows.next().await.map_err(|e| e.to_string())? {
            if let Ok(sid) = row.get::<String>(0) {
                session_ids.push(sid);
            }
        }
    }

    // 4. Define delete and update statements
    let update_orders_sql = format!(
        "UPDATE orders SET is_deleted = 1, updated_at = datetime('now') WHERE id IN ({}) AND restaurant_id = ?",
        order_placeholders
    );
    let update_items_sql = format!(
        "UPDATE order_items SET is_deleted = 1, updated_at = datetime('now') WHERE order_id IN ({})",
        order_placeholders
    );
    let delete_payments_sql = format!(
        "UPDATE payments SET is_deleted = 1, updated_at = datetime('now') WHERE order_id IN ({})",
        order_placeholders
    );

    let mut orders_params: Vec<libsql::Value> = order_ids.iter().map(|id| libsql::Value::Text(id.clone())).collect();
    let items_params = orders_params.clone();
    let payments_params = orders_params.clone();
    orders_params.push(libsql::Value::Text(restaurant_id.clone()));

    // 5. Remote write first (Authoritative/Real-time propagation to cloud)
    if let Some(remote_conn) = remote.0.as_ref() {
        let _ = remote_conn.execute(&update_orders_sql, orders_params.clone()).await;
        let _ = remote_conn.execute(&update_items_sql, items_params.clone()).await;
        let _ = remote_conn.execute(&delete_payments_sql, payments_params.clone()).await;
    }

    // 6. Local write (Offline-first/Best-effort local database update)
    pool.execute(&update_orders_sql, orders_params)
        .await
        .map_err(|e| format!("Failed to delete orders locally: {}", e))?;

    pool.execute(&update_items_sql, items_params)
        .await
        .map_err(|e| format!("Failed to delete order items locally: {}", e))?;

    let _ = pool.execute(&delete_payments_sql, payments_params).await;

    // 7. Post-delete floor table state cleanup
    for table_name in table_names {
        let _ = release_table_if_no_open_orders(&table_name, &restaurant_id, &pool).await;
    }

    // 8. Post-delete session status cleanup
    for sid in session_ids {
        let mut count_rows = pool.query(
            "SELECT COUNT(*) FROM orders WHERE session_id = ? AND is_deleted = 0",
            params![sid.clone()]
        ).await.map_err(|e| e.to_string())?;

        let count = if let Some(row) = count_rows.next().await.map_err(|e| e.to_string())? {
            row.get::<i64>(0).unwrap_or(0)
        } else { 0 };

        if count == 0 {
            const UPDATE_SESSION_SQL: &str = "UPDATE table_sessions SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?";
            if let Some(remote_conn) = remote.0.as_ref() {
                let _ = remote_conn.execute(UPDATE_SESSION_SQL, params![sid.clone()]).await;
            }
            let _ = pool.execute(UPDATE_SESSION_SQL, params![sid]).await;
        }
    }

    for oid in order_ids {
        rbac::write_audit_log(
            &pool,
            &restaurant_id,
            &actor_user_id,
            &actor_role,
            "delete",
            "order",
            &oid,
            None,
        ).await;
    }

    Ok(())
}

