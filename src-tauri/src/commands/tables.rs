use tauri::State;
use sqlx::SqlitePool;
use crate::models::FloorTable;

#[tauri::command]
pub async fn get_tables(pool: State<'_, SqlitePool>) -> Result<Vec<FloorTable>, String> {
    // Compute 3-state status from live order/item data:
    //   available = no open order for this table
    //   ordering  = open order exists with at least one non-done item (pending/cooking)
    //   serving   = open order exists and all items are done (food is ready to serve)
    let tables: Vec<FloorTable> = sqlx::query_as(
        "SELECT
            ft.id,
            ft.name,
            ft.seat_count,
            CASE
                WHEN NOT EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.table_id = ft.name AND o.status = 'open' AND o.is_deleted = 0
                ) THEN 'available'
                WHEN EXISTS (
                    SELECT 1 FROM order_items oi
                    JOIN orders o ON oi.order_id = o.id
                    WHERE o.table_id = ft.name AND o.status = 'open' AND o.is_deleted = 0
                      AND oi.is_deleted = 0 AND oi.kitchen_status != 'done'
                ) THEN 'ordering'
                ELSE 'serving'
            END AS status
         FROM floor_tables ft
         WHERE ft.is_deleted = 0
         ORDER BY ft.name"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(tables)
}

#[tauri::command]
pub async fn create_table(
    name: String,
    seat_count: Option<i64>,
    pool: State<'_, SqlitePool>,
) -> Result<FloorTable, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let seats = seat_count.unwrap_or(4);
    sqlx::query(
        "INSERT INTO floor_tables (id, name, status, seat_count) VALUES (?, ?, 'free', ?)"
    )
    .bind(&id)
    .bind(&name)
    .bind(seats)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(FloorTable {
        id,
        name,
        status: "available".to_string(),
        seat_count: seats,
    })
}

#[tauri::command]
pub async fn delete_table(id: String, pool: State<'_, SqlitePool>) -> Result<(), String> {
    sqlx::query("UPDATE floor_tables SET is_deleted=1 WHERE id=?")
        .bind(&id)
        .execute(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}
