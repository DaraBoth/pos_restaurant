-- Migration: 003_add_images_and_inventory
-- Description: Adds product image support and inventory logging

-- Add image path to products
ALTER TABLE products ADD COLUMN image_path TEXT;

-- Inventory Logs table for tracking changes
CREATE TABLE IF NOT EXISTS inventory_logs (
    id          TEXT PRIMARY KEY,
    product_id  TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    change_type TEXT NOT NULL, -- 'in', 'out', 'adjustment', 'sale'
    quantity    INTEGER NOT NULL,
    notes       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Update existing products to have 100 stock so they can be ordered in POS
UPDATE products SET stock_quantity = 100 WHERE stock_quantity = 0;
