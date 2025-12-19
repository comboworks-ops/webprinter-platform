-- COMPREHENSIVE REPAIR SCRIPT FOR MASTER BANNERS (V3 - LOCAL ASSETS)
-- This script aligns the database with the deployed code expectations and uses local assets.

-- 1. Ensure 'resource_categories' table exists
CREATE TABLE IF NOT EXISTS public.resource_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Ensure 'master_assets' table exists
CREATE TABLE IF NOT EXISTS public.master_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.resource_categories(id),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Fix missing columns if table already existed
DO $$
BEGIN
    -- Add category_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_assets' AND column_name = 'category_id') THEN
        ALTER TABLE public.master_assets ADD COLUMN category_id UUID REFERENCES public.resource_categories(id);
    END IF;
    
    -- Add is_published if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_assets' AND column_name = 'is_published') THEN
        ALTER TABLE public.master_assets ADD COLUMN is_published BOOLEAN DEFAULT true;
    END IF;
    
    -- Add thumbnail_url if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'master_assets' AND column_name = 'thumbnail_url') THEN
        ALTER TABLE public.master_assets ADD COLUMN thumbnail_url TEXT;
    END IF;
END $$;

-- 4. FIX VISIBILITY (RLS)
ALTER TABLE public.resource_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON public.resource_categories;
DROP POLICY IF EXISTS "Anyone can read resource categories" ON public.resource_categories;
DROP POLICY IF EXISTS "Public read access" ON public.master_assets;
DROP POLICY IF EXISTS "Anyone can read master assets" ON public.master_assets;
DROP POLICY IF EXISTS "Tenants can view published assets" ON public.master_assets;

CREATE POLICY "Anyone can read resource categories" ON public.resource_categories FOR SELECT USING (true);
CREATE POLICY "Anyone can read master assets" ON public.master_assets FOR SELECT USING (true);


-- 5. INSERT DATA (Using Local Assets /images/banners/...)
DO $$
DECLARE
    cat_id UUID;
    master_tenant_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    -- Get or create category
    SELECT id INTO cat_id FROM resource_categories WHERE slug = 'forside-bannere';
    
    IF cat_id IS NULL THEN
        INSERT INTO resource_categories (slug, name, type)
        VALUES ('forside-bannere', 'Forside Bannere', 'image')
        RETURNING id INTO cat_id;
    END IF;

    -- Image 1: Professionelt tryk
    IF NOT EXISTS (SELECT 1 FROM master_assets WHERE name = 'Professionelt tryk' AND category_id = cat_id) THEN
        INSERT INTO master_assets (category_id, name, url, thumbnail_url, sort_order, is_published)
        VALUES (
            cat_id,
            'Professionelt tryk',
            '/images/banners/banner-professionelt-tryk.jpg',
            '/images/banners/banner-professionelt-tryk.jpg',
            0,
            true
        );
    ELSE
        UPDATE master_assets 
        SET url = '/images/banners/banner-professionelt-tryk.jpg',
            thumbnail_url = '/images/banners/banner-professionelt-tryk.jpg'
        WHERE name = 'Professionelt tryk' AND category_id = cat_id;
    END IF;

    -- Image 2: Storformat print
    IF NOT EXISTS (SELECT 1 FROM master_assets WHERE name = 'Storformat print' AND category_id = cat_id) THEN
        INSERT INTO master_assets (category_id, name, url, thumbnail_url, sort_order, is_published)
        VALUES (
            cat_id,
            'Storformat print',
            '/images/banners/banner-storformat.jpg',
            '/images/banners/banner-storformat.jpg',
            1,
            true
        );
    ELSE
        UPDATE master_assets 
        SET url = '/images/banners/banner-storformat.jpg',
            thumbnail_url = '/images/banners/banner-storformat.jpg'
        WHERE name = 'Storformat print' AND category_id = cat_id;
    END IF;

    -- Image 3: Billige tryksager
    IF NOT EXISTS (SELECT 1 FROM master_assets WHERE name = 'Billige tryksager' AND category_id = cat_id) THEN
        INSERT INTO master_assets (category_id, name, url, thumbnail_url, sort_order, is_published)
        VALUES (
            cat_id,
            'Billige tryksager',
            '/images/banners/banner-billige-tryksager.jpg',
            '/images/banners/banner-billige-tryksager.jpg',
            2,
            true
        );
    ELSE
        UPDATE master_assets 
        SET url = '/images/banners/banner-billige-tryksager.jpg',
            thumbnail_url = '/images/banners/banner-billige-tryksager.jpg'
        WHERE name = 'Billige tryksager' AND category_id = cat_id;
    END IF;

    -- 6. Update Master Tenant Settings
    UPDATE public.tenants
    SET settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{branding,hero,images}',
        '[
            {"id":"default-1","url":"/images/banners/banner-professionelt-tryk.jpg","alt":"Professionelt tryk","sortOrder":0,"headline":"Professionelt tryk – hurtig levering i hele Danmark","subline":"Flyers, foldere, plakater, bannere m.m. — beregn prisen direkte.","buttons":[{"id":"btn-1","label":"Se tryksager","variant":"primary","linkType":"ALL_PRODUCTS","textColor":"#FFFFFF","bgColor":"#0EA5E9","bgOpacity":1}],"textAnimation":"slide-up"},
            {"id":"default-2","url":"/images/banners/banner-storformat.jpg","alt":"Storformat print","sortOrder":1,"headline":"Storformat print i topkvalitet","subline":"Bannere, beachflag, skilte og messeudstyr – til konkurrencedygtige priser.","buttons":[{"id":"btn-2","label":"Se storformat","variant":"primary","linkType":"INTERNAL_PAGE","target":{"path":"#storformat"},"textColor":"#FFFFFF","bgColor":"#0EA5E9","bgOpacity":1}],"textAnimation":"slide-up"},
            {"id":"default-3","url":"/images/banners/banner-billige-tryksager.jpg","alt":"Billige tryksager","sortOrder":2,"headline":"Billige tryksager online","subline":"Bestil nemt og hurtigt – personlig service og dansk produktion.","buttons":[{"id":"btn-3","label":"Beregn pris","variant":"primary","linkType":"INTERNAL_PAGE","target":{"path":"/prisberegner"},"textColor":"#FFFFFF","bgColor":"#0EA5E9","bgOpacity":1}],"textAnimation":"slide-up"}
        ]'::jsonb
    )
    WHERE id = master_tenant_id;

END $$;
