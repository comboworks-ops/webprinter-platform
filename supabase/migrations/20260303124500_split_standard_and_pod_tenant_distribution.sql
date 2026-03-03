-- Split tenant distribution semantics:
-- 1) Standard pris => create an independent tenant copy immediately
-- 2) POD-pris => keep notification/import flow through tenant inbox

CREATE OR REPLACE FUNCTION public.clone_product_for_tenant_release(
    source_product_id uuid,
    target_tenant_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    master_id constant uuid := '00000000-0000-0000-0000-000000000000';
    source_product public.products%ROWTYPE;
    target_owner_id uuid;
    new_product_id uuid;
    base_slug text;
    candidate_slug text;
    base_name text;
    candidate_name text;
    suffix int := 1;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = 'master_admin'
    ) THEN
        RAISE EXCEPTION 'master_admin role required';
    END IF;

    SELECT *
    INTO source_product
    FROM public.products
    WHERE id = source_product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found';
    END IF;

    IF source_product.tenant_id IS DISTINCT FROM master_id THEN
        RAISE EXCEPTION 'Only Master products can be distributed to tenants';
    END IF;

    IF target_tenant_id = master_id THEN
        RAISE EXCEPTION 'Target tenant must be a non-master tenant';
    END IF;

    SELECT owner_id
    INTO target_owner_id
    FROM public.tenants
    WHERE id = target_tenant_id;

    IF target_owner_id IS NULL THEN
        RAISE EXCEPTION 'Target tenant not found';
    END IF;

    base_slug := regexp_replace(COALESCE(source_product.slug, 'product'), '[^a-z0-9-]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(both '-' from base_slug);
    IF base_slug = '' THEN
        base_slug := 'product';
    END IF;

    base_name := COALESCE(source_product.name, 'Produkt');
    candidate_slug := base_slug;
    candidate_name := base_name;

    WHILE EXISTS (
        SELECT 1
        FROM public.products p
        WHERE p.tenant_id = target_tenant_id
          AND p.slug = candidate_slug
    ) LOOP
        suffix := suffix + 1;
        candidate_slug := base_slug || '-' || suffix::text;
        candidate_name := base_name || ' (' || suffix::text || ')';
    END LOOP;

    INSERT INTO public.products (
        tenant_id,
        name,
        slug,
        description,
        category,
        pricing_type,
        image_url,
        is_published,
        created_by,
        updated_by,
        about_title,
        about_description,
        about_image_url,
        default_variant,
        default_quantity,
        banner_config,
        template_files,
        tooltip_product,
        tooltip_price,
        tooltip_quick_tilbud,
        is_available_to_tenants,
        technical_specs,
        output_color_profile_id,
        preset_key,
        pricing_structure,
        icon_text,
        is_ready
    )
    VALUES (
        target_tenant_id,
        candidate_name,
        candidate_slug,
        source_product.description,
        source_product.category,
        source_product.pricing_type,
        source_product.image_url,
        false,
        COALESCE(auth.uid(), target_owner_id),
        COALESCE(auth.uid(), target_owner_id),
        source_product.about_title,
        source_product.about_description,
        source_product.about_image_url,
        source_product.default_variant,
        source_product.default_quantity,
        source_product.banner_config,
        source_product.template_files,
        source_product.tooltip_product,
        source_product.tooltip_price,
        source_product.tooltip_quick_tilbud,
        false,
        source_product.technical_specs,
        source_product.output_color_profile_id,
        source_product.preset_key,
        source_product.pricing_structure,
        source_product.icon_text,
        source_product.is_ready
    )
    RETURNING id INTO new_product_id;

    PERFORM public.copy_product_payload_deep(source_product_id, target_tenant_id, new_product_id);

    RETURN new_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_product_to_tenants(
    master_product_id uuid,
    tenant_ids uuid[],
    delivery_mode text DEFAULT 'price_list'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    master_id CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
    product_record public.products%ROWTYPE;
    recipient uuid;
    normalized_mode text;
    copied_count int := 0;
    notified_count int := 0;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'master_admin'
    ) THEN
        RAISE EXCEPTION 'master_admin role required';
    END IF;

    SELECT *
    INTO product_record
    FROM public.products
    WHERE id = master_product_id AND tenant_id = master_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Master product not found';
    END IF;

    normalized_mode := delivery_mode;
    IF normalized_mode NOT IN ('price_list', 'pod_price_list') THEN
        normalized_mode := 'price_list';
    END IF;

    IF tenant_ids IS NULL THEN
        RETURN jsonb_build_object('sent', 0, 'copied', 0, 'notified', 0);
    END IF;

    FOREACH recipient IN ARRAY tenant_ids LOOP
        IF recipient IS NULL OR recipient = master_id THEN
            CONTINUE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = recipient) THEN
            CONTINUE;
        END IF;

        IF normalized_mode = 'price_list' THEN
            PERFORM public.clone_product_for_tenant_release(master_product_id, recipient);
            copied_count := copied_count + 1;
        ELSE
            INSERT INTO public.tenant_notifications (tenant_id, type, title, content, data)
            VALUES (
                recipient,
                'product_update',
                format('Nyt produkt: %s', product_record.name),
                format('Produktet "%s" er klar til import. Gå til din shop og importér det.', product_record.name),
                jsonb_build_object(
                    'product_id', product_record.id,
                    'slug', product_record.slug,
                    'product_name', product_record.name,
                    'delivery_mode', normalized_mode
                )
            );

            notified_count := notified_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'sent', copied_count + notified_count,
        'copied', copied_count,
        'notified', notified_count,
        'delivery_mode', normalized_mode
    );
END;
$$;
