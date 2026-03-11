-- Additive POD v2 fulfillment workflow metadata.
-- Supports tenant-paid -> master-forwarded POD jobs without touching POD v1.
--
-- Rollback:
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS product_id;
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS product_name;
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS customer_email;
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS recipient_name;
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS recipient_company;
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS delivery_summary;
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS shipping_method;
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS sender_mode;
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS sender_name;
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS approved_by_tenant_at;
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS approved_by_tenant_user_id;
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS submitted_by_master_at;
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS submitted_by_master_user_id;
--   ALTER TABLE public.pod2_fulfillment_jobs DROP COLUMN IF EXISTS master_notes;

ALTER TABLE public.pod2_fulfillment_jobs
ADD COLUMN IF NOT EXISTS product_id uuid,
ADD COLUMN IF NOT EXISTS product_name text,
ADD COLUMN IF NOT EXISTS customer_email text,
ADD COLUMN IF NOT EXISTS recipient_name text,
ADD COLUMN IF NOT EXISTS recipient_company text,
ADD COLUMN IF NOT EXISTS delivery_summary text,
ADD COLUMN IF NOT EXISTS shipping_method text,
ADD COLUMN IF NOT EXISTS sender_mode text NOT NULL DEFAULT 'standard' CHECK (sender_mode IN ('standard', 'blind', 'custom')),
ADD COLUMN IF NOT EXISTS sender_name text,
ADD COLUMN IF NOT EXISTS approved_by_tenant_at timestamptz,
ADD COLUMN IF NOT EXISTS approved_by_tenant_user_id uuid,
ADD COLUMN IF NOT EXISTS submitted_by_master_at timestamptz,
ADD COLUMN IF NOT EXISTS submitted_by_master_user_id uuid,
ADD COLUMN IF NOT EXISTS master_notes text;

CREATE INDEX IF NOT EXISTS idx_pod2_jobs_status_created ON public.pod2_fulfillment_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pod2_jobs_product_id ON public.pod2_fulfillment_jobs(product_id);
