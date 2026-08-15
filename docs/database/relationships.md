# MENX Database Relationships & Dependency Graph

This document details all entity-to-entity relationships, cardinality, foreign key constraints, `ON DELETE` rules, and dependency ordering across all **35 authoritative tables** in the schema.

---

## 1. Table Relationship Summary

| Parent Table | Child Table | Foreign Key Column | Cardinality | ON DELETE Rule | Business Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `auth.users` | `profiles` | `profiles.id` | 1 : 1 | `CASCADE` | User profile is bound to Supabase auth user identity. |
| `profiles` | `staff_store_assignments` | `user_id` | 1 : N | `CASCADE` | Staff assignments belong to user profile. |
| `stores` | `staff_store_assignments` | `store_id` | 1 : N | `CASCADE` | Removing store cleans up employee assignment mappings. |
| `categories` | `subcategories` | `category_id` | 1 : N | `RESTRICT` | Cannot delete category while subcategories still exist. |
| `categories` | `products` | `category_id` | 1 : N | `RESTRICT` | Products must always retain valid top-level categorization. |
| `subcategories`| `products` | `subcategory_id`| 1 : N | `RESTRICT` | Products must always retain valid subcategorization. |
| `brands` | `products` | `brand_id` | 1 : N | `SET NULL` | Removing brand retains product with null brand. |
| `products` | `product_variants` | `product_id` | 1 : N | `CASCADE` | Variants belong exclusively to their parent product. |
| `sizes` | `product_variants` | `size_id` | 1 : N | `RESTRICT` | Cannot delete standard size if variants are referencing it. |
| `colors` | `product_variants` | `color_id` | 1 : N | `RESTRICT` | Cannot delete color if variants are referencing it. |
| `products` | `product_images` | `product_id` | 1 : N | `CASCADE` | Images belong to the parent product. |
| `product_variants` | `product_images` | `variant_id` | 1 : N | `SET NULL` | If variant is removed, product image remains as general media. |
| `profiles` | `products` | `created_by` | 1 : N | `SET NULL` | Creator profile deletion does not destroy catalog data. |
| `profiles` | `outfits` | `created_by` | 1 : N | `SET NULL` | Stylist profile deletion does not destroy outfit records. |
| `outfits` | `outfit_items` | `outfit_id` | 1 : N | `CASCADE` | Outfit item links belong to outfit header. |
| `products` | `outfit_items` | `product_id` | 1 : N | `RESTRICT` | Cannot delete catalog product while curated in an active outfit. |
| `suppliers` | `purchase_orders` | `supplier_id` | 1 : N | `RESTRICT` | Cannot delete supplier with active/historical purchase orders. |
| `stores` | `purchase_orders` | `store_id` | 1 : N | `RESTRICT` | Receiving store must remain valid. |
| `purchase_orders` | `purchase_order_items` | `purchase_order_id`| 1 : N | `CASCADE` | Line items belong directly to purchase order header. |
| `product_variants`| `purchase_order_items` | `variant_id` | 1 : N | `RESTRICT` | Variant reference must remain valid in purchasing records. |
| `stores` | `inventory_items` | `store_id` | 1 : N | `RESTRICT` | Store location inventory cannot be orphaned. |
| `product_variants`| `inventory_items` | `variant_id` | 1 : N | `RESTRICT` | Cannot delete variant while stock records exist. |
| `product_variants`| `stock_movements` | `variant_id` | 1 : N | `RESTRICT` | Audit ledger must preserve variant history. |
| `stores` | `stock_movements` | `source_store_id` | 1 : N | `SET NULL` | Transfer origin history preserved even if location closed. |
| `stores` | `stock_movements` | `destination_store_id` | 1 : N | `SET NULL` | Transfer destination history preserved. |
| `profiles` | `addresses` | `user_id` | 1 : N | `CASCADE` | Customer addresses belong to customer profile. |
| `profiles` | `wishlists` | `user_id` | 1 : 1 | `CASCADE` | Wishlist container belongs to customer profile. |
| `wishlists` | `wishlist_items` | `wishlist_id` | 1 : N | `CASCADE` | Wishlist items belong to user wishlist. |
| `products` | `wishlist_items` | `product_id` | 1 : N | `CASCADE` | If product is removed from catalog, removed from wishlists. |
| `profiles` | `carts` | `user_id` | 1 : 1 | `CASCADE` | Shopping cart container belongs to customer (null for guest). |
| `carts` | `cart_items` | `cart_id` | 1 : N | `CASCADE` | Items belong directly to active cart. |
| `product_variants`| `cart_items` | `variant_id` | 1 : N | `CASCADE` | If variant is deleted, removed from active customer carts. |
| `outfits` | `cart_items` | `outfit_id` | 1 : N | `SET NULL` | If outfit is deleted, items revert to standard cart items. |
| `profiles` | `orders` | `customer_id` | 1 : N | `SET NULL` | If customer profile is deleted, financial orders remain for tax/accounting. |
| `stores` | `orders` | `store_id` | 1 : N | `RESTRICT` | Fulfilling store cannot be deleted with associated orders. |
| `delivery_zones`| `orders` | `delivery_zone_id` | 1 : N | `SET NULL` | Delivery zone reference; fee preserved in `orders.delivery_fee`. |
| `addresses` | `orders` | `shipping_address_id` | 1 : N | `SET NULL` | If address is modified/deleted in address book, order retains `shipping_snapshot`. |
| `orders` | `order_items` | `order_id` | 1 : N | `CASCADE` | Line items belong directly to order. |
| `product_variants`| `order_items` | `variant_id` | 1 : N | `RESTRICT` | Cannot delete variant if historical orders reference it. |
| `outfits` | `order_items` | `outfit_id` | 1 : N | `SET NULL` | Outfit reference preserved or nulled; snapshots preserve item title/price. |
| `orders` | `order_status_history`| `order_id` | 1 : N | `CASCADE` | Status history belongs to order. |
| `orders` | `return_requests` | `order_id` | 1 : N | `RESTRICT` | Order reference required for return requests. |
| `profiles` | `return_requests` | `customer_id` | 1 : N | `RESTRICT` | Customer profile required for return requests. |
| `return_requests` | `return_items` | `return_request_id` | 1 : N | `CASCADE` | Return items belong to return request. |
| `order_items` | `return_items` | `order_item_id` | 1 : N | `RESTRICT` | Original purchased item reference must remain intact. |
| `product_variants`| `return_items` | `variant_id` | 1 : N | `RESTRICT` | Variant reference required for returned inventory. |
| `product_variants`| `return_items` | `replacement_variant_id` | 1 : N | `SET NULL` | Replacement variant for exchange. |
| `return_requests` | `return_status_history`| `return_request_id` | 1 : N | `CASCADE` | Return history belongs to return request. |
| `coupons` | `coupon_redemptions`| `coupon_id` | 1 : N | `RESTRICT` | Cannot delete coupon with active redemption records. |
| `profiles` | `coupon_redemptions`| `user_id` | 1 : N | `RESTRICT` | User redemption ledger preserved. |
| `orders` | `coupon_redemptions`| `order_id` | 1 : N | `CASCADE` | Redemption ledger linked to order. |
| `products` | `reviews` | `product_id` | 1 : N | `CASCADE` | Reviews belong to product. |
| `profiles` | `reviews` | `customer_id` | 1 : N | `CASCADE` | Reviews belong to customer. |
| `order_items` | `reviews` | `order_item_id` | 1 : N | `SET NULL` | Verified purchase linkage. |
| `stores` | `pos_sessions` | `store_id` | 1 : N | `RESTRICT` | POS sessions belong to store. |
| `profiles` | `pos_sessions` | `cashier_id` | 1 : N | `RESTRICT` | Cashier profile must remain valid. |
| `profiles` | `audit_logs` | `actor_id` | 1 : N | `SET NULL` | If admin user is deleted, audit log preserves `actor_role` & historical changes. |

