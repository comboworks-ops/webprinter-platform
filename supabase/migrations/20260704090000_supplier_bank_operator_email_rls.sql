-- Supplier Bank operator-email RLS bridge.
-- Keeps the supplier-bank browser visibility rule aligned with verify-admin.
--
-- Rollback:
-- Recreate public.is_supplier_bank_master_admin() with only the user_roles
-- master_admin check from 20260701120000_supplier_product_bank.sql.

create or replace function public.is_supplier_bank_master_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role = 'master_admin'
    )
    or lower(coalesce(auth.email(), '')) in (
      'admin@webprinter.dk',
      'info@webprinter.dk'
    );
$$;

revoke execute on function public.is_supplier_bank_master_admin() from anon;
grant execute on function public.is_supplier_bank_master_admin() to authenticated;
grant execute on function public.is_supplier_bank_master_admin() to service_role;
