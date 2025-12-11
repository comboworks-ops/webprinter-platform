-- Add tenant_id to page_seo logic
CREATE TABLE IF NOT EXISTS public.page_seo (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    slug text NOT NULL,
    title text,
    meta_description text,
    og_image_url text,
    tenant_id uuid REFERENCES public.tenants(id)
);

-- Ensure tenant_id exists if table already existed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'page_seo' AND column_name = 'tenant_id'
    ) THEN
        ALTER TABLE public.page_seo ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.page_seo ENABLE ROW LEVEL SECURITY;

-- Policy: Tenants view own SEO
CREATE POLICY "Tenants view own SEO" ON public.page_seo
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IS NULL -- Global defaults (optional, if we use them)
        OR
        public.can_access_tenant(tenant_id)
    );

CREATE POLICY "Tenants edit own SEO" ON public.page_seo
    FOR ALL
    TO authenticated
    USING (public.can_access_tenant(tenant_id));

-- Unique constraint on tenant_id + slug to prevent dupes
ALTER TABLE public.page_seo DROP CONSTRAINT IF EXISTS page_seo_slug_key; -- Drop old global unique if exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_page_seo_tenant_slug ON public.page_seo(tenant_id, slug);
