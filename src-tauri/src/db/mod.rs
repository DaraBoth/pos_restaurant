use libsql::{Builder, Connection};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::time::{sleep, Duration};
use tauri::async_runtime::spawn;

pub async fn init_db(db_path: PathBuf, _key: &str) -> anyhow::Result<Arc<Connection>> {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "".to_string());
    let token = std::env::var("AUTH_TOKEN").unwrap_or_else(|_| "".to_string());

    let db = if !url.is_empty() && !token.is_empty() {
        println!("Connecting to Turso Embedded Replica...");
        Builder::new_remote_replica(db_path, url, token)
            .build()
            .await?
    } else {
        println!("Running pure local SQLite (no Turso credentials)...");
        Builder::new_local(db_path).build().await?
    };

    let conn = db.connect()?;
    let conn_arc = Arc::new(conn);

    // Auto-sync loop in background
    if std::env::var("DATABASE_URL").is_ok() {
        let sync_db = db;
        spawn(async move {
            loop {
                if let Err(e) = sync_db.sync().await {
                    eprintln!("Turso Sync Error: {}", e);
                }
                sleep(Duration::from_secs(5)).await;
            }
        });
    }

    Ok(conn_arc)
}
