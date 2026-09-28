-- Site Design template library. Prepared locally; deploy separately from the UI.
-- Reuse the reviewed role/tenant predicates from the storefront boundary migration.
-- Restrictive policies also contain historical permissive policies still installed.
-- Rollback: keep these access boundaries, pause library editing, and repair the
-- specific denied operation. Never restore unrestricted authenticated writes.

alter table public.premade_designs enable row level security;
alter table public.tenant_premade_designs enable row level security;

revoke all on public.premade_designs from anon, authenticated;
grant select on public.premade_designs to anon;
grant select, insert, update, delete on public.premade_designs to authenticated;
grant all on public.premade_designs to service_role;
revoke all on public.tenant_premade_designs from anon, authenticated;
grant select, insert, update, delete on public.tenant_premade_designs to authenticated;
grant all on public.tenant_premade_designs to service_role;

create policy site_design_library_read_boundary on public.premade_designs
as restrictive for select to authenticated
using (
  is_visible = true
  or storefront_security.is_platform_admin()
  or exists (
    select 1 from public.tenant_premade_designs a
    where a.design_id = premade_designs.id
      and storefront_security.can_manage_tenant(a.tenant_id)
  )
);
create policy site_design_library_public_read_boundary on public.premade_designs
as restrictive for select to anon using (is_visible = true);

create policy site_design_library_insert_boundary on public.premade_designs
as restrictive for insert to anon, authenticated
with check (storefront_security.is_platform_admin());
create policy site_design_library_update_boundary on public.premade_designs
as restrictive for update to anon, authenticated
using (storefront_security.is_platform_admin())
with check (storefront_security.is_platform_admin());
create policy site_design_library_delete_boundary on public.premade_designs
as restrictive for delete to anon, authenticated
using (storefront_security.is_platform_admin());

create policy site_design_assignments_read on public.tenant_premade_designs
for select to authenticated
using (storefront_security.can_manage_tenant(tenant_id));
create policy site_design_assignments_read_boundary on public.tenant_premade_designs
as restrictive for select to authenticated
using (storefront_security.can_manage_tenant(tenant_id));
create policy site_design_assignments_master on public.tenant_premade_designs
for all to authenticated
using (storefront_security.is_platform_admin())
with check (storefront_security.is_platform_admin());
create policy site_design_assignments_insert_boundary on public.tenant_premade_designs
as restrictive for insert to authenticated
with check (storefront_security.is_platform_admin());
create policy site_design_assignments_update_boundary on public.tenant_premade_designs
as restrictive for update to authenticated
using (storefront_security.is_platform_admin())
with check (storefront_security.is_platform_admin());
create policy site_design_assignments_delete_boundary on public.tenant_premade_designs
as restrictive for delete to authenticated
using (storefront_security.is_platform_admin());

-- The browser previously inserted "completed" purchases without a payment.
-- Preserve all history, but only a server payment finalizer may create/change it.
-- This migration does not certify any historical row as evidence of payment.
alter table public.tenant_purchases enable row level security;
revoke insert, update, delete, truncate, references, trigger
  on public.tenant_purchases from anon, authenticated;
grant select on public.tenant_purchases to authenticated;
grant all on public.tenant_purchases to service_role;
create policy site_design_purchases_insert_boundary on public.tenant_purchases
as restrictive for insert to anon, authenticated with check (false);
create policy site_design_purchases_update_boundary on public.tenant_purchases
as restrictive for update to anon, authenticated using (false) with check (false);
create policy site_design_purchases_delete_boundary on public.tenant_purchases
as restrictive for delete to anon, authenticated using (false);
