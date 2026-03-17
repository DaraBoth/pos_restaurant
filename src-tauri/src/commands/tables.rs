use tauri::State;
use sqlx::SqlitePool;
use crate::models::FloorTable;

#[tauri::command]
pub async fn get_tables(pool: State<'_, SqlitePool>) -> Result<Vec<FloorTable>, String> {
    let tables: Vec<FloorTable> = sqlx::query_as(
        "SELECT
            ft.id,
            ft.name,
            CASE
                WHEN EXISTS (
                    SELECT 1
                    FROM orders o
                    WHERE o.table_id = ft.name AND o.status = 'open' AND o.is_deleted = 0
                ) THEN 'busy'
                ELSE 'free'
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
    pool: State<'_, SqlitePool>,
) -> Result<FloorTable, String> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO floor_tables (id, name, status) VALUES (?, ?, 'free')"
    )
    .bind(&id)
    .bind(&name)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(FloorTable {
        id,
        name,
        status: "free".to_string(),
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
