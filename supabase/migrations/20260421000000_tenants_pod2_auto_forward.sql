-- POD v2 auto-forward flag on tenants.
--
-- When true, `pod2-create-jobs` skips the tenant approve+charge step and
-- creates jobs straight at status=`paid` so the master forwarding queue
-- picks them up immediately. Intended for self-owned tenants where
-- charging yourself is pure Stripe-fee burn. Master-only toggle.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS pod2_auto_forward boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tenants.pod2_auto_forward IS
  'When true, POD v2 jobs bypass the tenant approve+charge gate. Master-only toggle; never editable by tenant admins.';
