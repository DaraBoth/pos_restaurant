use std::sync::Arc;

use libsql::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::rbac;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyReportExpenseInput {
    pub date: String,
    pub category: String,
    pub description: String,
    pub amount_usd_cents: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyReportExpense {
    pub id: String,
    pub report_id: String,
    pub date: String,
    pub category: String,
    pub description: String,
    pub amount_usd_cents: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyReport {
    pub id: String,
    pub restaurant_id: String,
    pub report_date: String,
    pub total_orders: i64,
    pub paid_orders: i64,
    pub voided_orders: i64,
    pub total_sales_usd: i64,
    pub total_sales_khr: i64,
    pub total_expenses_usd: i64,
    pub net_profit_usd: i64,
    pub notes: Option<String>,
    pub status: String,
    pub cashier_name: Option<String>,
    pub closed_by_user_id: Option<String>,
    pub closed_at: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyReportPreview {
    pub report_date: String,
    pub total_orders: i64,
    pub paid_orders: i64,
    pub voided_orders: i64,
    pub total_sales_usd: i64,
    pub total_sales_khr: i64,
    pub total_expenses_usd: i64,
    pub net_profit_usd: i64,
    pub inventory_total_usage_qty: f64,
    pub inventory_total_cost_usd: i64,
    pub inventory_usage: Vec<InventoryUsageRow>,
    pub is_closed: bool,
    pub existing_report_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InventoryUsageRow {
    pub inventory_item_id: String,
    pub inventory_item_name: String,
    pub unit_label: String,
    pub used_quantity: f64,
    pub cost_per_unit: f64,
    pub total_cost_usd: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyReportDetail {
    pub report: DailyReport,
    pub expenses: Vec<DailyReportExpense>,
    pub inventory_total_usage_qty: f64,
    pub inventory_total_cost_usd: i64,
    pub inventory_usage: Vec<InventoryUsageRow>,
}

#[derive(Debug, Clone)]
struct DailySalesSummary {
    total_orders: i64,
    paid_orders: i64,
    voided_orders: i64,
    total_sales_usd: i64,
    total_sales_khr: i64,
}

fn map_daily_report(row: &Row) -> DailyReport {
    DailyReport {
        id: row.get::<String>(0).unwrap_or_default(),
        restaurant_id: row.get::<String>(1).unwrap_or_default(),
        report_date: row.get::<String>(2).unwrap_or_default(),
        total_orders: row.get::<i64>(3).unwrap_or(0),
        paid_orders: row.get::<i64>(4).unwrap_or(0),
        voided_orders: row.get::<i64>(5).unwrap_or(0),
        total_sales_usd: row.get::<i64>(6).unwrap_or(0),
        total_sales_khr: row.get::<i64>(7).unwrap_or(0),
        total_expenses_usd: row.get::<i64>(8).unwrap_or(0),
        net_profit_usd: row.get::<i64>(9).unwrap_or(0),
        notes: row.get::<String>(10).ok(),
        status: row.get::<String>(11).unwrap_or_else(|_| "closed".to_string()),
        cashier_name: row.get::<String>(12).ok(),
        closed_by_user_id: row.get::<String>(13).ok(),
        closed_at: row.get::<String>(14).unwrap_or_default(),
        created_at: row.get::<String>(15).unwrap_or_default(),
        updated_at: row.get::<String>(16).unwrap_or_default(),
    }
}

async fn get_daily_sales_summary(
    conn: &Connection,
    restaurant_id: &str,
    report_date: &str,
) -> Result<DailySalesSummary, String> {
    let mut rows = conn
        .query(
            "SELECT 
                COUNT(*) AS total_orders,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS paid_orders,
                COALESCE(SUM(CASE WHEN status = 'void' THEN 1 ELSE 0 END), 0) AS voided_orders,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN total_usd ELSE 0 END), 0) AS total_sales_usd,
                COALESCE(SUM(CASE WHEN status = 'completed' THEN total_khr ELSE 0 END), 0) AS total_sales_khr
             FROM orders
             WHERE restaurant_id = ?
               AND is_deleted = 0
               AND date(created_at) = date(?)",
            params![restaurant_id.to_string(), report_date.to_string()],
        )
        .await
        .map_err(|e| format!("Failed to calculate daily summary: {}", e))?;

    if let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        Ok(DailySalesSummary {
            total_orders: row.get::<i64>(0).unwrap_or(0),
            paid_orders: row.get::<i64>(1).unwrap_or(0),
            voided_orders: row.get::<i64>(2).unwrap_or(0),
            total_sales_usd: row.get::<i64>(3).unwrap_or(0),
            total_sales_khr: row.get::<i64>(4).unwrap_or(0),
        })
    } else {
        Ok(DailySalesSummary {
            total_orders: 0,
            paid_orders: 0,
            voided_orders: 0,
            total_sales_usd: 0,
            total_sales_khr: 0,
        })
    }
}

async fn get_inventory_usage_summary(
    conn: &Connection,
    restaurant_id: &str,
    report_date: &str,
) -> Result<(f64, i64, Vec<InventoryUsageRow>), String> {
    let mut rows = conn
        .query(
            "SELECT
                ii.id,
                ii.name,
                ii.unit_label,
                ii.cost_per_unit,
                COALESCE(SUM(CAST(oi.quantity AS REAL) * pi.usage_quantity), 0) AS used_quantity
             FROM orders o
             JOIN order_items oi ON oi.order_id = o.id AND oi.is_deleted = 0
             JOIN product_ingredients pi ON pi.product_id = oi.product_id AND pi.restaurant_id = o.restaurant_id
             JOIN inventory_items ii ON ii.id = pi.inventory_item_id AND ii.restaurant_id = o.restaurant_id
             WHERE o.restaurant_id = ?
               AND o.is_deleted = 0
               AND o.status = 'completed'
               AND date(o.created_at) = date(?)
               AND COALESCE(ii.is_deleted, 0) = 0
             GROUP BY ii.id, ii.name, ii.unit_label, ii.cost_per_unit
             HAVING used_quantity > 0
             ORDER BY used_quantity DESC, ii.name ASC",
            params![restaurant_id.to_string(), report_date.to_string()],
        )
        .await
        .map_err(|e| format!("Failed to calculate inventory usage summary: {}", e))?;

    let mut inventory_usage = Vec::new();
    let mut total_usage_qty = 0.0_f64;
    let mut total_cost_usd = 0_i64;

    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        let used_quantity = row.get::<f64>(4).unwrap_or(0.0);
        let cost_per_unit = row.get::<f64>(3).unwrap_or(0.0);
        let total_cost = (used_quantity * cost_per_unit * 100.0).round() as i64;

        total_usage_qty += used_quantity;
        total_cost_usd = total_cost_usd.saturating_add(total_cost);

        inventory_usage.push(InventoryUsageRow {
            inventory_item_id: row.get::<String>(0).unwrap_or_default(),
            inventory_item_name: row.get::<String>(1).unwrap_or_default(),
            unit_label: row.get::<String>(2).unwrap_or_else(|_| "unit".to_string()),
            used_quantity,
            cost_per_unit,
            total_cost_usd: total_cost,
        });
    }

    Ok((total_usage_qty, total_cost_usd, inventory_usage))
}

fn normalize_expenses(expenses: &[DailyReportExpenseInput]) -> Vec<DailyReportExpenseInput> {
    expenses
        .iter()
        .filter_map(|e| {
            let category = e.category.trim().to_string();
            let description = e.description.trim().to_string();
            let date = e.date.trim().to_string();
            let amount = e.amount_usd_cents.max(0);
            if category.is_empty() || description.is_empty() || date.is_empty() || amount <= 0 {
                return None;
            }
            Some(DailyReportExpenseInput {
                date,
                category,
                description,
                amount_usd_cents: amount,
            })
        })
        .collect()
}

async fn ensure_can_close_report(
    conn: &Connection,
    actor_user_id: &str,
    restaurant_id: &str,
) -> Result<String, String> {
    let actor_role = rbac::resolve_actor_role(conn, actor_user_id, restaurant_id).await?;
    let allowed = matches!(
        actor_role.as_str(),
        rbac::ROLE_CASHIER | rbac::ROLE_BUSINESS_ADMIN | rbac::ROLE_ADMIN | rbac::ROLE_SUPER_ADMIN
    );

    if !allowed {
        return Err("Permission denied: only cashier or admin roles can close reports".to_string());
    }

    Ok(actor_role)
}

#[tauri::command]
pub async fn get_daily_report_preview(
    report_date: String,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<DailyReportPreview, String> {
    let summary = get_daily_sales_summary(&pool, &restaurant_id, &report_date).await?;
    let (inventory_total_usage_qty, inventory_total_cost_usd, inventory_usage) =
        get_inventory_usage_summary(&pool, &restaurant_id, &report_date).await?;

    let mut existing_rows = pool
        .query(
            "SELECT id, total_expenses_usd, net_profit_usd, status
             FROM daily_reports
             WHERE restaurant_id = ? AND report_date = ? AND is_deleted = 0
             LIMIT 1",
            params![restaurant_id.clone(), report_date.clone()],
        )
        .await
        .map_err(|e| format!("Failed to check existing report: {}", e))?;

    if let Some(row) = existing_rows.next().await.map_err(|e| e.to_string())? {
        let status = row.get::<String>(3).unwrap_or_else(|_| "closed".to_string());
        Ok(DailyReportPreview {
            report_date,
            total_orders: summary.total_orders,
            paid_orders: summary.paid_orders,
            voided_orders: summary.voided_orders,
            total_sales_usd: summary.total_sales_usd,
            total_sales_khr: summary.total_sales_khr,
            total_expenses_usd: row.get::<i64>(1).unwrap_or(0),
            net_profit_usd: row.get::<i64>(2).unwrap_or(0),
            inventory_total_usage_qty,
            inventory_total_cost_usd,
            inventory_usage,
            is_closed: status == "closed",
            existing_report_id: row.get::<String>(0).ok(),
        })
    } else {
        Ok(DailyReportPreview {
            report_date,
            total_orders: summary.total_orders,
            paid_orders: summary.paid_orders,
            voided_orders: summary.voided_orders,
            total_sales_usd: summary.total_sales_usd,
            total_sales_khr: summary.total_sales_khr,
            total_expenses_usd: 0,
            net_profit_usd: summary.total_sales_usd,
            inventory_total_usage_qty,
            inventory_total_cost_usd,
            inventory_usage,
            is_closed: false,
            existing_report_id: None,
        })
    }
}

#[tauri::command]
pub async fn close_daily_report(
    report_date: String,
    restaurant_id: String,
    actor_user_id: String,
    cashier_name: Option<String>,
    notes: Option<String>,
    expenses: Vec<DailyReportExpenseInput>,
    pool: State<'_, Arc<Connection>>,
) -> Result<DailyReportDetail, String> {
    let actor_role = ensure_can_close_report(&pool, &actor_user_id, &restaurant_id).await?;

    let mut existing = pool
        .query(
            "SELECT id, status FROM daily_reports
             WHERE restaurant_id = ? AND report_date = ? AND is_deleted = 0
             LIMIT 1",
            params![restaurant_id.clone(), report_date.clone()],
        )
        .await
        .map_err(|e| format!("Failed checking duplicate report: {}", e))?;

    if let Some(row) = existing.next().await.map_err(|e| e.to_string())? {
        let status = row.get::<String>(1).unwrap_or_else(|_| "closed".to_string());
        let existing_id = row.get::<String>(0).unwrap_or_default();
        if status == "closed" {
            return Err(format!(
                "A closed report already exists for {} (id: {}). Duplicate close is not allowed.",
                report_date, existing_id
            ));
        }
        return Err("A draft report already exists for this date. Re-open flow is not supported in this build.".to_string());
    }

    let summary = get_daily_sales_summary(&pool, &restaurant_id, &report_date).await?;
    let normalized_expenses = normalize_expenses(&expenses);

    let total_expenses_usd = normalized_expenses
        .iter()
        .fold(0_i64, |sum, e| sum.saturating_add(e.amount_usd_cents));
    let net_profit_usd = summary.total_sales_usd.saturating_sub(total_expenses_usd);

    let report_id = uuid::Uuid::new_v4().to_string();

    pool.execute(
        "INSERT INTO daily_reports (
            id, restaurant_id, report_date,
            total_orders, paid_orders, voided_orders,
            total_sales_usd, total_sales_khr,
            total_expenses_usd, net_profit_usd,
            notes, status, cashier_name, closed_by_user_id,
            closed_at, created_at, updated_at
        ) VALUES (
            ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?,
            ?, 'closed', ?, ?,
            datetime('now'), datetime('now'), datetime('now')
        )",
        params![
            report_id.clone(),
            restaurant_id.clone(),
            report_date.clone(),
            summary.total_orders,
            summary.paid_orders,
            summary.voided_orders,
            summary.total_sales_usd,
            summary.total_sales_khr,
            total_expenses_usd,
            net_profit_usd,
            notes.clone().unwrap_or_default(),
            cashier_name.clone().unwrap_or_default(),
            actor_user_id.clone(),
        ],
    )
    .await
    .map_err(|e| format!("Failed creating daily report: {}", e))?;

    for expense in &normalized_expenses {
        pool.execute(
            "INSERT INTO daily_report_expenses (
                id, report_id, restaurant_id, expense_date,
                category, description, amount_usd,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))",
            params![
                uuid::Uuid::new_v4().to_string(),
                report_id.clone(),
                restaurant_id.clone(),
                expense.date.clone(),
                expense.category.clone(),
                expense.description.clone(),
                expense.amount_usd_cents,
            ],
        )
        .await
        .map_err(|e| format!("Failed saving expense row: {}", e))?;
    }

    rbac::write_audit_log(
        &pool,
        &restaurant_id,
        &actor_user_id,
        &actor_role,
        "close_report",
        "daily_report",
        &report_id,
        None,
    )
    .await;

    get_daily_report_detail(report_id, restaurant_id, pool).await
}

