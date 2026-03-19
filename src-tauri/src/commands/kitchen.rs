use tauri::State;
use sqlx::SqlitePool;
use crate::models::{KitchenOrder, KitchenOrderItem};

/// Returns all open orders that have at least one pending or cooking item.
/// Used by the Kitchen Screen to show what needs to be prepared.
#[tauri::command]
pub async fn get_kitchen_orders(
    pool: State<'_, SqlitePool>,
) -> Result<Vec<KitchenOrder>, String> {
    // Find open orders that have active (non-done) items
    let order_rows: Vec<(String, Option<String>, String)> = sqlx::query_as(
        "SELECT DISTINCT o.id, o.table_id, o.created_at
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         WHERE o.status = 'open' AND o.is_deleted = 0
           AND oi.is_deleted = 0 AND oi.kitchen_status IN ('pending', 'cooking')
         ORDER BY o.created_at ASC"
    )
    .fetch_all(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let mut result = Vec::new();

    for (order_id, table_id, created_at) in order_rows {
        let items: Vec<KitchenOrderItem> = sqlx::query_as(
            "SELECT oi.id,
                    COALESCE(p.name, 'Unknown') AS product_name,
                    p.khmer_name AS product_khmer,
                    oi.quantity,
                    oi.note,
                    oi.kitchen_status,
                    oi.created_at
             FROM order_items oi
             LEFT JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ? AND oi.is_deleted = 0
               AND oi.kitchen_status IN ('pending', 'cooking')
             ORDER BY oi.created_at ASC"
        )
        .bind(&order_id)
        .fetch_all(pool.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        result.push(KitchenOrder {
            order_id,
            table_id,
            created_at,
            items,
        });
    }

    Ok(result)
}

/// Advances an order item through the kitchen workflow:
///   pending → cooking → done
#[tauri::command]
pub async fn update_kitchen_item_status(
    item_id: String,
    status: String,
    pool: State<'_, SqlitePool>,
) -> Result<(), String> {
    match status.as_str() {
        "pending" | "cooking" | "done" => {}
        _ => return Err(format!("Invalid kitchen status: {}", status)),
    }

    sqlx::query(
        "UPDATE order_items SET kitchen_status = ? WHERE id = ? AND is_deleted = 0"
    )
    .bind(&status)
    .bind(&item_id)
    .execute(pool.inner())
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(())
}
