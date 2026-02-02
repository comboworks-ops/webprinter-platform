
-- 1. Fix print_flyers table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'print_flyers') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'print_flyers' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.print_flyers ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
            UPDATE public.print_flyers SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
            ALTER TABLE public.print_flyers ALTER COLUMN tenant_id SET NOT NULL;
            CREATE INDEX idx_print_flyers_tenant_id ON public.print_flyers(tenant_id);
            ALTER TABLE public.print_flyers ENABLE ROW LEVEL SECURITY;
            -- Drop policy if exists to avoid error
            DROP POLICY IF EXISTS "Tenant Owner Access" ON public.print_flyers;
            CREATE POLICY "Tenant Owner Access" ON public.print_flyers 
            FOR ALL USING (public.can_access_tenant(tenant_id));
        END IF;
    END IF;
END $$;

-- 2. Update RPC to include Specific Pricing Sync
CREATE OR REPLACE FUNCTION public.sync_specific_product(target_tenant_id uuid, product_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    master_id uuid := '00000000-0000-0000-0000-000000000000';
    tenant_owner_id uuid;
    old_p_id uuid;
    new_p_id uuid;
    r record;
    new_group_id uuid;
    pricing_table text;
    cols text;
BEGIN
    SELECT owner_id INTO tenant_owner_id FROM public.tenants WHERE id = target_tenant_id;

    -- 1. Get Master Product ID
    SELECT id INTO old_p_id FROM public.products WHERE tenant_id = master_id AND slug = product_slug;
    
    IF old_p_id IS NULL THEN RAISE EXCEPTION 'Product not found in Master'; END IF;

    -- 2. Insert Product (if not exists)
    INSERT INTO public.products (
        tenant_id, name, slug, description, category, pricing_type, image_url, is_published, created_at, updated_at, created_by, updated_by,
        about_title, about_description, about_image_url, default_variant, default_quantity, banner_config, template_files, tooltip_product, tooltip_price, tooltip_quick_tilbud
    )
    SELECT 
        target_tenant_id, m.name, m.slug, m.description, m.category, m.pricing_type, m.image_url, false, now(), now(), tenant_owner_id, tenant_owner_id,
        m.about_title, m.about_description, m.about_image_url, m.default_variant, m.default_quantity, m.banner_config, m.template_files, m.tooltip_product, m.tooltip_price, m.tooltip_quick_tilbud
    FROM public.products m
    WHERE m.id = old_p_id
    AND NOT EXISTS (SELECT 1 FROM public.products t WHERE t.tenant_id = target_tenant_id AND t.slug = m.slug)
    RETURNING id INTO new_p_id;

    IF new_p_id IS NULL THEN
        SELECT id INTO new_p_id FROM public.products WHERE tenant_id = target_tenant_id AND slug = product_slug;
    END IF;

    -- 3. Copy Generic Prices
    INSERT INTO public.generic_product_prices (tenant_id, product_id, variant_name, variant_value, quantity, price_dkk, extra_data)
    SELECT target_tenant_id, new_p_id, g.variant_name, g.variant_value, g.quantity, g.price_dkk, g.extra_data
    FROM public.generic_product_prices g
    WHERE g.tenant_id = master_id AND g.product_id = old_p_id
    ON CONFLICT DO NOTHING;

    -- 4. Copy Specific Pricing Table (if applicable)
    CASE product_slug
        WHEN 'flyers' THEN pricing_table := 'print_flyers';
        WHEN 'foldere' THEN pricing_table := 'folder_prices';
        WHEN 'visitkort' THEN pricing_table := 'visitkort_prices';
        WHEN 'plakater' THEN pricing_table := 'poster_prices'; 
        WHEN 'klistermærker' THEN pricing_table := 'sticker_rates';
        WHEN 'skilte' THEN pricing_table := 'sign_prices';
        WHEN 'bannere' THEN pricing_table := 'banner_prices';
        WHEN 'folie' THEN pricing_table := 'foil_prices';
        WHEN 'beachflag' THEN pricing_table := 'beachflag_prices';
        WHEN 'hæfter' THEN pricing_table := 'booklet_rates';
        WHEN 'haefter' THEN pricing_table := 'booklet_rates';
        WHEN 'salgsmapper' THEN pricing_table := 'salesfolder_rates';
        ELSE pricing_table := NULL;
    END CASE;

    IF pricing_table IS NOT NULL THEN
        -- Only copy if the table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = pricing_table) THEN
             -- Get columns excluding IDs
             SELECT string_agg(column_name, ', ') INTO cols 
             FROM information_schema.columns 
             WHERE table_name = pricing_table AND column_name NOT IN ('id', 'tenant_id', 'created_at', 'updated_at', 'created_by', 'updated_by');
             
             IF cols IS NOT NULL THEN
                 EXECUTE format('
                    INSERT INTO public.%I (tenant_id, created_at, updated_at, %s)
                    SELECT , now(), now(), %s
                    FROM public.%I
                    WHERE tenant_id = 
                    AND NOT EXISTS (SELECT 1 FROM public.%I t WHERE t.tenant_id =  LIMIT 1)
                 ', pricing_table, cols, cols, pricing_table, pricing_table) 
                 USING target_tenant_id, master_id;
             END IF;
        END IF;
    END IF;

    -- 5. Copy Custom Fields & Options (as before)
    INSERT INTO public.custom_fields (tenant_id, product_id, field_name, field_label, field_type, is_required, default_value)
    SELECT target_tenant_id, new_p_id, c.field_name, c.field_label, c.field_type, c.is_required, c.default_value
    FROM public.custom_fields c
    WHERE c.tenant_id = master_id AND c.product_id = old_p_id
    ON CONFLICT DO NOTHING;

    FOR r IN 
        SELECT pog.id as old_group_id, pog.name, pog.label, pog.display_type, poga.sort_order, poga.is_required
        FROM public.product_option_group_assignments poga
        JOIN public.product_option_groups pog ON poga.option_group_id = pog.id
        WHERE poga.product_id = old_p_id
    LOOP
        SELECT id INTO new_group_id FROM public.product_option_groups WHERE tenant_id = target_tenant_id AND name = r.name;
        IF new_group_id IS NULL THEN
            INSERT INTO public.product_option_groups (tenant_id, name, label, display_type)
            VALUES (target_tenant_id, r.name, r.label, r.display_type)
            RETURNING id INTO new_group_id;
            INSERT INTO public.product_options (group_id, name, label, icon_url, extra_price, sort_order)
            SELECT new_group_id, o.name, o.label, o.icon_url, o.extra_price, o.sort_order
            FROM public.product_options o
            WHERE o.group_id = r.old_group_id;
        END IF;
        INSERT INTO public.product_option_group_assignments (tenant_id, product_id, option_group_id, sort_order, is_required)
        VALUES (target_tenant_id, new_p_id, new_group_id, r.sort_order, r.is_required)
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;

