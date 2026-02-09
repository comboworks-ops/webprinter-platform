-- Addon Library System
-- Creates shared add-ons that can be imported into both Tryksager and Storformat products

-- =============================================================================
-- Table: addon_library_groups
-- Groups of add-ons (e.g., "Laminering", "Montering")
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.addon_library_groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    display_label text NOT NULL,
    description text,
    category text NOT NULL DEFAULT 'addon'
        CHECK (category IN ('addon', 'finish', 'accessory', 'service', 'material')),
    display_type text NOT NULL DEFAULT 'buttons'
        CHECK (display_type IN ('buttons', 'icon_grid', 'dropdown', 'checkboxes')),
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(tenant_id, name)
);

-- =============================================================================
-- Table: addon_library_items
-- Individual add-on items within a group
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.addon_library_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    group_id uuid NOT NULL REFERENCES public.addon_library_groups(id) ON DELETE CASCADE,
    name text NOT NULL,
    display_label text NOT NULL,
    description text,
    icon_url text,
    thumbnail_url text,
    pricing_mode text NOT NULL DEFAULT 'fixed'
        CHECK (pricing_mode IN ('fixed', 'per_quantity', 'per_area', 'tiered')),
    base_price numeric NOT NULL DEFAULT 0,
    markup_pct numeric DEFAULT 0,
    sort_order int DEFAULT 0,
    enabled boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =============================================================================
-- Table: addon_library_price_tiers
-- For tiered/area-based pricing (used primarily by Storformat)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.addon_library_price_tiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    addon_item_id uuid NOT NULL REFERENCES public.addon_library_items(id) ON DELETE CASCADE,
    from_m2 numeric NOT NULL DEFAULT 0,
    to_m2 numeric,
    price_per_m2 numeric NOT NULL DEFAULT 0,
    is_anchor boolean NOT NULL DEFAULT true,
    markup_pct numeric DEFAULT 0,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- =============================================================================
-- Table: addon_library_fixed_prices
-- For quantity-based fixed prices
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.addon_library_fixed_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    addon_item_id uuid NOT NULL REFERENCES public.addon_library_items(id) ON DELETE CASCADE,
    quantity int NOT NULL,
    price numeric NOT NULL DEFAULT 0,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(addon_item_id, quantity)
);

-- =============================================================================
-- Table: product_addon_imports
-- Links library groups to products (both Tryksager and Storformat)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_addon_imports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    addon_group_id uuid NOT NULL REFERENCES public.addon_library_groups(id) ON DELETE CASCADE,
    import_mode text NOT NULL DEFAULT 'reference'
        CHECK (import_mode IN ('reference', 'copy')),
    override_label text,
    override_display_type text
        CHECK (override_display_type IS NULL OR override_display_type IN ('buttons', 'icon_grid', 'dropdown', 'checkboxes')),
    is_required boolean DEFAULT false,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(product_id, addon_group_id)
);

-- =============================================================================
-- Table: product_addon_item_overrides
-- Per-product overrides for individual add-on items
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_addon_item_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    addon_item_id uuid NOT NULL REFERENCES public.addon_library_items(id) ON DELETE CASCADE,
    override_price numeric,
    override_pricing_mode text
        CHECK (override_pricing_mode IS NULL OR override_pricing_mode IN ('fixed', 'per_quantity', 'per_area', 'tiered')),
    override_markup_pct numeric,
    is_enabled boolean DEFAULT true,
    override_sort_order int,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(product_id, addon_item_id)
);

-- =============================================================================
-- Indexes for performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_addon_lib_groups_tenant ON public.addon_library_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_addon_lib_items_group ON public.addon_library_items(group_id);
CREATE INDEX IF NOT EXISTS idx_addon_lib_items_tenant ON public.addon_library_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_addon_lib_tiers_item ON public.addon_library_price_tiers(addon_item_id);
CREATE INDEX IF NOT EXISTS idx_addon_lib_fixed_item ON public.addon_library_fixed_prices(addon_item_id);
CREATE INDEX IF NOT EXISTS idx_addon_imports_product ON public.product_addon_imports(product_id);
CREATE INDEX IF NOT EXISTS idx_addon_imports_group ON public.product_addon_imports(addon_group_id);
CREATE INDEX IF NOT EXISTS idx_addon_imports_tenant ON public.product_addon_imports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_addon_overrides_product ON public.product_addon_item_overrides(product_id);
CREATE INDEX IF NOT EXISTS idx_addon_overrides_item ON public.product_addon_item_overrides(addon_item_id);

-- =============================================================================
-- Enable Row Level Security
-- =============================================================================
ALTER TABLE public.addon_library_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addon_library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addon_library_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addon_library_fixed_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addon_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_addon_item_overrides ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS Policies: addon_library_groups
-- =============================================================================
CREATE POLICY "addon_lib_groups_tenant_access" ON public.addon_library_groups
    FOR ALL USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "addon_lib_groups_public_select" ON public.addon_library_groups
    FOR SELECT TO anon, authenticated USING (true);

-- =============================================================================
-- RLS Policies: addon_library_items
-- =============================================================================
CREATE POLICY "addon_lib_items_tenant_access" ON public.addon_library_items
    FOR ALL USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "addon_lib_items_public_select" ON public.addon_library_items
    FOR SELECT TO anon, authenticated USING (true);

-- =============================================================================
-- RLS Policies: addon_library_price_tiers
-- =============================================================================
CREATE POLICY "addon_lib_tiers_tenant_access" ON public.addon_library_price_tiers
    FOR ALL USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "addon_lib_tiers_public_select" ON public.addon_library_price_tiers
    FOR SELECT TO anon, authenticated USING (true);

-- =============================================================================
-- RLS Policies: addon_library_fixed_prices
-- =============================================================================
CREATE POLICY "addon_lib_fixed_tenant_access" ON public.addon_library_fixed_prices
    FOR ALL USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "addon_lib_fixed_public_select" ON public.addon_library_fixed_prices
    FOR SELECT TO anon, authenticated USING (true);

-- =============================================================================
-- RLS Policies: product_addon_imports
-- =============================================================================
CREATE POLICY "addon_imports_tenant_access" ON public.product_addon_imports
    FOR ALL USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "addon_imports_public_select" ON public.product_addon_imports
    FOR SELECT TO anon, authenticated USING (true);

-- =============================================================================
-- RLS Policies: product_addon_item_overrides
-- =============================================================================
CREATE POLICY "addon_overrides_tenant_access" ON public.product_addon_item_overrides
    FOR ALL USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "addon_overrides_public_select" ON public.product_addon_item_overrides
    FOR SELECT TO anon, authenticated USING (true);

-- =============================================================================
-- Trigger for updated_at
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_addon_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_addon_library_groups_updated_at
    BEFORE UPDATE ON public.addon_library_groups
    FOR EACH ROW EXECUTE FUNCTION public.update_addon_library_updated_at();

CREATE TRIGGER update_addon_library_items_updated_at
    BEFORE UPDATE ON public.addon_library_items
    FOR EACH ROW EXECUTE FUNCTION public.update_addon_library_updated_at();

CREATE TRIGGER update_product_addon_imports_updated_at
    BEFORE UPDATE ON public.product_addon_imports
    FOR EACH ROW EXECUTE FUNCTION public.update_addon_library_updated_at();

CREATE TRIGGER update_product_addon_item_overrides_updated_at
    BEFORE UPDATE ON public.product_addon_item_overrides
    FOR EACH ROW EXECUTE FUNCTION public.update_addon_library_updated_at();
