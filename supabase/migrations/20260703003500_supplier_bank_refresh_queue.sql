-- ============================================================
-- Supplier Product Bank Refresh Queue
-- Additive queue for audited supplier-bank refresh requests.
-- It does not scrape suppliers, create snapshots, import products,
-- publish products, or write live storefront pricing by itself.
-- Date: 2026-07-03
--
-- Rollback note:
-- drop table if exists public.supplier_bank_refresh_jobs;
-- ============================================================

create table if not exists public.supplier_bank_refresh_jobs (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.supplier_bank_suppliers(id) on delete set null,
  bank_product_id uuid not null references public.supplier_bank_products(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  mode text not null default 'price_refresh'
    check (mode in ('catalog_discovery', 'product_extract', 'price_refresh')),
  tool text not null default 'playwright'
    check (tool in ('firecrawl', 'playwright', 'supplier_api', 'static_fetch', 'manual')),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  priority integer not null default 100,
  request_summary jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  error text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.supplier_bank_refresh_jobs to authenticated;
grant all on public.supplier_bank_refresh_jobs to service_role;
revoke all on table public.supplier_bank_refresh_jobs from anon;

alter table public.supplier_bank_refresh_jobs enable row level security;

drop policy if exists supplier_bank_refresh_jobs_master_admin on public.supplier_bank_refresh_jobs;
create policy supplier_bank_refresh_jobs_master_admin
on public.supplier_bank_refresh_jobs
for all
to authenticated
using (public.is_supplier_bank_master_admin())
with check (public.is_supplier_bank_master_admin());

create index if not exists idx_supplier_bank_refresh_jobs_product
  on public.supplier_bank_refresh_jobs(bank_product_id, status, queued_at desc);

create index if not exists idx_supplier_bank_refresh_jobs_status
  on public.supplier_bank_refresh_jobs(status, queued_at desc);

comment on table public.supplier_bank_refresh_jobs is
  'Queued supplier-bank refresh requests. Workers may turn these into scrape runs, snapshots, and delta reviews; this table does not update live storefront pricing.';
