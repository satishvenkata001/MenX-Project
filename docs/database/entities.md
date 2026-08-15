# MENX Database Entities & Data Dictionary

This document details every table, column, data type, constraint, nullability, and default value across all **35 authoritative tables** in the MENX database schema.

---

## 1. Custom Enum Types

```sql
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
```

---

## 2. Domain 1: Authentication & Users (Tables 1–3)

### 1. `profiles`
Customer and staff accounts extending Supabase `auth.users`.

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | PK | References `auth.users(id)` ON DELETE CASCADE |
| `first_name` | VARCHAR(100) | NO | - | First name |
| `last_name` | VARCHAR(100) | YES | NULL | Last name |
| `email` | VARCHAR(255) | YES | NULL | Email address |
| `phone` | VARCHAR(20) | NO | - | Contact phone for COD confirmation |
| `role` | `user_role` | NO | `'CUSTOMER'` | Authorization role |
| `is_active` | BOOLEAN | NO | `TRUE` | Active flag |
| `avatar_url` | TEXT | YES | NULL | Profile image URL |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Modification timestamp |

### 2. `stores`
Physical retail outlets (e.g. Talapudi Shop) and central fulfillment warehouses.

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `name` | VARCHAR(150) | NO | - | Store name |
| `code` | VARCHAR(50) | NO | - | Unique code (e.g. `STORE-TALAPUDI-01`) |
| `type` | `store_type` | NO | `'PHYSICAL_STORE'` | Store classification |
| `address_line1` | VARCHAR(255) | NO | - | Street address |
| `address_line2` | VARCHAR(255) | YES | NULL | Landmark |
| `city` | VARCHAR(100) | NO | - | City |
| `state` | VARCHAR(100) | NO | - | State |
| `postal_code` | VARCHAR(20) | NO | - | PIN code |
| `phone` | VARCHAR(20) | YES | NULL | Store phone |
| `is_active` | BOOLEAN | NO | `TRUE` | Active status |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Modification timestamp |
| *Constraints* | UNIQUE(`code`) | | | |

### 3. `staff_store_assignments`
Assigns staff members to specific store locations.

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `user_id` | UUID | NO | - | FK -> `profiles(id)` ON DELETE CASCADE |
| `store_id` | UUID | NO | - | FK -> `stores(id)` ON DELETE CASCADE |
| `is_primary` | BOOLEAN | NO | `TRUE` | Primary work location |
| `assigned_at` | TIMESTAMPTZ | NO | `NOW()` | Assignment timestamp |
| *Constraints* | UNIQUE(`user_id`, `store_id`) | | | |

---

## 3. Domain 2: Catalog & Taxonomy (Tables 4–11)

### 4. `categories`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `name` | VARCHAR(100) | NO | - | Category title |
| `slug` | VARCHAR(120) | NO | - | URL slug |
| `description` | TEXT | YES | NULL | Description |
| `image_url` | TEXT | YES | NULL | Category image |
| `display_order` | INT | NO | `0` | Sequence |
| `is_active` | BOOLEAN | NO | `TRUE` | Active flag |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`slug`) | | | |

### 5. `subcategories`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `category_id` | UUID | NO | - | FK -> `categories(id)` ON DELETE RESTRICT |
| `name` | VARCHAR(100) | NO | - | Subcategory title |
| `slug` | VARCHAR(120) | NO | - | URL slug |
| `description` | TEXT | YES | NULL | Description |
| `image_url` | TEXT | YES | NULL | Thumbnail |
| `display_order` | INT | NO | `0` | Sequence |
| `is_active` | BOOLEAN | NO | `TRUE` | Active flag |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`slug`) | | | |

### 6. `brands`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `name` | VARCHAR(100) | NO | - | Brand name |
| `slug` | VARCHAR(120) | NO | - | Brand slug |
| `logo_url` | TEXT | YES | NULL | Logo image |
| `is_active` | BOOLEAN | NO | `TRUE` | Active flag |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`slug`) | | | |

