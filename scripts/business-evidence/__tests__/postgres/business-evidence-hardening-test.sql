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

insert into public.orders (id, tenant_id, user_id) values
  (
    '60000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000006'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000007'
  );

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

select set_config('request.jwt.claim.sub', '50000000-0000-4000-8000-000000000006', false);
select public.test_assert(
  (select count(*) = 1 from public.carrier_tracking_events_v1),
  'customer must read carrier evidence for exactly their own order'
);
select public.test_assert(
  not exists (
    select 1
    from public.carrier_tracking_events_v1
    where order_id = '60000000-0000-4000-8000-000000000002'
  ),
  'customer must not read unrelated-order carrier evidence'
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
  not has_function_privilege(
    'authenticated',
    'public.persist_postnord_tracking_events_v1(jsonb)',
    'EXECUTE'
  ),
  'authenticated must not call the atomic carrier persistence RPC'
);
select public.test_assert(
  not has_function_privilege(
    'anon',
    'public.persist_postnord_tracking_events_v1(jsonb)',
    'EXECUTE'
  ),
  'anon must not call the atomic carrier persistence RPC'
);
select public.test_assert(
  has_function_privilege(
    'service_role',
    'public.persist_postnord_tracking_events_v1(jsonb)',
    'EXECUTE'
  ),
  'service_role must be able to call the atomic carrier persistence RPC'
);
select public.test_assert(
  not has_table_privilege(
    'service_role',
    'public.carrier_tracking_events_v1',
    'INSERT'
  ),
  'service_role must persist carrier evidence only through the atomic RPC'
);

do $test$
declare
  first_result record;
  replay_result record;
  rollback_failed boolean := false;
begin
  set local role service_role;

  select * into first_result
  from public.persist_postnord_tracking_events_v1(
    jsonb_build_array(jsonb_build_object(
      'tenant_id', '10000000-0000-4000-8000-000000000001',
      'order_id', '60000000-0000-4000-8000-000000000001',
      'schema_version', 1,
      'carrier', 'postnord',
      'tracking_number', 'TRACK-RPC',
      'provider_event_id', 'rpc-event-1',
      'provider_event_code', '31',
      'fallback_dedupe_key', repeat('a', 64),
      'provider_status', 'EN_ROUTE',
      'display_type', 'in_transit',
      'occurred_at', '2026-08-01T09:00:00.000Z',
      'received_at', '2026-08-01T09:00:01.000Z',
      'location', 'Taulov',
      'description', 'Undervejs',
      'source_digest', repeat('b', 64)
    ))
  );
  perform public.test_assert(
    first_result.inserted_count = 1 and first_result.replayed_count = 0,
    'first atomic carrier event must insert'
  );

  select * into replay_result
  from public.persist_postnord_tracking_events_v1(
    jsonb_build_array(jsonb_build_object(
      'tenant_id', '10000000-0000-4000-8000-000000000001',
      'order_id', '60000000-0000-4000-8000-000000000001',
      'schema_version', 1,
      'carrier', 'postnord',
      'tracking_number', 'TRACK-RPC',
      'provider_event_id', 'rpc-event-1',
      'provider_event_code', '31',
      'fallback_dedupe_key', repeat('a', 64),
      'provider_status', 'EN_ROUTE',
      'display_type', 'in_transit',
      'occurred_at', '2026-08-01T09:00:00.000Z',
      'received_at', '2026-08-01T10:00:01.000Z',
      'location', 'Taulov',
      'description', 'Undervejs',
      'source_digest', repeat('c', 64)
    ))
  );
  perform public.test_assert(
    replay_result.inserted_count = 0 and replay_result.replayed_count = 1,
    'exact immutable replay must not insert a second carrier event'
  );

  perform public.persist_postnord_tracking_events_v1(
    jsonb_build_array(jsonb_build_object(
      'tenant_id', '10000000-0000-4000-8000-000000000001',
      'order_id', '60000000-0000-4000-8000-000000000001',
      'schema_version', 1,
      'carrier', 'postnord',
      'tracking_number', 'TRACK-ROLLBACK',
      'provider_event_id', 'rollback-conflict',
      'provider_event_code', '31',
      'fallback_dedupe_key', repeat('d', 64),
      'provider_status', 'EN_ROUTE',
      'display_type', 'in_transit',
      'occurred_at', '2026-08-01T11:00:00.000Z',
      'received_at', '2026-08-01T11:00:01.000Z',
      'location', null,
      'description', null,
      'source_digest', repeat('e', 64)
    ))
  );

  begin
    perform public.persist_postnord_tracking_events_v1(jsonb_build_array(
      jsonb_build_object(
        'tenant_id', '10000000-0000-4000-8000-000000000001',
        'order_id', '60000000-0000-4000-8000-000000000001',
        'schema_version', 1,
        'carrier', 'postnord',
        'tracking_number', 'TRACK-ROLLBACK',
        'provider_event_id', 'rollback-first',
        'provider_event_code', '68',
        'fallback_dedupe_key', repeat('f', 64),
        'provider_status', 'INFORMED',
        'display_type', 'information',
        'occurred_at', '2026-08-01T10:30:00.000Z',
        'received_at', '2026-08-01T11:30:01.000Z',
        'location', null,
        'description', null,
        'source_digest', repeat('1', 64)
      ),
      jsonb_build_object(
        'tenant_id', '10000000-0000-4000-8000-000000000001',
        'order_id', '60000000-0000-4000-8000-000000000001',
        'schema_version', 1,
        'carrier', 'postnord',
        'tracking_number', 'TRACK-ROLLBACK',
        'provider_event_id', 'rollback-conflict',
        'provider_event_code', '21',
        'fallback_dedupe_key', repeat('2', 64),
        'provider_status', 'DELIVERED',
        'display_type', 'delivered',
        'occurred_at', '2026-08-01T12:00:00.000Z',
        'received_at', '2026-08-01T12:00:01.000Z',
        'location', null,
        'description', null,
        'source_digest', repeat('3', 64)
      )
    ));
  exception when others then
    rollback_failed := true;
  end;

  perform public.test_assert(
    rollback_failed,
    'conflicting event N must fail the entire atomic carrier batch'
  );
  perform public.test_assert(
    not exists (
      select 1 from public.carrier_tracking_events_v1
      where tracking_number = 'TRACK-ROLLBACK'
        and provider_event_id = 'rollback-first'
    ),
    'event one must roll back when a later carrier event conflicts'
  );
end;
$test$;

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
