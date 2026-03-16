use tauri::State;
use sqlx::SqlitePool;
use crate::models::{ExchangeRate, DbStatus};

#[tauri::command]
pub async fn get_exchange_rate(pool: State<'_, SqlitePool>) -> Result<ExchangeRate, String> {
    let rate: ExchangeRate = sqlx::query_as(
        "SELECT id, rate, effective_from FROM exchange_rates ORDER BY effective_from DESC LIMIT 1"
    )
    .fetch_one(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(rate)
}

#[tauri::command]
pub async fn set_exchange_rate(
    rate: f64,
    pool: State<'_, SqlitePool>,
) -> Result<ExchangeRate, String> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO exchange_rates (id, rate, effective_from) VALUES (?, ?, datetime('now'))"
    )
    .bind(&id)
    .bind(rate)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(ExchangeRate {
        id,
        rate,
        effective_from: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub async fn get_db_status(pool: State<'_, SqlitePool>) -> Result<DbStatus, String> {
    // Try a lightweight query to confirm DB is alive
    let ok: Result<(i64,), _> = sqlx::query_as("SELECT 1")
        .fetch_one(pool.inner())
        .await;

    Ok(DbStatus {
        connected: ok.is_ok(),
        path: "Local SQLite Database".to_string(),
        mode: "local".to_string(),
    })
}

#[tauri::command]
pub async fn get_payments_for_order(
    order_id: String,
    pool: State<'_, SqlitePool>,
) -> Result<Vec<crate::models::Payment>, String> {
    let payments: Vec<crate::models::Payment> = sqlx::query_as(
        "SELECT id, order_id, method, currency, amount, bakong_transaction_hash, created_at
         FROM payments WHERE order_id=? ORDER BY created_at"
    )
    .bind(&order_id)
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(payments)
}
