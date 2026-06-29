#![allow(clippy::too_many_arguments)]

use tauri::{State, Manager};
use libsql::{Connection, params};
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use crate::db::RemoteDb;
use crate::commands::rbac;
use crate::models::{User, UserSession, RestaurantSummary};
use argon2::{Argon2, PasswordHash, PasswordVerifier, PasswordHasher};
use argon2::password_hash::{SaltString, rand_core::OsRng};

/// Wrapper that surfaces whether `list_all_restaurants` answered from the cloud
/// or fell back to local. The super-admin UI shows a warning badge when
/// `source == "local"` so it never silently displays a stale subset.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestaurantListResponse {
    pub restaurants: Vec<RestaurantSummary>,
    pub source: String,                // "remote" | "local"
    pub remote_error: Option<String>,  // populated when the remote attempt failed
}

struct AuthRecord {
    id: String,
    restaurant_id: Option<String>,
    username: String,
    password_hash: String,
    role: String,
    full_name: Option<String>,
    khmer_name: Option<String>,
    phone: Option<String>,
    created_at: String,
    updated_at: Option<String>,
}

async fn fetch_auth_record(conn: &Connection, username: &str) -> Result<Option<AuthRecord>, String> {
    let mut rows = conn.query(
        "SELECT id, restaurant_id, username, password_hash, role, full_name, khmer_name, phone, created_at, updated_at
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
        phone: row.get::<String>(7).ok(),
        created_at: row.get::<String>(8).unwrap_or_default(),
        updated_at: row.get::<String>(9).ok(),
    }))
}

fn verify_login_password(password: &str, password_hash: &str) -> Result<(), String> {
    let parsed_hash = PasswordHash::new(password_hash)
        .map_err(|_| "Invalid password hash".to_string())?;

    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| "Invalid username or password".to_string())
}

// Failed-attempt lockout (shared-terminal brute-force guard).
const MAX_FAILED_LOGINS: i64 = 5;
// Lock duration is applied directly in SQL as '+15 minutes' (see record_failed_login).

/// Minutes remaining on an active lock for `username` on the local DB, or None if not locked.
async fn lock_minutes_remaining(conn: &Connection, username: &str) -> Option<i64> {
    let mut rows = conn.query(
        "SELECT CASE
                    WHEN locked_until IS NOT NULL AND locked_until > datetime('now','localtime')
                    THEN CAST((julianday(locked_until) - julianday('now','localtime')) * 1440 AS INTEGER) + 1
                    ELSE 0
                END
         FROM users WHERE username = ? AND is_deleted = 0",
        params![username.to_string()]
    ).await.ok()?;
    let row = rows.next().await.ok().flatten()?;
    let mins = row.get::<i64>(0).unwrap_or(0);
    if mins > 0 { Some(mins) } else { None }
}

/// Records a wrong-password attempt; locks the account once the threshold is hit.
/// Returns Some(minutes) when the account is (now) locked. No-op if the user has no local row.
async fn record_failed_login(conn: &Connection, username: &str) -> Option<i64> {
    let _ = conn.execute(
        "UPDATE users
            SET failed_login_attempts = failed_login_attempts + 1,
                locked_until = CASE WHEN failed_login_attempts + 1 >= ?
                    THEN datetime('now','localtime','+15 minutes') ELSE locked_until END,
                updated_at = datetime('now')
          WHERE username = ? AND is_deleted = 0",
        params![MAX_FAILED_LOGINS, username.to_string()]
    ).await;
    lock_minutes_remaining(conn, username).await
}

/// Clears the failed-attempt counter and lock after a successful login.
async fn reset_login_attempts(conn: &Connection, username: &str) {
    let _ = conn.execute(
        "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = datetime('now')
          WHERE username = ? AND is_deleted = 0 AND (failed_login_attempts > 0 OR locked_until IS NOT NULL)",
        params![username.to_string()]
    ).await;
}

fn account_locked_message(minutes: i64) -> String {
    format!("Account locked. Too many failed attempts. Try again in {} minutes.", minutes.max(1))
}

fn to_user_session(record: &AuthRecord) -> UserSession {
    UserSession {
        id: record.id.clone(),
        username: record.username.clone(),
        role: rbac::normalize_role_for_session(&record.role),
        full_name: record.full_name.clone(),
        khmer_name: record.khmer_name.clone(),
        phone: record.phone.clone(),
        restaurant_id: record.restaurant_id.clone(),
    }
}

fn is_superadmin_username(username: &str) -> bool {
    username.trim().eq_ignore_ascii_case("superadmin")
}

fn is_superadmin_role(role: &str) -> bool {
    role.trim().eq_ignore_ascii_case("super_admin")
}

