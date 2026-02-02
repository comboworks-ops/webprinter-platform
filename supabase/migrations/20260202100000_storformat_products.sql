-- Storformat products + layout config extensions

-- Layout config stored on config row
ALTER TABLE public.storformat_configs
  ADD COLUMN IF NOT EXISTS layout_rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS vertical_axis jsonb;

-- Markup support on base tables
ALTER TABLE public.storformat_materials
  ADD COLUMN IF NOT EXISTS markup_pct numeric NOT NULL DEFAULT 0;

ALTER TABLE public.storformat_finishes
  ADD COLUMN IF NOT EXISTS markup_pct numeric NOT NULL DEFAULT 0;

ALTER TABLE public.storformat_material_price_tiers
  ADD COLUMN IF NOT EXISTS markup_pct numeric NOT NULL DEFAULT 0;

ALTER TABLE public.storformat_finish_price_tiers
  ADD COLUMN IF NOT EXISTS markup_pct numeric NOT NULL DEFAULT 0;

-- Product dimension
CREATE TABLE IF NOT EXISTS public.storformat_products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name text NOT NULL,
    group_label text,
    pricing_mode text NOT NULL CHECK (pricing_mode IN ('fixed', 'per_m2')),
    initial_price numeric NOT NULL DEFAULT 0,
    interpolation_enabled boolean NOT NULL DEFAULT true,
    markup_pct numeric NOT NULL DEFAULT 0,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storformat_product_price_tiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    product_item_id uuid NOT NULL REFERENCES public.storformat_products(id) ON DELETE CASCADE,
    from_m2 numeric NOT NULL,
    to_m2 numeric,
    price_per_m2 numeric NOT NULL,
    is_anchor boolean NOT NULL DEFAULT true,
    markup_pct numeric NOT NULL DEFAULT 0,
    sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.storformat_product_fixed_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    product_item_id uuid NOT NULL REFERENCES public.storformat_products(id) ON DELETE CASCADE,
    quantity integer NOT NULL,
    price numeric NOT NULL DEFAULT 0,
    sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_storformat_products_tenant ON public.storformat_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_storformat_products_product ON public.storformat_products(product_id);
CREATE INDEX IF NOT EXISTS idx_storformat_product_tiers_product ON public.storformat_product_price_tiers(product_item_id);
CREATE INDEX IF NOT EXISTS idx_storformat_product_fixed_product ON public.storformat_product_fixed_prices(product_item_id);

ALTER TABLE public.storformat_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storformat_product_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storformat_product_fixed_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant Access" ON public.storformat_products
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "Tenant Access" ON public.storformat_product_price_tiers
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "Tenant Access" ON public.storformat_product_fixed_prices
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

CREATE TRIGGER storformat_products_updated_at
    BEFORE UPDATE ON public.storformat_products
    FOR EACH ROW
    EXECUTE FUNCTION update_storformat_updated_at();
