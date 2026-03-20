use tauri::State;
use sqlx::{SqlitePool, Row};
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
            "SELECT p.id, p.category_id, p.name, p.khmer_name, p.price_cents, p.stock_quantity, p.is_available, p.image_path,
                    c.name AS category_name, c.khmer_name AS category_khmer, p.created_at
             FROM products p LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.is_deleted = 0 AND p.is_available = 1 AND p.category_id = ?
             ORDER BY p.name"
        )
        .bind(&cat_id)
        .fetch_all(pool.inner())
        .await
    } else {
        sqlx::query_as::<_, Product>(
            "SELECT p.id, p.category_id, p.name, p.khmer_name, p.price_cents, p.stock_quantity, p.is_available, p.image_path,
                    c.name AS category_name, c.khmer_name AS category_khmer, p.created_at
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
pub async fn get_inventory_logs(pool: State<'_, SqlitePool>) -> Result<Vec<serde_json::Value>, String> {
    let logs = sqlx::query(
        r#"
        SELECT 
            il.id, 
            il.product_id, 
            p.name as product_name, 
            il.change_amount, 
            il.reason, 
            il.created_at
        FROM inventory_logs il
        JOIN products p ON il.product_id = p.id
        ORDER BY il.created_at DESC
        LIMIT 100
        "#
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let result = logs.into_iter().map(|row| {
        serde_json::json!({
            "id": row.get::<String, _>("id"),
            "product_id": row.get::<String, _>("product_id"),
            "product_name": row.get::<String, _>("product_name"),
            "change_amount": row.get::<i64, _>("change_amount"),
            "reason": row.get::<String, _>("reason"),
            "created_at": row.get::<String, _>("created_at")
        })
    }).collect();

    Ok(result)
}

#[tauri::command]
pub async fn create_product(
    category_id: String,
    name: String,
    khmer_name: Option<String>,
    price_cents: i64,
    stock_quantity: i64,
    image_path: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO products (id, category_id, name, khmer_name, price_cents, stock_quantity, image_path) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&category_id)
    .bind(&name)
    .bind(&khmer_name)
    .bind(price_cents)
    .bind(stock_quantity)
    .bind(&image_path)
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
    image_path: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE products SET name=?, khmer_name=?, price_cents=?, stock_quantity=?, category_id=?, is_available=?, image_path=?, updated_at=datetime('now')
         WHERE id=?"
    )
    .bind(&name)
    .bind(&khmer_name)
    .bind(price_cents)
    .bind(stock_quantity)
    .bind(&category_id)
    .bind(is_available as i64)
    .bind(&image_path)
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

#[tauri::command]
pub async fn update_category(
    id: String,
    name: String,
    khmer_name: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    sqlx::query("UPDATE categories SET name=?, khmer_name=?, updated_at=datetime('now') WHERE id=?")
        .bind(&name)
        .bind(&khmer_name)
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_category(id: String, pool: State<'_, SqlitePool>) -> Result<(), String> {
    // Soft delete
    sqlx::query("UPDATE categories SET is_deleted=1, updated_at=datetime('now') WHERE id=?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

/// Save a product image to the app data directory and return the full absolute path.
/// The path is stored in the products.image_path column and served via the
/// asset:// protocol configured in tauri.conf.json.
#[tauri::command]
pub async fn save_product_image(
    app: tauri::AppHandle,
    filename: String,
    content: Vec<u8>,
) -> Result<String, String> {
    use tauri::Manager;
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let images_dir = app_dir.join("product-images");
    std::fs::create_dir_all(&images_dir).map_err(|e| e.to_string())?;

    let extension = std::path::Path::new(&filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("jpg");

    // Only allow safe image extensions
    let ext_lower = extension.to_lowercase();
    if !["jpg", "jpeg", "png", "webp", "gif"].contains(&ext_lower.as_str()) {
        return Err("Unsupported image format".to_string());
    }

    let name = format!("{}.{}", uuid::Uuid::new_v4(), ext_lower);
    let path = images_dir.join(&name);
    let full_path = path.to_string_lossy().to_string();

    std::fs::write(&path, content).map_err(|e| e.to_string())?;

    Ok(full_path)
}
