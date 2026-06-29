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
use tauri::Emitter;
use crate::db::RemoteDb;

/// Epoch start — used on first-ever sync to download everything
const EPOCH: &str = "1970-01-01 00:00:00";

// ─── Tables that need per-restaurant sync ────────────────────────────────────
// Each entry: (table_name, primary_key_col, restaurant_id_col)
// "direct" = restaurant_id is directly on the table
// "via_orders" = link through orders.restaurant_id

const RESTAURANT_TABLES: &[(&str, &str, SyncMode)] = &[
    ("restaurants",     "id",           SyncMode::Direct),
    ("users",           "id",           SyncMode::Direct),
    ("categories",      "id",           SyncMode::Direct),
    ("products",        "id",           SyncMode::Direct),
    ("product_variants", "id",          SyncMode::Direct),
    ("product_modifier_groups", "id",   SyncMode::Direct),
    ("product_modifier_options", "id",  SyncMode::Direct),
    ("floor_tables",    "id",           SyncMode::Direct),
    ("exchange_rates",  "id",           SyncMode::Direct),
    ("inventory_items", "id",           SyncMode::Direct),
    ("orders",          "id",           SyncMode::Direct),
    ("order_items",     "id",           SyncMode::ViaOrders),
    ("order_item_modifiers", "id",      SyncMode::Direct),
    ("payments",        "id",           SyncMode::ViaOrders),
    ("table_sessions",  "id",           SyncMode::Direct),  // table_id links to floor_tables
    ("inventory_logs",  "id",           SyncMode::Direct),
    ("app_audit_logs",  "id",           SyncMode::Direct),
    ("daily_reports", "id",            SyncMode::Direct),
    ("daily_report_expenses", "id",    SyncMode::Direct),
    ("_sync_state",     "restaurant_id", SyncMode::Direct),
];

