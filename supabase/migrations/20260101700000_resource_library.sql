-- Migration: Resource Library with Custom Categories
-- Creates resource_categories and updates master_assets for category-based organization

-- 1. Resource Categories Table
CREATE TABLE IF NOT EXISTS public.resource_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT DEFAULT 'folder',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default categories
INSERT INTO public.resource_categories (name, slug, description, icon, sort_order)
VALUES 
    ('Banners', 'banners', 'Hero baggrundsbilleder', 'image', 1),
    ('Icons', 'icons', 'Ikon billeder', 'sparkles', 2),
    ('Videos', 'videos', 'Baggrunds videoer', 'video', 3),
    ('Pictures', 'pictures', 'Generelle billeder', 'image', 4)
ON CONFLICT (slug) DO NOTHING;

-- RLS for categories
ALTER TABLE public.resource_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read categories" ON public.resource_categories;
CREATE POLICY "Anyone can read categories" ON public.resource_categories
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Master admins can manage categories" ON public.resource_categories;
CREATE POLICY "Master admins can manage categories" ON public.resource_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'master_admin'
        )
    );

GRANT SELECT ON public.resource_categories TO authenticated;
GRANT ALL ON public.resource_categories TO service_role;

-- 2. Master Assets Table (resources)
CREATE TABLE IF NOT EXISTS public.master_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.resource_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    tags TEXT[] DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    width_px INTEGER,
    height_px INTEGER,
    file_size_bytes BIGINT,
    mime_type TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_master_assets_category ON public.master_assets(category_id);
CREATE INDEX IF NOT EXISTS idx_master_assets_published ON public.master_assets(is_published);
CREATE INDEX IF NOT EXISTS idx_master_assets_category_published ON public.master_assets(category_id, is_published);

-- RLS for master_assets
ALTER TABLE public.master_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Master admins can manage assets" ON public.master_assets;
CREATE POLICY "Master admins can manage assets" ON public.master_assets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'master_admin'
        )
    );

DROP POLICY IF EXISTS "Anyone can view published assets" ON public.master_assets;
CREATE POLICY "Anyone can view published assets" ON public.master_assets
    FOR SELECT USING (is_published = true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_master_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_master_assets_updated_at ON public.master_assets;
CREATE TRIGGER trigger_master_assets_updated_at
    BEFORE UPDATE ON public.master_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_master_assets_updated_at();

-- Grant permissions
GRANT SELECT ON public.master_assets TO authenticated;
GRANT ALL ON public.master_assets TO service_role;
