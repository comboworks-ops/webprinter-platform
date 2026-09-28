-- Close legacy permissive admin policies around storefront records. A tenant
-- admin is an operator of that tenant; only master_admin spans other tenants.
-- Add restrictive policies so an older permissive policy cannot bypass this
-- boundary. No business rows, prices or existing roles are rewritten.
begin;
create schema if not exists storefront_security;
revoke all on schema storefront_security from public;
grant usage on schema storefront_security to anon, authenticated, service_role;

create or replace function storefront_security.is_platform_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'master_admin');
$$;

create or replace function storefront_security.can_manage_tenant(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and p_tenant_id is not null and (
    storefront_security.is_platform_admin()
    or exists (select 1 from public.tenants t
      where t.id = p_tenant_id and t.owner_id = (select auth.uid()))
    or exists (select 1 from public.user_roles r
      where r.user_id = (select auth.uid()) and r.tenant_id = p_tenant_id and r.role = 'admin')
  );
$$;

create or replace function storefront_security.can_manage_order(p_order_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.orders o where o.id = p_order_id
    and storefront_security.can_manage_tenant(o.tenant_id));
$$;

create or replace function storefront_security.can_read_order(p_order_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.orders o where o.id = p_order_id
    and (o.user_id = (select auth.uid()) or storefront_security.can_manage_tenant(o.tenant_id)));
$$;

revoke all on function storefront_security.is_platform_admin(),
  storefront_security.can_manage_tenant(uuid), storefront_security.can_manage_order(uuid),
  storefront_security.can_read_order(uuid) from public;
grant execute on function storefront_security.is_platform_admin(),
  storefront_security.can_manage_tenant(uuid), storefront_security.can_manage_order(uuid),
  storefront_security.can_read_order(uuid) to anon, authenticated, service_role;
-- This schema is intentionally not included in PostgREST exposed schemas.

-- Keep the legacy role predicate's semantics, but qualify its table. Invoker
-- RPCs with an empty search_path previously failed with 42P01 inside this helper.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles r
    where r.user_id = (select auth.uid()) and r.role = 'admin');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- Preserve self-service tenant signup and tenant team management, while denying
-- self-promotion to master_admin, unscoped roles and changes in another shop.
create policy storefront_role_insert_boundary on public.user_roles
  as restrictive for insert to anon, authenticated with check (
    storefront_security.is_platform_admin()
    or (role in ('admin','moderator','user') and tenant_id is not null
      and storefront_security.can_manage_tenant(tenant_id))
  );
create policy storefront_role_update_boundary on public.user_roles
  as restrictive for update to anon, authenticated
  using (storefront_security.is_platform_admin()
    or (role <> 'master_admin' and storefront_security.can_manage_tenant(tenant_id)))
  with check (storefront_security.is_platform_admin()
    or (role <> 'master_admin' and storefront_security.can_manage_tenant(tenant_id)));
create policy storefront_role_delete_boundary on public.user_roles
  as restrictive for delete to anon, authenticated
  using (storefront_security.is_platform_admin()
    or (role <> 'master_admin' and storefront_security.can_manage_tenant(tenant_id)));

create policy storefront_tenant_insert_boundary on public.tenants
  as restrictive for insert to anon, authenticated with check (
    storefront_security.is_platform_admin()
    or (owner_id = (select auth.uid()) and id <> '00000000-0000-0000-0000-000000000000'
      and is_platform_owned is not true and pod2_auto_forward = false)
  );
create policy storefront_tenant_update_boundary on public.tenants
  as restrictive for update to anon, authenticated
  using (storefront_security.can_manage_tenant(id))
  with check (storefront_security.can_manage_tenant(id));
create policy storefront_tenant_delete_boundary on public.tenants
  as restrictive for delete to anon, authenticated
  using (storefront_security.can_manage_tenant(id));

-- RLS checks row access; a trigger also protects platform/ownership controls
-- from an authorized tenant operator changing their own row.
create or replace function storefront_security.protect_tenant_control_fields()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('postgres','service_role','supabase_admin')
    and not storefront_security.is_platform_admin()
    and (new.id is distinct from old.id or new.owner_id is distinct from old.owner_id
      or new.is_platform_owned is distinct from old.is_platform_owned
      or new.pod2_auto_forward is distinct from old.pod2_auto_forward) then
    raise exception 'tenant_control_fields_forbidden' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function storefront_security.protect_tenant_control_fields() from public, anon, authenticated;
