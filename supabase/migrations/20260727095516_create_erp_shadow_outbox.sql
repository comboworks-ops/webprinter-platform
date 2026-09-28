-- Private, service-role-only ERPNext shadow outbox.
--
-- This migration does not attach triggers to orders, checkout, pricing, POD,
-- inventory, or accounting. Rows can be created only by protected server code.
-- Both inventory and accounting posting are constrained to "disabled".
--
-- Rollback:
--   1. Disable and undeploy the erp-shadow-dispatch Edge Function.
--   2. Revoke/rotate ERP_SHADOW_GATEWAY_URL and ERP_SHADOW_HMAC_SECRET.
--   3. Drop public.erp_shadow_claim_outbox(uuid).
--   4. Drop public.erp_shadow_outbox after exporting any audit rows that must
--      be retained.

CREATE TABLE public.erp_shadow_outbox (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    source_order_id text NOT NULL,
    source_revision integer NOT NULL DEFAULT 0,
    schema_version text NOT NULL DEFAULT '1.0',
    event_type text NOT NULL
        DEFAULT 'webprinter.production_order.shadow_requested',
    idempotency_key text NOT NULL,
    event_payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    attempt_count integer NOT NULL DEFAULT 0,
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    last_attempt_at timestamptz,
    dispatched_at timestamptz,
    lock_token uuid,
    locked_at timestamptz,
    last_http_status smallint,
    last_error_code text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT erp_shadow_outbox_source_order_nonempty
        CHECK (btrim(source_order_id) <> ''),
    CONSTRAINT erp_shadow_outbox_revision_valid
        CHECK (source_revision >= 0),
    CONSTRAINT erp_shadow_outbox_schema_v1
        CHECK (schema_version = '1.0'),
    CONSTRAINT erp_shadow_outbox_event_type_v1
        CHECK (
            event_type = 'webprinter.production_order.shadow_requested'
        ),
    CONSTRAINT erp_shadow_outbox_idempotency_nonempty
        CHECK (
            btrim(idempotency_key) <> ''
            AND length(idempotency_key) <= 200
        ),
    CONSTRAINT erp_shadow_outbox_status_valid
        CHECK (
            status IN (
                'pending',
                'dispatching',
                'retry',
                'dispatched',
                'dead_letter',
                'cancelled'
            )
        ),
    CONSTRAINT erp_shadow_outbox_attempt_count_valid
        CHECK (attempt_count >= 0 AND attempt_count <= 20),
    CONSTRAINT erp_shadow_outbox_http_status_valid
        CHECK (
            last_http_status IS NULL
            OR last_http_status BETWEEN 100 AND 599
        ),
    CONSTRAINT erp_shadow_outbox_error_code_bounded
        CHECK (
            last_error_code IS NULL
            OR length(last_error_code) <= 100
        ),
    CONSTRAINT erp_shadow_outbox_payload_object
        CHECK (
            jsonb_typeof(event_payload) = 'object'
            AND octet_length(event_payload::text) <= 262144
        ),
    CONSTRAINT erp_shadow_outbox_effect_disabled
        CHECK (event_payload->>'effect' = 'shadow_only'),
    CONSTRAINT erp_shadow_outbox_inventory_disabled
        CHECK (
            event_payload#>>'{payload,production,inventoryPosting}' = 'disabled'
        ),
    CONSTRAINT erp_shadow_outbox_accounting_disabled
        CHECK (
            event_payload#>>'{payload,accounting,posting}' = 'disabled'
        ),
    CONSTRAINT erp_shadow_outbox_no_sensitive_keys
        CHECK (
            event_payload::text !~* '"(email|emailAddress|customerEmail|customerName|address|postalAddress|billingAddress|shippingAddress|phone|telephone|mobile|cardNumber|paymentDetails|password|credential|secret|token)"[[:space:]]*:'
        ),
    CONSTRAINT erp_shadow_outbox_idempotency_unique
        UNIQUE (idempotency_key)
);

CREATE INDEX idx_erp_shadow_outbox_dispatch
    ON public.erp_shadow_outbox (status, next_attempt_at, created_at)
    WHERE status IN ('pending', 'retry');

CREATE INDEX idx_erp_shadow_outbox_tenant_order
    ON public.erp_shadow_outbox (
        tenant_id,
        source_order_id,
        source_revision DESC
    );

ALTER TABLE public.erp_shadow_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_shadow_outbox FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.erp_shadow_outbox FROM PUBLIC;
REVOKE ALL ON TABLE public.erp_shadow_outbox FROM anon, authenticated;
GRANT ALL ON TABLE public.erp_shadow_outbox TO service_role;
-- data-api: private erp_shadow_outbox

COMMENT ON TABLE public.erp_shadow_outbox IS
    'Private, service-role-only ERPNext shadow events. No live posting.';

CREATE OR REPLACE FUNCTION public.erp_shadow_claim_outbox(p_id uuid)
RETURNS SETOF public.erp_shadow_outbox
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    UPDATE public.erp_shadow_outbox
    SET status = 'dispatching',
        attempt_count = attempt_count + 1,
        last_attempt_at = now(),
        lock_token = gen_random_uuid(),
        locked_at = now(),
        last_error_code = NULL,
        updated_at = now()
    WHERE id = p_id
      AND (
          (
              status IN ('pending', 'retry')
              AND next_attempt_at <= now()
          )
          OR (
              status = 'dispatching'
              AND locked_at < now() - interval '15 minutes'
          )
      )
      AND attempt_count < 5
    RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.erp_shadow_claim_outbox(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.erp_shadow_claim_outbox(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erp_shadow_claim_outbox(uuid) TO service_role;
-- data-api: private erp_shadow_claim_outbox
