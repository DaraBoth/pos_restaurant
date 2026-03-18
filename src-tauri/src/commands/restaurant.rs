use tauri::State;
use sqlx::SqlitePool;
use crate::models::{Restaurant, RestaurantUpsertInput, SetupStatus};

const DEFAULT_RESTAURANT_ID: &str = "rest-00000000-0000-0000-0000-000000000001";

#[tauri::command]
pub async fn get_restaurant(pool: State<'_, SqlitePool>) -> Result<Restaurant, String> {
    let restaurant = sqlx::query_as::<_, Restaurant>(
        "SELECT id, name, khmer_name, tin, address, address_kh, phone, website, vat_number, receipt_footer, logo_path, is_deleted, created_at, updated_at
         FROM restaurants
         WHERE id = ? AND is_deleted = 0"
    )
    .bind(DEFAULT_RESTAURANT_ID)
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(restaurant)
}

#[tauri::command]
pub async fn get_setup_status(pool: State<'_, SqlitePool>) -> Result<SetupStatus, String> {
    let restaurant = get_restaurant(pool).await?;

    Ok(SetupStatus {
        needs_restaurant_setup: restaurant.name.trim() == "My Restaurant"
            || restaurant.address.as_deref().unwrap_or_default().trim().is_empty()
            || restaurant.phone.as_deref().unwrap_or_default().trim().is_empty(),
    })
}

#[tauri::command]
pub async fn update_restaurant(
    input: RestaurantUpsertInput,
    pool: State<'_, SqlitePool>,
) -> Result<Restaurant, String> {
    sqlx::query(
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
         WHERE id = ?"
    )
    .bind(&input.name)
    .bind(&input.khmer_name)
    .bind(&input.tin)
    .bind(&input.address)
    .bind(&input.address_kh)
    .bind(&input.phone)
    .bind(&input.website)
    .bind(&input.vat_number)
    .bind(&input.receipt_footer)
    .bind(&input.logo_path)
    .bind(DEFAULT_RESTAURANT_ID)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    get_restaurant(pool).await
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