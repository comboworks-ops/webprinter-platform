-- Fence, cache, release, and globally bound explicit PostNord provider work.
-- Rollback: disable postnord-tracking-sync; revoke/drop complete, finish,
-- renew, and claim RPCs; restore service_role execution of the lower-level
-- persistence RPC only if the prior unsafe path is intentionally restored;
-- then drop the two private state tables. Carrier evidence and every
-- order/workflow field remain untouched.

create table public.postnord_tracking_sync_claims (
  id bigint generated always as identity primary key,
  claim_token uuid not null default gen_random_uuid() unique,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null,
  tracking_identity text not null
    check (tracking_identity ~ '^[A-Z0-9]{1,100}$'),
  fence_token bigint not null check (fence_token > 0),
  status text not null default 'in_flight'
    check (status in ('in_flight', 'succeeded', 'failed', 'provider_rate_limited')),
  claimed_at timestamptz not null default clock_timestamp(),
  claim_expires_at timestamptz not null,
  finished_at timestamptz,
  cache_expires_at timestamptz,
  provider_retry_after_seconds integer
    check (provider_retry_after_seconds between 1 and 2147483647),
  unique (tenant_id, order_id, tracking_identity, fence_token),
  check (claim_expires_at > claimed_at),
  check (
    (status = 'in_flight' and finished_at is null)
    or (status <> 'in_flight' and finished_at is not null)
  ),
  check (
    (status = 'succeeded' and cache_expires_at is not null)
    or (status <> 'succeeded' and cache_expires_at is null)
  ),
  check (
    (status = 'provider_rate_limited' and provider_retry_after_seconds is not null)
    or (status <> 'provider_rate_limited' and provider_retry_after_seconds is null)
  )
);

comment on table public.postnord_tracking_sync_claims is
  'Private 24-hour PostNord fetch ledger. UUID ownership plus monotonic scope fences prevent an expired worker from completing after a successor; completed rows also provide a one-minute no-debit cache.';

create index postnord_tracking_sync_claim_scope_idx
  on public.postnord_tracking_sync_claims
  (tenant_id, order_id, tracking_identity, fence_token desc);

create index postnord_tracking_sync_claim_quota_idx
  on public.postnord_tracking_sync_claims
  (claimed_at desc, tenant_id, user_id);

create index postnord_tracking_sync_claim_retention_idx
  on public.postnord_tracking_sync_claims (claimed_at);

create table public.postnord_tracking_provider_state (
  provider text primary key check (provider = 'postnord'),
  blocked_until timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  check (blocked_until is null or blocked_until > updated_at)
);

comment on table public.postnord_tracking_provider_state is
  'Private global PostNord backoff state. A valid provider Retry-After blocks all new provider fetches while cached evidence remains readable.';

alter table public.postnord_tracking_sync_claims enable row level security;
alter table public.postnord_tracking_provider_state enable row level security;

-- data-api: callers, including service_role, cannot inspect or forge claim,
-- fence, quota, cache, or global provider-backoff state directly.
revoke all on table public.postnord_tracking_sync_claims
  from public, anon, authenticated, service_role;
revoke all on table public.postnord_tracking_provider_state
  from public, anon, authenticated, service_role;

