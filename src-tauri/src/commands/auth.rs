use tauri::State;
use libsql::{Connection, params};
use std::sync::Arc;
use crate::db::RemoteDb;
use crate::models::{User, UserSession, RestaurantSummary};
use argon2::{Argon2, PasswordHash, PasswordVerifier, PasswordHasher};
use argon2::password_hash::{SaltString, rand_core::OsRng};

struct AuthRecord {
    id: String,
    restaurant_id: Option<String>,
    username: String,
    password_hash: String,
    role: String,
    full_name: Option<String>,
    khmer_name: Option<String>,
    created_at: String,
    updated_at: Option<String>,
}

async fn fetch_auth_record(conn: &Connection, username: &str) -> Result<Option<AuthRecord>, String> {
    let mut rows = conn.query(
        "SELECT id, restaurant_id, username, password_hash, role, full_name, khmer_name, created_at, updated_at
         FROM users WHERE username = ? AND is_deleted = 0",
        params![username.to_string()]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let Some(row) = rows.next().await.map_err(|e| e.to_string())? else {
        return Ok(None);
    };

    Ok(Some(AuthRecord {
        id: row.get::<String>(0).unwrap_or_default(),
        restaurant_id: row.get::<String>(1).ok(),
        username: row.get::<String>(2).unwrap_or_default(),
        password_hash: row.get::<String>(3).unwrap_or_default(),
        role: row.get::<String>(4).unwrap_or_default(),
        full_name: row.get::<String>(5).ok(),
        khmer_name: row.get::<String>(6).ok(),
        created_at: row.get::<String>(7).unwrap_or_default(),
        updated_at: row.get::<String>(8).ok(),
    }))
}

fn verify_login_password(password: &str, password_hash: &str) -> Result<(), String> {
    let parsed_hash = PasswordHash::new(password_hash)
        .map_err(|_| "Invalid password hash".to_string())?;

    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| "Invalid username or password".to_string())
}

fn to_user_session(record: &AuthRecord) -> UserSession {
    UserSession {
        id: record.id.clone(),
        username: record.username.clone(),
        role: record.role.clone(),
        full_name: record.full_name.clone(),
        khmer_name: record.khmer_name.clone(),
        restaurant_id: record.restaurant_id.clone(),
    }
}

fn is_superadmin_username(username: &str) -> bool {
    username.trim().eq_ignore_ascii_case("superadmin")
}

fn is_superadmin_role(role: &str) -> bool {
    role.trim().eq_ignore_ascii_case("super_admin")
}

fn first_device_login_message() -> String {
    "Cloud login is unavailable right now. If this is your first login on a new device, connect to the internet and verify DATABASE_URL and AUTH_TOKEN for the cloud database before trying again.".to_string()
}

fn namespace_not_found_message() -> String {
    "Cloud database namespace was not found. Please verify DATABASE_URL and AUTH_TOKEN in your app configuration (or contact service team).".to_string()
}

fn is_remote_auth_error(message: &str) -> bool {
    let lower = message.to_lowercase();
    lower.contains("hrana")
        || lower.contains("namespace")
        || lower.contains("remote")
        || lower.contains("auth token")
        || lower.contains("cloud sync error")
        || lower.contains("database error")
}

