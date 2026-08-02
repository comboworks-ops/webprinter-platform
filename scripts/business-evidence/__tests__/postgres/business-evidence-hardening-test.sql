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
  checked_at, received_at, request_fingerprint, response_digest,
  evidence_digest
) values
  (
    '10000000-0000-4000-8000-000000000001', 'vies', 'DK12345678', 'EU VIES', 'valid',
    '2026-08-01T08:00:00Z', '2026-08-01T08:00:01Z', repeat('a', 64), repeat('b', 64), repeat('e', 64)
  ),
  (
    '20000000-0000-4000-8000-000000000002', 'vies', 'DK87654321', 'EU VIES', 'valid',
    '2026-08-01T08:00:00Z', '2026-08-01T08:00:01Z', repeat('c', 64), repeat('d', 64), repeat('f', 64)
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

do $evidence_delete_privileges$
declare
  role_name text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    perform public.test_assert(
      not has_table_privilege(
        role_name,
        'public.tenant_business_evidence',
        'DELETE'
      ),
      role_name || ' must not directly delete tenant business evidence'
    );
    perform public.test_assert(
      not has_table_privilege(
        role_name,
        'public.carrier_tracking_events_v1',
        'DELETE'
      ),
      role_name || ' must not directly delete carrier evidence'
    );
  end loop;
end;
$evidence_delete_privileges$;

set role service_role;
do $service_role_delete_denied$
declare
  business_delete_denied boolean := false;
  carrier_delete_denied boolean := false;
begin
  begin
    delete from public.tenant_business_evidence
    where tenant_id = '10000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then
    business_delete_denied := true;
  end;
  begin
    delete from public.carrier_tracking_events_v1
    where tenant_id = '10000000-0000-4000-8000-000000000001';
  exception when insufficient_privilege then
    carrier_delete_denied := true;
  end;
  perform public.test_assert(
    business_delete_denied and carrier_delete_denied,
    'service role direct DELETE must be privilege-denied for both evidence tables'
  );
end;
$service_role_delete_denied$;
reset role;

do $evidence_updates_remain_immutable$
declare
  business_update_rejected boolean := false;
  carrier_update_rejected boolean := false;
begin
  begin
    update public.tenant_business_evidence
    set result_status = 'stale'
    where tenant_id = '10000000-0000-4000-8000-000000000001';
  exception when sqlstate '55000' then
    business_update_rejected := true;
  end;
  begin
    update public.carrier_tracking_events_v1
    set provider_status = 'STALE'
    where tenant_id = '10000000-0000-4000-8000-000000000001';
  exception when sqlstate '55000' then
    carrier_update_rejected := true;
  end;
  perform public.test_assert(
    business_update_rejected and carrier_update_rejected,
    'business and carrier evidence UPDATE must remain immutable'
  );
end;
$evidence_updates_remain_immutable$;

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

begin;
set local role service_role;
delete from public.orders
where id = '60000000-0000-4000-8000-000000000001';
select public.test_assert(
  not exists (
    select 1 from public.carrier_tracking_events_v1
    where order_id = '60000000-0000-4000-8000-000000000001'
  ),
  'authoritative order deletion must cascade its carrier evidence'
);
select public.test_assert(
  exists (
    select 1 from public.tenant_business_evidence
    where tenant_id = '10000000-0000-4000-8000-000000000001'
  ),
  'order deletion must not remove tenant business evidence'
);
select public.test_assert(
  exists (
    select 1 from public.carrier_tracking_events_v1
    where tenant_id = '20000000-0000-4000-8000-000000000002'
      and order_id = '60000000-0000-4000-8000-000000000002'
  ),
  'order deletion must leave unrelated tenant carrier evidence untouched'
);
rollback;
select public.test_assert(
  exists (
    select 1 from public.orders
    where id = '60000000-0000-4000-8000-000000000001'
  ) and exists (
    select 1 from public.carrier_tracking_events_v1
    where order_id = '60000000-0000-4000-8000-000000000001'
  ),
  'rolling back an order deletion must restore both order and carrier evidence'
);

begin;
set local role service_role;
delete from public.tenants
where id = '10000000-0000-4000-8000-000000000001';
select public.test_assert(
  not exists (
    select 1 from public.tenant_business_evidence
    where tenant_id = '10000000-0000-4000-8000-000000000001'
  ) and not exists (
    select 1 from public.orders
    where tenant_id = '10000000-0000-4000-8000-000000000001'
  ) and not exists (
    select 1 from public.carrier_tracking_events_v1
    where tenant_id = '10000000-0000-4000-8000-000000000001'
  ),
  'authoritative tenant deletion must cascade business evidence, orders, and carrier evidence'
);
select public.test_assert(
  exists (
    select 1 from public.tenants
    where id = '20000000-0000-4000-8000-000000000002'
  ) and exists (
    select 1 from public.orders
    where id = '60000000-0000-4000-8000-000000000002'
  ) and exists (
    select 1 from public.tenant_business_evidence
    where tenant_id = '20000000-0000-4000-8000-000000000002'
  ) and exists (
    select 1 from public.carrier_tracking_events_v1
    where tenant_id = '20000000-0000-4000-8000-000000000002'
      and order_id = '60000000-0000-4000-8000-000000000002'
  ),
  'tenant deletion must leave every unrelated tenant row untouched'
);
rollback;
select public.test_assert(
  exists (
    select 1 from public.tenants
    where id = '10000000-0000-4000-8000-000000000001'
  ) and exists (
    select 1 from public.tenant_business_evidence
    where tenant_id = '10000000-0000-4000-8000-000000000001'
  ) and exists (
    select 1 from public.orders
    where id = '60000000-0000-4000-8000-000000000001'
  ) and exists (
    select 1 from public.carrier_tracking_events_v1
    where order_id = '60000000-0000-4000-8000-000000000001'
  ),
  'rolling back a tenant deletion must restore its full evidence graph'
);

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
  not has_function_privilege(
    'service_role',
    'public.persist_postnord_tracking_events_v1(jsonb)',
    'EXECUTE'
  ),
  'service_role must not bypass fenced PostNord completion'
);
select public.test_assert(
  has_function_privilege(
    'service_role',
    'public.complete_postnord_tracking_sync(uuid,jsonb)',
    'EXECUTE'
  ),
  'service_role must complete PostNord work through the fenced RPC'
);
select public.test_assert(
  not has_table_privilege(
    'service_role',
    'public.carrier_tracking_events_v1',
    'INSERT'
  ),
  'service_role must persist carrier evidence only through the atomic RPC'
);