#[tauri::command]
pub async fn get_daily_reports(
    restaurant_id: String,
    start_date: Option<String>,
    end_date: Option<String>,
    status: Option<String>,
    pool: State<'_, Arc<Connection>>,
) -> Result<Vec<DailyReport>, String> {
    let mut where_clauses = vec!["restaurant_id = ?".to_string(), "is_deleted = 0".to_string()];
    let mut bind_values: Vec<libsql::Value> = vec![libsql::Value::Text(restaurant_id)];

    if let Some(start) = start_date {
        where_clauses.push("date(report_date) >= date(?)".to_string());
        bind_values.push(libsql::Value::Text(start));
    }

    if let Some(end) = end_date {
        where_clauses.push("date(report_date) <= date(?)".to_string());
        bind_values.push(libsql::Value::Text(end));
    }

    if let Some(status_value) = status {
        let normalized = status_value.trim().to_lowercase();
        if !normalized.is_empty() && normalized != "all" {
            where_clauses.push("status = ?".to_string());
            bind_values.push(libsql::Value::Text(normalized));
        }
    }

    let sql = format!(
        "SELECT id, restaurant_id, report_date,
                total_orders, paid_orders, voided_orders,
                total_sales_usd, total_sales_khr,
                total_expenses_usd, net_profit_usd,
                notes, status, cashier_name, closed_by_user_id,
                closed_at, created_at, updated_at
         FROM daily_reports
         WHERE {}
         ORDER BY report_date DESC, created_at DESC",
        where_clauses.join(" AND ")
    );

    let mut rows = pool
        .query(&sql, bind_values)
        .await
        .map_err(|e| format!("Failed loading reports: {}", e))?;

    let mut reports = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        reports.push(map_daily_report(&row));
    }

    Ok(reports)
}

