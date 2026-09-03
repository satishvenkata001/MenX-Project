-- Migration 003: Allow catalog hard-deletion while preserving historical order and return accounting snapshots
-- 1. order_items: allow variant_id to be NULL when catalog variant is hard-deleted
ALTER TABLE order_items ALTER COLUMN variant_id DROP NOT NULL;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;

-- 2. return_items: allow variant_id to be NULL when catalog variant is hard-deleted
ALTER TABLE return_items ALTER COLUMN variant_id DROP NOT NULL;
ALTER TABLE return_items DROP CONSTRAINT IF EXISTS return_items_variant_id_fkey;
ALTER TABLE return_items ADD CONSTRAINT return_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;

-- 3. purchase_order_items: allow variant_id to be NULL when catalog variant is hard-deleted
ALTER TABLE purchase_order_items ALTER COLUMN variant_id DROP NOT NULL;
ALTER TABLE purchase_order_items DROP CONSTRAINT IF EXISTS purchase_order_items_variant_id_fkey;
ALTER TABLE purchase_order_items ADD CONSTRAINT purchase_order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;
