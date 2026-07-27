-- Print Production corrective safety wave.
--
-- This migration is additive except for replacing the existing distribution
-- RPC and narrowing tenant writes to POD v2 fulfillment jobs. It does not
-- change POD v1, product pricing, or existing order totals.
--
-- Rollback:
--   1. Drop public.pod2_claim_printcom_submission(uuid,text,text,uuid,text).
--   2. Drop idx_pod2_jobs_printcom_order_id_unique and
--      idx_pod2_jobs_order_catalog_unique.
--   3. Restore policy pod2_jobs_tenant from 20260128_pod2_system.sql.
--   4. Restore send_product_to_tenants from
--      20260304143000_make_standard_send_always_clone.sql.
--   5. The new audit/lock columns may remain unused, or be dropped only after
--      confirming no submission is in progress.

ALTER TABLE public.pod2_fulfillment_jobs
    ADD COLUMN IF NOT EXISTS printcom_validation_fingerprint text,
    ADD COLUMN IF NOT EXISTS printcom_validation_payment_method text,
    ADD COLUMN IF NOT EXISTS printcom_validated_at timestamptz,
    ADD COLUMN IF NOT EXISTS printcom_validated_by_user_id uuid,
    ADD COLUMN IF NOT EXISTS printcom_submission_lock_token uuid,
    ADD COLUMN IF NOT EXISTS printcom_submission_locked_at timestamptz,
    ADD COLUMN IF NOT EXISTS printcom_payment_verification text,
    ADD COLUMN IF NOT EXISTS printcom_payment_verified_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pod2_jobs_printcom_order_id_unique
    ON public.pod2_fulfillment_jobs (printcom_order_id)
    WHERE printcom_order_id IS NOT NULL AND btrim(printcom_order_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pod2_jobs_order_catalog_unique
    ON public.pod2_fulfillment_jobs (order_id, catalog_product_id);

DROP POLICY IF EXISTS "pod2_jobs_tenant" ON public.pod2_fulfillment_jobs;
DROP POLICY IF EXISTS "pod2_jobs_tenant_select" ON public.pod2_fulfillment_jobs;
DROP POLICY IF EXISTS "pod2_jobs_master_manage" ON public.pod2_fulfillment_jobs;

CREATE POLICY "pod2_jobs_tenant_select"
    ON public.pod2_fulfillment_jobs
    FOR SELECT
    TO authenticated
    USING (public.can_access_tenant(tenant_id) OR public.is_pod2_master_admin());

CREATE POLICY "pod2_jobs_master_manage"
    ON public.pod2_fulfillment_jobs
    FOR ALL
    TO authenticated
    USING (public.is_pod2_master_admin())
    WITH CHECK (public.is_pod2_master_admin());

-- Atomic, service-role-only claim before the first outbound POST /orders.
-- A retained lock means the result is uncertain and must be reconciled before
-- another submission is attempted.
CREATE OR REPLACE FUNCTION public.pod2_claim_printcom_submission(
    p_job_id uuid,
    p_validation_fingerprint text,
    p_payment_method text,
    p_requested_by uuid,
    p_payment_verification text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    job_record public.pod2_fulfillment_jobs%ROWTYPE;
    lock_token uuid := gen_random_uuid();
    claimed_token uuid;
BEGIN
    SELECT *
    INTO job_record
    FROM public.pod2_fulfillment_jobs
    WHERE id = p_job_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('claimed', false, 'reason', 'job_not_found');
    END IF;
    IF job_record.status <> 'paid' THEN
        RETURN jsonb_build_object('claimed', false, 'reason', 'job_not_paid');
    END IF;
    IF job_record.qty <= 0
       OR job_record.tenant_cost <= 0
       OR upper(btrim(job_record.currency)) !~ '^[A-Z]{3}$' THEN
        RETURN jsonb_build_object('claimed', false, 'reason', 'invalid_job_financials');
    END IF;
    IF NULLIF(btrim(job_record.printcom_order_id), '') IS NOT NULL
       OR NULLIF(btrim(job_record.provider_job_ref), '') IS NOT NULL THEN
        RETURN jsonb_build_object('claimed', false, 'reason', 'supplier_reference_exists');
    END IF;
    IF job_record.printcom_submission_lock_token IS NOT NULL THEN
        RETURN jsonb_build_object('claimed', false, 'reason', 'submission_locked');
    END IF;
    IF p_payment_method NOT IN ('invoice', 'psp') THEN
        RETURN jsonb_build_object('claimed', false, 'reason', 'invalid_payment_method');
    END IF;
    IF p_validation_fingerprint !~ '^[0-9a-f]{64}$'
       OR job_record.printcom_validation_fingerprint IS DISTINCT FROM p_validation_fingerprint
       OR job_record.printcom_validation_payment_method IS DISTINCT FROM p_payment_method
       OR job_record.printcom_validated_at IS NULL
       OR job_record.printcom_validated_at < now() - interval '15 minutes' THEN
        RETURN jsonb_build_object('claimed', false, 'reason', 'validation_missing_or_stale');
    END IF;
    IF p_payment_verification = 'stripe' THEN
        IF NULLIF(btrim(job_record.stripe_payment_intent_id), '') IS NULL THEN
            RETURN jsonb_build_object('claimed', false, 'reason', 'stripe_payment_missing');
        END IF;
    ELSIF p_payment_verification = 'auto_forward' THEN
        IF NOT EXISTS (
            SELECT 1
            FROM public.tenants tenant
            WHERE tenant.id = job_record.tenant_id
              AND tenant.pod2_auto_forward IS TRUE
        ) THEN
            RETURN jsonb_build_object('claimed', false, 'reason', 'auto_forward_not_enabled');
        END IF;
    ELSE
        RETURN jsonb_build_object('claimed', false, 'reason', 'payment_not_verified');
    END IF;

    UPDATE public.pod2_fulfillment_jobs
    SET printcom_submission_lock_token = lock_token,
        printcom_submission_locked_at = now(),
        printcom_submission_step = 'submitting',
        printcom_last_attempt_at = now(),
        printcom_last_error = NULL,
        printcom_payment_verification = p_payment_verification,
        printcom_payment_verified_at = now(),
        submitted_by_master_user_id = p_requested_by
    WHERE id = p_job_id
      AND status = 'paid'
      AND printcom_order_id IS NULL
      AND provider_job_ref IS NULL
      AND printcom_submission_lock_token IS NULL
      AND printcom_validation_fingerprint = p_validation_fingerprint
      AND printcom_validation_payment_method = p_payment_method
      AND printcom_validated_at >= now() - interval '15 minutes'
    RETURNING printcom_submission_lock_token INTO claimed_token;

    IF claimed_token IS NULL THEN
        RETURN jsonb_build_object('claimed', false, 'reason', 'concurrent_change');
    END IF;

    RETURN jsonb_build_object(
        'claimed', true,
        'lock_token', claimed_token,
        'payment_verification', p_payment_verification
    );
END;
$$;

REVOKE ALL ON FUNCTION public.pod2_claim_printcom_submission(uuid, text, text, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pod2_claim_printcom_submission(uuid, text, text, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pod2_claim_printcom_submission(uuid, text, text, uuid, text) TO service_role;
-- data-api: private pod2_claim_printcom_submission

CREATE OR REPLACE FUNCTION public.send_product_to_tenants(
    master_product_id uuid,
    tenant_ids uuid[],
    delivery_mode text DEFAULT 'price_list'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    master_id CONSTANT uuid := '00000000-0000-0000-0000-000000000000';
    product_record public.products%ROWTYPE;
    catalog_record public.pod2_catalog_products%ROWTYPE;
    catalog_id uuid;
    recipient uuid;
    normalized_mode text;
    normalized_recipients uuid[] := ARRAY[]::uuid[];
    copied_count int := 0;
    notified_count int := 0;
    skipped_count int := 0;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = 'master_admin'
    ) THEN
        RAISE EXCEPTION 'master_admin role required';
    END IF;

    SELECT *
    INTO product_record
    FROM public.products
    WHERE id = master_product_id
      AND tenant_id = master_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Master product not found';
    END IF;
    IF product_record.is_published IS NOT TRUE OR product_record.is_ready IS NOT TRUE THEN
        RAISE EXCEPTION 'Master product must be marked ready and published before distribution';
    END IF;
    IF NULLIF(btrim(product_record.name), '') IS NULL
       OR NULLIF(btrim(product_record.slug), '') IS NULL THEN
        RAISE EXCEPTION 'Master product must have a name and slug before distribution';
    END IF;

    normalized_mode := delivery_mode;
    IF normalized_mode NOT IN ('price_list', 'pod_price_list') THEN
        RAISE EXCEPTION 'Unsupported distribution mode';
    END IF;

    IF tenant_ids IS NULL OR cardinality(tenant_ids) = 0 THEN
        RETURN jsonb_build_object('sent', 0, 'copied', 0, 'notified', 0, 'skipped_existing', 0);
    END IF;
    IF cardinality(tenant_ids) > 100 THEN
        RAISE EXCEPTION 'At most 100 tenant shops can be selected';
    END IF;

    SELECT COALESCE(array_agg(DISTINCT candidate), ARRAY[]::uuid[])
    INTO normalized_recipients
    FROM unnest(tenant_ids) AS candidate
    WHERE candidate IS NOT NULL
      AND candidate <> master_id;

    IF cardinality(normalized_recipients) = 0 THEN
        RAISE EXCEPTION 'At least one non-master tenant shop is required';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM unnest(normalized_recipients) AS selected_tenant(id)
        LEFT JOIN public.tenants tenant ON tenant.id = selected_tenant.id
        WHERE tenant.id IS NULL
    ) THEN
        RAISE EXCEPTION 'One or more selected tenant shops do not exist';
    END IF;

    IF normalized_mode = 'pod_price_list' THEN
        IF product_record.is_published IS NOT TRUE THEN
            RAISE EXCEPTION 'POD product must be published before distribution';
        END IF;

        SELECT imported.catalog_product_id
        INTO catalog_id
        FROM public.pod2_tenant_imports imported
        WHERE imported.tenant_id = master_id
          AND imported.product_id = master_product_id
        ORDER BY imported.created_at DESC
        LIMIT 1;

        IF catalog_id IS NULL THEN
            RAISE EXCEPTION 'POD product is not linked to a master catalog import';
        END IF;

        SELECT *
        INTO catalog_record
        FROM public.pod2_catalog_products catalog
        WHERE catalog.id = catalog_id
          AND catalog.tenant_id = master_id;

        IF NOT FOUND OR catalog_record.status <> 'published' THEN
            RAISE EXCEPTION 'POD catalog product must be published before distribution';
        END IF;
        IF NULLIF(btrim(catalog_record.supplier_product_ref), '') IS NULL
           AND NULLIF(btrim(catalog_record.supplier_product_data->>'printcom_sku'), '') IS NULL THEN
            RAISE EXCEPTION 'POD catalog product is missing its supplier reference';
        END IF;
        IF COALESCE(
            NULLIF(btrim(catalog_record.public_title->>'da'), ''),
            NULLIF(btrim(catalog_record.public_title->>'en'), '')
        ) IS NULL THEN
            RAISE EXCEPTION 'POD catalog product is missing its public title';
        END IF;
        IF NULLIF(btrim(product_record.image_url), '') IS NULL
           AND NOT (
               jsonb_typeof(catalog_record.public_images) = 'array'
               AND jsonb_array_length(catalog_record.public_images) > 0
           ) THEN
            RAISE EXCEPTION 'POD product is missing its product image';
        END IF;
        IF NOT EXISTS (
            SELECT 1
            FROM public.pod2_supplier_connections connection
            WHERE connection.tenant_id = master_id
              AND connection.is_active IS TRUE
              AND regexp_replace(lower(connection.provider_key), '[^a-z0-9]', '', 'g') = 'printcom'
        ) THEN
            RAISE EXCEPTION 'An active Print.com connection is required';
        END IF;
        IF NOT EXISTS (
            SELECT 1
            FROM public.pod2_catalog_price_matrix matrix
            WHERE matrix.catalog_product_id = catalog_id
              AND matrix.tenant_id = master_id
        ) OR EXISTS (
            SELECT 1
            FROM public.pod2_catalog_price_matrix matrix
            WHERE matrix.catalog_product_id = catalog_id
              AND matrix.tenant_id = master_id
              AND (
                  matrix.needs_quote IS DISTINCT FROM FALSE
                  OR COALESCE(upper(btrim(matrix.currency)), '') !~ '^[A-Z]{3}$'
                  OR COALESCE(cardinality(matrix.quantities), 0) = 0
                  OR cardinality(matrix.base_costs) IS DISTINCT FROM cardinality(matrix.quantities)
                  OR cardinality(matrix.recommended_retail) IS DISTINCT FROM cardinality(matrix.quantities)
                  OR EXISTS (
                  SELECT 1
                  FROM unnest(
                      matrix.quantities,
                      matrix.base_costs,
                      matrix.recommended_retail
                  ) AS price_pair(quantity, cost, retail)
                  WHERE price_pair.quantity IS NULL
                     OR price_pair.quantity <= 0
                     OR price_pair.cost IS NULL
                     OR price_pair.retail IS NULL
                     OR price_pair.cost <= 0
                     OR price_pair.retail <= 0
                     OR price_pair.retail < price_pair.cost
                  )
              )
        ) THEN
            RAISE EXCEPTION 'Every POD price matrix row must be complete and fixed-price';
        END IF;
        IF EXISTS (
            SELECT 1
            FROM unnest(normalized_recipients) AS selected_tenant(id)
            JOIN public.tenants tenant ON tenant.id = selected_tenant.id
            WHERE tenant.pod2_auto_forward IS NOT TRUE
        ) THEN
            RAISE EXCEPTION 'One or more selected tenant shops are not enabled for controlled POD forwarding';
        END IF;
    END IF;

    FOREACH recipient IN ARRAY normalized_recipients LOOP
        IF normalized_mode = 'price_list' THEN
            DELETE FROM public.tenant_notifications
            WHERE tenant_id = recipient
              AND type = 'product_update'
              AND COALESCE(data->>'delivery_mode', 'price_list') = 'price_list'
              AND data->>'slug' = product_record.slug;

            PERFORM public.clone_product_for_tenant_release(master_product_id, recipient);
            copied_count := copied_count + 1;
        ELSE
            IF EXISTS (
                SELECT 1
                FROM public.tenant_notifications notification
                WHERE notification.tenant_id = recipient
                  AND notification.type = 'product_update'
                  AND notification.status = 'pending'
                  AND notification.data @> jsonb_build_object(
                      'product_id', product_record.id,
                      'delivery_mode', 'pod_price_list'
                  )
            ) THEN
                skipped_count := skipped_count + 1;
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
            notified_count := notified_count + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'sent', copied_count + notified_count,
        'copied', copied_count,
        'notified', notified_count,
        'skipped_existing', skipped_count,
        'delivery_mode', normalized_mode
    );
END;
$$;

REVOKE ALL ON FUNCTION public.send_product_to_tenants(uuid, uuid[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_product_to_tenants(uuid, uuid[], text) FROM anon;
GRANT EXECUTE ON FUNCTION public.send_product_to_tenants(uuid, uuid[], text) TO authenticated, service_role;
