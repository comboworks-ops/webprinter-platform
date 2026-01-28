-- Expand can_access_tenant to allow master_admin role to access master tenant
CREATE OR REPLACE FUNCTION public.can_access_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Owner access
    IF EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id AND owner_id = auth.uid()) THEN
        RETURN true;
    END IF;

    -- Master Admin access (accept both admin and master_admin roles)
    IF _tenant_id = '00000000-0000-0000-0000-000000000000'
       AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'master_admin')) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;
