PRAGMA foreign_keys = OFF;
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
INSERT OR IGNORE INTO floor_tables_new
    (id, name, status, is_deleted, created_at, updated_at, seat_count, restaurant_id)
SELECT id, name, status, is_deleted, created_at, updated_at,
       COALESCE(seat_count, 4), restaurant_id
FROM floor_tables;
DROP TABLE floor_tables;
ALTER TABLE floor_tables_new RENAME TO floor_tables;
PRAGMA foreign_keys = ON;
