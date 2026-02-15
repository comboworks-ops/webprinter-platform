-- Tenant module access and visibility settings

CREATE TABLE IF NOT EXISTS public.tenant_module_access (
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    module_id text NOT NULL,
    has_access boolean NOT NULL DEFAULT false,
    is_enabled boolean NOT NULL DEFAULT false,
    access_source text NOT NULL DEFAULT 'manual', -- included | gifted | purchased | manual
    granted_by uuid NULL,
    notes text NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, module_id),
    CONSTRAINT tenant_module_access_source_check CHECK (access_source IN ('included', 'gifted', 'purchased', 'manual'))
);

CREATE INDEX IF NOT EXISTS idx_tenant_module_access_tenant ON public.tenant_module_access(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_module_access_module ON public.tenant_module_access(module_id);

ALTER TABLE public.tenant_module_access ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_tenant_module_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tenant_module_access_updated_at ON public.tenant_module_access;
CREATE TRIGGER trigger_tenant_module_access_updated_at
    BEFORE UPDATE ON public.tenant_module_access
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tenant_module_access_updated_at();

DROP POLICY IF EXISTS "Select tenant module access" ON public.tenant_module_access;
CREATE POLICY "Select tenant module access" ON public.tenant_module_access
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role::text = 'master_admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role::text IN ('admin', 'staff')
              AND ur.tenant_id = tenant_module_access.tenant_id
        )
        OR EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_module_access.tenant_id
              AND t.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Insert tenant module access" ON public.tenant_module_access;
CREATE POLICY "Insert tenant module access" ON public.tenant_module_access
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role::text = 'master_admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role::text IN ('admin', 'staff')
              AND ur.tenant_id = tenant_module_access.tenant_id
        )
        OR EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_module_access.tenant_id
              AND t.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Update tenant module access" ON public.tenant_module_access;
CREATE POLICY "Update tenant module access" ON public.tenant_module_access
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role::text = 'master_admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role::text IN ('admin', 'staff')
              AND ur.tenant_id = tenant_module_access.tenant_id
        )
        OR EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_module_access.tenant_id
              AND t.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role::text = 'master_admin'
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role::text IN ('admin', 'staff')
              AND ur.tenant_id = tenant_module_access.tenant_id
        )
        OR EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_module_access.tenant_id
              AND t.owner_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, UPDATE ON public.tenant_module_access TO authenticated;
GRANT ALL ON public.tenant_module_access TO service_role;
