-- Icon Packs and Assets Tables for Master Admin Assets Library
-- These tables store icon packs that can be sold/distributed to tenants

-- Icon Packs table
CREATE TABLE IF NOT EXISTS public.icon_packs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    preview_url text,
    is_premium boolean DEFAULT false,
    price numeric(10, 2) DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- Icon Assets table  
CREATE TABLE IF NOT EXISTS public.icon_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    file_url text NOT NULL,
    pack_id uuid NOT NULL REFERENCES public.icon_packs(id) ON DELETE CASCADE,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_icon_assets_pack_id ON public.icon_assets(pack_id);
CREATE INDEX IF NOT EXISTS idx_icon_packs_is_active ON public.icon_packs(is_active);

-- Enable RLS
ALTER TABLE public.icon_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icon_assets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for icon_packs
-- Master admin can do everything
CREATE POLICY "Master admin full access to icon_packs"
ON public.icon_packs FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'master_admin'
    )
);

-- Everyone can read active packs (for displaying in tenant admin)
CREATE POLICY "Anyone can view active icon_packs"
ON public.icon_packs FOR SELECT
USING (is_active = true);

-- RLS Policies for icon_assets
-- Master admin can do everything
CREATE POLICY "Master admin full access to icon_assets"
ON public.icon_assets FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
        AND role = 'master_admin'
    )
);

-- Everyone can read assets from active packs
CREATE POLICY "Anyone can view icon_assets from active packs"
ON public.icon_assets FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.icon_packs
        WHERE icon_packs.id = icon_assets.pack_id
        AND icon_packs.is_active = true
    )
);

-- Create storage bucket for icon assets (if not exists)
-- Note: This needs to be run manually or via Supabase dashboard
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('icon-assets', 'icon-assets', true)
-- ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.icon_packs IS 'Stores icon pack metadata for the platform assets library';
COMMENT ON TABLE public.icon_assets IS 'Stores individual icon files belonging to packs';
