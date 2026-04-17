-- POD v2 Print.com submission linkage.
-- Adds columns on pod2_fulfillment_jobs for storing Print.com IDs as the
-- submission adapter progresses through the steps (contact upsert → cart →
-- printjob upload → submit). This enables retry / resume on partial failure.
--
-- Also adds columns on tenant_pod_shipping_profile so we remember the
-- Print.com contact + logo we created for this tenant and reuse them
-- instead of creating a new contact every time.
--
-- Additive only. No breaking changes.
--
-- Rollback:
--   ALTER TABLE public.pod2_fulfillment_jobs
--     DROP COLUMN IF EXISTS printcom_cart_id,
--     DROP COLUMN IF EXISTS printcom_cart_item_id,
--     DROP COLUMN IF EXISTS printcom_printjob_id,
--     DROP COLUMN IF EXISTS printcom_design_id,
--     DROP COLUMN IF EXISTS printcom_order_id,
--     DROP COLUMN IF EXISTS printcom_order_raw,
--     DROP COLUMN IF EXISTS printcom_submission_step,
--     DROP COLUMN IF EXISTS printcom_last_error,
--     DROP COLUMN IF EXISTS printcom_last_attempt_at;
--   ALTER TABLE public.tenant_pod_shipping_profile
--     DROP COLUMN IF EXISTS printcom_sticky_slip_id;

-- ============================================
-- pod2_fulfillment_jobs: Print.com linkage
-- ============================================
ALTER TABLE public.pod2_fulfillment_jobs
    -- Print.com cart used for this job
    ADD COLUMN IF NOT EXISTS printcom_cart_id text,
    -- Specific item within that cart (Print.com returns it when we POST /carts/{id}/items)
    ADD COLUMN IF NOT EXISTS printcom_cart_item_id text,
    -- printjobId returned on the cart item (target for file uploads + finalize)
    ADD COLUMN IF NOT EXISTS printcom_printjob_id text,
    -- designId returned when we create the design on the printjob (needed for approve)
    ADD COLUMN IF NOT EXISTS printcom_design_id text,
    -- Final order reference after POST /carts/{id}/order succeeds
    ADD COLUMN IF NOT EXISTS printcom_order_id text,
    -- Raw response blob for audit + debugging
    ADD COLUMN IF NOT EXISTS printcom_order_raw jsonb,
    -- Last successful step ('contact' | 'logo' | 'cart' | 'sender' | 'files' | 'finalize' | 'submit')
    -- Null = no submission attempted yet. Useful for retry / resume.
    ADD COLUMN IF NOT EXISTS printcom_submission_step text,
    -- Error text from the last failed attempt
    ADD COLUMN IF NOT EXISTS printcom_last_error text,
    ADD COLUMN IF NOT EXISTS printcom_last_attempt_at timestamptz;

COMMENT ON COLUMN public.pod2_fulfillment_jobs.printcom_submission_step IS
    'Most recent successful step in the Print.com submission pipeline. Used by the adapter to skip already-done steps on retry.';

CREATE INDEX IF NOT EXISTS idx_pod2_jobs_printcom_order_id
    ON public.pod2_fulfillment_jobs(printcom_order_id)
    WHERE printcom_order_id IS NOT NULL;

-- ============================================
-- tenant_pod_shipping_profile: Print.com logo linkage
-- ============================================
-- stickySlipImageId tracked so we can re-attach an already-uploaded logo
-- to a contact without re-uploading from Supabase storage → S3 every time.
-- printcom_contact_id already exists from the earlier migration.
ALTER TABLE public.tenant_pod_shipping_profile
    ADD COLUMN IF NOT EXISTS printcom_sticky_slip_id text;

COMMENT ON COLUMN public.tenant_pod_shipping_profile.printcom_sticky_slip_id IS
    'Print.com stickySlipImageId from /stickyslip/retrieveUploadUrl. Reused to avoid re-uploading the logo on every submission.';
