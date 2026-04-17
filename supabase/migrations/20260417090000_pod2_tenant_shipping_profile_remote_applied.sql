-- POD v2 tenant shipping profile (white-label sender identity for POD packages).
--
-- Adds a per-tenant profile table describing how the tenant wants to appear
-- as sender on POD shipments (their own name/address/logo vs. blind shipping
-- vs. fall back to master/Webprinter). Also extends pod2_fulfillment_jobs
-- with a snapshot of the profile at job creation time so later changes to
-- the tenant profile never mutate historical jobs.
--
-- This migration is purely additive. It does not touch POD v1, the pricing
-- engine, or any other existing system. No existing POD v2 row behavior
-- changes until the tenant explicitly opts in via the new admin UI.
--
-- Rollback:
--   DROP INDEX IF EXISTS public.idx_pod2_jobs_sender_contact_id;
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS sender_contact_id;
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS sender_address_json;
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS sender_logo_url;
--   DROP TABLE IF EXISTS public.tenant_pod_shipping_profile;

-- ============================================
-- 1. Tenant POD shipping profile
-- ============================================
CREATE TABLE IF NOT EXISTS public.tenant_pod_shipping_profile (
    tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,

    -- Which sender identity should be used on POD shipments for this tenant.
    --   'standard' = use master / Webprinter sender (default, current behavior)
    --   'blind'    = neutral / no sender info printed (Print.com blind shipping)
    --   'custom'   = use the tenant_* fields below
    sender_mode text NOT NULL DEFAULT 'standard'
        CHECK (sender_mode IN ('standard', 'blind', 'custom')),

    -- Custom sender identity (used when sender_mode = 'custom').
    -- Fields mirror the shape Print.com's /contacts endpoint expects so we
    -- can map directly when the submission adapter is built later.
    sender_company_name text,
    sender_contact_name text,
    sender_email text,
    sender_phone text,
    sender_street text,          -- Print.com "fullstreet"
    sender_house_number text,    -- Print.com "houseNumber"
    sender_postcode text,
    sender_city text,
    sender_country text DEFAULT 'DK',
    sender_vat_number text,

    -- Print.com contact book linkage. Populated by the submission adapter
    -- when it creates or matches a contact on Print.com. Null until then.
    -- Stored as text because Print.com IDs are opaque strings (they happen
    -- to be UUID-shaped today, but we don't want to hard-depend on that).
    printcom_contact_id text,
    printcom_contact_synced_at timestamptz,

    -- Logo for packing slip / custom label. Points at a file in the
    -- tenant's storage (bucket + path resolved in app code). Null = no
    -- logo; falls back to "sender_mode standard" visuals.
    sender_logo_url text,
    sender_logo_updated_at timestamptz,

    -- Misc
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tenant_pod_shipping_profile IS
    'Per-tenant white-label sender identity for POD v2 shipments. Opt-in; tenants without a row fall back to standard master sender.';

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION public.tenant_pod_shipping_profile_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenant_pod_shipping_profile_touch
    ON public.tenant_pod_shipping_profile;
CREATE TRIGGER trg_tenant_pod_shipping_profile_touch
    BEFORE UPDATE ON public.tenant_pod_shipping_profile
    FOR EACH ROW
    EXECUTE FUNCTION public.tenant_pod_shipping_profile_touch_updated_at();

-- ============================================
-- 2. RLS
-- ============================================
ALTER TABLE public.tenant_pod_shipping_profile ENABLE ROW LEVEL SECURITY;

-- Tenant members can read + manage their own row.
DROP POLICY IF EXISTS tenant_pod_shipping_profile_tenant_manage
    ON public.tenant_pod_shipping_profile;
CREATE POLICY tenant_pod_shipping_profile_tenant_manage
    ON public.tenant_pod_shipping_profile
    FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid()
        )
    );

-- Master admins can read + manage any tenant's profile (needed for the
-- master forwarding queue in /admin/pod2-ordrer to render sender + logo).
DROP POLICY IF EXISTS tenant_pod_shipping_profile_master_manage
    ON public.tenant_pod_shipping_profile;
CREATE POLICY tenant_pod_shipping_profile_master_manage
    ON public.tenant_pod_shipping_profile
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'master_admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'master_admin'
        )
    );

-- ============================================
-- 3. Snapshot columns on pod2_fulfillment_jobs
-- ============================================
-- These freeze the tenant profile values onto the job at creation time.
-- This means:
--   - later edits to the profile don't retroactively change historical jobs
--   - the master forwarding queue can render sender + logo without a join
--   - the (future) submission adapter has everything it needs on one row
ALTER TABLE public.pod2_fulfillment_jobs
    ADD COLUMN IF NOT EXISTS sender_contact_id uuid,
    ADD COLUMN IF NOT EXISTS sender_address_json jsonb,
    ADD COLUMN IF NOT EXISTS sender_logo_url text;

COMMENT ON COLUMN public.pod2_fulfillment_jobs.sender_contact_id IS
    'Print.com contact UUID if a contact was used/created for this job (set by submission adapter, null until then).';
COMMENT ON COLUMN public.pod2_fulfillment_jobs.sender_address_json IS
    'Snapshot of the tenant_pod_shipping_profile fields at job creation time. Shape mirrors Print.com contact payload.';
COMMENT ON COLUMN public.pod2_fulfillment_jobs.sender_logo_url IS
    'Snapshot of tenant_pod_shipping_profile.sender_logo_url at job creation time.';

CREATE INDEX IF NOT EXISTS idx_pod2_jobs_sender_contact_id
    ON public.pod2_fulfillment_jobs(sender_contact_id)
    WHERE sender_contact_id IS NOT NULL;
