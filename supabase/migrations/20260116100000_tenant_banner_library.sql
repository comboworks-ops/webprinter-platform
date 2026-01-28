-- Tenant Banner Library
-- Allows tenants to upload and store their own banner images for reuse

CREATE TABLE IF NOT EXISTS tenant_banner_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Navnløs',
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster tenant lookups
CREATE INDEX IF NOT EXISTS idx_tenant_banner_library_tenant_id ON tenant_banner_library(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_banner_library_created ON tenant_banner_library(created_at DESC);

-- RLS policies
ALTER TABLE tenant_banner_library ENABLE ROW LEVEL SECURITY;

-- Tenants can view their own library
CREATE POLICY "Tenants can view own library" ON tenant_banner_library
    FOR SELECT USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Tenants can insert to their own library
CREATE POLICY "Tenants can insert to own library" ON tenant_banner_library
    FOR INSERT WITH CHECK (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Tenants can delete from their own library
CREATE POLICY "Tenants can delete from own library" ON tenant_banner_library
    FOR DELETE USING (
        tenant_id IN (
            SELECT id FROM tenants WHERE owner_id = auth.uid()
        )
    );

-- Admins can manage all libraries
CREATE POLICY "Admins can manage all libraries" ON tenant_banner_library
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role IN ('admin', 'master_admin')
        )
    );
