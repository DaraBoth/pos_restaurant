-- Migration: 006_recalculate_existing_orders
-- Description: Reset all taxes to 0 and recalculate totals based on item subtatols

-- First, set all taxes to 0
UPDATE orders SET tax_vat = 0, tax_plt = 0;

-- Then, update total_usd based on the sum of its order items
UPDATE orders 
SET total_usd = (
    SELECT COALESCE(SUM(oi.price_at_order * oi.quantity), 0)
    FROM order_items oi
    WHERE oi.order_id = orders.id AND oi.is_deleted = 0
);

-- Finally, update total_khr based on the new total_usd and the latest exchange rate
-- Using a subquery for the rate to ensure accuracy
UPDATE orders
SET total_khr = CAST(ROUND(total_usd * (SELECT rate FROM exchange_rates ORDER BY effective_from DESC LIMIT 1) / 100) AS INTEGER);