create trigger storefront_tenant_control_fields before update on public.tenants
  for each row execute function storefront_security.protect_tenant_control_fields();

create policy storefront_product_read_boundary on public.products
  as restrictive for select to anon, authenticated
  using (is_published or storefront_security.can_manage_tenant(tenant_id));

do $$
declare relation text;
begin
  foreach relation in array array['products','generic_product_prices','orders'] loop
    execute format('create policy storefront_tenant_insert_boundary on public.%I as restrictive for insert to anon, authenticated with check (storefront_security.can_manage_tenant(tenant_id))',relation);
    execute format('create policy storefront_tenant_update_boundary on public.%I as restrictive for update to anon, authenticated using (storefront_security.can_manage_tenant(tenant_id)) with check (storefront_security.can_manage_tenant(tenant_id))',relation);
    execute format('create policy storefront_tenant_delete_boundary on public.%I as restrictive for delete to anon, authenticated using (storefront_security.can_manage_tenant(tenant_id))',relation);
  end loop;
end;
$$;

-- A price row must not claim the caller's tenant while targeting a product in
-- another tenant; pricing-read resolves prices by product_id.
create policy storefront_price_product_insert_boundary on public.generic_product_prices
  as restrictive for insert to anon, authenticated with check (
    exists (select 1 from public.products p where p.id = product_id
      and p.tenant_id = generic_product_prices.tenant_id)
  );
create policy storefront_price_product_update_boundary on public.generic_product_prices
  as restrictive for update to anon, authenticated using (true) with check (
    exists (select 1 from public.products p where p.id = product_id
      and p.tenant_id = generic_product_prices.tenant_id)
  );

create policy storefront_order_read_boundary on public.orders
  as restrictive for select to anon, authenticated
  using (user_id = (select auth.uid()) or storefront_security.can_manage_tenant(tenant_id));
create policy storefront_order_file_read_boundary on public.order_files
  as restrictive for select to anon, authenticated
  using (storefront_security.can_read_order(order_id));
create policy storefront_order_file_insert_boundary on public.order_files
  as restrictive for insert to anon, authenticated
  with check (storefront_security.can_manage_order(order_id));
create policy storefront_order_file_update_boundary on public.order_files
  as restrictive for update to anon, authenticated
  using (storefront_security.can_manage_order(order_id))
  with check (storefront_security.can_manage_order(order_id));
create policy storefront_order_file_delete_boundary on public.order_files
  as restrictive for delete to anon, authenticated
  using (storefront_security.can_manage_order(order_id));
-- Existing customer sender/read-receipt restrictions remain in force. The
-- private customer replacement RPC and service checkout finalizer bypass RLS.
create policy storefront_order_message_scope_boundary on public.order_messages
  as restrictive for all to anon, authenticated
  using (storefront_security.can_read_order(order_id))
  with check (storefront_security.can_read_order(order_id));

do $$
declare relation text;
begin
  foreach relation in array array['order_notes','order_status_history'] loop
    execute format('create policy storefront_order_read_boundary on public.%I as restrictive for select to anon, authenticated using (storefront_security.can_read_order(order_id))',relation);
    execute format('create policy storefront_order_insert_boundary on public.%I as restrictive for insert to anon, authenticated with check (storefront_security.can_manage_order(order_id))',relation);
    execute format('create policy storefront_order_update_boundary on public.%I as restrictive for update to anon, authenticated using (storefront_security.can_manage_order(order_id)) with check (storefront_security.can_manage_order(order_id))',relation);
    execute format('create policy storefront_order_delete_boundary on public.%I as restrictive for delete to anon, authenticated using (storefront_security.can_manage_order(order_id))',relation);
  end loop;
end;
$$;

commit;
-- Rollback: disable checkout and tenant-admin editing first. Keep these
-- restrictions and all data. Do not roll back by restoring cross-tenant writes;
-- repair a demonstrated legitimate operation with a narrowly scoped follow-up.
-- This covers the storefront relations named above, not every legacy pricing,
-- supplier, RPC or storage policy. Those remain separate security review work.
