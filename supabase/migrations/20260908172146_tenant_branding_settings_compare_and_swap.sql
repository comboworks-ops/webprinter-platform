-- Branding settings use JSON bodies instead of placing a full settings snapshot
-- (including up to 20 archived designs) into the PostgREST request URL.
-- SECURITY INVOKER retains the caller's existing tenants UPDATE/SELECT RLS.
CREATE OR REPLACE FUNCTION public.tenant_branding_settings_compare_and_swap(
    p_tenant_id uuid,
    p_expected_settings jsonb,
    p_branding_patch jsonb
)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;
    IF p_branding_patch IS NULL OR jsonb_typeof(p_branding_patch) <> 'object' THEN
        RAISE EXCEPTION 'Branding patch must be an object' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_object_keys(p_branding_patch) AS field(name)
        WHERE name NOT IN ('branding', 'branding_template_draft', 'branding_template_published',
            'branding_template_history', 'branding_template_savedDesigns')
    ) THEN
        RAISE EXCEPTION 'Only branding settings may be changed' USING ERRCODE = '22023';
    END IF;

    RETURN QUERY
        UPDATE public.tenants AS tenant
        SET settings = COALESCE(tenant.settings, '{}'::jsonb) || p_branding_patch
        WHERE tenant.id = p_tenant_id
            AND tenant.settings IS NOT DISTINCT FROM p_expected_settings
        RETURNING tenant.id;
END;
$$;

REVOKE ALL ON FUNCTION public.tenant_branding_settings_compare_and_swap(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_branding_settings_compare_and_swap(uuid, jsonb, jsonb) TO authenticated;

-- Rollback after rolling back the matching frontend adapters:
-- DROP FUNCTION public.tenant_branding_settings_compare_and_swap(uuid, jsonb, jsonb);
-- This migration changes no stored settings, table policies or pricing data.
