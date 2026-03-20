use tauri::State;
use sqlx::SqlitePool;
use crate::models::{Order, OrderItem, PaymentInput};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RevenueSummary {
    pub today_usd: i64,
    pub today_orders: i64,
    pub month_usd: i64,
    pub month_orders: i64,
    pub year_usd: i64,
    pub year_orders: i64,
    pub open_orders: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RevenueByDay {
    pub date: String,
    pub total_usd: i64,
    pub order_count: i64,
}

/// GDT/NBC KHR rounding: if decimal part > 0.5, round up; otherwise round down (truncate)
fn round_khr(usd_cents: i64, rate: f64) -> i64 {
    let total_khr_float = (usd_cents as f64 / 100.0) * rate;
    let int_part = total_khr_float.floor() as i64;
    let frac = total_khr_float - total_khr_float.floor();
    if frac > 0.5 { int_part + 1 } else { int_part }
}

#[tauri::command]
pub async fn create_order(
    user_id: String,
    table_id: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<String, String> {
    let mut session_id = None;
    let mut round_number = 1;

    if let Some(table_name) = &table_id {
        // First check if there is an open order for this table
        let existing: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM orders WHERE table_id = ? AND status = 'open' AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1"
        )
        .bind(table_name)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        if let Some((existing_id,)) = existing {
            return Ok(existing_id);
        }

        // Check if there is an active session for this table
        let session_opt: Option<(String,)> = sqlx::query_as(
            "SELECT id FROM table_sessions WHERE table_id = ? AND status = 'active'"
        )
        .bind(table_name)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        if let Some((sid,)) = session_opt {
            session_id = Some(sid.clone());
            // Get the highest round number
            let max_round: Option<(i64,)> = sqlx::query_as(
                "SELECT MAX(round_number) FROM orders WHERE session_id = ? AND is_deleted = 0"
            )
            .bind(&sid)
            .fetch_optional(pool.inner())
            .await
            .map_err(|e| format!("Database error: {}", e))?;
            
            if let Some((val,)) = max_round {
                round_number = val + 1;
            }
        } else {
            // Create a new session
            let sid = uuid::Uuid::new_v4().to_string();
            sqlx::query("INSERT INTO table_sessions (id, table_id, status) VALUES (?, ?, 'active')")
                .bind(&sid)
                .bind(table_name)
                .execute(pool.inner())
                .await
                .map_err(|e| format!("Database error: {}", e))?;
            session_id = Some(sid);
        }
    }

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO orders (id, user_id, table_id, session_id, round_number, status) VALUES (?, ?, ?, ?, ?, 'open')"
    )
    .bind(&id)
    .bind(&user_id)
    .bind(&table_id)
    .bind(&session_id)
    .bind(round_number)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if let Some(table_name) = &table_id {
        set_table_status(table_name, "busy", pool.inner()).await?;
    }

    Ok(id)
}

#[tauri::command]
pub async fn add_order_item(
    order_id: String,
    product_id: String,
    quantity: i64,
    note: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<OrderItem, String> {
    // Fetch product data first
    let (price_cents, p_name, p_khmer): (i64, String, Option<String>) = sqlx::query_as(
        "SELECT price_cents, name, khmer_name FROM products WHERE id = ? AND is_deleted = 0"
    )
    .bind(&product_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Product not found: {}", e))?;

    // Check if same product already exists in this order with 'pending' status
    // (items already in the kitchen—cooking or done—get a new row instead of merging)
    let existing: Option<(String, i64)> = sqlx::query_as(
        "SELECT id, quantity FROM order_items WHERE order_id = ? AND product_id = ? AND is_deleted = 0 AND kitchen_status = 'pending'"
    )
    .bind(&order_id)
    .bind(&product_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    if let Some((existing_id, current_qty)) = existing {
        let new_qty = current_qty + quantity;
        sqlx::query("UPDATE order_items SET quantity = ? WHERE id = ?")
            .bind(new_qty)
            .bind(&existing_id)
            .execute(pool.inner())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        recalculate_order_totals(&order_id, pool.inner()).await?;

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
        });
    }

    // Create new order item (starts as 'pending' — kitchen will see it)
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO order_items (id, order_id, product_id, quantity, price_at_order, note, kitchen_status) VALUES (?, ?, ?, ?, ?, ?, 'pending')"
    )
    .bind(&id)
    .bind(&order_id)
    .bind(&product_id)
    .bind(quantity)
    .bind(price_cents)
    .bind(&note)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    recalculate_order_totals(&order_id, pool.inner()).await?;

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
    })
}

