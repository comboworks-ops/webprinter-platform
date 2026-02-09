-- Storformat M² Pricing Refactor
--
-- This migration creates a simplified pricing system where:
-- 1. Materials are just names/metadata (no embedded prices)
-- 2. M² rates are stored separately in storformat_m2_prices
-- 3. Smart Price Generator manages the rates
--
-- The old tier-based structure remains for backwards compatibility.
-- Products can choose which pricing mode to use.

-- Add pricing_mode column to storformat_configs
ALTER TABLE public.storformat_configs
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'legacy'
  CHECK (pricing_mode IN ('legacy', 'm2_rates'));

-- New: Simplified M² rate pricing table
-- Stores tiered price-per-m² rates for each material
CREATE TABLE IF NOT EXISTS public.storformat_m2_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    material_id uuid NOT NULL REFERENCES public.storformat_materials(id) ON DELETE CASCADE,
    from_m2 numeric NOT NULL DEFAULT 0,
    to_m2 numeric,  -- NULL means "and above"
    price_per_m2 numeric NOT NULL DEFAULT 0,
    is_anchor boolean NOT NULL DEFAULT true,  -- For interpolation
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (product_id, material_id, from_m2)
);

-- New: Simplified finish pricing (optional flat fee or per-m²)
CREATE TABLE IF NOT EXISTS public.storformat_finish_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    finish_id uuid NOT NULL REFERENCES public.storformat_finishes(id) ON DELETE CASCADE,
    pricing_mode text NOT NULL CHECK (pricing_mode IN ('fixed', 'per_m2')),
    fixed_price numeric NOT NULL DEFAULT 0,
    price_per_m2 numeric NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (product_id, finish_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_storformat_m2_prices_product ON public.storformat_m2_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_storformat_m2_prices_material ON public.storformat_m2_prices(material_id);
CREATE INDEX IF NOT EXISTS idx_storformat_finish_prices_product ON public.storformat_finish_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_storformat_finish_prices_finish ON public.storformat_finish_prices(finish_id);

-- Enable RLS
ALTER TABLE public.storformat_m2_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storformat_finish_prices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant Access" ON public.storformat_m2_prices
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "Public read" ON public.storformat_m2_prices
FOR SELECT USING (true);

CREATE POLICY "Tenant Access" ON public.storformat_finish_prices
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "Public read" ON public.storformat_finish_prices
FOR SELECT USING (true);

-- Add bleed_mm and safe_area_mm to materials if not present
ALTER TABLE public.storformat_materials
  ADD COLUMN IF NOT EXISTS bleed_mm integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS safe_area_mm integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS group_label text;

-- Updated at triggers
CREATE OR REPLACE FUNCTION update_storformat_m2_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storformat_m2_prices_updated_at
    BEFORE UPDATE ON public.storformat_m2_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_storformat_m2_updated_at();

CREATE TRIGGER storformat_finish_prices_updated_at
    BEFORE UPDATE ON public.storformat_finish_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_storformat_m2_updated_at();
