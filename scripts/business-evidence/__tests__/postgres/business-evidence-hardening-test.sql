\set ON_ERROR_STOP on

insert into public.tenants (id, owner_id, name, settings) values
  (
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'Tenant A',
    '{"company":{"business_identity_v1":{"schemaVersion":1,"normalizedCvr":"12345678","viesVatId":"DK12345678"}}}'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    'Tenant B',
    '{"company":{"business_identity_v1":{"schemaVersion":1,"normalizedCvr":"87654321","viesVatId":"DK87654321"}}}'
  );

insert into public.user_roles (user_id, role, tenant_id) values
  ('50000000-0000-4000-8000-000000000003', 'master_admin', null),
  ('50000000-0000-4000-8000-000000000004', 'user', null),
  ('50000000-0000-4000-8000-000000000005', 'admin', null);

update public.tenants
set name = ''
where id = '10000000-0000-4000-8000-000000000001';
select public.test_assert(
  (select name = '' from public.tenants where id = '10000000-0000-4000-8000-000000000001'),
  'an empty string must clear tenants.name without violating its NOT NULL invariant'
);

insert into public.orders (id, tenant_id) values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
  ('60000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002');

insert into public.tenant_business_evidence (
  tenant_id, evidence_type, normalized_identifier, provider, result_status,
  checked_at, received_at, request_fingerprint, response_digest
) values
  (
    '10000000-0000-4000-8000-000000000001', 'vies', 'DK12345678', 'EU VIES', 'valid',
    '2026-08-01T08:00:00Z', '2026-08-01T08:00:01Z', repeat('a', 64), repeat('b', 64)
  ),
  (
    '20000000-0000-4000-8000-000000000002', 'vies', 'DK87654321', 'EU VIES', 'valid',
    '2026-08-01T08:00:00Z', '2026-08-01T08:00:01Z', repeat('c', 64), repeat('d', 64)
  );

insert into public.carrier_tracking_events_v1 (
  tenant_id, order_id, carrier, tracking_number, provider_event_id,
  fallback_dedupe_key, provider_status, display_type, occurred_at,
  received_at, source_digest
) values
  (
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'postnord', 'TRACK-A', 'event-a', repeat('1', 64), 'IN_TRANSIT',
    'in_transit', '2026-08-01T08:00:00Z', '2026-08-01T08:00:01Z', repeat('2', 64)
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000002',
    'postnord', 'TRACK-B', 'event-b', repeat('3', 64), 'DELIVERED',
    'delivered', '2026-08-01T08:00:00Z', '2026-08-01T08:00:01Z', repeat('4', 64)
  );

alter table public.carrier_tracking_events_v1
  disable trigger carrier_tracking_events_v1_order_tenant_guard;
insert into public.carrier_tracking_events_v1 (
  tenant_id, order_id, carrier, tracking_number, provider_event_id,
  fallback_dedupe_key, provider_status, display_type, occurred_at,
  received_at, source_digest
) values (
  '10000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000002',
  'postnord', 'TRACK-MISMATCHED', 'event-mismatched', repeat('5', 64),
  'IN_TRANSIT', 'in_transit', '2026-08-01T08:00:00Z',
  '2026-08-01T08:00:01Z', repeat('6', 64)
);
alter table public.carrier_tracking_events_v1
  enable trigger carrier_tracking_events_v1_order_tenant_guard;

set role authenticated;
select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000001', false);
select public.test_assert(
  (select count(*) = 1 from public.tenant_business_evidence),
  'tenant owner must read only its business evidence'
);
select public.test_assert(
  (select count(*) = 1 from public.carrier_tracking_events_v1),
  'tenant owner must read only carrier rows with an exact tenant/order match'
);

select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000003', false);
select public.test_assert(
  (select count(*) = 2 from public.tenant_business_evidence),
  'exact master role must read business evidence for all tenants'
);
select public.test_assert(
  (select count(*) = 3 from public.carrier_tracking_events_v1),
  'exact master role must read all carrier evidence without the ordinary tenant/order guard'
);

select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000004', false);
select public.test_assert(
  (select count(*) = 0 from public.tenant_business_evidence),
  'unrelated authenticated user must not read business evidence'
);
select public.test_assert(
  (select count(*) = 0 from public.carrier_tracking_events_v1),
  'unrelated authenticated user must not read carrier evidence'
);

select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000005', false);
select public.test_assert(
  (select count(*) = 0 from public.tenant_business_evidence),
  'the admin role must not inherit exact master business-evidence access'
);
select public.test_assert(
  (select count(*) = 0 from public.carrier_tracking_events_v1),
  'the admin role must not inherit exact master carrier-evidence access'
);
reset role;

select public.test_assert(
  not has_table_privilege('authenticated', 'public.tenant_business_evidence_request_claims', 'SELECT'),
  'authenticated must not read private request claims'
);
select public.test_assert(
  not has_table_privilege('authenticated', 'public.tenant_business_evidence_request_claims', 'INSERT'),
  'authenticated must not write private request claims'
);
select public.test_assert(
  not has_table_privilege('anon', 'public.tenant_business_evidence_request_claims', 'SELECT'),
  'anon must not read private request claims'
);
select public.test_assert(
  (
    select relrowsecurity
    from pg_catalog.pg_class
    where oid = 'public.tenant_business_evidence_request_claims'::regclass
  ),
  'private request claims must keep RLS enabled'
);
select public.test_assert(
  has_table_privilege('service_role', 'public.tenant_business_evidence_request_claims', 'INSERT'),
  'service_role must be able to store private request claims'
);
select public.test_assert(
  not has_function_privilege(
    'authenticated',
    'public.claim_tenant_business_evidence_request(uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  'authenticated must not call the service-role claim RPC'
);
select public.test_assert(
  not has_function_privilege(
    'anon',
    'public.claim_tenant_business_evidence_request(uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  'anon must not call the service-role claim RPC'
);
select public.test_assert(
  has_function_privilege(
    'service_role',
    'public.claim_tenant_business_evidence_request(uuid,uuid,text,text,text)',
    'EXECUTE'
  ),
  'service_role must be able to call the claim RPC'
);

insert into public.tenant_business_evidence_request_claims (
  tenant_id, user_id, operation, provider, request_fingerprint,
  claimed_at, claim_expires_at
) values (
  '20000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000002',
  'danish_company',
  'Datafordeler CVR',
  repeat('7', 64),
  clock_timestamp() - interval '25 hours',
  clock_timestamp() - interval '25 hours' + interval '30 seconds'
);

select disposition
from public.claim_tenant_business_evidence_request(
  '10000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  'danish_address',
  'Datafordeler DAR',
  repeat('8', 64)
);
select public.test_assert(
  not exists (
    select 1
    from public.tenant_business_evidence_request_claims
    where request_fingerprint = repeat('7', 64)
  ),
  'each admission must prune request telemetry older than 24 hours across inactive scopes'
);

select 'business evidence RLS and grant checks passed' as result;
