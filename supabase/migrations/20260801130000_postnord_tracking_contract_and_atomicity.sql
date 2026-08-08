-- Align stored carrier evidence with the official PostNord Track & Trace v5
-- event contract and make each provider response an all-or-nothing write.
--
-- Rollback (existing evidence remains display-only and untouched):
-- 1. Disable PostNord sync before revoking/dropping
--    public.persist_postnord_tracking_events_v1(jsonb).
-- 2. Restore carrier_tracking_events_v1_tenant_order_read from
--    20260801120000_business_evidence_request_hardening.sql.
-- 3. Keep provider_event_code unless all readers and retained evidence have
--    been migrated; dropping it discards provider evidence.

alter table public.carrier_tracking_events_v1
  add column provider_event_code text
  check (
    provider_event_code is null
    or (
      char_length(provider_event_code) between 1 and 120
      and provider_event_code = btrim(provider_event_code)
    )
  );

drop policy if exists carrier_tracking_events_v1_tenant_order_read
  on public.carrier_tracking_events_v1;

create policy carrier_tracking_events_v1_tenant_order_read
on public.carrier_tracking_events_v1
for select to authenticated
using (
  public.has_role(auth.uid(), 'master_admin')
  or exists (
    select 1
    from public.orders
    where orders.id = carrier_tracking_events_v1.order_id
      and orders.tenant_id = carrier_tracking_events_v1.tenant_id
      and (
        public.can_access_tenant(carrier_tracking_events_v1.tenant_id)
        or orders.user_id = auth.uid()
      )
  )
);

-- The table is readable for replay verification, but service-role writes must
-- cross the one transactional function below. Its fixed definer context owns
-- the insert and still runs the existing order/tenant integrity trigger.
revoke all on table public.carrier_tracking_events_v1 from service_role;
grant select on table public.carrier_tracking_events_v1 to service_role;

create function public.persist_postnord_tracking_events_v1(_events jsonb)
returns table(inserted_count integer, replayed_count integer)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  candidate jsonb;
  candidate_index integer := 0;
  inserted_id uuid;
  replay_row record;
  provider_row_id uuid;
  event_tenant_id uuid;
  event_order_id uuid;
  event_schema_version smallint;
  event_carrier text;
  event_tracking_number text;
  event_provider_event_id text;
  event_provider_event_code text;
  event_fallback_dedupe_key text;
  event_provider_status text;
  event_display_type text;
  event_occurred_at timestamptz;
  event_received_at timestamptz;
  event_location text;
  event_description text;
  event_source_digest text;
  batch_tenant_id uuid;
  batch_order_id uuid;
  batch_tracking_number text;
  expected_keys constant text[] := array[
    'tenant_id',
    'order_id',
    'schema_version',
    'carrier',
    'tracking_number',
    'provider_event_id',
    'provider_event_code',
    'fallback_dedupe_key',
    'provider_status',
    'display_type',
    'occurred_at',
    'received_at',
    'location',
    'description',
    'source_digest'
  ];
