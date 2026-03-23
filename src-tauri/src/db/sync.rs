/// sync.rs — Per-restaurant selective cloud sync
/// 
/// Architecture overview:
/// - PULL: reads rows from Turso remote WHERE restaurant_id = ? AND updated_at > last_sync_at
///         and upserts them into the local SQLite.
/// - PUSH: reads locally-changed rows (updated_at > last_push_at) WHERE restaurant_id = ?
///         and upserts them into Turso remote.
/// 
/// On first login for a restaurant: full download (last_sync_at = epoch 0)
/// On subsequent logins: incremental sync only (last_sync_at = stored timestamp)

use libsql::{Connection, params};
use std::sync::Arc;

/// Epoch start — used on first-ever sync to download everything
const EPOCH: &str = "1970-01-01T00:00:00";

// ─── Tables that need per-restaurant sync ────────────────────────────────────
// Each entry: (table_name, primary_key_col, restaurant_id_col)
// "direct" = restaurant_id is directly on the table
// "via_orders" = link through orders.restaurant_id

const RESTAURANT_TABLES: &[(&str, &str, SyncMode)] = &[
    ("restaurants",     "id",           SyncMode::Direct),
    ("users",           "id",           SyncMode::Direct),
    ("categories",      "id",           SyncMode::Direct),
    ("products",        "id",           SyncMode::Direct),
    ("floor_tables",    "id",           SyncMode::Direct),
    ("exchange_rates",  "id",           SyncMode::Direct),
    ("inventory_items", "id",           SyncMode::Direct),
    ("orders",          "id",           SyncMode::Direct),
    ("order_items",     "id",           SyncMode::ViaOrders),
    ("payments",        "id",           SyncMode::ViaOrders),
    ("table_sessions",  "id",           SyncMode::Direct),  // table_id links to floor_tables
    ("product_ingredients", "id",       SyncMode::NoFilter), // product-scoped, no restaurant_id
    ("inventory_logs",  "id",           SyncMode::Direct),
];

#[derive(Clone, Copy)]
pub enum SyncMode {
    /// Table has a direct `restaurant_id` column
    Direct,
    /// Table links via order_id → orders.restaurant_id (order_items, payments)
    ViaOrders,
    /// Table has no restaurant_id, sync all rows
    NoFilter,
}

/// Returns the last sync timestamp stored for this restaurant in the local DB.
/// Returns EPOCH string if never synced.
pub async fn get_last_sync_at(local: &Connection, restaurant_id: &str) -> String {
    let result = local.query(
        "SELECT synced_at FROM _sync_state WHERE restaurant_id = ?",
        [restaurant_id],
    ).await;

    match result {
        Ok(mut rows) => {
            if let Ok(Some(row)) = rows.next().await {
                return row.get::<String>(0).unwrap_or_else(|_| EPOCH.to_string());
            }
            EPOCH.to_string()
        }
        Err(_) => EPOCH.to_string(),
    }
}

/// Persist the sync timestamp for a restaurant.
pub async fn set_last_sync_at(local: &Connection, restaurant_id: &str, ts: &str) {
    let _ = local.execute(
        "INSERT INTO _sync_state (restaurant_id, synced_at) VALUES (?, ?)
         ON CONFLICT(restaurant_id) DO UPDATE SET synced_at = excluded.synced_at",
        params![restaurant_id, ts],
    ).await;
}

/// Ensure the sync state tracking table exists.
pub async fn ensure_sync_table(conn: &Connection) {
    let _ = conn.execute(
        "CREATE TABLE IF NOT EXISTS _sync_state (
            restaurant_id TEXT PRIMARY KEY,
            synced_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00'
        )",
        (),
    ).await;
}