### 7. `sizes`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `name` | VARCHAR(50) | NO | - | E.g. 'S', 'M', '32', 'UK 9' |
| `category_type` | VARCHAR(50) | NO | - | E.g. 'APPAREL_TOPS', 'FOOTWEAR' |
| `sort_order` | INT | NO | `0` | Sequence |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`name`, `category_type`) | | | |

### 8. `colors`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `name` | VARCHAR(50) | NO | - | E.g. 'Midnight Black', 'Olive' |
| `hex_code` | VARCHAR(7) | NO | - | E.g. `#000000` |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`name`) | | | |

### 9. `products`
The core catalog master.

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `title` | VARCHAR(255) | NO | - | Product title |
| `slug` | VARCHAR(280) | NO | - | Product slug |
| `description` | TEXT | NO | - | Detailed description |
| `category_id` | UUID | NO | - | FK -> `categories(id)` ON DELETE RESTRICT |
| `subcategory_id` | UUID | NO | - | FK -> `subcategories(id)` ON DELETE RESTRICT |
| `brand_id` | UUID | YES | NULL | FK -> `brands(id)` ON DELETE SET NULL |
| `status` | `product_status`| NO | `'DRAFT'` | Publishing status |
| `base_mrp` | NUMERIC(10,2) | NO | - | Base MRP (`>= 0`) |
| `base_price` | NUMERIC(10,2) | NO | - | Base selling price (`>= 0` AND `<= base_mrp`) |
| `material` | VARCHAR(150) | YES | NULL | Fabric composition |
| `care_instructions`| TEXT | YES | NULL | Wash care |
| `tags` | TEXT[] | NO | `'{}'` | Search tags |
| `is_featured` | BOOLEAN | NO | `FALSE` | Featured on home screen |
| `created_by` | UUID | YES | NULL | FK -> `profiles(id)` ON DELETE SET NULL |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`slug`), CHECK(`base_price` <= `base_mrp`) | | | |

### 10. `product_variants`
The sellable unit of inventory (Color + Size combination).

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `product_id` | UUID | NO | - | FK -> `products(id)` ON DELETE CASCADE |
| `sku` | VARCHAR(100) | NO | - | Unique SKU (e.g. `MX-SHT-BLK-M`) |
| `barcode` | VARCHAR(100) | NO | - | Unique Barcode for POS scanner |
| `size_id` | UUID | NO | - | FK -> `sizes(id)` ON DELETE RESTRICT |
| `color_id` | UUID | NO | - | FK -> `colors(id)` ON DELETE RESTRICT |
| `mrp` | NUMERIC(10,2) | NO | - | Variant MRP |
| `selling_price` | NUMERIC(10,2) | NO | - | Variant Selling Price (`<= mrp`) |
| `weight_grams` | INT | YES | NULL | Weight for shipping |
| `low_stock_threshold`| INT | NO | `5` | Reorder alert threshold |
| `is_active` | BOOLEAN | NO | `TRUE` | Active flag |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`sku`), UNIQUE(`barcode`), UNIQUE(`product_id`, `size_id`, `color_id`), CHECK(`selling_price` <= `mrp`) | | | |

### 11. `product_images`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `product_id` | UUID | NO | - | FK -> `products(id)` ON DELETE CASCADE |
| `variant_id` | UUID | YES | NULL | FK -> `product_variants(id)` ON DELETE SET NULL |
| `image_url` | TEXT | NO | - | Storage URL |
| `alt_text` | VARCHAR(255) | YES | NULL | Alt text |
| `display_order` | INT | NO | `0` | Order |
| `is_primary` | BOOLEAN | NO | `FALSE` | Primary photo |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |

---

## 4. Domain 3: Outfits & Bundles (Tables 12–13)

