-- Icon Studio phase 1
-- Premium, isolated admin module for deterministic print-product icon generation.
-- Rollback:
-- 1. Remove /admin/icon-studio route and module id from the frontend.
-- 2. Drop storage policies + bucket `icon-studio`.
-- 3. Drop tables:
--      public.icon_studio_job_outputs
--      public.icon_studio_jobs
--      public.icon_studio_brand_assets
--      public.icon_studio_reference_assets
-- 4. Drop helper functions:
--      public.can_use_icon_studio(uuid)
--      public.can_use_icon_studio_storage_path(text)
--      public.set_icon_studio_updated_at()

CREATE OR REPLACE FUNCTION public.can_use_icon_studio(_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF _tenant_id IS NULL THEN
        RETURN false;
    END IF;

    IF public.has_role(auth.uid(), 'master_admin') THEN
        RETURN true;
    END IF;

    IF NOT public.can_access_tenant(_tenant_id) THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.tenant_module_access tma
        WHERE tma.tenant_id = _tenant_id
          AND tma.module_id = 'icon-studio'
          AND tma.has_access = true
          AND tma.is_enabled = true
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_use_icon_studio_storage_path(_object_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
    folders text[];
    tenant_text text;
BEGIN
    folders := storage.foldername(_object_name);

    IF folders[1] IS DISTINCT FROM 'tenant' THEN
        RETURN false;
    END IF;

    tenant_text := folders[2];
    IF tenant_text IS NULL THEN
        RETURN false;
    END IF;

    BEGIN
        RETURN public.can_use_icon_studio(tenant_text::uuid);
    EXCEPTION
        WHEN others THEN
            RETURN false;
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_icon_studio_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.icon_studio_reference_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    product_key text NOT NULL,
    style_key text NULL,
    variant_key text NULL,
    finish_key text NULL,
    usage_tags text[] NOT NULL DEFAULT '{}'::text[],
    priority integer NOT NULL DEFAULT 0,
    storage_path text NOT NULL,
    file_name text NOT NULL,
    mime_type text NULL,
    file_size_bytes bigint NULL,
    is_active boolean NOT NULL DEFAULT true,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by uuid NULL REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.icon_studio_brand_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    asset_role text NOT NULL DEFAULT 'logo',
    storage_path text NOT NULL,
    file_name text NOT NULL,
    mime_type text NULL,
    file_size_bytes bigint NULL,
    is_default boolean NOT NULL DEFAULT false,
    created_by uuid NULL REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT icon_studio_brand_assets_role_check CHECK (asset_role IN ('logo', 'symbol', 'seal', 'mark'))
);

CREATE TABLE IF NOT EXISTS public.icon_studio_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    job_name text NULL,
    product_key text NOT NULL,
    style_key text NOT NULL,
    variant_key text NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    provider_key text NOT NULL DEFAULT 'mock-icon-studio-v1',
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    resolved_reference_asset_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
    selected_brand_asset_id uuid NULL REFERENCES public.icon_studio_brand_assets(id) ON DELETE SET NULL,
    approved_output_id uuid NULL,
    error_message text NULL,
    created_by uuid NULL REFERENCES auth.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT icon_studio_jobs_status_check CHECK (status IN ('draft', 'processing', 'ready_for_review', 'approved', 'failed'))
);

