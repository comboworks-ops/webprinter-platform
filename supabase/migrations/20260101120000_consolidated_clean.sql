-- CONSOLIDATED MULTI-TENANCY MIGRATION (SAFE TO RUN MULTIPLE TIMES)

-- 1. Create Tables (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    domain text UNIQUE,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    owner_id uuid REFERENCES auth.users(id)
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.system_updates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version text NOT NULL,
    description text,
    changes jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.tenant_update_status (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    update_id uuid REFERENCES public.system_updates(id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'failed')),
    applied_at timestamp with time zone,
    UNIQUE(tenant_id, update_id)
);

-- 2. Create Master Tenant
INSERT INTO public.tenants (id, name, domain, settings)
VALUES ('00000000-0000-0000-0000-000000000000', 'Master Template', 'master.webprinter.dk', '{"type": "master"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 3. Add tenant_id to existing tables and enable RLS
DO $$
DECLARE
    t text;
    -- All tables that need multi-tenancy
    tables text[] := ARRAY[
        'products',
        'folder_prices', 
        'visitkort_prices', 
        'poster_rates', 
        'poster_prices',
        'sticker_rates', 
        'sign_rates',
        'sign_prices',
        'banner_rates',
        'banner_prices',
        'beachflag_prices', 
        'booklet_rates', 
        'salesfolder_rates', 
        'foil_prices',
        'generic_product_prices',
        'product_option_groups',
        'product_options',
        'product_option_group_assignments',
        'custom_fields',
        'custom_field_values'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Add 'tenant_id' column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = t AND column_name = 'tenant_id'
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN tenant_id uuid REFERENCES public.tenants(id)', t);
            -- Default existing data to Master
            EXECUTE format('UPDATE public.%I SET tenant_id = ''00000000-0000-0000-0000-000000000000'' WHERE tenant_id IS NULL', t);
            -- Enforce NOT NULL
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t);
            -- Add Index
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant_id ON public.%I(tenant_id)', t, t);
        END IF;

        -- Ensure RLS is enabled
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- 4. Create Helper Functions (RLS)
CREATE OR REPLACE FUNCTION public.can_access_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Owner access
    IF EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id AND owner_id = auth.uid()) THEN
        RETURN true;
    END IF;
    -- Master Admin access (checks 'admin' role)
    IF _tenant_id = '00000000-0000-0000-0000-000000000000' AND public.has_role(auth.uid(), 'admin') THEN
        RETURN true;
    END IF;
    RETURN false;
END;
$$;

-- 5. Create/Update Policies (Safe Mode)
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'products',
        'folder_prices', 
        'visitkort_prices', 
        'poster_rates', 
        'poster_prices',
        'sticker_rates', 
        'sign_rates',
        'sign_prices',
        'banner_rates',
        'banner_prices',
        'beachflag_prices', 
        'booklet_rates', 
        'salesfolder_rates', 
        'foil_prices',
        'generic_product_prices',
        'product_option_groups',
        'product_options',
        'product_option_group_assignments',
        'custom_fields',
        'custom_field_values'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Drop existing policy to ensure we can recreate it cleanly
        EXECUTE format('DROP POLICY IF EXISTS "Tenant Owner Access" ON public.%I', t);
        
        -- Create Policy: Only applied for INSERT/UPDATE/DELETE. SELECT is left open (public) for now as discussed.
        EXECUTE format('CREATE POLICY "Tenant Owner Access" ON public.%I FOR ALL USING (public.can_access_tenant(tenant_id)) WITH CHECK (public.can_access_tenant(tenant_id))', t);
    END LOOP;
END $$;

