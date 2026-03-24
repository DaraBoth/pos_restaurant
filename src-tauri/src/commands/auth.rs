use tauri::State;
use libsql::{Connection, params};
use std::sync::Arc;
use crate::models::{User, UserSession, RestaurantSummary};
use argon2::{Argon2, PasswordHash, PasswordVerifier, PasswordHasher};
use argon2::password_hash::{SaltString, rand_core::OsRng};

#[tauri::command]
pub async fn login(
    username: String,
    password: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<UserSession, String> {
    let mut rows = pool.query(
        "SELECT id, restaurant_id, username, password_hash, role, full_name, khmer_name, is_deleted, created_at
         FROM users WHERE username = ? AND is_deleted = 0",
        params![username]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let row = rows.next().await.map_err(|e| e.to_string())?
        .ok_or_else(|| "Invalid username or password".to_string())?;

    let user_id = row.get::<String>(0).unwrap_or_default();
    let user_name = row.get::<String>(2).unwrap_or_default();
    let password_hash = row.get::<String>(3).unwrap_or_default();
    let role = row.get::<String>(4).unwrap_or_default();
    let full_name = row.get::<String>(5).ok();
    let khmer_name = row.get::<String>(6).ok();

    let parsed_hash = PasswordHash::new(&password_hash)
        .map_err(|_| "Invalid password hash".to_string())?;

    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| "Invalid username or password".to_string())?;

    Ok(UserSession {
        id: user_id,
        username: user_name,
        role,
        full_name,
        khmer_name,
        restaurant_id: row.get::<String>(1).ok(),
    })
}

#[tauri::command]
pub async fn create_user(
    username: String,
    password: String,
    role: String,
    full_name: Option<String>,
    khmer_name: Option<String>,
    pool: State<'_, Arc<Connection>>,
) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Hash error: {}", e))?
        .to_string();

    let id = uuid::Uuid::new_v4().to_string();
    pool.execute(
        "INSERT INTO users (id, restaurant_id, username, password_hash, role, full_name, khmer_name)
         VALUES (?, 'rest-00000000-0000-0000-0000-000000000001', ?, ?, ?, ?, ?)",
        params![
            id.clone(),
            username,
            hash,
            role,
            full_name.unwrap_or_default(),
            khmer_name.unwrap_or_default()
        ]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(id)
}

#[tauri::command]
pub async fn get_users(pool: State<'_, Arc<Connection>>) -> Result<Vec<User>, String> {
    let mut rows = pool.query(
        "SELECT id, restaurant_id, username, password_hash, role, full_name, khmer_name, is_deleted, created_at
         FROM users WHERE is_deleted = 0 ORDER BY role, username",
        ()
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let mut users = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        users.push(User {
            id: row.get::<String>(0).unwrap_or_default(),
            restaurant_id: row.get::<String>(1).ok(),
            username: row.get::<String>(2).unwrap_or_default(),
            password_hash: row.get::<String>(3).unwrap_or_default(),
            role: row.get::<String>(4).unwrap_or_default(),
            full_name: row.get::<String>(5).ok(),
            khmer_name: row.get::<String>(6).ok(),
            is_deleted: row.get::<i64>(7).unwrap_or(0),
            created_at: row.get::<String>(8).unwrap_or_default(),
        });
    }

    Ok(users)
}

#[tauri::command]
pub async fn delete_user(id: String, pool: State<'_, Arc<Connection>>) -> Result<(), String> {
    pool.execute(
        "UPDATE users SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?",
        params![id]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn update_user(
    id: String,
    password: Option<String>,
    role: String,
    full_name: Option<String>,
    khmer_name: Option<String>,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    if let Some(pwd) = password {
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(pwd.as_bytes(), &salt)
            .map_err(|e| format!("Hash error: {}", e))?
            .to_string();

        pool.execute(
            "UPDATE users SET password_hash = ?, role = ?, full_name = ?, khmer_name = ?, updated_at = datetime('now') WHERE id = ?",
            params![
                hash,
                role,
                full_name.unwrap_or_default(),
                khmer_name.unwrap_or_default(),
                id
            ]
        )
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    } else {
        pool.execute(
            "UPDATE users SET role = ?, full_name = ?, khmer_name = ?, updated_at = datetime('now') WHERE id = ?",
            params![
                role,
                full_name.unwrap_or_default(),
                khmer_name.unwrap_or_default(),
                id
            ]
        )
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    }

    Ok(())
}

/// Lists all restaurants with their primary admin user (for super admin dashboard).
#[tauri::command]
pub async fn list_all_restaurants(
    pool: State<'_, Arc<Connection>>,
) -> Result<Vec<RestaurantSummary>, String> {
    let mut rows = pool.query(
        "SELECT r.id, r.name, r.khmer_name, r.address, r.phone, r.created_at,
                u.id, u.username, u.full_name
         FROM restaurants r
         LEFT JOIN users u ON u.restaurant_id = r.id AND u.role = 'admin' AND u.is_deleted = 0
         WHERE r.is_deleted = 0
         ORDER BY r.created_at DESC",
        ()
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let mut list = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        list.push(RestaurantSummary {
            id: row.get::<String>(0).unwrap_or_default(),
            name: row.get::<String>(1).unwrap_or_default(),
            khmer_name: row.get::<String>(2).ok(),
            address: row.get::<String>(3).ok(),
            phone: row.get::<String>(4).ok(),
            created_at: row.get::<String>(5).unwrap_or_default(),
            admin_id: row.get::<String>(6).ok(),
            admin_username: row.get::<String>(7).ok(),
            admin_full_name: row.get::<String>(8).ok(),
        });
    }
    Ok(list)
}

/// Creates a new restaurant and its owner admin account atomically.
#[tauri::command]
pub async fn create_restaurant_with_admin(
    restaurant_name: String,
    restaurant_address: Option<String>,
    restaurant_phone: Option<String>,
    admin_username: String,
    admin_password: String,
    admin_full_name: Option<String>,
    pool: State<'_, Arc<Connection>>,
) -> Result<String, String> {
    let restaurant_id = uuid::Uuid::new_v4().to_string();
    let admin_id = uuid::Uuid::new_v4().to_string();

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(admin_password.as_bytes(), &salt)
        .map_err(|e| format!("Hash error: {}", e))?
        .to_string();

    pool.execute(
        "INSERT INTO restaurants (id, name, address, phone, receipt_footer)
         VALUES (?, ?, ?, ?, 'Thank you for your visit!')",
        params![
            restaurant_id.clone(),
            restaurant_name,
            restaurant_address.unwrap_or_default(),
            restaurant_phone.unwrap_or_default()
        ]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    pool.execute(
        "INSERT INTO users (id, restaurant_id, username, password_hash, role, full_name)
         VALUES (?, ?, ?, ?, 'admin', ?)",
        params![
            admin_id,
            restaurant_id.clone(),
            admin_username,
            hash,
            admin_full_name.unwrap_or_default()
        ]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    Ok(restaurant_id)
}

/// Seeds the default super_admin account at startup if it does not exist.
/// Default credentials: superadmin / superadmin123
/// This is NOT a Tauri command — called from lib.rs setup.
pub async fn seed_super_admin(conn: &Arc<Connection>) {
    let mut rows = match conn.query(
        "SELECT 1 FROM users WHERE username = 'superadmin' AND is_deleted = 0 LIMIT 1",
        ()
    ).await {
        Ok(r) => r,
        Err(_) => return,
    };
    if rows.next().await.ok().flatten().is_some() {
        return; // Already exists — skip
    }

    let salt = SaltString::generate(&mut OsRng);
    let hash = match Argon2::default().hash_password(b"superadmin123", &salt) {
        Ok(h) => h.to_string(),
        Err(_) => return,
    };

    let _ = conn.execute(
        "INSERT OR IGNORE INTO users (id, username, password_hash, role, full_name)
         VALUES ('user-super-admin-0000-0000-000000000001', 'superadmin', ?, 'super_admin', 'Super Administrator')",
        params![hash]
    ).await;
    println!("[Auth] Super admin seeded — username: superadmin  password: superadmin123");
}

/// Allows Superadmin to manually override restaurant admin details without entering the restaurant
#[tauri::command]
pub async fn superadmin_update_admin(
    admin_id: String,
    new_username: Option<String>,
    new_password: Option<String>,
    new_full_name: Option<String>,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    
    // First, fetch the existing data so we can reuse it if fields are omitted
    let mut rows = pool.query(
        "SELECT username, password_hash, full_name FROM users WHERE id = ? AND role = 'admin'",
        params![admin_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let row = rows.next().await.map_err(|e| e.to_string())?
        .ok_or_else(|| "Admin account not found".to_string())?;

    let existing_username: String = row.get(0).unwrap_or_default();
    let existing_hash: String = row.get(1).unwrap_or_default();
    let existing_fullname: Option<String> = row.get(2).ok();

    // Determine target values
    let final_username = new_username.unwrap_or(existing_username);
    let final_fullname = new_full_name.or(existing_fullname).unwrap_or_default();

    let final_hash = if let Some(pwd) = new_password {
        let salt = SaltString::generate(&mut OsRng);
        Argon2::default()
            .hash_password(pwd.as_bytes(), &salt)
            .map_err(|e| format!("Hash error: {}", e))?
            .to_string()
    } else {
        existing_hash
    };

    pool.execute(
        "UPDATE users SET username = ?, password_hash = ?, full_name = ?, updated_at = datetime('now') WHERE id = ?",
        params![final_username, final_hash, final_fullname, admin_id]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn update_superadmin_profile(
    superadmin_id: String,
    new_username: Option<String>,
    new_password: Option<String>,
    new_full_name: Option<String>,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    let mut rows = pool.query(
        "SELECT username, password_hash, full_name FROM users WHERE id = ? AND role = 'super_admin'",
        params![superadmin_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let row = rows.next().await.map_err(|e| e.to_string())?
        .ok_or_else(|| "Super admin account not found".to_string())?;

    let existing_username: String = row.get(0).unwrap_or_default();
    let existing_hash: String = row.get(1).unwrap_or_default();
    let existing_fullname: Option<String> = row.get(2).ok();

    let final_username = new_username.unwrap_or(existing_username);
    let final_fullname = new_full_name.or(existing_fullname).unwrap_or_default();

    let final_hash = if let Some(pwd) = new_password {
        let salt = SaltString::generate(&mut OsRng);
        Argon2::default()
            .hash_password(pwd.as_bytes(), &salt)
            .map_err(|e| format!("Hash error: {}", e))?
            .to_string()
    } else {
        existing_hash
    };

    pool.execute(
        "UPDATE users SET username = ?, password_hash = ?, full_name = ?, updated_at = datetime('now') WHERE id = ? AND role = 'super_admin'",
        params![final_username, final_hash, final_fullname, superadmin_id]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(())
}

#[derive(serde::Serialize)]
pub struct SuperadminUserView {
    pub id: String,
    pub restaurant_id: Option<String>,
    pub restaurant_name: Option<String>,
    pub username: String,
    pub role: String,
    pub full_name: Option<String>,
    pub created_at: String,
}

#[tauri::command]
pub async fn superadmin_get_all_users(
    pool: State<'_, Arc<Connection>>,
) -> Result<Vec<SuperadminUserView>, String> {
    let mut rows = pool.query(
        "SELECT u.id, u.restaurant_id, r.name, u.username, u.role, u.full_name, u.created_at
         FROM users u
         LEFT JOIN restaurants r ON u.restaurant_id = r.id AND r.is_deleted = 0
         WHERE u.is_deleted = 0
         ORDER BY r.name, u.role, u.username",
        ()
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let mut list = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        list.push(SuperadminUserView {
            id: row.get(0).unwrap_or_default(),
            restaurant_id: row.get(1).ok(),
            restaurant_name: row.get(2).ok(),
            username: row.get(3).unwrap_or_default(),
            role: row.get(4).unwrap_or_default(),
            full_name: row.get(5).ok(),
            created_at: row.get(6).unwrap_or_default(),
        });
    }
    
    Ok(list)
}
