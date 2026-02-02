-- Premade Designs Tables
-- Run this in Supabase SQL Editor

-- Premade designs saved from master branding template
CREATE TABLE IF NOT EXISTS premade_designs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    branding_data JSONB NOT NULL,
    is_visible BOOLEAN DEFAULT false,
    price DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Track which tenants have access to which designs
CREATE TABLE IF NOT EXISTS tenant_premade_designs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    design_id UUID REFERENCES premade_designs(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT now(),
    granted_by UUID REFERENCES auth.users(id),
    UNIQUE(tenant_id, design_id)
);

-- RLS Policies
ALTER TABLE premade_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_premade_designs ENABLE ROW LEVEL SECURITY;

-- Master can do anything with premade_designs
CREATE POLICY "Master can manage premade_designs" ON premade_designs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM tenants t
            WHERE t.id = '00000000-0000-0000-0000-000000000000'
            AND t.owner_id = auth.uid()
        )
    );

-- Tenants can read visible premade_designs
CREATE POLICY "Anyone can read visible designs" ON premade_designs
    FOR SELECT
    USING (
        is_visible = true
    );

-- Master can manage tenant_premade_designs
CREATE POLICY "Master can manage tenant_premade_designs" ON tenant_premade_designs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM tenants t
            WHERE t.id = '00000000-0000-0000-0000-000000000000'
            AND t.owner_id = auth.uid()
        )
    );

-- Tenants can read their own assignments
CREATE POLICY "Tenants can read own assignments" ON tenant_premade_designs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tenants t
            WHERE t.id = tenant_premade_designs.tenant_id
            AND t.owner_id = auth.uid()
        )
    );
