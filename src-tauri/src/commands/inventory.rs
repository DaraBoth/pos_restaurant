use tauri::State;
use libsql::{Connection, params};
use std::sync::Arc;
use uuid::Uuid;
use crate::models::{InventoryItem, ProductIngredient};

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
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        items.push(InventoryItem {
            id: row.get::<String>(0).unwrap_or_default(),
            name: row.get::<String>(1).unwrap_or_default(),
            khmer_name: row.get::<String>(2).ok(),
            unit_label: row.get::<String>(3).unwrap_or_default(),
            stock_qty: row.get::<i64>(4).unwrap_or(0),
            stock_pct: row.get::<f64>(5).unwrap_or(0.0),
            min_stock_qty: row.get::<i64>(6).unwrap_or(0),
            cost_per_unit: row.get::<i64>(7).unwrap_or(0),
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
    stock_qty: i64,
    stock_pct: f64,
    min_stock_qty: i64,
    cost_per_unit: i64,
    restaurant_id: String,
) -> Result<InventoryItem, String> {
    let id = Uuid::new_v4().to_string();
    let query = "
        INSERT INTO inventory_items (id, name, khmer_name, unit_label, stock_qty, stock_pct, min_stock_qty, cost_per_unit, restaurant_id)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
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
        stock_qty: row.get::<i64>(4).unwrap_or(0),
        stock_pct: row.get::<f64>(5).unwrap_or(0.0),
        min_stock_qty: row.get::<i64>(6).unwrap_or(0),
        cost_per_unit: row.get::<i64>(7).unwrap_or(0),
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
    stock_qty: i64,
    stock_pct: f64,
    min_stock_qty: i64,
    cost_per_unit: i64,
    restaurant_id: String,
) -> Result<InventoryItem, String> {
    let query = "
        UPDATE inventory_items 
        SET name = ?2, khmer_name = ?3, unit_label = ?4, stock_qty = ?5, stock_pct = ?6, min_stock_qty = ?7, cost_per_unit = ?8
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
        stock_qty: row.get::<i64>(4).unwrap_or(0),
        stock_pct: row.get::<f64>(5).unwrap_or(0.0),
        min_stock_qty: row.get::<i64>(6).unwrap_or(0),
        cost_per_unit: row.get::<i64>(7).unwrap_or(0),
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

#[tauri::command]
pub async fn get_product_ingredients(
    db: State<'_, Arc<Connection>>,
    product_id: String,
    restaurant_id: String,
) -> Result<Vec<ProductIngredient>, String> {
    let query = "
        SELECT 
            pi.id, pi.product_id, pi.inventory_item_id, pi.usage_percentage,
            i.name as item_name, i.khmer_name as item_khmer_name, i.unit_label
        FROM product_ingredients pi
        JOIN inventory_items i ON pi.inventory_item_id = i.id
        WHERE pi.product_id = ?1 AND i.restaurant_id = ?2
    ";

    let mut rows = db.query(query, params![product_id, restaurant_id])
        .await
        .map_err(|e| e.to_string())?;

    let mut ingredients = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        ingredients.push(ProductIngredient {
            id: row.get::<String>(0).unwrap_or_default(),
            product_id: row.get::<String>(1).unwrap_or_default(),
            inventory_item_id: row.get::<String>(2).unwrap_or_default(),
            usage_percentage: row.get::<f64>(3).unwrap_or(0.0),
            item_name: row.get::<String>(4).ok(),
            item_khmer_name: row.get::<String>(5).ok(),
            unit_label: row.get::<String>(6).ok(),
        });
    }

    Ok(ingredients)
}

#[tauri::command]
pub async fn set_product_ingredient(
    db: State<'_, Arc<Connection>>,
    product_id: String,
    inventory_item_id: String,
    usage_percentage: f64,
    restaurant_id: String,
) -> Result<ProductIngredient, String> {
    let id = Uuid::new_v4().to_string();
    
    // Safety check: ensure both and product and inventory item belong to this restaurant
    // Product check
    let mut prod_rows = db.query("SELECT 1 FROM products WHERE id=? AND restaurant_id=?", params![product_id.clone(), restaurant_id.clone()]).await.map_err(|e| e.to_string())?;
    if prod_rows.next().await.map_err(|e| e.to_string())?.is_none() {
        return Err("Product not found or access denied".to_string());
    }

    // Inventory item check
    let mut inv_rows = db.query("SELECT 1 FROM inventory_items WHERE id=? AND restaurant_id=?", params![inventory_item_id.clone(), restaurant_id.clone()]).await.map_err(|e| e.to_string())?;
    if inv_rows.next().await.map_err(|e| e.to_string())?.is_none() {
        return Err("Inventory item not found or access denied".to_string());
    }

    db.execute("DELETE FROM product_ingredients WHERE product_id = ?1 AND inventory_item_id = ?2", 
        params![product_id.clone(), inventory_item_id.clone()])
        .await
        .map_err(|e| e.to_string())?;

    db.execute("INSERT INTO product_ingredients (id, product_id, inventory_item_id, usage_percentage) VALUES (?1, ?2, ?3, ?4)", 
        params![id.clone(), product_id.clone(), inventory_item_id.clone(), usage_percentage])
        .await
        .map_err(|e| e.to_string())?;

    let query = "
        SELECT 
            pi.id, pi.product_id, pi.inventory_item_id, pi.usage_percentage,
            i.name as item_name, i.khmer_name as item_khmer_name, i.unit_label
        FROM product_ingredients pi
        JOIN inventory_items i ON pi.inventory_item_id = i.id
        WHERE pi.id = ?1
    ";

    let mut rows = db.query(query, params![id])
        .await
        .map_err(|e| e.to_string())?;

    let row = rows.next().await.map_err(|e| e.to_string())?.ok_or_else(|| "Failed to fetch inserted ingredient".to_string())?;

    Ok(ProductIngredient {
        id: row.get::<String>(0).unwrap_or_default(),
        product_id: row.get::<String>(1).unwrap_or_default(),
        inventory_item_id: row.get::<String>(2).unwrap_or_default(),
        usage_percentage: row.get::<f64>(3).unwrap_or(0.0),
        item_name: row.get::<String>(4).ok(),
        item_khmer_name: row.get::<String>(5).ok(),
        unit_label: row.get::<String>(6).ok(),
    })
}

#[tauri::command]
pub async fn remove_product_ingredient(
    db: State<'_, Arc<Connection>>,
    product_id: String,
    inventory_item_id: String,
    restaurant_id: String,
) -> Result<(), String> {
    // Safety check: ensure the inventory item belongs to this restaurant
    // Product check is sufficient since we join or filter by it
    let mut inv_rows = db.query("SELECT 1 FROM inventory_items WHERE id=? AND restaurant_id=?", params![inventory_item_id.clone(), restaurant_id.clone()]).await.map_err(|e| e.to_string())?;
    if inv_rows.next().await.map_err(|e| e.to_string())?.is_none() {
        return Err("Inventory item not found or access denied".to_string());
    }

    db.execute("DELETE FROM product_ingredients WHERE product_id = ?1 AND inventory_item_id = ?2", 
        params![product_id, inventory_item_id])
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
