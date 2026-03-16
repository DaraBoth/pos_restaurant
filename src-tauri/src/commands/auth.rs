use tauri::State;
use sqlx::SqlitePool;
use crate::models::{User, UserSession};
use argon2::{Argon2, PasswordHash, PasswordVerifier, PasswordHasher};
use argon2::password_hash::{SaltString, rand_core::OsRng};

#[tauri::command]
pub async fn login(
    username: String,
    password: String,
    pool: State<'_, SqlitePool>,
) -> Result<UserSession, String> {
    let user: Option<User> = sqlx::query_as(
        "SELECT id, restaurant_id, username, password_hash, role, full_name, khmer_name, is_deleted, created_at
         FROM users WHERE username = ? AND is_deleted = 0"
    )
    .bind(&username)
    .fetch_optional(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let user = user.ok_or_else(|| "Invalid username or password".to_string())?;

    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|_| "Invalid password hash".to_string())?;

    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| "Invalid username or password".to_string())?;

    Ok(UserSession {
        id: user.id,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        khmer_name: user.khmer_name,
    })
}

#[tauri::command]
pub async fn create_user(
    username: String,
    password: String,
    role: String,
    full_name: Option<String>,
    khmer_name: Option<String>,
    pool: State<'_, SqlitePool>,
) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Hash error: {}", e))?
        .to_string();

    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO users (id, restaurant_id, username, password_hash, role, full_name, khmer_name)
         VALUES (?, 'rest-00000000-0000-0000-0000-000000000001', ?, ?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&username)
    .bind(&hash)
    .bind(&role)
    .bind(&full_name)
    .bind(&khmer_name)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(id)
}

#[tauri::command]
pub async fn get_users(pool: State<'_, SqlitePool>) -> Result<Vec<crate::models::User>, String> {
    let users: Vec<User> = sqlx::query_as(
        "SELECT id, restaurant_id, username, password_hash, role, full_name, khmer_name, is_deleted, created_at
         FROM users WHERE is_deleted = 0 ORDER BY role, username"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(users)
}

#[tauri::command]
pub async fn delete_user(id: String, pool: State<'_, SqlitePool>) -> Result<(), String> {
    sqlx::query("UPDATE users SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}
