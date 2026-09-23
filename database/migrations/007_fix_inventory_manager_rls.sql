-- Migration 007: Idempotent fix for is_manager_or_superadmin() RLS function and product policies

CREATE OR REPLACE FUNCTION public.is_manager_or_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
      AND role IN ('INVENTORY_MANAGER', 'STORE_MANAGER', 'SUPER_ADMIN')
      AND is_active = TRUE
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_manager_or_superadmin() TO authenticated, anon, service_role;

-- Ensure products table has RLS enabled and proper policies in place
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Recreate or ensure products_modify policy covers INSERT/UPDATE/DELETE with is_manager_or_superadmin()
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' AND policyname = 'products_modify'
  ) THEN
    DROP POLICY "products_modify" ON public.products;
  END IF;

  CREATE POLICY "products_modify" ON public.products FOR ALL TO authenticated 
    USING (is_manager_or_superadmin()) 
    WITH CHECK (is_manager_or_superadmin());

  -- Ensure products_select allows PUBLISHED publicly and all for admin/staff
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' AND policyname = 'products_select'
  ) THEN
    DROP POLICY "products_select" ON public.products;
  END IF;

  CREATE POLICY "products_select" ON public.products FOR SELECT 
    USING (status = 'PUBLISHED' OR is_admin_or_staff());
END $$;