async fn fetch_restaurant_name(pool: &Connection, restaurant_id: &str) -> Option<String> {
    let mut rows = pool.query(
        "SELECT name FROM restaurants WHERE id = ? LIMIT 1",
        params![restaurant_id]
    ).await.ok()?;
    rows.next().await.ok()??.get::<String>(0).ok()
}

fn set_window_title(app: &tauri::AppHandle, title: &str) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_title(title);
    }
}

#[tauri::command]
pub fn reset_window_title(app: tauri::AppHandle) {
    set_window_title(&app, "DineOS");
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
        "SELECT 1 FROM users WHERE username = 'superadmin' AND is_deleted = 0 LIMIT 1",
        ()
    ).await.map_err(|e| format!("Cloud sync error: {}", e))?;

    if rows.next().await.map_err(|e| e.to_string())?.is_some() {
        println!("[Auth] Cloud superadmin account already exists.");
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
        "INSERT INTO users (id, restaurant_id, username, password_hash, role, full_name, khmer_name, phone, is_deleted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            restaurant_id = excluded.restaurant_id,
            username = excluded.username,
            password_hash = excluded.password_hash,
            role = excluded.role,
            full_name = excluded.full_name,
            khmer_name = excluded.khmer_name,
            phone = excluded.phone,
            is_deleted = excluded.is_deleted,
            updated_at = excluded.updated_at",
        params![
            record.id.clone(),
            record.restaurant_id.clone(),
            record.username.clone(),
            record.password_hash.clone(),
            record.role.clone(),
            record.full_name.clone().unwrap_or_default(),
            record.khmer_name.clone().unwrap_or_default(),
            record.phone.clone().unwrap_or_default(),
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
        return Err(format!("Business profile (ID: {}) not found in cloud database.", restaurant_id));
    };

    local.execute(
        "INSERT INTO restaurants (id, name, khmer_name, tin, address, address_kh, phone, website, vat_number, receipt_footer, logo_path, license_expires_at, license_support_contact, is_deleted, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            khmer_name = excluded.khmer_name,
            tin = excluded.tin,
            address = excluded.address,
            address_kh = excluded.address_kh,
            phone = excluded.phone,
            website = excluded.website,
            vat_number = excluded.vat_number,
            receipt_footer = excluded.receipt_footer,
            logo_path = excluded.logo_path,
            license_expires_at = excluded.license_expires_at,
            license_support_contact = excluded.license_support_contact,
            is_deleted = excluded.is_deleted,
            updated_at = excluded.updated_at",
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
    business_type: &str,
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
        "INSERT OR REPLACE INTO restaurants (id, name, address, phone, receipt_footer, business_type, license_expires_at, license_support_contact, updated_at)
         VALUES (?, ?, ?, ?, 'Thank you for your visit!', ?, ?, ?, datetime('now'))",
        params![
            restaurant_id.to_string(),
            restaurant_name.to_string(),
            restaurant_address.to_string(),
            restaurant_phone.to_string(),
            business_type.to_string(),
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
    app: tauri::AppHandle,
) -> Result<UserSession, String> {
    let superadmin_login = is_superadmin_username(&username);

    // ── Lockout guard (skip superadmin — cloud-only, must never be locked out) ──
    if !superadmin_login
        && let Some(mins) = lock_minutes_remaining(&pool, &username).await
    {
        return Err(account_locked_message(mins));
    }

    // ── Local-first check (for returning users who have already logged in once) ──
    // We do this for ALL non-superadmin users regardless of internet state.
    // If local DB errors (e.g. pending migration), we log and fall through gracefully.
    let mut local_password_mismatch = false;
    if !superadmin_login {
        match fetch_auth_record(&pool, &username).await {
            Ok(Some(local_record)) => {
                if verify_login_password(&password, &local_record.password_hash).is_ok() {
                    // ✅ Known user, correct password — allow offline login
                    reset_login_attempts(&pool, &username).await;
                    println!("[Auth] Local login granted for '{}'", username);
                    if let Some(rid) = &local_record.restaurant_id
                        && let Some(name) = fetch_restaurant_name(&pool, rid).await
                    {
                        set_window_title(&app, &format!("{} - DineOS", name));
                    }
                    return Ok(to_user_session(&local_record));
                }
                // Known user but password doesn't match local hash.
                // Don't immediately reject — the password may have been changed via
                // the superadmin panel (which writes to remote) and the sync hasn't
                // propagated the new hash to this device yet.
                // Fall through to remote check below if we are online.
                println!("[Auth] Local password mismatch for '{}', will try remote.", username);
                local_password_mismatch = true;
            }
            Ok(None) => {
                // User not found locally — may be first login on this device.
                // Fall through to remote authentication below.
                println!("[Auth] No local record for '{}', attempting remote login.", username);
            }
            Err(local_err) => {
                // Local DB query failed (e.g. missing column from pending migration).
                // Log and fall through to remote; if offline this will also fail
                // but with a proper "requires internet" message.
                eprintln!("[Auth] Local DB lookup failed for '{}': {}", username, local_err);
            }
        }
    }

    // ── Remote connection required beyond this point ──
    let Some(remote_conn) = remote.0.as_ref() else {
        if superadmin_login {
            return Err("Superadmin login requires internet connection and cloud authentication.".to_string());
        }
        if local_password_mismatch {
            // Offline and local hash doesn't match — the user typed the wrong password.
            return Err(match record_failed_login(&pool, &username).await {
                Some(mins) => account_locked_message(mins),
                None => "Invalid username or password.".to_string(),
            });
        }
        return Err("No local account found on this device. An internet connection is required for first-time login. Please connect and try again.".to_string());
    };

    // Bootstrap cloud superadmin on-demand when someone tries to login as superadmin.
    if superadmin_login {
        match ensure_remote_superadmin(remote_conn).await {
            Ok(()) => {}
            Err(error) if error.to_lowercase().contains("namespace") => {
                eprintln!("[Auth] Cloud superadmin bootstrap failed (namespace): {}", error);
                return Err(namespace_not_found_message());
            }
            Err(error) if is_remote_auth_error(&error) => {
                eprintln!("[Auth] Cloud superadmin bootstrap failed: {}", error);
                return Err(first_device_login_message());
            }
            Err(error) => return Err(error),
        }
    }

    let remote_record = match fetch_auth_record(remote_conn, &username).await {
        Ok(record) => record,
        Err(error) if error.to_lowercase().contains("namespace") => {
            eprintln!("[Auth] Remote login failed (namespace): {}", error);
            return Err(namespace_not_found_message());
        }
        Err(error) if is_remote_auth_error(&error) => {
            eprintln!("[Auth] Remote login failed (unreachable): {}", error);
            // Give a helpful offline message — user may have lost connection
            return Err("Cannot reach cloud database. If you have logged in before, reconnect to the internet and try again. If this is your first login on this device, internet is required.".to_string());
        }
        Err(error) => return Err(error),
    };

    let Some(remote_record) = remote_record else {
        return Err("Invalid username or password".to_string());
    };

    if verify_login_password(&password, &remote_record.password_hash).is_err() {
        // Remote-confirmed wrong password — count it against the local lockout counter.
        if !superadmin_login
            && let Some(mins) = record_failed_login(&pool, &username).await
        {
            return Err(account_locked_message(mins));
        }
        return Err("Invalid username or password.".to_string());
    }

    // Successful remote auth — clear any prior failed-attempt state for this user.
    if !superadmin_login {
        reset_login_attempts(&pool, &username).await;
    }

    // Superadmin is intentionally cloud-only and must not be cached locally.
    if is_superadmin_username(&remote_record.username) || is_superadmin_role(&remote_record.role) {
        return Ok(to_user_session(&remote_record));
    }

    // 1. Seed restaurant FIRST to satisfy foreign key constraints
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

    // 2. Seed user SECOND (stores credentials locally for future offline logins)
    if let Err(e) = seed_local_user_from_remote(&pool, &remote_record).await {
        eprintln!("[Auth] Warning: failed to cache user locally: {}", e);
        // Non-fatal — user is still authenticated this session
    }

    if let Some(rid) = &remote_record.restaurant_id
        && let Some(name) = fetch_restaurant_name(&pool, rid).await
    {
        set_window_title(&app, &format!("{} - DineOS", name));
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
    remote: State<'_, RemoteDb>,
) -> Result<String, String> {
    let role = rbac::to_storage_role(&role);
    if role == "super_admin" {
        return Err("Permission denied: super_admin is an internal platform role".to_string());
    }

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Hash error: {}", e))?
        .to_string();

    let id = uuid::Uuid::new_v4().to_string();
    let final_full_name = full_name.unwrap_or_default();
    let final_khmer_name = khmer_name.unwrap_or_default();

    // Write to local DB first (with updated_at so the sync daemon can PUSH it to remote)
    pool.execute(
        "INSERT INTO users (id, restaurant_id, username, password_hash, role, full_name, khmer_name, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
        params![
            id.clone(),
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

    // Also mirror to remote immediately so the user can log in from any device
    // right away without waiting for the next 30-second sync cycle.
    if let Some(remote_conn) = remote.0.as_ref()
        && let Err(e) = remote_conn.execute(
            "INSERT OR IGNORE INTO users (id, restaurant_id, username, password_hash, role, full_name, khmer_name, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
            params![
                id.clone(),
                restaurant_id,
                username,
                hash,
                role,
                final_full_name,
                final_khmer_name
            ]
        ).await
    {
        // Non-fatal: the local insert succeeded, and the sync daemon will
        // push it to remote on the next cycle via the updated_at timestamp.
        eprintln!("[Auth] Warning: could not mirror new user to remote immediately: {}", e);
    }

    Ok(id)
}

#[tauri::command]
pub async fn get_users(restaurant_id: String, pool: State<'_, Arc<Connection>>) -> Result<Vec<User>, String> {
    let mut rows = pool.query(
        "SELECT id, restaurant_id, username, password_hash, role, full_name, khmer_name, phone, is_deleted, created_at, locked_until
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
            role: rbac::normalize_role_for_session(&row.get::<String>(4).unwrap_or_default()),
            full_name: row.get::<String>(5).ok(),
            khmer_name: row.get::<String>(6).ok(),
            phone: row.get::<String>(7).ok(),
            is_deleted: row.get::<i64>(8).unwrap_or(0),
            created_at: row.get::<String>(9).unwrap_or_default(),
            locked_until: row.get::<String>(10).ok(),
        });
    }

    Ok(users)
}

/// Admin action: clear a user's failed-attempt counter and lock immediately.
#[tauri::command]
pub async fn unlock_user(
    user_id: String,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    pool.execute(
        "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = datetime('now')
          WHERE id = ? AND restaurant_id = ?",
        params![user_id, restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_user(
    id: String,
    restaurant_id: String,
    actor_user_id: String,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<(), String> {
    let actor_role = rbac::require_delete_permission(&pool, &actor_user_id, &restaurant_id).await?;

    const SQL: &str = "UPDATE users SET is_deleted = 1, updated_at = datetime('now') WHERE id = ? AND restaurant_id = ?";

    pool.execute(SQL, params![id.clone(), restaurant_id.clone()])
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    // Mirror soft-delete to remote immediately
    if let Some(remote_conn) = remote.0.as_ref()
        && let Err(e) = remote_conn.execute(SQL, params![id.clone(), restaurant_id.clone()]).await
    {
        eprintln!("[Auth] Warning: could not mirror user deletion to remote: {}", e);
    }

    rbac::write_audit_log(
        &pool,
        &restaurant_id,
        &actor_user_id,
        &actor_role,
        "delete",
        "user",
        &id,
        None,
    ).await;

    Ok(())
}

#[tauri::command]
pub async fn update_user(
    id: String,
    password: Option<String>,
    role: String,
    full_name: Option<String>,
    khmer_name: Option<String>,
    phone: Option<String>,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<(), String> {
    let role = rbac::to_storage_role(&role);
    if role == "super_admin" {
        return Err("Permission denied: super_admin is an internal platform role".to_string());
    }

    let final_full_name = full_name.unwrap_or_default();
    let final_khmer_name = khmer_name.unwrap_or_default();
    let final_phone = phone.unwrap_or_default();

    if let Some(pwd) = password {
        let salt = SaltString::generate(&mut OsRng);
        let hash = Argon2::default()
            .hash_password(pwd.as_bytes(), &salt)
            .map_err(|e| format!("Hash error: {}", e))?
            .to_string();

        const SQL: &str = "UPDATE users SET password_hash = ?, role = ?, full_name = ?, khmer_name = ?, phone = ?, updated_at = datetime('now') WHERE id = ? AND restaurant_id = ?";

        pool.execute(SQL, params![
            hash.clone(), role.clone(), final_full_name.clone(),
            final_khmer_name.clone(), final_phone.clone(), id.clone(), restaurant_id.clone()
        ])
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        // Mirror to remote immediately so password change takes effect on all devices
        if let Some(remote_conn) = remote.0.as_ref()
            && let Err(e) = remote_conn.execute(SQL, params![
                hash, role, final_full_name, final_khmer_name, final_phone, id, restaurant_id
            ]).await
        {
            eprintln!("[Auth] Warning: could not mirror user update to remote: {}", e);
        }
    } else {
        const SQL: &str = "UPDATE users SET role = ?, full_name = ?, khmer_name = ?, phone = ?, updated_at = datetime('now') WHERE id = ? AND restaurant_id = ?";

        pool.execute(SQL, params![
            role.clone(), final_full_name.clone(), final_khmer_name.clone(),
            final_phone.clone(), id.clone(), restaurant_id.clone()
        ])
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        // Mirror to remote immediately
        if let Some(remote_conn) = remote.0.as_ref()
            && let Err(e) = remote_conn.execute(SQL, params![
                role, final_full_name, final_khmer_name, final_phone, id, restaurant_id
            ]).await
        {
            eprintln!("[Auth] Warning: could not mirror user update to remote: {}", e);
        }
    }

    Ok(())
}

/// Lists all restaurants with their primary admin user (for super admin dashboard).
/// Prefers the remote (cloud) DB so the superadmin sees every restaurant
/// regardless of which device it was created on. Returns a wrapper that names
/// the source ("remote" vs "local") and surfaces the remote error if any —
/// the UI shows a warning when source = "local" so the admin doesn't mistake
/// a sync gap for a true subset of restaurants. (Replaces an earlier silent
/// fallback that caused dev installs to show only locally-known restaurants.)
#[tauri::command]
pub async fn list_all_restaurants(
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<RestaurantListResponse, String> {
    const QUERY: &str =
        "SELECT r.id, r.name, r.khmer_name, r.address, r.phone, COALESCE(r.business_type, 'Restaurant/Pub/Bar'), r.license_expires_at, r.license_support_contact, r.created_at,
                u.id, u.username, u.full_name
         FROM restaurants r
         LEFT JOIN users u ON u.id = (
             SELECT id FROM users
             WHERE restaurant_id = r.id AND role = 'admin' AND is_deleted = 0
             ORDER BY created_at ASC
             LIMIT 1
         )
         WHERE r.is_deleted = 0
         ORDER BY r.created_at DESC";

    let (rows_result, source, remote_error) = if let Some(remote_conn) = remote.0.as_ref() {
        match remote_conn.query(QUERY, ()).await {
            Ok(r) => (Ok(r), "remote".to_string(), None),
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("stream not found") || msg.contains("stream error") || msg.contains("Hrana") {
                    println!("[Auth] Hrana stream expired. Attempting remote reconnection on-the-fly…");
                    if let Some(new_conn) = crate::db::reconnect_remote().await {
                        match new_conn.query(QUERY, ()).await {
                            Ok(r) => {
                                println!("[Auth] Remote reconnection query succeeded ✓");
                                (Ok(r), "remote".to_string(), None)
                            }
                            Err(e2) => {
                                let msg2 = e2.to_string();
                                eprintln!("[Auth] Remote list_all_restaurants failed after reconnection: {}", msg2);
                                (pool.query(QUERY, ()).await, "local".to_string(), Some(msg2))
                            }
                        }
                    } else {
                        eprintln!("[Auth] Reconnection failed, fallback to local: {}", msg);
                        (pool.query(QUERY, ()).await, "local".to_string(), Some(msg))
                    }
                } else {
                    eprintln!("[Auth] Remote list_all_restaurants failed, fallback to local: {}", msg);
                    (pool.query(QUERY, ()).await, "local".to_string(), Some(msg))
                }
            }
        }
    } else {
        (
            pool.query(QUERY, ()).await,
            "local".to_string(),
            Some("No remote connection configured — running offline.".to_string()),
        )
    };

    let mut rows = rows_result.map_err(|e| format!("Database error: {}", e))?;

    let mut restaurants = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        restaurants.push(RestaurantSummary {
            id: row.get::<String>(0).unwrap_or_default(),
            name: row.get::<String>(1).unwrap_or_default(),
            khmer_name: row.get::<String>(2).ok(),
            address: row.get::<String>(3).ok(),
            phone: row.get::<String>(4).ok(),
            business_type: row.get::<String>(5).ok(),
            license_expires_at: row.get::<String>(6).ok(),
            license_support_contact: row.get::<String>(7).ok(),
            created_at: row.get::<String>(8).unwrap_or_default(),
            admin_id: row.get::<String>(9).ok(),
            admin_username: row.get::<String>(10).ok(),
            admin_full_name: row.get::<String>(11).ok(),
        });
    }
    Ok(RestaurantListResponse { restaurants, source, remote_error })
}

/// Creates a new restaurant and its owner admin account atomically.
#[tauri::command]
pub async fn create_restaurant_with_admin(
    restaurant_name: String,
    restaurant_address: Option<String>,
    restaurant_phone: Option<String>,
    business_type: Option<String>,
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
    let business = business_type.unwrap_or_else(|| "Restaurant/Pub/Bar".to_string());
    let expires_at = license_expires_at.unwrap_or_default();
    let support_contact = license_support_contact.unwrap_or_default();
    let full_name = admin_full_name.unwrap_or_default();

    pool.execute(
        "INSERT INTO restaurants (id, name, address, phone, receipt_footer, business_type, license_expires_at, license_support_contact)
         VALUES (?, ?, ?, ?, 'Thank you for your visit!', ?, ?, ?)",
        params![
            restaurant_id.clone(),
            restaurant_name.clone(),
            address.clone(),
            phone.clone(),
            business.clone(),
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
        &business,
        &expires_at,
        &support_contact,
        &admin_id,
        &admin_username,
        &hash,
        &full_name,
    ).await?;

    Ok(restaurant_id)
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
    // Read from remote (authoritative) when available — admin may only exist in cloud.
    let read_conn: &Connection = match remote.0.as_ref() {
        Some(r) => r,
        None => &pool,
    };

    let mut rows = read_conn.query(
        "SELECT restaurant_id, username, password_hash, full_name FROM users WHERE id = ? AND role = 'admin'",
        params![admin_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let row = rows.next().await.map_err(|e| e.to_string())?
        .ok_or_else(|| "Admin account not found".to_string())?;

    let _restaurant_id: Option<String> = row.get(0).ok();
    let existing_username: String = row.get(1).unwrap_or_default();
    let existing_hash: String = row.get(2).unwrap_or_default();
    let existing_fullname: Option<String> = row.get(3).ok();

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

    const SQL: &str = "UPDATE users SET username = ?, password_hash = ?, full_name = ?, updated_at = datetime('now') WHERE id = ?";

    // Write to remote first (authoritative).
    if let Some(remote_conn) = remote.0.as_ref() {
        remote_conn.execute(SQL, params![
            final_username.clone(), final_hash.clone(), final_fullname.clone(), admin_id.clone()
        ]).await.map_err(|e| format!("Cloud error: {}", e))?;
    }

    // Best-effort local update.
    let _ = pool.execute(SQL, params![
        final_username.clone(), final_hash.clone(), final_fullname.clone(), admin_id.clone()
    ]).await;

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
    // Superadmin is cloud-only — read current values from remote when available.
    let read_conn: &Connection = match remote.0.as_ref() {
        Some(r) => r,
        None => &pool,
    };

    let mut rows = read_conn.query(
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

    const SQL: &str = "UPDATE users SET username = ?, password_hash = ?, full_name = ?, updated_at = datetime('now') WHERE id = ? AND role = 'super_admin'";

    // Write to remote (authoritative for superadmin).
    if let Some(remote_conn) = remote.0.as_ref() {
        remote_conn.execute(
            SQL,
            params![final_username.clone(), final_hash.clone(), final_fullname.clone(), superadmin_id.clone()]
        ).await.map_err(|e| format!("Database error: {}", e))?;
    }

    // Best-effort local update (may not exist locally — that's fine).
    let _ = pool.execute(
        SQL,
        params![final_username.clone(), final_hash.clone(), final_fullname.clone(), superadmin_id.clone()]
    ).await;

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
    remote: State<'_, RemoteDb>,
) -> Result<Vec<SuperadminUserView>, String> {
    let _conn: &Connection = match remote.0.as_ref() {
        Some(r) => r,
        None => &pool,
    };

    const QUERY: &str =
        "SELECT u.id, u.restaurant_id, r.name, u.username, u.role, u.full_name, u.created_at
         FROM users u
         LEFT JOIN restaurants r ON u.restaurant_id = r.id AND r.is_deleted = 0
         WHERE u.is_deleted = 0
           AND u.role != 'super_admin'
         ORDER BY r.name, u.role, u.username";

    let rows_result = if let Some(remote_conn) = remote.0.as_ref() {
        match remote_conn.query(QUERY, ()).await {
            Ok(r) => Ok(r),
            Err(e) => {
                eprintln!("[Auth] Remote superadmin_get_all_users failed, fallback to local: {}", e);
                pool.query(QUERY, ()).await
            }
        }
    } else {
        pool.query(QUERY, ()).await
    };

    let mut rows = rows_result.map_err(|e| format!("Database error: {}", e))?;

    let mut list = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        list.push(SuperadminUserView {
            id: row.get(0).unwrap_or_default(),
            restaurant_id: row.get(1).ok(),
            restaurant_name: row.get(2).ok(),
            username: row.get(3).unwrap_or_default(),
            role: rbac::normalize_role_for_session(&row.get::<String>(4).unwrap_or_default()),
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
    // Prefer reading from remote (authoritative) — the user may only exist in the cloud.
    let read_conn: &Connection = match remote.0.as_ref() {
        Some(r) => r,
        None => &pool,
    };

    let mut rows = read_conn.query(
        "SELECT username, password_hash, role, full_name FROM users WHERE id = ? AND is_deleted = 0",
        params![user_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let row = rows.next().await.map_err(|e| e.to_string())?
        .ok_or_else(|| "User not found".to_string())?;

    let username: String = row.get(0).unwrap_or_default();
    let password_hash: String = row.get(1).unwrap_or_default();
    let role: String = row.get(2).unwrap_or_default();
    let full_name: String = row.get::<String>(3).unwrap_or_default();

    // Write to remote (authoritative) first.
    mirror_user_update_to_remote(
        remote.0.as_ref(),
        &user_id,
        Some(&new_restaurant_id),
        &username,
        &password_hash,
        &role,
        &full_name,
    ).await?;

    // Best-effort local update — ignore FK errors if the restaurant doesn't exist locally.
    let _ = pool.execute(
        "UPDATE users SET restaurant_id = ?, updated_at = datetime('now') WHERE id = ?",
        params![new_restaurant_id, user_id]
    ).await;

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
    let role = rbac::to_storage_role(&role);
    if role == "super_admin" {
        return Err("Permission denied: super_admin is an internal platform role".to_string());
    }

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Hash error: {}", e))?
        .to_string();

    let user_id = uuid::Uuid::new_v4().to_string();
    let final_full_name = full_name.unwrap_or_default();
    let final_khmer_name = khmer_name.unwrap_or_default();

    // Write to remote (authoritative cloud DB) first.
    // The superadmin works cloud-first; the restaurant may not exist in the local DB.
    if let Some(remote_conn) = remote.0.as_ref() {
        remote_conn.execute(
            "INSERT OR REPLACE INTO users (id, restaurant_id, username, password_hash, role, full_name, khmer_name, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))",
            params![
                user_id.clone(),
                restaurant_id.clone(),
                username.clone(),
                hash.clone(),
                role.clone(),
                final_full_name.clone(),
                final_khmer_name.clone()
            ]
        ).await.map_err(|e| format!("Cloud sync error: {}", e))?;
    }

    // Best-effort local insert — ignore FK/unique errors because the restaurant
    // may only exist in the cloud and not yet been seeded to this local DB.
    let _ = pool.execute(
        "INSERT OR IGNORE INTO users (id, restaurant_id, username, password_hash, role, full_name, khmer_name)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            user_id.clone(),
            restaurant_id,
            username,
            hash,
            role,
            final_full_name,
            final_khmer_name
        ]
    ).await;

    Ok(user_id)
}

#[tauri::command]
pub async fn set_user_pin(
    restaurant_id: String,
    user_id: String,
    pin: String,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<(), String> {
    if pin.len() < 4 || pin.len() > 6 || !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err("PIN must be 4-6 digits.".to_string());
    }

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(pin.as_bytes(), &salt)
        .map_err(|e| format!("Hash error: {}", e))?
        .to_string();

    const SQL: &str = "UPDATE users SET pin_hash = ?, updated_at = datetime('now') WHERE id = ? AND restaurant_id = ?";

    pool.execute(SQL, params![hash.clone(), user_id.clone(), restaurant_id.clone()])
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if let Some(remote_conn) = remote.0.as_ref()
        && let Err(e) = remote_conn.execute(SQL, params![hash, user_id, restaurant_id]).await
    {
        eprintln!("[Auth] Warning: could not mirror PIN update to remote: {}", e);
    }

    Ok(())
}

#[tauri::command]
pub async fn login_with_pin(
    restaurant_id: String,
    pin: String,
    pool: State<'_, Arc<Connection>>,
    app: tauri::AppHandle,
) -> Result<UserSession, String> {
    if pin.len() < 4 || pin.len() > 6 || !pin.chars().all(|c| c.is_ascii_digit()) {
        return Err("Invalid PIN format.".to_string());
    }

    // Locked accounts (failed-attempt lockout) are excluded so PIN can't bypass the lock.
    let mut rows = pool.query(
        "SELECT id, restaurant_id, username, pin_hash, role, full_name, khmer_name, phone
         FROM users WHERE restaurant_id = ? AND pin_hash IS NOT NULL AND pin_hash != '' AND is_deleted = 0
           AND (locked_until IS NULL OR locked_until <= datetime('now','localtime'))",
        params![restaurant_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        let pin_hash: String = match row.get::<String>(3) {
            Ok(h) if !h.is_empty() => h,
            _ => continue,
        };

        let parsed = match PasswordHash::new(&pin_hash) {
            Ok(h) => h,
            Err(_) => continue,
        };

        if Argon2::default().verify_password(pin.as_bytes(), &parsed).is_ok() {
            let username = row.get::<String>(2).unwrap_or_default();
            reset_login_attempts(&pool, &username).await;
            if let Some(name) = fetch_restaurant_name(&pool, &restaurant_id).await {
                set_window_title(&app, &format!("{} - DineOS", name));
            }
            return Ok(UserSession {
                id: row.get::<String>(0).unwrap_or_default(),
                restaurant_id: row.get::<String>(1).ok(),
                username,
                role: rbac::normalize_role_for_session(&row.get::<String>(4).unwrap_or_default()),
                full_name: row.get::<String>(5).ok(),
                khmer_name: row.get::<String>(6).ok(),
                phone: row.get::<String>(7).ok(),
            });
        }
    }

    Err("Invalid PIN".to_string())
}

#[tauri::command]
pub async fn change_password(
    user_id: String,
    current_password: String,
    new_password: String,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<(), String> {
    if new_password.len() < 6 {
        return Err("New password must be at least 6 characters.".to_string());
    }

    let mut rows = pool.query(
        "SELECT password_hash FROM users WHERE id = ? AND is_deleted = 0",
        params![user_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let row = rows.next().await.map_err(|e| e.to_string())?
        .ok_or_else(|| "User not found".to_string())?;

    let existing_hash: String = row.get(0).unwrap_or_default();

    let parsed = PasswordHash::new(&existing_hash)
        .map_err(|_| "Invalid password hash".to_string())?;
    Argon2::default()
        .verify_password(current_password.as_bytes(), &parsed)
        .map_err(|_| "Current password is incorrect".to_string())?;

    let salt = SaltString::generate(&mut OsRng);
    let new_hash = Argon2::default()
        .hash_password(new_password.as_bytes(), &salt)
        .map_err(|e| format!("Hash error: {}", e))?
        .to_string();

    const SQL: &str = "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?";

    pool.execute(SQL, params![new_hash.clone(), user_id.clone()])
        .await
        .map_err(|e| format!("Database error: {}", e))?;

    if let Some(remote_conn) = remote.0.as_ref()
        && let Err(e) = remote_conn.execute(SQL, params![new_hash, user_id]).await
    {
        eprintln!("[Auth] Warning: could not mirror password change to remote: {}", e);
    }

    Ok(())
}

/// Creates an additional super_admin account (cloud-only, no restaurant).
/// Only callable from the superadmin dashboard.
#[tauri::command]
pub async fn create_superadmin_account(
    username: String,
    password: String,
    full_name: Option<String>,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<(), String> {
    if username.trim().is_empty() || password.len() < 6 {
        return Err("Username is required and password must be at least 6 characters.".to_string());
    }

    // Check for duplicate username in remote (authoritative source).
    let check_conn: &Connection = match remote.0.as_ref() {
        Some(r) => r,
        None => &pool,
    };
    let mut dup = check_conn.query(
        "SELECT 1 FROM users WHERE username = ? AND is_deleted = 0 LIMIT 1",
        params![username.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;
    if dup.next().await.map_err(|e| e.to_string())?.is_some() {
        return Err(format!("Username '{}' is already taken.", username));
    }

    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("Hash error: {}", e))?
        .to_string();

    let user_id = uuid::Uuid::new_v4().to_string();
    let final_full_name = full_name.unwrap_or_default();

    const SQL: &str =
        "INSERT INTO users (id, restaurant_id, username, password_hash, role, full_name)
         VALUES (?, NULL, ?, ?, 'super_admin', ?)";

    // Write to remote (authoritative for super_admin accounts).
    if let Some(remote_conn) = remote.0.as_ref() {
        remote_conn.execute(SQL, params![
            user_id.clone(), username.clone(), hash.clone(), final_full_name.clone()
        ]).await.map_err(|e| format!("Cloud error: {}", e))?;
    }

    // Best-effort local copy.
    let _ = pool.execute(SQL, params![
        user_id.clone(), username.clone(), hash.clone(), final_full_name.clone()
    ]).await;

    Ok(())
}

#[tauri::command]
pub async fn delete_restaurant(
    restaurant_id: String,
    actor_user_id: String,
    actor_role: String,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<(), String> {
    let mut resolved_actor_role: Option<String> = None;

    // Prefer authoritative cloud role lookup when available.
    if let Some(remote_conn) = remote.0.as_ref()
        && let Ok(mut rows) = remote_conn.query(
            "SELECT role FROM users WHERE id = ? AND is_deleted = 0",
            params![actor_user_id.clone()]
        ).await
        && let Ok(Some(row)) = rows.next().await
    {
        resolved_actor_role = Some(rbac::normalize_role_for_session(&row.get::<String>(0).unwrap_or_default()));
    }

    // Fallback to local role lookup if cloud role was unavailable.
    if resolved_actor_role.is_none() {
        let mut rows = pool.query(
            "SELECT role FROM users WHERE id = ? AND is_deleted = 0",
            params![actor_user_id.clone()]
        ).await.map_err(|e| format!("Database error: {}", e))?;

        if let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
            resolved_actor_role = Some(rbac::normalize_role_for_session(&row.get::<String>(0).unwrap_or_default()));
        }
    }

    let effective_actor_role = resolved_actor_role.unwrap_or_else(|| rbac::normalize_role_for_session(&actor_role));

    if !rbac::can_delete(&effective_actor_role) {
        return Err("Permission denied: only Super Admin and Admin may delete records".to_string());
    }

    purge_restaurant_data(&pool, &restaurant_id).await?;

    if let Some(remote_conn) = remote.0.as_ref() {
        purge_restaurant_data(remote_conn, &restaurant_id).await?;
    }

    rbac::write_audit_log(
        &pool,
        &restaurant_id,
        &actor_user_id,
        &effective_actor_role,
        "delete",
        "restaurant",
        &restaurant_id,
        None,
    ).await;

    Ok(())
}
