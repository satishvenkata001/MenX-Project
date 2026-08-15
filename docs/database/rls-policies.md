# MENX Row Level Security (RLS) Policy Specifications

Every application table in the MENX PostgreSQL database enforces explicit Row Level Security. No table relies on naive `USING (true)` / `WITH CHECK (true)` for write operations.

---

## 1. Security Helper Functions

```sql
-- Returns current user's role from profiles table
CREATE OR REPLACE FUNCTION get_auth_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Checks if current user has administrative / staff privileges
CREATE OR REPLACE FUNCTION is_admin_or_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
      AND role IN ('STORE_STAFF', 'INVENTORY_MANAGER', 'ORDER_MANAGER', 'STORE_MANAGER', 'SUPER_ADMIN')
      AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Checks if current user is manager or superadmin
CREATE OR REPLACE FUNCTION is_manager_or_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
      AND role IN ('STORE_MANAGER', 'SUPER_ADMIN')
      AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

---

## 2. Table-by-Table Policy Definitions (All 35 Tables)

### 2.1 Domain 1: Auth & Users (`profiles`, `stores`, `staff_store_assignments`)
```sql
-- 1. profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_policy" ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin_or_staff());
CREATE POLICY "profiles_insert_policy" ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_policy" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR get_auth_user_role() = 'SUPER_ADMIN')
  WITH CHECK ((id = auth.uid() AND role = (SELECT role FROM profiles WHERE id = auth.uid())) OR get_auth_user_role() = 'SUPER_ADMIN');

-- 2. stores
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stores_public_select" ON stores FOR SELECT USING (is_active = TRUE OR is_admin_or_staff());
CREATE POLICY "stores_admin_modify" ON stores FOR ALL TO authenticated USING (get_auth_user_role() = 'SUPER_ADMIN') WITH CHECK (get_auth_user_role() = 'SUPER_ADMIN');

-- 3. staff_store_assignments
ALTER TABLE staff_store_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_assignments_select" ON staff_store_assignments FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_manager_or_superadmin());
CREATE POLICY "staff_assignments_modify" ON staff_store_assignments FOR ALL TO authenticated USING (get_auth_user_role() = 'SUPER_ADMIN') WITH CHECK (get_auth_user_role() = 'SUPER_ADMIN');
```

### 2.2 Domain 2: Catalog & Taxonomy (Tables 4–11)
```sql
-- 4. categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_select" ON categories FOR SELECT USING (is_active = TRUE OR is_admin_or_staff());
CREATE POLICY "categories_modify" ON categories FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 5. subcategories
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subcategories_select" ON subcategories FOR SELECT USING (is_active = TRUE OR is_admin_or_staff());
CREATE POLICY "subcategories_modify" ON subcategories FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 6. brands
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "brands_select" ON brands FOR SELECT USING (is_active = TRUE OR is_admin_or_staff());
CREATE POLICY "brands_modify" ON brands FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 7. sizes
ALTER TABLE sizes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sizes_select" ON sizes FOR SELECT USING (TRUE);
CREATE POLICY "sizes_modify" ON sizes FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 8. colors
ALTER TABLE colors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "colors_select" ON colors FOR SELECT USING (TRUE);
CREATE POLICY "colors_modify" ON colors FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 9. products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_select" ON products FOR SELECT USING (status = 'PUBLISHED' OR is_admin_or_staff());
CREATE POLICY "products_modify" ON products FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 10. product_variants
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variants_select" ON product_variants FOR SELECT USING (is_active = TRUE OR is_admin_or_staff());
CREATE POLICY "variants_modify" ON product_variants FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 11. product_images
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "images_select" ON product_images FOR SELECT USING (TRUE);
CREATE POLICY "images_modify" ON product_images FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());
```

### 2.3 Domain 3: Outfits & Bundles (Tables 12–13)
```sql
-- 12. outfits
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outfits_select" ON outfits FOR SELECT USING (is_active = TRUE OR is_admin_or_staff());
CREATE POLICY "outfits_modify" ON outfits FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 13. outfit_items
ALTER TABLE outfit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outfit_items_select" ON outfit_items FOR SELECT USING (TRUE);
CREATE POLICY "outfit_items_modify" ON outfit_items FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());
```

### 2.4 Domain 4: Suppliers & Purchasing (Tables 14–16)
```sql
-- 14. suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_policy" ON suppliers FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 15. purchase_orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_policy" ON purchase_orders FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 16. purchase_order_items
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_items_policy" ON purchase_order_items FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());
```

### 2.5 Domain 5: Central Multi-Store Inventory & Movements (Tables 17–18)
```sql
-- 17. inventory_items
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_read_policy" ON inventory_items FOR SELECT TO authenticated USING (is_admin_or_staff());
CREATE POLICY "inventory_modify_policy" ON inventory_items FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 18. stock_movements
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_movements_read" ON stock_movements FOR SELECT TO authenticated USING (is_admin_or_staff());
CREATE POLICY "stock_movements_insert" ON stock_movements FOR INSERT TO authenticated WITH CHECK (is_admin_or_staff());
```

### 2.6 Domain 6: Delivery & Shipping Rules (Table 19)
```sql
-- 19. delivery_zones
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_zones_public_select" ON delivery_zones FOR SELECT USING (is_active = TRUE OR is_admin_or_staff());
CREATE POLICY "delivery_zones_admin_modify" ON delivery_zones FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());
```

### 2.7 Domain 7: Customer Addresses & Wishlist (Tables 20–22)
```sql
-- 20. addresses
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addresses_owner_select" ON addresses FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin_or_staff());
CREATE POLICY "addresses_owner_insert" ON addresses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "addresses_owner_update" ON addresses FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "addresses_owner_delete" ON addresses FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 21. wishlists
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wishlists_owner_policy" ON wishlists FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 22. wishlist_items
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wishlist_items_owner_policy" ON wishlist_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM wishlists WHERE wishlists.id = wishlist_items.wishlist_id AND wishlists.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM wishlists WHERE wishlists.id = wishlist_items.wishlist_id AND wishlists.user_id = auth.uid()));
```

### 2.8 Domain 8: Shopping Carts (Tables 23–24)
```sql
-- 23. carts
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carts_owner_policy" ON carts FOR ALL TO authenticated
  USING (user_id = auth.uid() OR is_admin_or_staff())
  WITH CHECK (user_id = auth.uid() OR is_admin_or_staff());

