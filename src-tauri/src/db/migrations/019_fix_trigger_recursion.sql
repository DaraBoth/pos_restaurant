-- Migration: 019_fix_trigger_recursion
-- The previous triggers caused infinite recursion because updating `updated_at` inside 
-- an `AFTER UPDATE` trigger fired the trigger again.
-- We fix this by dropping the old triggers and adding a `WHEN` condition 
-- so they only fire if the user hasn't explicitly set `updated_at`.

DROP TRIGGER IF EXISTS trg_restaurants_updated_at;
DROP TRIGGER IF EXISTS trg_users_updated_at;
DROP TRIGGER IF EXISTS trg_categories_updated_at;
DROP TRIGGER IF EXISTS trg_products_updated_at;
DROP TRIGGER IF EXISTS trg_orders_updated_at;
DROP TRIGGER IF EXISTS trg_order_items_updated_at;
DROP TRIGGER IF EXISTS trg_floor_tables_updated_at;
DROP TRIGGER IF EXISTS trg_inventory_items_updated_at;

-- restaurants
CREATE TRIGGER IF NOT EXISTS trg_restaurants_updated_at
AFTER UPDATE ON restaurants
WHEN OLD.updated_at IS NULL OR OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE restaurants SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- users
CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users
WHEN OLD.updated_at IS NULL OR OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- categories
CREATE TRIGGER IF NOT EXISTS trg_categories_updated_at
AFTER UPDATE ON categories
WHEN OLD.updated_at IS NULL OR OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE categories SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- products
CREATE TRIGGER IF NOT EXISTS trg_products_updated_at
AFTER UPDATE ON products
WHEN OLD.updated_at IS NULL OR OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE products SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- orders
CREATE TRIGGER IF NOT EXISTS trg_orders_updated_at
AFTER UPDATE ON orders
WHEN OLD.updated_at IS NULL OR OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE orders SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- order_items
CREATE TRIGGER IF NOT EXISTS trg_order_items_updated_at
AFTER UPDATE ON order_items
WHEN OLD.updated_at IS NULL OR OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE order_items SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- floor_tables
CREATE TRIGGER IF NOT EXISTS trg_floor_tables_updated_at
AFTER UPDATE ON floor_tables
WHEN OLD.updated_at IS NULL OR OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE floor_tables SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- inventory_items
CREATE TRIGGER IF NOT EXISTS trg_inventory_items_updated_at
AFTER UPDATE ON inventory_items
WHEN OLD.updated_at IS NULL OR OLD.updated_at = NEW.updated_at
BEGIN
    UPDATE inventory_items SET updated_at = datetime('now') WHERE id = NEW.id;
END;
