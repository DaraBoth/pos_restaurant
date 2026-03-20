use tauri::State;
use libsql::{Connection, params};
use std::sync::Arc;
use crate::models::FloorTable;

#[tauri::command]
pub async fn get_tables(pool: State<'_, Arc<Connection>>) -> Result<Vec<FloorTable>, String> {
    let mut rows = pool.query(
        "SELECT
            ft.id,
            ft.name,
            ft.seat_count,
            CASE
                WHEN EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.table_id = ft.name AND o.status = 'pending_payment' AND o.is_deleted = 0
                ) THEN 'waiting'
                WHEN EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.table_id = ft.name AND o.status = 'open' AND o.is_deleted = 0
                ) THEN 'busy'
                ELSE 'available'
            END AS status
         FROM floor_tables ft
         WHERE ft.is_deleted = 0
         ORDER BY ft.name",
         ()
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let mut tables = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        tables.push(FloorTable {
            id: row.get::<String>(0).unwrap_or_default(),
            name: row.get::<String>(1).unwrap_or_default(),
            seat_count: row.get::<i64>(2).unwrap_or(4),
            status: row.get::<String>(3).unwrap_or_default(),
        });
    }

    Ok(tables)
}

#[tauri::command]
pub async fn create_table(
    name: String,
    seat_count: Option<i64>,
    pool: State<'_, Arc<Connection>>,
) -> Result<FloorTable, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let seats = seat_count.unwrap_or(4);
    
    pool.execute(
        "INSERT INTO floor_tables (id, name, status, seat_count) VALUES (?, ?, 'free', ?)",
        params![id.clone(), name.clone(), seats]
    )
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
pub async fn delete_table(id: String, pool: State<'_, Arc<Connection>>) -> Result<(), String> {
    pool.execute(
        "UPDATE floor_tables SET is_deleted=1 WHERE id=?",
        params![id]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;
    Ok(())
}
