use tauri::State;
use libsql::{Connection, params};
use std::sync::Arc;
use crate::models::{Category, Product};

#[tauri::command]
pub async fn get_categories(pool: State<'_, Arc<Connection>>) -> Result<Vec<Category>, String> {
    let mut rows = pool.query(
        "SELECT id, name, khmer_name, sort_order FROM categories WHERE is_deleted = 0 ORDER BY sort_order",
        ()
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let mut cats = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        cats.push(Category {
            id: row.get::<String>(0).unwrap_or_default(),
            name: row.get::<String>(1).unwrap_or_default(),
            khmer_name: row.get::<String>(2).ok(),
            sort_order: row.get::<i64>(3).unwrap_or(0),
        });
    }
    
    Ok(cats)
}

#[tauri::command]
pub async fn get_products(
    category_id: Option<String>,
    pool: State<'_, Arc<Connection>>,
) -> Result<Vec<Product>, String> {
    let mut rows = if let Some(cat_id) = category_id {
        pool.query(
            "SELECT p.id, p.category_id, p.name, p.khmer_name, p.price_cents, p.stock_quantity, p.is_available, p.image_path,
                    c.name AS category_name, c.khmer_name AS category_khmer, p.created_at
             FROM products p LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.is_deleted = 0 AND p.is_available = 1 AND p.category_id = ?
             ORDER BY p.name",
             params![cat_id]
        ).await
    } else {
        pool.query(
            "SELECT p.id, p.category_id, p.name, p.khmer_name, p.price_cents, p.stock_quantity, p.is_available, p.image_path,
                    c.name AS category_name, c.khmer_name AS category_khmer, p.created_at
             FROM products p LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.is_deleted = 0 AND p.is_available = 1
             ORDER BY c.sort_order, p.name",
             ()
        ).await
    }.map_err(|e| format!("Database error: {}", e))?;

    let mut products = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        products.push(Product {
            id: row.get::<String>(0).unwrap_or_default(),
            category_id: row.get::<String>(1).ok(),
            name: row.get::<String>(2).unwrap_or_default(),
            khmer_name: row.get::<String>(3).ok(),
            price_cents: row.get::<i64>(4).unwrap_or(0),
            stock_quantity: row.get::<i64>(5).unwrap_or(0),
            is_available: row.get::<i64>(6).unwrap_or(1),
            image_path: row.get::<String>(7).ok(),
            category_name: row.get::<String>(8).ok(),
            category_khmer: row.get::<String>(9).ok(),
            created_at: row.get::<String>(10).unwrap_or_default(),
        });
    }

    Ok(products)
}

#[tauri::command]
pub async fn get_inventory_logs(pool: State<'_, Arc<Connection>>) -> Result<Vec<serde_json::Value>, String> {
    let mut rows = pool.query(
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
        "#,
        ()
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let mut result = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        result.push(serde_json::json!({
            "id": row.get::<String>(0).unwrap_or_default(),
            "product_id": row.get::<String>(1).unwrap_or_default(),
            "product_name": row.get::<String>(2).unwrap_or_default(),
            "change_amount": row.get::<i64>(3).unwrap_or(0),
            "reason": row.get::<String>(4).unwrap_or_default(),
            "created_at": row.get::<String>(5).unwrap_or_default()
        }));
    }

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
    pool: State<'_, Arc<Connection>>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    pool.execute(
        "INSERT INTO products (id, category_id, name, khmer_name, price_cents, stock_quantity, image_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            id.clone(),
            category_id,
            name,
            khmer_name.unwrap_or_default(),
            price_cents,
            stock_quantity,
            image_path.unwrap_or_default()
        ]
    )
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
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    pool.execute(
        "UPDATE products SET name=?, khmer_name=?, price_cents=?, stock_quantity=?, category_id=?, is_available=?, image_path=?, updated_at=datetime('now')
         WHERE id=?",
         params![
             name,
             khmer_name.unwrap_or_default(),
             price_cents,
             stock_quantity,
             category_id,
             is_available as i64,
             image_path.unwrap_or_default(),
             id
         ]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn update_stock(
    id: String,
    delta: i64,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    pool.execute(
        "UPDATE products SET stock_quantity = stock_quantity + ?, updated_at=datetime('now') WHERE id=?",
        params![delta, id]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_product(id: String, pool: State<'_, Arc<Connection>>) -> Result<(), String> {
    pool.execute(
        "UPDATE products SET is_deleted=1, updated_at=datetime('now') WHERE id=?",
        params![id]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn create_category(
    name: String,
    khmer_name: Option<String>,
    pool: State<'_, Arc<Connection>>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let mut rows = pool.query("SELECT COALESCE(MAX(sort_order), 0) FROM categories WHERE is_deleted=0", ())
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    
    let max_order: i64 = if let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        row.get(0).unwrap_or(0)
    } else {
        0
    };

    pool.execute(
        "INSERT INTO categories (id, name, khmer_name, sort_order) VALUES (?, ?, ?, ?)",
        params![id.clone(), name, khmer_name.unwrap_or_default(), max_order + 1]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(id)
}

#[tauri::command]
pub async fn update_category(
    id: String,
    name: String,
    khmer_name: Option<String>,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    pool.execute(
        "UPDATE categories SET name=?, khmer_name=?, updated_at=datetime('now') WHERE id=?",
        params![name, khmer_name.unwrap_or_default(), id]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_category(id: String, pool: State<'_, Arc<Connection>>) -> Result<(), String> {
    pool.execute(
        "UPDATE categories SET is_deleted=1, updated_at=datetime('now') WHERE id=?",
        params![id]
    )
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