### 12. `outfits`
Curated looks styling multiple products.

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `title` | VARCHAR(255) | NO | - | Look title (e.g. 'Casual Weekend Look') |
| `slug` | VARCHAR(280) | NO | - | Unique slug |
| `description` | TEXT | NO | - | Styling guidance |
| `image_url` | TEXT | NO | - | Master lookbook image |
| `banner_url` | TEXT | YES | NULL | Banner image |
| `discount_type` | `discount_type` | NO | `'PERCENTAGE'` | Bundle discount formula |
| `discount_value`| NUMERIC(10,2) | NO | `0.00` | Discount magnitude |
| `is_active` | BOOLEAN | NO | `TRUE` | Active flag |
| `created_by` | UUID | YES | NULL | FK -> `profiles(id)` |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`slug`) | | | |

### 13. `outfit_items`
Links individual catalog products to outfits as modular components.

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `outfit_id` | UUID | NO | - | FK -> `outfits(id)` ON DELETE CASCADE |
| `product_id` | UUID | NO | - | FK -> `products(id)` ON DELETE RESTRICT |
| `is_mandatory` | BOOLEAN | NO | `TRUE` | Mandatory item in look |
| `display_order` | INT | NO | `0` | Display sequence |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`outfit_id`, `product_id`) | | | |

---

## 5. Domain 4: Suppliers & Purchasing (Tables 14–16)

### 14. `suppliers`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `name` | VARCHAR(150) | NO | - | Supplier business name |
| `contact_person`| VARCHAR(100) | YES | NULL | Contact name |
| `email` | VARCHAR(255) | YES | NULL | Email |
| `phone` | VARCHAR(20) | NO | - | Phone |
| `address` | TEXT | YES | NULL | Address |
| `gstin_tax_id` | VARCHAR(50) | YES | NULL | Tax ID |
| `is_active` | BOOLEAN | NO | `TRUE` | Active flag |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |

### 15. `purchase_orders`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `po_number` | VARCHAR(50) | NO | - | PO Reference code |
| `supplier_id` | UUID | NO | - | FK -> `suppliers(id)` ON DELETE RESTRICT |
| `store_id` | UUID | NO | - | FK -> `stores(id)` (Receiving store) |
| `status` | VARCHAR(50) | NO | `'DRAFT'` | `DRAFT`, `ORDERED`, `RECEIVED`, `CANCELLED` |
| `total_cost` | NUMERIC(12,2) | NO | `0.00` | PO invoice total |
| `ordered_at` | TIMESTAMPTZ | YES | NULL | Order date |
| `received_at` | TIMESTAMPTZ | YES | NULL | Delivery date |
| `created_by` | UUID | YES | NULL | FK -> `profiles(id)` |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`po_number`) | | | |

### 16. `purchase_order_items`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `purchase_order_id`| UUID | NO | - | FK -> `purchase_orders(id)` ON DELETE CASCADE |
| `variant_id` | UUID | NO | - | FK -> `product_variants(id)` ON DELETE RESTRICT |
| `quantity_ordered` | INT | NO | - | Expected count (`> 0`) |
| `quantity_received`| INT | NO | `0` | Verified received count |
| `unit_cost` | NUMERIC(10,2) | NO | - | Unit procurement cost |
| `total_cost` | NUMERIC(10,2) | NO | - | Total cost |
| *Constraints* | UNIQUE(`purchase_order_id`, `variant_id`) | | | |

---

## 6. Domain 5: Central Multi-Store Inventory & Movements (Tables 17–18)

### 17. `inventory_items`
The authoritative single source of truth for variant stock per physical store or warehouse location.

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `store_id` | UUID | NO | - | FK -> `stores(id)` ON DELETE RESTRICT |
| `variant_id` | UUID | NO | - | FK -> `product_variants(id)` ON DELETE RESTRICT |
| `quantity_available`| INT | NO | `0` | Ready for sale online / POS (`>= 0`) |
| `quantity_reserved` | INT | NO | `0` | Reserved for pending online COD orders (`>= 0`) |
| `quantity_damaged` | INT | NO | `0` | Defective / Quarantined (`>= 0`) |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Last stock update |
| *Constraints* | UNIQUE(`store_id`, `variant_id`), CHECK(`quantity_available` >= 0), CHECK(`quantity_reserved` >= 0), CHECK(`quantity_damaged` >= 0) | | | |

