
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
BEGIN
    SELECT owner_id INTO tenant_owner_id FROM public.tenants WHERE id = target_tenant_id;

    -- 1. Get Master Product ID
    SELECT id INTO old_p_id FROM public.products WHERE tenant_id = master_id AND slug = product_slug;
    
    IF old_p_id IS NULL THEN
        RAISE EXCEPTION 'Product not found in Master';
    END IF;

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

    -- If already existed, get its ID
    IF new_p_id IS NULL THEN
        SELECT id INTO new_p_id FROM public.products WHERE tenant_id = target_tenant_id AND slug = product_slug;
    END IF;

    -- 3. Copy Generic Prices
    INSERT INTO public.generic_product_prices (tenant_id, product_id, variant_name, variant_value, quantity, price_dkk, extra_data)
    SELECT target_tenant_id, new_p_id, g.variant_name, g.variant_value, g.quantity, g.price_dkk, g.extra_data
    FROM public.generic_product_prices g
    WHERE g.tenant_id = master_id AND g.product_id = old_p_id
    ON CONFLICT DO NOTHING;

    -- 4. Copy Custom Fields
    INSERT INTO public.custom_fields (tenant_id, product_id, field_name, field_label, field_type, is_required, default_value)
    SELECT target_tenant_id, new_p_id, c.field_name, c.field_label, c.field_type, c.is_required, c.default_value
    FROM public.custom_fields c
    WHERE c.tenant_id = master_id AND c.product_id = old_p_id
    ON CONFLICT DO NOTHING;

    -- 5. Copy Option Groups and Assignments
    FOR r IN 
        SELECT pog.id as old_group_id, pog.name, pog.label, pog.display_type, poga.sort_order, poga.is_required
        FROM public.product_option_group_assignments poga
        JOIN public.product_option_groups pog ON poga.option_group_id = pog.id
        WHERE poga.product_id = old_p_id
    LOOP
        -- Check if group exists in tenant
        SELECT id INTO new_group_id FROM public.product_option_groups WHERE tenant_id = target_tenant_id AND name = r.name;
        
        -- If not, Create Group
        IF new_group_id IS NULL THEN
            INSERT INTO public.product_option_groups (tenant_id, name, label, display_type)
            VALUES (target_tenant_id, r.name, r.label, r.display_type)
            RETURNING id INTO new_group_id;
            
            -- Copy Options for this Group
            INSERT INTO public.product_options (group_id, name, label, icon_url, extra_price, sort_order)
            SELECT new_group_id, o.name, o.label, o.icon_url, o.extra_price, o.sort_order
            FROM public.product_options o
            WHERE o.group_id = r.old_group_id;
        END IF;
        
        -- Assign Group to Product
        INSERT INTO public.product_option_group_assignments (tenant_id, product_id, option_group_id, sort_order, is_required)
        VALUES (target_tenant_id, new_p_id, new_group_id, r.sort_order, r.is_required)
        ON CONFLICT DO NOTHING;
    END LOOP;

END;
$$;

