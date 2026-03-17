use tauri::State;
use sqlx::SqlitePool;
use crate::models::{Category, Product};

#[tauri::command]
pub async fn get_categories(pool: State<'_, SqlitePool>) -> Result<Vec<Category>, String> {
    let cats: Vec<Category> = sqlx::query_as(
        "SELECT id, name, khmer_name, sort_order FROM categories WHERE is_deleted = 0 ORDER BY sort_order"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(cats)
}

#[tauri::command]
pub async fn get_products(
    category_id: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<Product>, String> {
    let products = if let Some(cat_id) = category_id {
        sqlx::query_as::<_, Product>(
            "SELECT p.id, p.category_id, p.name, p.khmer_name, p.price_cents, p.stock_quantity, p.is_available,
                    c.name AS category_name, c.khmer_name AS category_khmer
             FROM products p LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.is_deleted = 0 AND p.is_available = 1 AND p.category_id = ?
             ORDER BY p.name"
        )
        .bind(&cat_id)
        .fetch_all(pool.inner())
        .await
    } else {
        sqlx::query_as::<_, Product>(
            "SELECT p.id, p.category_id, p.name, p.khmer_name, p.price_cents, p.stock_quantity, p.is_available,
                    c.name AS category_name, c.khmer_name AS category_khmer
             FROM products p LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.is_deleted = 0 AND p.is_available = 1
             ORDER BY c.sort_order, p.name"
        )
        .fetch_all(pool.inner())
        .await
    };

    products.map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn create_product(
    category_id: String,
    name: String,
    khmer_name: Option<String>,
    price_cents: i64,
    stock_quantity: i64,
    pool: State<'_, SqlitePool>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO products (id, category_id, name, khmer_name, price_cents, stock_quantity) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&category_id)
    .bind(&name)
    .bind(&khmer_name)
    .bind(price_cents)
    .bind(stock_quantity)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(id)
}

#[tauri::command]
pub async fn update_product(
    id: String,
    name: String,
    khmer_name: Option<String>,
    price_cents: i64,
    stock_quantity: i64,
    category_id: String,
    is_available: bool,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE products SET name=?, khmer_name=?, price_cents=?, stock_quantity=?, category_id=?, is_available=?, updated_at=datetime('now')
         WHERE id=?"
    )
    .bind(&name)
    .bind(&khmer_name)
    .bind(price_cents)
    .bind(stock_quantity)
    .bind(&category_id)
    .bind(is_available as i64)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn update_stock(
    id: String,
    delta: i64,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE products SET stock_quantity = stock_quantity + ?, updated_at=datetime('now') WHERE id=?"
    )
    .bind(delta)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_product(id: String, pool: State<'_, SqlitePool>) -> Result<(), String> {
    sqlx::query("UPDATE products SET is_deleted=1, updated_at=datetime('now') WHERE id=?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn create_category(
    name: String,
    khmer_name: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let max_order: (i64,) = sqlx::query_as("SELECT COALESCE(MAX(sort_order), 0) FROM categories WHERE is_deleted=0")
        .fetch_one(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    sqlx::query("INSERT INTO categories (id, name, khmer_name, sort_order) VALUES (?, ?, ?, ?)")
        .bind(&id)
        .bind(&name)
        .bind(&khmer_name)
        .bind(max_order.0 + 1)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    Ok(id)
}
