-- Migration: 020_drop_all_triggers
-- Description: Drop all updated_at and insert_at triggers to prevent any possibility of SQLite infinite recursion.
-- We will rely on the Rust API endpoints to explicitly set updated_at during updates.

DROP TRIGGER IF EXISTS trg_restaurants_updated_at;
DROP TRIGGER IF EXISTS trg_users_updated_at;
DROP TRIGGER IF EXISTS trg_categories_updated_at;
DROP TRIGGER IF EXISTS trg_products_updated_at;
DROP TRIGGER IF EXISTS trg_orders_updated_at;
DROP TRIGGER IF EXISTS trg_order_items_updated_at;
DROP TRIGGER IF EXISTS trg_floor_tables_updated_at;
DROP TRIGGER IF EXISTS trg_inventory_items_updated_at;

DROP TRIGGER IF EXISTS trg_restaurants_insert_at;
DROP TRIGGER IF EXISTS trg_products_insert_at;
DROP TRIGGER IF EXISTS trg_categories_insert_at;
DROP TRIGGER IF EXISTS trg_orders_insert_at;
DROP TRIGGER IF EXISTS trg_order_items_insert_at;
DROP TRIGGER IF EXISTS trg_floor_tables_insert_at;
