CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  khmer_name TEXT,
  unit_label TEXT NOT NULL DEFAULT 'piece',
  stock_qty INTEGER NOT NULL DEFAULT 0,
  stock_pct REAL NOT NULL DEFAULT 0,
  min_stock_qty INTEGER NOT NULL DEFAULT 1,
  cost_per_unit INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_ingredients (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  usage_percentage REAL NOT NULL DEFAULT 100
);
