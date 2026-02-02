-- Add master_admin role to app_role enum (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'app_role' AND e.enumlabel = 'master_admin'
    ) THEN
        ALTER TYPE public.app_role ADD VALUE 'master_admin';
    END IF;
END $$;

-- Extend has_role so master_admin satisfies admin checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND (
        role = _role
        OR (_role = 'admin' AND role = 'master_admin')
      )
  )
$$;
