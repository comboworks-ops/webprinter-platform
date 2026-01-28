-- Migration: Create pdf_templates table for downloadable PDF templates
-- Supports both MASTER (global) and TENANT (tenant-specific) templates

-- Drop if exists (for clean re-runs)
DROP TABLE IF EXISTS public.pdf_templates CASCADE;

-- Create pdf_templates table
CREATE TABLE IF NOT EXISTS public.pdf_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Scope: MASTER templates are global, TENANT templates are tenant-specific
    scope_type TEXT NOT NULL CHECK (scope_type IN ('MASTER', 'TENANT')),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Template metadata
    title TEXT NOT NULL,
    format_key TEXT NOT NULL, -- A4, A3, A2, A1, A0, B2, B1, B0, M65, SALGSMAPPE_A4, etc.
    category TEXT, -- Standardformater, Salgsmapper, Plakater, Bannere, etc.
    description TEXT,
    
    -- File information
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size_bytes BIGINT,
    
    -- Visibility
    is_published BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Constraint: TENANT scope requires tenant_id, MASTER scope must have NULL tenant_id
    CONSTRAINT valid_scope CHECK (
        (scope_type = 'MASTER' AND tenant_id IS NULL) OR
        (scope_type = 'TENANT' AND tenant_id IS NOT NULL)
    )
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_pdf_templates_scope ON public.pdf_templates(scope_type);
CREATE INDEX IF NOT EXISTS idx_pdf_templates_tenant ON public.pdf_templates(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pdf_templates_published ON public.pdf_templates(is_published);
CREATE INDEX IF NOT EXISTS idx_pdf_templates_format ON public.pdf_templates(format_key);
CREATE INDEX IF NOT EXISTS idx_pdf_templates_category ON public.pdf_templates(category);

-- Enable RLS
ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- 1. Master admins can manage all MASTER templates
CREATE POLICY "Master admins can manage MASTER templates" ON public.pdf_templates
    FOR ALL USING (
        scope_type = 'MASTER' AND
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = '00000000-0000-0000-0000-000000000000'
            AND t.owner_id = auth.uid()
        )
    );

-- 2. Tenant owners can manage their own TENANT templates
CREATE POLICY "Tenants can manage own templates" ON public.pdf_templates
    FOR ALL USING (
        scope_type = 'TENANT' AND
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = pdf_templates.tenant_id
            AND t.owner_id = auth.uid()
        )
    );

-- 3. Public can view published templates (MASTER + matching TENANT)
CREATE POLICY "Public can view published templates" ON public.pdf_templates
    FOR SELECT USING (
        is_published = true
    );

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_pdf_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_pdf_templates_updated_at ON public.pdf_templates;
CREATE TRIGGER trigger_pdf_templates_updated_at
    BEFORE UPDATE ON public.pdf_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_pdf_templates_updated_at();

-- Create storage bucket for PDF templates (if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'pdf-templates',
    'pdf-templates',
    true,
    52428800, -- 50MB limit
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for pdf-templates bucket
CREATE POLICY "Anyone can download published templates"
ON storage.objects FOR SELECT
USING (bucket_id = 'pdf-templates');

CREATE POLICY "Master admins can upload master templates"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'pdf-templates' AND
    (storage.foldername(name))[1] = 'master' AND
    EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = '00000000-0000-0000-0000-000000000000'
        AND t.owner_id = auth.uid()
    )
);

CREATE POLICY "Tenants can upload to own folder"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'pdf-templates' AND
    (storage.foldername(name))[1] = 'tenant' AND
    EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id::text = (storage.foldername(name))[2]
        AND t.owner_id = auth.uid()
    )
);

CREATE POLICY "Master admins can delete master templates"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'pdf-templates' AND
    (storage.foldername(name))[1] = 'master' AND
    EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id = '00000000-0000-0000-0000-000000000000'
        AND t.owner_id = auth.uid()
    )
);

CREATE POLICY "Tenants can delete own templates"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'pdf-templates' AND
    (storage.foldername(name))[1] = 'tenant' AND
    EXISTS (
        SELECT 1 FROM public.tenants t
        WHERE t.id::text = (storage.foldername(name))[2]
        AND t.owner_id = auth.uid()
    )
);

-- Grant permissions
GRANT SELECT ON public.pdf_templates TO anon;
GRANT SELECT ON public.pdf_templates TO authenticated;
GRANT ALL ON public.pdf_templates TO service_role;

-- Seed some example MASTER templates
INSERT INTO public.pdf_templates (scope_type, tenant_id, title, format_key, category, description, file_name, file_url, is_published, sort_order)
VALUES 
    ('MASTER', NULL, 'A4 Flyer – 3mm bleed', 'A4', 'Standardformater', 'Standard A4 flyer skabelon med 3mm beskæring', 'a4_flyer_3mm.pdf', 'https://example.com/templates/a4_flyer.pdf', false, 1),
    ('MASTER', NULL, 'A5 Flyer – 3mm bleed', 'A5', 'Standardformater', 'Standard A5 flyer skabelon med 3mm beskæring', 'a5_flyer_3mm.pdf', 'https://example.com/templates/a5_flyer.pdf', false, 2),
    ('MASTER', NULL, 'A3 Plakat – 3mm bleed', 'A3', 'Plakater', 'A3 plakat skabelon med korrekt opsætning', 'a3_plakat_3mm.pdf', 'https://example.com/templates/a3_plakat.pdf', false, 3),
    ('MASTER', NULL, 'Visitkort 85x55mm', 'VISITKORT', 'Visitkort', 'Standard visitkort skabelon', 'visitkort_85x55.pdf', 'https://example.com/templates/visitkort.pdf', false, 4),
    ('MASTER', NULL, 'Salgsmappe A4', 'SALGSMAPPE_A4', 'Salgsmapper', 'Professionel salgsmappe i A4 format', 'salgsmappe_a4.pdf', 'https://example.com/templates/salgsmappe.pdf', false, 5)
ON CONFLICT DO NOTHING;