create function public.claim_postnord_tracking_sync(
  _tenant_id uuid,
  _order_id uuid,
  _user_id uuid,
  _tracking_identity text
)
returns table(
  disposition text,
  retry_after_seconds integer,
  claim_token uuid
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  claim_time timestamptz := clock_timestamp();
  order_tracking_number text;
  canonical_order_tracking text;
  current_retry_after integer;
  user_request_count integer;
  tenant_request_count integer;
  global_request_count integer;
  user_window_end timestamptz;
  tenant_window_end timestamptz;
  global_window_end timestamptz;
  quota_window_end timestamptz;
  next_fence bigint;
  next_claim_token uuid := pg_catalog.gen_random_uuid();
begin
  if _tenant_id is null
    or _order_id is null
    or _user_id is null
    or _user_id = '00000000-0000-0000-0000-000000000000'::uuid
    or _tracking_identity is null
    or _tracking_identity !~ '^[A-Z0-9]{1,100}$' then
    raise exception using
      errcode = '22023',
      message = 'invalid PostNord tracking admission request';
  end if;

  -- The provider lock makes the global window and provider block exact. The
  -- order lock then serializes fence, cache, and in-flight decisions.
  perform pg_advisory_xact_lock(
    hashtextextended('postnord-tracking:provider', 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended(
      'postnord-tracking:' || _tenant_id::text || ':' || _order_id::text,
      0
    )
  );

  select orders.tracking_number
  into order_tracking_number
  from public.orders
  where orders.id = _order_id
    and orders.tenant_id = _tenant_id
  for share;

  if not found
    or order_tracking_number is null
    or length(order_tracking_number) not between 1 and 256
    or order_tracking_number !~ '^[A-Za-z0-9 -]+$' then
    raise exception using
      errcode = '22023',
      message = 'PostNord tracking admission order mismatch';
  end if;

  canonical_order_tracking := upper(
    regexp_replace(order_tracking_number, '[ -]', '', 'g')
  );
  if canonical_order_tracking is distinct from _tracking_identity then
    raise exception using
      errcode = '22023',
      message = 'PostNord tracking admission identity mismatch';
  end if;

  delete from public.postnord_tracking_sync_claims
  where claimed_at < claim_time - interval '24 hours'
    and (status <> 'in_flight' or claim_expires_at <= claim_time);

  -- A fresh successful response, including an empty response, is served from
  -- local evidence/state before provider blocks or quotas and creates no row.
  if exists (
    select 1
    from public.postnord_tracking_sync_claims
    where tenant_id = _tenant_id
      and order_id = _order_id
      and tracking_identity = _tracking_identity
      and status = 'succeeded'
      and cache_expires_at > claim_time
  ) then
    return query select 'cached'::text, 0::integer, null::uuid;
    return;
  end if;

  select case
    when provider_state.blocked_until = 'infinity'::timestamptz
      then 2147483647
    else greatest(
      1,
      ceil(extract(epoch from (provider_state.blocked_until - claim_time)))::integer
    )
  end
  into current_retry_after
  from public.postnord_tracking_provider_state as provider_state
  where provider_state.provider = 'postnord'
    and provider_state.blocked_until > claim_time;

  if current_retry_after is not null then
    return query select 'provider_blocked'::text, current_retry_after, null::uuid;
    return;
  end if;

  current_retry_after := null;
  select greatest(
    1,
    ceil(extract(epoch from (claims.claim_expires_at - claim_time)))::integer
  )
  into current_retry_after
  from public.postnord_tracking_sync_claims as claims
  where claims.tenant_id = _tenant_id
    and claims.order_id = _order_id
    and claims.tracking_identity = _tracking_identity
    and claims.status = 'in_flight'
    and claims.claim_expires_at > claim_time
  order by claims.fence_token desc
  limit 1;

  if current_retry_after is not null then
    return query select 'in_flight'::text, current_retry_after, null::uuid;
    return;
  end if;

  select count(*)::integer, min(claimed_at) + interval '10 minutes'
  into user_request_count, user_window_end
  from public.postnord_tracking_sync_claims
  where tenant_id = _tenant_id
    and user_id = _user_id
    and claimed_at >= claim_time - interval '10 minutes';

  select count(*)::integer, min(claimed_at) + interval '10 minutes'
  into tenant_request_count, tenant_window_end
  from public.postnord_tracking_sync_claims
  where tenant_id = _tenant_id
    and claimed_at >= claim_time - interval '10 minutes';

  select count(*)::integer, min(claimed_at) + interval '10 minutes'
  into global_request_count, global_window_end
  from public.postnord_tracking_sync_claims
  where claimed_at >= claim_time - interval '10 minutes';

  if user_request_count >= 12
    or tenant_request_count >= 60
    or global_request_count >= 120 then
    quota_window_end := greatest(
      case when user_request_count >= 12 then user_window_end end,
      case when tenant_request_count >= 60 then tenant_window_end end,
      case when global_request_count >= 120 then global_window_end end
    );
    current_retry_after := greatest(
      1,
      ceil(extract(epoch from (quota_window_end - claim_time)))::integer
    );
    return query select 'rate_limited'::text, current_retry_after, null::uuid;
    return;
  end if;

  select coalesce(max(claims.fence_token), 0) + 1
  into next_fence
  from public.postnord_tracking_sync_claims as claims
  where claims.tenant_id = _tenant_id
    and claims.order_id = _order_id
    and claims.tracking_identity = _tracking_identity;

  insert into public.postnord_tracking_sync_claims (
    claim_token,
    tenant_id,
    order_id,
    user_id,
    tracking_identity,
    fence_token,
    status,
    claimed_at,
    claim_expires_at
  ) values (
    next_claim_token,
    _tenant_id,
    _order_id,
    _user_id,
    _tracking_identity,
    next_fence,
    'in_flight',
    claim_time,
    claim_time + interval '30 seconds'
  );

  return query select 'claimed'::text, 0::integer, next_claim_token;
end;
$$;

comment on function public.claim_postnord_tracking_sync(uuid, uuid, uuid, text) is
  'Service-only atomic PostNord admission with cache-first no-debit replay, exact scope ownership, per-user/per-tenant/global windows, and provider-wide blocking.';

create function public.renew_postnord_tracking_sync(_claim_token uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  renewal_time timestamptz := clock_timestamp();
  owned_claim public.postnord_tracking_sync_claims%rowtype;
  latest_fence bigint;
begin
  if _claim_token is null then
    raise exception using errcode = '22023', message = 'invalid PostNord claim token';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('postnord-tracking:provider', 0));
  select * into owned_claim
  from public.postnord_tracking_sync_claims
  where claim_token = _claim_token
  for update;
  if not found then
    raise exception using errcode = '40001', message = 'PostNord claim is no longer current';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(
      'postnord-tracking:' || owned_claim.tenant_id::text || ':' || owned_claim.order_id::text,
      0
    )
  );
  select max(fence_token) into latest_fence
  from public.postnord_tracking_sync_claims
  where tenant_id = owned_claim.tenant_id
    and order_id = owned_claim.order_id
    and tracking_identity = owned_claim.tracking_identity;

  if owned_claim.status <> 'in_flight'
    or owned_claim.claim_expires_at <= renewal_time
    or latest_fence is distinct from owned_claim.fence_token then
    raise exception using errcode = '40001', message = 'PostNord claim is no longer current';
  end if;

  update public.postnord_tracking_sync_claims
  set claim_expires_at = renewal_time + interval '30 seconds'
  where claim_token = _claim_token;
  return true;
end;
$$;

create function public.complete_postnord_tracking_sync(
  _claim_token uuid,
  _events jsonb
)
returns table(inserted_count integer, replayed_count integer)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  completion_time timestamptz := clock_timestamp();
  owned_claim public.postnord_tracking_sync_claims%rowtype;
  latest_fence bigint;
  order_tracking_number text;
begin
  if _claim_token is null
    or _events is null
    or jsonb_typeof(_events) <> 'array'
    or jsonb_array_length(_events) > 200 then
    raise exception using errcode = '22023', message = 'invalid PostNord completion';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('postnord-tracking:provider', 0));
  select * into owned_claim
  from public.postnord_tracking_sync_claims
  where claim_token = _claim_token
  for update;
  if not found then
    raise exception using errcode = '40001', message = 'PostNord claim is no longer current';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(
      'postnord-tracking:' || owned_claim.tenant_id::text || ':' || owned_claim.order_id::text,
      0
    )
  );
  select max(fence_token) into latest_fence
  from public.postnord_tracking_sync_claims
  where tenant_id = owned_claim.tenant_id
    and order_id = owned_claim.order_id
    and tracking_identity = owned_claim.tracking_identity;

  if owned_claim.status <> 'in_flight'
    or owned_claim.claim_expires_at <= completion_time
    or latest_fence is distinct from owned_claim.fence_token then
    raise exception using errcode = '40001', message = 'PostNord claim is no longer current';
  end if;

  select tracking_number into order_tracking_number
  from public.orders
  where id = owned_claim.order_id
    and tenant_id = owned_claim.tenant_id
  for share;
  if not found
    or order_tracking_number is null
    or order_tracking_number !~ '^[A-Za-z0-9 -]+$'
    or upper(regexp_replace(order_tracking_number, '[ -]', '', 'g'))
      is distinct from owned_claim.tracking_identity then
    raise exception using errcode = '40001', message = 'PostNord order identity changed';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(_events) as event(value)
    where event.value ->> 'tenant_id' is distinct from owned_claim.tenant_id::text
      or event.value ->> 'order_id' is distinct from owned_claim.order_id::text
      or event.value ->> 'tracking_number' is distinct from owned_claim.tracking_identity
  ) then
    raise exception using errcode = '22023', message = 'PostNord completion scope mismatch';
  end if;

  select persisted.inserted_count, persisted.replayed_count
  into inserted_count, replayed_count
  from public.persist_postnord_tracking_events_v1(_events) as persisted;

  update public.postnord_tracking_sync_claims
  set status = 'succeeded',
      finished_at = completion_time,
      cache_expires_at = completion_time + interval '1 minute'
  where claim_token = _claim_token;

  return next;
