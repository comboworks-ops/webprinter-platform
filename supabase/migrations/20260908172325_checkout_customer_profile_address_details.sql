-- Preserve address details already supported by the customer's address book.
-- Nullable and additive: existing saved profiles retain their current values.
begin;
alter table if exists public.checkout_customer_profiles
  add column if not exists delivery_address_2 text,
  add column if not exists delivery_country text,
  add column if not exists billing_address_2 text,
  add column if not exists billing_country text;
-- Existing table grants and ownership RLS apply to these columns. No new
-- grantee or privilege is introduced; no new public relation/function exists.
commit;

-- Rollback: restore the previous frontend profile mapping. Keep these nullable
-- columns and saved values to avoid deleting customer address information.
