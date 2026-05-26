-- Complete Database Schema for DineOS
-- Extracted from migrations 001 through 018
-- Reflects the exact table layout of the production database

CREATE TABLE IF NOT EXISTS restaurants (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    khmer_name  TEXT,
    tin         TEXT,
    address     TEXT,
    address_kh  TEXT,
    phone       TEXT,
    website     TEXT,
    vat_number  TEXT,
    receipt_footer TEXT,
    logo_path   TEXT,
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    restaurant_id   TEXT REFERENCES restaurants(id),
    username        TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL CHECK(role IN ('admin','manager','cashier','waiter')),
    full_name       TEXT,
    khmer_name      TEXT,
    is_deleted      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT
);

CREATE TABLE IF NOT EXISTS exchange_rates (
    id              TEXT PRIMARY KEY,
    rate            REAL NOT NULL,
    effective_from  TEXT NOT NULL DEFAULT (datetime('now')),
    created_by      TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    khmer_name  TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS products (
    id          TEXT PRIMARY KEY,
    category_id TEXT REFERENCES categories(id),
    name        TEXT NOT NULL,
    khmer_name  TEXT,
    price_cents INTEGER NOT NULL,
    image_url   TEXT,
    is_available INTEGER NOT NULL DEFAULT 1,
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS floor_tables (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    seats INTEGER NOT NULL DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'free',
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT,
    UNIQUE(restaurant_id, name)
);

CREATE TABLE IF NOT EXISTS table_sessions (
    id TEXT PRIMARY KEY,
    table_id TEXT REFERENCES floor_tables(id),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS orders (
    id              TEXT PRIMARY KEY,
    user_id         TEXT REFERENCES users(id),
    table_id        TEXT,
    session_id      TEXT REFERENCES table_sessions(id),
    round_number    INTEGER NOT NULL DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed','cancelled','void')),
    total_usd       INTEGER NOT NULL DEFAULT 0,
    total_khr       INTEGER NOT NULL DEFAULT 0,
    tax_vat         INTEGER NOT NULL DEFAULT 0,
    tax_plt         INTEGER NOT NULL DEFAULT 0,
    bakong_bill_number TEXT,
    notes           TEXT,
    customer_name   TEXT,
    customer_phone  TEXT,
    is_deleted      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT,
    completed_at    TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
    id              TEXT PRIMARY KEY,
    order_id        TEXT NOT NULL REFERENCES orders(id),
    product_id      TEXT NOT NULL REFERENCES products(id),
    quantity        INTEGER NOT NULL DEFAULT 1,
    price_at_order  INTEGER NOT NULL,
    note            TEXT,
    kitchen_status  TEXT NOT NULL DEFAULT 'pending',
    is_deleted      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT
);

CREATE TABLE IF NOT EXISTS payments (
    id                      TEXT PRIMARY KEY,
    order_id                TEXT NOT NULL REFERENCES orders(id),
    method                  TEXT NOT NULL CHECK(method IN ('cash','khqr','card')),
    currency                TEXT NOT NULL CHECK(currency IN ('USD','KHR')),
    amount                  INTEGER NOT NULL,
    bakong_transaction_hash TEXT,
    created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id TEXT PRIMARY KEY, 
    name TEXT NOT NULL, 
    khmer_name TEXT,
    unit_label TEXT NOT NULL DEFAULT 'piece',
    stock_qty INTEGER NOT NULL DEFAULT 0,
    stock_pct REAL NOT NULL DEFAULT 0,
    min_stock_qty INTEGER NOT NULL DEFAULT 1,
    cost_per_unit INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS product_ingredients (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    usage_percentage REAL NOT NULL DEFAULT 100
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
