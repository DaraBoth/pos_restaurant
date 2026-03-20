use tauri::State;
use sqlx::SqlitePool;
use uuid::Uuid;
use crate::models::{InventoryItem, ProductIngredient};

#[tauri::command]
pub async fn get_inventory_items(db: State<'_, SqlitePool>) -> Result<Vec<InventoryItem>, String> {
    sqlx::query_as::<_, InventoryItem>(
        "SELECT id, name, khmer_name, unit_label, stock_qty, stock_pct, min_stock_qty, cost_per_unit, created_at 
         FROM inventory_items 
         ORDER BY name ASC"
    )
    .fetch_all(&*db)
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_inventory_item(
    db: State<'_, SqlitePool>,
    name: String,
    khmer_name: Option<String>,
    unit_label: String,
    stock_qty: i64,
    stock_pct: f64,
    min_stock_qty: i64,
    cost_per_unit: i64,
) -> Result<InventoryItem, String> {
    let id = Uuid::new_v4().to_string();
    let query = "
        INSERT INTO inventory_items (id, name, khmer_name, unit_label, stock_qty, stock_pct, min_stock_qty, cost_per_unit)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        RETURNING id, name, khmer_name, unit_label, stock_qty, stock_pct, min_stock_qty, cost_per_unit, created_at
    ";

    sqlx::query_as::<_, InventoryItem>(query)
        .bind(&id)
        .bind(&name)
        .bind(&khmer_name)
        .bind(&unit_label)
        .bind(stock_qty)
        .bind(stock_pct)
        .bind(min_stock_qty)
        .bind(cost_per_unit)
        .fetch_one(&*db)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_inventory_item(
    db: State<'_, SqlitePool>,
    id: String,
    name: String,
    khmer_name: Option<String>,
    unit_label: String,
    stock_qty: i64,
    stock_pct: f64,
    min_stock_qty: i64,
    cost_per_unit: i64,
) -> Result<InventoryItem, String> {
    let query = "
        UPDATE inventory_items 
        SET name = ?2, khmer_name = ?3, unit_label = ?4, stock_qty = ?5, stock_pct = ?6, min_stock_qty = ?7, cost_per_unit = ?8
        WHERE id = ?1
        RETURNING id, name, khmer_name, unit_label, stock_qty, stock_pct, min_stock_qty, cost_per_unit, created_at
    ";

    sqlx::query_as::<_, InventoryItem>(query)
        .bind(&id)
        .bind(&name)
        .bind(&khmer_name)
        .bind(&unit_label)
        .bind(stock_qty)
        .bind(stock_pct)
        .bind(min_stock_qty)
        .bind(cost_per_unit)
        .fetch_one(&*db)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_inventory_item(db: State<'_, SqlitePool>, id: String) -> Result<(), String> {
    sqlx::query("DELETE FROM inventory_items WHERE id = ?1")
        .bind(&id)
        .execute(&*db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_product_ingredients(
    db: State<'_, SqlitePool>,
    product_id: String,
) -> Result<Vec<ProductIngredient>, String> {
    let query = "
        SELECT 
            pi.id, pi.product_id, pi.inventory_item_id, pi.usage_percentage,
            i.name as item_name, i.khmer_name as item_khmer_name, i.unit_label
        FROM product_ingredients pi
        JOIN inventory_items i ON pi.inventory_item_id = i.id
        WHERE pi.product_id = ?1
    ";

    sqlx::query_as::<_, ProductIngredient>(query)
        .bind(&product_id)
        .fetch_all(&*db)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_product_ingredient(
    db: State<'_, SqlitePool>,
    product_id: String,
    inventory_item_id: String,
    usage_percentage: f64,
) -> Result<ProductIngredient, String> {
    let id = Uuid::new_v4().to_string();
    
    // UPSERT logc based on unique pair (product_id, inventory_item_id) if we had one,
    // but without one we can just delete previous entry for this product and item, then insert.
    sqlx::query("DELETE FROM product_ingredients WHERE product_id = ?1 AND inventory_item_id = ?2")
        .bind(&product_id)
        .bind(&inventory_item_id)
        .execute(&*db)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query("INSERT INTO product_ingredients (id, product_id, inventory_item_id, usage_percentage) VALUES (?1, ?2, ?3, ?4)")
        .bind(&id)
        .bind(&product_id)
        .bind(&inventory_item_id)
        .bind(usage_percentage)
        .execute(&*db)
        .await
        .map_err(|e| e.to_string())?;

    // Return the inserted row
    let query = "
        SELECT 
            pi.id, pi.product_id, pi.inventory_item_id, pi.usage_percentage,
            i.name as item_name, i.khmer_name as item_khmer_name, i.unit_label
        FROM product_ingredients pi
        JOIN inventory_items i ON pi.inventory_item_id = i.id
        WHERE pi.id = ?1
    ";

    sqlx::query_as::<_, ProductIngredient>(query)
        .bind(&id)
        .fetch_one(&*db)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_product_ingredient(
    db: State<'_, SqlitePool>,
    product_id: String,
    inventory_item_id: String,
) -> Result<(), String> {
    sqlx::query("DELETE FROM product_ingredients WHERE product_id = ?1 AND inventory_item_id = ?2")
        .bind(&product_id)
        .bind(&inventory_item_id)
        .execute(&*db)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
