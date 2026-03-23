use libsql::{Builder, Connection};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::time::{sleep, Duration};
use tauri::async_runtime::spawn;

pub mod sync;

// ─── Credentials baked at compile time by build.rs ─────────────────────────
const BAKED_URL:   &str = env!("DATABASE_URL");
const BAKED_TOKEN: &str = env!("AUTH_TOKEN");

// ─── Migration SQL files embedded at compile time ───────────────────────────
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
    ("014", include_str!("migrations/014_expand_role_check.sql")),
    ("015", include_str!("migrations/015_floor_tables_restaurant_id.sql")),
    ("016", include_str!("migrations/016_floor_tables_composite_unique.sql")),
    ("017", include_str!("migrations/017_fix_floor_tables_composite_unique.sql")),
    ("018", include_str!("migrations/018_updated_at_triggers.sql")),
    ("019", include_str!("migrations/019_fix_trigger_recursion.sql")),
    ("020", include_str!("migrations/020_drop_all_triggers.sql")),
];

// ─── Helpers ────────────────────────────────────────────────────────────────

async fn exec_statements(conn: &Connection, sql: &str) {
    for raw in sql.split(';') {
        let stripped: String = raw
            .lines()
            .skip_while(|l| { let t = l.trim(); t.is_empty() || t.starts_with("--") })
            .collect::<Vec<_>>()
            .join("\n");
        let stmt = stripped.trim();
        if stmt.is_empty() { continue; }
        if let Err(e) = conn.execute(stmt, ()).await {
            let msg = e.to_string().to_lowercase();
            if msg.contains("duplicate column") || msg.contains("already exists") { continue; }
            eprintln!("[DB Migration] warning: {} — SQL: {}", msg, &stmt[..stmt.len().min(120)]);
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
    add_col!("order_items", "kitchen_status",  "kitchen_status TEXT NOT NULL DEFAULT 'pending'");
    add_col!("floor_tables","seat_count",      "seat_count INTEGER NOT NULL DEFAULT 4");
    add_col!("floor_tables","restaurant_id",   "restaurant_id TEXT REFERENCES restaurants(id)");

    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS table_sessions (
            id TEXT PRIMARY KEY, table_id TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            completed_at TEXT
        )", (),
    ).await;
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

        // Initial sync immediately
        sync::sync_restaurant(&local, &remote, &restaurant_id).await;

        // Then every 5 seconds
        loop {
            sleep(Duration::from_secs(5)).await;
            sync::sync_restaurant(&local, &remote, &restaurant_id).await;
        }
    });
}
