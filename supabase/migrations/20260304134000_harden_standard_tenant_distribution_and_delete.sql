-- Harden standard tenant distribution and product deletion.
--
-- Why:
-- 1) Standard tenant sends should create one editable copy per tenant slug,
--    not unlimited duplicate copies that confuse the tenant admin.
-- 2) Product deletion should happen server-side so tenant-scoped payload and
--    stale standard notifications are cleaned consistently.
--
-- Rollback note:
-- Revert send_product_to_tenants/delete_product_with_payload to their previous
-- versions. Existing tenant copies can remain safely.

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
    skipped_existing_count int := 0;
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
        RETURN jsonb_build_object(
            'sent', 0,
            'copied', 0,
            'notified', 0,
            'skipped_existing', 0
        );
    END IF;

    FOREACH recipient IN ARRAY tenant_ids LOOP
        IF recipient IS NULL OR recipient = master_id THEN
            CONTINUE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = recipient) THEN
            CONTINUE;
        END IF;

        IF normalized_mode = 'price_list' THEN
            DELETE FROM public.tenant_notifications
            WHERE tenant_id = recipient
              AND type = 'product_update'
              AND COALESCE(data->>'delivery_mode', 'price_list') = 'price_list'
              AND data->>'slug' = product_record.slug;

            IF EXISTS (
                SELECT 1
                FROM public.products
                WHERE tenant_id = recipient
                  AND slug = product_record.slug
            ) THEN
                skipped_existing_count := skipped_existing_count + 1;
            ELSE
                PERFORM public.clone_product_for_tenant_release(master_product_id, recipient);
                copied_count := copied_count + 1;
            END IF;
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
        'sent', copied_count + notified_count + skipped_existing_count,
        'copied', copied_count,
        'notified', notified_count,
        'skipped_existing', skipped_existing_count,
        'delivery_mode', normalized_mode
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_product_with_payload(
    target_product_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_product public.products%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT *
    INTO target_product
    FROM public.products
    WHERE id = target_product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found';
    END IF;

    IF NOT public.can_access_tenant(target_product.tenant_id) THEN
        RAISE EXCEPTION 'Access denied for tenant';
    END IF;

    DELETE FROM public.company_hub_items
    WHERE product_id = target_product_id
      AND tenant_id = target_product.tenant_id;

    DELETE FROM public.tenant_notifications
    WHERE tenant_id = target_product.tenant_id
      AND type = 'product_update'
      AND COALESCE(data->>'delivery_mode', 'price_list') = 'price_list'
      AND (
        data->>'slug' = target_product.slug
        OR data->>'product_id' = target_product_id::text
      );

    DELETE FROM public.products
    WHERE id = target_product_id
      AND tenant_id = target_product.tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product delete failed';
    END IF;

    RETURN true;
END;
$$;
