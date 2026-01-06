-- Platform SEO Tables Migration
-- Only for master-admin controlled platform pages (webprinter.dk / www.webprinter.dk)
-- NOT for tenant shops or demo shop

-- A) platform_seo_settings: Global SEO settings for the platform
CREATE TABLE IF NOT EXISTS public.platform_seo_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    primary_domain text NOT NULL DEFAULT 'webprinter.dk',
    alternate_domains text[] DEFAULT ARRAY['www.webprinter.dk']::text[],
    canonical_base_url text NOT NULL DEFAULT 'https://webprinter.dk',
    default_title_template text DEFAULT '{pageTitle} | Webprinter Platform',
    default_description text DEFAULT 'Webprinter Platform - Den komplette løsning til moderne trykkerier.',
    default_robots text DEFAULT 'index,follow',
    default_og_image_url text,
    organization_jsonld jsonb,
    website_jsonld jsonb,
    locales jsonb NOT NULL DEFAULT '[
        {"locale":"da-DK","lang":"da","isDefault":true,"pathPrefix":""},
        {"locale":"en","lang":"en","isDefault":false,"pathPrefix":"/en"}
    ]'::jsonb,
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_platform_seo_settings_tenant UNIQUE (tenant_id)
);

-- B) platform_seo_pages: Per-page SEO overrides
CREATE TABLE IF NOT EXISTS public.platform_seo_pages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    path text NOT NULL,
    locale text,
    title text,
    description text,
    robots text,
    canonical_url text,
    og_title text,
    og_description text,
    og_image_url text,
    jsonld jsonb,
    lastmod timestamptz,
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_platform_seo_page UNIQUE (tenant_id, path, locale)
);

-- C) platform_seo_pagespeed_snapshots: PageSpeed Insights results
CREATE TABLE IF NOT EXISTS public.platform_seo_pagespeed_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    url text NOT NULL,
    strategy text NOT NULL CHECK (strategy IN ('mobile', 'desktop')),
    lighthouse jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- D) platform_seo_google_integrations: OAuth tokens for Search Console (MVP)
CREATE TABLE IF NOT EXISTS public.platform_seo_google_integrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    refresh_token text,
    connected_at timestamptz,
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT unique_platform_seo_google_integration UNIQUE (tenant_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_platform_seo_pages_path ON public.platform_seo_pages(path);
CREATE INDEX IF NOT EXISTS idx_platform_seo_pages_tenant ON public.platform_seo_pages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_seo_pagespeed_url ON public.platform_seo_pagespeed_snapshots(url, strategy);

-- Enable RLS
ALTER TABLE public.platform_seo_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_seo_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_seo_pagespeed_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_seo_google_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only master_admin can access these tables
-- Note: master_admin is determined by checking user_roles table

-- platform_seo_settings policies
CREATE POLICY "master_admin_select_platform_seo_settings" ON public.platform_seo_settings
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'master_admin'
        )
    );

CREATE POLICY "master_admin_insert_platform_seo_settings" ON public.platform_seo_settings
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'master_admin'
        )
    );

CREATE POLICY "master_admin_update_platform_seo_settings" ON public.platform_seo_settings
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'master_admin'
        )
    );

CREATE POLICY "master_admin_delete_platform_seo_settings" ON public.platform_seo_settings
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'master_admin'
        )
    );

-- platform_seo_pages policies
CREATE POLICY "master_admin_select_platform_seo_pages" ON public.platform_seo_pages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'master_admin'
        )
    );

CREATE POLICY "master_admin_insert_platform_seo_pages" ON public.platform_seo_pages
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'master_admin'
        )
    );

CREATE POLICY "master_admin_update_platform_seo_pages" ON public.platform_seo_pages
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'master_admin'
        )
    );

CREATE POLICY "master_admin_delete_platform_seo_pages" ON public.platform_seo_pages
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'master_admin'
        )
    );

-- platform_seo_pagespeed_snapshots policies
CREATE POLICY "master_admin_select_platform_seo_pagespeed" ON public.platform_seo_pagespeed_snapshots
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'master_admin'
        )
    );

CREATE POLICY "master_admin_insert_platform_seo_pagespeed" ON public.platform_seo_pagespeed_snapshots
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'master_admin'
        )
    );

-- platform_seo_google_integrations policies
CREATE POLICY "master_admin_select_platform_seo_google" ON public.platform_seo_google_integrations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'master_admin'
        )
    );

CREATE POLICY "master_admin_insert_platform_seo_google" ON public.platform_seo_google_integrations
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'master_admin'
        )
    );

CREATE POLICY "master_admin_update_platform_seo_google" ON public.platform_seo_google_integrations
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'master_admin'
        )
    );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_platform_seo_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_seo_settings_updated_at
    BEFORE UPDATE ON public.platform_seo_settings
    FOR EACH ROW EXECUTE FUNCTION update_platform_seo_updated_at();

CREATE TRIGGER platform_seo_pages_updated_at
    BEFORE UPDATE ON public.platform_seo_pages
    FOR EACH ROW EXECUTE FUNCTION update_platform_seo_updated_at();
