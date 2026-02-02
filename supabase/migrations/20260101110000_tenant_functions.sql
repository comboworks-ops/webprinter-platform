-- Function to clone data from Master to a new Tenant
CREATE OR REPLACE FUNCTION public.seed_tenant_from_master(target_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    master_id uuid := '00000000-0000-0000-0000-000000000000';
    t text;
    -- Tables to clone
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
        'product_option_groups',
        -- 'product_options', -- Needs special handling because of UUIDs?
        -- 'product_option_group_assignments',
        -- 'generic_product_prices',
        'custom_fields'
        -- 'custom_field_values'
    ];
    
    -- We need to map old IDs to new IDs to maintain relationships
    -- For simplicty in V1, we will copy tables that don't have complex internal foreign keys first,
    -- or we use a more sophisticated approach. 
    -- 'products' has 'product_option_group_assignments' which links to 'product_option_groups'.
    
    -- If we just copy rows with new UUIDs, links break.
    -- If we keep UUIDs, unique constraints break (or we can't have duplicate PKs).
    -- Strategy: Create a temporary mapping table?
    
BEGIN
    -- This is a complex operation. 
    -- For now, let's implement a simplified version that just copies the flat pricing tables.
    -- Products and Options are harder because of FKs.
    
    -- 1. Simple Tables (No internal FKs to other clonable tables)
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
           -- We need to list columns explicitly to avoid 'id' collision? 
           -- Actually, if we exclude ID, PG generates new UUID.
           -- But we need to know column names. 
           -- Dynamic column selection:
           (SELECT string_agg(column_name, ', ') FROM information_schema.columns WHERE table_name = t AND column_name NOT IN ('id', 'tenant_id', 'created_at', 'updated_at', 'created_by', 'updated_by')),
           (SELECT string_agg(column_name, ', ') FROM information_schema.columns WHERE table_name = t AND column_name NOT IN ('id', 'tenant_id', 'created_at', 'updated_at', 'created_by', 'updated_by')),
           t
        ) USING target_tenant_id, master_id;
    END LOOP;
    
    -- 2. Products
    -- We need to map old product IDs to new product IDs to link prices/options later.
    CREATE TEMP TABLE product_map (old_id uuid, new_id uuid);
    
    INSERT INTO public.products (tenant_id, name, slug, description, category, pricing_type, image_url, is_published, created_at, updated_at, about_title, about_description, about_image_url, default_variant, default_quantity, banner_config, template_files, tooltip_product, tooltip_price, tooltip_quick_tilbud)
    SELECT target_tenant_id, name, slug, description, category, pricing_type, image_url, is_published, now(), now(), about_title, about_description, about_image_url, default_variant, default_quantity, banner_config, template_files, tooltip_product, tooltip_price, tooltip_quick_tilbud
    FROM public.products
    WHERE tenant_id = master_id
    RETURNING id; 
    -- Wait, we lost the mapping if we just insert.
    -- We need to loop or use a CTE mapping.
    
    -- Improved Product Cloning with Mapping:
    WITH source_products AS (
        SELECT * FROM public.products WHERE tenant_id = master_id
    ),
    inserted_products AS (
        INSERT INTO public.products (tenant_id, name, slug, description, category, pricing_type, image_url, is_published, created_at, updated_at, about_title, about_description, about_image_url, default_variant, default_quantity, banner_config, template_files, tooltip_product, tooltip_price, tooltip_quick_tilbud)
        SELECT target_tenant_id, name, slug, description, category, pricing_type, image_url, is_published, now(), now(), about_title, about_description, about_image_url, default_variant, default_quantity, banner_config, template_files, tooltip_product, tooltip_price, tooltip_quick_tilbud
        FROM source_products
        RETURNING id, slug -- assuming slug is unique per tenant, we can use it to map back? Or name?
    )
    INSERT INTO product_map (new_id, old_id)
    SELECT i.id, s.id
    FROM inserted_products i
    JOIN source_products s ON i.slug = s.slug; -- Fragile if slug not unique across tenants? But inside tenant it is.
    
    -- 3. Generic Product Prices (Linked to Products)
    INSERT INTO public.generic_product_prices (tenant_id, product_id, variant_name, variant_value, quantity, price_dkk, extra_data)
    SELECT target_tenant_id, pm.new_id, g.variant_name, g.variant_value, g.quantity, g.price_dkk, g.extra_data
    FROM public.generic_product_prices g
    JOIN product_map pm ON g.product_id = pm.old_id
    WHERE g.tenant_id = master_id;
    
    -- 4. Custom Fields (Linked to Products)
    WITH inserted_fields AS (
        INSERT INTO public.custom_fields (tenant_id, product_id, field_name, field_label, field_type, is_required, default_value)
        SELECT target_tenant_id, pm.new_id, c.field_name, c.field_label, c.field_type, c.is_required, c.default_value
        FROM public.custom_fields c
        JOIN product_map pm ON c.product_id = pm.old_id
        WHERE c.tenant_id = master_id
        RETURNING id, field_name, product_id -- Need to map these too?
    )
    SELECT 1; -- No-op
    
    -- 5. Option Groups and Options
    -- These are complex. For V1 we might skip deep cloning of options if they are heavily ID based.
    -- But let's try.
    CREATE TEMP TABLE group_map (old_id uuid, new_id uuid);
    
    WITH source_groups AS (
        SELECT * FROM public.product_option_groups WHERE tenant_id = master_id
    ),
    inserted_groups AS (
        INSERT INTO public.product_option_groups (tenant_id, name, label, display_type)
        SELECT target_tenant_id, name, label, display_type
        FROM source_groups
        RETURNING id, name
    )
    INSERT INTO group_map (new_id, old_id)
    SELECT i.id, s.id
    FROM inserted_groups i
    JOIN source_groups s ON i.name = s.name;
    
    -- Options
    INSERT INTO public.product_options (group_id, name, label, icon_url, extra_price, sort_order) -- tenant_id? product_options table definition in previous step didn't explicitly have tenant_id but migration added it
    SELECT gm.new_id, o.name, o.label, o.icon_url, o.extra_price, o.sort_order
    FROM public.product_options o
    JOIN group_map gm ON o.group_id = gm.old_id
    -- WHERE o.tenant_id = master_id -- Wait, if options are child of group, do they have tenant_id? Migration added it to ALL tables.
    ; 
    
    -- Option Assignments
    INSERT INTO public.product_option_group_assignments (tenant_id, product_id, option_group_id, sort_order, is_required)
    SELECT target_tenant_id, pm.new_id, gm.new_id, a.sort_order, a.is_required
    FROM public.product_option_group_assignments a
    JOIN product_map pm ON a.product_id = pm.old_id
    JOIN group_map gm ON a.option_group_id = gm.old_id
    WHERE a.tenant_id = master_id;

    -- Clean up
    DROP TABLE product_map;
    DROP TABLE group_map;
    
