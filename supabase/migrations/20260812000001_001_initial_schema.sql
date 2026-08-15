-- ==============================================================================
-- MENX E-COMMERCE & RETAIL MANAGEMENT PLATFORM
-- INITIAL SCHEMA MIGRATION (DRAFT ONLY - DO NOT EXECUTE DIRECTLY)
-- Database Engine: PostgreSQL 15+ (Supabase)
-- Authoritative Tables Count: Exactly 35 Tables
-- ==============================================================================

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. ENUM TYPES
-- ==============================================================================
CREATE TYPE user_role AS ENUM (
  'CUSTOMER',
  'STORE_STAFF',
  'INVENTORY_MANAGER',
  'ORDER_MANAGER',
  'STORE_MANAGER',
  'SUPER_ADMIN'
);

CREATE TYPE product_status AS ENUM (
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED'
);

CREATE TYPE store_type AS ENUM (
  'PHYSICAL_STORE',
  'CENTRAL_WAREHOUSE',
  'ONLINE_FULFILLMENT'
);

CREATE TYPE order_channel AS ENUM (
  'ONLINE',
  'POS_STORE'
);

CREATE TYPE order_status AS ENUM (
  'PENDING',
  'CONFIRMED',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'FAILED_DELIVERY',
  'RETURN_REQUESTED',
  'RETURNED'
);

CREATE TYPE payment_method AS ENUM (
  'COD'
);

CREATE TYPE payment_status AS ENUM (
  'PENDING',
  'COLLECTED',
  'COLLECTION_FAILED',
  'REFUND_REQUIRED',
  'REFUNDED'
);

CREATE TYPE return_type AS ENUM (
  'RETURN',
  'EXCHANGE'
);

CREATE TYPE return_reason AS ENUM (
  'WRONG_SIZE',
  'DEFECTIVE',
  'NOT_AS_DESCRIBED',
  'CHANGED_MIND',
  'QUALITY_ISSUE',
  'OTHER'
);

CREATE TYPE return_status AS ENUM (
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'PICKUP_SCHEDULED',
  'RECEIVED_IN_STORE',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE stock_movement_type AS ENUM (
  'INITIAL_STOCK',
  'PURCHASE_RECEIPT',
  'ONLINE_ORDER_RESERVED',
  'ONLINE_ORDER_FULFILLED',
  'ONLINE_ORDER_CANCELLED',
  'POS_SALE',
  'POS_RETURN',
  'ONLINE_RETURN',
  'STOCK_TRANSFER',
  'INVENTORY_ADJUSTMENT',
  'DAMAGED_WRITEOFF'
);

CREATE TYPE discount_type AS ENUM (
  'PERCENTAGE',
  'FLAT_AMOUNT',
  'BUNDLE_PRICE'
);

-- ==============================================================================
-- 3. DOMAIN 1: AUTHENTICATION & STORES (Tables 1–3)
-- ==============================================================================

-- 1. Profiles (Extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  role user_role NOT NULL DEFAULT 'CUSTOMER',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Stores & Warehouses (e.g. Talapudi Shop, Central Warehouse)
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  type store_type NOT NULL DEFAULT 'PHYSICAL_STORE',
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  phone VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Staff Store Assignments
CREATE TABLE staff_store_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_staff_store UNIQUE(user_id, store_id)
);

-- ==============================================================================
-- 4. DOMAIN 2: CATALOG TAXONOMY & PRODUCTS (Tables 4–11)
-- ==============================================================================

-- 4. Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Subcategories
CREATE TABLE subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  display_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Brands
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Sizes
CREATE TABLE sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  category_type VARCHAR(50) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_size_category UNIQUE(name, category_type)
);

-- 8. Colors
CREATE TABLE colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  hex_code VARCHAR(7) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(280) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_id UUID NOT NULL REFERENCES subcategories(id) ON DELETE RESTRICT,
  brand_id UUID REFERENCES brands(id) ON DELETE SET NULL,
  status product_status NOT NULL DEFAULT 'DRAFT',
  base_mrp NUMERIC(10,2) NOT NULL CHECK (base_mrp >= 0),
  base_price NUMERIC(10,2) NOT NULL CHECK (base_price >= 0),
  material VARCHAR(150),
  care_instructions TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_product_price_mrp CHECK (base_price <= base_mrp)
);