### 18. `stock_movements`
The immutable audit ledger for every stock change in the business.

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `variant_id` | UUID | NO | - | FK -> `product_variants(id)` ON DELETE RESTRICT |
| `source_store_id` | UUID | YES | NULL | FK -> `stores(id)` (if transferring out) |
| `destination_store_id`| UUID | YES | NULL | FK -> `stores(id)` (if receiving in) |
| `movement_type` | `stock_movement_type`| NO | - | Reason/Type of stock movement |
| `quantity` | INT | NO | - | Delta count (`!= 0`) |
| `reference_type` | VARCHAR(50) | NO | - | `'ORDER'`, `'RETURN'`, `'POS_SALE'`, `'PO'`, `'ADJUSTMENT'` |
| `reference_id` | UUID | YES | NULL | Document ID triggering movement |
| `reason` | TEXT | YES | NULL | Operational reason / Note |
| `performed_by` | UUID | YES | NULL | FK -> `profiles(id)` ON DELETE SET NULL |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |

---

## 7. Domain 6: Delivery & Shipping Rules (Table 19)

### 19. `delivery_zones`
Configures delivery fees, pincode patterns, and free delivery thresholds.

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `name` | VARCHAR(100) | NO | - | E.g. 'Local Talapudi / Rajahmundry Express', 'Andhra Standard' |
| `pincode_pattern`| VARCHAR(100) | NO | - | Pattern / Wildcard (e.g. `534*`, `533*`, `*`) |
| `base_delivery_charge`| NUMERIC(10,2)| NO | `50.00` | Default delivery fee for zone |
| `free_delivery_threshold`| NUMERIC(10,2)| YES| `999.00` | Subtotal amount for free delivery |
| `estimated_days_min`| INT | NO | `1` | Minimum delivery days |
| `estimated_days_max`| INT | NO | `3` | Maximum delivery days |
| `is_active` | BOOLEAN | NO | `TRUE` | Active zone indicator |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |

---

## 8. Domain 7: Customers, Addresses & Wishlists (Tables 20–22)

### 20. `addresses`
Customer delivery addresses.

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `user_id` | UUID | NO | - | FK -> `profiles(id)` ON DELETE CASCADE |
| `recipient_name`| VARCHAR(150) | NO | - | Full recipient name |
| `phone_number` | VARCHAR(20) | NO | - | Primary contact phone |
| `alternate_phone`| VARCHAR(20) | YES | NULL | Alternate phone for courier |
| `address_line1`| VARCHAR(255) | NO | - | Flat/House No, Building, Street |
| `address_line2`| VARCHAR(255) | YES | NULL | Area / Colony |
| `landmark` | VARCHAR(150) | YES | NULL | Nearby landmark |
| `city` | VARCHAR(100) | NO | - | City |
| `state` | VARCHAR(100) | NO | - | State |
| `postal_code` | VARCHAR(20) | NO | - | Postal PIN code |
| `address_type` | VARCHAR(20) | NO | `'HOME'` | `'HOME'`, `'WORK'`, `'OTHER'` |
| `is_default` | BOOLEAN | NO | `FALSE` | Default shipping address |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |

### 21. `wishlists`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `user_id` | UUID | NO | - | FK -> `profiles(id)` ON DELETE CASCADE |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`user_id`) | | | |

### 22. `wishlist_items`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `wishlist_id` | UUID | NO | - | FK -> `wishlists(id)` ON DELETE CASCADE |
| `product_id` | UUID | NO | - | FK -> `products(id)` ON DELETE CASCADE |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`wishlist_id`, `product_id`) | | | |

---

## 9. Domain 8: Shopping Carts (Tables 23–24)

