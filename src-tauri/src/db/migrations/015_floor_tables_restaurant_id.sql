-- Migration: 015_floor_tables_restaurant_id
-- Description: Add restaurant_id to floor_tables so each table belongs to a
--              specific restaurant. Existing rows get NULL (no owner) which is
--              fine — they will be adopted automatically when restaurant admins
--              reassign or recreate their tables.

ALTER TABLE floor_tables ADD COLUMN restaurant_id TEXT REFERENCES restaurants(id);
