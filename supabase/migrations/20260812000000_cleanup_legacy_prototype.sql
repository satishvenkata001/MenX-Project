-- ==============================================================================
-- MENX MIGRATION: CLEANUP LEGACY PROTOTYPE OBJECTS
-- Purpose: Safely drop legacy prototype tables, functions, and types
-- Target Schema: public
-- Project Reference: mcvzvgciqmcxqnxuvomw
-- Human Approval Reference: MENX PHASE 3G APPROVED
-- ==============================================================================

-- Drop legacy tables in dependency-safe order with CASCADE
DROP TABLE IF EXISTS public.coupon_usage CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.product_reviews CASCADE;
DROP TABLE IF EXISTS public.inventory_movements CASCADE;
DROP TABLE IF EXISTS public.inventory CASCADE;
DROP TABLE IF EXISTS public.inventory_locations CASCADE;

DROP TABLE IF EXISTS public.cart_items CASCADE;
DROP TABLE IF EXISTS public.carts CASCADE;
DROP TABLE IF EXISTS public.wishlist_items CASCADE;
DROP TABLE IF EXISTS public.wishlists CASCADE;
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.coupons CASCADE;
DROP TABLE IF EXISTS public.addresses CASCADE;
DROP TABLE IF EXISTS public.product_images CASCADE;
DROP TABLE IF EXISTS public.product_variants CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop legacy types if any existed
DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.product_status CASCADE;
DROP TYPE IF EXISTS public.store_type CASCADE;
DROP TYPE IF EXISTS public.order_channel CASCADE;
DROP TYPE IF EXISTS public.order_status CASCADE;
DROP TYPE IF EXISTS public.payment_method CASCADE;
DROP TYPE IF EXISTS public.payment_status CASCADE;
DROP TYPE IF EXISTS public.return_type CASCADE;
DROP TYPE IF EXISTS public.return_reason CASCADE;
DROP TYPE IF EXISTS public.return_status CASCADE;
DROP TYPE IF EXISTS public.stock_movement_type CASCADE;
DROP TYPE IF EXISTS public.discount_type CASCADE;

-- Drop legacy triggers on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_signup() CASCADE;