### 23. `carts`
Supports both authenticated users and secure guest carts with cryptographic tokens and TTL.

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `user_id` | UUID | YES | NULL | FK -> `profiles(id)` ON DELETE CASCADE |
| `session_token` | VARCHAR(64) | YES | NULL | 64-char crypto random token for guest session |
| `expires_at` | TIMESTAMPTZ | NO | `NOW() + INTERVAL '14 days'` | Automatic guest cart expiration |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`user_id`), UNIQUE(`session_token`) | | | |

### 24. `cart_items`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `cart_id` | UUID | NO | - | FK -> `carts(id)` ON DELETE CASCADE |
| `variant_id` | UUID | NO | - | FK -> `product_variants(id)` ON DELETE CASCADE |
| `outfit_id` | UUID | YES | NULL | FK -> `outfits(id)` ON DELETE SET NULL (Tracks bundle membership) |
| `quantity` | INT | NO | `1` | Purchased quantity (`> 0`) |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`cart_id`, `variant_id`), CHECK(`quantity` > 0) | | | |

---

## 10. Domain 9: Promotions & Social Proof (Tables 25–27)

### 25. `coupons`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `code` | VARCHAR(50) | NO | - | E.g. `MENXFIRST` |
| `description` | TEXT | YES | NULL | Description |
| `discount_type` | `discount_type`| NO | `'PERCENTAGE'` | Discount formula |
| `discount_value`| NUMERIC(10,2) | NO | - | Discount value |
| `min_order_amount`| NUMERIC(10,2)| NO | `0.00` | Min cart subtotal |
| `max_discount_amount`| NUMERIC(10,2)| YES| NULL | Max cap for percentage promo |
| `usage_limit_per_user`| INT | NO | `1` | Per-user limit |
| `total_usage_limit`| INT | YES | NULL | Global limit |
| `used_count` | INT | NO | `0` | Current usage count |
| `start_date` | TIMESTAMPTZ | NO | `NOW()` | Valid start |
| `end_date` | TIMESTAMPTZ | YES | NULL | Valid expiry |
| `is_active` | BOOLEAN | NO | `TRUE` | Active flag |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`code`) | | | |

