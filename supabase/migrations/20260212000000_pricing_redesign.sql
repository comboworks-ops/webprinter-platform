-- Storformat Pricing Redesign
--
-- Changes:
-- 1. Add 'per_item' to product pricing_type (replaces 'percentage')
-- 2. Add is_published to configs for draft/publish workflow
-- 3. Create storformat_product_fixed_prices for per_item pricing

-- Add per_item to pricing_type constraint
ALTER TABLE public.storformat_products
  DROP CONSTRAINT IF EXISTS storformat_products_pricing_type_check;
ALTER TABLE public.storformat_products
  ADD CONSTRAINT storformat_products_pricing_type_check
  CHECK (pricing_type IN ('fixed', 'percentage', 'per_item', 'm2'));

-- Migrate existing percentage rows to per_item
UPDATE public.storformat_products
  SET pricing_type = 'per_item'
  WHERE pricing_type = 'percentage';

-- Add is_published to configs for draft/publish workflow
ALTER TABLE public.storformat_configs
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

-- Create product fixed prices table for per_item pricing
-- One row per (product, quantity) with a fixed price
CREATE TABLE IF NOT EXISTS public.storformat_product_fixed_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    storformat_product_id uuid NOT NULL REFERENCES public.storformat_products(id) ON DELETE CASCADE,
    quantity integer NOT NULL,
    price numeric NOT NULL DEFAULT 0,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (storformat_product_id, quantity)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_storformat_product_fixed_prices_product
  ON public.storformat_product_fixed_prices(storformat_product_id);
CREATE INDEX IF NOT EXISTS idx_storformat_product_fixed_prices_tenant
  ON public.storformat_product_fixed_prices(tenant_id);

-- Enable RLS
ALTER TABLE public.storformat_product_fixed_prices ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "product_fixed_prices_tenant_access" ON public.storformat_product_fixed_prices
  FOR ALL USING (public.can_access_tenant(tenant_id))
  WITH CHECK (public.can_access_tenant(tenant_id));

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_storformat_product_fixed_prices_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storformat_product_fixed_prices_updated_at
    BEFORE UPDATE ON public.storformat_product_fixed_prices
    FOR EACH ROW
    EXECUTE FUNCTION update_storformat_product_fixed_prices_updated_at();
