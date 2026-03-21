-- Migration: 016_floor_tables_composite_unique
-- Description: Replace the UNIQUE constraint on floor_tables.name (global)
--              with a composite UNIQUE(name, restaurant_id) so each restaurant
--              can have its own T1, T2, etc. without conflicting.

-- SQLite does not support DROP CONSTRAINT, so we use the rename trick.

-- 1. Create replacement table with the correct composite unique constraint.
CREATE TABLE IF NOT EXISTS floor_tables_new (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'free',
    is_deleted    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT,
    seat_count    INTEGER NOT NULL DEFAULT 4,
    restaurant_id TEXT REFERENCES restaurants(id),
    UNIQUE(name, restaurant_id)
);

-- 2. Copy all existing rows across.
INSERT OR IGNORE INTO floor_tables_new
    (id, name, status, is_deleted, created_at, updated_at, seat_count, restaurant_id)
SELECT id, name, status, is_deleted, created_at, updated_at,
       COALESCE(seat_count, 4), restaurant_id
FROM floor_tables;

-- 3. Drop the old table and rename the new one.
DROP TABLE floor_tables;
ALTER TABLE floor_tables_new RENAME TO floor_tables;
