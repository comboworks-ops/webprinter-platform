-- Storformat pricing system tables

-- Extend pricing_type enum check to include storformat and machine priced
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_pricing_type_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_pricing_type_check
  CHECK (pricing_type IN ('matrix', 'rate', 'formula', 'fixed', 'custom-dimensions', 'MACHINE_PRICED', 'STORFORMAT'));

-- Core config
CREATE TABLE IF NOT EXISTS public.storformat_configs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    rounding_step integer NOT NULL DEFAULT 1,
    global_markup_pct numeric NOT NULL DEFAULT 0,
    quantities integer[] NOT NULL DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (product_id)
);

CREATE TABLE IF NOT EXISTS public.storformat_materials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name text NOT NULL,
    max_width_mm numeric,
    max_height_mm numeric,
    allow_split boolean NOT NULL DEFAULT true,
    interpolation_enabled boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storformat_material_price_tiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    material_id uuid NOT NULL REFERENCES public.storformat_materials(id) ON DELETE CASCADE,
    from_m2 numeric NOT NULL,
    to_m2 numeric,
    price_per_m2 numeric NOT NULL,
    is_anchor boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.storformat_finishes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name text NOT NULL,
    pricing_mode text NOT NULL CHECK (pricing_mode IN ('fixed', 'per_m2')),
    fixed_price_per_unit numeric NOT NULL DEFAULT 0,
    interpolation_enabled boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.storformat_finish_price_tiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    finish_id uuid NOT NULL REFERENCES public.storformat_finishes(id) ON DELETE CASCADE,
    from_m2 numeric NOT NULL,
    to_m2 numeric,
    price_per_m2 numeric NOT NULL,
    is_anchor boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.storformat_price_list_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    name text NOT NULL,
    spec jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_storformat_configs_tenant ON public.storformat_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_storformat_configs_product ON public.storformat_configs(product_id);
CREATE INDEX IF NOT EXISTS idx_storformat_materials_tenant ON public.storformat_materials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_storformat_materials_product ON public.storformat_materials(product_id);
CREATE INDEX IF NOT EXISTS idx_storformat_material_tiers_material ON public.storformat_material_price_tiers(material_id);
CREATE INDEX IF NOT EXISTS idx_storformat_finishes_tenant ON public.storformat_finishes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_storformat_finishes_product ON public.storformat_finishes(product_id);
CREATE INDEX IF NOT EXISTS idx_storformat_finish_tiers_finish ON public.storformat_finish_price_tiers(finish_id);
CREATE INDEX IF NOT EXISTS idx_storformat_templates_tenant ON public.storformat_price_list_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_storformat_templates_product ON public.storformat_price_list_templates(product_id);

-- Enable RLS
ALTER TABLE public.storformat_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storformat_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storformat_material_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storformat_finishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storformat_finish_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storformat_price_list_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant Access" ON public.storformat_configs
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "Tenant Access" ON public.storformat_materials
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "Tenant Access" ON public.storformat_material_price_tiers
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "Tenant Access" ON public.storformat_finishes
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "Tenant Access" ON public.storformat_finish_price_tiers
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "Tenant Access" ON public.storformat_price_list_templates
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_storformat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER storformat_configs_updated_at
    BEFORE UPDATE ON public.storformat_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_storformat_updated_at();

CREATE TRIGGER storformat_materials_updated_at
    BEFORE UPDATE ON public.storformat_materials
    FOR EACH ROW
    EXECUTE FUNCTION update_storformat_updated_at();

CREATE TRIGGER storformat_finishes_updated_at
    BEFORE UPDATE ON public.storformat_finishes
    FOR EACH ROW
    EXECUTE FUNCTION update_storformat_updated_at();

CREATE TRIGGER storformat_templates_updated_at
    BEFORE UPDATE ON public.storformat_price_list_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_storformat_updated_at();
