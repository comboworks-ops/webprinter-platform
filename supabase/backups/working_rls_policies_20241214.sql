-- ============================================================
-- WORKING RLS POLICIES BACKUP - December 14, 2024
-- This file contains the SQL that fixed the master admin access issues.
-- If something breaks, run this in Supabase SQL Editor to restore access.
-- ============================================================

-- 1. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Users can read their own role
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role" ON public.user_roles
FOR SELECT USING (user_id = auth.uid());

-- 3. Create admin helper function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean 
LANGUAGE SQL 
STABLE 
SECURITY DEFINER 
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'master_admin')) $$;

-- 4. Admins can manage all roles
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL TO authenticated USING (public.is_admin());

-- 5. Your master_admin role (User ID: be587c26-8ec6-4637-bf90-c3ba916c050b)
INSERT INTO public.user_roles (user_id, role) 
VALUES ('be587c26-8ec6-4637-bf90-c3ba916c050b', 'master_admin')
ON CONFLICT DO NOTHING;

-- 6. Set master tenant owner
UPDATE public.tenants 
SET owner_id = 'be587c26-8ec6-4637-bf90-c3ba916c050b'
WHERE id = '00000000-0000-0000-0000-000000000000';

-- 7. Products policy - admins can manage master tenant products
DROP POLICY IF EXISTS "Admins can manage their tenant products" ON public.products;
CREATE POLICY "Admins can manage their tenant products" ON public.products
FOR ALL TO authenticated
USING (
    (tenant_id = '00000000-0000-0000-0000-000000000000' AND public.is_admin())
    OR EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id AND owner_id = auth.uid())
);

-- ============================================================
-- HOW TO USE THIS FILE:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Click Run
-- 4. Log out and log back into the app
-- ============================================================
