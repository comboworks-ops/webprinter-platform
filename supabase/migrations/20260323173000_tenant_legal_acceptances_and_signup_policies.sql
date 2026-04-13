-- Tenant legal acceptance records and self-service signup policies
-- Rollback:
--   DROP TABLE IF EXISTS public.tenant_legal_acceptances;
--   DROP POLICY IF EXISTS "Authenticated owners can create their tenant during signup" ON public.tenants;
--   DROP POLICY IF EXISTS "Authenticated owners can assign themselves tenant admin role during signup" ON public.user_roles;

CREATE TABLE IF NOT EXISTS public.tenant_legal_acceptances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    document_type text NOT NULL,
    document_version text NOT NULL,
    accepted_at timestamptz NOT NULL DEFAULT now(),
    accepted_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    accepted_email text NOT NULL,
    source text NOT NULL DEFAULT 'tenant_signup',
    ip_address text NULL,
    user_agent text NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT tenant_legal_acceptances_document_type_check
        CHECK (document_type IN ('platform_terms', 'privacy_policy')),
    CONSTRAINT tenant_legal_acceptances_unique_version
        UNIQUE (tenant_id, document_type, document_version)
);

CREATE INDEX IF NOT EXISTS idx_tenant_legal_acceptances_tenant_id
    ON public.tenant_legal_acceptances(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_legal_acceptances_user_id
    ON public.tenant_legal_acceptances(accepted_by_user_id);

ALTER TABLE public.tenant_legal_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Select tenant legal acceptances" ON public.tenant_legal_acceptances;
CREATE POLICY "Select tenant legal acceptances" ON public.tenant_legal_acceptances
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
              AND ur.tenant_id = tenant_legal_acceptances.tenant_id
        )
        OR EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_legal_acceptances.tenant_id
              AND t.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Insert own tenant legal acceptances" ON public.tenant_legal_acceptances;
CREATE POLICY "Insert own tenant legal acceptances" ON public.tenant_legal_acceptances
    FOR INSERT
    TO authenticated
    WITH CHECK (
        accepted_by_user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_legal_acceptances.tenant_id
              AND t.owner_id = auth.uid()
        )
    );

GRANT SELECT, INSERT ON public.tenant_legal_acceptances TO authenticated;
GRANT ALL ON public.tenant_legal_acceptances TO service_role;

DROP POLICY IF EXISTS "Authenticated owners can create their tenant during signup" ON public.tenants;
CREATE POLICY "Authenticated owners can create their tenant during signup" ON public.tenants
    FOR INSERT
    TO authenticated
    WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Authenticated owners can assign themselves tenant admin role during signup" ON public.user_roles;
CREATE POLICY "Authenticated owners can assign themselves tenant admin role during signup" ON public.user_roles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND role = 'admin'
        AND tenant_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = user_roles.tenant_id
              AND t.owner_id = auth.uid()
        )
    );