#[derive(Clone, Copy)]
pub enum SyncMode {
    /// Table has a direct `restaurant_id` column
    Direct,
    /// Table links via order_id → orders.restaurant_id (order_items, payments)
    ViaOrders,
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
        "INSERT INTO _sync_state (restaurant_id, synced_at, updated_at) VALUES (?, ?, datetime('now'))
         ON CONFLICT(restaurant_id) DO UPDATE SET synced_at = excluded.synced_at, updated_at = datetime('now')",
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
/// Uses last-writer-wins: only overwrites local if remote updated_at >= local updated_at.
/// Logs conflicts to _sync_conflicts when a row exists locally with a newer timestamp.
pub async fn pull_table(
    remote: &Connection,
    local: &Connection,
    table: &str,
    _pk: &str,
    mode: SyncMode,
    restaurant_id: &str,
    since: &str,
) -> anyhow::Result<usize> {
    // Get common column list (exists in both local and remote)
    let local_cols  = get_columns(local, table).await;
    let remote_cols = get_columns(remote, table).await;
    let cols: Vec<String> = local_cols.into_iter().filter(|c| remote_cols.contains(c)).collect();

    if cols.is_empty() {
        return Ok(0);
    }

    let col_list = cols.join(", ");
    let prefixed_cols = cols.iter().map(|c| format!("{}.{}", table, c)).collect::<Vec<_>>().join(", ");
    let placeholders = cols.iter().map(|_| "?").collect::<Vec<_>>().join(", ");

    let pk_idx = cols.iter().position(|c| c == _pk);
    let updated_at_idx = cols.iter().position(|c| c == "updated_at");

    // Build the "DO UPDATE SET" part — only update when remote is newer
    let update_set = if let Some(ua_idx) = updated_at_idx {
        let ua_col = &cols[ua_idx];
        cols.iter()
            .filter(|&c| c != _pk)
            .map(|c| format!("{} = excluded.{}", c, c))
            .collect::<Vec<_>>()
            .join(", ")
            + &format!(" WHERE excluded.{} >= {}.{}", ua_col, table, ua_col)
    } else {
        cols.iter()
            .filter(|&c| c != _pk)
            .map(|c| format!("{} = excluded.{}", c, c))
            .collect::<Vec<_>>()
            .join(", ")
    };

    // Use strict > (not >=) so rows updated exactly at the boundary are not re-pulled.
    // set_last_sync_at stores synced_at = datetime('now') AFTER this cycle completes,
    // so any row updated before that moment was already included in this pass.
    // PUSH uses the same strict > convention — keep them in sync to avoid asymmetry.
    let sql = match mode {
        SyncMode::Direct => {
            let filter_col = if table == "restaurants" { "id" } else { "restaurant_id" };
            format!(
                "SELECT {} FROM {} WHERE {} = ? AND updated_at > ?",
                col_list, table, filter_col
            )
        },
        SyncMode::ViaOrders => format!(
            "SELECT {} FROM {}
             JOIN orders o ON {}.order_id = o.id
             WHERE o.restaurant_id = ? AND {}.updated_at > ?",
            prefixed_cols, table, table, table
        ),
    };

    println!("[Sync] Pulling table={} since={}", table, since);
    let mut rows = remote.query(&sql, params![restaurant_id, since]).await.map_err(|e| anyhow::anyhow!("Remote query failed: {}", e))?;

    let upsert = if update_set.is_empty() {
        format!("INSERT OR IGNORE INTO {} ({}) VALUES ({})", table, col_list, placeholders)
    } else {
        format!(
            "INSERT INTO {} ({}) VALUES ({}) ON CONFLICT({}) DO UPDATE SET {}",
            table, col_list, placeholders, _pk, update_set
        )
    };

    let mut count = 0;
    while let Some(row) = rows.next().await? {
        let mut vals: Vec<libsql::Value> = Vec::new();
        for i in 0..cols.len() {
            vals.push(row.get_value(i as i32).unwrap_or(libsql::Value::Null));
        }

        // Detect conflict: row exists locally with newer updated_at than remote
        if let (Some(pk_i), Some(ua_i)) = (pk_idx, updated_at_idx) {
            if let (libsql::Value::Text(row_id), libsql::Value::Text(remote_ua)) =
                (&vals[pk_i], &vals[ua_i])
            {
                let local_ua_result = local.query(
                    &format!("SELECT updated_at FROM {} WHERE {} = ?", table, _pk),
                    [row_id.clone()],
                ).await;
                if let Ok(mut local_rows) = local_ua_result {
                    if let Ok(Some(local_row)) = local_rows.next().await {
                        let local_ua = local_row.get::<String>(0).unwrap_or_default();
                        if !local_ua.is_empty() && local_ua.as_str() > remote_ua.as_str() {
                            let conflict_id = uuid::Uuid::new_v4().to_string();
                            let _ = local.execute(
                                "INSERT OR IGNORE INTO _sync_conflicts (id, table_name, row_id, local_updated_at, remote_updated_at, winner, created_at) VALUES (?, ?, ?, ?, ?, 'local', datetime('now'))",
                                params![conflict_id, table.to_string(), row_id.clone(), local_ua.clone(), remote_ua.clone()],
                            ).await;
                            eprintln!("[Sync] Conflict: table={} row={} local={} remote={} — keeping local (newer)", table, row_id, local_ua, remote_ua);
                            count += 1;
                            continue;
                        }
                    }
                }
            }
        }

        if let Err(e) = local.execute(&upsert, vals).await {
            eprintln!("[Sync] Pull insert failed for table {}: {} | SQL: {}", table, e, upsert);
        } else {
            count += 1;
        }
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
    // Get common columns
    let local_cols  = get_columns(local, table).await;
    let remote_cols = get_columns(remote, table).await;
    let cols: Vec<String> = local_cols.into_iter().filter(|c| remote_cols.contains(c)).collect();

    if cols.is_empty() { return Ok(0); }

    let col_list = cols.join(", ");
    let prefixed_cols = cols.iter().map(|c| format!("{}.{}", table, c)).collect::<Vec<_>>().join(", ");
    let placeholders = cols.iter().map(|_| "?").collect::<Vec<_>>().join(", ");

    // Strict > boundary: consistent with PULL — rows at the exact synced_at timestamp
    // were already sent in the previous cycle, so exclude them here to avoid duplicate pushes.
    let sql = match mode {
        SyncMode::Direct => {
            let filter_col = if table == "restaurants" { "id" } else { "restaurant_id" };
            format!(
                "SELECT {} FROM {} WHERE {} = ? AND updated_at > ?",
                col_list, table, filter_col
            )
        },
        SyncMode::ViaOrders => format!(
            "SELECT {} FROM {}
             JOIN orders o ON {}.order_id = o.id
             WHERE o.restaurant_id = ? AND {}.updated_at > ?",
            prefixed_cols, table, table, table
        ),
    };

    let mut rows = local.query(&sql, params![restaurant_id, since]).await.map_err(|e| anyhow::anyhow!("Local query failed: {}", e))?;

    // Build the "DO UPDATE SET" part, excluding the primary key
    let update_set = cols.iter()
        .filter(|&c| c != _pk)
        .map(|c| format!("{} = excluded.{}", c, c))
        .collect::<Vec<_>>()
        .join(", ");

    let upsert = if update_set.is_empty() {
        format!("INSERT OR IGNORE INTO {} ({}) VALUES ({})", table, col_list, placeholders)
    } else {
        format!(
            "INSERT INTO {} ({}) VALUES ({}) ON CONFLICT({}) DO UPDATE SET {}",
            table, col_list, placeholders, _pk, update_set
        )
    };

    let mut count = 0;
    while let Some(row) = rows.next().await? {
        let mut vals: Vec<libsql::Value> = Vec::new();
        for i in 0..cols.len() {
            vals.push(row.get_value(i as i32).unwrap_or(libsql::Value::Null));
        }
        if let Err(e) = remote.execute(&upsert, vals).await {
            eprintln!("[Sync] Push insert failed for table {}: {} | SQL: {}", table, e, upsert);
        } else {
            count += 1;
        }
    }

    if count > 0 {
        println!("[Sync] Table={} Pushed {} rows", table, count);
    }
    Ok(count)
}

/// Returns (push_since, pull_since) for a specific table.
/// Falls back to the global_since cursor if no per-table record exists.
async fn get_table_cursors(local: &Connection, table: &str, restaurant_id: &str, global_since: &str) -> (String, String) {
    let result = local.query(
        "SELECT last_push_at, last_pull_at FROM _sync_table_state WHERE table_name = ? AND restaurant_id = ?",
        params![table.to_string(), restaurant_id.to_string()],
    ).await;

    if let Ok(mut rows) = result {
        if let Ok(Some(row)) = rows.next().await {
            let push_at = row.get::<String>(0).unwrap_or_else(|_| global_since.to_string());
            let pull_at = row.get::<String>(1).unwrap_or_else(|_| global_since.to_string());
            return (push_at, pull_at);
        }
    }
    (global_since.to_string(), global_since.to_string())
}

/// Update per-table sync cursors after a successful push/pull.
async fn update_table_cursors(local: &Connection, table: &str, restaurant_id: &str, push_ok: bool, pull_ok: bool, now: &str) {
    let _ = local.execute(
        "INSERT INTO _sync_table_state (table_name, restaurant_id, last_push_at, last_pull_at, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(table_name, restaurant_id) DO UPDATE SET
             last_push_at = CASE WHEN ? THEN excluded.last_push_at ELSE last_push_at END,
             last_pull_at = CASE WHEN ? THEN excluded.last_pull_at ELSE last_pull_at END,
             updated_at = excluded.updated_at",
        params![
            table.to_string(),
            restaurant_id.to_string(),
            now.to_string(),
            now.to_string(),
            now.to_string(),
            push_ok as i64,
            pull_ok as i64,
        ],
    ).await;
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
pub async fn sync_restaurant(
    handle: &tauri::AppHandle,
    local: &Connection,
    remote: &Connection,
    restaurant_id: &str,
) -> usize {
    let _ = handle.emit("dineos:sync-start", ());
    
    // 1. Connectivity Check
    if let Err(_) = remote.execute("SELECT 1", ()).await {
        println!("[Sync] Offline mode: restaurant={} (remote unreachable)", restaurant_id);
        let _ = handle.emit("dineos:sync-end", ());
        return 0;
    }

    let global_since = get_last_sync_at(local, restaurant_id).await;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();

    let mut total = 0;

    for (table, pk, mode) in RESTAURANT_TABLES {
        // Use per-table cursor when available; fall back to global cursor for first run
        let (push_since, pull_since) = get_table_cursors(local, table, restaurant_id, &global_since).await;

        println!("[Sync] Scanning table={} push_since={} pull_since={} restaurant={}", table, push_since, pull_since, restaurant_id);

        // Push local → remote
        let push_ok = match push_table(local, remote, table, pk, *mode, restaurant_id, &push_since).await {
            Ok(n) => { total += n; true }
            Err(e) => {
                let msg = e.to_string();
                if msg.contains("Hrana") || msg.contains("stream error") {
                    println!("[Sync] Connection lost during push on table {}", table);
                    return total; // Abort cycle
                }
                eprintln!("[Sync] Push {} error: {}", table, e);
                false
            }
        };

        // Pull remote → local, wrapped in a local transaction for atomicity
        let pull_ok = {
            let begin_result = local.execute("BEGIN IMMEDIATE", ()).await;
            if begin_result.is_err() {
                // Could not start transaction — attempt pull without one
                match pull_table(remote, local, table, pk, *mode, restaurant_id, &pull_since).await {
                    Ok(n) => { total += n; true }
                    Err(e) => {
                        let msg = e.to_string();
                        if msg.contains("Hrana") || msg.contains("stream error") {
                            println!("[Sync] Connection lost during pull on table {}", table);
                            return total;
                        }
                        eprintln!("[Sync] Pull {} error: {}", table, e);
                        false
                    }
                }
            } else {
                match pull_table(remote, local, table, pk, *mode, restaurant_id, &pull_since).await {
                    Ok(n) => {
                        let _ = local.execute("COMMIT", ()).await;
                        total += n;
                        true
                    }
                    Err(e) => {
                        let _ = local.execute("ROLLBACK", ()).await;
                        let msg = e.to_string();
                        if msg.contains("Hrana") || msg.contains("stream error") {
                            println!("[Sync] Connection lost during pull on table {} — rolled back", table);
                            return total;
                        }
                        eprintln!("[Sync] Pull {} error (rolled back): {}", table, e);
                        false
                    }
                }
            }
        };

        // Update per-table cursor only when that direction succeeded
        if push_ok || pull_ok {
            update_table_cursors(local, table, restaurant_id, push_ok, pull_ok, &now).await;
        }
    }

    if total > 0 {
        println!("[Sync] restaurant={} synced {} rows (since {since})", restaurant_id, total, since = global_since);
    } else {
        // Minimal heartbeat to show it's alive
        println!("[Sync] Heartbeat: restaurant={} is up to date.", restaurant_id);
    }
    set_last_sync_at(local, restaurant_id, &now).await;
    let _ = handle.emit("dineos:sync-end", ());
    total
}

/// Reset the sync state for a restaurant, causing the NEXT sync cycle 
/// to be a full re-upload/download (push/pull from EPOCH).
#[tauri::command]
pub async fn trigger_sync_reset(
    restaurant_id: String,
    local: tauri::State<'_, Arc<Connection>>,
) -> Result<(), String> {
    println!("[Sync] Reset triggered for restaurant={}. Next cycle will be a full sync.", restaurant_id);

    local.execute(
        "DELETE FROM _sync_state WHERE restaurant_id = ?",
        [restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn is_restaurant_synced(
    restaurant_id: String,
    local: tauri::State<'_, Arc<Connection>>,
    remote: tauri::State<'_, RemoteDb>,
) -> Result<bool, String> {
    // Step 1: Check if we already have local data for this restaurant.
    // If yes, the user can work immediately regardless of internet state.
    // The sync daemon will handle cloud sync in the background.
    let mut rows = local.query(
        "SELECT synced_at FROM _sync_state WHERE restaurant_id = ?",
        params![restaurant_id.clone()]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    if let Ok(Some(row)) = rows.next().await {
        let synced_at = row.get::<String>(0).unwrap_or_default();
        if !synced_at.trim().starts_with("1970-01-01") {
            // ✅ Already synced before — let the user in immediately (offline-safe)
            return Ok(true);
        }
    }

    // Step 2: No local sync record. This is a first-time setup on this device.
    // Check if cloud is reachable to do the initial data download.
    let Some(remote_conn) = &remote.0 else {
        // No remote configured — local-only mode, allow access
        return Ok(true);
    };

    if remote_conn.query("SELECT 1", ()).await.is_err() {
        // Cloud unreachable AND no local data — user needs internet for first sync.
        // Return false to keep showing the sync screen until connection appears.
        return Ok(false);
    }

    // Cloud is reachable, check if the initial sync has completed via _sync_state
    let mut remote_rows = local.query(
        "SELECT synced_at FROM _sync_state WHERE restaurant_id = ?",
        params![restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    if let Ok(Some(row)) = remote_rows.next().await {
        let synced_at = row.get::<String>(0).unwrap_or_default();
        return Ok(!synced_at.trim().starts_with("1970-01-01"));
    }

    Ok(false)
}

/// Returns the count of unresolved sync conflicts detected in the last 24 hours.
#[tauri::command]
pub async fn get_sync_conflict_count(
    local: tauri::State<'_, Arc<Connection>>,
) -> Result<i64, String> {
    let mut rows = local.query(
        "SELECT COUNT(*) FROM _sync_conflicts WHERE resolved_at IS NULL AND created_at >= datetime('now', '-1 day')",
        (),
    ).await.map_err(|e| format!("Database error: {}", e))?;

    if let Ok(Some(row)) = rows.next().await {
        return Ok(row.get::<i64>(0).unwrap_or(0));
    }
    Ok(0)
}
