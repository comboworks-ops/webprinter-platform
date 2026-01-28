-- Attribute Builder Tables for Produkt Tab
-- Tenant-scoped reusable attribute library + product-specific snapshots

-- 1. Attribute Library Groups (tenant-wide reusable)
CREATE TABLE IF NOT EXISTS public.attribute_library_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('format', 'material', 'finish', 'other', 'custom')),
    default_ui_mode text NOT NULL DEFAULT 'buttons' CHECK (default_ui_mode IN ('buttons', 'dropdown')),
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(tenant_id, name)
);

-- 2. Attribute Library Values
CREATE TABLE IF NOT EXISTS public.attribute_library_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    group_id uuid NOT NULL REFERENCES public.attribute_library_groups(id) ON DELETE CASCADE,
    name text NOT NULL,
    key text,
    sort_order int DEFAULT 0,
    enabled boolean DEFAULT true,
    width_mm numeric,
    height_mm numeric,
    meta jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. Product Attribute Groups (snapshots from library or product-specific)
CREATE TABLE IF NOT EXISTS public.product_attribute_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    library_group_id uuid REFERENCES public.attribute_library_groups(id) ON DELETE SET NULL,
    name text NOT NULL,
    kind text NOT NULL CHECK (kind IN ('format', 'material', 'finish', 'other', 'custom')),
    ui_mode text NOT NULL DEFAULT 'buttons' CHECK (ui_mode IN ('buttons', 'dropdown')),
    source text NOT NULL DEFAULT 'product' CHECK (source IN ('library', 'product')),
    sort_order int DEFAULT 0,
    enabled boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4. Product Attribute Values (snapshots)
CREATE TABLE IF NOT EXISTS public.product_attribute_values (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    group_id uuid NOT NULL REFERENCES public.product_attribute_groups(id) ON DELETE CASCADE,
    name text NOT NULL,
    key text,
    sort_order int DEFAULT 0,
    enabled boolean DEFAULT true,
    width_mm numeric,
    height_mm numeric,
    meta jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.attribute_library_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribute_library_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attribute_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_attribute_values ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Tenant Access
CREATE POLICY "Tenant Access" ON public.attribute_library_groups
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "Tenant Access" ON public.attribute_library_values
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "Tenant Access" ON public.product_attribute_groups
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "Tenant Access" ON public.product_attribute_values
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

-- Public Select for storefront
CREATE POLICY "Public Select" ON public.product_attribute_groups
FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public Select" ON public.product_attribute_values
FOR SELECT TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attr_lib_groups_tenant ON public.attribute_library_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attr_lib_values_group ON public.attribute_library_values(group_id);
CREATE INDEX IF NOT EXISTS idx_prod_attr_groups_product ON public.product_attribute_groups(product_id);
CREATE INDEX IF NOT EXISTS idx_prod_attr_values_group ON public.product_attribute_values(group_id);

-- Add pricing_structure to products if not exists
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS pricing_structure jsonb DEFAULT '{"mode": "matrix"}'::jsonb;
