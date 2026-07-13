-- Company Hub V2 request and approval workflow.
-- Additive only: live pricing remains authoritative and existing checkout/order
-- tables are not changed.

DROP POLICY IF EXISTS company_order_requests_member_insert ON public.company_order_requests;

CREATE OR REPLACE FUNCTION public.company_hub_create_order_request(
    _company_id uuid,
    _office_id uuid,
    _item_id uuid,
    _quantity integer,
    _field_values jsonb,
    _product_configuration jsonb,
    _quote_snapshot jsonb,
    _quoted_total numeric,
    _address_snapshot jsonb DEFAULT NULL
)
RETURNS public.company_order_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    item public.company_hub_items%ROWTYPE;
    created_request public.company_order_requests%ROWTYPE;
    next_status text;
BEGIN
    IF auth.uid() IS NULL OR NOT public.company_hub_has_role(
        _company_id,
        ARRAY['company_owner', 'company_admin', 'company_approver', 'company_buyer']::text[]
    ) THEN
        RAISE EXCEPTION 'Du har ikke adgang til at bestille for dette firma.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO item
    FROM public.company_hub_items
    WHERE id = _item_id
      AND company_id = _company_id
      AND status = 'active';

    IF NOT FOUND OR item.product_id IS NULL THEN
        RAISE EXCEPTION 'Firmaproduktet er ikke aktivt.' USING ERRCODE = 'P0002';
    END IF;
    IF _office_id IS NOT NULL AND NOT public.company_hub_can_access_office(_company_id, _office_id) THEN
        RAISE EXCEPTION 'Du har ikke adgang til det valgte kontor.' USING ERRCODE = '42501';
    END IF;
    IF _quantity IS NULL OR _quantity <= 0 THEN
        RAISE EXCEPTION 'Antallet skal være større end nul.' USING ERRCODE = '22023';
    END IF;
    IF _quoted_total IS NULL OR _quoted_total <= 0 OR _quote_snapshot IS NULL THEN
        RAISE EXCEPTION 'Der mangler en gyldig livepris.' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(_quote_snapshot->>'productId', '') <> item.product_id::text
       OR CASE
            WHEN COALESCE(_quote_snapshot->>'quantity', '') ~ '^[0-9]+$'
            THEN (_quote_snapshot->>'quantity')::integer
            ELSE 0
          END <> _quantity THEN
        RAISE EXCEPTION 'Prisgrundlaget matcher ikke produkt og antal.' USING ERRCODE = '22023';
    END IF;

    next_status := CASE WHEN COALESCE(item.requires_approval, false)
        THEN 'pending_approval'
        ELSE 'checkout_started'
    END;

    INSERT INTO public.company_order_requests (
        tenant_id,
        company_id,
        office_id,
        item_id,
        product_id,
        template_binding_id,
        template_version,
        requested_by,
        quantity,
        field_values,
        product_configuration,
        quote_snapshot,
        quoted_total,
        address_snapshot,
        status
    ) VALUES (
        item.tenant_id,
        item.company_id,
        _office_id,
        item.id,
        item.product_id,
        item.template_binding_id,
        (
            SELECT binding.version
            FROM public.company_template_bindings binding
            WHERE binding.id = item.template_binding_id
        ),
        auth.uid(),
        _quantity,
        COALESCE(_field_values, '{}'::jsonb),
        COALESCE(_product_configuration, '{}'::jsonb),
        _quote_snapshot,
        _quoted_total,
        _address_snapshot,
        next_status
    ) RETURNING * INTO created_request;

    INSERT INTO public.company_activity_events (
        tenant_id, company_id, office_id, actor_user_id,
        event_type, entity_type, entity_id, metadata
    ) VALUES (
        item.tenant_id, item.company_id, _office_id, auth.uid(),
        'order_request_created', 'company_order_request', created_request.id,
        jsonb_build_object('status', next_status, 'quantity', _quantity)
    );

    RETURN created_request;
END;
$$;