async fn ensure_remote_superadmin(remote: &Connection) -> Result<(), String> {
    let mut rows = remote.query(
        "SELECT id, role, is_deleted FROM users WHERE username = 'superadmin' LIMIT 1",
        ()
    ).await.map_err(|e| format!("Cloud sync error: {}", e))?;

    if let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        let id = row.get::<String>(0).unwrap_or_else(|_| "user-super-admin-0000-0000-000000000001".to_string());
        let role = row.get::<String>(1).unwrap_or_else(|_| "super_admin".to_string());
        let is_deleted = row.get::<i64>(2).unwrap_or(0);

        if role != "super_admin" || is_deleted != 0 {
            remote.execute(
                "UPDATE users
                 SET role = 'super_admin', is_deleted = 0, updated_at = datetime('now')
                 WHERE id = ?",
                params![id]
            ).await.map_err(|e| format!("Cloud sync error: {}", e))?;
            println!("[Auth] Cloud superadmin account normalized.");
        }
        return Ok(());
    }

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(b"superadmin123", &salt)
        .map_err(|e| format!("Hash error: {}", e))?
        .to_string();

    remote.execute(
        "INSERT INTO users (id, restaurant_id, username, password_hash, role, full_name, is_deleted, created_at, updated_at)
         VALUES ('user-super-admin-0000-0000-000000000001', NULL, 'superadmin', ?, 'super_admin', 'Super Administrator', 0, datetime('now'), datetime('now'))",
        params![hash]
    ).await.map_err(|e| format!("Cloud sync error: {}", e))?;

    println!("[Auth] Cloud superadmin account created (default password: superadmin123).");
    Ok(())
}

async fn seed_local_user_from_remote(local: &Connection, record: &AuthRecord) -> Result<(), String> {
    local.execute(
        "INSERT OR REPLACE INTO users (id, restaurant_id, username, password_hash, role, full_name, khmer_name, is_deleted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)",
        params![
            record.id.clone(),
            record.restaurant_id.clone().unwrap_or_default(),
            record.username.clone(),
            record.password_hash.clone(),
            record.role.clone(),
            record.full_name.clone().unwrap_or_default(),
            record.khmer_name.clone().unwrap_or_default(),
            record.created_at.clone(),
            record.updated_at.clone().unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string())
        ]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(())
}

