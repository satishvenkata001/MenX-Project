-- Migration: 004_category_based_sizes.sql
-- Description: Ensure category-specific size master records exist with correct sort orders.
-- Safety: Idempotent and non-destructive. Uses ON CONFLICT (name, category_type) DO UPDATE.

-- 1. APPAREL SIZES (T-Shirts, Shirts, Jackets, Activewear, Ethnic Wear)
INSERT INTO sizes (name, category_type, sort_order)
VALUES
  ('XS', 'APPAREL', 1),
  ('S', 'APPAREL', 2),
  ('M', 'APPAREL', 3),
  ('L', 'APPAREL', 4),
  ('XL', 'APPAREL', 5),
  ('XXL', 'APPAREL', 6),
  ('XXXL', 'APPAREL', 7)
ON CONFLICT (name, category_type)
DO UPDATE SET sort_order = EXCLUDED.sort_order;

-- 2. BOTTOMWEAR SIZES (Jeans, Trousers, Shorts)
INSERT INTO sizes (name, category_type, sort_order)
VALUES
  ('28', 'BOTTOMWEAR', 1),
  ('30', 'BOTTOMWEAR', 2),
  ('32', 'BOTTOMWEAR', 3),
  ('34', 'BOTTOMWEAR', 4),
  ('36', 'BOTTOMWEAR', 5),
  ('38', 'BOTTOMWEAR', 6),
  ('40', 'BOTTOMWEAR', 7),
  ('42', 'BOTTOMWEAR', 8),
  ('44', 'BOTTOMWEAR', 9)
ON CONFLICT (name, category_type)
DO UPDATE SET sort_order = EXCLUDED.sort_order;

-- 3. FOOTWEAR SIZES (Footwear)
INSERT INTO sizes (name, category_type, sort_order)
VALUES
  ('6', 'FOOTWEAR', 1),
  ('7', 'FOOTWEAR', 2),
  ('8', 'FOOTWEAR', 3),
  ('9', 'FOOTWEAR', 4),
  ('10', 'FOOTWEAR', 5),
  ('11', 'FOOTWEAR', 6),
  ('12', 'FOOTWEAR', 7)
ON CONFLICT (name, category_type)
DO UPDATE SET sort_order = EXCLUDED.sort_order;

-- 4. ACCESSORIES SIZES (Accessories)
INSERT INTO sizes (name, category_type, sort_order)
VALUES
  ('One Size', 'ACCESSORIES', 1)
ON CONFLICT (name, category_type)
DO UPDATE SET sort_order = EXCLUDED.sort_order;
