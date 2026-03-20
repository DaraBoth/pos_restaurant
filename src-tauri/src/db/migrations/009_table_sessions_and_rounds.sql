-- Feature 2: Multi-Order Rounds
CREATE TABLE table_sessions (
    id TEXT PRIMARY KEY,
    table_id TEXT REFERENCES floor_tables(id),
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'completed'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

-- Modify orders table to support rounds
ALTER TABLE orders ADD COLUMN session_id TEXT REFERENCES table_sessions(id);
ALTER TABLE orders ADD COLUMN round_number INTEGER NOT NULL DEFAULT 1;

-- If orders already exist, link them to dummy sessions or leave NULL
-- We don't actively migrate existing data for this MVP since the app is fresh,
-- but SQLite will just leave session_id NULL for old records.
