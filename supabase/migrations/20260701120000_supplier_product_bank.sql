-- ============================================================
-- Supplier Product Bank
-- Additive staging catalog for print-house product/pricing data.
-- This is separate from POD v1/POD v2 and does not publish products.
-- Date: 2026-07-01
--
-- Rollback note:
-- Drop in reverse dependency order:
-- supplier_bank_import_jobs -> supplier_bank_price_delta_reviews ->
-- supplier_bank_price_snapshots -> supplier_bank_products ->
-- supplier_bank_scrape_runs -> supplier_bank_suppliers ->
-- is_supplier_bank_master_admin().
-- ============================================================

create or replace function public.is_supplier_bank_master_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'master_admin'
  );
$$;

revoke execute on function public.is_supplier_bank_master_admin() from anon;
grant execute on function public.is_supplier_bank_master_admin() to authenticated;
grant execute on function public.is_supplier_bank_master_admin() to service_role;

create table if not exists public.supplier_bank_suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  website_url text,
  country_code text not null default 'DK',
  currency text not null default 'EUR',
  integration_type text not null default 'scrape'
    check (integration_type in ('api', 'scrape', 'playwright', 'manual')),
  enabled boolean not null default true,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.supplier_bank_suppliers to authenticated;
grant all on public.supplier_bank_suppliers to service_role;
revoke all on table public.supplier_bank_suppliers from anon;

create table if not exists public.supplier_bank_scrape_runs (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.supplier_bank_suppliers(id) on delete set null,
  started_by uuid references auth.users(id) on delete set null,
  mode text not null
    check (mode in ('catalog_discovery', 'product_extract', 'price_refresh', 'manual_upload')),
  tool text not null
    check (tool in ('firecrawl', 'playwright', 'supplier_api', 'static_fetch', 'manual')),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'partial', 'failed')),
  input jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.supplier_bank_scrape_runs to authenticated;
grant all on public.supplier_bank_scrape_runs to service_role;
revoke all on table public.supplier_bank_scrape_runs from anon;

create table if not exists public.supplier_bank_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.supplier_bank_suppliers(id) on delete cascade,
  latest_scrape_run_id uuid references public.supplier_bank_scrape_runs(id) on delete set null,
  supplier_product_key text not null,
  source_url text,
  source_hash text,
  product_family text not null default 'other'
    check (
      product_family in (
        'flyers',
        'folders',
        'sales_folders',
        'business_cards',
        'posters',
        'banners',
        'signs',
        'rollups',
        'stickers',
        'labels',
        'books',
        'letterheads',
        'tshirts',
        'packaging',
        'other'
      )
    ),
  name_original text not null,
  name_da text not null,
  description_original text,
  description_da text,
  source_language text,
  target_language text not null default 'da',
  status text not null default 'draft'
    check (status in ('draft', 'reviewed', 'approved', 'archived', 'failed')),
  normalized_attributes jsonb not null default '{}'::jsonb,
  normalized_pricing_summary jsonb not null default '{}'::jsonb,
  raw_snapshot_path text,
  scrape_status text not null default 'pending'
    check (scrape_status in ('pending', 'fresh', 'stale', 'failed')),
  last_scraped_at timestamptz,
  last_price_checked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, supplier_product_key)
);

grant select, insert, update, delete on public.supplier_bank_products to authenticated;
grant all on public.supplier_bank_products to service_role;
revoke all on table public.supplier_bank_products from anon;

create table if not exists public.supplier_bank_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  bank_product_id uuid not null references public.supplier_bank_products(id) on delete cascade,
  supplier_id uuid not null references public.supplier_bank_suppliers(id) on delete cascade,
  scrape_run_id uuid references public.supplier_bank_scrape_runs(id) on delete set null,
  currency text not null default 'EUR',
  conversion_rule_key text,
  raw_price_rows jsonb not null default '[]'::jsonb,
  normalized_price_rows jsonb not null default '[]'::jsonb,
  price_min_dkk numeric,
  price_max_dkk numeric,
  quantity_min integer,
  quantity_max integer,
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.supplier_bank_price_snapshots to authenticated;
grant all on public.supplier_bank_price_snapshots to service_role;
revoke all on table public.supplier_bank_price_snapshots from anon;

create table if not exists public.supplier_bank_import_jobs (
  id uuid primary key default gen_random_uuid(),
  bank_product_id uuid not null references public.supplier_bank_products(id) on delete cascade,
  target_tenant_id uuid references public.tenants(id) on delete set null,
  target_product_id uuid references public.products(id) on delete set null,
  import_mode text not null default 'matrix_layout_v1'
    check (import_mode in ('matrix_layout_v1', 'storformat', 'manual')),
  status text not null default 'draft'
    check (status in ('draft', 'dry_run', 'imported', 'failed')),
  import_summary jsonb not null default '{}'::jsonb,
  rollback_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.supplier_bank_import_jobs to authenticated;
grant all on public.supplier_bank_import_jobs to service_role;
revoke all on table public.supplier_bank_import_jobs from anon;

create table if not exists public.supplier_bank_price_delta_reviews (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.supplier_bank_suppliers(id) on delete set null,
  bank_product_id uuid references public.supplier_bank_products(id) on delete cascade,
  old_price_snapshot_id uuid references public.supplier_bank_price_snapshots(id) on delete set null,
  new_price_snapshot_id uuid references public.supplier_bank_price_snapshots(id) on delete set null,
  supplier_product_key text,
  product_family text,
  old_snapshot_path text,
  new_snapshot_path text,
  threshold_pct numeric not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'reviewed', 'accepted', 'rejected')),
  change_summary jsonb not null default '{}'::jsonb,
  changed_rows jsonb not null default '[]'::jsonb,
  added_rows jsonb not null default '[]'::jsonb,
  removed_rows jsonb not null default '[]'::jsonb,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.supplier_bank_price_delta_reviews to authenticated;
