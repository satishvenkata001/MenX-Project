# MENX Full Outfit Combinations & Variant Selection Architecture

The **Full Outfit System** allows stylists and store managers to curate complete head-to-toe looks without duplicating products or hardcoding rigid sizes.

---

## 1. Architectural Strategy: Products as Styling Templates

```
                  ┌───────────────────────────────┐
                  │    Outfit: "Casual Look"      │
                  └───────────────┬───────────────┘
                                  │
      ┌───────────────────────────┼───────────────────────────┐
      │                           │                           │
┌─────▼──────────────┐  ┌─────────▼───────────┐  ┌────────────▼──────────┐
│  Product: Shirt    │  │   Product: Jeans    │  │   Product: Slippers   │
└─────┬──────────────┘  └─────────┬───────────┘  └────────────┬──────────┘
      │                           │                           │
Customer selects:           Customer selects:           Customer selects:
[ Black / Size M ]          [ Blue / Size 32 ]          [ Black / Size 9 ]
      │                           │                           │
      ▼                           ▼                           ▼
Variant Stock Check:        Variant Stock Check:        Variant Stock Check:
Talapudi Shop: 8 avail      Talapudi Shop: 10 avail     Talapudi Shop: 6 avail
```

---

## 2. Why `outfit_items` References `product_id` (Not Static `variant_id`)

| Approach | Scalability & Flexibility | Drawbacks | Verdict |
| :--- | :--- | :--- | :--- |
| **Option A: Static Variant in Outfit**<br>(e.g. Outfit fixed to Shirt M + Jean 32) | Extremely poor. A customer who wears Shirt L would need a separate outfit created by admin. | Results in thousands of duplicate outfit combinations across size permutations. | ❌ **Rejected** |
| **Option B: Product Reference with Dynamic Variant Selection**<br>(`outfit_items` references `product_id`) | **High**. The outfit defines the aesthetic look (e.g. Oxford Shirt + Slim Jeans + Leather Slippers). Customers pick their custom sizes/colors on the fly. | Requires UI modal for multi-item variant selection (Standard for modern fashion apps). | ✅ **Selected (Production Standard)** |

---

## 3. Dynamic Stock Calculation & Overselling Prevention

1. **Catalog Availability Check**:
   - An outfit is considered **"In Stock"** for a specific store/warehouse if and only if **all mandatory products** in `outfit_items` have at least one active variant with `quantity_available > 0`.

2. **Customer Variant Selection & Live Stock Verification**:
   - In the mobile app lookbook drawer, the customer selects:
     - Component 1 (Shirt) $\rightarrow$ Variant `MX-SHT-BLK-M`
     - Component 2 (Jeans) $\rightarrow$ Variant `MX-JNS-BLU-32`
     - Component 3 (Belt) $\rightarrow$ Variant `MX-BLT-BLK-FS`
     - Component 4 (Slippers) $\rightarrow$ Variant `MX-SLP-BLK-09`
   - The frontend immediately queries stock for those exact 4 variant IDs.
   - If any chosen variant is sold out, the UI prompts the customer to choose an alternate size or notifies them.

3. **Cart & Order Atomicity**:
   - When tapped "Add Full Outfit to Cart", 4 individual records are written to `cart_items`, each referencing its chosen `variant_id` with `outfit_id` set to the outfit's UUID.
   - At checkout, each variant's inventory is atomically locked and reserved via `reserve_inventory_for_order()`.
   - Outfit bundle discounts (e.g., 15% off) are prorated across the individual `order_items` line totals.
