# MENX Security Standards & Policy Document

## 1. Security Overview

Security is a foundational pillar of the MENX application architecture. As a production-grade system handling customer records, physical retail data, order fulfillment, and administrative controls, MENX adheres to industry standards, OWASP guidelines, and principle-of-least-privilege access control.

---

## 2. Key Security Principles

### 2.1 Credential & Secret Management
- **Zero Client-Side Privileged Credentials**:
  - The Supabase `SUPABASE_SECRET_KEY` has administrative bypass privileges over Row Level Security and **MUST NEVER** be bundled into the client-side code, `.env.production` in frontend, or committed to Git.
  - The frontend only receives the public `VITE_SUPABASE_PUBLISHABLE_KEY` and public Supabase URL.
  - Backend environment variables are injected securely during deployment (Render/Vercel secrets managers) and tracked locally via uncommitted `.env` files.

### 2.2 Database Row Level Security (RLS)
Every table in Supabase PostgreSQL will have RLS enabled by default:
- **Customer Tables (`addresses`, `orders`, `wishlist`, `reviews`)**:
  - `SELECT`: Allowed only where `auth.uid() = user_id`.
  - `INSERT`: Allowed only where `auth.uid() = user_id`.
  - `UPDATE`/`DELETE`: Restricted to record owner or admin role.
- **Catalog Tables (`products`, `categories`, `product_variants`, `outfit_bundles`)**:
  - `SELECT`: Publicly accessible (`anon` and `authenticated`) for published/active items.
  - `INSERT`/`UPDATE`/`DELETE`: Restricted to authenticated users with `admin` or `store_manager` role.
- **Sensitive Tables (`inventory_logs`, `audit_logs`, `suppliers`, `purchase_orders`)**:
  - Accessible strictly via backend privileged calls or authorized admin sessions.

---

## 3. Authentication & Role-Based Access Control (RBAC)

### 3.1 User Roles Hierarchy
| Role | Permissions & Scope |
| :--- | :--- |
| **`customer`** | Browse catalog, manage own profile & addresses, manage wishlist, place COD orders, request returns/exchanges, submit reviews. |
| **`store_staff`** | Scan barcodes, lookup inventory, look up customer in-store orders, record in-store POS COD transactions. |
| **`store_manager`** | Full inventory adjustments, manage orders, process returns/refunds, manage supplier orders, view store sales analytics. |
| **`superadmin`** | Full system privileges, role assignment, system settings, category & product deletion, view audit logs. |

### 3.2 Token Lifecycle & Route Protection
- Client requests carry a Supabase JWT in the `Authorization: Bearer <token>` header.
- Backend `auth.middleware.js` verifies the JWT signature against Supabase Auth.
- User role claims are extracted and validated in `role.middleware.js` before executing controller actions.

---

## 4. Server-Side Input Validation & Sanitization

All incoming requests to the Express backend pass through strict schema validation layers:
1. **Schema Validation**: Using Zod/Joi schemas on request parameters (`req.params`), queries (`req.query`), and bodies (`req.body`).
2. **Payload Sanitization**: Strip dangerous HTML, script tags, and SQL injection patterns.
3. **Strict Type Coercion**: Ensure numbers, booleans, and UUIDs conform to exact expected types before reaching the database.
4. **Mass Assignment Protection**: Only explicitly whitelisted fields are forwarded to database insertion or update operations.

---

## 5. API Rate Limiting & Denial of Service Protection

- **General API Limiter**: Max 100 requests per 15-minute window per IP for standard public endpoints.
- **Auth Endpoints Limiter**: Max 5 requests per 15-minute window for login/register attempts to block brute-force attacks.
- **Order Creation Limiter**: Max 3 order creation requests per minute per IP/User to prevent automated fake order spam.
- **Search & Filter Limiter**: Max 30 queries per minute per IP to avoid excessive catalog scraping.

---

## 6. Secure Media & File Upload Policies

Product and return image uploads to Supabase Storage enforce:
1. **MIME Type Allowlist**: Strictly `image/jpeg`, `image/png`, `image/webp`. Executable files, SVG (due to XSS risks), and PDFs for images are blocked.
2. **File Size Caps**:
   - Product catalog images: Max 5MB.
   - Customer return evidence: Max 3MB.
   - Store logos/banners: Max 10MB.
3. **Magic Byte / Header Verification**: Backend validates actual file signature before uploading to storage buckets.
4. **Bucket Privacy**: Public read for catalog images; private/signed URLs for return evidence and sensitive attachments.

---

## 7. Audit Logging for Sensitive Operations

All critical administrative and state-changing actions are logged in an immutable `audit_logs` table:
- **Logged Events**:
  - Inventory quantity modifications (manual overrides, stock adjustments).
  - Product price changes and discount activations.
  - Order status overrides (e.g., changing from `PLACED` to `CANCELLED` or `DELIVERED`).
  - Return approval or rejection.
  - Role upgrades or staff permission changes.
- **Audit Record Schema**:
  - `id`: UUID
  - `user_id`: Admin/Staff ID who initiated the change
  - `action`: E.g., `INVENTORY_ADJUSTED`, `ORDER_STATUS_CHANGED`
  - `target_entity`: Table/Resource name
  - `target_id`: Identifier of affected record
  - `old_value`: JSON snapshot of prior state
  - `new_value`: JSON snapshot of updated state
  - `ip_address` & `user_agent`: Request metadata
  - `created_at`: Timestamp

---

## 8. Data Minimization & Privacy

- **No Online Payment Credentials**: Since MENX utilizes Cash on Delivery (COD) exclusively, no credit card, CVV, or bank account numbers are ever collected or stored.
- **Customer Address & Contact Info**: Restricted strictly to active order fulfillment; customer data is never shared with third-party tracking or advertising SDKs.
- **Password Security**: Managed exclusively by Supabase Auth (bcrypt/argon2 hashing, robust password complexity rules).

---

## 9. Secure HTTP Headers & Transport

- **HTTPS Everywhere**: Strict Transport Security (`HSTS`) enforced.
- **Helmet.js Integration**:
  - `Content-Security-Policy` (CSP)
  - `X-Frame-Options: DENY` (Clickjacking prevention)
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- **CORS Policy**: Configured to accept requests exclusively from verified frontend domains (e.g., `https://menx.vercel.app` or `http://localhost:5173` in development).
