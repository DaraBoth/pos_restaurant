use tauri::State;
use libsql::{Connection, params};
use std::sync::Arc;
use crate::models::{Category, Product};

fn get_f64_safe(row: &libsql::Row, idx: i32) -> f64 {
    match row.get_value(idx) {
        Ok(libsql::Value::Integer(i)) => i as f64,
        Ok(libsql::Value::Real(f)) => f,
        _ => 0.0,
    }
}

#[tauri::command]
pub async fn get_categories(
    pool: State<'_, Arc<Connection>>,
    restaurant_id: String,
) -> Result<Vec<Category>, String> {
    let mut rows = pool.query(
        "WITH RECURSIVE cat_tree(id, name, khmer_name, sort_order, parent_id, depth, path) AS (
            SELECT id, name, khmer_name, sort_order, parent_id, 0,
                   printf('%010d', sort_order)
            FROM categories
            WHERE (parent_id IS NULL OR parent_id = '') AND is_deleted = 0 AND restaurant_id = ?
            UNION ALL
            SELECT c.id, c.name, c.khmer_name, c.sort_order, c.parent_id, ct.depth + 1,
                   ct.path || '/' || printf('%010d', c.sort_order)
            FROM categories c
            JOIN cat_tree ct ON c.parent_id = ct.id
            WHERE c.is_deleted = 0 AND ct.depth < 10
        )
        SELECT id, name, khmer_name, sort_order, parent_id, depth FROM cat_tree ORDER BY path",
        params![restaurant_id]
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
            parent_id: row.get::<String>(4).ok().filter(|s| !s.is_empty()),
            depth: row.get::<i64>(5).unwrap_or(0),
        });
    }
    
    Ok(cats)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IngredientInput {
    pub inventory_item_id: String,
    pub usage_quantity: f64,
}

#[tauri::command]
pub async fn get_products(
    category_id: Option<String>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<Vec<Product>, String> {
    let mut products = Vec::new();
    
    let mut rows = if let Some(cat_id) = category_id {
        pool.query(
            "WITH RECURSIVE subcats(id) AS (
                SELECT ?
                UNION ALL
                SELECT c.id FROM categories c
                JOIN subcats s ON c.parent_id = s.id
                WHERE c.is_deleted = 0
             )
             SELECT p.id, p.category_id, p.name, p.khmer_name, p.price_cents, p.is_available, p.image_path,
                    c.name AS category_name, c.khmer_name AS category_khmer, p.created_at
             FROM products p LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.is_deleted = 0 AND p.category_id IN (SELECT id FROM subcats) AND p.restaurant_id = ?
             ORDER BY p.name",
             params![cat_id, restaurant_id.clone()]
        ).await
    } else {
        pool.query(
            "SELECT p.id, p.category_id, p.name, p.khmer_name, p.price_cents, p.is_available, p.image_path,
                    c.name AS category_name, c.khmer_name AS category_khmer, p.created_at
             FROM products p LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.is_deleted = 0 AND p.restaurant_id = ?
             ORDER BY c.sort_order, p.name",
             params![restaurant_id.clone()]
        ).await
    }.map_err(|e| format!("Database error: {}", e))?;

    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        let product_id = row.get::<String>(0).unwrap_or_default();
        
        let mut ingredients = Vec::new();
        let mut ing_rows = pool.query(
            "SELECT pi.id, pi.product_id, pi.inventory_item_id, pi.usage_quantity, ii.name, ii.unit_label
             FROM product_ingredients pi
             JOIN inventory_items ii ON pi.inventory_item_id = ii.id
             WHERE pi.product_id = ? AND pi.restaurant_id = ?",
            params![product_id.clone(), restaurant_id.clone()]
        ).await.map_err(|e| format!("Ingredient fetch error: {}", e))?;
        
        while let Some(i_row) = ing_rows.next().await.map_err(|e| e.to_string())? {
            ingredients.push(crate::models::ProductIngredient {
                id: i_row.get(0).unwrap_or_default(),
                product_id: i_row.get(1).unwrap_or_default(),
                inventory_item_id: i_row.get(2).unwrap_or_default(),
                usage_quantity: get_f64_safe(&i_row, 3),
                inventory_item_name: i_row.get(4).ok(),
                inventory_item_unit: i_row.get(5).ok(),
            });
        }

        products.push(Product {
            id: product_id,
            category_id: row.get::<String>(1).ok(),
            name: row.get::<String>(2).unwrap_or_default(),
            khmer_name: row.get::<String>(3).ok(),
            price_cents: row.get::<i64>(4).unwrap_or(0),
            is_available: row.get::<i64>(5).unwrap_or(1),
            image_path: row.get::<String>(6).ok(),
            category_name: row.get::<String>(7).ok(),
            category_khmer: row.get::<String>(8).ok(),
            ingredients,
            created_at: row.get::<String>(9).unwrap_or_default(),
        });
    }

    Ok(products)
}

