-- Migration: 011_ensure_missing_columns
-- Description: Safely adds columns that may be missing on databases upgraded
-- from older versions. All ALTER TABLE statements are idempotent — the migration
-- runner will silently skip any "duplicate column" errors.

-- seat_count: number of seats per table (added in 007 but may be missing)
ALTER TABLE floor_tables ADD COLUMN seat_count INTEGER NOT NULL DEFAULT 4;

-- session_id / round support on orders (added in 009 but may be missing)
ALTER TABLE orders ADD COLUMN session_id TEXT;
ALTER TABLE orders ADD COLUMN round_number INTEGER NOT NULL DEFAULT 1;

-- kitchen_status on order items (added in 007 but may be missing)
ALTER TABLE order_items ADD COLUMN kitchen_status TEXT NOT NULL DEFAULT 'pending';

-- table_sessions table (added in 009 but may be missing)
CREATE TABLE IF NOT EXISTS table_sessions (
    id           TEXT PRIMARY KEY,
    table_id     TEXT REFERENCES floor_tables(id),
    status       TEXT NOT NULL DEFAULT 'active',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);