### 26. `coupon_redemptions`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `coupon_id` | UUID | NO | - | FK -> `coupons(id)` ON DELETE RESTRICT |
| `user_id` | UUID | NO | - | FK -> `profiles(id)` ON DELETE RESTRICT |
| `order_id` | UUID | NO | - | FK -> `orders(id)` ON DELETE CASCADE |
| `discount_applied`| NUMERIC(10,2)| NO | - | Actual currency discount applied |
| `redeemed_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`coupon_id`, `order_id`) | | | |

### 27. `reviews`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `product_id` | UUID | NO | - | FK -> `products(id)` ON DELETE CASCADE |
| `customer_id` | UUID | NO | - | FK -> `profiles(id)` ON DELETE CASCADE |
| `order_item_id` | UUID | YES | NULL | FK -> `order_items(id)` ON DELETE SET NULL |
| `rating` | INT | NO | - | Rating stars (`1` to `5`) |
| `title` | VARCHAR(150) | YES | NULL | Headline |
| `comment` | TEXT | YES | NULL | Review text |
| `is_verified_purchase`| BOOLEAN | NO | `FALSE` | Verified buyer flag |
| `is_approved` | BOOLEAN | NO | `TRUE` | Moderation flag |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | CHECK(`rating` BETWEEN 1 AND 5), UNIQUE(`product_id`, `customer_id`, `order_item_id`) | | | |

---

## 11. Domain 10: Orders & History (Tables 28–30)

### 28. `orders`
Master order record for Online COD and POS In-Shop checkouts.

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `order_number` | VARCHAR(32) | NO | - | Formatted reference (e.g. `MX-2026-0001`) |
| `customer_id` | UUID | YES | NULL | FK -> `profiles(id)` ON DELETE SET NULL |
| `order_channel` | `order_channel` | NO | `'ONLINE'` | `'ONLINE'` or `'POS_STORE'` |
| `store_id` | UUID | NO | - | FK -> `stores(id)` (Fulfilling facility) |
| `delivery_zone_id`| UUID | YES | NULL | FK -> `delivery_zones(id)` ON DELETE SET NULL |
| `order_status` | `order_status` | NO | `'PENDING'` | Lifecycle state |
| `payment_method` | `payment_method`| NO | `'COD'` | Enforced strictly as `'COD'` |
| `payment_status` | `payment_status`| NO | `'PENDING'` | Collection state |
| `subtotal_amount`| NUMERIC(10,2) | NO | - | Sum of line totals |
| `discount_amount`| NUMERIC(10,2) | NO | `0.00` | Coupon/bundle deductions |
| `delivery_fee` | NUMERIC(10,2) | NO | `0.00` | Frozen shipping fee applied |
| `total_payable` | NUMERIC(10,2) | NO | - | Net payable (`subtotal - discount + delivery`) |
| `cod_amount_due`| NUMERIC(10,2) | NO | - | Physical cash amount due |
| `cod_amount_collected`| NUMERIC(10,2)| NO | `0.00` | Cash collected and verified |
| `cod_collected_at`| TIMESTAMPTZ | YES | NULL | Collection timestamp |
| `cod_collected_by`| UUID | YES | NULL | FK -> `profiles(id)` (Cashier or Courier) |
| `shipping_address_id`| UUID | YES | NULL | FK -> `addresses(id)` ON DELETE SET NULL |
| `shipping_snapshot`| JSONB | NO | - | Frozen snapshot of address and contact |
| `customer_phone`| VARCHAR(20) | NO | - | Phone for delivery verification |
| `customer_notes`| TEXT | YES | NULL | Customer delivery notes |
| `admin_notes` | TEXT | YES | NULL | Internal notes |
| `tracking_number`| VARCHAR(100) | YES | NULL | Courier tracking code |
| `courier_partner`| VARCHAR(100) | YES | NULL | Logistics partner name |
| `cancelled_reason`| TEXT | YES | NULL | Cancellation reason |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`order_number`), CHECK(`payment_method` = 'COD') | | | |

### 29. `order_items`
Frozen snapshot of purchased items.

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `order_id` | UUID | NO | - | FK -> `orders(id)` ON DELETE CASCADE |
| `variant_id` | UUID | NO | - | FK -> `product_variants(id)` ON DELETE RESTRICT |
| `outfit_id` | UUID | YES | NULL | FK -> `outfits(id)` ON DELETE SET NULL |
| `product_title_snapshot`| VARCHAR(255)| NO | - | Frozen title |
| `variant_sku_snapshot` | VARCHAR(100)| NO | - | Frozen SKU |
| `size_snapshot` | VARCHAR(50) | NO | - | Frozen size |
| `color_snapshot` | VARCHAR(50) | NO | - | Frozen color |
| `unit_mrp_snapshot` | NUMERIC(10,2)| NO | - | Frozen MRP |
| `unit_price_snapshot`| NUMERIC(10,2)| NO | - | Frozen Selling Price |
| `quantity` | INT | NO | - | Purchased count (`> 0`) |
| `line_subtotal` | NUMERIC(10,2)| NO | - | `quantity * unit_price_snapshot` |
| `line_discount` | NUMERIC(10,2)| NO | `0.00` | Prorated discount |
| `line_total` | NUMERIC(10,2)| NO | - | Final item net total |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | CHECK(`quantity` > 0) | | | |

### 30. `order_status_history`
Chronological transition timeline.

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `order_id` | UUID | NO | - | FK -> `orders(id)` ON DELETE CASCADE |
| `from_status` | `order_status` | YES | NULL | Previous state |
| `to_status` | `order_status` | NO | - | New state |
| `changed_by` | UUID | YES | NULL | FK -> `profiles(id)` |
| `note` | TEXT | YES | NULL | Status note |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |

---

## 12. Domain 11: Returns & Exchanges (Tables 31–33)

### 31. `return_requests`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `return_number` | VARCHAR(32) | NO | - | Return reference (e.g. `RET-2026-0001`) |
| `order_id` | UUID | NO | - | FK -> `orders(id)` ON DELETE RESTRICT |
| `customer_id` | UUID | NO | - | FK -> `profiles(id)` ON DELETE RESTRICT |
| `status` | `return_status` | NO | `'REQUESTED'` | Return status |
| `request_type` | `return_type` | NO | `'RETURN'` | `'RETURN'` or `'EXCHANGE'` |
| `reason` | `return_reason` | NO | - | Customer reason |
| `customer_comment`| TEXT | YES | NULL | Customer notes |
| `admin_notes` | TEXT | YES | NULL | Inspection notes |
| `proof_image_urls`| TEXT[] | NO | `'{}'` | Photo proofs |
| `requested_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `processed_by` | UUID | YES | NULL | FK -> `profiles(id)` |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| `updated_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | UNIQUE(`return_number`) | | | |

### 32. `return_items`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `return_request_id`| UUID | NO | - | FK -> `return_requests(id)` ON DELETE CASCADE |
| `order_item_id` | UUID | NO | - | FK -> `order_items(id)` ON DELETE RESTRICT |
| `variant_id` | UUID | NO | - | FK -> `product_variants(id)` ON DELETE RESTRICT |
| `quantity` | INT | NO | `1` | Returned count (`> 0`) |
| `replacement_variant_id`| UUID | YES | NULL | FK -> `product_variants(id)` (For exchange) |
| `condition_on_receipt` | VARCHAR(50)| YES | NULL | `'UNOPENED'`, `'GOOD_RESELLABLE'`, `'DAMAGED_DEFECTIVE'` |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
| *Constraints* | CHECK(`quantity` > 0) | | | |

### 33. `return_status_history`
| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `return_request_id`| UUID | NO | - | FK -> `return_requests(id)` ON DELETE CASCADE |
| `from_status` | `return_status`| YES | NULL | Previous status |
| `to_status` | `return_status`| NO | - | New status |
| `changed_by` | UUID | YES | NULL | FK -> `profiles(id)` |
| `comment` | TEXT | YES | NULL | Note |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |

---

## 13. Domain 12: POS Sessions & Security Audit Logs (Tables 34–35)

### 34. `pos_sessions`
Cashier register shift sessions.

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `store_id` | UUID | NO | - | FK -> `stores(id)` ON DELETE RESTRICT |
| `cashier_id` | UUID | NO | - | FK -> `profiles(id)` ON DELETE RESTRICT |
| `opened_at` | TIMESTAMPTZ | NO | `NOW()` | Session open |
| `closed_at` | TIMESTAMPTZ | YES | NULL | Session close |
| `opening_cash` | NUMERIC(10,2) | NO | `0.00` | Starting cash |
| `closing_cash` | NUMERIC(10,2) | YES | NULL | Ending cash |
| `status` | VARCHAR(20) | NO | `'OPEN'` | `'OPEN'` or `'CLOSED'` |
| `notes` | TEXT | YES | NULL | Reconciliation notes |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |

### 35. `audit_logs`
Immutable audit ledger for security, sensitive inventory overrides, pricing modifications, and role assignments.

| Column | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `id` | UUID | NO | `gen_random_uuid()` | Primary Key |
| `actor_id` | UUID | YES | NULL | FK -> `profiles(id)` ON DELETE SET NULL |
| `actor_role` | VARCHAR(50) | YES | NULL | Role snapshot |
| `action` | VARCHAR(100) | NO | - | Action identifier |
| `target_entity` | VARCHAR(100) | NO | - | Target table name |
| `target_id` | UUID | YES | NULL | Target record ID |
| `old_values` | JSONB | YES | NULL | Previous state snapshot |
| `new_values` | JSONB | YES | NULL | Updated state snapshot |
| `ip_address` | VARCHAR(45) | YES | NULL | Client IP |
| `user_agent` | TEXT | YES | NULL | Browser/Device info |
| `created_at` | TIMESTAMPTZ | NO | `NOW()` | Timestamp |
