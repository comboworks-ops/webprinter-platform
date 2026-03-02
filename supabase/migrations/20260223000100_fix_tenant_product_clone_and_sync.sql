-- Fix tenant product propagation:
-- 1) remove legacy overloaded send_product_to_tenants(uuid, uuid[]) RPC
-- 2) deep-clone product payload for clone_product/sync_specific_product
-- 3) remap matrix attribute/value IDs in pricing_structure + generic prices

DROP FUNCTION IF EXISTS public.send_product_to_tenants(uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.remap_jsonb_uuid_strings(payload jsonb, id_map jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    payload_type text;
    raw_text text;
    mapped_text text;
    mapped_array jsonb;
    mapped_object jsonb;
BEGIN
    IF payload IS NULL THEN
        RETURN NULL;
    END IF;

    payload_type := jsonb_typeof(payload);

    IF payload_type = 'string' THEN
        raw_text := payload #>> '{}';

        IF id_map ? raw_text THEN
            RETURN to_jsonb(id_map ->> raw_text);
        END IF;

        IF position('|' IN raw_text) > 0 THEN
            SELECT string_agg(COALESCE(id_map ->> part, part), '|' ORDER BY ord)
            INTO mapped_text
            FROM regexp_split_to_table(raw_text, E'\\|') WITH ORDINALITY AS parts(part, ord);

            IF mapped_text IS NOT NULL AND mapped_text <> raw_text THEN
                RETURN to_jsonb(mapped_text);
            END IF;
        END IF;

        RETURN payload;
    ELSIF payload_type = 'array' THEN
        SELECT COALESCE(jsonb_agg(public.remap_jsonb_uuid_strings(value, id_map)), '[]'::jsonb)
        INTO mapped_array
        FROM jsonb_array_elements(payload);
        RETURN mapped_array;
    ELSIF payload_type = 'object' THEN
        SELECT COALESCE(jsonb_object_agg(key, public.remap_jsonb_uuid_strings(value, id_map)), '{}'::jsonb)
        INTO mapped_object
        FROM jsonb_each(payload);
        RETURN mapped_object;
    END IF;

    RETURN payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.copy_product_payload_deep(
    source_product_id uuid,
    target_tenant_id uuid,
    target_product_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    source_product public.products%ROWTYPE;
    id_map jsonb := '{}'::jsonb;
    source_group record;
    source_value record;
    source_assignment record;
    source_option record;
    new_group_id uuid;
    new_value_id uuid;
    resolved_option_group_id uuid;
    target_group_name text;
BEGIN
    SELECT *
    INTO source_product
    FROM public.products
    WHERE id = source_product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source product not found';
    END IF;

    -- Replace existing payload for target product.
    DELETE FROM public.generic_product_prices WHERE product_id = target_product_id;
    DELETE FROM public.price_list_templates WHERE product_id = target_product_id;
    DELETE FROM public.product_pricing_configs WHERE product_id = target_product_id;
    DELETE FROM public.custom_fields WHERE product_id = target_product_id;
    DELETE FROM public.product_option_group_assignments WHERE product_id = target_product_id;
    DELETE FROM public.product_attribute_groups WHERE product_id = target_product_id;

    -- Copy attribute groups/values and build old->new id map.
    FOR source_group IN
        SELECT *
        FROM public.product_attribute_groups
        WHERE product_id = source_product_id
        ORDER BY sort_order NULLS LAST, created_at
    LOOP
        INSERT INTO public.product_attribute_groups (
            tenant_id,
            product_id,
            library_group_id,
            name,
            kind,
            ui_mode,
            source,
            sort_order,
            enabled
        )
        VALUES (
            target_tenant_id,
            target_product_id,
            source_group.library_group_id,
            source_group.name,
            source_group.kind,
            source_group.ui_mode,
            source_group.source,
            source_group.sort_order,
            source_group.enabled
        )
        RETURNING id INTO new_group_id;

        id_map := id_map || jsonb_build_object(source_group.id::text, new_group_id::text);

        FOR source_value IN
            SELECT *
            FROM public.product_attribute_values
            WHERE product_id = source_product_id
              AND group_id = source_group.id
            ORDER BY sort_order NULLS LAST, created_at
        LOOP
            INSERT INTO public.product_attribute_values (
                tenant_id,
                product_id,
                group_id,
                name,
                key,
                sort_order,
                enabled,
                width_mm,
                height_mm,
                meta
            )
            VALUES (
                target_tenant_id,
                target_product_id,
                new_group_id,
                source_value.name,
                source_value.key,
                source_value.sort_order,
                source_value.enabled,
                source_value.width_mm,
                source_value.height_mm,
                source_value.meta
            )
            RETURNING id INTO new_value_id;

            id_map := id_map || jsonb_build_object(source_value.id::text, new_value_id::text);
        END LOOP;
    END LOOP;

    -- Remap product pricing layout (matrix structure).
    UPDATE public.products
    SET
        pricing_structure = public.remap_jsonb_uuid_strings(source_product.pricing_structure, id_map),
        updated_at = now(),
        updated_by = auth.uid()
    WHERE id = target_product_id;

    -- Copy/remap generic prices.
    INSERT INTO public.generic_product_prices (
        tenant_id,
        product_id,
        variant_name,
        variant_value,
        quantity,
        price_dkk,
        extra_data,
        updated_by
    )
    SELECT
        target_tenant_id,
        target_product_id,
        CASE
            WHEN src.variant_name IS NULL OR src.variant_name = '' THEN src.variant_name
            ELSE (
                SELECT string_agg(COALESCE(id_map ->> part, part), '|' ORDER BY ord)
                FROM regexp_split_to_table(src.variant_name, E'\\|') WITH ORDINALITY AS parts(part, ord)
            )
        END AS mapped_variant_name,
        COALESCE(id_map ->> src.variant_value, src.variant_value) AS mapped_variant_value,
        src.quantity,
        src.price_dkk,
        public.remap_jsonb_uuid_strings(src.extra_data, id_map) AS mapped_extra_data,
        auth.uid()
    FROM public.generic_product_prices src
    WHERE src.product_id = source_product_id
    ON CONFLICT (product_id, variant_name, variant_value, quantity)
    DO UPDATE
    SET
        tenant_id = EXCLUDED.tenant_id,
        price_dkk = EXCLUDED.price_dkk,
        extra_data = EXCLUDED.extra_data,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by;

    -- Copy/remap saved templates.
    INSERT INTO public.price_list_templates (
        tenant_id,
        product_id,
        name,
        spec,
        created_by
    )
    SELECT
        target_tenant_id,
        target_product_id,
        src.name,
        public.remap_jsonb_uuid_strings(src.spec, id_map),
        COALESCE(auth.uid(), src.created_by)
    FROM public.price_list_templates src
    WHERE src.product_id = source_product_id;

    -- Copy product pricing configs.
    INSERT INTO public.product_pricing_configs (
        tenant_id,
        product_id,
        pricing_type,
        pricing_profile_id,
        margin_profile_id,
        allowed_sides,
        quantities,
        sizes,
        bleed_mm,
        gap_mm,
        material_ids,
        finish_ids,
        numbering_enabled,
        numbering_setup_fee,
        numbering_price_per_unit,
        numbering_positions,
        display_mode
    )
    SELECT
        target_tenant_id,
        target_product_id,
        src.pricing_type,
        src.pricing_profile_id,
        src.margin_profile_id,
        src.allowed_sides,
        src.quantities,
        src.sizes,
        src.bleed_mm,
        src.gap_mm,
        src.material_ids,
        src.finish_ids,
        src.numbering_enabled,
        src.numbering_setup_fee,
        src.numbering_price_per_unit,
        src.numbering_positions,
        src.display_mode
    FROM public.product_pricing_configs src
    WHERE src.product_id = source_product_id;

    -- Copy custom fields.
    INSERT INTO public.custom_fields (
        tenant_id,
        product_id,
        field_name,
        field_label,
        field_type,
        is_required,
        default_value,
        updated_by
    )
    SELECT
        target_tenant_id,
        target_product_id,
        src.field_name,
        src.field_label,
        src.field_type,
        src.is_required,
        src.default_value,
        auth.uid()
    FROM public.custom_fields src
    WHERE src.product_id = source_product_id;

    -- Copy option group assignments + options.
    FOR source_assignment IN
        SELECT
            poga.sort_order,
            poga.is_required,
            pog.id AS source_group_id,
            pog.name AS source_group_name,
            pog.label AS source_group_label,
            pog.display_type AS source_group_display_type,
            pog.description AS source_group_description
        FROM public.product_option_group_assignments poga
        JOIN public.product_option_groups pog ON pog.id = poga.option_group_id
        WHERE poga.product_id = source_product_id
        ORDER BY poga.sort_order NULLS LAST, poga.created_at
    LOOP
        target_group_name := source_assignment.source_group_name || '__t_' || replace(target_tenant_id::text, '-', '');

        SELECT id
        INTO resolved_option_group_id
        FROM public.product_option_groups
        WHERE tenant_id = target_tenant_id
          AND name = target_group_name
        LIMIT 1;

        IF resolved_option_group_id IS NULL THEN
            INSERT INTO public.product_option_groups (
                tenant_id,
                name,
                label,
                display_type,
                description,
                updated_by
            )
            VALUES (
                target_tenant_id,
                target_group_name,
                source_assignment.source_group_label,
                source_assignment.source_group_display_type,
                source_assignment.source_group_description,
                auth.uid()
            )
            RETURNING id INTO resolved_option_group_id;
        END IF;

        FOR source_option IN
            SELECT *
            FROM public.product_options
            WHERE group_id = source_assignment.source_group_id
            ORDER BY sort_order NULLS LAST, created_at
        LOOP
            INSERT INTO public.product_options (
                group_id,
                name,
                label,
                icon_url,
                extra_price,
                sort_order,
                price_mode,
                description,
                tenant_id,
                updated_by
            )
            VALUES (
                resolved_option_group_id,
                source_option.name,
                source_option.label,
                source_option.icon_url,
                source_option.extra_price,
                source_option.sort_order,
                source_option.price_mode,
                source_option.description,
                target_tenant_id,
                auth.uid()
            )
            ON CONFLICT (group_id, name)
            DO UPDATE
            SET
                label = EXCLUDED.label,
                icon_url = EXCLUDED.icon_url,
                extra_price = EXCLUDED.extra_price,
                sort_order = EXCLUDED.sort_order,
                price_mode = EXCLUDED.price_mode,
                description = EXCLUDED.description,
                tenant_id = EXCLUDED.tenant_id,
                updated_by = EXCLUDED.updated_by,
                updated_at = now();
        END LOOP;

        INSERT INTO public.product_option_group_assignments (
            tenant_id,
            product_id,
            option_group_id,
            sort_order,
            is_required
        )
        VALUES (
            target_tenant_id,
            target_product_id,
            resolved_option_group_id,
            source_assignment.sort_order,
            source_assignment.is_required
        )
        ON CONFLICT (product_id, option_group_id)
        DO UPDATE
        SET
            tenant_id = EXCLUDED.tenant_id,
            sort_order = EXCLUDED.sort_order,
            is_required = EXCLUDED.is_required;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.clone_product(source_product_id uuid, target_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    source_product public.products%ROWTYPE;
    target_owner_id uuid;
    new_product_id uuid;
    base_slug text;
    candidate_slug text;
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

    SELECT owner_id
    INTO target_owner_id
    FROM public.tenants
    WHERE id = target_tenant_id;

    IF target_owner_id IS NULL THEN
        RAISE EXCEPTION 'Target tenant not found';
    END IF;

    base_slug := regexp_replace(COALESCE(source_product.slug, 'product') || '-copy', '[^a-z0-9-]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(both '-' from base_slug);
    IF base_slug = '' THEN
        base_slug := 'product-copy';
    END IF;

    candidate_slug := base_slug;
    WHILE EXISTS (
        SELECT 1
        FROM public.products p
        WHERE p.tenant_id = target_tenant_id
          AND p.slug = candidate_slug
    ) LOOP
        suffix := suffix + 1;
        candidate_slug := base_slug || '-' || suffix::text;
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
        source_product.name || ' (Copy)',
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

CREATE OR REPLACE FUNCTION public.sync_specific_product(target_tenant_id uuid, product_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    master_id constant uuid := '00000000-0000-0000-0000-000000000000';
    source_product public.products%ROWTYPE;
    target_product_id uuid;
    target_owner_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.tenants t
        WHERE t.id = target_tenant_id
          AND t.owner_id = auth.uid()
    )
    AND NOT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'master_admin'
    ) THEN
        RAISE EXCEPTION 'tenant owner or master_admin required';
    END IF;

    SELECT *
    INTO source_product
    FROM public.products
    WHERE tenant_id = master_id
      AND slug = product_slug;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found in Master';
    END IF;

    SELECT owner_id
    INTO target_owner_id
    FROM public.tenants
    WHERE id = target_tenant_id;

    IF target_owner_id IS NULL THEN
        RAISE EXCEPTION 'Target tenant not found';
    END IF;

    SELECT id
    INTO target_product_id
    FROM public.products
    WHERE tenant_id = target_tenant_id
      AND slug = product_slug
    LIMIT 1;

    IF target_product_id IS NULL THEN
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
            source_product.name,
            source_product.slug,
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
        RETURNING id INTO target_product_id;
    ELSE
        UPDATE public.products
        SET
            name = source_product.name,
            description = source_product.description,
            category = source_product.category,
            pricing_type = source_product.pricing_type,
            image_url = source_product.image_url,
            about_title = source_product.about_title,
            about_description = source_product.about_description,
            about_image_url = source_product.about_image_url,
            default_variant = source_product.default_variant,
            default_quantity = source_product.default_quantity,
            banner_config = source_product.banner_config,
            template_files = source_product.template_files,
            tooltip_product = source_product.tooltip_product,
            tooltip_price = source_product.tooltip_price,
            tooltip_quick_tilbud = source_product.tooltip_quick_tilbud,
            technical_specs = source_product.technical_specs,
            output_color_profile_id = source_product.output_color_profile_id,
            preset_key = source_product.preset_key,
            pricing_structure = source_product.pricing_structure,
            icon_text = source_product.icon_text,
            is_ready = source_product.is_ready,
            updated_at = now(),
            updated_by = auth.uid()
        WHERE id = target_product_id;
    END IF;

    PERFORM public.copy_product_payload_deep(source_product.id, target_tenant_id, target_product_id);
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
    inserted_count int := 0;
    normalized_mode text;
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
        RETURN jsonb_build_object('sent', 0);
    END IF;

    FOREACH recipient IN ARRAY tenant_ids LOOP
        IF recipient IS NULL OR recipient = master_id THEN
            CONTINUE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = recipient) THEN
            CONTINUE;
        END IF;

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

        inserted_count := inserted_count + 1;
    END LOOP;

    RETURN jsonb_build_object('sent', inserted_count);
END;
$$;
