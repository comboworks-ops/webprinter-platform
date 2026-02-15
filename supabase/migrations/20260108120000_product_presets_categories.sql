-- Simplified Create Product Flow - Add preset_key and product_categories
-- This migration adds preset templates support and dynamic categories

-- 1. Add preset_key to products (stores which template was used)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS preset_key text DEFAULT 'custom';

-- 2. Create product_categories table for dynamic categories
CREATE TABLE IF NOT EXISTS public.product_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    slug text NOT NULL,
    sort_order int DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(tenant_id, slug)
);

-- Enable RLS
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant owners can manage their categories
DROP POLICY IF EXISTS "Tenant Access" ON public.product_categories;
CREATE POLICY "Tenant Access" ON public.product_categories
FOR ALL USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

-- Allow public SELECT for storefront
DROP POLICY IF EXISTS "Public Select" ON public.product_categories;
CREATE POLICY "Public Select" ON public.product_categories
FOR SELECT TO anon, authenticated
USING (true);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_product_categories_tenant 
ON public.product_categories(tenant_id);

-- 3. Seed initial categories for Master tenant
INSERT INTO public.product_categories (tenant_id, name, slug, sort_order) VALUES
('00000000-0000-0000-0000-000000000000', 'Tryksager', 'tryksager', 1),
('00000000-0000-0000-0000-000000000000', 'Storformat', 'storformat', 2),
('00000000-0000-0000-0000-000000000000', 'Tekstil', 'tekstil', 3),
('00000000-0000-0000-0000-000000000000', 'Bøger & Hæfter', 'boeger-haefter', 4),
('00000000-0000-0000-0000-000000000000', 'Emballage', 'emballage', 5)
ON CONFLICT (tenant_id, slug) DO NOTHING;
