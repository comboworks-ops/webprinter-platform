-- Ensure tenant product copies/imports always have matching product categories.
--
-- Why:
-- Some tenant products were copied/imported without corresponding
-- public.product_categories rows. The admin product overview expects
-- tenant taxonomy to exist and can become inconsistent when products
-- reference categories that were never created for that tenant.
--
-- Rollback note:
-- If needed, revert the helper and remove the function calls from
-- clone_product_for_tenant_release/sync_specific_product. The inserted
-- category rows are additive and can be left in place safely.

CREATE OR REPLACE FUNCTION public.ensure_product_taxonomy_for_tenant(
    _tenant_id uuid,
    _category_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    normalized_name text;
    category_slug text;
    default_overview_id uuid;
    next_sort_order integer;
BEGIN
    normalized_name := btrim(COALESCE(_category_name, ''));
    IF normalized_name = '' THEN
        RETURN;
    END IF;

    category_slug := lower(normalized_name);
    category_slug := replace(category_slug, 'æ', 'ae');
    category_slug := replace(category_slug, 'ø', 'oe');
    category_slug := replace(category_slug, 'å', 'aa');
    category_slug := regexp_replace(category_slug, '[^a-z0-9]+', '-', 'g');
    category_slug := regexp_replace(category_slug, '-+', '-', 'g');
    category_slug := btrim(category_slug, '-');

    IF category_slug = '' THEN
        category_slug := 'produkter';
    END IF;

    IF category_slug = 'tryksager' THEN
        normalized_name := 'Tryksager';
    ELSIF category_slug = 'storformat' THEN
        normalized_name := 'Storformat';
    ELSIF category_slug = 'salgsmapper' THEN
        normalized_name := 'Salgsmapper';
    END IF;

    INSERT INTO public.product_overviews (tenant_id, name, slug, sort_order)
    VALUES (_tenant_id, 'Produkter', 'produkter', 0)
    ON CONFLICT (tenant_id, slug) DO NOTHING;

    SELECT id
    INTO default_overview_id
    FROM public.product_overviews
    WHERE tenant_id = _tenant_id
      AND slug = 'produkter'
    ORDER BY sort_order ASC NULLS LAST, created_at ASC
    LIMIT 1;

    IF default_overview_id IS NULL THEN
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.product_categories
        WHERE tenant_id = _tenant_id
          AND slug = category_slug
    ) THEN
        RETURN;
    END IF;

    SELECT COALESCE(MAX(sort_order), 0) + 1
    INTO next_sort_order
    FROM public.product_categories
    WHERE tenant_id = _tenant_id;

    INSERT INTO public.product_categories (
        tenant_id,
        name,
        slug,
        sort_order,
        overview_id
    )
    VALUES (
        _tenant_id,
        normalized_name,
        category_slug,
        next_sort_order,
        default_overview_id
    )
    ON CONFLICT (tenant_id, slug) DO NOTHING;
END;
$$;

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

    PERFORM public.ensure_product_taxonomy_for_tenant(target_tenant_id, source_product.category);

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

    PERFORM public.ensure_product_taxonomy_for_tenant(target_tenant_id, source_product.category);

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

DO $$
DECLARE
    category_record record;
BEGIN
    FOR category_record IN
        SELECT DISTINCT tenant_id, category
        FROM public.products
        WHERE tenant_id <> '00000000-0000-0000-0000-000000000000'
          AND btrim(COALESCE(category, '')) <> ''
    LOOP
        PERFORM public.ensure_product_taxonomy_for_tenant(
            category_record.tenant_id,
            category_record.category
        );
    END LOOP;
END;
$$;
