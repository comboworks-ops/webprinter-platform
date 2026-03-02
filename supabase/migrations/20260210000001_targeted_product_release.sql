-- Add function to notify a selected list of tenants about a master product release.
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
    -- Only master admins are allowed to send targeted notifications.
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'master_admin'
    ) THEN
        RAISE EXCEPTION 'master_admin role required';
    END IF;

    -- Load the master product to describe the release.
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
