-- Migration: 014_expand_role_check
-- Description: Expand the role CHECK constraint on the users table to include
--              'chef' and 'super_admin'. SQLite does not support ALTER COLUMN,
--              so we recreate the table using the standard 12-step rename trick.

-- 1. New table with the expanded constraint
CREATE TABLE IF NOT EXISTS users_new (
    id              TEXT PRIMARY KEY,
    restaurant_id   TEXT REFERENCES restaurants(id),
    username        TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL CHECK(role IN ('super_admin','admin','manager','cashier','waiter','chef')),
    full_name       TEXT,
    khmer_name      TEXT,
    is_deleted      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT
);

-- 2. Copy all existing rows
INSERT OR IGNORE INTO users_new
    SELECT id, restaurant_id, username, password_hash, role,
           full_name, khmer_name, is_deleted, created_at, updated_at
    FROM users;

-- 3. Swap
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
