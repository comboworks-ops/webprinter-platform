# Supabase Data API Grants

Last updated: 2026-05-27

## Why This Exists

Supabase is changing Data API defaults:

- 2026-05-30: new Supabase projects do not expose new `public` tables to the
  Data API automatically.
- 2026-10-30: existing projects keep existing table grants, but any new
  `public` table created after the rollout needs explicit grants before
  `supabase-js`, PostgREST, or GraphQL can reach it.

This repo talks to Supabase through `supabase-js` and Edge Functions. Treat
Data API reachability as a separate decision from RLS. A table can have correct
RLS policies and still fail with `permission denied for table ...` if the role
does not have a table grant.

## Migration Rule

Every migration that creates a `public` table, view, materialized view, or
callable function must include an explicit Data API access decision in the same
file:

- `GRANT` the narrow privileges required by the app; or
- `REVOKE` access when the object must not be exposed; or
- add `-- data-api: private <object_name>` when an internal object is
  intentionally not reachable via the Data API.

Do not rely on dashboard defaults. Do not use broad bulk grants as the normal
forward path. Bulk grants are rollback/remediation SQL only.

## Table Template

```sql
create table if not exists public.example_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now()
);

grant select on public.example_items to anon;
grant select, insert, update, delete on public.example_items to authenticated;
grant all on public.example_items to service_role;

alter table public.example_items enable row level security;

create policy "example_items_public_read"
on public.example_items
for select
to anon, authenticated
using (true);

create policy "example_items_tenant_write"
on public.example_items
for all
to authenticated
using (public.can_access_tenant(tenant_id))
with check (public.can_access_tenant(tenant_id));
```

## Private/Internal Template

```sql
create table if not exists public.internal_import_buffer (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

revoke all on table public.internal_import_buffer from anon, authenticated;
grant all on public.internal_import_buffer to service_role;

alter table public.internal_import_buffer enable row level security;

-- data-api: private internal_import_buffer
```

## Functions

For functions that should be callable through `/rest/v1/rpc/...`, grant execute
explicitly:

```sql
grant execute on function public.my_rpc(uuid) to authenticated;
revoke execute on function public.my_rpc(uuid) from anon;
```

For trigger-only/internal functions, revoke or mark them private:

```sql
revoke execute on function public.touch_updated_at() from anon, authenticated;
-- data-api: private touch_updated_at
```

## Local Check

Run this before merging migrations:

```bash
npm run check:supabase-grants
```

By default it checks changed and untracked files in `supabase/migrations`.
Historical migrations were created before the Supabase rollout and are not
clean enough to gate with `--all` yet.

Use this for a full audit when you are ready to clean old migrations:

```bash
npm run check:supabase-grants -- --all
```
