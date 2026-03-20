use tauri::State;
use sqlx::SqlitePool;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TopProduct {
    pub id: String,
    pub name: String,
    pub order_count: i64,
    pub total_revenue: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CategoryRevenue {
    pub id: String,
    pub name: String,
    pub total_revenue: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PeakHour {
    pub hour: String,
    pub order_count: i64,
}

fn get_modifier(period: &str) -> &'static str {
    match period {
        "today" => "-1 days", // actually for today we just need start of day, but 24 hours is fine
        "week" => "-7 days",
        "month" => "-1 month",
        "year" => "-1 year",
        _ => "-100 years"
    }
}

#[tauri::command]
pub async fn get_top_products(period: String, db: State<'_, SqlitePool>) -> Result<Vec<TopProduct>, String> {
    let modifier = get_modifier(&period);
    
    // For today, we might want exact calendar day matching: `date(o.created_at, 'localtime') = date('now', 'localtime')`
    // but a relative `-1 days` etc works nicely for "last 24 hours". Let's use strict calendar matching for 'today'.
    let query = if period == "today" {
        r#"
        SELECT p.id, p.name, COALESCE(SUM(oi.quantity), 0) as order_count, COALESCE(SUM(oi.quantity * oi.price_at_time), 0) as total_revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        WHERE o.status = 'paid' AND o.is_deleted = 0 AND date(o.created_at, 'localtime') = date('now', 'localtime')
        GROUP BY p.id
        ORDER BY order_count DESC
        "#
    } else {
        r#"
        SELECT p.id, p.name, COALESCE(SUM(oi.quantity), 0) as order_count, COALESCE(SUM(oi.quantity * oi.price_at_time), 0) as total_revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        WHERE o.status = 'paid' AND o.is_deleted = 0 AND o.created_at >= datetime('now', 'localtime', ?)
        GROUP BY p.id
        ORDER BY order_count DESC
        "#
    };

    let result = if period == "today" {
        sqlx::query_as::<_, TopProduct>(query)
            .fetch_all(db.inner())
            .await
    } else {
        sqlx::query_as::<_, TopProduct>(query)
            .bind(modifier)
            .fetch_all(db.inner())
            .await
    };

    result.map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn get_revenue_by_category(period: String, db: State<'_, SqlitePool>) -> Result<Vec<CategoryRevenue>, String> {
    let modifier = get_modifier(&period);
    
    let query = if period == "today" {
        r#"
        SELECT c.id, c.name, COALESCE(SUM(oi.quantity * oi.price_at_time), 0) as total_revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        JOIN categories c ON c.id = p.category_id
        WHERE o.status = 'paid' AND o.is_deleted = 0 AND date(o.created_at, 'localtime') = date('now', 'localtime')
        GROUP BY c.id
        ORDER BY total_revenue DESC
        "#
    } else {
        r#"
        SELECT c.id, c.name, COALESCE(SUM(oi.quantity * oi.price_at_time), 0) as total_revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN products p ON p.id = oi.product_id
        JOIN categories c ON c.id = p.category_id
        WHERE o.status = 'paid' AND o.is_deleted = 0 AND o.created_at >= datetime('now', 'localtime', ?)
        GROUP BY c.id
        ORDER BY total_revenue DESC
        "#
    };

    let result = if period == "today" {
        sqlx::query_as::<_, CategoryRevenue>(query)
            .fetch_all(db.inner())
            .await
    } else {
        sqlx::query_as::<_, CategoryRevenue>(query)
            .bind(modifier)
            .fetch_all(db.inner())
            .await
    };

    result.map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn get_peak_hours(period: String, db: State<'_, SqlitePool>) -> Result<Vec<PeakHour>, String> {
    let modifier = get_modifier(&period);
    
    let query = if period == "today" {
        r#"
        SELECT strftime('%H:00', o.created_at, 'localtime') as hour, COUNT(DISTINCT o.id) as order_count
        FROM orders o
        WHERE o.status = 'paid' AND o.is_deleted = 0 AND date(o.created_at, 'localtime') = date('now', 'localtime')
        GROUP BY hour
        ORDER BY hour ASC
        "#
    } else {
        r#"
        SELECT strftime('%H:00', o.created_at, 'localtime') as hour, COUNT(DISTINCT o.id) as order_count
        FROM orders o
        WHERE o.status = 'paid' AND o.is_deleted = 0 AND o.created_at >= datetime('now', 'localtime', ?)
        GROUP BY hour
        ORDER BY hour ASC
        "#
    };

    let result = if period == "today" {
        sqlx::query_as::<_, PeakHour>(query)
            .fetch_all(db.inner())
            .await
    } else {
        sqlx::query_as::<_, PeakHour>(query)
            .bind(modifier)
            .fetch_all(db.inner())
            .await
    };

    result.map_err(|e| format!("Database error: {}", e))
}

#[tauri::command]
pub async fn get_slow_movers(db: State<'_, SqlitePool>) -> Result<Vec<TopProduct>, String> {
    // Products with < 3 orders in the last 30 days
    let query = r#"
        SELECT p.id, p.name, COALESCE(SUM(oi.quantity), 0) as order_count, COALESCE(SUM(oi.quantity * oi.price_at_time), 0) as total_revenue
        FROM products p
        LEFT JOIN order_items oi ON oi.product_id = p.id
        LEFT JOIN orders o ON o.id = oi.order_id AND o.status = 'paid' AND o.is_deleted = 0 AND o.created_at >= datetime('now', 'localtime', '-30 days')
        WHERE p.is_available = 1
        GROUP BY p.id
        HAVING order_count < 3
        ORDER BY order_count ASC
    "#;

    sqlx::query_as::<_, TopProduct>(query)
        .fetch_all(db.inner())
        .await
        .map_err(|e| format!("Database error: {}", e))
}
