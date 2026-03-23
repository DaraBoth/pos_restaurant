-- Migration: 018_updated_at_triggers
-- Sets updated_at = datetime('now') automatically on every UPDATE
-- so the sync engine can detect changed rows via WHERE updated_at > last_sync_at

-- restaurants
CREATE TRIGGER IF NOT EXISTS trg_restaurants_updated_at
AFTER UPDATE ON restaurants
BEGIN
    UPDATE restaurants SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- users
CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users
BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- categories
CREATE TRIGGER IF NOT EXISTS trg_categories_updated_at
AFTER UPDATE ON categories
BEGIN
    UPDATE categories SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- products
CREATE TRIGGER IF NOT EXISTS trg_products_updated_at
AFTER UPDATE ON products
BEGIN
    UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- orders
CREATE TRIGGER IF NOT EXISTS trg_orders_updated_at
AFTER UPDATE ON orders
BEGIN
    UPDATE orders SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- order_items
CREATE TRIGGER IF NOT EXISTS trg_order_items_updated_at
AFTER UPDATE ON order_items
BEGIN
    UPDATE order_items SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- floor_tables
CREATE TRIGGER IF NOT EXISTS trg_floor_tables_updated_at
AFTER UPDATE ON floor_tables
BEGIN
    UPDATE floor_tables SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- inventory_items
CREATE TRIGGER IF NOT EXISTS trg_inventory_items_updated_at
AFTER UPDATE ON inventory_items
BEGIN
    UPDATE inventory_items SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Also backfill any rows where updated_at is NULL → set to created_at as baseline
-- This ensures first-time sync picks up all existing data
UPDATE restaurants   SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE users         SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE categories    SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE products      SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE orders        SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE floor_tables  SET updated_at = created_at WHERE updated_at IS NULL;

-- Ensure order_items has updated_at column (may be missing)
ALTER TABLE order_items ADD COLUMN updated_at TEXT;
UPDATE order_items SET updated_at = created_at WHERE updated_at IS NULL;

-- Ensure inventory_items has updated_at column
ALTER TABLE inventory_items ADD COLUMN updated_at TEXT;
UPDATE inventory_items SET updated_at = created_at WHERE updated_at IS NULL;

-- Also set updated_at on INSERT so new rows are immediately eligible for sync
CREATE TRIGGER IF NOT EXISTS trg_restaurants_insert_at
AFTER INSERT ON restaurants
BEGIN
    UPDATE restaurants SET updated_at = datetime('now') WHERE id = NEW.id AND updated_at IS NULL;
END;

CREATE TRIGGER IF NOT EXISTS trg_products_insert_at
AFTER INSERT ON products
BEGIN
    UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id AND updated_at IS NULL;
END;

CREATE TRIGGER IF NOT EXISTS trg_categories_insert_at
AFTER INSERT ON categories
BEGIN
    UPDATE categories SET updated_at = datetime('now') WHERE id = NEW.id AND updated_at IS NULL;
END;

CREATE TRIGGER IF NOT EXISTS trg_orders_insert_at
AFTER INSERT ON orders
BEGIN
    UPDATE orders SET updated_at = datetime('now') WHERE id = NEW.id AND updated_at IS NULL;
END;

CREATE TRIGGER IF NOT EXISTS trg_order_items_insert_at
AFTER INSERT ON order_items
BEGIN
    UPDATE order_items SET updated_at = datetime('now') WHERE id = NEW.id AND updated_at IS NULL;
END;

CREATE TRIGGER IF NOT EXISTS trg_floor_tables_insert_at
AFTER INSERT ON floor_tables
BEGIN
    UPDATE floor_tables SET updated_at = datetime('now') WHERE id = NEW.id AND updated_at IS NULL;
END;
