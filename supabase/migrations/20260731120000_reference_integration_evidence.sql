-- Additive, read-only reference evidence for opt-in provider integrations.
--
-- Rollback order:
-- 1. Disable reference-fx-snapshot, tenant-business-evidence, and postnord-tracking-sync.
-- 2. Stop all reference-integration cron invocations.
-- 3. Drop policies and explicit grants/functions introduced here.
-- 4. Drop carrier_tracking_events_v1, tenant_business_evidence, supplier_fx_rate_snapshots.
-- Existing products, product prices, orders, delivery_tracking, POD tables, and ERP shadow files are untouched.

create table public.supplier_fx_rate_snapshots (
  id uuid primary key default gen_random_uuid(),
  schema_version smallint not null default 1
    check (schema_version = 1),
  provider text not null
    check (provider = 'frankfurter_ecb'),
  base_currency text not null
    check (base_currency = 'EUR'),
  quote_currency text not null
    check (quote_currency = 'DKK'),
  rate numeric not null
    check (rate > 0 and rate <= 100)
    check (scale(rate) between 0 and 6),
  rate_date date not null,
  fetched_at timestamptz not null,
  source_payload_sha256 text not null
    check (source_payload_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (provider, base_currency, quote_currency, rate_date, source_payload_sha256),
  check (rate_date <= (fetched_at at time zone 'UTC')::date)
);

comment on table public.supplier_fx_rate_snapshots is
  'Immutable non-secret EUR/DKK provider evidence. It never reprices a product by itself.';

create table public.tenant_business_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  schema_version smallint not null default 1
    check (schema_version = 1),
  evidence_type text not null
    check (evidence_type in ('vies', 'danish_company', 'danish_address')),
  normalized_identifier text not null
    check (
      char_length(normalized_identifier) between 1 and 256
      and normalized_identifier = btrim(normalized_identifier)
    ),
  provider text not null
    check (
      char_length(provider) between 1 and 80
      and provider = btrim(provider)
    ),
  result_status text not null
    check (result_status in ('unknown', 'pending', 'valid', 'invalid', 'unavailable', 'stale')),
  provider_reference text
    check (
      provider_reference is null
      or (
        char_length(provider_reference) between 1 and 256
        and provider_reference = btrim(provider_reference)
      )
    ),
  checked_at timestamptz not null,
  received_at timestamptz not null default now(),
  request_fingerprint text not null
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  response_digest text not null
    check (response_digest ~ '^[a-f0-9]{64}$'),
  display_fields jsonb not null default '{}'::jsonb
    check (
      jsonb_typeof(display_fields) = 'object'
      and octet_length(display_fields::text) <= 8192
    ),
  created_at timestamptz not null default now(),
  unique (tenant_id, provider, request_fingerprint)
);

comment on table public.tenant_business_evidence is
  'Minimal versioned display evidence for tenant-scoped VIES, CVR, or Danish address checks; never authoritative for tax or onboarding.';

