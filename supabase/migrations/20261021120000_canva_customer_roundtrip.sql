-- Private server-owned state: customers access this only through canva-workflow.
create table public.canva_customer_connections (
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  token_ciphertext text not null,
  expires_at timestamptz not null,
  lock_until timestamptz not null default 'epoch',
  primary key (user_id, tenant_id)
);
create table public.canva_customer_oauth (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  verifier_ciphertext text not null,
  redirect_uri text not null,
  expires_at timestamptz not null
);
create table public.canva_customer_drafts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id),
  template_key text not null,
  source_design_id text not null,
  design_id text,
  status text not null default 'starting' check (status in ('starting','uploading','filling','ready','failed')),
  text_values jsonb not null,
  checkout_state jsonb not null,
  upload_job_id text,
  autofill_job_id text,
  export_job_id text,
  export_request_id uuid,
  export_starting boolean not null default false,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (design_id is null or design_id <> source_design_id)
);
create index canva_customer_drafts_owner on public.canva_customer_drafts(user_id,tenant_id,created_at desc);
alter table public.canva_customer_connections enable row level security;
alter table public.canva_customer_oauth enable row level security;
alter table public.canva_customer_drafts enable row level security;
revoke all on public.canva_customer_connections, public.canva_customer_oauth, public.canva_customer_drafts from public, anon, authenticated;
grant select, insert, update, delete on public.canva_customer_connections, public.canva_customer_oauth, public.canva_customer_drafts to service_role;
-- data-api: private canva_customer_connections
-- data-api: private canva_customer_oauth
-- data-api: private canva_customer_drafts
-- Rollback: disable CANVA_WORKFLOW_ENABLED and VITE_CANVA_WORKFLOW_ENABLED.
-- Keep the private tables and existing customer records; do not restore public grants.
