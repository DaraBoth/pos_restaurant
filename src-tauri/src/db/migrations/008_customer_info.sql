-- Migration: 008_customer_info
-- Adds hold-for-payment support: customer name/phone stored on orders

ALTER TABLE orders ADD COLUMN customer_name TEXT;
ALTER TABLE orders ADD COLUMN customer_phone TEXT