create table public.carrier_tracking_events_v1 (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  schema_version smallint not null default 1
    check (schema_version = 1),
  carrier text not null
    check (carrier = 'postnord'),
  tracking_number text not null
    check (
      char_length(tracking_number) between 1 and 100
      and tracking_number = btrim(tracking_number)
    ),
  provider_event_id text
    check (
      provider_event_id is null
      or (
        char_length(provider_event_id) between 1 and 256
        and provider_event_id = btrim(provider_event_id)
      )
    ),
  fallback_dedupe_key text not null
    check (fallback_dedupe_key ~ '^[a-f0-9]{64}$'),
  provider_status text not null
    check (
      char_length(provider_status) between 1 and 120
      and provider_status = btrim(provider_status)
    ),
  display_type text not null
    check (
      display_type in (
        'information',
        'in_transit',
        'out_for_delivery',
        'available_for_pickup',
        'delivered',
        'exception',
        'unknown'
      )
    ),
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  location text
    check (
      location is null
      or (
        char_length(location) between 1 and 256
        and location = btrim(location)
      )
    ),
  description text
    check (
      description is null
      or (
        char_length(description) between 1 and 500
        and description = btrim(description)
      )
    ),
  source_digest text not null
    check (source_digest ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (carrier, tracking_number, provider_event_id),
  unique (carrier, tracking_number, fallback_dedupe_key)
);

comment on table public.carrier_tracking_events_v1 is
  'Immutable display-only PostNord evidence. Rows do not imply or mutate Webprinter order status.';

create index tenant_business_evidence_tenant_checked_idx
  on public.tenant_business_evidence (tenant_id, checked_at desc);

create index carrier_tracking_events_v1_order_occurred_idx
  on public.carrier_tracking_events_v1 (tenant_id, order_id, occurred_at desc);

create function public.reject_reference_evidence_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'reference evidence rows are immutable';
end;
$$;

create function public.enforce_reference_tracking_order_tenant()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  perform 1
  from public.orders
  where id = new.order_id
    and tenant_id = new.tenant_id
  for share;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'tracking evidence order does not belong to tenant';
  end if;

  return new;
end;
$$;

-- data-api: private trigger function; it has no callable Data API surface.
revoke execute on function public.reject_reference_evidence_mutation()
  from public, anon, authenticated, service_role;

-- data-api: private integrity trigger; it has no callable Data API surface.
revoke execute on function public.enforce_reference_tracking_order_tenant()
  from public, anon, authenticated, service_role;

create trigger supplier_fx_rate_snapshots_immutable
before update or delete on public.supplier_fx_rate_snapshots
for each row execute function public.reject_reference_evidence_mutation();

create trigger tenant_business_evidence_immutable
before update on public.tenant_business_evidence
for each row execute function public.reject_reference_evidence_mutation();

create trigger carrier_tracking_events_v1_immutable
before update on public.carrier_tracking_events_v1
for each row execute function public.reject_reference_evidence_mutation();

create trigger carrier_tracking_events_v1_order_tenant_guard
before insert on public.carrier_tracking_events_v1
for each row execute function public.enforce_reference_tracking_order_tenant();

alter table public.supplier_fx_rate_snapshots enable row level security;
alter table public.tenant_business_evidence enable row level security;
alter table public.carrier_tracking_events_v1 enable row level security;

create policy supplier_fx_rate_snapshots_authenticated_read
on public.supplier_fx_rate_snapshots
for select to authenticated
using (true);

create policy tenant_business_evidence_tenant_read
on public.tenant_business_evidence
for select to authenticated
using (public.can_access_tenant(tenant_id));

create policy carrier_tracking_events_v1_tenant_order_read
on public.carrier_tracking_events_v1
for select to authenticated
using (
  public.can_access_tenant(carrier_tracking_events_v1.tenant_id)
  and exists (
    select 1
    from public.orders
    where orders.id = carrier_tracking_events_v1.order_id
      and orders.tenant_id = carrier_tracking_events_v1.tenant_id
  )
);

-- data-api: authenticated users read provider reference evidence; service_role is the only writer.
revoke all on table public.supplier_fx_rate_snapshots from public, anon, authenticated;
grant select on table public.supplier_fx_rate_snapshots to authenticated;
grant all on table public.supplier_fx_rate_snapshots to service_role;

-- data-api: authenticated reads remain tenant-scoped by RLS; service_role is the only writer.
revoke all on table public.tenant_business_evidence from public, anon, authenticated;
grant select on table public.tenant_business_evidence to authenticated;
grant all on table public.tenant_business_evidence to service_role;

-- data-api: authenticated reads require tenant access plus an exact order/tenant match; service_role is the only writer.
revoke all on table public.carrier_tracking_events_v1 from public, anon, authenticated;
grant select on table public.carrier_tracking_events_v1 to authenticated;
grant all on table public.carrier_tracking_events_v1 to service_role;