#[tauri::command]
pub async fn get_inventory_logs(
    pool: State<'_, Arc<Connection>>,
    restaurant_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    let mut rows = pool.query(
        r#"
        SELECT 
            il.id, 
            il.inventory_item_id, 
            ii.name as item_name, 
            il.change_amount, 
            il.change_type, 
            il.created_at
        FROM inventory_logs il
        JOIN inventory_items ii ON il.inventory_item_id = ii.id
        WHERE il.restaurant_id = ?
        ORDER BY il.created_at DESC
        LIMIT 100
        "#,
        params![restaurant_id]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let mut result = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        result.push(serde_json::json!({
            "id": row.get::<String>(0).unwrap_or_default(),
            "item_id": row.get::<String>(1).unwrap_or_default(),
            "item_name": row.get::<String>(2).unwrap_or_default(),
            "change_amount": get_f64_safe(&row, 3),
            "change_type": row.get::<String>(4).unwrap_or_default(),
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
    image_path: Option<String>,
    ingredients: Vec<IngredientInput>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let _: u64 = pool.execute(
        "INSERT INTO products (id, category_id, name, khmer_name, price_cents, image_path, restaurant_id, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
        params![
            id.clone(),
            category_id,
            name,
            khmer_name.unwrap_or_default(),
            price_cents,
            image_path.unwrap_or_default(),
            restaurant_id.clone()
        ]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    for ing in ingredients {
        let ing_id = uuid::Uuid::new_v4().to_string();
        let _: u64 = pool.execute(
            "INSERT INTO product_ingredients (id, product_id, inventory_item_id, usage_quantity, restaurant_id) 
             VALUES (?, ?, ?, ?, ?)",
            params![ing_id, id.clone(), ing.inventory_item_id, ing.usage_quantity, restaurant_id.clone()]
        ).await.map_err(|e| format!("Ingredient insert error: {}", e))?;
    }

    Ok(id)
}

#[tauri::command]
pub async fn update_product(
    id: String,
    name: String,
    khmer_name: Option<String>,
    price_cents: i64,
    category_id: String,
    is_available: bool,
    image_path: Option<String>,
    ingredients: Vec<IngredientInput>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    let _: u64 = pool.execute(
        "UPDATE products SET name=?, khmer_name=?, price_cents=?, category_id=?, is_available=?, image_path=?, updated_at=datetime('now')
         WHERE id=? AND restaurant_id=?",
         params![
             name,
             khmer_name.unwrap_or_default(),
             price_cents,
             category_id,
             is_available as i64,
             image_path.unwrap_or_default(),
             id.clone(),
             restaurant_id.clone()
         ]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let _: u64 = pool.execute(
        "DELETE FROM product_ingredients WHERE product_id = ? AND restaurant_id = ?",
        params![id.clone(), restaurant_id.clone()]
    ).await.map_err(|e| format!("Ingredient delete error: {}", e))?;

    for ing in ingredients {
        let ing_id = uuid::Uuid::new_v4().to_string();
        let _: u64 = pool.execute(
            "INSERT INTO product_ingredients (id, product_id, inventory_item_id, usage_quantity, restaurant_id) 
             VALUES (?, ?, ?, ?, ?)",
            params![ing_id, id.clone(), ing.inventory_item_id, ing.usage_quantity, restaurant_id.clone()]
        ).await.map_err(|e| format!("Ingredient re-insert error: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn delete_product(id: String, restaurant_id: String, pool: State<'_, Arc<Connection>>) -> Result<(), String> {
    pool.execute(
        "UPDATE products SET is_deleted=1, updated_at=datetime('now') WHERE id=? AND restaurant_id=?",
        params![id, restaurant_id]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn create_category(
    name: String,
    khmer_name: Option<String>,
    parent_id: Option<String>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let mut rows = pool.query("SELECT COALESCE(MAX(sort_order), 0) FROM categories WHERE is_deleted=0 AND restaurant_id = ?", params![restaurant_id.clone()])
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    
    let max_order: i64 = if let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        row.get(0).unwrap_or(0)
    } else {
        0
    };

    pool.execute(
        "INSERT INTO categories (id, name, khmer_name, sort_order, parent_id, restaurant_id) VALUES (?, ?, ?, ?, ?, ?)",
        params![id.clone(), name, khmer_name.unwrap_or_default(), max_order + 1, parent_id.unwrap_or_default(), restaurant_id]
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
    parent_id: Option<String>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    pool.execute(
        "UPDATE categories SET name=?, khmer_name=?, parent_id=?, updated_at=datetime('now') WHERE id=? AND restaurant_id=?",
        params![name, khmer_name.unwrap_or_default(), parent_id.unwrap_or_default(), id, restaurant_id]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_category(id: String, restaurant_id: String, pool: State<'_, Arc<Connection>>) -> Result<(), String> {
    pool.execute(
        "UPDATE categories SET is_deleted=1, updated_at=datetime('now') WHERE id=? AND restaurant_id=?",
        params![id, restaurant_id]
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