begin
  if _events is null
    or jsonb_typeof(_events) <> 'array'
    or jsonb_array_length(_events) > 200 then
    raise exception using
      errcode = '22023',
      message = 'invalid PostNord event batch';
  end if;

  inserted_count := 0;
  replayed_count := 0;

  for candidate in select value from jsonb_array_elements(_events) loop
    candidate_index := candidate_index + 1;
    if jsonb_typeof(candidate) <> 'object'
      or not (candidate ?& expected_keys)
      or (select count(*) from jsonb_object_keys(candidate)) <>
        cardinality(expected_keys)
      or jsonb_typeof(candidate -> 'tenant_id') <> 'string'
      or jsonb_typeof(candidate -> 'order_id') <> 'string'
      or jsonb_typeof(candidate -> 'schema_version') <> 'number'
      or candidate ->> 'schema_version' <> '1'
      or jsonb_typeof(candidate -> 'carrier') <> 'string'
      or jsonb_typeof(candidate -> 'tracking_number') <> 'string'
      or jsonb_typeof(candidate -> 'provider_event_id') not in ('string', 'null')
      or jsonb_typeof(candidate -> 'provider_event_code') not in ('string', 'null')
      or jsonb_typeof(candidate -> 'fallback_dedupe_key') <> 'string'
      or jsonb_typeof(candidate -> 'provider_status') <> 'string'
      or jsonb_typeof(candidate -> 'display_type') <> 'string'
      or jsonb_typeof(candidate -> 'occurred_at') <> 'string'
      or jsonb_typeof(candidate -> 'received_at') <> 'string'
      or jsonb_typeof(candidate -> 'location') not in ('string', 'null')
      or jsonb_typeof(candidate -> 'description') not in ('string', 'null')
      or jsonb_typeof(candidate -> 'source_digest') <> 'string'
      or (candidate ->> 'occurred_at') !~
        '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
      or (candidate ->> 'received_at') !~
        '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$' then
      raise exception using
        errcode = '22023',
        message = format('invalid PostNord event at index %s', candidate_index);
    end if;

    event_tenant_id := (candidate ->> 'tenant_id')::uuid;
    event_order_id := (candidate ->> 'order_id')::uuid;
    event_schema_version := (candidate ->> 'schema_version')::smallint;
    event_carrier := candidate ->> 'carrier';
    event_tracking_number := candidate ->> 'tracking_number';
    event_provider_event_id := candidate ->> 'provider_event_id';
    event_provider_event_code := candidate ->> 'provider_event_code';
    event_fallback_dedupe_key := candidate ->> 'fallback_dedupe_key';
    event_provider_status := candidate ->> 'provider_status';
    event_display_type := candidate ->> 'display_type';
    event_occurred_at := (candidate ->> 'occurred_at')::timestamptz;
    event_received_at := (candidate ->> 'received_at')::timestamptz;
    event_location := candidate ->> 'location';
    event_description := candidate ->> 'description';
    event_source_digest := candidate ->> 'source_digest';

    if candidate_index = 1 then
      batch_tenant_id := event_tenant_id;
      batch_order_id := event_order_id;
      batch_tracking_number := event_tracking_number;
    elsif event_tenant_id <> batch_tenant_id
      or event_order_id <> batch_order_id
      or event_tracking_number <> batch_tracking_number then
      raise exception using
        errcode = '22023',
        message = 'PostNord event batch mixes order scopes';
    end if;

    inserted_id := null;
    insert into public.carrier_tracking_events_v1 (
      tenant_id,
      order_id,
      schema_version,
      carrier,
      tracking_number,
      provider_event_id,
      provider_event_code,
      fallback_dedupe_key,
      provider_status,
      display_type,
      occurred_at,
      received_at,
      location,
      description,
      source_digest
    ) values (
      event_tenant_id,
      event_order_id,
      event_schema_version,
      event_carrier,
      event_tracking_number,
      event_provider_event_id,
      event_provider_event_code,
      event_fallback_dedupe_key,
      event_provider_status,
      event_display_type,
      event_occurred_at,
      event_received_at,
      event_location,
      event_description,
      event_source_digest
    )
    on conflict do nothing
    returning id into inserted_id;

    if inserted_id is not null then
      inserted_count := inserted_count + 1;
      continue;
    end if;

    replay_row := null;
    select events.* into replay_row
    from public.carrier_tracking_events_v1 as events
    where events.carrier = event_carrier
      and events.tracking_number = event_tracking_number
      and events.fallback_dedupe_key = event_fallback_dedupe_key;

    if not found
      or replay_row.schema_version is distinct from event_schema_version
      or replay_row.tenant_id is distinct from event_tenant_id
      or replay_row.order_id is distinct from event_order_id
      or replay_row.carrier is distinct from event_carrier
      or replay_row.tracking_number is distinct from event_tracking_number
      or replay_row.provider_event_id is distinct from event_provider_event_id
      or replay_row.provider_event_code is distinct from event_provider_event_code
      or replay_row.fallback_dedupe_key is distinct from event_fallback_dedupe_key
      or replay_row.provider_status is distinct from event_provider_status
      or replay_row.display_type is distinct from event_display_type
      or replay_row.occurred_at is distinct from event_occurred_at
      or replay_row.location is distinct from event_location
      or replay_row.description is distinct from event_description then
      raise exception using
        errcode = '23505',
        message = 'conflicting PostNord event evidence';
    end if;

    if event_provider_event_id is not null then
      provider_row_id := null;
      select events.id into provider_row_id
      from public.carrier_tracking_events_v1 as events
      where events.carrier = event_carrier
        and events.tracking_number = event_tracking_number
        and events.provider_event_id = event_provider_event_id;
      if provider_row_id is distinct from replay_row.id then
        raise exception using
          errcode = '23505',
          message = 'conflicting PostNord provider event identity';
      end if;
    end if;

    replayed_count := replayed_count + 1;
  end loop;

  return next;
end;
$$;

comment on function public.persist_postnord_tracking_events_v1(jsonb) is
  'Service-only atomic insert/replay boundary for immutable display-only PostNord evidence; never mutates orders or workflow state.';

-- data-api: service-only atomic carrier evidence persistence boundary.
revoke execute on function public.persist_postnord_tracking_events_v1(jsonb)
  from public, anon, authenticated;
grant execute on function public.persist_postnord_tracking_events_v1(jsonb)
  to service_role;
