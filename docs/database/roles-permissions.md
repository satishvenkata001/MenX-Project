# MENX Roles, Permissions & Access Control Matrix

This document defines the Role-Based Access Control (RBAC) hierarchy and granular permissions matrix across the 35 tables in the database schema.

---

## 1. Role Hierarchy

```
                    ┌─────────────────────────┐
                    │       SUPER_ADMIN       │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      STORE_MANAGER      │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌────────▼──────────┐   ┌────────▼──────────┐   ┌────────▼──────────┐
│ INVENTORY_MANAGER │   │   ORDER_MANAGER   │   │    STORE_STAFF    │
└───────────────────┘   └───────────────────┘   └───────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │        CUSTOMER         │
                    └─────────────────────────┘
```

---

## 2. Granular Permissions Matrix

| Permission / Action | `CUSTOMER` | `STORE_STAFF` | `INVENTORY_MGR` | `ORDER_MGR` | `STORE_MGR` | `SUPER_ADMIN` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Browse Published Catalog** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Manage Own Cart / Wishlist** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Place Online COD Orders** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **View Own Order History** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Submit Product Review** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **In-Store POS Barcode Billing** | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| **View Store Inventory (`inventory_items`)**| ❌ | ✅ (Read) | ✅ (Full) | ✅ (Read) | ✅ (Full) | ✅ (Full) |
| **Manual Stock Adjustments** | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| **Supplier PO Creation** | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| **Update Order Status / Dispatch** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Process Returns & Exchanges** | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Create / Edit Products & Outfits** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Manage Delivery Zones & Pricing** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Create Promo Coupons** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **View Store Sales Analytics** | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Manage Staff Roles & Stores** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **View System Audit Logs** | ❌ | ❌ | ❌ | ❌ | ✅ (Store) | ✅ (All) |

---

## 3. Anti-Privilege Escalation Controls

1. **Immutable Self-Role Assignment**:
   - `profiles_update_policy` enforces that a user cannot modify their own `role` field.
   - Any attempt by a client session to send `role = 'SUPER_ADMIN'` in an update payload is rejected by RLS.
2. **Server-Side Verification**:
   - Backend APIs verify user roles using verified JWT claims decoded from Supabase Auth tokens.
3. **Audit Trigger on Role Changes**:
   - Every role modification automatically triggers a record in `audit_logs` capturing previous role, new role, actor ID, and client IP.
