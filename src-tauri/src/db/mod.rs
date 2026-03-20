use libsql::{Builder, Connection};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::time::{sleep, Duration};
use tauri::async_runtime::spawn;

// Embed all migration SQL files at compile time.
// They are applied in order on every startup using IF NOT EXISTS guards,
// so they are safe to re-run — only missing tables/columns get created.
const MIGRATIONS: &[(&str, &str)] = &[
    ("001", include_str!("migrations/001_initial_schema.sql")),
    ("002", include_str!("migrations/002_add_features.sql")),
    ("003", include_str!("migrations/003_add_images_and_inventory.sql")),
    ("004", include_str!("migrations/004_restaurant_setup_and_minimal_seed.sql")),
    ("005", include_str!("migrations/005_add_restaurant_logo.sql")),
    ("006", include_str!("migrations/006_recalculate_existing_orders.sql")),
    ("007", include_str!("migrations/007_kitchen_and_tables.sql")),
    ("008", include_str!("migrations/008_customer_info.sql")),
    ("009", include_str!("migrations/009_table_sessions_and_rounds.sql")),
    ("010", include_str!("migrations/010_inventory_recipes.sql")),
];

async fn apply_migrations(conn: &Connection) -> anyhow::Result<()> {
    // Create a tracking table so we can skip already-applied migrations
    conn.execute(
        "CREATE TABLE IF NOT EXISTS _migrations (
            id          TEXT PRIMARY KEY,
            applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        (),
    )
    .await?;

    for (id, sql) in MIGRATIONS {
        // Check if this migration was already applied
        let mut rows = conn
            .query("SELECT 1 FROM _migrations WHERE id = ?", [*id])
            .await?;

        if rows.next().await?.is_some() {
            // Already applied — skip
            continue;
        }

        println!("[DB] Applying migration {}...", id);

        // Execute the migration (each SQL file may have multiple statements)
        conn.execute_batch(sql).await.map_err(|e| {
            anyhow::anyhow!("Migration {} failed: {}", id, e)
        })?;

        // Mark as applied
        conn.execute(
            "INSERT INTO _migrations (id) VALUES (?)",
            [*id],
        )
        .await?;

        println!("[DB] Migration {} applied.", id);
    }

    Ok(())
}

pub async fn init_db(db_path: PathBuf, _key: &str) -> anyhow::Result<Arc<Connection>> {
    let url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "".to_string());
    let token = std::env::var("AUTH_TOKEN").unwrap_or_else(|_| "".to_string());

    let db = if !url.is_empty() && !token.is_empty() {
        println!("[DB] Connecting to Turso Embedded Replica...");
        Builder::new_remote_replica(db_path, url, token)
            .build()
            .await?
    } else {
        println!("[DB] Running pure local SQLite (no Turso credentials)...");
        Builder::new_local(db_path).build().await?
    };

    let conn = db.connect()?;

    // Apply schema migrations — runs on every startup, safe to re-run
    apply_migrations(&conn).await?;

    let conn_arc = Arc::new(conn);

    // Auto-sync loop in background — pushes local writes up to Turso cloud
    if std::env::var("DATABASE_URL").is_ok() {
        let sync_db = db;
        spawn(async move {
            // Initial sync right after startup to pull any remote changes
            if let Err(e) = sync_db.sync().await {
                eprintln!("[Turso] Initial sync error: {}", e);
            } else {
                println!("[Turso] Initial sync complete.");
            }

            loop {
                sleep(Duration::from_secs(5)).await;
                if let Err(e) = sync_db.sync().await {
                    eprintln!("[Turso] Sync error: {}", e);
                }
            }
        });
    }

    Ok(conn_arc)
}