-- 6. Tenant Cloning Function
CREATE OR REPLACE FUNCTION public.seed_tenant_from_master(target_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    master_id uuid := '00000000-0000-0000-0000-000000000000';
    t text;
BEGIN
    -- 1. Simple Tables
    FOREACH t IN ARRAY ARRAY[
        'folder_prices', 'visitkort_prices', 'poster_rates', 'poster_prices', 
        'sticker_rates', 'sign_rates', 'sign_prices', 'banner_rates', 'banner_prices', 
        'beachflag_prices', 'booklet_rates', 'salesfolder_rates', 'foil_prices'
    ] LOOP
        EXECUTE format('
            INSERT INTO public.%I (tenant_id, created_at, updated_at, %s)
            SELECT $1, now(), now(), %s
            FROM public.%I
            WHERE tenant_id = $2
        ', t, 
           (SELECT string_agg(column_name, ', ') FROM information_schema.columns WHERE table_name = t AND column_name NOT IN ('id', 'tenant_id', 'created_at', 'updated_at', 'created_by', 'updated_by')),
           (SELECT string_agg(column_name, ', ') FROM information_schema.columns WHERE table_name = t AND column_name NOT IN ('id', 'tenant_id', 'created_at', 'updated_at', 'created_by', 'updated_by')),
           t
        ) USING target_tenant_id, master_id;
    END LOOP;
    
    -- 2. Products & Relations
    -- (Simplified cloning logic reusing simplified flow from previous iterations)
    CREATE TEMP TABLE product_map (old_id uuid, new_id uuid);
    
    WITH inserted_products AS (
        INSERT INTO public.products (tenant_id, name, slug, description, category, pricing_type, image_url, is_published, created_at, updated_at, about_title, about_description, about_image_url, default_variant, default_quantity, banner_config, template_files, tooltip_product, tooltip_price, tooltip_quick_tilbud)
        SELECT target_tenant_id, name, slug, description, category, pricing_type, image_url, is_published, now(), now(), about_title, about_description, about_image_url, default_variant, default_quantity, banner_config, template_files, tooltip_product, tooltip_price, tooltip_quick_tilbud
        FROM public.products
        WHERE tenant_id = master_id
        RETURNING id, slug
    )
    INSERT INTO product_map (new_id, old_id)
    SELECT i.id, s.id
    FROM inserted_products i
    JOIN public.products s ON i.slug = s.slug AND s.tenant_id = master_id;
    
    -- Generic Prices
    INSERT INTO public.generic_product_prices (tenant_id, product_id, variant_name, variant_value, quantity, price_dkk, extra_data)
    SELECT target_tenant_id, pm.new_id, g.variant_name, g.variant_value, g.quantity, g.price_dkk, g.extra_data
    FROM public.generic_product_prices g
    JOIN product_map pm ON g.product_id = pm.old_id
    WHERE g.tenant_id = master_id;
    
    -- Custom Fields
    INSERT INTO public.custom_fields (tenant_id, product_id, field_name, field_label, field_type, is_required, default_value)
    SELECT target_tenant_id, pm.new_id, c.field_name, c.field_label, c.field_type, c.is_required, c.default_value
    FROM public.custom_fields c
    JOIN product_map pm ON c.product_id = pm.old_id
    WHERE c.tenant_id = master_id;
    
    -- Option Groups
    CREATE TEMP TABLE group_map (old_id uuid, new_id uuid);
    
    WITH inserted_groups AS (
        INSERT INTO public.product_option_groups (tenant_id, name, label, display_type)
        SELECT target_tenant_id, name, label, display_type
        FROM public.product_option_groups
        WHERE tenant_id = master_id
        RETURNING id, name
    )
    INSERT INTO group_map (new_id, old_id)
    SELECT i.id, s.id
    FROM inserted_groups i
    JOIN public.product_option_groups s ON i.name = s.name AND s.tenant_id = master_id;
    
    -- Option Options
    INSERT INTO public.product_options (group_id, name, label, icon_url, extra_price, sort_order)
    SELECT gm.new_id, o.name, o.label, o.icon_url, o.extra_price, o.sort_order
    FROM public.product_options o
    JOIN group_map gm ON o.group_id = gm.old_id;
    
    -- Option Assignments
    INSERT INTO public.product_option_group_assignments (tenant_id, product_id, option_group_id, sort_order, is_required)
    SELECT target_tenant_id, pm.new_id, gm.new_id, a.sort_order, a.is_required
    FROM public.product_option_group_assignments a
    JOIN product_map pm ON a.product_id = pm.old_id
    JOIN group_map gm ON a.option_group_id = gm.old_id
    WHERE a.tenant_id = master_id;

    DROP TABLE product_map;
    DROP TABLE group_map;
END;
$$;

-- 7. Sync Missing Products Function
CREATE OR REPLACE FUNCTION public.sync_missing_products(target_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    master_id uuid := '00000000-0000-0000-0000-000000000000';
    v_products_synced int := 0;
    v_product_names text[] := ARRAY[]::text[];
BEGIN
    CREATE TEMP TABLE missing_products AS
    SELECT * FROM public.products mp
    WHERE mp.tenant_id = master_id
    AND NOT EXISTS (
        SELECT 1 FROM public.products tp 
        WHERE tp.tenant_id = target_tenant_id 
        AND tp.slug = mp.slug
    );
    
    GET DIAGNOSTICS v_products_synced = ROW_COUNT;
    
    IF v_products_synced = 0 THEN
        DROP TABLE missing_products;
        RETURN jsonb_build_object('success', true, 'message', 'No new products to sync', 'count', 0);
    END IF;
    
    SELECT array_agg(name) INTO v_product_names FROM missing_products;

    CREATE TEMP TABLE product_map (old_id uuid, new_id uuid);
    
    WITH inserted_products AS (
        INSERT INTO public.products (tenant_id, name, slug, description, category, pricing_type, image_url, is_published, created_at, updated_at, about_title, about_description, about_image_url, default_variant, default_quantity, banner_config, template_files, tooltip_product, tooltip_price, tooltip_quick_tilbud)
        SELECT target_tenant_id, name, slug, description, category, pricing_type, image_url, is_published, now(), now(), about_title, about_description, about_image_url, default_variant, default_quantity, banner_config, template_files, tooltip_product, tooltip_price, tooltip_quick_tilbud
        FROM missing_products
        RETURNING id, slug
    )
    INSERT INTO product_map (new_id, old_id)
    SELECT i.id, m.id
    FROM inserted_products i
    JOIN missing_products m ON i.slug = m.slug;

    INSERT INTO public.generic_product_prices (tenant_id, product_id, variant_name, variant_value, quantity, price_dkk, extra_data)
    SELECT target_tenant_id, pm.new_id, g.variant_name, g.variant_value, g.quantity, g.price_dkk, g.extra_data
    FROM public.generic_product_prices g
    JOIN product_map pm ON g.product_id = pm.old_id
    WHERE g.tenant_id = master_id;

    INSERT INTO public.custom_fields (tenant_id, product_id, field_name, field_label, field_type, is_required, default_value)
    SELECT target_tenant_id, pm.new_id, c.field_name, c.field_label, c.field_type, c.is_required, c.default_value
    FROM public.custom_fields c
    JOIN product_map pm ON c.product_id = pm.old_id
    WHERE c.tenant_id = master_id;
    
    DROP TABLE missing_products;
    DROP TABLE product_map;

    RETURN jsonb_build_object(
        'success', true, 
        'message', format('Synced %s products: %s', v_products_synced, array_to_string(v_product_names, ', ')), 
        'count', v_products_synced
    );
END;
$$;
