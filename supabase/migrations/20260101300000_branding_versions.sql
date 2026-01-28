-- Branding Versions Table for Draft/Publish System
-- Stores snapshots of branding configurations for version history and restore

CREATE TABLE IF NOT EXISTS public.branding_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    data jsonb NOT NULL,
    label text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    type text DEFAULT 'snapshot' CHECK (type IN ('snapshot', 'auto_save'))
);

-- Index for fast tenant lookups
CREATE INDEX IF NOT EXISTS idx_branding_versions_tenant_id ON public.branding_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branding_versions_created_at ON public.branding_versions(created_at DESC);

-- Enable RLS
ALTER TABLE public.branding_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Tenant owners can view their own versions
CREATE POLICY "Tenant owners can view branding versions"
ON public.branding_versions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = branding_versions.tenant_id
        AND t.owner_id = auth.uid()
    )
);

-- Tenant owners can insert versions
CREATE POLICY "Tenant owners can create branding versions"
ON public.branding_versions FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = branding_versions.tenant_id
        AND t.owner_id = auth.uid()
    )
);

-- Tenant owners can delete their own versions (for cleanup)
CREATE POLICY "Tenant owners can delete branding versions"
ON public.branding_versions FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = branding_versions.tenant_id
        AND t.owner_id = auth.uid()
    )
);

-- Master admin can manage all versions
CREATE POLICY "Master admin can manage all branding versions"
ON public.branding_versions FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'master_admin'
    )
);

-- Comment for documentation
COMMENT ON TABLE public.branding_versions IS 'Stores snapshots of tenant branding configurations for version history and restore functionality';
COMMENT ON COLUMN public.branding_versions.data IS 'Complete branding configuration JSON at the time of snapshot';
COMMENT ON COLUMN public.branding_versions.label IS 'Optional user-provided label for the version (e.g., "Summer Campaign")';
COMMENT ON COLUMN public.branding_versions.type IS 'snapshot = manual publish, auto_save = automatic backup';
