-- Migration: Design Library and Resources integration

-- 1. Update designer_saved_designs
ALTER TABLE public.designer_saved_designs ADD COLUMN IF NOT EXISTS preview_path TEXT;

-- 2. Create design_library_items table
CREATE TABLE IF NOT EXISTS public.design_library_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    visibility TEXT NOT NULL DEFAULT 'tenant', -- 'tenant' | 'public'
    kind TEXT NOT NULL,                         -- 'fabric_json' | 'svg' | 'pdf' | 'image'
    name TEXT NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    fabric_json JSONB null,
    storage_path TEXT null,                     -- path to svg/pdf/image in storage
    preview_path TEXT null,                     -- thumbnail in Storage
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS for design_library_items
ALTER TABLE public.design_library_items ENABLE ROW LEVEL SECURITY;

-- Select policy: own tenant OR public master items
DROP POLICY IF EXISTS "Select design library items" ON public.design_library_items;
CREATE POLICY "Select design library items" ON public.design_library_items
    FOR SELECT USING (
        tenant_id = (SELECT ur.tenant_id FROM public.user_roles ur WHERE ur.user_id = auth.uid() LIMIT 1)
        OR (visibility = 'public' AND tenant_id = '00000000-0000-0000-0000-000000000000')
    );

-- All policy for tenant admins
DROP POLICY IF EXISTS "Manage own tenant design library items" ON public.design_library_items;
CREATE POLICY "Manage own tenant design library items" ON public.design_library_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'admin'
            AND ur.tenant_id = design_library_items.tenant_id
        )
    );

-- Master admin can manage everything
DROP POLICY IF EXISTS "Master admin manage all design library items" ON public.design_library_items;
CREATE POLICY "Master admin manage all design library items" ON public.design_library_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role = 'master_admin'
        )
    );

-- 4. Update timestamp trigger
CREATE OR REPLACE FUNCTION update_design_library_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_design_library_items_updated_at ON public.design_library_items;
CREATE TRIGGER trigger_design_library_items_updated_at
    BEFORE UPDATE ON public.design_library_items
    FOR EACH ROW
    EXECUTE FUNCTION update_design_library_items_updated_at();

-- 5. Grant permissions
GRANT SELECT ON public.design_library_items TO authenticated;
GRANT ALL ON public.design_library_items TO service_role;

-- 6. Storage Configuration (Manual step info)
-- Bucket: design-library (Public: NO, RLS: YES)
-- Bucket: design-saves (Public: NO, RLS: YES)

-- RLS for Storage buckets (assuming standard Supabase storage schema)
-- These vary by implementation so typically handled in dashboard, but here is the logic:
-- 1. SELECT allowed if path matches tenant_id
-- 2. INSERT/UPDATE allowed if authenticated and path matches tenant_id
