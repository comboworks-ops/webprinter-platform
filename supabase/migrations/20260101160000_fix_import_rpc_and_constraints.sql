
-- 1. Fix Unique Constraint on Products (Allow same slug in different tenants)
DO $$
BEGIN
    ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_slug_key;
    
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_tenant_slug_key') THEN
        ALTER TABLE public.products ADD CONSTRAINT products_tenant_slug_key UNIQUE (tenant_id, slug);
    END IF;
END $$;

-- 2. Update RPC to set created_by correctly
CREATE OR REPLACE FUNCTION public.sync_specific_product(target_tenant_id uuid, product_slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    master_id uuid := '00000000-0000-0000-0000-000000000000';
    tenant_owner_id uuid;
BEGIN
    SELECT owner_id INTO tenant_owner_id FROM public.tenants WHERE id = target_tenant_id;

    INSERT INTO public.products (
        tenant_id, name, slug, description, category, pricing_type, image_url, is_published, created_at, updated_at, created_by, updated_by
    )
    SELECT 
        target_tenant_id, 
        m.name, 
        m.slug, 
        m.description, 
        m.category, 
        m.pricing_type, 
        m.image_url, 
        false, 
        now(), 
        now(),
        tenant_owner_id, 
        tenant_owner_id
    FROM public.products m
    WHERE m.tenant_id = master_id
      AND m.slug = product_slug
      AND NOT EXISTS (
          SELECT 1 FROM public.products t 
          WHERE t.tenant_id = target_tenant_id 
          AND t.slug = m.slug
      );
END;
$$;

