ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_available_to_tenants BOOLEAN DEFAULT false;

CREATE OR REPLACE FUNCTION public.sync_missing_products(target_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    master_id uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    -- Verify the tenant exists (basic check)
    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = target_tenant_id) THEN
        RAISE EXCEPTION 'Tenant not found';
    END IF;

    -- Insert products that exist in master but NOT in the target tenant
    -- AND are marked as available to tenants
    INSERT INTO public.products (
        tenant_id, 
        name, 
        slug, 
        description, 
        category, 
        pricing_type, 
        image_url, 
        is_published, 
        created_at, 
        updated_at
    )
    SELECT 
        target_tenant_id, 
        m.name, 
        m.slug, 
        m.description, 
        m.category, 
        m.pricing_type, 
        m.image_url, 
        false, -- Set as draft (not published) in the tenant's shop initially
        now(), 
        now()
    FROM public.products m
    WHERE m.tenant_id = master_id
      AND m.is_available_to_tenants = true -- ONLY sync if available to tenants
      AND NOT EXISTS (
          SELECT 1 FROM public.products t 
          WHERE t.tenant_id = target_tenant_id 
          AND t.slug = m.slug
      );
      
    -- Note: We do NOT auto-copy prices here to avoid overwriting tenant customizations.
    -- Prices are usually copied only during initial setup (seed), or could be a separate 'reset to master' action.
END;
$$;
