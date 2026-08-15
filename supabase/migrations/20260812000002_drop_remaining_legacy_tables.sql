-- ==============================================================================
-- MENX MIGRATION: REMOVE REMAINING 6 LEGACY PROTOTYPE TABLES
-- Target Schema: public
-- Project Reference: mcvzvgciqmcxqnxuvomw
-- ==============================================================================

DROP TABLE IF EXISTS public.coupon_usage CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.product_reviews CASCADE;
DROP TABLE IF EXISTS public.inventory_movements CASCADE;
DROP TABLE IF EXISTS public.inventory CASCADE;
DROP TABLE IF EXISTS public.inventory_locations CASCADE;
