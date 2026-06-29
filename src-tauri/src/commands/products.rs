#![allow(clippy::too_many_arguments)]

use tauri::State;
use libsql::{Connection, params};
use std::sync::Arc;
use crate::commands::rbac;
use crate::models::{Category, Product, ProductVariant, ProductModifierGroup, ProductModifierOption};

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

    // Auto-reset sold_out_today for any product whose sold_out_today was set on a previous day.
    let _ = pool.execute(
        "UPDATE products SET sold_out_today=0, updated_at=datetime('now')
         WHERE restaurant_id=? AND sold_out_today=1 AND DATE(updated_at,'localtime') < DATE('now','localtime')",
        params![restaurant_id.clone()]
    ).await;

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
                    c.name AS category_name, c.khmer_name AS category_khmer, p.created_at, p.stock_quantity, p.sku,
                    p.sold_out_today, p.description, p.khmer_description, p.cost_price_cents
             FROM products p LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.is_deleted = 0 AND p.category_id IN (SELECT id FROM subcats) AND p.restaurant_id = ?
             ORDER BY p.name",
             params![cat_id, restaurant_id.clone()]
        ).await
    } else {
        pool.query(
            "SELECT p.id, p.category_id, p.name, p.khmer_name, p.price_cents, p.is_available, p.image_path,
                    c.name AS category_name, c.khmer_name AS category_khmer, p.created_at, p.stock_quantity, p.sku,
                    p.sold_out_today, p.description, p.khmer_description, p.cost_price_cents
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

        let mut variants = Vec::new();
        let mut v_rows = pool.query(
            "SELECT id, product_id, name, name_km, sku, price_cents, stock_quantity, is_active, sort_order
             FROM product_variants
             WHERE product_id = ? AND restaurant_id = ? AND is_deleted = 0
             ORDER BY sort_order, name",
            params![product_id.clone(), restaurant_id.clone()]
        ).await.map_err(|e| format!("Variant fetch error: {}", e))?;
        while let Some(v_row) = v_rows.next().await.map_err(|e| e.to_string())? {
            variants.push(crate::models::ProductVariant {
                id: v_row.get::<String>(0).unwrap_or_default(),
                product_id: v_row.get::<String>(1).unwrap_or_default(),
                name: v_row.get::<String>(2).unwrap_or_default(),
                name_km: v_row.get::<String>(3).ok().filter(|s| !s.is_empty()),
                sku: v_row.get::<String>(4).ok().filter(|s| !s.is_empty()),
                price_cents: v_row.get::<i64>(5).unwrap_or(0),
                stock_quantity: v_row.get::<i64>(6).ok(),
                is_active: v_row.get::<i64>(7).unwrap_or(1),
                sort_order: v_row.get::<i64>(8).unwrap_or(0),
            });
        }

        // Load modifier groups + their options
        let mut modifier_groups = Vec::new();
        let mut g_rows = pool.query(
            "SELECT id, product_id, name, name_km, required, multi_select, sort_order
             FROM product_modifier_groups
             WHERE product_id = ? AND restaurant_id = ? AND is_deleted = 0
             ORDER BY sort_order, name",
            params![product_id.clone(), restaurant_id.clone()]
        ).await.map_err(|e| format!("Modifier group fetch error: {}", e))?;
        let mut group_ids: Vec<(String, crate::models::ProductModifierGroup)> = Vec::new();
        while let Some(g_row) = g_rows.next().await.map_err(|e| e.to_string())? {
            let gid = g_row.get::<String>(0).unwrap_or_default();
            group_ids.push((gid.clone(), crate::models::ProductModifierGroup {
                id: gid,
                product_id: g_row.get::<String>(1).unwrap_or_default(),
                name: g_row.get::<String>(2).unwrap_or_default(),
                name_km: g_row.get::<String>(3).ok().filter(|s| !s.is_empty()),
                required: g_row.get::<i64>(4).unwrap_or(0),
                multi_select: g_row.get::<i64>(5).unwrap_or(0),
                sort_order: g_row.get::<i64>(6).unwrap_or(0),
                options: Vec::new(),
            }));
        }
        for (gid, mut group) in group_ids {
            let mut o_rows = pool.query(
                "SELECT id, group_id, name, name_km, price_delta_cents, is_active, sort_order
                 FROM product_modifier_options
                 WHERE group_id = ? AND restaurant_id = ? AND is_deleted = 0
                 ORDER BY sort_order, name",
                params![gid, restaurant_id.clone()]
            ).await.map_err(|e| format!("Modifier option fetch error: {}", e))?;
            while let Some(o_row) = o_rows.next().await.map_err(|e| e.to_string())? {
                group.options.push(crate::models::ProductModifierOption {
                    id: o_row.get::<String>(0).unwrap_or_default(),
                    group_id: o_row.get::<String>(1).unwrap_or_default(),
                    name: o_row.get::<String>(2).unwrap_or_default(),
                    name_km: o_row.get::<String>(3).ok().filter(|s| !s.is_empty()),
                    price_delta_cents: o_row.get::<i64>(4).unwrap_or(0),
                    is_active: o_row.get::<i64>(5).unwrap_or(1),
                    sort_order: o_row.get::<i64>(6).unwrap_or(0),
                });
            }
            modifier_groups.push(group);
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
            stock_quantity: row.get::<i64>(10).ok(),
            sku: row.get::<String>(11).ok().filter(|s| !s.is_empty()),
            sold_out_today: row.get::<i64>(12).unwrap_or(0),
            description: row.get::<String>(13).ok().filter(|s| !s.is_empty()),
            khmer_description: row.get::<String>(14).ok().filter(|s| !s.is_empty()),
            cost_price_cents: row.get::<i64>(15).ok(),
            variants,
            modifier_groups,
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
    sku: Option<String>,
    description: Option<String>,
    khmer_description: Option<String>,
    cost_price_cents: Option<i64>,
    stock_quantity: Option<i64>,
    pool: State<'_, Arc<Connection>>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let _: u64 = pool.execute(
        "INSERT INTO products (id, category_id, name, khmer_name, price_cents, image_path, restaurant_id, sku, description, khmer_description, cost_price_cents, stock_quantity, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
        params![
            id.clone(),
            category_id,
            name,
            khmer_name.unwrap_or_default(),
            price_cents,
            image_path.unwrap_or_default(),
            restaurant_id.clone(),
            sku.unwrap_or_default(),
            description.unwrap_or_default(),
            khmer_description.unwrap_or_default(),
            cost_price_cents,
            stock_quantity
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
    sku: Option<String>,
    sold_out_today: Option<bool>,
    description: Option<String>,
    khmer_description: Option<String>,
    cost_price_cents: Option<i64>,
    stock_quantity: Option<i64>,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    let _: u64 = pool.execute(
        "UPDATE products SET name=?, khmer_name=?, price_cents=?, category_id=?, is_available=?, image_path=?, sku=?, sold_out_today=?, description=?, khmer_description=?, cost_price_cents=?, stock_quantity=?, updated_at=datetime('now')
         WHERE id=? AND restaurant_id=?",
         params![
             name,
             khmer_name.unwrap_or_default(),
             price_cents,
             category_id,
             is_available as i64,
             image_path.unwrap_or_default(),
             sku.unwrap_or_default(),
             sold_out_today.unwrap_or(false) as i64,
             description.unwrap_or_default(),
             khmer_description.unwrap_or_default(),
             cost_price_cents,
             stock_quantity,
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
pub async fn set_sold_out_today(
    id: String,
    sold_out: bool,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    pool.execute(
        "UPDATE products SET sold_out_today=?, updated_at=datetime('now') WHERE id=? AND restaurant_id=?",
        params![sold_out as i64, id, restaurant_id]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_product(
    id: String,
    restaurant_id: String,
    actor_user_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    let actor_role = rbac::require_delete_permission(&pool, &actor_user_id, &restaurant_id).await?;

    pool.execute(
        "UPDATE products SET is_deleted=1, updated_at=datetime('now') WHERE id=? AND restaurant_id=?",
        params![id.clone(), restaurant_id.clone()]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    rbac::write_audit_log(
        &pool,
        &restaurant_id,
        &actor_user_id,
        &actor_role,
        "delete",
        "product",
        &id,
        None,
    ).await;

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
pub async fn delete_category(
    id: String,
    restaurant_id: String,
    actor_user_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    let actor_role = rbac::require_delete_permission(&pool, &actor_user_id, &restaurant_id).await?;

    pool.execute(
        "UPDATE categories SET is_deleted=1, updated_at=datetime('now') WHERE id=? AND restaurant_id=?",
        params![id.clone(), restaurant_id.clone()]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    rbac::write_audit_log(
        &pool,
        &restaurant_id,
        &actor_user_id,
        &actor_role,
        "delete",
        "category",
        &id,
        None,
    ).await;

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

// ─── Product variants ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_product_variants(
    product_id: String,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<Vec<ProductVariant>, String> {
    let mut rows = pool.query(
        "SELECT id, product_id, name, name_km, sku, price_cents, stock_quantity, is_active, sort_order
         FROM product_variants
         WHERE product_id = ? AND restaurant_id = ? AND is_deleted = 0
         ORDER BY sort_order, name",
        params![product_id, restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let mut variants = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        variants.push(ProductVariant {
            id: row.get::<String>(0).unwrap_or_default(),
            product_id: row.get::<String>(1).unwrap_or_default(),
            name: row.get::<String>(2).unwrap_or_default(),
            name_km: row.get::<String>(3).ok().filter(|s| !s.is_empty()),
            sku: row.get::<String>(4).ok().filter(|s| !s.is_empty()),
            price_cents: row.get::<i64>(5).unwrap_or(0),
            stock_quantity: row.get::<i64>(6).ok(),
            is_active: row.get::<i64>(7).unwrap_or(1),
            sort_order: row.get::<i64>(8).unwrap_or(0),
        });
    }
    Ok(variants)
}

#[tauri::command]
pub async fn create_product_variant(
    product_id: String,
    name: String,
    name_km: Option<String>,
    sku: Option<String>,
    price_cents: i64,
    stock_quantity: Option<i64>,
    sort_order: Option<i64>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<String, String> {
    // Ownership check: product must belong to this restaurant
    let mut p = pool.query(
        "SELECT id FROM products WHERE id = ? AND restaurant_id = ? AND is_deleted = 0",
        params![product_id.clone(), restaurant_id.clone()]
    ).await.map_err(|e| e.to_string())?;
    if p.next().await.map_err(|e| e.to_string())?.is_none() {
        return Err("Product not found or access denied".to_string());
    }

    let id = uuid::Uuid::new_v4().to_string();
    pool.execute(
        "INSERT INTO product_variants (id, product_id, restaurant_id, name, name_km, sku, price_cents, stock_quantity, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
        params![id.clone(), product_id, restaurant_id, name, name_km.unwrap_or_default(), sku.unwrap_or_default(), price_cents, stock_quantity, sort_order.unwrap_or(0)]
    ).await.map_err(|e| format!("Database error: {}", e))?;
    Ok(id)
}

#[tauri::command]
pub async fn update_product_variant(
    id: String,
    name: String,
    name_km: Option<String>,
    sku: Option<String>,
    price_cents: i64,
    stock_quantity: Option<i64>,
    is_active: Option<bool>,
    sort_order: Option<i64>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    pool.execute(
        "UPDATE product_variants SET name=?, name_km=?, sku=?, price_cents=?, stock_quantity=?, is_active=?, sort_order=?, updated_at=datetime('now')
         WHERE id=? AND restaurant_id=?",
        params![name, name_km.unwrap_or_default(), sku.unwrap_or_default(), price_cents, stock_quantity, is_active.unwrap_or(true) as i64, sort_order.unwrap_or(0), id, restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_product_variant(
    id: String,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    pool.execute(
        "UPDATE product_variants SET is_deleted=1, updated_at=datetime('now') WHERE id=? AND restaurant_id=?",
        params![id, restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

// ─── Product modifier groups + options ──────────────────────────────────────

#[tauri::command]
pub async fn get_modifier_groups(
    product_id: String,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<Vec<ProductModifierGroup>, String> {
    let mut g_rows = pool.query(
        "SELECT id, product_id, name, name_km, required, multi_select, sort_order
         FROM product_modifier_groups
         WHERE product_id = ? AND restaurant_id = ? AND is_deleted = 0
         ORDER BY sort_order, name",
        params![product_id, restaurant_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let mut groups: Vec<ProductModifierGroup> = Vec::new();
    while let Some(g) = g_rows.next().await.map_err(|e| e.to_string())? {
        groups.push(ProductModifierGroup {
            id: g.get::<String>(0).unwrap_or_default(),
            product_id: g.get::<String>(1).unwrap_or_default(),
            name: g.get::<String>(2).unwrap_or_default(),
            name_km: g.get::<String>(3).ok().filter(|s| !s.is_empty()),
            required: g.get::<i64>(4).unwrap_or(0),
            multi_select: g.get::<i64>(5).unwrap_or(0),
            sort_order: g.get::<i64>(6).unwrap_or(0),
            options: Vec::new(),
        });
    }
    for group in &mut groups {
        let mut o_rows = pool.query(
            "SELECT id, group_id, name, name_km, price_delta_cents, is_active, sort_order
             FROM product_modifier_options
             WHERE group_id = ? AND restaurant_id = ? AND is_deleted = 0
             ORDER BY sort_order, name",
            params![group.id.clone(), restaurant_id.clone()]
        ).await.map_err(|e| format!("Database error: {}", e))?;
        while let Some(o) = o_rows.next().await.map_err(|e| e.to_string())? {
            group.options.push(ProductModifierOption {
                id: o.get::<String>(0).unwrap_or_default(),
                group_id: o.get::<String>(1).unwrap_or_default(),
                name: o.get::<String>(2).unwrap_or_default(),
                name_km: o.get::<String>(3).ok().filter(|s| !s.is_empty()),
                price_delta_cents: o.get::<i64>(4).unwrap_or(0),
                is_active: o.get::<i64>(5).unwrap_or(1),
                sort_order: o.get::<i64>(6).unwrap_or(0),
            });
        }
    }
    Ok(groups)
}

#[tauri::command]
pub async fn create_modifier_group(
    product_id: String,
    name: String,
    name_km: Option<String>,
    required: Option<bool>,
    multi_select: Option<bool>,
    sort_order: Option<i64>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<String, String> {
    let mut p = pool.query(
        "SELECT id FROM products WHERE id = ? AND restaurant_id = ? AND is_deleted = 0",
        params![product_id.clone(), restaurant_id.clone()]
    ).await.map_err(|e| e.to_string())?;
    if p.next().await.map_err(|e| e.to_string())?.is_none() {
        return Err("Product not found or access denied".to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    pool.execute(
        "INSERT INTO product_modifier_groups (id, product_id, restaurant_id, name, name_km, required, multi_select, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))",
        params![id.clone(), product_id, restaurant_id, name, name_km.unwrap_or_default(), required.unwrap_or(false) as i64, multi_select.unwrap_or(false) as i64, sort_order.unwrap_or(0)]
    ).await.map_err(|e| format!("Database error: {}", e))?;
    Ok(id)
}

#[tauri::command]
pub async fn update_modifier_group(
    id: String,
    name: String,
    name_km: Option<String>,
    required: Option<bool>,
    multi_select: Option<bool>,
    sort_order: Option<i64>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    pool.execute(
        "UPDATE product_modifier_groups SET name=?, name_km=?, required=?, multi_select=?, sort_order=?, updated_at=datetime('now')
         WHERE id=? AND restaurant_id=?",
        params![name, name_km.unwrap_or_default(), required.unwrap_or(false) as i64, multi_select.unwrap_or(false) as i64, sort_order.unwrap_or(0), id, restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_modifier_group(
    id: String,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    pool.execute(
        "UPDATE product_modifier_groups SET is_deleted=1, updated_at=datetime('now') WHERE id=? AND restaurant_id=?",
        params![id.clone(), restaurant_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;
    let _ = pool.execute(
        "UPDATE product_modifier_options SET is_deleted=1, updated_at=datetime('now') WHERE group_id=? AND restaurant_id=?",
        params![id, restaurant_id]
    ).await;
    Ok(())
}

#[tauri::command]
pub async fn create_modifier_option(
    group_id: String,
    name: String,
    name_km: Option<String>,
    price_delta_cents: i64,
    sort_order: Option<i64>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<String, String> {
    let mut g = pool.query(
        "SELECT id FROM product_modifier_groups WHERE id = ? AND restaurant_id = ? AND is_deleted = 0",
        params![group_id.clone(), restaurant_id.clone()]
    ).await.map_err(|e| e.to_string())?;
    if g.next().await.map_err(|e| e.to_string())?.is_none() {
        return Err("Modifier group not found or access denied".to_string());
    }
    let id = uuid::Uuid::new_v4().to_string();
    pool.execute(
        "INSERT INTO product_modifier_options (id, group_id, restaurant_id, name, name_km, price_delta_cents, sort_order, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
        params![id.clone(), group_id, restaurant_id, name, name_km.unwrap_or_default(), price_delta_cents, sort_order.unwrap_or(0)]
    ).await.map_err(|e| format!("Database error: {}", e))?;
    Ok(id)
}

#[tauri::command]
pub async fn update_modifier_option(
    id: String,
    name: String,
    name_km: Option<String>,
    price_delta_cents: i64,
    is_active: Option<bool>,
    sort_order: Option<i64>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    pool.execute(
        "UPDATE product_modifier_options SET name=?, name_km=?, price_delta_cents=?, is_active=?, sort_order=?, updated_at=datetime('now')
         WHERE id=? AND restaurant_id=?",
        params![name, name_km.unwrap_or_default(), price_delta_cents, is_active.unwrap_or(true) as i64, sort_order.unwrap_or(0), id, restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_modifier_option(
    id: String,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    pool.execute(
        "UPDATE product_modifier_options SET is_deleted=1, updated_at=datetime('now') WHERE id=? AND restaurant_id=?",
        params![id, restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}
