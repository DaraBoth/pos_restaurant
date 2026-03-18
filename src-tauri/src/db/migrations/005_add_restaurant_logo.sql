-- Migration: 005_add_restaurant_logo
-- Description: Adds logo_path to the restaurants table.

ALTER TABLE restaurants ADD COLUMN logo_path TEXT;
