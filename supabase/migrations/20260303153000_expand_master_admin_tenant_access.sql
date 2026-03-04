-- Expand tenant access helpers so master_admin can manage tenant-scoped data
-- across platform-owned shops.
--
-- Rollback note:
-- Revert both functions to the previous definitions if master_admin should
-- only operate on the master tenant again.

CREATE OR REPLACE FUNCTION public.can_access_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Owner can always access
    IF EXISTS (
        SELECT 1
        FROM public.tenants
        WHERE id = _tenant_id
          AND owner_id = auth.uid()
    ) THEN
        RETURN true;
    END IF;

    -- Master admin can access all tenants
    IF EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = 'master_admin'
    ) THEN
        RETURN true;
    END IF;

    -- Standard admin can access the master tenant
    IF _tenant_id = '00000000-0000-0000-0000-000000000000'
       AND EXISTS (
           SELECT 1
           FROM public.user_roles
           WHERE user_id = auth.uid()
             AND role = 'admin'
       ) THEN
        RETURN true;
    END IF;

    -- User assigned to tenant via user_roles
    IF EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND tenant_id = _tenant_id
    ) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_tenant_access(t_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Owner can always access
    IF EXISTS (
        SELECT 1
        FROM public.tenants
        WHERE id = t_id
          AND owner_id = auth.uid()
    ) THEN
        RETURN true;
    END IF;

    -- Master admin can access all tenants
    IF EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = 'master_admin'
    ) THEN
        RETURN true;
    END IF;

    -- Explicit tenant assignment
    IF EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND tenant_id = t_id
    ) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;