end;
$$;

create function public.finish_postnord_tracking_sync(
  _claim_token uuid,
  _outcome text,
  _retry_after_seconds integer default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  finish_time timestamptz := clock_timestamp();
  owned_claim public.postnord_tracking_sync_claims%rowtype;
  latest_fence bigint;
  new_status text;
begin
  if _claim_token is null
    or _outcome not in ('failed', 'provider_rate_limited')
    or (
      _outcome = 'provider_rate_limited'
      and (
        _retry_after_seconds is null
        or _retry_after_seconds not between 1 and 2147483647
      )
    )
    or (_outcome = 'failed' and _retry_after_seconds is not null) then
    raise exception using errcode = '22023', message = 'invalid PostNord claim outcome';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('postnord-tracking:provider', 0));
  select * into owned_claim
  from public.postnord_tracking_sync_claims
  where claim_token = _claim_token
  for update;
  if not found then
    raise exception using errcode = '40001', message = 'PostNord claim is no longer current';
  end if;
  perform pg_advisory_xact_lock(
    hashtextextended(
      'postnord-tracking:' || owned_claim.tenant_id::text || ':' || owned_claim.order_id::text,
      0
    )
  );
  select max(fence_token) into latest_fence
  from public.postnord_tracking_sync_claims
  where tenant_id = owned_claim.tenant_id
    and order_id = owned_claim.order_id
    and tracking_identity = owned_claim.tracking_identity;

  if owned_claim.status <> 'in_flight'
    or latest_fence is distinct from owned_claim.fence_token then
    raise exception using errcode = '40001', message = 'PostNord claim is no longer current';
  end if;

  new_status := _outcome;
  update public.postnord_tracking_sync_claims
  set status = new_status,
      finished_at = finish_time,
      provider_retry_after_seconds = _retry_after_seconds
  where claim_token = _claim_token;

  if _outcome = 'provider_rate_limited' then
    insert into public.postnord_tracking_provider_state (
      provider,
      blocked_until,
      updated_at
    ) values (
      'postnord',
      case
        when _retry_after_seconds = 2147483647
          then 'infinity'::timestamptz
        else finish_time + make_interval(secs => _retry_after_seconds)
      end,
      finish_time
    )
    on conflict (provider) do update
    set blocked_until = greatest(
          public.postnord_tracking_provider_state.blocked_until,
          excluded.blocked_until
        ),
        updated_at = finish_time;
    return _retry_after_seconds;
  end if;

  return 0;