-- 10. Product Variants (Specific Size + Color with SKU & Barcode)
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL UNIQUE,
  barcode VARCHAR(100) NOT NULL UNIQUE,
  size_id UUID NOT NULL REFERENCES sizes(id) ON DELETE RESTRICT,
  color_id UUID NOT NULL REFERENCES colors(id) ON DELETE RESTRICT,
  mrp NUMERIC(10,2) NOT NULL CHECK (mrp >= 0),
  selling_price NUMERIC(10,2) NOT NULL CHECK (selling_price >= 0),
  weight_grams INT,
  low_stock_threshold INT NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_product_size_color UNIQUE(product_id, size_id, color_id),
  CONSTRAINT chk_variant_price_mrp CHECK (selling_price <= mrp)
);

-- 11. Product Images
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  alt_text VARCHAR(255),
  display_order INT NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. DOMAIN 3: OUTFIT COMBINATIONS & BUNDLES (Tables 12–13)
-- ==============================================================================

-- 12. Outfits
CREATE TABLE outfits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(280) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  banner_url TEXT,
  discount_type discount_type NOT NULL DEFAULT 'PERCENTAGE',
  discount_value NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (discount_value >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Outfit Items (References canonical products for dynamic variant selection)
CREATE TABLE outfit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outfit_id UUID NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_outfit_product UNIQUE(outfit_id, product_id)
);

-- ==============================================================================
-- 6. DOMAIN 4: SUPPLIERS & PURCHASING (Tables 14–16)
-- ==============================================================================

-- 14. Suppliers
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  address TEXT,
  gstin_tax_id VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Purchase Orders
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(50) NOT NULL UNIQUE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (total_cost >= 0),
  ordered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Purchase Order Items
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity_ordered INT NOT NULL CHECK (quantity_ordered > 0),
  quantity_received INT NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost NUMERIC(10,2) NOT NULL CHECK (unit_cost >= 0),
  total_cost NUMERIC(10,2) NOT NULL CHECK (total_cost >= 0),
  CONSTRAINT uq_po_variant UNIQUE(purchase_order_id, variant_id)
);

-- ==============================================================================
-- 7. DOMAIN 5: CENTRAL MULTI-STORE INVENTORY & MOVEMENTS (Tables 17–18)
-- ==============================================================================

-- 17. Inventory Items (Authoritative variant stock per physical/warehouse store)
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity_available INT NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
  quantity_reserved INT NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  quantity_damaged INT NOT NULL DEFAULT 0 CHECK (quantity_damaged >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_store_variant UNIQUE(store_id, variant_id)
);

-- 18. Stock Movements Ledger (Immutable audit trail)
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  source_store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  destination_store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  movement_type stock_movement_type NOT NULL,
  quantity INT NOT NULL CHECK (quantity != 0),
  reference_type VARCHAR(50) NOT NULL,
  reference_id UUID,
  reason TEXT,
  performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 8. DOMAIN 6: DELIVERY & SHIPPING RULES (Table 19)
-- ==============================================================================

-- 19. Delivery Zones
CREATE TABLE delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  pincode_pattern VARCHAR(100) NOT NULL,
  base_delivery_charge NUMERIC(10,2) NOT NULL DEFAULT 50.00 CHECK (base_delivery_charge >= 0),
  free_delivery_threshold NUMERIC(10,2) CHECK (free_delivery_threshold >= 0),
  estimated_days_min INT NOT NULL DEFAULT 1 CHECK (estimated_days_min >= 0),
  estimated_days_max INT NOT NULL DEFAULT 3 CHECK (estimated_days_max >= estimated_days_min),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 9. DOMAIN 7: CUSTOMERS, ADDRESSES & WISHLISTS (Tables 20–22)
-- ==============================================================================

-- 20. Addresses
CREATE TABLE addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_name VARCHAR(150) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  alternate_phone VARCHAR(20),
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  landmark VARCHAR(150),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  address_type VARCHAR(20) NOT NULL DEFAULT 'HOME',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 21. Wishlists
CREATE TABLE wishlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 22. Wishlist Items
CREATE TABLE wishlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_wishlist_product UNIQUE(wishlist_id, product_id)
);

-- ==============================================================================
-- 10. DOMAIN 8: SHOPPING CARTS (Tables 23–24)
-- ==============================================================================

-- 23. Carts (Authenticated & Secure Guest Carts)
CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  session_token VARCHAR(64) UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_cart_owner CHECK (user_id IS NOT NULL OR session_token IS NOT NULL)
);

-- 24. Cart Items
CREATE TABLE cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  outfit_id UUID REFERENCES outfits(id) ON DELETE SET NULL,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_cart_variant UNIQUE(cart_id, variant_id)
);

-- ==============================================================================
-- 11. DOMAIN 9: PROMOTIONS & SOCIAL PROOF (Tables 25–27)
-- ==============================================================================

