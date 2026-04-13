-- POD2X (POD v2 Extended) - Letterheads
-- Completely separate from POD v2 - does NOT touch existing tables
-- Migration: 20260318_pod2x_letterheads.sql

-- Enable RLS
alter table if exists pod2x_products enable row level security;
alter table if exists pod2x_delivery_tiers enable row level security;
alter table if exists pod2x_finish_addons enable row level security;
alter table if exists pod2x_price_cache enable row level security;
alter table if exists pod2x_orders enable row level security;

-- ============================================
-- 1. Extended Products (POD2X)
-- ============================================
create table if not exists pod2x_products (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references tenants(id) default '00000000-0000-0000-0000-000000000000',
    
    -- Print.com source
    printcom_product_id varchar,           -- Print.com product ID
    printcom_product_url varchar,          -- Source URL
    printcom_raw_data jsonb,               -- Full Print.com response
    
    -- Local configuration
    name varchar not null,                 -- Danish name
    slug varchar not null unique,
    description text,
    category varchar default 'brevpapir',
    
    -- Simplified options (your choices)
    quantity_min int default 50,
    quantity_max int default 10000,
    quantity_step int default 1,           -- 1 = any number, 50 = steps of 50
    
    design_min int default 1,
    design_max int default 5,
    
    -- Print method (simplified)
    print_method varchar default 'Offset', -- Hidden from customer
    
    -- Status
    is_active boolean default true,
    is_imported boolean default false,     -- Has been imported to products table?
    local_product_id uuid references products(id),
    
    -- Metadata
    created_at timestamp default now(),
    updated_at timestamp default now(),
    created_by uuid references auth.users(id)
);

-- ============================================
-- 2. Delivery Tiers (Your 3 tiers)
-- ============================================
create table if not exists pod2x_delivery_tiers (
    id uuid primary key default gen_random_uuid(),
    pod2x_product_id uuid references pod2x_products(id) on delete cascade,
    
    -- Your simplified tier
    tier_key varchar not null,             -- 'cheap', 'normal', 'fast'
    tier_name varchar not null,            -- 'Billig', 'Normal', 'Express'
    tier_description varchar,              -- '5-7 hverdage', '3-4 hverdage', '1-2 hverdage'
    
    -- Mapping to Print.com delivery options
    printcom_delivery_ids jsonb,           -- ['delivery_123', 'delivery_124'] - multiple IDs that map to this tier
    
    -- Display order
    sort_order int default 0,
    
    created_at timestamp default now()
);

-- ============================================
-- 3. Finish Add-ons (Truck tube, lamination, etc.)
-- ============================================
create table if not exists pod2x_finish_addons (
    id uuid primary key default gen_random_uuid(),
    pod2x_product_id uuid references pod2x_products(id) on delete cascade,
    
    -- Add-on details
    name varchar not null,                 -- 'Truckrør', 'Laminering mat', 'Laminering blank'
    description varchar,
    
    -- Pricing
    price_dkk decimal(10,2) not null,      -- Fixed add-on price
    price_type varchar default 'per_order', -- 'per_order', 'per_piece', 'per_design'
    
    -- Print.com mapping
    printcom_finish_id varchar,            -- Print.com finish option ID
    printcom_raw_data jsonb,
    
    -- Display
    is_active boolean default true,
    sort_order int default 0,
    
    created_at timestamp default now()
);

-- ============================================
-- 4. Price Cache (Print.com prices cached)
-- ============================================
create table if not exists pod2x_price_cache (
    id uuid primary key default gen_random_uuid(),
    pod2x_product_id uuid references pod2x_products(id) on delete cascade,
    
    -- Query parameters
    quantity int not null,
    design_count int default 1,
    delivery_tier varchar not null,        -- 'cheap', 'normal', 'fast'
    
    -- Print.com response
    printcom_delivery_id varchar,          -- Actual delivery option used
    printcom_price_eur decimal(10,2),
    printcom_price_dkk decimal(10,2),
    
    -- Your markup applied
    markup_percent decimal(5,2) default 30.00,
    final_price_dkk decimal(10,2),
    
    -- Cache metadata
    cached_at timestamp default now(),
    expires_at timestamp default now() + interval '24 hours',
    
    -- Unique constraint: one price per combination
    unique(pod2x_product_id, quantity, design_count, delivery_tier)
);

