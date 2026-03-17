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
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed initial tables T01 to T20 to match previous hardcoded behavior, 
-- but now they are persistent and manageable.
INSERT OR IGNORE INTO floor_tables (id, name) VALUES 
('tbl-001', 'T01'), ('tbl-002', 'T02'), ('tbl-003', 'T03'), ('tbl-004', 'T04'),
('tbl-005', 'T05'), ('tbl-006', 'T06'), ('tbl-007', 'T07'), ('tbl-008', 'T08'),
('tbl-009', 'T09'), ('tbl-010', 'T10'), ('tbl-011', 'T11'), ('tbl-012', 'T12'),
('tbl-013', 'T13'), ('tbl-014', 'T14'), ('tbl-015', 'T15'), ('tbl-016', 'T16'),
('tbl-017', 'T17'), ('tbl-018', 'T18'), ('tbl-019', 'T19'), ('tbl-020', 'T20');