update public.orders
set tracking_number = 'TRACK-RPC'
where id = '60000000-0000-4000-8000-000000000001';

do $first_fenced_persistence$
declare
  owned_claim uuid;
  first_result record;
begin
  set local role service_role;
  select claim_token into owned_claim
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'TRACKRPC'
  );
  perform public.test_assert(owned_claim is not null, 'first carrier fetch must own a fence');
  select * into first_result
  from public.complete_postnord_tracking_sync(
    owned_claim,
    jsonb_build_array(jsonb_build_object(
      'tenant_id', '10000000-0000-4000-8000-000000000001',
      'order_id', '60000000-0000-4000-8000-000000000001',
      'schema_version', 1,
      'carrier', 'postnord',
      'tracking_number', 'TRACKRPC',
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
    'first fenced carrier completion must insert'
  );
end;
$first_fenced_persistence$;

update public.postnord_tracking_sync_claims
set cache_expires_at = clock_timestamp() - interval '1 second'
where status = 'succeeded' and tracking_identity = 'TRACKRPC';

do $fenced_replay$
declare
  owned_claim uuid;
  replay_result record;
begin
  set local role service_role;
  select claim_token into owned_claim
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'TRACKRPC'
  );
  select * into replay_result
  from public.complete_postnord_tracking_sync(
    owned_claim,
    jsonb_build_array(jsonb_build_object(
      'tenant_id', '10000000-0000-4000-8000-000000000001',
      'order_id', '60000000-0000-4000-8000-000000000001',
      'schema_version', 1,
      'carrier', 'postnord',
      'tracking_number', 'TRACKRPC',
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
end;
$fenced_replay$;

update public.orders
set tracking_number = 'TRACK-ROLLBACK'
where id = '60000000-0000-4000-8000-000000000001';

do $seed_rollback_conflict$
declare
  owned_claim uuid;
begin
  set local role service_role;
  select claim_token into owned_claim
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'TRACKROLLBACK'
  );
  perform public.complete_postnord_tracking_sync(
    owned_claim,
    jsonb_build_array(jsonb_build_object(
      'tenant_id', '10000000-0000-4000-8000-000000000001',
      'order_id', '60000000-0000-4000-8000-000000000001',
      'schema_version', 1,
      'carrier', 'postnord',
      'tracking_number', 'TRACKROLLBACK',
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
end;
$seed_rollback_conflict$;

update public.postnord_tracking_sync_claims
set cache_expires_at = clock_timestamp() - interval '1 second'
where status = 'succeeded' and tracking_identity = 'TRACKROLLBACK';

do $fenced_batch_rollback$
declare
  owned_claim uuid;
  rollback_failed boolean := false;
begin
  set local role service_role;
  select claim_token into owned_claim
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'TRACKROLLBACK'
  );
  begin
    perform public.complete_postnord_tracking_sync(owned_claim, jsonb_build_array(
      jsonb_build_object(
        'tenant_id', '10000000-0000-4000-8000-000000000001',
        'order_id', '60000000-0000-4000-8000-000000000001',
        'schema_version', 1,
        'carrier', 'postnord',
        'tracking_number', 'TRACKROLLBACK',
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
        'tracking_number', 'TRACKROLLBACK',
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
      where tracking_number = 'TRACKROLLBACK'
        and provider_event_id = 'rollback-first'
    ),
    'event one must roll back when a later carrier event conflicts'
  );
end;
$fenced_batch_rollback$;

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

select public.test_assert(
  not has_table_privilege('service_role', 'public.postnord_tracking_sync_claims', 'SELECT')
  and not has_table_privilege('service_role', 'public.postnord_tracking_sync_claims', 'INSERT')
  and not has_table_privilege('service_role', 'public.postnord_tracking_provider_state', 'SELECT')
  and not has_table_privilege('service_role', 'public.postnord_tracking_provider_state', 'UPDATE'),
  'service role must use only fenced PostNord state RPCs'
);
select public.test_assert(
  not has_function_privilege(
    'authenticated',
    'public.claim_postnord_tracking_sync(uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  'authenticated must not call PostNord admission directly'
);
select public.test_assert(
  has_function_privilege(
    'service_role',
    'public.claim_postnord_tracking_sync(uuid,uuid,uuid,text)',
    'EXECUTE'
  ),
  'service role must call PostNord admission before provider work'
);
select public.test_assert(
  has_function_privilege('service_role', 'public.renew_postnord_tracking_sync(uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.complete_postnord_tracking_sync(uuid,jsonb)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.finish_postnord_tracking_sync(uuid,text,integer)', 'EXECUTE'),
  'service role must own only the fenced PostNord lifecycle RPCs'
);
select public.test_assert(
  not has_function_privilege('authenticated', 'public.renew_postnord_tracking_sync(uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.complete_postnord_tracking_sync(uuid,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.finish_postnord_tracking_sync(uuid,text,integer)', 'EXECUTE'),
  'authenticated callers must not control PostNord claim state'
);

update public.orders
set tracking_number = '0037 3500-4895 3047 0000'
where id = '60000000-0000-4000-8000-000000000001';

truncate public.postnord_tracking_sync_claims;
truncate public.postnord_tracking_provider_state;

do $postnord_lifecycle$
declare
  first_disposition text;
  second_disposition text;
  third_disposition text;
  blocked_disposition text;
  blocked_retry integer;
  first_claim uuid;
  third_claim uuid;
  claim_rows integer;
begin
  select disposition, claim_token into first_disposition, first_claim
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '00373500489530470000'
  );
  select disposition into second_disposition
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '00373500489530470000'
  );
  perform public.test_assert(
    first_disposition = 'claimed'
      and first_claim is not null
      and second_disposition = 'in_flight',
    'one PostNord owner must admit and its immediate duplicate must stop locally'
  );
  select count(*) into claim_rows from public.postnord_tracking_sync_claims;
  perform public.test_assert(claim_rows = 1, 'in-flight rejection must not debit quota');
  perform public.test_assert(
    public.renew_postnord_tracking_sync(first_claim),
    'the current fenced owner must renew its lease'
  );
  perform public.test_assert(
    public.finish_postnord_tracking_sync(first_claim, 'failed', null) = 0,
    'provider failure must explicitly release its current fence'
  );

  select disposition, claim_token into third_disposition, third_claim
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '00373500489530470000'
  );
  perform public.test_assert(
    third_disposition = 'claimed' and third_claim is not null,
    'failure release must allow a successor with a higher fence'
  );
  perform public.test_assert(
    public.finish_postnord_tracking_sync(
      third_claim,
      'provider_rate_limited',
      120
    ) = 120,
    'provider 429 must retain its exact Retry-After value'
  );

  select disposition, retry_after_seconds
  into blocked_disposition, blocked_retry
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '00373500489530470000'
  );
  perform public.test_assert(
    blocked_disposition = 'provider_blocked'
      and blocked_retry between 119 and 120,
    'exact provider Retry-After must block the global provider before fetch'
  );
end;
$postnord_lifecycle$;

truncate public.postnord_tracking_sync_claims;
truncate public.postnord_tracking_provider_state;

do $postnord_long_retry_after$
declare
  owned_claim uuid;
  blocked_disposition text;
  blocked_retry integer;
begin
  select claim_token into owned_claim
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '00373500489530470000'
  );
  perform public.test_assert(
    public.finish_postnord_tracking_sync(
      owned_claim,
      'provider_rate_limited',
      7200
    ) = 7200,
    'valid long Retry-After values must be stored exactly'
  );
  select disposition, retry_after_seconds
  into blocked_disposition, blocked_retry
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '00373500489530470000'
  );
  perform public.test_assert(
    blocked_disposition = 'provider_blocked'
      and blocked_retry between 7199 and 7200,
    'long Retry-After must never wake before the provider deadline'
  );
end;
$postnord_long_retry_after$;

truncate public.postnord_tracking_sync_claims;
truncate public.postnord_tracking_provider_state;

do $postnord_unbounded_retry_after_sentinel$
declare
  owned_claim uuid;
  blocked_disposition text;
  blocked_retry integer;
begin
  select claim_token into owned_claim
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '00373500489530470000'
  );
  perform public.finish_postnord_tracking_sync(
    owned_claim,
    'provider_rate_limited',
    2147483647
  );
  perform public.test_assert(
    (
      select blocked_until = 'infinity'::timestamptz
      from public.postnord_tracking_provider_state
      where provider = 'postnord'
    ),
    'bounded maximum Retry-After must use an indefinite fail-closed sentinel'
  );
  select disposition, retry_after_seconds
  into blocked_disposition, blocked_retry
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '00373500489530470000'
  );
  perform public.test_assert(
    blocked_disposition = 'provider_blocked'
      and blocked_retry = 2147483647,
    'indefinite provider backoff must remain blocked without integer overflow'
  );
