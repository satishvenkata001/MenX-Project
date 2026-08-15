# MENX Security Audit Logging System

This document outlines the architecture for tamper-evident auditing of all critical business actions, stock overrides, order status transitions, pricing changes, and role assignments across the system.

---

## 1. Audited Critical Event Types

| Action Name | Triggering Event | Captured Context |
| :--- | :--- | :--- |
| `ROLE_ASSIGNMENT_CHANGED` | Admin promotes or demotes a user role | Old role, new role, target user ID |
| `INVENTORY_OVERRIDE` | Manual stock count alteration in `inventory_items` | Old quantity, new quantity, reason, store ID |
| `PRODUCT_PRICE_CHANGED` | Catalog MRP or selling price modification | Old price, new price, variant SKU |
| `DELIVERY_ZONE_CHANGED` | Delivery charge or free threshold updated | Old rates, new rates, zone ID |
| `ORDER_STATUS_OVERRIDE` | Order transitioned to `CANCELLED`, `RETURNED` | Old status, new status, note |
| `RETURN_APPROVAL` | Return request approved or rejected | Return ID, inspector ID, proof review |
| `COUPON_GENERATED` | High-value discount coupon created | Code, discount value, expiration |
| `STAFF_STORE_REASSIGNED` | Staff member transferred to another branch | Previous store ID, new store ID |

---

## 2. Immutability & Protection Rules

1. **Strict Append-Only**:
   - `audit_logs` table has RLS policies that disallow `UPDATE` and `DELETE` across all roles (even Superadmins).
2. **Deterministic Context Capture**:
   - Logs store JSON snapshots of `old_values` and `new_values`.
   - Captures `ip_address`, `user_agent`, and `actor_id`.
3. **Database Trigger Implementation**:

```sql
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
      (SELECT role FROM profiles WHERE id = auth.uid()),
      'ROLE_ASSIGNMENT_CHANGED',
      'profiles',
      NEW.id,
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_profile_role_change
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION audit_role_change_trigger();
```
