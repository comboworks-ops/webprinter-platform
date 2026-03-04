-- Deep duplicate a product within the same tenant, including pricing/layout payload.
--
-- Rollback note:
-- Revert the duplicate_product_with_payload function and switch the frontend
-- duplicate action back if needed. Existing duplicated products can remain.

CREATE OR REPLACE FUNCTION public.duplicate_product_with_payload(
    source_product_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    source_product public.products%ROWTYPE;
    tenant_owner_id uuid;
    new_product_id uuid;
    base_slug text;
    candidate_slug text;
    candidate_name text;
    suffix int := 1;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT *
    INTO source_product
    FROM public.products
    WHERE id = source_product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source product not found';
    END IF;

    IF NOT public.can_access_tenant(source_product.tenant_id) THEN
        RAISE EXCEPTION 'Access denied for tenant';
    END IF;

    SELECT owner_id
    INTO tenant_owner_id
    FROM public.tenants
    WHERE id = source_product.tenant_id;

    IF tenant_owner_id IS NULL THEN
        RAISE EXCEPTION 'Source tenant not found';
    END IF;

    PERFORM public.ensure_product_taxonomy_for_tenant(source_product.tenant_id, source_product.category);

    base_slug := regexp_replace(COALESCE(source_product.slug, 'product') || '-kopi', '[^a-z0-9-]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(both '-' from base_slug);
    IF base_slug = '' THEN
        base_slug := 'produkt-kopi';
    END IF;

    candidate_slug := base_slug;
    candidate_name := COALESCE(source_product.name, 'Produkt') || ' (kopi)';

    WHILE EXISTS (
        SELECT 1
        FROM public.products p
        WHERE p.tenant_id = source_product.tenant_id
          AND p.slug = candidate_slug
    ) LOOP
        suffix := suffix + 1;
        candidate_slug := base_slug || '-' || suffix::text;
        candidate_name := COALESCE(source_product.name, 'Produkt') || ' (kopi) (' || suffix::text || ')';
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
        source_product.tenant_id,
        candidate_name,
        candidate_slug,
        source_product.description,
        source_product.category,
        source_product.pricing_type,
        source_product.image_url,
        false,
        COALESCE(auth.uid(), tenant_owner_id),
        COALESCE(auth.uid(), tenant_owner_id),
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

    PERFORM public.copy_product_payload_deep(source_product_id, source_product.tenant_id, new_product_id);

    RETURN new_product_id;
END;
$$;