/// PULL: download rows from remote that changed after `since` for this restaurant.
/// Upserts them into local DB using INSERT OR REPLACE.
pub async fn pull_table(
    remote: &Connection,
    local: &Connection,
    table: &str,
    _pk: &str,
    mode: SyncMode,
    restaurant_id: &str,
    since: &str,
) -> anyhow::Result<usize> {
    // Get column list for this table from local PRAGMA
    let cols = get_columns(local, table).await;
    if cols.is_empty() {
        return Ok(0);
    }

    let col_list = cols.join(", ");
    let placeholders = cols.iter().map(|_| "?").collect::<Vec<_>>().join(", ");

    let sql = match mode {
        SyncMode::Direct => format!(
            "SELECT {} FROM {} WHERE restaurant_id = ? AND updated_at > ?",
            col_list, table
        ),
        SyncMode::ViaOrders => format!(
            "SELECT {t}.{collist} FROM {t}
             JOIN orders o ON {t}.order_id = o.id
             WHERE o.restaurant_id = ? AND {t}.updated_at > ?",
            t = table,
            collist = col_list
        ),
        SyncMode::NoFilter => format!(
            "SELECT {} FROM {} WHERE updated_at > 'EPOCH_PLACEHOLDER'",
            col_list, table
        ).replace("EPOCH_PLACEHOLDER", since),
    };

    let mut rows = match mode {
        SyncMode::NoFilter => remote.query(&sql, ()).await?,
        _ => remote.query(&sql, params![restaurant_id, since]).await?,
    };

    let upsert = format!(
        "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
        table, col_list, placeholders
    );

    let mut count = 0;
    while let Some(row) = rows.next().await? {
        // Build values vec
        let mut vals: Vec<libsql::Value> = Vec::new();
        for i in 0..cols.len() {
            vals.push(row.get_value(i as i32).unwrap_or(libsql::Value::Null));
        }
        local.execute(&upsert, vals).await.ok();
        count += 1;
    }

    Ok(count)
}

/// PUSH: upload locally-changed rows to remote.
pub async fn push_table(
    local: &Connection,
    remote: &Connection,
    table: &str,
    _pk: &str,
    mode: SyncMode,
    restaurant_id: &str,
    since: &str,
) -> anyhow::Result<usize> {
    let cols = get_columns(local, table).await;
    if cols.is_empty() { return Ok(0); }

    let col_list = cols.join(", ");
    let placeholders = cols.iter().map(|_| "?").collect::<Vec<_>>().join(", ");

    let sql = match mode {
        SyncMode::Direct => format!(
            "SELECT {} FROM {} WHERE restaurant_id = ? AND updated_at > ?",
            col_list, table
        ),
        SyncMode::ViaOrders => format!(
            "SELECT {t}.{collist} FROM {t}
             JOIN orders o ON {t}.order_id = o.id
             WHERE o.restaurant_id = ? AND {t}.updated_at > ?",
            t = table, collist = col_list
        ),
        SyncMode::NoFilter => format!(
            "SELECT {} FROM {} WHERE updated_at > ?",
            col_list, table
        ),
    };

    let mut rows = match mode {
        SyncMode::NoFilter => local.query(&sql, [since]).await?,
        _ => local.query(&sql, params![restaurant_id, since]).await?,
    };

    let upsert = format!(
        "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
        table, col_list, placeholders
    );

    let mut count = 0;
    while let Some(row) = rows.next().await? {
        let mut vals: Vec<libsql::Value> = Vec::new();
        for i in 0..cols.len() {
            vals.push(row.get_value(i as i32).unwrap_or(libsql::Value::Null));
        }
        remote.execute(&upsert, vals).await.ok();
        count += 1;
    }

    Ok(count)
}

/// Get column names for a table via PRAGMA.
async fn get_columns(conn: &Connection, table: &str) -> Vec<String> {
    let sql = format!("PRAGMA table_info({})", table);
    let mut rows = match conn.query(&sql, ()).await {
        Ok(r) => r,
        Err(_) => return vec![],
    };
    let mut cols = vec![];
    while let Ok(Some(row)) = rows.next().await {
        if let Ok(name) = row.get::<String>(1) {
            cols.push(name);
        }
    }
    cols
}

/// Run a full sync cycle (push then pull) for a restaurant.
/// Returns total rows synced.
pub async fn sync_restaurant(
    local: &Arc<Connection>,
    remote: &Arc<Connection>,
    restaurant_id: &str,
) -> usize {
    let since = get_last_sync_at(local, restaurant_id).await;
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string();

    let mut total = 0;

    for (table, pk, mode) in RESTAURANT_TABLES {
        // Push local → remote
        match push_table(local, remote, table, pk, *mode, restaurant_id, &since).await {
            Ok(n) => total += n,
            Err(e) => eprintln!("[Sync] Push {} error: {}", table, e),
        }
        // Pull remote → local
        match pull_table(remote, local, table, pk, *mode, restaurant_id, &since).await {
            Ok(n) => total += n,
            Err(e) => eprintln!("[Sync] Pull {} error: {}", table, e),
        }
    }

    if total > 0 {
        println!("[Sync] restaurant={} synced {} rows (since {})", restaurant_id, total, since);
    }
    set_last_sync_at(local, restaurant_id, &now).await;
    total
}
