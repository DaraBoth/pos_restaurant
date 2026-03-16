use tauri::State;
use sqlx::SqlitePool;
use crate::models::{Order, OrderItem, PaymentInput};

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
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO orders (id, user_id, table_id, status) VALUES (?, ?, ?, 'open')"
    )
    .bind(&id)
    .bind(&user_id)
    .bind(&table_id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;
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
    // Fetch product price
    let (price_cents, p_name, p_khmer): (i64, String, Option<String>) = sqlx::query_as(
        "SELECT price_cents, name, khmer_name FROM products WHERE id = ? AND is_deleted = 0"
    )
    .bind(&product_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Product not found: {}", e))?;

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO order_items (id, order_id, product_id, quantity, price_at_order, note) VALUES (?, ?, ?, ?, ?, ?)"
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

    // Update order totals
    recalculate_order_totals(&order_id, pool.inner()).await?;

    Ok(OrderItem {
        id,
        order_id,
        product_id,
        quantity,
        price_at_order: price_cents,
        note,
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
pub async fn get_orders(
    status: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Order>, String> {
    let orders = if let Some(s) = status {
        sqlx::query_as::<_, Order>(
            "SELECT id, user_id, table_id, status, total_usd, total_khr, tax_vat, tax_plt,
                    bakong_bill_number, notes, created_at, updated_at, completed_at
             FROM orders WHERE status=? AND is_deleted=0 ORDER BY created_at DESC"
        )
        .bind(&s)
        .fetch_all(pool.inner())
        .await
    } else {
        sqlx::query_as::<_, Order>(
            "SELECT id, user_id, table_id, status, total_usd, total_khr, tax_vat, tax_plt,
                    bakong_bill_number, notes, created_at, updated_at, completed_at
             FROM orders WHERE is_deleted=0 ORDER BY created_at DESC LIMIT 100"
        )
        .fetch_all(pool.inner())
        .await
    };
    orders.map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn checkout_order(
    order_id: String,
    payments: Vec<PaymentInput>,
    pool: State<'_, SqlitePool>,
) -> Result<Order, String> {
    // Mark order as completed
    sqlx::query(
        "UPDATE orders SET status='completed', updated_at=datetime('now'), completed_at=datetime('now') WHERE id=?"
    )
    .bind(&order_id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

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

    // Return the completed order
    let order: Order = sqlx::query_as(
        "SELECT id, user_id, table_id, status, total_usd, total_khr, tax_vat, tax_plt,
                bakong_bill_number, notes, created_at, updated_at, completed_at
         FROM orders WHERE id=?"
    )
    .bind(&order_id)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(order)
}

#[tauri::command]
pub async fn void_order(order_id: String, pool: State<'_, SqlitePool>) -> Result<(), String> {
    sqlx::query("UPDATE orders SET status='void', updated_at=datetime('now') WHERE id=?")
        .bind(&order_id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;
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

    // VAT: 10% of subtotal
    let vat = (subtotal as f64 * 0.10).round() as i64;
    // PLT: 3% of subtotal
    let plt = (subtotal as f64 * 0.03).round() as i64;
    // Total USD in cents
    let total_usd = subtotal + vat + plt;

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
