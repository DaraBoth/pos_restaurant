use libsql::{Builder, Connection};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::time::{sleep, Duration};
use tauri::async_runtime::spawn;

pub mod sync;

// ─── Credentials baked at compile time ─────────────────────────
const BAKED_URL:   &str = "libsql://dineos-cloud-ariesbries.aws-ap-northeast-1.turso.io";
const BAKED_TOKEN: &str = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzM5OTU1ODcsImlkIjoiMDE5ZDBhNjAtMjUwMS03ODM1LTlhNTItN2MwNjY2NmVhYjIwIiwicmlkIjoiZTcwOTA3ZTktOWQ0OC00MWY3LWIyNDctZTA0NDlhY2NkZGYwIn0.Vv6o6couFDlsxOchsQ6mMtK_YJaFANAZ778AGjC7V1sL13OlCI2L8758sq79HziGdWmn000VWQFb0looWzdYBg";

// ─── Migration SQL files embedded at compile time ───────────────────────────
const MIGRATIONS: &[(&str, &str)] = &[
    ("001_baseline", include_str!("migrations/001_baseline.sql")),
];

// ─── Helpers ────────────────────────────────────────────────────────────────

async fn exec_statements(conn: &Connection, sql: &str) {
    let mut current = String::new();
    let mut in_trigger = false;

    for line in sql.lines() {
        let trimmed = line.trim();
        // Skip comments and empty lines
        if trimmed.is_empty() || trimmed.starts_with("--") { continue; }

        current.push_str(line);
        current.push('\n');

        let upper = trimmed.to_uppercase();
        if upper.contains("CREATE TRIGGER") {
            in_trigger = true;
        }

        // Triggers in SQLite end with "END;"
        // We only execute when we hit a semicolon that isn't trapped inside a trigger
        // OR when we hit the "END;" of a trigger.
        let is_statement_end = if in_trigger {
            upper.ends_with("END;") || upper == "END"
        } else {
            trimmed.ends_with(';')
        };

        if is_statement_end {
            let stmt = current.trim();
            if !stmt.is_empty() {
                if let Err(e) = conn.execute(stmt, ()).await {
                    let msg = e.to_string().to_lowercase();
                    // Non-fatal errors common during incremental development
                    if msg.contains("duplicate column") || msg.contains("already exists") { 
                        // Ignored
                    } else {
                        eprintln!("[DB Migration] warning: {} — SQL: {}", msg, &stmt[..stmt.len().min(120)]);
                    }
                }
            }
            current.clear();
            in_trigger = false;
        }
    }
}

async fn apply_migrations(conn: &Connection) -> anyhow::Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS _migrations (
            id TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )", (),
    ).await.map_err(|e| anyhow::anyhow!("Cannot create _migrations table: {}", e))?;

    for (id, sql) in MIGRATIONS {
        let mut rows = conn.query("SELECT 1 FROM _migrations WHERE id = ?", [*id]).await?;
        if rows.next().await?.is_some() { continue; }
        println!("[DB] Applying migration {}…", id);
        exec_statements(conn, sql).await;
        if let Err(e) = conn.execute("INSERT INTO _migrations (id) VALUES (?)", [*id]).await {
            eprintln!("[DB] Could not record migration {}: {}", id, e);
        } else {
            println!("[DB] Migration {} done.", id);
        }
    }
    Ok(())
}

async fn column_exists(conn: &Connection, table: &str, col: &str) -> bool {
    let sql = format!("PRAGMA table_info({})", table);
    let mut rows = match conn.query(&sql, ()).await { Ok(r) => r, Err(_) => return false };
    while let Ok(Some(row)) = rows.next().await {
        if row.get::<String>(1).unwrap_or_default().to_lowercase() == col.to_lowercase() {
            return true;
        }
    }
    false
}

