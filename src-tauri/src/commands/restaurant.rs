use tauri::State;
use libsql::{Connection, params};
use std::sync::Arc;
use chrono::Local;
use crate::db::RemoteDb;
use crate::models::{Restaurant, RestaurantLicenseStatus, RestaurantUpsertInput, SetupStatus};



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
        "SELECT id, name, khmer_name, tin, address, address_kh, phone, website, vat_number, receipt_footer, logo_path, license_expires_at, license_support_contact, is_deleted, created_at, updated_at
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
        license_expires_at: row.get::<String>(11).ok(),
        license_support_contact: row.get::<String>(12).ok(),
        is_deleted: row.get::<i64>(13).unwrap_or(0),
        created_at: row.get::<String>(14).unwrap_or_default(),
        updated_at: row.get::<String>(15).ok(),
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

    fn normalize_optional_text(value: Option<String>) -> Option<String> {
        value.and_then(|inner| {
            let trimmed = inner.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        })
    }

    fn license_is_expired(expires_at: Option<&str>) -> bool {
        let Some(raw) = expires_at.map(str::trim).filter(|value| !value.is_empty()) else {
            return false;
        };

        let date_portion = raw.get(..10).unwrap_or(raw);
        match chrono::NaiveDate::parse_from_str(date_portion, "%Y-%m-%d") {
            Ok(expiry_date) => Local::now().date_naive() > expiry_date,
            Err(_) => false,
        }
    }

    async fn get_local_license_snapshot(
        pool: &Connection,
        restaurant_id: &str,
    ) -> Option<(String, Option<String>, Option<String>)> {
        let mut rows = pool.query(
            "SELECT name, license_expires_at, license_support_contact
             FROM restaurants
             WHERE id = ? AND is_deleted = 0",
            params![restaurant_id]
        ).await.ok()?;

        let row = rows.next().await.ok()??;
        Some((
            row.get::<String>(0).unwrap_or_default(),
            row.get::<String>(1).ok(),
            row.get::<String>(2).ok(),
        ))
    }

    #[tauri::command]
    pub async fn update_restaurant_license(
        restaurant_id: String,
        license_expires_at: Option<String>,
        license_support_contact: Option<String>,
        pool: State<'_, Arc<Connection>>,
    ) -> Result<Restaurant, String> {
        let expires_at = normalize_optional_text(license_expires_at);
        let support_contact = normalize_optional_text(license_support_contact);

        pool.execute(
            "UPDATE restaurants
             SET license_expires_at = ?,
                 license_support_contact = ?,
                 updated_at = datetime('now')
             WHERE id = ?",
            params![expires_at.clone(), support_contact.clone(), restaurant_id.clone()]
        )
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        get_restaurant(Some(restaurant_id), pool).await
    }

    #[tauri::command]
    pub async fn verify_restaurant_license(
        restaurant_id: String,
        pool: State<'_, Arc<Connection>>,
        remote: State<'_, RemoteDb>,
    ) -> Result<RestaurantLicenseStatus, String> {
        let fallback = get_local_license_snapshot(&pool, &restaurant_id).await;

        let Some(remote_conn) = &remote.0 else {
            return Ok(RestaurantLicenseStatus {
                restaurant_id,
                restaurant_name: fallback.as_ref().map(|snapshot| snapshot.0.clone()),
                license_expires_at: fallback.as_ref().and_then(|snapshot| snapshot.1.clone()),
                license_support_contact: fallback.as_ref().and_then(|snapshot| snapshot.2.clone()),
                checked_online: false,
                is_expired: false,
                status: "offline".to_string(),
            });
        };

        let mut rows = match remote_conn.query(
            "SELECT name, license_expires_at, license_support_contact
             FROM restaurants
             WHERE id = ? AND is_deleted = 0",
            params![restaurant_id.clone()]
        ).await {
            Ok(rows) => rows,
            Err(_) => {
                return Ok(RestaurantLicenseStatus {
                    restaurant_id,
                    restaurant_name: fallback.as_ref().map(|snapshot| snapshot.0.clone()),
                    license_expires_at: fallback.as_ref().and_then(|snapshot| snapshot.1.clone()),
                    license_support_contact: fallback.as_ref().and_then(|snapshot| snapshot.2.clone()),
                    checked_online: false,
                    is_expired: false,
                    status: "offline".to_string(),
                });
            }
        };

        let Some(row) = rows.next().await.map_err(|e| e.to_string())? else {
            return Err("Restaurant not found in cloud license registry".to_string());
        };

        let restaurant_name = row.get::<String>(0).ok();
        let license_expires_at = normalize_optional_text(row.get::<String>(1).ok());
        let license_support_contact = normalize_optional_text(row.get::<String>(2).ok());

        pool.execute(
            "UPDATE restaurants
             SET license_expires_at = ?,
                 license_support_contact = ?,
                 updated_at = datetime('now')
             WHERE id = ?",
            params![license_expires_at.clone(), license_support_contact.clone(), restaurant_id.clone()]
        )
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        let is_expired = license_is_expired(license_expires_at.as_deref());

        Ok(RestaurantLicenseStatus {
            restaurant_id,
            restaurant_name,
            license_expires_at,
            license_support_contact,
            checked_online: true,
            is_expired,
            status: if is_expired { "expired" } else { "active" }.to_string(),
        })
    }