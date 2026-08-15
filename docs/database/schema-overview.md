# MENX Database Architecture & Schema Overview

## 1. Executive Summary

The MENX database is built on **PostgreSQL** via **Supabase**. It is engineered to power an omnichannel men's fashion enterprise combining a physical retail storefront (e.g. Talapudi Shop) and an online mobile-first e-commerce shop, operating on a unified multi-location central inventory with exclusive **Cash-on-Delivery (COD)** customer settlement.

---

## 2. Core Architectural Pillars

1. **Normalized & Scalable Design (3NF)**:
   - Total of **35 Authoritative Tables** partitioned across 12 distinct domains.
   - Clear entity segregation between catalog definitions, variant specifications, multi-store stock allocations, orders, outfits, delivery zones, and auditing.
   - Complete elimination of redundant stock sources while freezing historical snapshots on orders (pricing, line items, address, delivery charge).

2. **Explicit Multi-Store Central Inventory**:
   - Stores/Warehouses (`stores`) $\rightarrow$ Product Variants (`product_variants`) $\rightarrow$ Inventory Stock (`inventory_items`).
   - Explicit separation of `quantity_available`, `quantity_reserved`, and `quantity_damaged`.
   - Immutable `stock_movements` ledger for full traceability of all stock additions, reservations, POS sales, online orders, returns, transfers, and adjustments.
   - Atomic database locking (`SELECT ... FOR UPDATE`) prevents race conditions between simultaneous physical POS sales and online mobile checkouts.

3. **Strict COD Payment Model**:
   - Customer payment method is enforced as `payment_method = 'COD'` at the database constraint level.
   - Controlled payment lifecycle: `PENDING` $\rightarrow$ `COLLECTED` $\rightarrow$ `REFUND_REQUIRED` $\rightarrow$ `REFUNDED` (or `COLLECTION_FAILED`).
   - Strict tracking of `cod_amount_due`, `cod_amount_collected`, `cod_collected_at`, and `cod_collected_by`.

4. **Curated Full Outfit Combinations**:
   - Outfits reference canonical products as styling templates (`outfit_items`).
   - Customers select individual size/color variants for each constituent item.
   - Inventory availability is computed on-the-fly from variant stock, preventing overselling without duplicating product records.

5. **Scalable Delivery Zone Model**:
   - `delivery_zones` supports base delivery charges, pincode patterns, and free delivery thresholds.
   - Every order freezes the applied `delivery_fee` and references the `delivery_zone_id`.

6. **Secure Guest & Customer Shopping Cart**:
   - Supports anonymous guest carts with 64-character cryptographically secure tokens and TTL expiration.
   - Safe automated merging into authenticated customer profiles upon login.

7. **Principle of Least Privilege & Row Level Security (RLS)**:
   - 100% of exposed application tables enforce granular RLS policies.
   - Customers have access strictly to their own data (profiles, addresses, carts, wishlists, orders, reviews).
   - Public users can view active and published catalog items only.
   - Privileged operations (inventory adjustments, order state changes, audit logs) require verified administrative roles or backend service execution.

---

## 3. Authoritative Table List (35 Tables Across 12 Domains)

```
MENX Database Domains (35 Tables)
├── 1. Authentication & Users (3)
│   ├── profiles
│   ├── stores
│   └── staff_store_assignments
├── 2. Catalog & Taxonomy (8)
│   ├── categories
│   ├── subcategories
│   ├── brands
│   ├── sizes
│   ├── colors
│   ├── products
│   ├── product_variants
│   └── product_images
├── 3. Outfits & Bundles (2)
│   ├── outfits
│   └── outfit_items
├── 4. Suppliers & Purchasing (3)
│   ├── suppliers
│   ├── purchase_orders
│   └── purchase_order_items
├── 5. Central Multi-Store Inventory & Movements (2)
│   ├── inventory_items
│   └── stock_movements
├── 6. Delivery & Shipping Rules (1)
│   └── delivery_zones
├── 7. Customer Data & Wishlist (3)
│   ├── addresses
│   ├── wishlists
│   └── wishlist_items
├── 8. Shopping Carts (2)
│   ├── carts
│   └── cart_items
├── 9. Promotions & Social Proof (3)
│   ├── coupons
│   ├── coupon_redemptions
│   └── reviews
├── 10. Orders & History (3)
│   ├── orders
│   ├── order_items
│   └── order_status_history
├── 11. Returns & Exchanges (3)
│   ├── return_requests
│   ├── return_items
│   └── return_status_history
└── 12. Physical POS & Auditing (2)
    ├── pos_sessions
    └── audit_logs
```

---

## 4. Design Standards & Conventions

| Attribute | Standard / Rule | Example |
| :--- | :--- | :--- |
| **Primary Keys** | UUID v4 (`DEFAULT gen_random_uuid()`) | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` |
| **Foreign Keys** | Explicit `ON DELETE` clause matching lifecycle rules | `ON DELETE CASCADE` / `ON DELETE RESTRICT` |
| **Timestamps** | `TIMESTAMPTZ` with UTC default | `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` |
| **Monetary Values** | `NUMERIC(10,2)` for prices and discounts | `selling_price NUMERIC(10,2) NOT NULL CHECK (selling_price >= 0)` |
| **Quantities** | `INTEGER` with non-negative constraints | `quantity INT NOT NULL CHECK (quantity > 0)` |
| **Naming Conventions** | Lowercase snake_case for tables and columns | `inventory_items`, `order_status_history` |
| **Enums** | Native PostgreSQL ENUM types for finite state sets | `user_role`, `order_status`, `payment_status`, `stock_movement_type` |