async fn seed_local_restaurant_from_remote(
    local: &Connection,
    remote: &Connection,
    restaurant_id: &str,
) -> Result<(), String> {
    let mut rows = remote.query(
        "SELECT id, name, khmer_name, tin, address, address_kh, phone, website, vat_number, receipt_footer, logo_path, license_expires_at, license_support_contact, is_deleted, created_at, updated_at
         FROM restaurants WHERE id = ? AND is_deleted = 0",
        params![restaurant_id.to_string()]
    )
    .await
    .map_err(|e| format!("Cloud sync error: {}", e))?;

    let Some(row) = rows.next().await.map_err(|e| e.to_string())? else {
        return Ok(());
    };

    local.execute(
        "INSERT OR REPLACE INTO restaurants (id, name, khmer_name, tin, address, address_kh, phone, website, vat_number, receipt_footer, logo_path, license_expires_at, license_support_contact, is_deleted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            row.get::<String>(0).unwrap_or_default(),
            row.get::<String>(1).unwrap_or_default(),
            row.get::<String>(2).unwrap_or_default(),
            row.get::<String>(3).unwrap_or_default(),
            row.get::<String>(4).unwrap_or_default(),
            row.get::<String>(5).unwrap_or_default(),
            row.get::<String>(6).unwrap_or_default(),
            row.get::<String>(7).unwrap_or_default(),
            row.get::<String>(8).unwrap_or_default(),
            row.get::<String>(9).unwrap_or_default(),
            row.get::<String>(10).unwrap_or_default(),
            row.get::<String>(11).unwrap_or_default(),
            row.get::<String>(12).unwrap_or_default(),
            row.get::<i64>(13).unwrap_or(0),
            row.get::<String>(14).unwrap_or_default(),
            row.get::<String>(15).unwrap_or_default()
        ]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    local.execute(
        "DELETE FROM _sync_state WHERE restaurant_id = ?",
        params![restaurant_id.to_string()]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    Ok(())
}

async fn mirror_restaurant_with_admin_to_remote(
    remote: Option<&Arc<Connection>>,
    restaurant_id: &str,
    restaurant_name: &str,
    restaurant_address: &str,
    restaurant_phone: &str,
    license_expires_at: &str,
    license_support_contact: &str,
    admin_id: &str,
    admin_username: &str,
    admin_password_hash: &str,
    admin_full_name: &str,
) -> Result<(), String> {
    let Some(remote) = remote else {
        return Ok(());
    };

    remote.execute(
        "INSERT OR REPLACE INTO restaurants (id, name, address, phone, receipt_footer, license_expires_at, license_support_contact, updated_at)
         VALUES (?, ?, ?, ?, 'Thank you for your visit!', ?, ?, datetime('now'))",
        params![
            restaurant_id.to_string(),
            restaurant_name.to_string(),
            restaurant_address.to_string(),
            restaurant_phone.to_string(),
            license_expires_at.to_string(),
            license_support_contact.to_string()
        ]
    ).await.map_err(|e| format!("Cloud sync error: {}", e))?;

    remote.execute(
        "INSERT OR REPLACE INTO users (id, restaurant_id, username, password_hash, role, full_name, updated_at)
         VALUES (?, ?, ?, ?, 'admin', ?, datetime('now'))",
        params![
            admin_id.to_string(),
            restaurant_id.to_string(),
            admin_username.to_string(),
            admin_password_hash.to_string(),
            admin_full_name.to_string()
        ]
    ).await.map_err(|e| format!("Cloud sync error: {}", e))?;

    Ok(())
}

async fn mirror_user_update_to_remote(
    remote: Option<&Arc<Connection>>,
    user_id: &str,
    restaurant_id: Option<&str>,
    username: &str,
    password_hash: &str,
    role: &str,
    full_name: &str,
) -> Result<(), String> {
    let Some(remote) = remote else {
        return Ok(());
    };

    remote.execute(
        "INSERT OR IGNORE INTO users (id, restaurant_id, username, password_hash, role, full_name, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
        params![
            user_id.to_string(),
            restaurant_id.unwrap_or_default().to_string(),
            username.to_string(),
            password_hash.to_string(),
            role.to_string(),
            full_name.to_string()
        ]
    ).await.map_err(|e| format!("Cloud sync error: {}", e))?;

    remote.execute(
        "UPDATE users
         SET restaurant_id = ?, username = ?, password_hash = ?, role = ?, full_name = ?, updated_at = datetime('now')
         WHERE id = ?",
        params![
            restaurant_id.unwrap_or_default().to_string(),
            username.to_string(),
            password_hash.to_string(),
            role.to_string(),
            full_name.to_string(),
            user_id.to_string()
        ]
    ).await.map_err(|e| format!("Cloud sync error: {}", e))?;

    Ok(())
}

async fn purge_restaurant_data(conn: &Connection, restaurant_id: &str) -> Result<(), String> {
    let statements = [
        "DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)",
        "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)",
        "DELETE FROM inventory_logs WHERE restaurant_id = ?",
        "DELETE FROM table_sessions WHERE restaurant_id = ?",
        "DELETE FROM orders WHERE restaurant_id = ?",
        "DELETE FROM inventory_items WHERE restaurant_id = ?",
        "DELETE FROM products WHERE restaurant_id = ?",
        "DELETE FROM categories WHERE restaurant_id = ?",
        "DELETE FROM floor_tables WHERE restaurant_id = ?",
        "DELETE FROM exchange_rates WHERE restaurant_id = ?",
        "DELETE FROM users WHERE restaurant_id = ?",
        "DELETE FROM _sync_state WHERE restaurant_id = ?",
        "DELETE FROM restaurants WHERE id = ?",
    ];

    for sql in statements {
        conn.execute(sql, params![restaurant_id.to_string()])
            .await
            .map_err(|e| format!("Database error: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn login(
    username: String,
    password: String,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<UserSession, String> {
    let superadmin_login = is_superadmin_username(&username);

    // Non-superadmin users can still login offline from local cache.
    if !superadmin_login {
        if let Some(local_record) = fetch_auth_record(&pool, &username).await? {
            if verify_login_password(&password, &local_record.password_hash).is_ok() {
                return Ok(to_user_session(&local_record));
            }
        }
    }

    let Some(remote_conn) = remote.0.as_ref() else {
        if superadmin_login {
            return Err("Superadmin login requires internet connection and cloud authentication.".to_string());
        }
        return Err("Invalid username or password. If this is your first login on a new device, connect to the internet and try again.".to_string());
    };

    let remote_record = match fetch_auth_record(remote_conn, &username).await {
        Ok(record) => record,
        Err(error) if error.to_lowercase().contains("namespace") => {
            eprintln!("[Auth] Remote login failed (namespace): {}", error);
            return Err(namespace_not_found_message());
        }
        Err(error) if is_remote_auth_error(&error) => {
            eprintln!("[Auth] Remote login failed: {}", error);
            return Err(first_device_login_message());
        }
        Err(error) => return Err(error),
    };

    let Some(remote_record) = remote_record else {
        return Err("Invalid username or password".to_string());
    };

    verify_login_password(&password, &remote_record.password_hash)?;

    // Superadmin is intentionally cloud-only and must not be cached locally.
    if is_superadmin_username(&remote_record.username) || is_superadmin_role(&remote_record.role) {
        return Ok(to_user_session(&remote_record));
    }

    seed_local_user_from_remote(&pool, &remote_record).await?;

    if let Some(restaurant_id) = remote_record.restaurant_id.as_deref() {
        match seed_local_restaurant_from_remote(&pool, remote_conn, restaurant_id).await {
            Ok(()) => {}
            Err(error) if error.to_lowercase().contains("namespace") => {
                eprintln!("[Auth] Remote restaurant seed failed (namespace): {}", error);
                return Err(namespace_not_found_message());
            }
            Err(error) if is_remote_auth_error(&error) => {
                eprintln!("[Auth] Remote restaurant seed failed: {}", error);
                return Err(first_device_login_message());
            }
            Err(error) => return Err(error),
        }
    }

    Ok(to_user_session(&remote_record))
}

#[tauri::command]
pub async fn create_user(
    username: String,
    password: String,
    role: String,
    full_name: Option<String>,
    khmer_name: Option<String>,
    restaurant_id: String,
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
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            id.clone(),
            restaurant_id,
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
pub async fn get_users(restaurant_id: String, pool: State<'_, Arc<Connection>>) -> Result<Vec<User>, String> {
    let mut rows = pool.query(
        "SELECT id, restaurant_id, username, password_hash, role, full_name, khmer_name, is_deleted, created_at
         FROM users WHERE is_deleted = 0 AND restaurant_id = ? ORDER BY role, username",
        params![restaurant_id]
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
pub async fn delete_user(id: String, restaurant_id: String, pool: State<'_, Arc<Connection>>) -> Result<(), String> {
    pool.execute(
        "UPDATE users SET is_deleted = 1, updated_at = datetime('now') WHERE id = ? AND restaurant_id = ?",
        params![id, restaurant_id]
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
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    if let Some(pwd) = password {
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(pwd.as_bytes(), &salt)
            .map_err(|e| format!("Hash error: {}", e))?
            .to_string();

        pool.execute(
            "UPDATE users SET password_hash = ?, role = ?, full_name = ?, khmer_name = ?, updated_at = datetime('now') WHERE id = ? AND restaurant_id = ?",
            params![
                hash,
                role,
                full_name.unwrap_or_default(),
                khmer_name.unwrap_or_default(),
                id,
                restaurant_id
            ]
        )
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    } else {
        pool.execute(
            "UPDATE users SET role = ?, full_name = ?, khmer_name = ?, updated_at = datetime('now') WHERE id = ? AND restaurant_id = ?",
            params![
                role,
                full_name.unwrap_or_default(),
                khmer_name.unwrap_or_default(),
                id,
                restaurant_id
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
        "SELECT r.id, r.name, r.khmer_name, r.address, r.phone, r.license_expires_at, r.license_support_contact, r.created_at,
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
            license_expires_at: row.get::<String>(5).ok(),
            license_support_contact: row.get::<String>(6).ok(),
            created_at: row.get::<String>(7).unwrap_or_default(),
            admin_id: row.get::<String>(8).ok(),
            admin_username: row.get::<String>(9).ok(),
            admin_full_name: row.get::<String>(10).ok(),
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
    license_expires_at: Option<String>,
    license_support_contact: Option<String>,
    admin_username: String,
    admin_password: String,
    admin_full_name: Option<String>,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<String, String> {
    let restaurant_id = uuid::Uuid::new_v4().to_string();
    let admin_id = uuid::Uuid::new_v4().to_string();

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(admin_password.as_bytes(), &salt)
        .map_err(|e| format!("Hash error: {}", e))?
        .to_string();

    let address = restaurant_address.unwrap_or_default();
    let phone = restaurant_phone.unwrap_or_default();
    let expires_at = license_expires_at.unwrap_or_default();
    let support_contact = license_support_contact.unwrap_or_default();
    let full_name = admin_full_name.unwrap_or_default();

    pool.execute(
        "INSERT INTO restaurants (id, name, address, phone, receipt_footer, license_expires_at, license_support_contact)
         VALUES (?, ?, ?, ?, 'Thank you for your visit!', ?, ?)",
        params![
            restaurant_id.clone(),
            restaurant_name.clone(),
            address.clone(),
            phone.clone(),
            expires_at.clone(),
            support_contact.clone()
        ]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    pool.execute(
        "INSERT INTO users (id, restaurant_id, username, password_hash, role, full_name)
         VALUES (?, ?, ?, ?, 'admin', ?)",
        params![
            admin_id.clone(),
            restaurant_id.clone(),
            admin_username.clone(),
            hash.clone(),
            full_name.clone()
        ]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    mirror_restaurant_with_admin_to_remote(
        remote.0.as_ref(),
        &restaurant_id,
        &restaurant_name,
        &address,
        &phone,
        &expires_at,
        &support_contact,
        &admin_id,
        &admin_username,
        &hash,
        &full_name,
    ).await?;

    Ok(restaurant_id)
}

/// Seeds the default super_admin account at startup if it does not exist.
/// Default credentials: superadmin / superadmin123
/// This is NOT a Tauri command — called from lib.rs setup.
pub async fn seed_super_admin(local: &Arc<Connection>, remote: Option<&Arc<Connection>>) {
    // Enforce cloud-only superadmin: remove any local cached superadmin account.
    let _ = local.execute(
        "DELETE FROM users WHERE username = 'superadmin'",
        ()
    ).await;

    if let Some(remote_conn) = remote {
        if let Err(e) = ensure_remote_superadmin(remote_conn).await {
            eprintln!("[Auth] Could not ensure cloud superadmin account: {}", e);
        }
    }

    // Seed default exchange rate locally (without requiring a local superadmin user).
    let _ = local.execute(
        "INSERT OR IGNORE INTO exchange_rates (id, rate, effective_from, created_by, restaurant_id)
         VALUES ('rate-00000000-0000-0000-0000-000000000001', 4100.0, datetime('now'), NULL, 'rest-00000000-0000-0000-0000-000000000001')",
        ()
    ).await;

    println!("[Auth] Superadmin local cache cleared; default exchange rate ensured.");
}

/// Allows Superadmin to manually override restaurant admin details without entering the restaurant
#[tauri::command]
pub async fn superadmin_update_admin(
    admin_id: String,
    new_username: Option<String>,
    new_password: Option<String>,
    new_full_name: Option<String>,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<(), String> {
    
    // First, fetch the existing data so we can reuse it if fields are omitted
    let mut rows = pool.query(
        "SELECT restaurant_id, username, password_hash, full_name FROM users WHERE id = ? AND role = 'admin'",
        params![admin_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let row = rows.next().await.map_err(|e| e.to_string())?
        .ok_or_else(|| "Admin account not found".to_string())?;

    let restaurant_id: Option<String> = row.get(0).ok();
    let existing_username: String = row.get(1).unwrap_or_default();
    let existing_hash: String = row.get(2).unwrap_or_default();
    let existing_fullname: Option<String> = row.get(3).ok();

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
        params![final_username.clone(), final_hash.clone(), final_fullname.clone(), admin_id.clone()]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    mirror_user_update_to_remote(
        remote.0.as_ref(),
        &admin_id,
        restaurant_id.as_deref(),
        &final_username,
        &final_hash,
        "admin",
        &final_fullname,
    ).await?;

    Ok(())
}

#[tauri::command]
pub async fn update_superadmin_profile(
    superadmin_id: String,
    new_username: Option<String>,
    new_password: Option<String>,
    new_full_name: Option<String>,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
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
        params![final_username.clone(), final_hash.clone(), final_fullname.clone(), superadmin_id.clone()]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    mirror_user_update_to_remote(
        remote.0.as_ref(),
        &superadmin_id,
        None,
        &final_username,
        &final_hash,
        "super_admin",
        &final_fullname,
    ).await?;

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

#[tauri::command]
pub async fn superadmin_move_user(
    user_id: String,
    new_restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<(), String> {
    let mut rows = pool.query(
        "SELECT username, password_hash, role, full_name FROM users WHERE id = ? AND is_deleted = 0",
        params![user_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let row = rows.next().await.map_err(|e| e.to_string())?
        .ok_or_else(|| "User not found".to_string())?;

    let username: String = row.get(0).unwrap_or_default();
    let password_hash: String = row.get(1).unwrap_or_default();
    let role: String = row.get(2).unwrap_or_default();
    let full_name: String = row.get::<String>(3).unwrap_or_default();

    pool.execute(
        "UPDATE users SET restaurant_id = ?, updated_at = datetime('now') WHERE id = ?",
        params![new_restaurant_id.clone(), user_id.clone()]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    mirror_user_update_to_remote(
        remote.0.as_ref(),
        &user_id,
        Some(&new_restaurant_id),
        &username,
        &password_hash,
        &role,
        &full_name,
    ).await?;

    Ok(())
}

#[tauri::command]
pub async fn superadmin_create_restaurant_user(
    restaurant_id: String,
    username: String,
    password: String,
    role: String,
    full_name: Option<String>,
    khmer_name: Option<String>,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Hash error: {}", e))?
        .to_string();

    let user_id = uuid::Uuid::new_v4().to_string();
    let final_full_name = full_name.unwrap_or_default();
    let final_khmer_name = khmer_name.unwrap_or_default();

    pool.execute(
        "INSERT INTO users (id, restaurant_id, username, password_hash, role, full_name, khmer_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            user_id.clone(),
            restaurant_id.clone(),
            username.clone(),
            hash.clone(),
            role.clone(),
            final_full_name.clone(),
            final_khmer_name.clone()
        ]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let Some(remote_conn) = remote.0.as_ref() else {
        return Ok(user_id);
    };

    remote_conn.execute(
        "INSERT OR REPLACE INTO users (id, restaurant_id, username, password_hash, role, full_name, khmer_name, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
        params![
            user_id.clone(),
            restaurant_id,
            username,
            hash,
            role,
            final_full_name,
            final_khmer_name
        ]
    ).await.map_err(|e| format!("Cloud sync error: {}", e))?;

    Ok(user_id)
}

#[tauri::command]
pub async fn delete_restaurant(
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<(), String> {
    purge_restaurant_data(&pool, &restaurant_id).await?;

    if let Some(remote_conn) = remote.0.as_ref() {
        purge_restaurant_data(remote_conn, &restaurant_id).await?;
    }

    Ok(())
}
