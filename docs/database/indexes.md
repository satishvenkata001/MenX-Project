# MENX Database Indexing Strategy

This document specifies all explicit indexes created across the 35 tables in the MENX PostgreSQL database.

---

## 1. Indexing Strategy

1. **High Selectivity Columns**: Primary search keys, unique constraints, foreign keys with high join frequencies.
2. **Compound / Covered Queries**: Frequently co-queried columns (e.g. `category_id` + `status` on products).
3. **Partial Indexes**: Highly queried subsets (e.g. `status = 'PUBLISHED'`, active coupons, active delivery zones).
4. **Fast Barcode POS Lookup**: B-Tree index on `product_variants.barcode` (`O(log n)`).
5. **Full-Text & Tag Discovery**: GIN index on `products.tags`.

---

## 2. Table-by-Table Index Specification

### 2.1 Catalog & Product Discovery
```sql
CREATE INDEX idx_products_category_status ON products(category_id, status) WHERE status = 'PUBLISHED';
CREATE INDEX idx_products_subcategory_status ON products(subcategory_id, status) WHERE status = 'PUBLISHED';
CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_featured ON products(is_featured) WHERE is_featured = TRUE AND status = 'PUBLISHED';
CREATE INDEX idx_products_tags_gin ON products USING GIN(tags);
CREATE INDEX idx_products_created_at ON products(created_at DESC);

-- Variants & Barcodes
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_barcode ON product_variants(barcode);
CREATE INDEX idx_product_variants_size_color ON product_variants(size_id, color_id);

-- Product Media
CREATE INDEX idx_product_images_product_variant ON product_images(product_id, variant_id);
CREATE INDEX idx_product_images_primary ON product_images(product_id) WHERE is_primary = TRUE;
```

### 2.2 Outfits & Bundles
```sql
CREATE INDEX idx_outfits_slug ON outfits(slug);
CREATE INDEX idx_outfits_active ON outfits(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_outfit_items_outfit_id ON outfit_items(outfit_id);
CREATE INDEX idx_outfit_items_product_id ON outfit_items(product_id);
```

### 2.3 Central Inventory & Multi-Store Stock
```sql
CREATE INDEX idx_inventory_items_store_variant ON inventory_items(store_id, variant_id);
CREATE INDEX idx_inventory_items_variant ON inventory_items(variant_id);
CREATE INDEX idx_inventory_items_low_stock ON inventory_items(store_id, quantity_available);

CREATE INDEX idx_stock_movements_variant ON stock_movements(variant_id, created_at DESC);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type, created_at DESC);
```

### 2.4 Delivery & Pincodes
```sql
CREATE INDEX idx_delivery_zones_active ON delivery_zones(is_active) WHERE is_active = TRUE;
```

### 2.5 Customers, Carts & Wishlist
```sql
CREATE INDEX idx_addresses_user_id ON addresses(user_id);
CREATE INDEX idx_addresses_user_default ON addresses(user_id) WHERE is_default = TRUE;

CREATE INDEX idx_carts_user_id ON carts(user_id);
CREATE INDEX idx_carts_session_token ON carts(session_token) WHERE session_token IS NOT NULL;
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_variant_id ON cart_items(variant_id);

CREATE INDEX idx_wishlists_user_id ON wishlists(user_id);
CREATE INDEX idx_wishlist_items_wishlist_id ON wishlist_items(wishlist_id);
CREATE INDEX idx_wishlist_items_product_id ON wishlist_items(product_id);
```

### 2.6 Orders & COD Transactions
```sql
CREATE INDEX idx_orders_customer_id ON orders(customer_id, created_at DESC);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(order_status, created_at DESC);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_store_id ON orders(store_id, created_at DESC);
CREATE INDEX idx_orders_delivery_zone ON orders(delivery_zone_id);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX idx_orders_tracking_number ON orders(tracking_number) WHERE tracking_number IS NOT NULL;

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_variant_id ON order_items(variant_id);
CREATE INDEX idx_order_status_history_order ON order_status_history(order_id, created_at DESC);
```

### 2.7 Returns, Exchanges & Reviews
```sql
CREATE INDEX idx_return_requests_order_id ON return_requests(order_id);
CREATE INDEX idx_return_requests_customer_id ON return_requests(customer_id);
CREATE INDEX idx_return_requests_status ON return_requests(status);
CREATE INDEX idx_return_items_request_id ON return_items(return_request_id);

CREATE INDEX idx_reviews_product_id ON reviews(product_id, is_approved) WHERE is_approved = TRUE;
CREATE INDEX idx_reviews_customer_id ON reviews(customer_id);
```

### 2.8 Promotions & Audit Logs
```sql
CREATE INDEX idx_coupons_code ON coupons(code) WHERE is_active = TRUE;
CREATE INDEX idx_coupon_redemptions_user ON coupon_redemptions(user_id, coupon_id);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_entity, target_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);
```
