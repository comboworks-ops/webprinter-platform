-- Migration: Create master_assets table for platform resource library
-- This table stores shared assets (hero backgrounds, icons, videos) 
-- that can be published to tenants

-- Create master_assets table
CREATE TABLE IF NOT EXISTS public.master_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Asset type
    type TEXT NOT NULL CHECK (type IN ('HERO_BACKGROUND', 'ICON', 'VIDEO')),
    
    -- Asset metadata
    name TEXT NOT NULL,
    description TEXT,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    
    -- Organization
    tags TEXT[] DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    
    -- Visibility
    is_published BOOLEAN DEFAULT false,  -- Whether tenants can see/use this asset
    is_premium BOOLEAN DEFAULT false,    -- For future: premium assets for paid tenants
    price_cents INTEGER,                 -- For future: asset marketplace
    
    -- Metadata
    width_px INTEGER,
    height_px INTEGER,
    file_size_bytes BIGINT,
    mime_type TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_master_assets_type ON public.master_assets(type);
CREATE INDEX IF NOT EXISTS idx_master_assets_published ON public.master_assets(is_published);
CREATE INDEX IF NOT EXISTS idx_master_assets_type_published ON public.master_assets(type, is_published);

-- RLS Policies
ALTER TABLE public.master_assets ENABLE ROW LEVEL SECURITY;

-- Master admins can do everything
CREATE POLICY "Master admins can manage assets" ON public.master_assets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('master_admin', 'super_admin')
        )
    );

-- Tenants can only view published assets
CREATE POLICY "Tenants can view published assets" ON public.master_assets
    FOR SELECT USING (
        is_published = true
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('master_admin', 'super_admin')
        )
    );

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

-- Seed 5 default hero backgrounds
-- Using placeholder URLs - these should be replaced with actual uploaded assets
INSERT INTO public.master_assets (type, name, description, url, is_published, sort_order, tags)
VALUES 
    ('HERO_BACKGROUND', 'Professionelt Trykkeri', 'Moderne trykkeri med offsetmaskiner', 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=1920&h=600&fit=crop', true, 1, ARRAY['trykkeri', 'print', 'standard']),
    ('HERO_BACKGROUND', 'Papir & Farver', 'Farverige tryksager og papirprøver', 'https://images.unsplash.com/photo-1568667256549-094345857637?w=1920&h=600&fit=crop', true, 2, ARRAY['farver', 'kreativ', 'standard']),
    ('HERO_BACKGROUND', 'Digital Print', 'Moderne digital printproduktion', 'https://images.unsplash.com/photo-1562654501-a0ccc0fc3fb1?w=1920&h=600&fit=crop', true, 3, ARRAY['digital', 'moderne', 'standard']),
    ('HERO_BACKGROUND', 'Storformat Banner', 'Storformat print og bannere', 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1920&h=600&fit=crop', true, 4, ARRAY['storformat', 'banner', 'standard']),
    ('HERO_BACKGROUND', 'Kreativt Værksted', 'Designproces og kreativt arbejde', 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=1920&h=600&fit=crop', true, 5, ARRAY['kreativ', 'design', 'standard'])
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT ON public.master_assets TO authenticated;
GRANT ALL ON public.master_assets TO service_role;
