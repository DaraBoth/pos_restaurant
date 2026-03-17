-- Migration: 002_add_features
-- Description: Adds stock management to products and a persistent tables feature

-- Add stock quantity to products
ALTER TABLE products ADD COLUMN stock_quantity INTEGER NOT NULL DEFAULT 0;

-- Persistent Tables for Floor Plan
CREATE TABLE IF NOT EXISTS floor_tables (
    id          TEXT PRIMARY KEY,
    name        TEXT UNIQUE NOT NULL,
    status      TEXT NOT NULL DEFAULT 'free',
    is_deleted  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT
);

-- Seed initial tables T01 to T20 to match previous hardcoded behavior, 
-- but now they are persistent and manageable.
INSERT OR IGNORE INTO floor_tables (id, name) VALUES 
('tbl-001', 'T01'), ('tbl-002', 'T02'), ('tbl-003', 'T03');
