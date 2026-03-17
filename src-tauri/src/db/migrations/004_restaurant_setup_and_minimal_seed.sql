-- Migration: 004_restaurant_setup_and_minimal_seed
-- Description: Adds persistent restaurant settings fields and missing audit columns.

ALTER TABLE restaurants ADD COLUMN address_kh TEXT;
ALTER TABLE restaurants ADD COLUMN phone TEXT;
ALTER TABLE restaurants ADD COLUMN website TEXT;
ALTER TABLE restaurants ADD COLUMN vat_number TEXT;
ALTER TABLE restaurants ADD COLUMN receipt_footer TEXT;

ALTER TABLE categories ADD COLUMN updated_at TEXT;
ALTER TABLE floor_tables ADD COLUMN updated_at TEXT;

UPDATE restaurants
SET receipt_footer = COALESCE(receipt_footer, 'Thank you for dining with us!')
WHERE id = 'rest-00000000-0000-0000-0000-000000000001';