-- ============================================
-- 5. Orders (POD2X fulfillment jobs)
-- ============================================
create table if not exists pod2x_orders (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references tenants(id),
    
    -- Links
    pod2x_product_id uuid references pod2x_products(id),
    local_order_id uuid references orders(id),
    
    -- Order details
    quantity int not null,
    design_count int default 1,
    delivery_tier varchar not null,
    selected_finish_ids jsonb default '[]', -- ['finish_id_1', 'finish_id_2']
    
    -- Pricing
    base_price_dkk decimal(10,2),
    finishes_price_dkk decimal(10,2) default 0,
    total_price_dkk decimal(10,2),
    
    -- Print.com order
    printcom_order_id varchar,
    printcom_order_status varchar default 'pending',
    
    -- Status
    status varchar default 'draft',        -- draft, submitted, confirmed, production, shipped, delivered, cancelled
    
    -- Metadata
    created_at timestamp default now(),
    updated_at timestamp default now(),
    submitted_at timestamp,
    
    -- Customer print data
    print_data_urls jsonb default '[]'     -- Array of uploaded file URLs
);

-- ============================================
-- 6. RLS Policies
-- ============================================

-- pod2x_products: Master admins can manage, others can read
CREATE POLICY pod2x_products_master_manage ON pod2x_products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'master_admin'
        )
    );

CREATE POLICY pod2x_products_tenant_read ON pod2x_products
    FOR SELECT USING (is_active = true);

-- pod2x_delivery_tiers: Same as products
CREATE POLICY pod2x_delivery_tiers_master_manage ON pod2x_delivery_tiers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'master_admin'
        )
    );

CREATE POLICY pod2x_delivery_tiers_read ON pod2x_delivery_tiers
    FOR SELECT USING (true);

-- pod2x_finish_addons: Same
CREATE POLICY pod2x_finish_addons_master_manage ON pod2x_finish_addons
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'master_admin'
        )
    );

CREATE POLICY pod2x_finish_addons_read ON pod2x_finish_addons
    FOR SELECT USING (is_active = true);

-- pod2x_price_cache: Master manage, tenant read their own
CREATE POLICY pod2x_price_cache_master_manage ON pod2x_price_cache
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role = 'master_admin'
        )
    );

-- pod2x_orders: Tenant can manage their own
CREATE POLICY pod2x_orders_tenant_manage ON pod2x_orders
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_roles WHERE user_id = auth.uid()
        )
    );

-- ============================================
-- 7. Indexes
-- ============================================
create index idx_pod2x_products_slug on pod2x_products(slug);
create index idx_pod2x_products_printcom_id on pod2x_products(printcom_product_id);
create index idx_pod2x_products_is_active on pod2x_products(is_active);

create index idx_pod2x_delivery_tiers_product on pod2x_delivery_tiers(pod2x_product_id);
create index idx_pod2x_finish_addons_product on pod2x_finish_addons(pod2x_product_id);

create index idx_pod2x_price_cache_lookup on pod2x_price_cache(pod2x_product_id, quantity, design_count, delivery_tier);
create index idx_pod2x_price_cache_expires on pod2x_price_cache(expires_at);

create index idx_pod2x_orders_tenant on pod2x_orders(tenant_id);
create index idx_pod2x_orders_status on pod2x_orders(status);
create index idx_pod2x_orders_printcom on pod2x_orders(printcom_order_id);

-- ============================================
-- 8. Comments
-- ============================================
comment on table pod2x_products is 'POD2X Extended Products - isolated from POD v2';
comment on table pod2x_delivery_tiers is 'Simplified 3-tier delivery mapping (cheap/normal/fast)';
comment on table pod2x_finish_addons is 'Finish add-ons like truck tube, lamination';
comment on table pod2x_price_cache is 'Cached Print.com prices with markup applied';
comment on table pod2x_orders is 'POD2X fulfillment orders - separate from pod2_fulfillment_jobs';

-- ============================================
-- 9. Initial Data (Example: Letterheads)
-- ============================================
-- This will be populated by the skill, not manually
-- Example of what gets created:
-- INSERT INTO pod2x_products (name, slug, printcom_product_id, ...)
-- VALUES ('Brevpapir', 'brevpapir-printcom', 'letterheads-123', ...);

-- ============================================
-- Done! POD2X is ready.
-- This is completely separate from POD v2.
-- No existing tables were modified.
-- ============================================
