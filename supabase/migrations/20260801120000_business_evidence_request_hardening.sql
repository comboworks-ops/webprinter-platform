-- Harden display-only business evidence reads and provider request admission.
--
-- Rollback (evidence rows remain untouched):
-- 1. Disable tenant-business-evidence before removing its admission RPC.
-- 2. Revoke/drop public.claim_tenant_business_evidence_request(uuid,uuid,text,text,text).
-- 3. Drop public.tenant_business_evidence_request_claims; only short-lived
--    non-secret quota/claim telemetry is removed.
-- 4. Restore tenant_business_evidence_tenant_read and
--    carrier_tracking_events_v1_tenant_order_read from migration
--    20260731120000_reference_integration_evidence.sql.
-- Existing tenant settings, business evidence, carrier events, orders,
-- products, prices, checkout, invoices, POD, and ERP data are untouched.

drop policy if exists tenant_business_evidence_tenant_read
  on public.tenant_business_evidence;

create policy tenant_business_evidence_tenant_read
on public.tenant_business_evidence
for select to authenticated
using (
  public.has_role(auth.uid(), 'master_admin')
  or public.can_access_tenant(tenant_id)
);

drop policy if exists carrier_tracking_events_v1_tenant_order_read
  on public.carrier_tracking_events_v1;

create policy carrier_tracking_events_v1_tenant_order_read
on public.carrier_tracking_events_v1
for select to authenticated
using (
  public.has_role(auth.uid(), 'master_admin')
  or (
    public.can_access_tenant(carrier_tracking_events_v1.tenant_id)
    and exists (
      select 1
      from public.orders
      where orders.id = carrier_tracking_events_v1.order_id
        and orders.tenant_id = carrier_tracking_events_v1.tenant_id
    )
  )
);

create table public.tenant_business_evidence_request_claims (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null,
  operation text not null
    check (operation in ('vies', 'danish_company', 'danish_address')),
  provider text not null
    check (
      (operation = 'vies' and provider = 'EU VIES')
      or (operation = 'danish_company' and provider = 'Datafordeler CVR')
      or (operation = 'danish_address' and provider = 'Datafordeler DAR')
    ),
  request_fingerprint text not null
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  claimed_at timestamptz not null default clock_timestamp(),
  claim_expires_at timestamptz not null,
  check (claim_expires_at > claimed_at),
  check (claim_expires_at <= claimed_at + interval '1 minute')
);

comment on table public.tenant_business_evidence_request_claims is
  'Private, non-secret admission history for atomic provider idempotency and bounded per-user/per-tenant quotas; every admission prunes telemetry older than 24 hours.';

create index tenant_business_evidence_claim_fingerprint_idx
  on public.tenant_business_evidence_request_claims
  (tenant_id, provider, request_fingerprint, claim_expires_at desc);

create index tenant_business_evidence_claim_quota_idx
  on public.tenant_business_evidence_request_claims
  (tenant_id, operation, provider, claimed_at desc, user_id);

create index tenant_business_evidence_claim_retention_idx
  on public.tenant_business_evidence_request_claims (claimed_at);

alter table public.tenant_business_evidence_request_claims
  enable row level security;

-- data-api: private claim telemetry; only the service-role RPC may admit work.
revoke all on table public.tenant_business_evidence_request_claims
  from public, anon, authenticated;
grant all on table public.tenant_business_evidence_request_claims
  to service_role;

create function public.claim_tenant_business_evidence_request(
  _tenant_id uuid,
  _user_id uuid,
  _operation text,
  _provider text,
  _request_fingerprint text
)
returns table(disposition text, retry_after_seconds integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  claim_time timestamptz := clock_timestamp();
  has_replay boolean;
  active_retry_after integer;
  user_request_count integer;
  tenant_request_count integer;
begin
  if _tenant_id is null
     or _user_id is null
     or _user_id = '00000000-0000-0000-0000-000000000000'::uuid
     or _request_fingerprint is null
     or _request_fingerprint !~ '^[a-f0-9]{64}$'
     or not (
       (_operation = 'vies' and _provider = 'EU VIES')
       or (_operation = 'danish_company' and _provider = 'Datafordeler CVR')
       or (_operation = 'danish_address' and _provider = 'Datafordeler DAR')
     ) then
    raise exception using
      errcode = '22023',
      message = 'invalid business evidence admission request';
  end if;

  -- Serializing the tenant/provider scope makes both the in-flight decision
  -- and its tenant-wide quota exact under concurrent Edge invocations.
  perform pg_advisory_xact_lock(
    hashtextextended(
      'tenant-business-evidence:' || _tenant_id::text || ':' || _operation || ':' || _provider,
      0
    )
  );

  delete from public.tenant_business_evidence_request_claims
  where claimed_at < claim_time - interval '24 hours';

  select exists (
    select 1
    from public.tenant_business_evidence
    where tenant_id = _tenant_id
      and provider = _provider
      and request_fingerprint = _request_fingerprint
  ) into has_replay;

  if not has_replay then
    select greatest(
      1,
      ceil(extract(epoch from (claim_expires_at - claim_time)))::integer
    )
    into active_retry_after
    from public.tenant_business_evidence_request_claims
    where tenant_id = _tenant_id
      and operation = _operation
      and provider = _provider
      and request_fingerprint = _request_fingerprint
      and claim_expires_at > claim_time
    order by claim_expires_at desc
    limit 1;
  end if;

  select count(*)::integer
  into user_request_count
  from public.tenant_business_evidence_request_claims
  where tenant_id = _tenant_id
    and user_id = _user_id
    and operation = _operation
    and provider = _provider
    and claimed_at >= claim_time - interval '10 minutes';

  select count(*)::integer
  into tenant_request_count
  from public.tenant_business_evidence_request_claims
  where tenant_id = _tenant_id
    and operation = _operation
    and provider = _provider
    and claimed_at >= claim_time - interval '10 minutes';

  if user_request_count >= 12 or tenant_request_count >= 60 then
    return query select 'rate_limited'::text, 600::integer;
    return;
  end if;

  insert into public.tenant_business_evidence_request_claims (
    tenant_id,
    user_id,
    operation,
    provider,
    request_fingerprint,
    claimed_at,
    claim_expires_at
  ) values (
    _tenant_id,
    _user_id,
    _operation,
    _provider,
    _request_fingerprint,
    claim_time,
    case
      when has_replay or active_retry_after is not null
        then claim_time + interval '1 microsecond'
      else claim_time + interval '30 seconds'
    end
  );

  if has_replay then
    return query select 'replay'::text, 0::integer;
    return;
  end if;
  if active_retry_after is not null then
    return query select 'in_flight'::text, active_retry_after;
    return;
  end if;
  return query select 'claimed'::text, 0::integer;
end;
$$;

-- data-api: private service-role admission RPC; browser/authenticated callers
-- cannot consume shared provider credentials or inspect quota state directly.
revoke execute on function public.claim_tenant_business_evidence_request(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.claim_tenant_business_evidence_request(
  uuid, uuid, text, text, text
) to service_role;
