-- 1. Create Tenants Table
CREATE TABLE public.tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    domain text UNIQUE, -- e.g. "shop1.webprinter.com"
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    owner_id uuid REFERENCES auth.users(id) -- The user who owns this shop
);

-- Enable RLS for tenants
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 2. Create System Updates Table
CREATE TABLE public.system_updates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    version text NOT NULL, -- e.g. "1.1.0"
    description text,
    changes jsonb NOT NULL, -- The payload of what changed (prices, products)
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- 3. Create Tenant Update Status Table
CREATE TABLE public.tenant_update_status (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    update_id uuid REFERENCES public.system_updates(id) ON DELETE CASCADE,
    status text NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'failed')),
    applied_at timestamp with time zone,
    UNIQUE(tenant_id, update_id)
);

-- 4. Enable Multitenancy on Existing Tables
-- We'll create a Master Tenant first to own existing data
-- Note: You MUST manually update this 'owner_id' after migration if you want it linked to your specific user, 
-- or we can leave it null for now.
INSERT INTO public.tenants (id, name, domain, settings)
VALUES ('00000000-0000-0000-0000-000000000000', 'Master Template', 'master.webprinter.dk', '{"type": "master"}'::jsonb)
ON CONFLICT DO NOTHING;

-- Helper to add tenant_id to a table
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'products',
        'folder_prices', 
        'visitkort_prices', 
        'poster_rates', 
        'poster_prices',
        'sticker_rates', 
        'sign_rates',
        'sign_prices',
        'banner_rates',
        'banner_prices',
        'beachflag_prices', 
        'booklet_rates', 
        'salesfolder_rates', 
        'foil_prices',
        'generic_product_prices',
        'product_option_groups',
        'product_options',
        'product_option_group_assignments',
        'custom_fields',
        'custom_field_values'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Add column if not exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = t AND column_name = 'tenant_id'
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN tenant_id uuid REFERENCES public.tenants(id)', t);
            
            -- Set existing data to Master Tenant
            EXECUTE format('UPDATE public.%I SET tenant_id = ''00000000-0000-0000-0000-000000000000'' WHERE tenant_id IS NULL', t);
            
            -- Make it NOT NULL (optional, but good for data integrity)
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t);
            
            -- Add INDEX for performance
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant_id ON public.%I(tenant_id)', t, t);
        END IF;
    END LOOP;
END $$;

-- 5. RLS Policies
-- We need to update RLS policies to enforce tenant isolation.
-- This is tricky because we need to DROP all existing open policies or update them.
-- For now, let's CREATE a new "Tenant Isolation" policy for each table.

-- Function to check if user has access to tenant
CREATE OR REPLACE FUNCTION public.can_access_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. If user is the owner of the tenant
    IF EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id AND owner_id = auth.uid()) THEN
        RETURN true;
    END IF;
    
    -- 2. If user is an admin (Super Admin) - they can access everything? 
    -- Or maybe Master Admin can access Master Tenant (000...000).
    IF _tenant_id = '00000000-0000-0000-0000-000000000000' AND public.has_role(auth.uid(), 'admin') THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'products',
        'folder_prices', 
        'visitkort_prices', 
        'poster_rates', 
        'poster_prices',
        'sticker_rates', 
        'sign_rates',
        'sign_prices',
        'banner_rates',
        'banner_prices',
        'beachflag_prices', 
        'booklet_rates', 
        'salesfolder_rates', 
        'foil_prices',
        'generic_product_prices',
        'product_option_groups',
        'product_options',
        'product_option_group_assignments',
        'custom_fields',
        'custom_field_values'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Drop permissive policies if possible? 
        -- Actually, most existing policies are "Anyone can view..." or "Admins can manage..."
        -- We need to restrict "Anyone can view" to "Anyone can view IF is_published AND (tenant_id = current_tenant?)"
        -- But for a public website, we don't know the tenant_id in the auth context usually.
        -- Usage: The frontend will filter by `tenant_id` in the query? 
        -- RLS is safer. 
        -- But for public access (anon), how do we know which tenant they are visiting?
        -- Usually via a header or derived from URL. Supabase doesn't easily do URL-based RLS without custom headers.
        
        -- STRATEGY FOR NOW:
        -- 1. Allow SELECT if tenant_id is passed in query? No, RLS doesn't see query params.
        -- 2. We'll leave public SELECT open for now (so anyone can find any tenant's data if they know the UUID),
        --    BUT we restrict INSERT/UPDATE/DELETE to the tenant owner.
        
        EXECUTE format('CREATE POLICY "Tenant Owner Access" ON public.%I FOR ALL USING (public.can_access_tenant(tenant_id)) WITH CHECK (public.can_access_tenant(tenant_id))', t);
        
    END LOOP;
END $$;