async fn ensure_critical_columns(conn: &Connection) {
    macro_rules! add_col {
        ($table:expr, $col:expr, $def:expr) => {
            if !column_exists(conn, $table, $col).await {
                let _ = conn.execute(concat!("ALTER TABLE ", $table, " ADD COLUMN ", $def), ()).await;
            }
        };
    }
    add_col!("orders",      "session_id",      "session_id TEXT");
    add_col!("orders",      "round_number",    "round_number INTEGER NOT NULL DEFAULT 1");
    add_col!("orders",      "customer_name",   "customer_name TEXT");
    add_col!("orders",      "customer_phone",  "customer_phone TEXT");
    add_col!("floor_tables","seat_count",      "seat_count INTEGER NOT NULL DEFAULT 4");
    add_col!("floor_tables","restaurant_id",   "restaurant_id TEXT REFERENCES restaurants(id)");
    add_col!("products",     "stock_quantity",  "stock_quantity INTEGER NOT NULL DEFAULT 0");
    add_col!("products",     "image_path",      "image_path TEXT");
    add_col!("inventory_logs", "product_id",     "product_id TEXT REFERENCES products(id) ON DELETE CASCADE");
    add_col!("inventory_logs", "user_id",        "user_id TEXT REFERENCES users(id) ON DELETE CASCADE");
    add_col!("inventory_logs", "change_amount",   "change_amount INTEGER NOT NULL DEFAULT 0");
    add_col!("inventory_logs", "reason",          "reason TEXT");

    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS table_sessions (
            id TEXT PRIMARY KEY, table_id TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            completed_at TEXT,
            restaurant_id TEXT,
            updated_at TEXT
        )", (),
    ).await;

    // ── Emergency Triggers (Ensure sync works for existing installs) ────────────────
    // Since we're updating the baseline.sql after the first install, we need to manually
    // inject these once for existing DBs that already marked 001_baseline as "done".
    let tables = vec![
        "restaurants", "users", "categories", "products", "floor_tables", 
        "exchange_rates", "inventory_items", "orders", "order_items", 
        "payments", "table_sessions", "inventory_logs", "product_ingredients"
    ];
    for t in tables {
        let trigger_sql = format!(
            "CREATE TRIGGER IF NOT EXISTS trg_{}_upd AFTER UPDATE ON {} 
             BEGIN UPDATE {} SET updated_at = datetime('now') WHERE id = NEW.id; END;",
            t, t, t
        );
        let _ = conn.execute(&trigger_sql, ()).await;
        
        // Backfill NULL updated_at so they sync on next cycle
        let update_sql = format!("UPDATE {} SET updated_at = datetime('now') WHERE updated_at IS NULL", t);
        let _ = conn.execute(&update_sql, ()).await;
    }
}

// ─── Public structs exposed to lib.rs ───────────────────────────────────────

/// Wraps the optional Turso remote connection used ONLY for per-restaurant sync.
/// Is None when running offline (no credentials).
pub struct RemoteDb(pub Option<Arc<Connection>>);

// ─── Entry point ────────────────────────────────────────────────────────────

pub async fn init_db(db_path: PathBuf, _key: &str) -> anyhow::Result<(Arc<Connection>, Option<Arc<Connection>>)> {
    // Credentials: OS env overrides compile-time baked value
    let url   = std::env::var("DATABASE_URL").ok().filter(|s| !s.is_empty())
        .unwrap_or_else(|| BAKED_URL.to_string());
    let token = std::env::var("AUTH_TOKEN").ok().filter(|s| !s.is_empty())
        .unwrap_or_else(|| BAKED_TOKEN.to_string());

    let has_creds = !url.is_empty() && !token.is_empty();

    // ── Local SQLite (always used by command handlers) ──────────────────────
    let local_db = Builder::new_local(db_path).build().await?;
    let local_conn = Arc::new(local_db.connect()?);

    // Apply migrations to local DB
    if let Err(e) = apply_migrations(&local_conn).await {
        eprintln!("[DB] Migration error (non-fatal): {}", e);
    }
    ensure_critical_columns(&local_conn).await;
    sync::ensure_sync_table(&local_conn).await;

    // ── Remote Turso (optional, used only for sync) ──────────────────────────
    let remote_conn: Option<Arc<Connection>> = if has_creds {
        println!("[DB] Connecting to Turso remote for sync (URL: {})…", &url[..url.len().min(50)]);
        match Builder::new_remote(url.clone(), token.clone()).build().await {
            Ok(db) => {
                match db.connect() {
                    Ok(conn) => {
                        println!("[DB] Turso remote connected ✓");
                        Some(Arc::new(conn))
                    },
                    Err(e) => {
                        eprintln!("[DB] Turso remote connect() failed: {}", e);
                        None
                    }
                }
            }
            Err(e) => {
                eprintln!("[DB] Turso remote build failed: {} — sync disabled", e);
                None
            }
        }
    } else {
        println!("[DB] No Turso credentials — running offline only");
        None
    };

    Ok((local_conn, remote_conn))
}

/// Start the background per-restaurant sync daemon.
/// Called from lib.rs after login sets the restaurant_id.
pub fn start_sync_daemon(
    local: Arc<Connection>,
    remote: Arc<Connection>,
    restaurant_id: String,
) {
    spawn(async move {
        println!("[Sync] Daemon started for restaurant={}", restaurant_id);

        // Apply migrations to remote DB safely on this tokio worker thread (avoids 1MB main stack overflow)
        if let Err(e) = apply_migrations(&remote).await {
            eprintln!("[DB] Remote Migration error: {}", e);
        }
        ensure_critical_columns(&remote).await;
        sync::ensure_sync_table(&remote).await;

        // Initial sync immediately
        sync::sync_restaurant(&local, &remote, &restaurant_id).await;

        // Then every 5 seconds
        loop {
            sleep(Duration::from_secs(5)).await;
            sync::sync_restaurant(&local, &remote, &restaurant_id).await;
        }
    });
}