CREATE TABLE IF NOT EXISTS public.icon_studio_job_outputs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    job_id uuid NOT NULL REFERENCES public.icon_studio_jobs(id) ON DELETE CASCADE,
    label text NOT NULL,
    kind text NOT NULL DEFAULT 'draft',
    status text NOT NULL DEFAULT 'active',
    storage_path text NOT NULL,
    mime_type text NULL,
    width_px integer NULL,
    height_px integer NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT icon_studio_job_outputs_kind_check CHECK (kind IN ('draft', 'final')),
    CONSTRAINT icon_studio_job_outputs_status_check CHECK (status IN ('active', 'approved', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_icon_studio_reference_assets_tenant
    ON public.icon_studio_reference_assets(tenant_id, product_key, priority DESC);

CREATE INDEX IF NOT EXISTS idx_icon_studio_brand_assets_tenant
    ON public.icon_studio_brand_assets(tenant_id, is_default DESC);

CREATE INDEX IF NOT EXISTS idx_icon_studio_jobs_tenant
    ON public.icon_studio_jobs(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_icon_studio_job_outputs_job
    ON public.icon_studio_job_outputs(job_id, created_at DESC);

ALTER TABLE public.icon_studio_reference_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icon_studio_brand_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icon_studio_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icon_studio_job_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Icon Studio reference assets access" ON public.icon_studio_reference_assets;
CREATE POLICY "Icon Studio reference assets access"
    ON public.icon_studio_reference_assets
    FOR ALL
    USING (public.can_use_icon_studio(tenant_id))
    WITH CHECK (public.can_use_icon_studio(tenant_id));

DROP POLICY IF EXISTS "Icon Studio brand assets access" ON public.icon_studio_brand_assets;
CREATE POLICY "Icon Studio brand assets access"
    ON public.icon_studio_brand_assets
    FOR ALL
    USING (public.can_use_icon_studio(tenant_id))
    WITH CHECK (public.can_use_icon_studio(tenant_id));

DROP POLICY IF EXISTS "Icon Studio jobs access" ON public.icon_studio_jobs;
CREATE POLICY "Icon Studio jobs access"
    ON public.icon_studio_jobs
    FOR ALL
    USING (public.can_use_icon_studio(tenant_id))
    WITH CHECK (public.can_use_icon_studio(tenant_id));

DROP POLICY IF EXISTS "Icon Studio job outputs access" ON public.icon_studio_job_outputs;
CREATE POLICY "Icon Studio job outputs access"
    ON public.icon_studio_job_outputs
    FOR ALL
    USING (public.can_use_icon_studio(tenant_id))
    WITH CHECK (public.can_use_icon_studio(tenant_id));

DROP TRIGGER IF EXISTS trigger_icon_studio_reference_assets_updated_at ON public.icon_studio_reference_assets;
CREATE TRIGGER trigger_icon_studio_reference_assets_updated_at
    BEFORE UPDATE ON public.icon_studio_reference_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.set_icon_studio_updated_at();

DROP TRIGGER IF EXISTS trigger_icon_studio_brand_assets_updated_at ON public.icon_studio_brand_assets;
CREATE TRIGGER trigger_icon_studio_brand_assets_updated_at
    BEFORE UPDATE ON public.icon_studio_brand_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.set_icon_studio_updated_at();

DROP TRIGGER IF EXISTS trigger_icon_studio_jobs_updated_at ON public.icon_studio_jobs;
CREATE TRIGGER trigger_icon_studio_jobs_updated_at
    BEFORE UPDATE ON public.icon_studio_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.set_icon_studio_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.icon_studio_reference_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icon_studio_brand_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icon_studio_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.icon_studio_job_outputs TO authenticated;
GRANT ALL ON public.icon_studio_reference_assets TO service_role;
GRANT ALL ON public.icon_studio_brand_assets TO service_role;
GRANT ALL ON public.icon_studio_jobs TO service_role;
GRANT ALL ON public.icon_studio_job_outputs TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'icon-studio',
    'icon-studio',
    false,
    10485760,
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Icon Studio objects select" ON storage.objects;
CREATE POLICY "Icon Studio objects select"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'icon-studio'
        AND public.can_use_icon_studio_storage_path(name)
    );

DROP POLICY IF EXISTS "Icon Studio objects insert" ON storage.objects;
CREATE POLICY "Icon Studio objects insert"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'icon-studio'
        AND public.can_use_icon_studio_storage_path(name)
    );

DROP POLICY IF EXISTS "Icon Studio objects update" ON storage.objects;
CREATE POLICY "Icon Studio objects update"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'icon-studio'
        AND public.can_use_icon_studio_storage_path(name)
    )
    WITH CHECK (
        bucket_id = 'icon-studio'
        AND public.can_use_icon_studio_storage_path(name)
    );

DROP POLICY IF EXISTS "Icon Studio objects delete" ON storage.objects;
CREATE POLICY "Icon Studio objects delete"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'icon-studio'
        AND public.can_use_icon_studio_storage_path(name)
    );

COMMENT ON TABLE public.icon_studio_reference_assets IS 'Tenant-scoped Icon Studio reference assets used for deterministic matching.';
COMMENT ON TABLE public.icon_studio_brand_assets IS 'Tenant-scoped brand marks and logos used as deterministic overlays in Icon Studio.';
COMMENT ON TABLE public.icon_studio_jobs IS 'Icon Studio generation jobs with strict JSON payload snapshots.';
COMMENT ON TABLE public.icon_studio_job_outputs IS 'Draft and final outputs belonging to Icon Studio jobs.';
