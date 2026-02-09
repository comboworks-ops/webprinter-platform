-- Storformat Products V2 - Enhanced pricing and sharing
--
-- This migration adds:
-- 1. Visibility for sharing materials/products/finishes across tenants
-- 2. Enhanced product pricing types (fixed, percentage, m2)
-- 3. Product M2 prices table for m2-based product pricing

-- Add visibility to storformat_products for sharing
ALTER TABLE public.storformat_products
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'tenant'
    CHECK (visibility IN ('tenant', 'public')),
  ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;

-- Add visibility to storformat_materials for sharing
ALTER TABLE public.storformat_materials
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'tenant'
    CHECK (visibility IN ('tenant', 'public'));

-- Add visibility to storformat_finishes for sharing
ALTER TABLE public.storformat_finishes
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'tenant'
    CHECK (visibility IN ('tenant', 'public'));

-- Add product pricing mode (fixed, percentage, m2)
ALTER TABLE public.storformat_products
  ADD COLUMN IF NOT EXISTS pricing_type text DEFAULT 'fixed'
    CHECK (pricing_type IN ('fixed', 'percentage', 'm2')),
  ADD COLUMN IF NOT EXISTS percentage_markup numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_price numeric DEFAULT 0;

-- Create product m2 prices table (for products with m2-based pricing)
CREATE TABLE IF NOT EXISTS public.storformat_product_m2_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    storformat_product_id uuid NOT NULL REFERENCES public.storformat_products(id) ON DELETE CASCADE,
    from_m2 numeric NOT NULL DEFAULT 0,
    to_m2 numeric,
    price_per_m2 numeric NOT NULL DEFAULT 0,
    is_anchor boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (storformat_product_id, from_m2)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_storformat_products_visibility ON public.storformat_products(visibility);
CREATE INDEX IF NOT EXISTS idx_storformat_materials_visibility ON public.storformat_materials(visibility);
CREATE INDEX IF NOT EXISTS idx_storformat_finishes_visibility ON public.storformat_finishes(visibility);
CREATE INDEX IF NOT EXISTS idx_storformat_product_m2_prices_product ON public.storformat_product_m2_prices(storformat_product_id);
CREATE INDEX IF NOT EXISTS idx_storformat_product_m2_prices_tenant ON public.storformat_product_m2_prices(tenant_id);

-- Enable RLS on new table
ALTER TABLE public.storformat_product_m2_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies for product m2 prices
CREATE POLICY "product_m2_prices_tenant_access" ON public.storformat_product_m2_prices
  FOR ALL USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "product_m2_prices_public_read" ON public.storformat_product_m2_prices
  FOR SELECT USING (true);

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "storformat_products_public_read" ON public.storformat_products;
DROP POLICY IF EXISTS "storformat_materials_public_read" ON public.storformat_materials;
DROP POLICY IF EXISTS "storformat_finishes_public_read" ON public.storformat_finishes;

-- Updated RLS policies for visibility (allow reading public items from master tenant)
CREATE POLICY "storformat_products_public_read" ON public.storformat_products
  FOR SELECT USING (
    public.can_access_tenant(tenant_id) OR
    (visibility = 'public' AND tenant_id = '00000000-0000-0000-0000-000000000000')
  );

CREATE POLICY "storformat_materials_public_read" ON public.storformat_materials
  FOR SELECT USING (
    public.can_access_tenant(tenant_id) OR
    (visibility = 'public' AND tenant_id = '00000000-0000-0000-0000-000000000000')
  );

CREATE POLICY "storformat_finishes_public_read" ON public.storformat_finishes
  FOR SELECT USING (
    public.can_access_tenant(tenant_id) OR
    (visibility = 'public' AND tenant_id = '00000000-0000-0000-0000-000000000000')
  );

-- Trigger for updated_at on product m2 prices
CREATE OR REPLACE FUNCTION update_storformat_product_m2_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storformat_product_m2_prices_updated_at
    BEFORE UPDATE ON public.storformat_product_m2_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_storformat_product_m2_updated_at();