end;
$postnord_unbounded_retry_after_sentinel$;

truncate public.postnord_tracking_sync_claims;
truncate public.postnord_tracking_provider_state;

do $postnord_empty_success_cache$
declare
  owned_claim uuid;
  first_disposition text;
  cached_disposition text;
  first_count integer;
  cached_count integer;
  completion record;
begin
  select disposition, claim_token into first_disposition, owned_claim
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '00373500489530470000'
  );
  select * into completion
  from public.complete_postnord_tracking_sync(owned_claim, '[]'::jsonb);
  perform public.test_assert(
    first_disposition = 'claimed'
      and completion.inserted_count = 0
      and completion.replayed_count = 0,
    'an empty provider success must complete and become cacheable'
  );
  select count(*) into first_count from public.postnord_tracking_sync_claims;
  select disposition into cached_disposition
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '00373500489530470000'
  );
  select count(*) into cached_count from public.postnord_tracking_sync_claims;
  perform public.test_assert(
    cached_disposition = 'cached' and cached_count = first_count,
    'cached success must return before every quota debit'
  );
end;
$postnord_empty_success_cache$;

truncate public.postnord_tracking_sync_claims;

do $postnord_stale_owner_fence$
declare
  stale_claim uuid;
  successor_claim uuid;
  stale_rejected boolean := false;
