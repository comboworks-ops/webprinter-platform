-- Public storefront read for published master-tenant storformat items.
-- Rollback: drop the three policies below.

DROP POLICY IF EXISTS "storformat_products_public_read" ON public.storformat_products;
CREATE POLICY "storformat_products_public_read" ON public.storformat_products
  FOR SELECT USING (
    visibility = 'public'
    AND tenant_id = '00000000-0000-0000-0000-000000000000'
  );

DROP POLICY IF EXISTS "storformat_materials_public_read" ON public.storformat_materials;
CREATE POLICY "storformat_materials_public_read" ON public.storformat_materials
  FOR SELECT USING (
    visibility = 'public'
    AND tenant_id = '00000000-0000-0000-0000-000000000000'
  );

DROP POLICY IF EXISTS "storformat_finishes_public_read" ON public.storformat_finishes;
CREATE POLICY "storformat_finishes_public_read" ON public.storformat_finishes
  FOR SELECT USING (
    visibility = 'public'
    AND tenant_id = '00000000-0000-0000-0000-000000000000'
  );