#[tauri::command]
pub async fn get_daily_report_detail(
    report_id: String,
    restaurant_id: String,
    pool: State<'_, Arc<Connection>>,
) -> Result<DailyReportDetail, String> {
    let mut report_rows = pool
        .query(
            "SELECT id, restaurant_id, report_date,
                    total_orders, paid_orders, voided_orders,
                    total_sales_usd, total_sales_khr,
                    total_expenses_usd, net_profit_usd,
                    notes, status, cashier_name, closed_by_user_id,
                    closed_at, created_at, updated_at
             FROM daily_reports
             WHERE id = ? AND restaurant_id = ? AND is_deleted = 0
             LIMIT 1",
            params![report_id.clone(), restaurant_id.clone()],
        )
        .await
        .map_err(|e| format!("Failed loading report detail: {}", e))?;

    let report_row = report_rows
        .next()
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Report not found".to_string())?;

    let report = map_daily_report(&report_row);

    let mut expense_rows = pool
        .query(
            "SELECT id, report_id, expense_date, category, description, amount_usd
             FROM daily_report_expenses
             WHERE report_id = ? AND restaurant_id = ? AND is_deleted = 0
             ORDER BY expense_date ASC, created_at ASC",
            params![report_id, restaurant_id.clone()],
        )
        .await
        .map_err(|e| format!("Failed loading report expenses: {}", e))?;

    let mut expenses = Vec::new();
    while let Some(row) = expense_rows.next().await.map_err(|e| e.to_string())? {
        expenses.push(DailyReportExpense {
            id: row.get::<String>(0).unwrap_or_default(),
            report_id: row.get::<String>(1).unwrap_or_default(),
            date: row.get::<String>(2).unwrap_or_default(),
            category: row.get::<String>(3).unwrap_or_default(),
            description: row.get::<String>(4).unwrap_or_default(),
            amount_usd_cents: row.get::<i64>(5).unwrap_or(0),
        });
    }

    let (inventory_total_usage_qty, inventory_total_cost_usd, inventory_usage) =
        get_inventory_usage_summary(&pool, &restaurant_id, &report.report_date).await?;

    Ok(DailyReportDetail {
        report,
        expenses,
        inventory_total_usage_qty,
        inventory_total_cost_usd,
        inventory_usage,
    })
}