REVOKE ALL ON FUNCTION public.company_hub_create_order_request(uuid, uuid, uuid, integer, jsonb, jsonb, jsonb, numeric, jsonb) FROM public;
REVOKE ALL ON FUNCTION public.company_hub_create_order_request(uuid, uuid, uuid, integer, jsonb, jsonb, jsonb, numeric, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.company_hub_create_order_request(uuid, uuid, uuid, integer, jsonb, jsonb, jsonb, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_hub_create_order_request(uuid, uuid, uuid, integer, jsonb, jsonb, jsonb, numeric, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.company_hub_prepare_order_checkout(
    _request_id uuid,
    _quantity integer,
    _product_configuration jsonb,
    _quote_snapshot jsonb,
    _quoted_total numeric
)
RETURNS public.company_order_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    request_row public.company_order_requests%ROWTYPE;
    item public.company_hub_items%ROWTYPE;
    configuration_changed boolean;
BEGIN
    SELECT * INTO request_row FROM public.company_order_requests WHERE id = _request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bestillingsanmodningen findes ikke.' USING ERRCODE = 'P0002';
    END IF;
    IF auth.uid() IS NULL OR (
        request_row.requested_by <> auth.uid()
        AND NOT public.company_hub_has_role(
            request_row.company_id,
            ARRAY['company_owner', 'company_admin', 'company_approver', 'company_buyer']::text[]
        )
    ) THEN
        RAISE EXCEPTION 'Du har ikke adgang til bestillingsanmodningen.' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO item FROM public.company_hub_items WHERE id = request_row.item_id;
    IF item.status <> 'active' THEN
        RAISE EXCEPTION 'Firmaproduktet er ikke længere aktivt.' USING ERRCODE = 'P0002';
    END IF;
    IF _quantity IS NULL OR _quantity <= 0 OR _quoted_total IS NULL OR _quoted_total <= 0 OR _quote_snapshot IS NULL THEN
        RAISE EXCEPTION 'Der mangler et gyldigt antal eller en gyldig livepris.' USING ERRCODE = '22023';
    END IF;
    IF COALESCE(_quote_snapshot->>'productId', '') <> request_row.product_id::text
       OR CASE
            WHEN COALESCE(_quote_snapshot->>'quantity', '') ~ '^[0-9]+$'
            THEN (_quote_snapshot->>'quantity')::integer
            ELSE 0
          END <> _quantity THEN
        RAISE EXCEPTION 'Prisgrundlaget matcher ikke produkt og antal.' USING ERRCODE = '22023';
    END IF;

    configuration_changed := request_row.quantity <> _quantity
        OR request_row.product_configuration <> COALESCE(_product_configuration, '{}'::jsonb);

    IF COALESCE(item.requires_approval, false) AND request_row.status = 'approved' AND configuration_changed THEN
        UPDATE public.company_order_requests SET
            quantity = _quantity,
            product_configuration = COALESCE(_product_configuration, '{}'::jsonb),
            quote_snapshot = _quote_snapshot,
            quoted_total = _quoted_total,
            status = 'pending_approval',
            approval_reason = 'Bestillingen blev ændret efter godkendelse.',
            decided_by = NULL,
            decided_at = NULL
        WHERE id = _request_id
        RETURNING * INTO request_row;
        RETURN request_row;
    END IF;

    IF COALESCE(item.requires_approval, false) AND request_row.status <> 'approved' THEN
        RETURN request_row;
    END IF;

    IF request_row.status NOT IN ('approved', 'checkout_started') THEN
        RAISE EXCEPTION 'Bestillingsanmodningen kan ikke åbnes i checkout.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.company_order_requests SET
        quantity = _quantity,
        product_configuration = COALESCE(_product_configuration, '{}'::jsonb),
        quote_snapshot = _quote_snapshot,
        quoted_total = _quoted_total,
        status = 'checkout_started'
    WHERE id = _request_id
    RETURNING * INTO request_row;
    RETURN request_row;
END;
$$;

REVOKE ALL ON FUNCTION public.company_hub_prepare_order_checkout(uuid, integer, jsonb, jsonb, numeric) FROM public;
REVOKE ALL ON FUNCTION public.company_hub_prepare_order_checkout(uuid, integer, jsonb, jsonb, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.company_hub_prepare_order_checkout(uuid, integer, jsonb, jsonb, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_hub_prepare_order_checkout(uuid, integer, jsonb, jsonb, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.company_hub_decide_order_request(
    _request_id uuid,
    _approve boolean,
    _reason text DEFAULT NULL
)
RETURNS public.company_order_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    request_row public.company_order_requests%ROWTYPE;
BEGIN
    SELECT * INTO request_row FROM public.company_order_requests WHERE id = _request_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bestillingsanmodningen findes ikke.' USING ERRCODE = 'P0002';
    END IF;
    IF auth.uid() IS NULL OR NOT (
        public.can_access_tenant(request_row.tenant_id)
        OR public.company_hub_has_role(
            request_row.company_id,
            ARRAY['company_owner', 'company_admin', 'company_approver']::text[]
        )
    ) THEN
        RAISE EXCEPTION 'Du må ikke godkende firmaets bestillinger.' USING ERRCODE = '42501';
    END IF;
    IF request_row.status <> 'pending_approval' THEN
        RAISE EXCEPTION 'Bestillingen afventer ikke godkendelse.' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.company_order_requests SET
        status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
        approval_reason = NULLIF(BTRIM(COALESCE(_reason, '')), ''),
        decided_by = auth.uid(),
        decided_at = now()
    WHERE id = _request_id
    RETURNING * INTO request_row;

    INSERT INTO public.company_activity_events (
        tenant_id, company_id, office_id, actor_user_id,
        event_type, entity_type, entity_id, metadata
    ) VALUES (
        request_row.tenant_id, request_row.company_id, request_row.office_id, auth.uid(),
        CASE WHEN _approve THEN 'order_request_approved' ELSE 'order_request_rejected' END,
        'company_order_request', request_row.id,
        jsonb_build_object('reason', request_row.approval_reason)
    );
    RETURN request_row;
END;
$$;

REVOKE ALL ON FUNCTION public.company_hub_decide_order_request(uuid, boolean, text) FROM public;
REVOKE ALL ON FUNCTION public.company_hub_decide_order_request(uuid, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.company_hub_decide_order_request(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_hub_decide_order_request(uuid, boolean, text) TO service_role;

CREATE OR REPLACE FUNCTION public.company_hub_link_order(
    _request_id uuid,
    _order_id uuid
)
RETURNS public.company_order_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    request_row public.company_order_requests%ROWTYPE;
BEGIN
    SELECT * INTO request_row FROM public.company_order_requests WHERE id = _request_id FOR UPDATE;
    IF NOT FOUND OR request_row.requested_by <> auth.uid() OR request_row.status <> 'checkout_started' THEN
        RAISE EXCEPTION 'Firmaordren kan ikke forbindes med bestillingen.' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM public.orders order_row
        WHERE order_row.id = _order_id
          AND order_row.user_id = auth.uid()
          AND order_row.tenant_id = request_row.tenant_id
    ) THEN
        RAISE EXCEPTION 'Ordren kunne ikke verificeres.' USING ERRCODE = '42501';
    END IF;

    UPDATE public.company_order_requests SET status = 'ordered', order_id = _order_id
    WHERE id = _request_id
    RETURNING * INTO request_row;
    RETURN request_row;
END;
$$;

REVOKE ALL ON FUNCTION public.company_hub_link_order(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.company_hub_link_order(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.company_hub_link_order(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_hub_link_order(uuid, uuid) TO service_role;

-- Rollback note: disable Company Hub V2 request UI and revoke authenticated
-- execute from the four RPCs above. Preserve requests and activity events for
-- audit; do not delete orders or pricing snapshots.
