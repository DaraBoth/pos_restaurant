use libsql::{Builder, Connection};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::time::{sleep, Duration};
use tauri::async_runtime::spawn;

// Embed all migration SQL files at compile time.
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
    ("011", include_str!("migrations/011_ensure_missing_columns.sql")),
    ("012", include_str!("migrations/012_restore_depleted_stock.sql")),
    ("013", include_str!("migrations/013_fix_missing_session_columns.sql")),
];

/// Execute a single SQL string that may contain multiple statements separated by `;`.
/// Each statement is executed independently so one failure doesn't abort the rest.
/// ALTER TABLE duplicate-column errors are silently ignored (idempotency).
async fn exec_statements(conn: &Connection, sql: &str) {
    for raw in sql.split(';') {
        let stmt = raw.trim();
        // Skip blank lines and SQL comments
        if stmt.is_empty() || stmt.starts_with("--") {
            continue;
        }
        if let Err(e) = conn.execute(stmt, ()).await {
            let msg = e.to_string().to_lowercase();
            // Silently ignore "duplicate column" errors from ALTER TABLE
            if msg.contains("duplicate column") || msg.contains("already exists") {
                continue;
            }
            // Log everything else but DO NOT panic — the app must stay alive
            eprintln!("[DB Migration] Statement warning ({}): {}", msg, stmt.chars().take(120).collect::<String>());
        }
    }
}

async fn apply_migrations(conn: &Connection) -> anyhow::Result<()> {
    // Create tracking table — if this fails, something is fundamentally broken
    conn.execute(
        "CREATE TABLE IF NOT EXISTS _migrations (
            id          TEXT PRIMARY KEY,
            applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        (),
    )
    .await
    .map_err(|e| anyhow::anyhow!("Cannot create _migrations table: {}", e))?;

    for (id, sql) in MIGRATIONS {
        // Check if already applied
        let mut rows = conn
            .query("SELECT 1 FROM _migrations WHERE id = ?", [*id])
            .await?;

        if rows.next().await?.is_some() {
            continue; // Already done
        }

        println!("[DB] Applying migration {}...", id);

        // Run each statement independently — never panic on partial failure
        exec_statements(conn, sql).await;

        // Mark as applied regardless — partial migrations are logged above
        if let Err(e) = conn.execute(
            "INSERT INTO _migrations (id) VALUES (?)",
            [*id],
        ).await {
            eprintln!("[DB] Could not record migration {}: {}", id, e);
        } else {
            println!("[DB] Migration {} done.", id);
        }
    }

    Ok(())
}

/// Checks whether a column exists in a table using PRAGMA table_info.
async fn column_exists(conn: &Connection, table: &str, col: &str) -> bool {
    let sql = format!("PRAGMA table_info({})", table);
    let mut rows = match conn.query(&sql, ()).await {
        Ok(r) => r,
        Err(_) => return false,
    };
    while let Ok(Some(row)) = rows.next().await {
        if row.get::<String>(1).unwrap_or_default().to_lowercase() == col.to_lowercase() {
            return true;
        }
    }
    false
}

/// Unconditionally ensures every column that migrations may have missed is present.
/// Uses PRAGMA table_info to check first — never errors, never panics.
async fn ensure_critical_columns(conn: &Connection) {
    // orders.session_id
    if !column_exists(conn, "orders", "session_id").await {
        let _ = conn.execute("ALTER TABLE orders ADD COLUMN session_id TEXT", ()).await;
        println!("[DB] Added missing column orders.session_id");
    }
    // orders.round_number
    if !column_exists(conn, "orders", "round_number").await {
        let _ = conn.execute("ALTER TABLE orders ADD COLUMN round_number INTEGER NOT NULL DEFAULT 1", ()).await;
        println!("[DB] Added missing column orders.round_number");
    }
    // order_items.kitchen_status
    if !column_exists(conn, "order_items", "kitchen_status").await {
        let _ = conn.execute("ALTER TABLE order_items ADD COLUMN kitchen_status TEXT NOT NULL DEFAULT 'pending'", ()).await;
        println!("[DB] Added missing column order_items.kitchen_status");
    }
    // floor_tables.seat_count
    if !column_exists(conn, "floor_tables", "seat_count").await {
        let _ = conn.execute("ALTER TABLE floor_tables ADD COLUMN seat_count INTEGER NOT NULL DEFAULT 4", ()).await;
        println!("[DB] Added missing column floor_tables.seat_count");
    }
    // table_sessions table
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS table_sessions (
            id           TEXT PRIMARY KEY,
            table_id     TEXT,
            status       TEXT NOT NULL DEFAULT 'active',
            created_at   TEXT NOT NULL DEFAULT (datetime('now')),
            completed_at TEXT
        )", ()
    ).await;
    // orders.customer_name / customer_phone
    if !column_exists(conn, "orders", "customer_name").await {
        let _ = conn.execute("ALTER TABLE orders ADD COLUMN customer_name TEXT", ()).await;
    }
    if !column_exists(conn, "orders", "customer_phone").await {
        let _ = conn.execute("ALTER TABLE orders ADD COLUMN customer_phone TEXT", ()).await;
    }
}

pub async fn init_db(db_path: PathBuf, _key: &str) -> anyhow::Result<Arc<Connection>> {
    let url = std::env::var("DATABASE_URL").unwrap_or_default();
    let token = std::env::var("AUTH_TOKEN").unwrap_or_default();

    let db = if !url.is_empty() && !token.is_empty() {
        println!("[DB] Connecting to Turso Embedded Replica...");
        match Builder::new_remote_replica(db_path.clone(), url, token)
            .build()
            .await
        {
            Ok(db) => db,
            Err(e) => {
                // If Turso connection fails (e.g. no internet), fall back to local
                eprintln!("[DB] Turso connection failed: {}. Falling back to local SQLite.", e);
                Builder::new_local(db_path).build().await?
            }
        }
    } else {
        println!("[DB] Running local SQLite (no Turso credentials).");
        Builder::new_local(db_path).build().await?
    };

    let conn = db.connect()?;

    // Apply schema migrations — resilient, never panics
    if let Err(e) = apply_migrations(&conn).await {
        eprintln!("[DB] Migration error (non-fatal): {}", e);
    }

    // Safety net: unconditionally ensure critical columns exist, regardless of
    // migration history. ALTER TABLE silently ignores "duplicate column" errors.
    ensure_critical_columns(&conn).await;

    let conn_arc = Arc::new(conn);

    // Auto-sync to Turso in background
    if std::env::var("DATABASE_URL").is_ok() {
        let sync_db = db;
        spawn(async move {
            // Initial sync
            match sync_db.sync().await {
                Ok(_) => println!("[Turso] Initial sync complete."),
                Err(e) => eprintln!("[Turso] Initial sync error: {}", e),
            }
            loop {
                sleep(Duration::from_secs(10)).await;
                if let Err(e) = sync_db.sync().await {
                    eprintln!("[Turso] Sync error: {}", e);
                }
            }
        });
    }

    Ok(conn_arc)
}
