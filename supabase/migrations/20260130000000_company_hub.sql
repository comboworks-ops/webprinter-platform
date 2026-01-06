-- 1. Create company_accounts
CREATE TABLE public.company_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    logo_url text NULL,
    created_at timestamptz DEFAULT now()
);

-- 2. Create company_members
CREATE TABLE public.company_members (
    company_id uuid REFERENCES public.company_accounts(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL DEFAULT 'company_user', -- 'company_admin' | 'company_user'
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (company_id, user_id)
);

-- 3. Create company_hub_items
CREATE TABLE public.company_hub_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    company_id uuid REFERENCES public.company_accounts(id) ON DELETE CASCADE,
    title text NOT NULL,
    product_id uuid REFERENCES public.products(id),
    variant_id text NULL, -- References variant in pricing data structure
    default_quantity int NOT NULL DEFAULT 100,
    default_options jsonb NOT NULL DEFAULT '{}'::jsonb,
    design_id uuid NULL REFERENCES public.designer_saved_designs(id),
    thumbnail_url text NULL,
    sort_order int NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_company_accounts_tenant_id ON public.company_accounts(tenant_id);
CREATE INDEX idx_company_members_tenant_id_user_id ON public.company_members(tenant_id, user_id);
CREATE INDEX idx_company_hub_items_tenant_company_sort ON public.company_hub_items(tenant_id, company_id, sort_order);

-- Enable RLS
ALTER TABLE public.company_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_hub_items ENABLE ROW LEVEL SECURITY;

-- Policies for company_accounts
CREATE POLICY "Admin CRUD company_accounts" ON public.company_accounts
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND (
                (tenant_id = public.company_accounts.tenant_id AND role IN ('admin', 'staff'))
                OR (role = 'master_admin')
            )
        )
    );

CREATE POLICY "Member SELECT company_accounts" ON public.company_accounts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members
            WHERE company_id = public.company_accounts.id
            AND user_id = auth.uid()
        )
    );

-- Policies for company_members
CREATE POLICY "Admin CRUD company_members" ON public.company_members
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND (
                (tenant_id = public.company_members.tenant_id AND role IN ('admin', 'staff'))
                OR (role = 'master_admin')
            )
        )
    );

CREATE POLICY "User SELECT own memberships" ON public.company_members
    FOR SELECT
    USING (user_id = auth.uid());

-- Policies for company_hub_items
CREATE POLICY "Admin CRUD company_hub_items" ON public.company_hub_items
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND (
                (tenant_id = public.company_hub_items.tenant_id AND role IN ('admin', 'staff'))
                OR (role = 'master_admin')
            )
        )
    );

CREATE POLICY "Member SELECT hub items" ON public.company_hub_items
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.company_members
            WHERE company_id = public.company_hub_items.company_id
            AND user_id = auth.uid()
        )
    );