grant all on public.supplier_bank_price_delta_reviews to service_role;
revoke all on table public.supplier_bank_price_delta_reviews from anon;

alter table public.supplier_bank_suppliers enable row level security;
alter table public.supplier_bank_scrape_runs enable row level security;
alter table public.supplier_bank_products enable row level security;
alter table public.supplier_bank_price_snapshots enable row level security;
alter table public.supplier_bank_import_jobs enable row level security;
alter table public.supplier_bank_price_delta_reviews enable row level security;

drop policy if exists supplier_bank_suppliers_master_admin on public.supplier_bank_suppliers;
create policy supplier_bank_suppliers_master_admin
on public.supplier_bank_suppliers
for all
to authenticated
using (public.is_supplier_bank_master_admin())
with check (public.is_supplier_bank_master_admin());

drop policy if exists supplier_bank_scrape_runs_master_admin on public.supplier_bank_scrape_runs;
create policy supplier_bank_scrape_runs_master_admin
on public.supplier_bank_scrape_runs
for all
to authenticated
using (public.is_supplier_bank_master_admin())
with check (public.is_supplier_bank_master_admin());

drop policy if exists supplier_bank_products_master_admin on public.supplier_bank_products;
create policy supplier_bank_products_master_admin
on public.supplier_bank_products
for all
to authenticated
using (public.is_supplier_bank_master_admin())
with check (public.is_supplier_bank_master_admin());

drop policy if exists supplier_bank_price_snapshots_master_admin on public.supplier_bank_price_snapshots;
create policy supplier_bank_price_snapshots_master_admin
on public.supplier_bank_price_snapshots
for all
to authenticated
using (public.is_supplier_bank_master_admin())
with check (public.is_supplier_bank_master_admin());

drop policy if exists supplier_bank_import_jobs_master_admin on public.supplier_bank_import_jobs;
create policy supplier_bank_import_jobs_master_admin
on public.supplier_bank_import_jobs
for all
to authenticated
using (public.is_supplier_bank_master_admin())
with check (public.is_supplier_bank_master_admin());

drop policy if exists supplier_bank_price_delta_reviews_master_admin on public.supplier_bank_price_delta_reviews;
create policy supplier_bank_price_delta_reviews_master_admin
on public.supplier_bank_price_delta_reviews
for all
to authenticated
using (public.is_supplier_bank_master_admin())
with check (public.is_supplier_bank_master_admin());

create index if not exists idx_supplier_bank_suppliers_enabled
  on public.supplier_bank_suppliers(enabled, slug);

create index if not exists idx_supplier_bank_scrape_runs_supplier_status
  on public.supplier_bank_scrape_runs(supplier_id, status, created_at desc);

create index if not exists idx_supplier_bank_products_family_status
  on public.supplier_bank_products(product_family, status, updated_at desc);

create index if not exists idx_supplier_bank_products_supplier
  on public.supplier_bank_products(supplier_id, supplier_product_key);

create index if not exists idx_supplier_bank_price_snapshots_product
  on public.supplier_bank_price_snapshots(bank_product_id, created_at desc);

create index if not exists idx_supplier_bank_import_jobs_product
  on public.supplier_bank_import_jobs(bank_product_id, created_at desc);

create index if not exists idx_supplier_bank_price_delta_reviews_product
  on public.supplier_bank_price_delta_reviews(bank_product_id, created_at desc);

create index if not exists idx_supplier_bank_price_delta_reviews_status
  on public.supplier_bank_price_delta_reviews(status, created_at desc);

comment on table public.supplier_bank_suppliers is
  'Master-admin registry of print-house suppliers for the supplier product bank.';
comment on table public.supplier_bank_scrape_runs is
  'Audit log for supplier catalog discovery, product extraction, and price refresh runs.';
comment on table public.supplier_bank_products is
  'Normalized supplier product drafts staged before explicit import into Webprinter products.';
comment on table public.supplier_bank_price_snapshots is
  'Immutable-ish supplier price snapshots for bank products; does not drive live storefront pricing directly.';
comment on table public.supplier_bank_import_jobs is
  'Explicit admin import/dry-run records from supplier bank products into existing Webprinter product systems.';
comment on table public.supplier_bank_price_delta_reviews is
  'Manual review records for supplier-bank price changes between immutable price snapshots; does not update live storefront pricing.';
