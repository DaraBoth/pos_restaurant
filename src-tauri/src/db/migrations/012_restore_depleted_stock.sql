-- Migration: 012_restore_depleted_stock
-- Description: Restores stock_quantity to 100 for any available products that
-- were auto-decremented to 0 by previous checkouts. Going forward, stock_quantity
-- is managed manually by admins only — the checkout path no longer auto-deducts it.

UPDATE products
SET stock_quantity = 100
WHERE is_available = 1
  AND stock_quantity <= 0;
