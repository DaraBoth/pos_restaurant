-- Migration: 001_initial_schema
-- Description: Creates all core tables for DineOS System

-- Restaurants
CREATE TABLE IF NOT EXISTS restaurants (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    khmer_name  TEXT,
    tin         TEXT,
    address     TEXT,
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT
);

-- Users
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

-- Exchange Rates (USD → KHR)
CREATE TABLE IF NOT EXISTS exchange_rates (
    id              TEXT PRIMARY KEY,
    rate            REAL NOT NULL,
    effective_from  TEXT NOT NULL DEFAULT (datetime('now')),
    created_by      TEXT REFERENCES users(id)
);

-- Product Categories
CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    khmer_name  TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Products
CREATE TABLE IF NOT EXISTS products (
    id          TEXT PRIMARY KEY,
    category_id TEXT REFERENCES categories(id),
    name        TEXT NOT NULL,
    khmer_name  TEXT,
    price_cents INTEGER NOT NULL,  -- stored in cents (USD * 100)
    is_available INTEGER NOT NULL DEFAULT 1,
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id              TEXT PRIMARY KEY,
    user_id         TEXT REFERENCES users(id),
    table_id        TEXT,
    status          TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed','cancelled','void')),
    total_usd       INTEGER NOT NULL DEFAULT 0,  -- cents
    total_khr       INTEGER NOT NULL DEFAULT 0,  -- riels
    tax_vat         INTEGER NOT NULL DEFAULT 0,  -- cents (10% VAT)
    tax_plt         INTEGER NOT NULL DEFAULT 0,  -- cents (3% PLT)
    bakong_bill_number TEXT,
    notes           TEXT,
    is_deleted      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT,
    completed_at    TEXT
);

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
    id              TEXT PRIMARY KEY,
    order_id        TEXT NOT NULL REFERENCES orders(id),
    product_id      TEXT NOT NULL REFERENCES products(id),
    quantity        INTEGER NOT NULL DEFAULT 1,
    price_at_order  INTEGER NOT NULL,  -- cents at time of order
    note            TEXT,
    is_deleted      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id                      TEXT PRIMARY KEY,
    order_id                TEXT NOT NULL REFERENCES orders(id),
    method                  TEXT NOT NULL CHECK(method IN ('cash','khqr','card')),
    currency                TEXT NOT NULL CHECK(currency IN ('USD','KHR')),
    amount                  INTEGER NOT NULL,  -- cents or riels depending on currency
    bakong_transaction_hash TEXT,              -- MD5 hash for KHQR reconciliation
    created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- Seed: Default admin user (password: admin123 — Argon2 hash)
-- The app will prompt to change this on first login
INSERT OR IGNORE INTO restaurants (id, name, khmer_name, tin, address)
VALUES (
    'rest-00000000-0000-0000-0000-000000000001',
    'My Restaurant',
    'ភោជនីយដ្ឋានរបស់ខ្ញុំ',
    '000-000-000',
    'Phnom Penh, Cambodia'
);

-- Default exchange rate: 1 USD = 4100 KHR
INSERT OR IGNORE INTO exchange_rates (id, rate, effective_from)
VALUES (
    'rate-00000000-0000-0000-0000-000000000001',
    4100.0,
    datetime('now')
);

-- Default categories
INSERT OR IGNORE INTO categories (id, name, khmer_name, sort_order)
VALUES
    ('cat-00000000-0000-0000-0000-000000000001', 'Food', 'អាហារ', 1),
    ('cat-00000000-0000-0000-0000-000000000002', 'Drinks', 'ភេសជ្ជៈ', 2),
    ('cat-00000000-0000-0000-0000-000000000003', 'Desserts', 'បង្អែម', 3);

-- Default products (prices in cents)
INSERT OR IGNORE INTO products (id, category_id, name, khmer_name, price_cents)
VALUES
    ('prod-0000-0001', 'cat-00000000-0000-0000-0000-000000000001', 'Beef Lok Lak', 'គោឡុកឡាក់', 500),
    ('prod-0000-0002', 'cat-00000000-0000-0000-0000-000000000001', 'Amok Fish', 'អាម៉ុកត្រី', 450),
    ('prod-0000-0003', 'cat-00000000-0000-0000-0000-000000000001', 'Fried Rice', 'បាយឆា', 300),
    ('prod-0000-0004', 'cat-00000000-0000-0000-0000-000000000001', 'Spring Rolls', 'នំជ្រូក', 250),
    ('prod-0000-0005', 'cat-00000000-0000-0000-0000-000000000001', 'Khmer BBQ', 'អាំងខ្មែរ', 800),
    ('prod-0000-0006', 'cat-00000000-0000-0000-0000-000000000002', 'Angkor Beer', 'បៀអង្គរ', 150),
    ('prod-0000-0007', 'cat-00000000-0000-0000-0000-000000000002', 'Fresh Coconut', 'ដូងស្រស់', 200),
    ('prod-0000-0008', 'cat-00000000-0000-0000-0000-000000000002', 'Sugarcane Juice', 'ទឹកអំពៅ', 125),
    ('prod-0000-0009', 'cat-00000000-0000-0000-0000-000000000002', 'Iced Coffee', 'កាហ្វេទឹកកក', 175),
    ('prod-0000-0010', 'cat-00000000-0000-0000-0000-000000000003', 'Mango Sticky Rice', 'បាយដំណើបស្វាយ', 350),
    ('prod-0000-0011', 'cat-00000000-0000-0000-0000-000000000003', 'Num Krok', 'នំក្រក', 200),
    ('prod-0000-0012', 'cat-00000000-0000-0000-0000-000000000003', 'Black Rice Pudding', 'បបរអង្ករ', 275);
