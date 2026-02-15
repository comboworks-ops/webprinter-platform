-- Tenant Purchases Table
-- Tracks which paid design elements tenants have purchased
-- Run this in Supabase SQL Editor

-- Purchases tracking table
CREATE TABLE IF NOT EXISTS tenant_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- What was purchased
    item_type TEXT NOT NULL CHECK (item_type IN ('premade_design', 'icon_pack', 'font_pack', 'template_feature')),
    item_id UUID NOT NULL,
    item_name TEXT NOT NULL,
    
    -- Pricing
    price_paid DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'DKK',
    
    -- Status
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded')),
    
    -- Timestamps
    purchased_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure unique purchases (can't buy same item twice)
    UNIQUE(tenant_id, item_type, item_id)
);

-- Applied paid items in draft (pending purchases)
-- This tracks items that are being used but not yet paid for
CREATE TABLE IF NOT EXISTS tenant_pending_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    
    -- Item details
    item_type TEXT NOT NULL CHECK (item_type IN ('premade_design', 'icon_pack', 'font_pack', 'template_feature')),
    item_id UUID NOT NULL,
    item_name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    
    -- When it was added to draft
    applied_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure unique pending items
    UNIQUE(tenant_id, item_type, item_id)
);

-- RLS Policies
ALTER TABLE tenant_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_pending_items ENABLE ROW LEVEL SECURITY;

-- Tenants can read their own purchases
CREATE POLICY "Tenants can read own purchases" ON tenant_purchases
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tenants t
            WHERE t.id = tenant_purchases.tenant_id
            AND t.owner_id = auth.uid()
        )
    );

-- Tenants can insert their own purchases (after payment)
CREATE POLICY "Tenants can insert own purchases" ON tenant_purchases
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tenants t
            WHERE t.id = tenant_purchases.tenant_id
            AND t.owner_id = auth.uid()
        )
    );

-- Tenants can manage their pending items
CREATE POLICY "Tenants can manage pending items" ON tenant_pending_items
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM tenants t
            WHERE t.id = tenant_pending_items.tenant_id
            AND t.owner_id = auth.uid()
        )
    );

-- Master can view all purchases and pending items
CREATE POLICY "Master can view all purchases" ON tenant_purchases
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tenants t
            WHERE t.id = '00000000-0000-0000-0000-000000000000'
            AND t.owner_id = auth.uid()
        )
    );

CREATE POLICY "Master can view all pending items" ON tenant_pending_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tenants t
            WHERE t.id = '00000000-0000-0000-0000-000000000000'
            AND t.owner_id = auth.uid()
        )
    );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_purchases_tenant_id ON tenant_purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_pending_items_tenant_id ON tenant_pending_items(tenant_id);
