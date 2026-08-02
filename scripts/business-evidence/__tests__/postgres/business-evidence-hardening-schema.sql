\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;

create type public.app_role as enum ('admin', 'master_admin', 'user');

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table public.tenants (
  id uuid primary key,
  owner_id uuid,
  name text not null,
  settings jsonb
);

create table public.user_roles (
  user_id uuid not null,
  role public.app_role not null,
  tenant_id uuid
);

create table public.orders (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid,
  tracking_number text
);

create function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Deliberately owner/assignment-only. The hardening migration must add an
-- exact master role branch to the evidence policies instead of relying on
-- this helper's deployment-specific history.
create function public.can_access_tenant(_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.tenants
    where id = _tenant_id
      and owner_id = auth.uid()
  ) or exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and tenant_id = _tenant_id
  )
$$;

-- Reproduce the deployed baseline: customers do not read public.orders
-- directly. Carrier-event RLS must verify exact customer ownership through a
-- narrowly scoped definer helper rather than a policy subquery subject to this
-- tenant-only parent policy.
alter table public.orders enable row level security;
create policy "Admins can view tenant orders" on public.orders
  for select to authenticated
  using (public.can_access_tenant(tenant_id));
create policy "Admins can manage tenant orders" on public.orders
  for all to authenticated
  using (public.can_access_tenant(tenant_id))
  with check (public.can_access_tenant(tenant_id));

grant usage on schema public to authenticated, service_role;
grant select on public.tenants, public.user_roles, public.orders to authenticated;
-- Model an authoritative parent-deletion path without granting direct evidence
-- deletion. PostgreSQL's declared FK actions must still work for this role.
grant select, delete on public.tenants, public.orders to service_role;

create function public.test_assert(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if condition is distinct from true then
    raise exception 'assertion failed: %', message;
  end if;
end;
$$;
