use tauri::State;
use libsql::{Connection, params};
use std::sync::Arc;
use crate::models::{User, UserSession};
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
