use tauri::State;
use libsql::{Connection, params};
use std::sync::Arc;
use crate::models::{Restaurant, RestaurantUpsertInput, SetupStatus};



#[tauri::command]
pub async fn get_restaurant(restaurant_id: Option<String>, pool: State<'_, Arc<Connection>>) -> Result<Restaurant, String> {
    let id_to_use = match restaurant_id {
        Some(id) if !id.is_empty() => id,
        _ => {
            // Fallback: fetch the first restaurant if no specific ID provided (bootstrapping / global UI)
            let mut rows = pool.query("SELECT id FROM restaurants WHERE is_deleted = 0 LIMIT 1", ()).await
                .map_err(|e| format!("Database error: {}", e))?;
            if let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
                row.get::<String>(0).unwrap_or_default()
            } else {
                return Err("No restaurants found in database".to_string());
            }
        }
    };

    let mut rows = pool.query(
        "SELECT id, name, khmer_name, tin, address, address_kh, phone, website, vat_number, receipt_footer, logo_path, is_deleted, created_at, updated_at
         FROM restaurants
         WHERE id = ? AND is_deleted = 0",
         params![id_to_use]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let row = rows.next().await.map_err(|e| e.to_string())?
        .ok_or_else(|| "Restaurant not found".to_string())?;

    Ok(Restaurant {
        id: row.get::<String>(0).unwrap_or_default(),
        name: row.get::<String>(1).unwrap_or_default(),
        khmer_name: row.get::<String>(2).ok(),
        tin: row.get::<String>(3).ok(),
        address: row.get::<String>(4).ok(),
        address_kh: row.get::<String>(5).ok(),
        phone: row.get::<String>(6).ok(),
        website: row.get::<String>(7).ok(),
        vat_number: row.get::<String>(8).ok(),
        receipt_footer: row.get::<String>(9).ok(),
        logo_path: row.get::<String>(10).ok(),
        is_deleted: row.get::<i64>(11).unwrap_or(0),
        created_at: row.get::<String>(12).unwrap_or_default(),
        updated_at: row.get::<String>(13).ok(),
    })
}

#[tauri::command]
pub async fn get_setup_status(restaurant_id: Option<String>, pool: State<'_, Arc<Connection>>) -> Result<SetupStatus, String> {
    let restaurant = get_restaurant(restaurant_id, pool).await?;

    Ok(SetupStatus {
        needs_restaurant_setup: restaurant.name.trim() == "My Restaurant"
            || restaurant.address.as_deref().unwrap_or_default().trim().is_empty()
            || restaurant.phone.as_deref().unwrap_or_default().trim().is_empty(),
    })
}

#[tauri::command]
pub async fn update_restaurant(
    input: RestaurantUpsertInput,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<Restaurant, String> {
    pool.execute(
        "UPDATE restaurants
         SET name = ?,
             khmer_name = ?,
             tin = ?,
             address = ?,
             address_kh = ?,
             phone = ?,
             website = ?,
             vat_number = ?,
             receipt_footer = ?,
             logo_path = ?,
             updated_at = datetime('now')
         WHERE id = ?",
         params![
             input.name,
             input.khmer_name.unwrap_or_default(),
             input.tin.unwrap_or_default(),
             input.address.unwrap_or_default(),
             input.address_kh.unwrap_or_default(),
             input.phone.unwrap_or_default(),
             input.website.unwrap_or_default(),
             input.vat_number.unwrap_or_default(),
             input.receipt_footer.unwrap_or_default(),
             input.logo_path.unwrap_or_default(),
             restaurant_id.clone()
         ]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    get_restaurant(Some(restaurant_id), pool).await
}

#[tauri::command]
pub async fn save_logo(
    app: tauri::AppHandle,
    filename: String,
    content: Vec<u8>
) -> Result<String, String> {
    use tauri::Manager;
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let logos_dir = app_dir.join("logos");
    
    std::fs::create_dir_all(&logos_dir).map_err(|e| e.to_string())?;
    
    let extension = std::path::Path::new(&filename)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("png");
        
    let name = format!("{}.{}", uuid::Uuid::new_v4(), extension);
    let path = logos_dir.join(&name);
    
    std::fs::write(path, content).map_err(|e| e.to_string())?;
    
    Ok(name)
}