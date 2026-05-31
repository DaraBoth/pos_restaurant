-- Daily sales closing reports and expenses

CREATE TABLE IF NOT EXISTS daily_reports (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    report_date TEXT NOT NULL,
    total_orders INTEGER NOT NULL DEFAULT 0,
    paid_orders INTEGER NOT NULL DEFAULT 0,
    voided_orders INTEGER NOT NULL DEFAULT 0,
    total_sales_usd INTEGER NOT NULL DEFAULT 0,
    total_sales_khr INTEGER NOT NULL DEFAULT 0,
    total_expenses_usd INTEGER NOT NULL DEFAULT 0,
    net_profit_usd INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'closed',
    cashier_name TEXT,
    closed_by_user_id TEXT,
    closed_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (restaurant_id, report_date)
);

CREATE TABLE IF NOT EXISTS daily_report_expenses (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
    expense_date TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount_usd INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_rest_date
    ON daily_reports (restaurant_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_report_expenses_report
    ON daily_report_expenses (report_id, restaurant_id);