-- 25. Coupons
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  discount_type discount_type NOT NULL DEFAULT 'PERCENTAGE',
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value >= 0),
  min_order_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (min_order_amount >= 0),
  max_discount_amount NUMERIC(10,2) CHECK (max_discount_amount >= 0),
  usage_limit_per_user INT NOT NULL DEFAULT 1,
  total_usage_limit INT,
  used_count INT NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 26. Coupon Redemptions
CREATE TABLE coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL,
  discount_applied NUMERIC(10,2) NOT NULL CHECK (discount_applied >= 0),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_coupon_order UNIQUE(coupon_id, order_id)
);

-- 27. Reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_item_id UUID,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(150),
  comment TEXT,
  is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  is_approved BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 12. DOMAIN 10: ORDERS & CASH ON DELIVERY (Tables 28–30)
-- ==============================================================================

-- 28. Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(32) NOT NULL UNIQUE,
  customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  order_channel order_channel NOT NULL DEFAULT 'ONLINE',
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  delivery_zone_id UUID REFERENCES delivery_zones(id) ON DELETE SET NULL,
  order_status order_status NOT NULL DEFAULT 'PENDING',
  payment_method payment_method NOT NULL DEFAULT 'COD',
  payment_status payment_status NOT NULL DEFAULT 'PENDING',
  subtotal_amount NUMERIC(10,2) NOT NULL CHECK (subtotal_amount >= 0),
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee >= 0),
  total_payable NUMERIC(10,2) NOT NULL CHECK (total_payable >= 0),
  cod_amount_due NUMERIC(10,2) NOT NULL CHECK (cod_amount_due >= 0),
  cod_amount_collected NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (cod_amount_collected >= 0),
  cod_collected_at TIMESTAMPTZ,
  cod_collected_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  shipping_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  shipping_snapshot JSONB NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_notes TEXT,
  admin_notes TEXT,
  tracking_number VARCHAR(100),
  courier_partner VARCHAR(100),
  cancelled_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_orders_cod_only CHECK (payment_method = 'COD')
);

