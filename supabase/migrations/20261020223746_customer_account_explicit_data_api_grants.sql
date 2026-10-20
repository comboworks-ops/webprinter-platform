-- Customer account tables use auth.uid() = user_id ownership policies.
-- Add only the operations used by MyAddresses and checkout/customerProfiles.
-- Existing deployments retain their other grants; this is not a privilege reset.
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.customer_addresses'::regclass AND relrowsecurity)
     OR NOT EXISTS (SELECT 1 FROM pg_class WHERE oid = 'public.checkout_customer_profiles'::regclass AND relrowsecurity) THEN
    RAISE EXCEPTION 'Customer account RLS must be enabled before granting API access';
  END IF;
END;
$$;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.checkout_customer_profiles TO authenticated;
COMMIT;
-- Rollback: keep existing data and RLS. These grants are already present on the
-- reviewed live project; blindly revoking them would break customer accounts.
-- If rollback is needed on another environment, restore only ACL differences
-- recorded before applying this migration. Never disable RLS or reset public.
