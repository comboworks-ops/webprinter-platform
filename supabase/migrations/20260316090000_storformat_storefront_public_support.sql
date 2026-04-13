-- Allow storefront reads for published master-tenant storformat support rows.
-- This restores public rendering for storformat product pages without opening
-- arbitrary tenant data. Rollback: drop the policies created below.

DROP POLICY IF EXISTS "storformat_configs_public_read" ON public.storformat_configs;
CREATE POLICY "storformat_configs_public_read" ON public.storformat_configs
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = storformat_configs.product_id
        AND p.tenant_id = '00000000-0000-0000-0000-000000000000'
        AND p.is_published = true
    )
  );

DROP POLICY IF EXISTS "storformat_material_price_tiers_public_read" ON public.storformat_material_price_tiers;
CREATE POLICY "storformat_material_price_tiers_public_read" ON public.storformat_material_price_tiers
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = storformat_material_price_tiers.product_id
        AND p.tenant_id = '00000000-0000-0000-0000-000000000000'
        AND p.is_published = true
    )
  );

DROP POLICY IF EXISTS "storformat_finish_price_tiers_public_read" ON public.storformat_finish_price_tiers;
CREATE POLICY "storformat_finish_price_tiers_public_read" ON public.storformat_finish_price_tiers
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = storformat_finish_price_tiers.product_id
        AND p.tenant_id = '00000000-0000-0000-0000-000000000000'
        AND p.is_published = true
    )
  );

DROP POLICY IF EXISTS "storformat_product_price_tiers_public_read" ON public.storformat_product_price_tiers;
CREATE POLICY "storformat_product_price_tiers_public_read" ON public.storformat_product_price_tiers
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = storformat_product_price_tiers.product_id
        AND p.tenant_id = '00000000-0000-0000-0000-000000000000'
        AND p.is_published = true
    )
  );

DROP POLICY IF EXISTS "storformat_product_fixed_prices_public_read" ON public.storformat_product_fixed_prices;
CREATE POLICY "storformat_product_fixed_prices_public_read" ON public.storformat_product_fixed_prices
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = storformat_product_fixed_prices.product_id
        AND p.tenant_id = '00000000-0000-0000-0000-000000000000'
        AND p.is_published = true
    )
  );
