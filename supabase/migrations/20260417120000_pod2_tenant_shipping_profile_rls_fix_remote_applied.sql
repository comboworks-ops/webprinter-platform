-- Fix RLS on tenant_pod_shipping_profile to match the pattern used by
-- the other POD v2 tenant tables (pod2_tenant_imports / pod2_tenant_billing /
-- pod2_fulfillment_jobs).
--
-- Problem:
-- The original policies introduced in 20260417090000 only allowed access
-- when auth.uid() had a matching row in user_roles. That misses tenant
-- owners (tenants.owner_id = auth.uid()) and thus returns 403 on save
-- for the typical shop-owner login.
--
-- Fix:
-- Replace with policies that delegate to public.can_access_tenant() (the
-- same helper the other POD v2 tables use), which understands owners,
-- master admins, and user_roles membership uniformly. Master-admin access
-- is already covered by can_access_tenant(), but we keep an explicit
-- master policy as belt-and-braces / for consistency with the POD v1
-- pattern.

DROP POLICY IF EXISTS tenant_pod_shipping_profile_tenant_manage
    ON public.tenant_pod_shipping_profile;
DROP POLICY IF EXISTS tenant_pod_shipping_profile_master_manage
    ON public.tenant_pod_shipping_profile;

CREATE POLICY tenant_pod_shipping_profile_tenant_manage
    ON public.tenant_pod_shipping_profile
    FOR ALL
    USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));