-- Add deferred foreign keys for orders
ALTER TABLE coupon_redemptions ADD CONSTRAINT fk_redemption_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- 29. Order Items (Frozen snapshot)
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  outfit_id UUID REFERENCES outfits(id) ON DELETE SET NULL,
  product_title_snapshot VARCHAR(255) NOT NULL,
  variant_sku_snapshot VARCHAR(100) NOT NULL,
  size_snapshot VARCHAR(50) NOT NULL,
  color_snapshot VARCHAR(50) NOT NULL,
  unit_mrp_snapshot NUMERIC(10,2) NOT NULL CHECK (unit_mrp_snapshot >= 0),
  unit_price_snapshot NUMERIC(10,2) NOT NULL CHECK (unit_price_snapshot >= 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  line_subtotal NUMERIC(10,2) NOT NULL CHECK (line_subtotal >= 0),
  line_discount NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (line_discount >= 0),
  line_total NUMERIC(10,2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add deferred review order_item FK and unique constraint
ALTER TABLE reviews ADD CONSTRAINT fk_reviews_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL;
ALTER TABLE reviews ADD CONSTRAINT uq_product_customer_order UNIQUE(product_id, customer_id, order_item_id);

-- 30. Order Status History
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status,
  to_status order_status NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 13. DOMAIN 11: RETURNS & EXCHANGES (Tables 31–33)
-- ==============================================================================

-- 31. Return Requests
CREATE TABLE return_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number VARCHAR(32) NOT NULL UNIQUE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  status return_status NOT NULL DEFAULT 'REQUESTED',
  request_type return_type NOT NULL DEFAULT 'RETURN',
  reason return_reason NOT NULL,
  customer_comment TEXT,
  admin_notes TEXT,
  proof_image_urls TEXT[] NOT NULL DEFAULT '{}',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 32. Return Items
CREATE TABLE return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_request_id UUID NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  replacement_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  condition_on_receipt VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 33. Return Status History
CREATE TABLE return_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_request_id UUID NOT NULL REFERENCES return_requests(id) ON DELETE CASCADE,
  from_status return_status,
  to_status return_status NOT NULL,
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 14. DOMAIN 12: PHYSICAL POS & AUDIT LOGS (Tables 34–35)
-- ==============================================================================

-- 34. POS Register Sessions
CREATE TABLE pos_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  cashier_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_cash NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (opening_cash >= 0),
  closing_cash NUMERIC(10,2) CHECK (closing_cash >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 35. Security Audit Logs (Immutable)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  target_entity VARCHAR(100) NOT NULL,
  target_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 15. INDEXES
-- ==============================================================================

CREATE INDEX idx_products_category_status ON products(category_id, status) WHERE status = 'PUBLISHED';
CREATE INDEX idx_products_subcategory_status ON products(subcategory_id, status) WHERE status = 'PUBLISHED';
CREATE INDEX idx_products_brand_id ON products(brand_id);
CREATE INDEX idx_products_featured ON products(is_featured) WHERE is_featured = TRUE AND status = 'PUBLISHED';
CREATE INDEX idx_products_tags_gin ON products USING GIN(tags);
CREATE INDEX idx_products_created_at ON products(created_at DESC);

CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_product_variants_barcode ON product_variants(barcode);
CREATE INDEX idx_product_variants_size_color ON product_variants(size_id, color_id);

CREATE INDEX idx_product_images_product_variant ON product_images(product_id, variant_id);
CREATE INDEX idx_product_images_primary ON product_images(product_id) WHERE is_primary = TRUE;

CREATE INDEX idx_outfits_slug ON outfits(slug);
CREATE INDEX idx_outfits_active ON outfits(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_outfit_items_outfit_id ON outfit_items(outfit_id);
CREATE INDEX idx_outfit_items_product_id ON outfit_items(product_id);

CREATE INDEX idx_inventory_items_store_variant ON inventory_items(store_id, variant_id);
CREATE INDEX idx_inventory_items_variant ON inventory_items(variant_id);
CREATE INDEX idx_inventory_items_low_stock ON inventory_items(store_id, quantity_available);

CREATE INDEX idx_stock_movements_variant ON stock_movements(variant_id, created_at DESC);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);
CREATE INDEX idx_stock_movements_type ON stock_movements(movement_type, created_at DESC);

CREATE INDEX idx_delivery_zones_active ON delivery_zones(is_active) WHERE is_active = TRUE;

CREATE INDEX idx_addresses_user_id ON addresses(user_id);
CREATE INDEX idx_addresses_user_default ON addresses(user_id) WHERE is_default = TRUE;

CREATE INDEX idx_carts_user_id ON carts(user_id);
CREATE INDEX idx_carts_session_token ON carts(session_token) WHERE session_token IS NOT NULL;
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_variant_id ON cart_items(variant_id);

CREATE INDEX idx_wishlists_user_id ON wishlists(user_id);
CREATE INDEX idx_wishlist_items_wishlist_id ON wishlist_items(wishlist_id);
CREATE INDEX idx_wishlist_items_product_id ON wishlist_items(product_id);

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

CREATE INDEX idx_return_requests_order_id ON return_requests(order_id);
CREATE INDEX idx_return_requests_customer_id ON return_requests(customer_id);
CREATE INDEX idx_return_requests_status ON return_requests(status);
CREATE INDEX idx_return_items_request_id ON return_items(return_request_id);

CREATE INDEX idx_reviews_product_id ON reviews(product_id, is_approved) WHERE is_approved = TRUE;
CREATE INDEX idx_reviews_customer_id ON reviews(customer_id);

CREATE INDEX idx_coupons_code ON coupons(code) WHERE is_active = TRUE;
CREATE INDEX idx_coupon_redemptions_user ON coupon_redemptions(user_id, coupon_id);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_target ON audit_logs(target_entity, target_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);

-- ==============================================================================
-- 16. HELPER FUNCTIONS & TRIGGERS
-- ==============================================================================

-- 16.1 Timestamp Auto-Update Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_subcategories_updated_at BEFORE UPDATE ON subcategories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_product_variants_updated_at BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_outfits_updated_at BEFORE UPDATE ON outfits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_delivery_zones_updated_at BEFORE UPDATE ON delivery_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_addresses_updated_at BEFORE UPDATE ON addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_carts_updated_at BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_cart_items_updated_at BEFORE UPDATE ON cart_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_coupons_updated_at BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_return_requests_updated_at BEFORE UPDATE ON return_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 16.2 Security Role Helper Functions
CREATE OR REPLACE FUNCTION get_auth_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_admin_or_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
      AND role IN ('STORE_STAFF', 'INVENTORY_MANAGER', 'ORDER_MANAGER', 'STORE_MANAGER', 'SUPER_ADMIN')
      AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_manager_or_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
      AND role IN ('STORE_MANAGER', 'SUPER_ADMIN')
      AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 16.3 Order Status Transition Tracker
CREATE OR REPLACE FUNCTION record_order_status_history()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.order_status IS DISTINCT FROM NEW.order_status THEN
    INSERT INTO order_status_history (
      order_id,
      from_status,
      to_status,
      changed_by,
      note
    ) VALUES (
      NEW.id,
      OLD.order_status,
      NEW.order_status,
      auth.uid(),
      'Status transitioned'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_orders_status_history
  AFTER UPDATE OF order_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION record_order_status_history();

-- 16.4 Automatic New User Signup Profile Creation Trigger
CREATE OR REPLACE FUNCTION handle_new_user_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, first_name, last_name, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Customer'),
    NEW.raw_user_meta_data->>'last_name',
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'CUSTOMER'
  );
  INSERT INTO wishlists (user_id) VALUES (NEW.id);
  INSERT INTO carts (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_signup();

-- 16.5 Role Change Audit Trigger
CREATE OR REPLACE FUNCTION audit_role_change_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    INSERT INTO audit_logs (
      actor_id,
      actor_role,
      action,
      target_entity,
      target_id,
      old_values,
      new_values
    ) VALUES (
      auth.uid(),
      (SELECT role::text FROM profiles WHERE id = auth.uid()),
      'ROLE_ASSIGNMENT_CHANGED',
      'profiles',
      NEW.id,
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_audit_profile_role_change
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION audit_role_change_trigger();

-- 16.6 Atomic Inventory Reservation Procedure
CREATE OR REPLACE FUNCTION reserve_inventory_for_order(
  p_store_id UUID,
  p_variant_id UUID,
  p_quantity INT,
  p_order_id UUID,
  p_performed_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_available INT;
BEGIN
  SELECT quantity_available INTO v_available
  FROM inventory_items
  WHERE store_id = p_store_id AND variant_id = p_variant_id
  FOR UPDATE;

  IF v_available IS NULL OR v_available < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for variant % at store %. Available: %, Requested: %',
      p_variant_id, p_store_id, COALESCE(v_available, 0), p_quantity;
  END IF;

  UPDATE inventory_items
  SET 
    quantity_available = quantity_available - p_quantity,
    quantity_reserved = quantity_reserved + p_quantity,
    updated_at = NOW()
  WHERE store_id = p_store_id AND variant_id = p_variant_id;

  INSERT INTO stock_movements (
    variant_id,
    source_store_id,
    movement_type,
    quantity,
    reference_type,
    reference_id,
    reason,
    performed_by
  ) VALUES (
    p_variant_id,
    p_store_id,
    'ONLINE_ORDER_RESERVED',
    p_quantity,
    'ORDER',
    p_order_id,
    'Stock reserved for online COD order',
    p_performed_by
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- 17. ROW LEVEL SECURITY (RLS) POLICIES (All 35 Tables)
-- ==============================================================================

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

-- 12. outfits
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outfits_select" ON outfits FOR SELECT USING (is_active = TRUE OR is_admin_or_staff());
CREATE POLICY "outfits_modify" ON outfits FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 13. outfit_items
ALTER TABLE outfit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outfit_items_select" ON outfit_items FOR SELECT USING (TRUE);
CREATE POLICY "outfit_items_modify" ON outfit_items FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 14. suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "suppliers_policy" ON suppliers FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 15. purchase_orders
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_policy" ON purchase_orders FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 16. purchase_order_items
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_items_policy" ON purchase_order_items FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 17. inventory_items
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_read_policy" ON inventory_items FOR SELECT TO authenticated USING (is_admin_or_staff());
CREATE POLICY "inventory_modify_policy" ON inventory_items FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

-- 18. stock_movements
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_movements_read" ON stock_movements FOR SELECT TO authenticated USING (is_admin_or_staff());
CREATE POLICY "stock_movements_insert" ON stock_movements FOR INSERT TO authenticated WITH CHECK (is_admin_or_staff());

-- 19. delivery_zones
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "delivery_zones_public_select" ON delivery_zones FOR SELECT USING (is_active = TRUE OR is_admin_or_staff());
CREATE POLICY "delivery_zones_admin_modify" ON delivery_zones FOR ALL TO authenticated USING (is_manager_or_superadmin()) WITH CHECK (is_manager_or_superadmin());

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

-- 34. pos_sessions
ALTER TABLE pos_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_sessions_select" ON pos_sessions FOR SELECT TO authenticated USING (cashier_id = auth.uid() OR is_manager_or_superadmin());
CREATE POLICY "pos_sessions_modify" ON pos_sessions FOR ALL TO authenticated USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- 35. audit_logs (Strictly Immutable)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT TO authenticated USING (is_manager_or_superadmin());
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT TO authenticated WITH CHECK (is_admin_or_staff());
