# MENX Multi-Store Central Inventory Model

This document outlines the authoritative inventory architecture, explicit variant-level stock per store location, concurrency locking, and stock movement tracking.

---

## 1. Conceptual Model

```
Store / Location (stores)
       │
       ▼
Product Variant (product_variants)
       │
       ▼
Inventory Stock (inventory_items)
```

### Real Example:
- **`Store 1: Talapudi Shop (Physical Store)`**
  - MenX Oxford Shirt - Black / M $\rightarrow$ Available: 8, Reserved: 0, Damaged: 0
  - MenX Oxford Shirt - Black / L $\rightarrow$ Available: 5, Reserved: 0, Damaged: 0
  - MenX Slim Jeans - Blue / 32 $\rightarrow$ Available: 10, Reserved: 0, Damaged: 0

- **`Store 2: Central Warehouse / Online Fulfillment`**
  - MenX Oxford Shirt - Black / M $\rightarrow$ Available: 12, Reserved: 3, Damaged: 1
  - MenX Oxford Shirt - Black / L $\rightarrow$ Available: 7, Reserved: 2, Damaged: 0
  - MenX Slim Jeans - Blue / 32 $\rightarrow$ Available: 25, Reserved: 4, Damaged: 0

---

## 2. Authoritative Stock Table (`inventory_items`)

The `inventory_items` table is the **single authoritative source** for variant stock balances at each store location:

$$\text{Physical On-Hand Stock} = \text{quantity\_available} + \text{quantity\_reserved} + \text{quantity\_damaged}$$

$$\text{Sellable Online / POS Stock} = \text{quantity\_available}$$

| Column | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `id` | UUID | PK | Unique identifier |
| `store_id` | UUID | FK -> `stores(id)` | Store / Warehouse location |
| `variant_id` | UUID | FK -> `product_variants(id)`| Specific Size + Color item |
| `quantity_available` | INT | `CHECK (>= 0)` | Ready for immediate sale |
| `quantity_reserved` | INT | `CHECK (>= 0)` | Allocated to pending COD orders |
| `quantity_damaged` | INT | `CHECK (>= 0)` | Quarantined / Defective stock |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last modification timestamp |

*Unique Constraint*: `UNIQUE(store_id, variant_id)` guarantees exactly one balance row per variant per store.

---

## 3. Stock Movement Types & Transition Matrix

Every single quantity change in `inventory_items` writes an immutable audit record to `stock_movements`:

| Movement Type | Event Description | `quantity_available` | `quantity_reserved` | `quantity_damaged` |
| :--- | :--- | :---: | :---: | :---: |
| `PURCHASE_RECEIPT` | Inward shipment verified from supplier PO | **+N** | 0 | 0 |
| `ONLINE_ORDER_RESERVED` | Online customer places COD order | **-N** | **+N** | 0 |
| `ONLINE_ORDER_FULFILLED`| Order delivered & cash collected | 0 | **-N** | 0 |
| `ONLINE_ORDER_CANCELLED`| Order cancelled before delivery / RTO | **+N** | **-N** | 0 |
| `POS_SALE` | In-shop walk-in customer purchase at POS | **-N** | 0 | 0 |
| `POS_RETURN` | In-store customer return (resellable) | **+N** | 0 | 0 |
| `ONLINE_RETURN` | Online return inspected & accepted (resellable)| **+N** | 0 | 0 |
| `DAMAGED_WRITEOFF` | Defective return or in-store damage write-off | **-N** (or 0) | 0 (or **-N**) | **+N** |
| `STOCK_TRANSFER` | Transfer from Warehouse A to Retail Store B | Source: **-N** | 0 | Dest: **+N** |
| `INVENTORY_ADJUSTMENT` | Physical stock audit correction | **±N** | 0 | 0 |

---

## 4. Atomic Concurrency Locking Procedure

To eliminate race conditions between simultaneous online mobile checkouts and in-store walk-in POS purchases:

```sql
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
  -- 1. Pessimistic row-level lock
  SELECT quantity_available INTO v_available
  FROM inventory_items
  WHERE store_id = p_store_id AND variant_id = p_variant_id
  FOR UPDATE;

  -- 2. Validate availability
  IF v_available IS NULL OR v_available < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock for variant % at store %. Available: %, Requested: %',
      p_variant_id, p_store_id, COALESCE(v_available, 0), p_quantity;
  END IF;

  -- 3. Atomically transfer from available to reserved
  UPDATE inventory_items
  SET 
    quantity_available = quantity_available - p_quantity,
    quantity_reserved = quantity_reserved + p_quantity,
    updated_at = NOW()
  WHERE store_id = p_store_id AND variant_id = p_variant_id;

  -- 4. Write immutable stock movement record
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
```