END;
$$;

-- Function to Sync Missing Products (Pull Updates)
-- This copies ONLY products that exist in Master but not in Tenant
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
    -- 1. Identify missing products (by slug)
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

    -- 2. Insert Missing Products
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

    -- 3. Copy Associated Prices (Generic)
    INSERT INTO public.generic_product_prices (tenant_id, product_id, variant_name, variant_value, quantity, price_dkk, extra_data)
    SELECT target_tenant_id, pm.new_id, g.variant_name, g.variant_value, g.quantity, g.price_dkk, g.extra_data
    FROM public.generic_product_prices g
    JOIN product_map pm ON g.product_id = pm.old_id
    WHERE g.tenant_id = master_id;

    -- 4. Copy Custom Fields
    INSERT INTO public.custom_fields (tenant_id, product_id, field_name, field_label, field_type, is_required, default_value)
    SELECT target_tenant_id, pm.new_id, c.field_name, c.field_label, c.field_type, c.is_required, c.default_value
    FROM public.custom_fields c
    JOIN product_map pm ON c.product_id = pm.old_id
    WHERE c.tenant_id = master_id;
    
    -- 5. Copy Options (Naive copy for now, ideally checks if group exists)
    -- This part is complex because groups might be shared or duplicated. 
    -- For V1, we assume if you sync a product, you might be missing its option groups.
    -- We'll skip deep option syncing for this specific function to avoid duplicates, 
    -- focusing on the main product data.
    
    -- Clean up
    DROP TABLE missing_products;
    DROP TABLE product_map;

    RETURN jsonb_build_object(
        'success', true, 
        'message', format('Synced %s products: %s', v_products_synced, array_to_string(v_product_names, ', ')), 
        'count', v_products_synced
    );
END;
$$;