---

## 2. Dependency Hierarchy & Creation Order

```
Level 0 (Base / Independent):
├── auth.users (Supabase native)
├── stores
├── delivery_zones
├── categories
├── brands
├── sizes
├── colors
├── suppliers
├── coupons

Level 1:
├── profiles (depends on auth.users)
├── subcategories (depends on categories)
├── pos_sessions (depends on stores, profiles)
├── purchase_orders (depends on suppliers, stores, profiles)

Level 2:
├── staff_store_assignments (depends on profiles, stores)
├── addresses (depends on profiles)
├── wishlists (depends on profiles)
├── carts (depends on profiles)
├── products (depends on categories, subcategories, brands, profiles)
├── outfits (depends on profiles)

Level 3:
├── product_variants (depends on products, sizes, colors)
├── wishlist_items (depends on wishlists, products)
├── outfit_items (depends on outfits, products)
├── purchase_order_items (depends on purchase_orders, product_variants)

Level 4:
├── product_images (depends on products, product_variants)
├── inventory_items (depends on stores, product_variants)
├── stock_movements (depends on product_variants, stores, profiles)
├── cart_items (depends on carts, product_variants, outfits)
├── orders (depends on profiles, stores, delivery_zones, addresses)

Level 5:
├── order_items (depends on orders, product_variants, outfits)
├── order_status_history (depends on orders, profiles)
├── coupon_redemptions (depends on coupons, profiles, orders)

Level 6:
├── reviews (depends on products, profiles, order_items)
├── return_requests (depends on orders, profiles)

Level 7:
├── return_items (depends on return_requests, order_items, product_variants)
├── return_status_history (depends on return_requests, profiles)
└── audit_logs (depends on profiles)
```

---

## 3. Circular Dependency Verification

> [!NOTE]
> **Strictly Acyclic**: Every table only depends on tables created at lower numerical levels. There are zero circular foreign key references across all 35 tables.