begin
  select claim_token into stale_claim
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '00373500489530470000'
  );
  update public.postnord_tracking_sync_claims
  set claimed_at = clock_timestamp() - interval '1 minute',
      claim_expires_at = clock_timestamp() - interval '1 second'
  where claim_token = stale_claim;
  select claim_token into successor_claim
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '00373500489530470000'
  );
  begin
    perform public.complete_postnord_tracking_sync(stale_claim, '[]'::jsonb);
  exception when sqlstate '40001' then
    stale_rejected := true;
  end;
  perform public.test_assert(
    stale_rejected and successor_claim is not null,
    'expired owner must be fenced from completion after a successor exists'
  );
  perform public.complete_postnord_tracking_sync(successor_claim, '[]'::jsonb);
end;
$postnord_stale_owner_fence$;

truncate public.postnord_tracking_sync_claims;

insert into public.postnord_tracking_sync_claims (
  claim_token, tenant_id, order_id, user_id, tracking_identity, fence_token,
  status, claimed_at, claim_expires_at, finished_at
)
select
  gen_random_uuid(),
  '20000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000002',
  ('70000000-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid,
  'GLOBALWINDOW',
  series,
  'failed',
  clock_timestamp() - interval '1 second',
  clock_timestamp() + interval '29 seconds',
  clock_timestamp()
from generate_series(1, 120) as series;

do $postnord_global_window$
declare
  result_disposition text;
  result_retry integer;
begin
  select disposition, retry_after_seconds
  into result_disposition, result_retry
  from public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '00373500489530470000'
  );
  perform public.test_assert(
    result_disposition = 'rate_limited' and result_retry between 599 and 600,
    'the global 120-per-10-minute provider window must fail closed exactly'
  );
end;
$postnord_global_window$;

do $postnord_identity_mismatch$
begin
  perform public.claim_postnord_tracking_sync(
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'WRONGTRACKING'
  );
  raise exception 'mismatched PostNord tracking identity unexpectedly admitted';
exception when sqlstate '22023' then
  null;
end;
$postnord_identity_mismatch$;

select 'business evidence RLS and grant checks passed' as result;
