use tauri::State;
use libsql::{Connection, params};
use std::sync::Arc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TopProduct {
    pub id: String,
    pub name: String,
    pub order_count: i64,
    pub total_revenue: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategoryRevenue {
    pub id: String,
    pub name: String,
    pub total_revenue: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeakHour {
    pub hour: String,
    pub order_count: i64,
}

fn get_modifier(period: &str) -> &'static str {
    match period {
        "today" => "-1 days",
        "week" => "-7 days",
        "month" => "-1 month",
        "year" => "-1 year",
        _ => "-100 years"
    }
}

#[tauri::command]
pub async fn get_top_products(period: String, restaurant_id: String, db: State<'_, Arc<Connection>>) -> Result<Vec<TopProduct>, String> {
    let modifier = get_modifier(&period);
    
    let query = if period == "today" {
        r#"
        SELECT p.id, p.name, COALESCE(SUM(oi.quantity), 0) as order_count, COALESCE(SUM(oi.quantity * oi.price_at_order), 0) as total_revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        WHERE o.status = 'completed' AND o.is_deleted = 0 AND o.restaurant_id = ? AND date(o.created_at, 'localtime') = date('now', 'localtime')
        GROUP BY p.id
        ORDER BY order_count DESC
        "#
    } else {
        r#"
        SELECT p.id, p.name, COALESCE(SUM(oi.quantity), 0) as order_count, COALESCE(SUM(oi.quantity * oi.price_at_order), 0) as total_revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        WHERE o.status = 'completed' AND o.is_deleted = 0 AND o.restaurant_id = ? AND o.created_at >= datetime('now', 'localtime', ?)
        GROUP BY p.id
        ORDER BY order_count DESC
        "#
    };

    let mut rows = if period == "today" {
        db.query(query, params![restaurant_id]).await.map_err(|e| format!("Database error: {}", e))?
    } else {
        db.query(query, params![restaurant_id, modifier.to_string()]).await.map_err(|e| format!("Database error: {}", e))?
    };

    let mut results = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        results.push(TopProduct {
            id: row.get::<String>(0).unwrap_or_default(),
            name: row.get::<String>(1).unwrap_or_default(),
            order_count: row.get::<i64>(2).unwrap_or(0),
            total_revenue: row.get::<i64>(3).unwrap_or(0),
        });
    }

    Ok(results)
}

#[tauri::command]
pub async fn get_revenue_by_category(period: String, restaurant_id: String, db: State<'_, Arc<Connection>>) -> Result<Vec<CategoryRevenue>, String> {
    let modifier = get_modifier(&period);
    
    let query = if period == "today" {
        r#"
        SELECT c.id, c.name, COALESCE(SUM(oi.quantity * oi.price_at_order), 0) as total_revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        JOIN categories c ON c.id = p.category_id
        WHERE o.status = 'completed' AND o.is_deleted = 0 AND o.restaurant_id = ? AND date(o.created_at, 'localtime') = date('now', 'localtime')
        GROUP BY c.id
        ORDER BY total_revenue DESC
        "#
    } else {
        r#"
        SELECT c.id, c.name, COALESCE(SUM(oi.quantity * oi.price_at_order), 0) as total_revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        JOIN categories c ON c.id = p.category_id
        WHERE o.status = 'completed' AND o.is_deleted = 0 AND o.restaurant_id = ? AND o.created_at >= datetime('now', 'localtime', ?)
        GROUP BY c.id
        ORDER BY total_revenue DESC
        "#
    };

    let mut rows = if period == "today" {
        db.query(query, params![restaurant_id]).await.map_err(|e| format!("Database error: {}", e))?
    } else {
        db.query(query, params![restaurant_id, modifier.to_string()]).await.map_err(|e| format!("Database error: {}", e))?
    };

    let mut results = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        results.push(CategoryRevenue {
            id: row.get::<String>(0).unwrap_or_default(),
            name: row.get::<String>(1).unwrap_or_default(),
            total_revenue: row.get::<i64>(2).unwrap_or(0),
        });
    }

    Ok(results)
}

#[tauri::command]
pub async fn get_peak_hours(period: String, restaurant_id: String, db: State<'_, Arc<Connection>>) -> Result<Vec<PeakHour>, String> {
    let modifier = get_modifier(&period);
    
    let query = if period == "today" {
        r#"
        SELECT strftime('%H:00', o.created_at, 'localtime') as hour, COUNT(DISTINCT o.id) as order_count
        FROM orders o
        WHERE o.status = 'completed' AND o.is_deleted = 0 AND o.restaurant_id = ? AND date(o.created_at, 'localtime') = date('now', 'localtime')
        GROUP BY hour
        ORDER BY hour ASC
        "#
    } else {
        r#"
        SELECT strftime('%H:00', o.created_at, 'localtime') as hour, COUNT(DISTINCT o.id) as order_count
        FROM orders o
        WHERE o.status = 'completed' AND o.is_deleted = 0 AND o.restaurant_id = ? AND o.created_at >= datetime('now', 'localtime', ?)
        GROUP BY hour
        ORDER BY hour ASC
        "#
    };

    let mut rows = if period == "today" {
        db.query(query, params![restaurant_id]).await.map_err(|e| format!("Database error: {}", e))?
    } else {
        db.query(query, params![restaurant_id, modifier.to_string()]).await.map_err(|e| format!("Database error: {}", e))?
    };

    let mut results = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        results.push(PeakHour {
            hour: row.get::<String>(0).unwrap_or_default(),
            order_count: row.get::<i64>(1).unwrap_or(0),
        });
    }

    Ok(results)
}

#[tauri::command]
pub async fn get_slow_movers(restaurant_id: String, db: State<'_, Arc<Connection>>) -> Result<Vec<TopProduct>, String> {
    let query = r#"
        SELECT p.id, p.name, COALESCE(SUM(oi.quantity), 0) as order_count, COALESCE(SUM(oi.quantity * oi.price_at_order), 0) as total_revenue
        FROM products p
        LEFT JOIN order_items oi ON oi.product_id = p.id
        LEFT JOIN orders o ON o.id = oi.order_id AND o.status = 'completed' AND o.is_deleted = 0 AND o.restaurant_id = ? AND o.created_at >= datetime('now', 'localtime', '-30 days')
        WHERE p.is_available = 1 AND p.restaurant_id = ?
        GROUP BY p.id
        HAVING order_count < 3
        ORDER BY order_count ASC
    "#;

    let mut rows = db.query(query, params![restaurant_id.clone(), restaurant_id]).await.map_err(|e| format!("Database error: {}", e))?;

    let mut results = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        results.push(TopProduct {
            id: row.get::<String>(0).unwrap_or_default(),
            name: row.get::<String>(1).unwrap_or_default(),
            order_count: row.get::<i64>(2).unwrap_or(0),
            total_revenue: row.get::<i64>(3).unwrap_or(0),
        });
    }

    Ok(results)
}
