#![allow(clippy::too_many_arguments)]

use tauri::State;
use tauri::Manager;
use libsql::{Connection, params};
use std::sync::Arc;
use crate::models::AppRelease;
use crate::db::RemoteDb;

/// Returns release metadata only (no file bytes).
/// Large base64 file content is replaced with "db" so the UI knows a file
/// is available without transferring megabytes through the IPC bridge.
#[tauri::command]
pub async fn get_app_releases(
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<Vec<AppRelease>, String> {
    let sql = "SELECT id, version, release_notes, \
               CASE WHEN windows_file IS NOT NULL AND windows_file != '' THEN \
                   CASE WHEN windows_file LIKE 'http%' THEN windows_file ELSE 'db' END \
               ELSE NULL END as windows_file, \
               windows_signature, \
               CASE WHEN mac_file IS NOT NULL AND mac_file != '' THEN \
                   CASE WHEN mac_file LIKE 'http%' THEN mac_file ELSE 'db' END \
               ELSE NULL END as mac_file, \
               mac_signature, created_at \
               FROM app_releases ORDER BY created_at DESC";

    let rows_result = if let Some(remote_conn) = remote.0.as_ref() {
        match remote_conn.query(sql, ()).await {
            Ok(r) => Ok(r),
            Err(e) => {
                eprintln!("[Releases] Remote query failed, falling back to local: {}", e);
                pool.query(sql, ()).await
            }
        }
    } else {
        pool.query(sql, ()).await
    };

    let mut rows = rows_result.map_err(|e| format!("Database error: {}", e))?;

    let mut releases = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        releases.push(AppRelease {
            id: row.get::<String>(0).unwrap_or_default(),
            version: row.get::<String>(1).unwrap_or_default(),
            release_notes: row.get::<String>(2).ok(),
            windows_file: row.get::<String>(3).ok().filter(|s| !s.is_empty()),
            windows_signature: row.get::<String>(4).ok(),
            mac_file: row.get::<String>(5).ok().filter(|s| !s.is_empty()),
            mac_signature: row.get::<String>(6).ok(),
            created_at: row.get::<String>(7).unwrap_or_default(),
        });
    }

    Ok(releases)
}

/// Downloads a release file from the database and writes it to the user's
/// Downloads folder. Returns the absolute path of the saved file.
/// This avoids sending large binary data through the Tauri IPC bridge.
#[tauri::command]
pub async fn download_release_file(
    id: String,
    platform: String, // "windows" or "mac"
    app: tauri::AppHandle,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<String, String> {
    let col = if platform == "windows" { "windows_file" } else { "mac_file" };
    let sql = format!("SELECT {}, version FROM app_releases WHERE id = ?", col);

    // Try remote first, fallback to local
    let (file_data, version) = {
        let mut rows = if let Some(remote_conn) = remote.0.as_ref() {
            match remote_conn.query(&sql, params![id.clone()]).await {
                Ok(r) => r,
                Err(e) => {
                    eprintln!("[Releases] Remote fetch failed, trying local: {}", e);
                    pool.query(&sql, params![id.clone()]).await
                        .map_err(|e| format!("Local query error: {}", e))?
                }
            }
        } else {
            pool.query(&sql, params![id.clone()]).await
                .map_err(|e| format!("Database error: {}", e))?
        };

        let row = rows.next().await.map_err(|e| e.to_string())?
            .ok_or("Release not found")?;
        let data = row.get::<String>(0).map_err(|_| "File not available for this platform".to_string())?;
        let ver = row.get::<String>(1).unwrap_or_else(|_| "unknown".to_string());
        (data, ver)
    };

    if file_data.is_empty() {
        return Err("No file stored for this release/platform".to_string());
    }

    // If it's a URL, return it directly so the frontend can open it
    if file_data.starts_with("http") {
        return Ok(format!("url:{}", file_data));
    }

    // Decode base64 data URI  →  raw bytes
    let base64_part = file_data.split_once(',').map(|(_, b)| b)
        .ok_or("Invalid data URI format")?;

    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let bytes = STANDARD.decode(base64_part)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    // Write to Downloads directory
    let ext = if platform == "windows" { "msi" } else { "dmg" };
    let clean_version = version.trim_start_matches('v');
    let filename = format!("DineOS_{}_installer.{}", clean_version, ext);

    let download_dir = app
        .path()
        .download_dir()
        .map_err(|e| format!("Cannot find Downloads folder: {}", e))?;

    std::fs::create_dir_all(&download_dir)
        .map_err(|e| format!("Cannot create Downloads dir: {}", e))?;

    let file_path = download_dir.join(&filename);
    std::fs::write(&file_path, &bytes)
        .map_err(|e| format!("Failed to write installer: {}", e))?;

    println!("[Releases] Installer saved to: {:?}", file_path);
    Ok(file_path.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn create_app_release(
    version: String,
    release_notes: Option<String>,
    windows_file: Option<String>,
    windows_signature: Option<String>,
    mac_file: Option<String>,
    mac_signature: Option<String>,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<AppRelease, String> {
    let id = uuid::Uuid::new_v4().to_string();

    // Normalize: treat empty strings as None so NULL is stored in DB
    let release_notes = release_notes.filter(|s| !s.is_empty());
    let windows_file = windows_file.filter(|s| !s.is_empty());
    let windows_signature = windows_signature.filter(|s| !s.is_empty());
    let mac_file = mac_file.filter(|s| !s.is_empty());
    let mac_signature = mac_signature.filter(|s| !s.is_empty());

    let sql = "INSERT INTO app_releases (id, version, release_notes, windows_file, windows_signature, mac_file, mac_signature) \
               VALUES (?, ?, ?, ?, ?, ?, ?)";

    // Authoritative remote write — must succeed if remote is configured
    if let Some(remote_conn) = remote.0.as_ref() {
        remote_conn.execute(sql, params![
            id.clone(),
            version.clone(),
            release_notes.clone(),
            windows_file.clone(),
            windows_signature.clone(),
            mac_file.clone(),
            mac_signature.clone()
        ]).await.map_err(|e| format!("Cloud sync error: {}", e))?;
    }

    // Local mirror
    if let Err(e) = pool.execute(sql, params![
        id.clone(),
        version.clone(),
        release_notes.clone(),
        windows_file.clone(),
        windows_signature.clone(),
        mac_file.clone(),
        mac_signature.clone()
    ]).await {
        eprintln!("[Releases] Local insert warning: {}", e);
    }

    // Prune to keep only the 3 most recent releases
    let prune_sql = "DELETE FROM app_releases WHERE id NOT IN (\
        SELECT id FROM app_releases ORDER BY created_at DESC LIMIT 3\
    )";
    if let Some(remote_conn) = remote.0.as_ref() {
        let _ = remote_conn.execute(prune_sql, ()).await;
    }
    let _ = pool.execute(prune_sql, ()).await;

    Ok(AppRelease {
        id,
        version,
        release_notes,
        windows_file: Some("db".to_string()),
        windows_signature,
        mac_file: Some("db".to_string()),
        mac_signature,
        created_at: chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

#[tauri::command]
pub async fn delete_app_release(
    id: String,
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<(), String> {
    let sql = "DELETE FROM app_releases WHERE id = ?";

    if let Some(remote_conn) = remote.0.as_ref() {
        remote_conn.execute(sql, params![id.clone()]).await.map_err(|e| format!("Cloud sync error: {}", e))?;
    }

    let _ = pool.execute(sql, params![id]).await;

    Ok(())
}