end;
$$;

comment on function public.complete_postnord_tracking_sync(uuid, jsonb) is
  'Fenced service-only completion: validates current ownership, persists the exact event batch atomically, and caches successful empty or non-empty responses.';
comment on function public.finish_postnord_tracking_sync(uuid, text, integer) is
  'Fenced service-only failure release; exact valid provider Retry-After values create a global blocked-until window.';
comment on function public.renew_postnord_tracking_sync(uuid) is
  'Fenced service-only lease renewal for the current PostNord fetch owner.';

-- The lower-level writer must not bypass fenced completion.
revoke execute on function public.persist_postnord_tracking_events_v1(jsonb)
  from service_role;

revoke execute on function public.claim_postnord_tracking_sync(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke execute on function public.renew_postnord_tracking_sync(uuid)
  from public, anon, authenticated, service_role;
revoke execute on function public.complete_postnord_tracking_sync(uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke execute on function public.finish_postnord_tracking_sync(uuid, text, integer)
  from public, anon, authenticated, service_role;

grant execute on function public.claim_postnord_tracking_sync(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.renew_postnord_tracking_sync(uuid)
  to service_role;
grant execute on function public.complete_postnord_tracking_sync(uuid, jsonb)
  to service_role;
grant execute on function public.finish_postnord_tracking_sync(uuid, text, integer)
  to service_role;
