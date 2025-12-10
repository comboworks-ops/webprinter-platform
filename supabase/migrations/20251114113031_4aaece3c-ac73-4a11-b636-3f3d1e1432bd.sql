-- Allow first user to grant themselves admin role
-- This policy allows insert into user_roles when there are no existing admins
CREATE POLICY "Allow first admin signup"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'admin'
  )
);