#[tauri::command]
pub async fn update_order_item_quantity(
    item_id: String,
    quantity: i64,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    if quantity <= 0 {
        // Remove the item
        let (order_id,): (String,) = sqlx::query_as("SELECT order_id FROM order_items WHERE id = ?")
            .bind(&item_id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| format!("Item not found: {}", e))?;

        sqlx::query("UPDATE order_items SET is_deleted=1 WHERE id=?")
            .bind(&item_id)
            .execute(pool.inner())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        recalculate_order_totals(&order_id, pool.inner()).await?;
    } else {
        let (order_id,): (String,) = sqlx::query_as("SELECT order_id FROM order_items WHERE id = ?")
            .bind(&item_id)
            .fetch_one(pool.inner())
            .await
            .map_err(|e| format!("Item not found: {}", e))?;

        sqlx::query("UPDATE order_items SET quantity=? WHERE id=?")
            .bind(quantity)
            .bind(&item_id)
            .execute(pool.inner())
            .await
            .map_err(|e| format!("Database error: {}", e))?;

        recalculate_order_totals(&order_id, pool.inner()).await?;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_order_items(
    order_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<OrderItem>, String> {
    let items: Vec<OrderItem> = sqlx::query_as(
        "SELECT oi.id, oi.order_id, oi.product_id, oi.quantity, oi.price_at_order, oi.note,
                oi.kitchen_status,
                p.name AS product_name, p.khmer_name AS product_khmer
         FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ? AND oi.is_deleted = 0
         ORDER BY oi.created_at"
    )
    .bind(&order_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(items)
}

#[tauri::command]
pub async fn update_order_item_note(
    item_id: String,
    note: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("UPDATE order_items SET note = ? WHERE id = ? AND is_deleted = 0")
        .bind(&note)
        .bind(&item_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_orders(
    status: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Order>, String> {
    let mut query = String::from(
        "SELECT id, user_id, table_id, session_id, round_number, status, total_usd, total_khr, tax_vat, tax_plt,
                bakong_bill_number, notes, customer_name, customer_phone, created_at, updated_at, completed_at
         FROM orders WHERE is_deleted = 0"
    );

    if status.is_some() {
        query.push_str(" AND status = ?");
    }
    if start_date.is_some() {
        query.push_str(" AND created_at >= ?");
    }
    if end_date.is_some() {
        query.push_str(" AND created_at <= ?");
    }

    query.push_str(" ORDER BY created_at DESC LIMIT 500");

    let mut sql_query = sqlx::query_as::<_, Order>(&query);

    if let Some(s) = status {
        sql_query = sql_query.bind(s);
    }
    if let Some(sd) = start_date {
        sql_query = sql_query.bind(format!("{} 00:00:00", sd));
    }
    if let Some(ed) = end_date {
        sql_query = sql_query.bind(format!("{} 23:59:59", ed));
    }

    let orders = sql_query.fetch_all(pool.inner()).await;
    orders.map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn get_session_rounds(
    session_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Order>, String> {
    let orders = sqlx::query_as::<_, Order>(
        "SELECT id, user_id, table_id, session_id, round_number, status, total_usd, total_khr, tax_vat, tax_plt,
                bakong_bill_number, notes, customer_name, customer_phone, created_at, updated_at, completed_at
         FROM orders
         WHERE session_id = ? AND is_deleted = 0
         ORDER BY round_number ASC"
    )
    .bind(&session_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(orders)
}

#[tauri::command]
pub async fn get_active_order_for_table(
    table_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<Option<Order>, String> {
    let order = sqlx::query_as::<_, Order>(
        "SELECT id, user_id, table_id, session_id, round_number, status, total_usd, total_khr, tax_vat, tax_plt,
                bakong_bill_number, notes, customer_name, customer_phone, created_at, updated_at, completed_at
         FROM orders
         WHERE table_id = ? AND status IN ('open', 'pending_payment') AND is_deleted = 0
         ORDER BY created_at DESC
         LIMIT 1"
    )
    .bind(&table_id)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(order)
}

#[tauri::command]
pub async fn get_orders_for_table(
    table_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Order>, String> {
    let orders = sqlx::query_as::<_, Order>(
        "SELECT id, user_id, table_id, session_id, round_number, status, total_usd, total_khr, tax_vat, tax_plt,
                bakong_bill_number, notes, customer_name, customer_phone, created_at, updated_at, completed_at
         FROM orders
         WHERE table_id = ? AND is_deleted = 0
         ORDER BY created_at DESC"
    )
    .bind(&table_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(orders)
}

#[tauri::command]
pub async fn checkout_order(
    order_id: String,
    payments: Vec<PaymentInput>,
    discount_cents: Option<i64>,
    pool: State<'_, SqlitePool>,
) -> Result<Order, String> {
    let table_id: Option<(Option<String>,)> = sqlx::query_as("SELECT table_id FROM orders WHERE id = ?")
        .bind(&order_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    // Recalculate total using all non-deleted items (kitchen-accept workflow is currently disabled)
    let (done_subtotal,): (i64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(price_at_order * quantity), 0)
         FROM order_items
         WHERE order_id = ? AND is_deleted = 0"
    )
    .bind(&order_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Subtotal error: {}", e))?;

    // Apply discount then mark completed
    let final_total = (done_subtotal - discount_cents.unwrap_or(0)).max(0);
    let exch_rate: f64 = sqlx::query_scalar(
        "SELECT rate FROM exchange_rates ORDER BY effective_from DESC LIMIT 1"
    )
    .fetch_optional(pool.inner())
    .await
    .unwrap_or(None)
    .unwrap_or(4100.0);
    let final_khr = round_khr(final_total, exch_rate);

    // Update order total to reflect only done items, then mark completed
    sqlx::query(
        "UPDATE orders SET total_usd = ?, total_khr = ?, tax_vat = 0, tax_plt = 0,
                status = 'completed', updated_at = datetime('now'), completed_at = datetime('now')
         WHERE id = ?"
    )
    .bind(final_total)
    .bind(final_khr)
    .bind(&order_id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Deduct stock for all ordered items
    let sold_items: Vec<(String, i64)> = sqlx::query_as(
        "SELECT product_id, quantity FROM order_items WHERE order_id = ? AND is_deleted = 0"
    )
    .bind(&order_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    for (p_id, qty) in sold_items {
        deduct_inventory(&p_id, qty, pool.inner()).await?;
    }

    // Record payments
    for p in &payments {
        let pid = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO payments (id, order_id, method, currency, amount, bakong_transaction_hash)
             VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(&pid)
        .bind(&order_id)
        .bind(&p.method)
        .bind(&p.currency)
        .bind(p.amount)
        .bind(&p.bakong_transaction_hash)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Payment insert error: {}", e))?;
    }

    if let Some((Some(table_name),)) = table_id {
        release_table_if_no_open_orders(&table_name, pool.inner()).await?;
    }

    // Return the completed order
    let order: Order = sqlx::query_as(
        "SELECT id, user_id, table_id, session_id, round_number, status, total_usd, total_khr, tax_vat, tax_plt,
                bakong_bill_number, notes, customer_name, customer_phone, created_at, updated_at, completed_at
         FROM orders WHERE id=?"
    )
    .bind(&order_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(order)
}

#[tauri::command]
pub async fn add_round(
    user_id: String,
    session_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<String, String> {
    let (table_id, max_round): (Option<String>, i64) = sqlx::query_as(
        "SELECT table_id, COALESCE(MAX(round_number), 0) FROM orders WHERE session_id = ? AND is_deleted = 0"
    )
    .bind(&session_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO orders (id, user_id, table_id, session_id, round_number, status) VALUES (?, ?, ?, ?, ?, 'open')"
    )
    .bind(&id)
    .bind(&user_id)
    .bind(&table_id)
    .bind(&session_id)
    .bind(max_round + 1)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(id)
}

#[tauri::command]
pub async fn checkout_session(
    session_id: String,
    payments: Vec<PaymentInput>,
    discount_cents: Option<i64>,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    let (table_id,): (Option<String>,) = sqlx::query_as("SELECT table_id FROM table_sessions WHERE id = ?")
        .bind(&session_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?
        .unwrap_or((None,));

    // Get all orders for this session
    let session_orders: Vec<(String,)> = sqlx::query_as(
        "SELECT id FROM orders WHERE session_id = ? AND status IN ('open', 'pending_payment') AND is_deleted = 0"
    )
    .bind(&session_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    // Sum subtotal across all orders in session
    let (done_subtotal,): (i64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(price_at_order * quantity), 0)
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.session_id = ? AND oi.is_deleted = 0 AND o.is_deleted = 0 AND o.status IN ('open', 'pending_payment')"
    )
    .bind(&session_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Subtotal error: {}", e))?;

    let final_total = (done_subtotal - discount_cents.unwrap_or(0)).max(0);
    let exch_rate: f64 = sqlx::query_scalar(
        "SELECT rate FROM exchange_rates ORDER BY effective_from DESC LIMIT 1"
    )
    .fetch_optional(pool.inner())
    .await
    .unwrap_or(None)
    .unwrap_or(4100.0);
    let _final_khr = round_khr(final_total, exch_rate);

    // Instead of attributing the total to all orders, attribute to the first one, zero others
    // Or just update them all status = 'completed' and let the total be their individual totals
    // Wait, the POS expects individual orders to have their own totals. Let's recalculate each order separately and apply discount to text total via first order?
    // Actually, simplest is just to mark all orders in the session 'completed' 
    for (o_id,) in &session_orders {
        // Recalculate just in case
        recalculate_order_totals(o_id, pool.inner()).await?;
        
        sqlx::query(
            "UPDATE orders SET status = 'completed', updated_at = datetime('now'), completed_at = datetime('now')
             WHERE id = ?"
        )
        .bind(o_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        // Deduct stock for all ordered items in this order
        let sold_items: Vec<(String, i64)> = sqlx::query_as(
            "SELECT product_id, quantity FROM order_items WHERE order_id = ? AND is_deleted = 0"
        )
        .bind(o_id)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        for (p_id, qty) in sold_items {
            deduct_inventory(&p_id, qty, pool.inner()).await?;
        }
    }

    // Record payments on the first order of the session
    if let Some((first_order_id,)) = session_orders.first() {
        if discount_cents.unwrap_or(0) > 0 {
            // Apply discount to first order's total_usd since it's the anchor
            sqlx::query("UPDATE orders SET total_usd = MAX(0, total_usd - ?) WHERE id = ?")
                .bind(discount_cents.unwrap_or(0))
                .bind(first_order_id)
                .execute(pool.inner())
                .await
                .map_err(|e| format!("DB error: {}", e))?;
        }

        for p in &payments {
            let pid = uuid::Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO payments (id, order_id, method, currency, amount, bakong_transaction_hash)
                 VALUES (?, ?, ?, ?, ?, ?)"
            )
            .bind(&pid)
            .bind(first_order_id)
            .bind(&p.method)
            .bind(&p.currency)
            .bind(p.amount)
            .bind(&p.bakong_transaction_hash)
            .execute(pool.inner())
            .await
            .map_err(|e| format!("Payment insert error: {}", e))?;
        }
    }

    // Close session
    sqlx::query("UPDATE table_sessions SET status = 'completed', completed_at = datetime('now') WHERE id = ?")
        .bind(&session_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Session close error: {}", e))?;

    if let Some(table_name) = table_id {
        release_table_if_no_open_orders(&table_name, pool.inner()).await?;
    }

    Ok(())
}

#[tauri::command]
pub async fn hold_order(
    order_id: String,
    customer_name: Option<String>,
    customer_phone: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE orders SET status = 'pending_payment', customer_name = ?, customer_phone = ?,
                updated_at = datetime('now') WHERE id = ?"
    )
    .bind(&customer_name)
    .bind(&customer_phone)
    .bind(&order_id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn void_order(order_id: String, pool: State<'_, SqlitePool>) -> Result<(), String> {
    let table_id: Option<(Option<String>,)> = sqlx::query_as("SELECT table_id FROM orders WHERE id = ?")
        .bind(&order_id)
        .fetch_optional(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    sqlx::query("UPDATE orders SET status='void', updated_at=datetime('now') WHERE id=?")
        .bind(&order_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if let Some((Some(table_name),)) = table_id {
        release_table_if_no_open_orders(&table_name, pool.inner()).await?;
    }

    Ok(())
}

async fn set_table_status(table_name: &str, status: &str, pool: &SqlitePool) -> Result<(), String> {
    sqlx::query("UPDATE floor_tables SET status = ?, updated_at = datetime('now') WHERE name = ?")
        .bind(status)
        .bind(table_name)
        .execute(pool)
        .await
        .map_err(|e| format!("Table status error: {}", e))?;

    Ok(())
}

async fn release_table_if_no_open_orders(table_name: &str, pool: &SqlitePool) -> Result<(), String> {
    let (open_count,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM orders WHERE table_id = ? AND status = 'open' AND is_deleted = 0"
    )
    .bind(table_name)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Table release error: {}", e))?;

    if open_count == 0 {
        set_table_status(table_name, "free", pool).await?;
    }

    Ok(())
}

async fn deduct_inventory(product_id: &str, qty: i64, pool: &SqlitePool) -> Result<(), String> {
    // 1. Deduct from main product stock_quantity
    sqlx::query("UPDATE products SET stock_quantity = stock_quantity - ?, updated_at=datetime('now') WHERE id = ?")
        .bind(qty)
        .bind(product_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Stock deduction error: {}", e))?;

    // 2. Deduct ingredient inventory
    let ingredients: Vec<(String, f64)> = sqlx::query_as(
        "SELECT inventory_item_id, usage_percentage FROM product_ingredients WHERE product_id = ?"
    )
    .bind(product_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Recipe fetch error: {}", e))?;

    for (inv_id, usage_pct) in ingredients {
        let total_usage = qty as f64 * usage_pct;
        
        let inv_record: Option<(i64, f64)> = sqlx::query_as(
            "SELECT stock_qty, stock_pct FROM inventory_items WHERE id = ?"
        )
        .bind(&inv_id)
        .fetch_optional(pool)
        .await
        .map_err(|e| format!("Inv fetch error: {}", e))?;

        if let Some((mut sqty, mut spct)) = inv_record {
            spct -= total_usage;
            while spct < 0.0 {
                sqty -= 1;
                spct += 100.0;
            }
            sqlx::query("UPDATE inventory_items SET stock_qty = ?, stock_pct = ? WHERE id = ?")
                .bind(sqty)
                .bind(spct)
                .bind(&inv_id)
                .execute(pool)
                .await
                .map_err(|e| format!("Inv update error: {}", e))?;
        }
    }

    Ok(())
}

async fn recalculate_order_totals(order_id: &str, pool: &SqlitePool) -> Result<(), String> {
    // Sum subtotal (price_at_order * quantity) in cents
    let (subtotal,): (i64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(price_at_order * quantity), 0) FROM order_items WHERE order_id=? AND is_deleted=0"
    )
    .bind(order_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Subtotal error: {}", e))?;

    // VAT: 0% (Removed per user request)
    let vat = 0;
    // PLT: 0% (Removed per user request)
    let plt = 0;
    // Total USD in cents
    let total_usd = subtotal;

    // Get latest exchange rate
    let (rate,): (f64,) = sqlx::query_as(
        "SELECT rate FROM exchange_rates ORDER BY effective_from DESC LIMIT 1"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Exchange rate error: {}", e))?;

    // GDT/NBC KHR rounding
    let total_khr = round_khr(total_usd, rate);

    sqlx::query(
        "UPDATE orders SET total_usd=?, total_khr=?, tax_vat=?, tax_plt=?, updated_at=datetime('now') WHERE id=?"
    )
    .bind(total_usd)
    .bind(total_khr)
    .bind(vat)
    .bind(plt)
    .bind(order_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Update totals error: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_revenue_summary(pool: State<'_, SqlitePool>) -> Result<RevenueSummary, String> {
    let (today_usd, today_orders): (i64, i64) = sqlx::query_as(
        "SELECT COALESCE(SUM(total_usd),0), COUNT(*) FROM orders WHERE status='completed' AND is_deleted=0 AND date(created_at)=date('now')"
    ).fetch_one(pool.inner()).await.map_err(|e| format!("DB error: {}", e))?;

    let (month_usd, month_orders): (i64, i64) = sqlx::query_as(
        "SELECT COALESCE(SUM(total_usd),0), COUNT(*) FROM orders WHERE status='completed' AND is_deleted=0 AND strftime('%Y-%m',created_at)=strftime('%Y-%m','now')"
    ).fetch_one(pool.inner()).await.map_err(|e| format!("DB error: {}", e))?;

    let (year_usd, year_orders): (i64, i64) = sqlx::query_as(
        "SELECT COALESCE(SUM(total_usd),0), COUNT(*) FROM orders WHERE status='completed' AND is_deleted=0 AND strftime('%Y',created_at)=strftime('%Y','now')"
    ).fetch_one(pool.inner()).await.map_err(|e| format!("DB error: {}", e))?;

    let (open_orders,): (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM orders WHERE status='open' AND is_deleted=0"
    ).fetch_one(pool.inner()).await.map_err(|e| format!("DB error: {}", e))?;

    Ok(RevenueSummary { today_usd, today_orders, month_usd, month_orders, year_usd, year_orders, open_orders })
}

#[tauri::command]
pub async fn get_revenue_by_period(period: String, pool: State<'_, SqlitePool>) -> Result<Vec<RevenueByDay>, String> {
    let date_filter = match period.as_str() {
        "week"    => "created_at >= datetime('now','-7 days')",
        "3months" => "created_at >= datetime('now','-3 months')",
        "year"    => "strftime('%Y',created_at)=strftime('%Y','now')",
        _         => "strftime('%Y-%m',created_at)=strftime('%Y-%m','now')",
    };

    let query = format!(
        "SELECT date(created_at) as date, COALESCE(SUM(total_usd),0) as total_usd, COUNT(*) as order_count \
         FROM orders WHERE status='completed' AND is_deleted=0 AND {} \
         GROUP BY date(created_at) ORDER BY date ASC",
        date_filter
    );

    let rows: Vec<RevenueByDay> = sqlx::query_as(&query)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    Ok(rows)
}
