-- ============================================================
-- COMPREHENSIVE FIX: Master Admin RLS Policies
-- This migration ensures master_admin can access all master tenant data
-- ============================================================

-- 1. Ensure master_admin role exists in enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'master_admin' AND enumtypid = 'public.app_role'::regtype) THEN
        ALTER TYPE public.app_role ADD VALUE 'master_admin';
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'master_admin already exists or app_role type not found';
END $$;

-- 2. Create/update has_role function to treat master_admin as super-admin
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND (role = _role OR role = 'master_admin')
  )
$$;

-- 3. Create/update can_access_tenant function
CREATE OR REPLACE FUNCTION public.can_access_tenant(_tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- Owner can always access
    IF EXISTS (SELECT 1 FROM public.tenants WHERE id = _tenant_id AND owner_id = auth.uid()) THEN
        RETURN true;
    END IF;
    
    -- Master admin can access master tenant
    IF _tenant_id = '00000000-0000-0000-0000-000000000000' THEN
        IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'master_admin')) THEN
            RETURN true;
        END IF;
    END IF;
    
    -- User assigned to tenant via user_roles
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND tenant_id = _tenant_id) THEN
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$;

-- 4. Helper: check if user is any kind of admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'master_admin')
    )
$$;

-- ============================================================
-- FIX user_roles TABLE POLICIES
-- Users must be able to read their OWN role
-- ============================================================
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role" ON public.user_roles
    FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
    FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ============================================================
-- FIX tenants TABLE POLICIES
-- ============================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view tenants they own or are assigned to" ON public.tenants;
CREATE POLICY "Users can view tenants they own or are assigned to" ON public.tenants
    FOR SELECT
    USING (
        owner_id = auth.uid()
        OR id IN (SELECT tenant_id FROM public.user_roles WHERE user_id = auth.uid())
        OR (id = '00000000-0000-0000-0000-000000000000' AND public.is_admin())
    );

DROP POLICY IF EXISTS "Owners and admins can update tenants" ON public.tenants;
CREATE POLICY "Owners and admins can update tenants" ON public.tenants
    FOR UPDATE
    TO authenticated
    USING (owner_id = auth.uid() OR public.is_admin())
    WITH CHECK (owner_id = auth.uid() OR public.is_admin());

-- ============================================================
-- FIX products TABLE POLICIES
-- ============================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view published products" ON public.products;
CREATE POLICY "Anyone can view published products" ON public.products
    FOR SELECT
    USING (
        is_published = true 
        OR public.can_access_tenant(tenant_id)
    );

DROP POLICY IF EXISTS "Admins can manage their tenant products" ON public.products;
CREATE POLICY "Admins can manage their tenant products" ON public.products
    FOR ALL
    TO authenticated
    USING (public.can_access_tenant(tenant_id))
    WITH CHECK (public.can_access_tenant(tenant_id));

-- ============================================================
-- FIX orders TABLE POLICIES
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders' AND table_schema = 'public') THEN
        ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Admins can view tenant orders" ON public.orders;
        CREATE POLICY "Admins can view tenant orders" ON public.orders
            FOR SELECT
            USING (public.can_access_tenant(tenant_id));
            
        DROP POLICY IF EXISTS "Admins can manage tenant orders" ON public.orders;
        CREATE POLICY "Admins can manage tenant orders" ON public.orders
            FOR ALL
            TO authenticated
            USING (public.can_access_tenant(tenant_id))
            WITH CHECK (public.can_access_tenant(tenant_id));
    END IF;
END $$;

-- ============================================================
-- FIX page_seo TABLE POLICIES
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'page_seo' AND table_schema = 'public') THEN
        -- Ensure tenant_id column exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'page_seo' AND column_name = 'tenant_id') THEN
            ALTER TABLE public.page_seo ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
        END IF;
        
        -- Backfill NULL tenant_ids to master
        UPDATE public.page_seo SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
        
        ALTER TABLE public.page_seo ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Tenants view own SEO" ON public.page_seo;
        CREATE POLICY "Tenants view own SEO" ON public.page_seo
            FOR SELECT
            USING (public.can_access_tenant(tenant_id));
            
        DROP POLICY IF EXISTS "Tenants edit own SEO" ON public.page_seo;
        CREATE POLICY "Tenants edit own SEO" ON public.page_seo
            FOR ALL
            TO authenticated
            USING (public.can_access_tenant(tenant_id))
            WITH CHECK (public.can_access_tenant(tenant_id));
    END IF;
END $$;

-- ============================================================
-- FIX order_messages TABLE POLICIES
-- ============================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'order_messages' AND table_schema = 'public') THEN
        ALTER TABLE public.order_messages ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Admins can view order messages" ON public.order_messages;
        CREATE POLICY "Admins can view order messages" ON public.order_messages
            FOR SELECT
            USING (public.is_admin() OR sender_id = auth.uid());
            
        DROP POLICY IF EXISTS "Admins can manage order messages" ON public.order_messages;
        CREATE POLICY "Admins can manage order messages" ON public.order_messages
            FOR ALL
            TO authenticated
            USING (public.is_admin() OR sender_id = auth.uid())
            WITH CHECK (public.is_admin() OR sender_id = auth.uid());
    END IF;
END $$;

-- ============================================================
-- ENSURE YOUR ADMIN USER HAS THE RIGHT ROLES
-- Replace 'be587c26-8ec6-4637-bf90-c3ba916c050b' with your user ID
-- ============================================================
INSERT INTO public.user_roles (user_id, role) 
VALUES ('be587c26-8ec6-4637-bf90-c3ba916c050b', 'master_admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Also set them as owner of master tenant if not already
UPDATE public.tenants 
SET owner_id = 'be587c26-8ec6-4637-bf90-c3ba916c050b'
WHERE id = '00000000-0000-0000-0000-000000000000'
AND owner_id IS NULL;

-- ============================================================
-- DONE! After running this, reload the app and products should appear.
-- ============================================================
