-- Migration: 007_kitchen_and_tables
-- Description: Kitchen workflow (item-level status tracking), table seat capacity, reservations

-- Seat capacity per table (defaults to 4 for existing tables)
ALTER TABLE floor_tables ADD COLUMN seat_count INTEGER NOT NULL DEFAULT 4;

-- Kitchen item-level status tracking
-- pending  = in order, waiting for kitchen to pick up
-- cooking  = kitchen has acknowledged and is preparing
-- done     = kitchen has finished, ready to serve
ALTER TABLE order_items ADD COLUMN kitchen_status TEXT NOT NULL DEFAULT 'pending'
    CHECK(kitchen_status IN ('pending', 'cooking', 'done'));

-- Reservations
CREATE TABLE IF NOT EXISTS reservations (
    id          TEXT PRIMARY KEY,
    table_id    TEXT NOT NULL REFERENCES floor_tables(id),
    guest_name  TEXT NOT NULL,
    guest_phone TEXT,
    guest_count INTEGER NOT NULL DEFAULT 1,
    reserved_at TEXT NOT NULL,
    notes       TEXT,
    status      TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','confirmed','seated','cancelled','no_show')),
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT
);
