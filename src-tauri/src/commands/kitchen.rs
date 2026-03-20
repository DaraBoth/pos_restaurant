use tauri::State;
use libsql::{Connection, params};
use std::sync::Arc;
use crate::models::{KitchenOrder, KitchenOrderItem};

/// Returns all open orders that have at least one pending or cooking item.
/// Used by the Kitchen Screen to show what needs to be prepared.
#[tauri::command]
pub async fn get_kitchen_orders(
    pool: State<'_, Arc<Connection>>,
) -> Result<Vec<KitchenOrder>, String> {
    // Find open orders that have active (non-done) items
    let mut rows = pool.query(
        "SELECT DISTINCT o.id, o.table_id, o.created_at
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         WHERE o.status = 'open' AND o.is_deleted = 0
           AND oi.is_deleted = 0 AND oi.kitchen_status IN ('pending', 'cooking')
         ORDER BY o.created_at ASC",
         ()
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    let mut order_rows = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        order_rows.push((
            row.get::<String>(0).unwrap_or_default(),
            row.get::<String>(1).ok(),
            row.get::<String>(2).unwrap_or_default(),
        ));
    }

    let mut result = Vec::new();

    for (order_id, table_id, created_at) in order_rows {
        let mut item_rows = pool.query(
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
             ORDER BY oi.created_at ASC",
             params![order_id.clone()]
        )
        .await
        .map_err(|e| format!("Database error: {}", e))?;

        let mut items = Vec::new();
        while let Some(row) = item_rows.next().await.map_err(|e| e.to_string())? {
            items.push(KitchenOrderItem {
                id: row.get::<String>(0).unwrap_or_default(),
                product_name: row.get::<String>(1).unwrap_or_default(),
                product_khmer: row.get::<String>(2).ok(),
                quantity: row.get::<i64>(3).unwrap_or(1),
                note: row.get::<String>(4).ok(),
                kitchen_status: row.get::<String>(5).unwrap_or_default(),
                created_at: row.get::<String>(6).unwrap_or_default(),
            });
        }

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
    pool: State<'_, Arc<Connection>>,
) -> Result<(), String> {
    match status.as_str() {
        "pending" | "cooking" | "done" => {}
        _ => return Err(format!("Invalid kitchen status: {}", status)),
    }

    pool.execute(
        "UPDATE order_items SET kitchen_status = ? WHERE id = ? AND is_deleted = 0",
        params![status, item_id]
    )
    .await
    .map_err(|e| format!("Database error: {}", e))?;

    Ok(())
}
