use tauri::State;
use libsql::{Connection, params};
use std::sync::Arc;
use crate::models::AppRelease;
use crate::db::RemoteDb;

#[tauri::command]
pub async fn get_app_releases(
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, RemoteDb>,
) -> Result<Vec<AppRelease>, String> {
    // Cloud overrides local in terms of latest app versions
    let conn: &Connection = match remote.0.as_ref() {
        Some(r) => r,
        None => &*pool,
    };

    let mut rows = conn.query(
        "SELECT id, version, release_notes, windows_file, windows_signature, mac_file, mac_signature, created_at 
         FROM app_releases ORDER BY created_at DESC",
        ()
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let mut releases = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        releases.push(AppRelease {
            id: row.get::<String>(0).unwrap_or_default(),
            version: row.get::<String>(1).unwrap_or_default(),
            release_notes: row.get::<String>(2).ok(),
            windows_file: row.get::<String>(3).ok(),
            windows_signature: row.get::<String>(4).ok(),
            mac_file: row.get::<String>(5).ok(),
            mac_signature: row.get::<String>(6).ok(),
            created_at: row.get::<String>(7).unwrap_or_default(),
        });
    }

    Ok(releases)
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

    let sql = "INSERT INTO app_releases (id, version, release_notes, windows_file, windows_signature, mac_file, mac_signature) 
               VALUES (?, ?, ?, ?, ?, ?, ?)";
    // Authoritative remote write
    if let Some(remote_conn) = remote.0.as_ref() {
        remote_conn.execute(sql, params![
            id.clone(),
            version.clone(),
            release_notes.clone().unwrap_or_default(),
            windows_file.clone().unwrap_or_default(),
            windows_signature.clone().unwrap_or_default(),
            mac_file.clone().unwrap_or_default(),
            mac_signature.clone().unwrap_or_default()
        ]).await.map_err(|e| format!("Cloud sync error: {}", e))?;
    }

    // Local override
    if let Err(e) = pool.execute(sql, params![
        id.clone(),
        version.clone(),
        release_notes.clone().unwrap_or_default(),
        windows_file.clone().unwrap_or_default(),
        windows_signature.clone().unwrap_or_default(),
        mac_file.clone().unwrap_or_default(),
        mac_signature.clone().unwrap_or_default()
    ]).await {
        eprintln!("[Releases] Local insert warning: {}", e);
    }

    // Optional: pruning to keep only the 3 most recent globally.
    // That can be handled securely by deleting older rows.
    let prune_sql = "DELETE FROM app_releases WHERE id NOT IN (
        SELECT id FROM app_releases ORDER BY created_at DESC LIMIT 3
    )";
    if let Some(remote_conn) = remote.0.as_ref() {
        let _ = remote_conn.execute(prune_sql, ()).await;
    }
    let _ = pool.execute(prune_sql, ()).await;

    Ok(AppRelease {
        id,
        version,
        release_notes,
        windows_file,
        windows_signature,
        mac_file,
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
