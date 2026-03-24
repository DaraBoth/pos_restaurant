use tauri::State;
use libsql::{Connection, params};
use std::sync::Arc;
use crate::models::{ExchangeRate, DbStatus, Payment};

#[tauri::command]
pub async fn get_exchange_rate(restaurant_id: String, pool: State<'_, Arc<Connection>>) -> Result<ExchangeRate, String> {
    let mut rows = pool.query(
        "SELECT id, rate, effective_from FROM exchange_rates WHERE restaurant_id = ? ORDER BY effective_from DESC LIMIT 1",
        params![restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    if let Some(row) = rows.next().await.map_err(|e| format!("Row error: {}", e))? {
        Ok(ExchangeRate {
            id: row.get::<String>(0).unwrap_or_default(),
            rate: row.get::<f64>(1).unwrap_or(4100.0),
            effective_from: row.get::<String>(2).unwrap_or_default(),
        })
    } else {
        // Fallback to a default if no rate set for this restaurant yet
        Ok(ExchangeRate {
            id: "default".to_string(),
            rate: 4100.0,
            effective_from: "".to_string(),
        })
    }
}

#[tauri::command]
pub async fn set_exchange_rate(
    rate: f64,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<ExchangeRate, String> {
    let id = uuid::Uuid::new_v4().to_string();
    pool.execute(
        "INSERT INTO exchange_rates (id, rate, effective_from, restaurant_id) VALUES (?, ?, datetime('now'), ?)",
        params![id.clone(), rate, restaurant_id]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(ExchangeRate {
        id,
        rate,
        effective_from: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub async fn get_db_status(
    pool: State<'_, Arc<Connection>>,
    remote: State<'_, crate::db::RemoteDb>,
) -> Result<DbStatus, String> {
    let mut rows = pool.query("SELECT 1", ()).await.map_err(|e| e.to_string())?;
    let local_ok = rows.next().await.is_ok();
    
    let mut remote_connected = false;
    let mut error_message = None;

    if let Some(conn) = &remote.0 {
        match conn.query("SELECT 1", ()).await {
            Ok(mut r) => {
                remote_connected = r.next().await.is_ok();
            }
            Err(e) => {
                error_message = Some(e.to_string());
            }
        }
    } else {
        error_message = Some("No remote connection initialized".to_string());
    }

    let mode = if remote.0.is_none() { "local" } else { "synced" };

    Ok(DbStatus {
        connected: local_ok && (remote.0.is_none() || remote_connected),
        path: if remote.0.is_some() { "Turso Cloud" } else { "Local SQLite" }.to_string(),
        mode: mode.to_string(),
        error_message,
    })
}

#[tauri::command]
pub async fn get_payments_for_order(
    order_id: String,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<Vec<Payment>, String> {
    let mut rows = pool.query(
        "SELECT p.id, p.order_id, p.method, p.currency, p.amount, p.bakong_transaction_hash, p.created_at
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         WHERE p.order_id=? AND o.restaurant_id=? ORDER BY p.created_at",
        params![order_id, restaurant_id]
    ).await.map_err(|e| format!("Database error: {}", e))?;

    let mut payments = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| format!("Error mapping: {}", e))? {
        let bakong: Option<String> = match row.get_value(5) {
            Ok(libsql::Value::Text(s)) => Some(s),
            _ => None,
        };
        payments.push(Payment {
            id: row.get::<String>(0).unwrap_or_default(),
            order_id: row.get::<String>(1).unwrap_or_default(),
            method: row.get::<String>(2).unwrap_or_default(),
            currency: row.get::<String>(3).unwrap_or_default(),
            amount: row.get::<f64>(4).unwrap_or(0.0) as i64,
            bakong_transaction_hash: bakong,
            created_at: row.get::<String>(6).unwrap_or_default(),
        });
    }

    Ok(payments)
}
