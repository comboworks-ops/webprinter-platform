-- Phase 2 Color Management: ICC Color Profiles (Tenant-Scoped)

-- 1. Create color_profiles table
CREATE TABLE IF NOT EXISTS color_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    kind text NOT NULL DEFAULT 'cmyk_output' CHECK (kind IN ('cmyk_output', 'rgb_working', 'proof_device')),
    description text,
    storage_path text NOT NULL,
    file_size_bytes integer,
    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id),
    UNIQUE(tenant_id, name)
);

-- 2. Add output_color_profile_id column to products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS output_color_profile_id uuid REFERENCES color_profiles(id) ON DELETE SET NULL;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_color_profiles_tenant_id ON color_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_color_profiles_kind ON color_profiles(kind);
CREATE INDEX IF NOT EXISTS idx_products_output_profile ON products(output_color_profile_id);

-- 4. Enable RLS
ALTER TABLE color_profiles ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies using existing can_access_tenant function

CREATE POLICY "Tenant Owner Access"
ON color_profiles FOR ALL
USING (public.can_access_tenant(tenant_id))
WITH CHECK (public.can_access_tenant(tenant_id));

CREATE POLICY "Public can view color profiles"
ON color_profiles FOR SELECT
USING (true);

COMMENT ON TABLE color_profiles IS 'ICC color profiles for soft proofing, scoped per tenant';
COMMENT ON COLUMN color_profiles.kind IS 'Profile type: cmyk_output, rgb_working, or proof_device';
COMMENT ON COLUMN color_profiles.storage_path IS 'Path to ICC file in color-profiles storage bucket';
COMMENT ON COLUMN products.output_color_profile_id IS 'Default CMYK output profile for Designer soft proof';
