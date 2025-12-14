-- Ensure page_seo is accessible to admin/master_admin for the master tenant
CREATE OR REPLACE FUNCTION public.can_access_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id AND owner_id = auth.uid()) THEN
        RETURN true;
    END IF;

    IF _tenant_id = '00000000-0000-0000-0000-000000000000'
       AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master_admin')) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- Relax page_seo select for master tenant to allow admins
DROP POLICY IF EXISTS "Tenants view own SEO" ON public.page_seo;
CREATE POLICY "Tenants view own SEO" ON public.page_seo
    FOR SELECT
    USING (
        tenant_id IS NULL
        OR tenant_id = '00000000-0000-0000-0000-000000000000'
        OR public.can_access_tenant(tenant_id)
    );

-- Ensure edit policy remains restricted
DROP POLICY IF EXISTS "Tenants edit own SEO" ON public.page_seo;
CREATE POLICY "Tenants edit own SEO" ON public.page_seo
    FOR ALL
    TO authenticated
    USING (public.can_access_tenant(tenant_id));
