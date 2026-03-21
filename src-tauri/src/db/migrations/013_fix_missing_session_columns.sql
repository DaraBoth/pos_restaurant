-- Migration: 013_fix_missing_session_columns
-- Description: Some databases that had migrations 009/011 marked as applied
-- before the statements actually executed are missing session_id / round_number
-- on the orders table and the table_sessions table itself.
-- All ALTER TABLE statements are idempotent — the runner ignores duplicate-column errors.

ALTER TABLE orders ADD COLUMN session_id TEXT;
ALTER TABLE orders ADD COLUMN round_number INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS table_sessions (
    id           TEXT PRIMARY KEY,
    table_id     TEXT,
    status       TEXT NOT NULL DEFAULT 'active',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

ALTER TABLE floor_tables ADD COLUMN seat_count INTEGER NOT NULL DEFAULT 4;
ALTER TABLE order_items ADD COLUMN kitchen_status TEXT NOT NULL DEFAULT 'pending';
