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
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    restaurant_id   TEXT REFERENCES restaurants(id),
    username        TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL CHECK(role IN ('super_admin','admin','manager','cashier','waiter','chef')),
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
    created_by      TEXT REFERENCES users(id),
    updated_at      TEXT,
    restaurant_id   TEXT REFERENCES restaurants(id)
);

CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    khmer_name  TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now')),
    restaurant_id TEXT REFERENCES restaurants(id)
);

CREATE TABLE IF NOT EXISTS products (
    id          TEXT PRIMARY KEY,
    category_id TEXT REFERENCES categories(id),
    name        TEXT NOT NULL,
    khmer_name  TEXT,
    price_cents INTEGER NOT NULL,
    image_path   TEXT,
    is_available INTEGER NOT NULL DEFAULT 1,
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now')),
    restaurant_id TEXT REFERENCES restaurants(id)
);

CREATE TABLE IF NOT EXISTS floor_tables (
    id TEXT PRIMARY KEY,
    restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    seats INTEGER NOT NULL DEFAULT 4,
    status TEXT NOT NULL DEFAULT 'free',
    is_deleted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now')),
    seat_count    INTEGER NOT NULL DEFAULT 4,
    UNIQUE(restaurant_id, name)
);

CREATE TABLE IF NOT EXISTS table_sessions (
    id TEXT PRIMARY KEY,
    table_id TEXT REFERENCES floor_tables(id),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    restaurant_id TEXT REFERENCES restaurants(id),
    updated_at TEXT
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
    completed_at    TEXT,
    restaurant_id   TEXT REFERENCES restaurants(id)
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
    created_at              TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at              TEXT
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
    updated_at TEXT,
    restaurant_id TEXT REFERENCES restaurants(id)
);

CREATE TABLE IF NOT EXISTS product_ingredients (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    usage_percentage REAL NOT NULL DEFAULT 100,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS inventory_logs (
    id TEXT PRIMARY KEY,
    inventory_item_id TEXT REFERENCES inventory_items(id) ON DELETE CASCADE,
    product_id        TEXT REFERENCES products(id) ON DELETE CASCADE,
    user_id           TEXT REFERENCES users(id) ON DELETE CASCADE,
    change_type       TEXT NOT NULL,  -- 'add', 'deduct', 'set', 'correction'
    quantity_change   INTEGER NOT NULL,
    change_amount     INTEGER NOT NULL DEFAULT 0, -- Matches products.rs
    reason            TEXT,                       -- Matches products.rs
    current_stock     INTEGER NOT NULL DEFAULT 0,
    note              TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT,
    restaurant_id     TEXT REFERENCES restaurants(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- ==========================================
-- AUTOMATIC TIMESTAMPS (SYNC TRIGGERS)
-- ==========================================

-- Trigger helper: Update updated_at on every modification
CREATE TRIGGER IF NOT EXISTS trg_restaurants_upd      AFTER UPDATE ON restaurants    BEGIN UPDATE restaurants    SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_users_upd            AFTER UPDATE ON users          BEGIN UPDATE users          SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_exchange_rates_upd   AFTER UPDATE ON exchange_rates BEGIN UPDATE exchange_rates SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_categories_upd       AFTER UPDATE ON categories     BEGIN UPDATE categories     SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_products_upd         AFTER UPDATE ON products       BEGIN UPDATE products       SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_floor_tables_upd     AFTER UPDATE ON floor_tables   BEGIN UPDATE floor_tables   SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_table_sessions_upd   AFTER UPDATE ON table_sessions BEGIN UPDATE table_sessions SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_orders_upd           AFTER UPDATE ON orders         BEGIN UPDATE orders         SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_order_items_upd      AFTER UPDATE ON order_items    BEGIN UPDATE order_items    SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_payments_upd         AFTER UPDATE ON payments       BEGIN UPDATE payments       SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_inventory_items_upd  AFTER UPDATE ON inventory_items BEGIN UPDATE inventory_items SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_inventory_logs_upd   AFTER UPDATE ON inventory_logs  BEGIN UPDATE inventory_logs  SET updated_at = datetime('now') WHERE id = NEW.id; END;
CREATE TRIGGER IF NOT EXISTS trg_ingredients_upd      AFTER UPDATE ON product_ingredients BEGIN UPDATE product_ingredients SET updated_at = datetime('now') WHERE id = NEW.id; END;


-- ==========================================
-- DEFAULT SYSTEM SEED DATA
-- ==========================================

-- Seed: Default Admin Restaurant
INSERT OR IGNORE INTO restaurants (id, name, khmer_name, tin, address, phone, receipt_footer)
VALUES (
    'rest-00000000-0000-0000-0000-000000000001',
    'DineOS Flagship',
    'ភោជនីយដ្ឋានរបស់ខ្ញុំ',
    '000-000-000',
    'Phnom Penh, Cambodia',
    '+855 12 345 678',
    'Thank you for dining with us!'
);

-- Default exchange rate: 1 USD = 4100 KHR (created by superadmin)
INSERT OR IGNORE INTO exchange_rates (id, rate, effective_from, created_by, restaurant_id)
VALUES (
    'rate-00000000-0000-0000-0000-000000000001',
    4100.0,
    datetime('now'),
    'user-super-admin-0000-0000-000000000001',
    'rest-00000000-0000-0000-0000-000000000001'
);

-- Default categories
INSERT OR IGNORE INTO categories (id, restaurant_id, name, khmer_name, sort_order)
VALUES
    ('cat-00000000-0000-0000-0000-000000000001', 'rest-00000000-0000-0000-0000-000000000001', 'Food', 'អាហារ', 1),
    ('cat-00000000-0000-0000-0000-000000000002', 'rest-00000000-0000-0000-0000-000000000001', 'Drinks', 'ភេសជ្ជៈ', 2),
    ('cat-00000000-0000-0000-0000-000000000003', 'rest-00000000-0000-0000-0000-000000000001', 'Desserts', 'បង្អែម', 3);

-- Default products (prices in cents)
INSERT OR IGNORE INTO products (id, restaurant_id, category_id, name, khmer_name, price_cents)
VALUES
    ('prod-0000-0001', 'rest-00000000-0000-0000-0000-000000000001', 'cat-00000000-0000-0000-0000-000000000001', 'Beef Lok Lak', 'គោឡុកឡាក់', 500),
    ('prod-0000-0002', 'rest-00000000-0000-0000-0000-000000000001', 'cat-00000000-0000-0000-0000-000000000001', 'Amok Fish', 'អាម៉ុកត្រី', 450),
    ('prod-0000-0003', 'rest-00000000-0000-0000-0000-000000000001', 'cat-00000000-0000-0000-0000-000000000002', 'Iced Coffee', 'កាហ្វេទឹកកក', 175);

-- Default Floor Tables
INSERT OR IGNORE INTO floor_tables (id, restaurant_id, name, seat_count, status) VALUES 
('tbl-00000000-0000-0000-0000-000000000001', 'rest-00000000-0000-0000-0000-000000000001', 'T01', 4, 'free'),
('tbl-00000000-0000-0000-0000-000000000002', 'rest-00000000-0000-0000-0000-000000000001', 'T02', 4, 'free'),
('tbl-00000000-0000-0000-0000-000000000003', 'rest-00000000-0000-0000-0000-000000000001', 'T03', 4, 'free');