-- 24. cart_items
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cart_items_owner_policy" ON cart_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND carts.user_id = auth.uid()));
```

### 2.9 Domain 9: Promotions & Reviews (Tables 25–27)
```sql
-- 25. coupons
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupons_select" ON coupons FOR SELECT USING (is_active = TRUE OR is_admin_or_staff());
CREATE POLICY "coupons_modify" ON coupons FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 26. coupon_redemptions
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "redemptions_select" ON coupon_redemptions FOR SELECT TO authenticated USING (user_id = auth.uid() OR is_admin_or_staff());
CREATE POLICY "redemptions_insert" ON coupon_redemptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR is_admin_or_staff());

-- 27. reviews
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_select" ON reviews FOR SELECT USING (is_approved = TRUE OR customer_id = auth.uid() OR is_admin_or_staff());
CREATE POLICY "reviews_insert" ON reviews FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "reviews_update" ON reviews FOR UPDATE TO authenticated USING (customer_id = auth.uid() OR is_admin_or_staff()) WITH CHECK (customer_id = auth.uid() OR is_admin_or_staff());
```

### 2.10 Domain 10: Orders & History (Tables 28–30)
```sql
-- 28. orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_select" ON orders FOR SELECT TO authenticated USING (customer_id = auth.uid() OR is_admin_or_staff());
CREATE POLICY "orders_insert_backend" ON orders FOR INSERT TO authenticated WITH CHECK (is_admin_or_staff());
CREATE POLICY "orders_update_staff" ON orders FOR UPDATE TO authenticated USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- 29. order_items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_select" ON order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND (orders.customer_id = auth.uid() OR is_admin_or_staff())));

-- 30. order_status_history
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_history_select" ON order_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND (orders.customer_id = auth.uid() OR is_admin_or_staff())));
```

### 2.11 Domain 11: Returns & Exchanges (Tables 31–33)
```sql
-- 31. return_requests
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "returns_select" ON return_requests FOR SELECT TO authenticated USING (customer_id = auth.uid() OR is_admin_or_staff());
CREATE POLICY "returns_insert" ON return_requests FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "returns_update" ON return_requests FOR UPDATE TO authenticated USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- 32. return_items
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "return_items_select" ON return_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM return_requests WHERE return_requests.id = return_items.return_request_id AND (return_requests.customer_id = auth.uid() OR is_admin_or_staff())));

-- 33. return_status_history
ALTER TABLE return_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "return_history_select" ON return_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM return_requests WHERE return_requests.id = return_status_history.return_request_id AND (return_requests.customer_id = auth.uid() OR is_admin_or_staff())));
```

### 2.12 Domain 12: POS Sessions & Audit Logs (Tables 34–35)
```sql
-- 34. pos_sessions
ALTER TABLE pos_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_sessions_select" ON pos_sessions FOR SELECT TO authenticated USING (cashier_id = auth.uid() OR is_manager_or_superadmin());
CREATE POLICY "pos_sessions_modify" ON pos_sessions FOR ALL TO authenticated USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- 35. audit_logs (Strictly Immutable)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT TO authenticated USING (is_manager_or_superadmin());
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (is_admin_or_staff());
```
