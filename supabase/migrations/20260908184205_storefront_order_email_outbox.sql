-- Durable checkout email intent: queued in the same transaction as paid order/files.
-- No historical backfill, external request, scheduled job or email is executed here.
begin;
create table public.storefront_order_email_outbox (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.storefront_checkout_attempts(id),
  order_id uuid not null references public.orders(id),
  tenant_id uuid not null references public.tenants(id),
  notification_type text not null check(notification_type in ('customer_confirmation','operator_new_order')),
  recipient_email text not null,
  livemode boolean not null,
  message_snapshot jsonb not null,
  provider_payload jsonb,
  status text not null default 'pending' check(status in ('pending','processing','sent','needs_review','failed')),
  attempts integer not null default 0 check(attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  claim_token uuid,
  claimed_until timestamptz,
  provider_message_id text,
  accepted_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  unique(order_id,notification_type),
  check (status <> 'sent' or (accepted_at is not null and provider_message_id is not null))
);
alter table public.storefront_order_email_outbox enable row level security;
revoke all on table public.storefront_order_email_outbox from public,anon,authenticated,service_role;
grant select,insert,update on table public.storefront_order_email_outbox to service_role;
-- data-api: private storefront_order_email_outbox
create index storefront_email_due on public.storefront_order_email_outbox(livemode,next_attempt_at,created_at)
  where status in ('pending','processing');

create or replace function public.queue_storefront_order_emails()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  o public.orders%rowtype;
  shop public.tenants%rowtype;
  snapshot jsonb;
  shop_email text;
  customer_email text;
begin
  if new.state <> 'completed' or new.order_id is null then return new; end if;
  if tg_op = 'UPDATE' and old.state = 'completed' and old.order_id = new.order_id then return new; end if;
  select * into strict o from public.orders
    where id = new.order_id and checkout_attempt_id = new.id and tenant_id = new.tenant_id;
  select * into strict shop from public.tenants where id = new.tenant_id;
  shop_email := lower(btrim(coalesce(shop.settings#>>'{company,email}','')));
  if shop_email !~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$' or length(shop_email) > 254 then shop_email := null; end if;
  customer_email := lower(btrim(coalesce(o.customer_email,'')));
  snapshot := jsonb_build_object(
    'version',1,'tenant_id',new.tenant_id,'order_id',o.id,'order_number',o.order_number,
    'customer_email',customer_email,'customer_name',o.customer_name,
    'product_name',o.product_name,'quantity',o.quantity,'total_price',o.total_price,'currency',o.currency,
    'delivery_type',new.order_snapshot->>'delivery_type',
    'delivery_summary',concat_ws(', ',nullif(new.order_snapshot->>'delivery_address',''),nullif(new.order_snapshot->>'delivery_address2',''),
      nullif(new.order_snapshot->>'delivery_zip',''),nullif(new.order_snapshot->>'delivery_city',''),nullif(new.order_snapshot->>'delivery_country','')),
    'shop_name',coalesce(nullif(shop.settings#>>'{company,name}',''),nullif(shop.name,''),'Webprinter'),
    'support_email',shop_email,'has_customer_account',new.user_id is not null
  );
  if shop.settings#>>'{notifications,order_confirmations}' is distinct from 'false' then
    insert into public.storefront_order_email_outbox(attempt_id,order_id,tenant_id,notification_type,recipient_email,livemode,message_snapshot)
      values(new.id,o.id,new.tenant_id,'customer_confirmation',customer_email,new.livemode,snapshot)
      on conflict(order_id,notification_type) do nothing;
  end if;
  if shop_email is not null and shop.settings#>>'{notifications,new_orders}' is distinct from 'false' then
    insert into public.storefront_order_email_outbox(attempt_id,order_id,tenant_id,notification_type,recipient_email,livemode,message_snapshot)
      values(new.id,o.id,new.tenant_id,'operator_new_order',shop_email,new.livemode,snapshot)
      on conflict(order_id,notification_type) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.queue_storefront_order_emails() from public,anon,authenticated;
-- data-api: private queue_storefront_order_emails
create trigger queue_storefront_order_emails after insert or update of state,order_id on public.storefront_checkout_attempts
for each row execute function public.queue_storefront_order_emails();

-- Snapshot and provider body cannot drift across retries or a tenant/settings edit.
create or replace function public.protect_storefront_email_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.attempt_id is distinct from old.attempt_id or new.order_id is distinct from old.order_id
    or new.tenant_id is distinct from old.tenant_id or new.notification_type is distinct from old.notification_type
    or new.recipient_email is distinct from old.recipient_email or new.livemode is distinct from old.livemode
    or new.message_snapshot is distinct from old.message_snapshot
    or (old.provider_payload is not null and new.provider_payload is distinct from old.provider_payload)
    or (old.status = 'sent' and (new.status <> 'sent' or new.provider_message_id is distinct from old.provider_message_id)) then
    raise exception 'storefront_email_identity_immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_storefront_email_identity() from public,anon,authenticated;
-- data-api: private protect_storefront_email_identity
create trigger protect_storefront_email_identity before update on public.storefront_order_email_outbox
for each row execute function public.protect_storefront_email_identity();

create or replace function public.claim_storefront_order_emails(
  p_limit integer,p_livemode boolean,p_recipient_allowlist text[] default null
) returns setof public.storefront_order_email_outbox language plpgsql security invoker set search_path = '' as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 5 or p_livemode is null
    or (not p_livemode and coalesce(cardinality(p_recipient_allowlist),0) = 0) then
    raise exception 'storefront_email_claim_invalid';
  end if;
  -- Resend retains dedup keys for 24h. Stop conservatively at 23h rather than
  -- automatically resend an ambiguous response after provider retention expires.
  update public.storefront_order_email_outbox set status = 'needs_review',claim_token = null,claimed_until = null,
    last_error_code = case when attempts >= 8 then 'retry_limit_reached' else 'idempotency_window_elapsed' end
    where status in ('pending','processing') and livemode = p_livemode
      and (p_recipient_allowlist is null or recipient_email = any(p_recipient_allowlist))
      and (status = 'pending' or claimed_until <= now())
      and (attempts >= 8 or first_attempt_at <= now() - interval '23 hours');
  return query
  with due as (
    select id from public.storefront_order_email_outbox
    where livemode = p_livemode and (p_recipient_allowlist is null or recipient_email = any(p_recipient_allowlist))
      and ((status = 'pending' and next_attempt_at <= now()) or (status = 'processing' and claimed_until <= now()))
      and attempts < 8 and (first_attempt_at is null or first_attempt_at > now() - interval '23 hours')
    order by next_attempt_at,created_at,id for update skip locked limit p_limit
  ) update public.storefront_order_email_outbox q set status = 'processing',claim_token = gen_random_uuid(),
      claimed_until = now() + interval '5 minutes',attempts = q.attempts + 1,first_attempt_at = coalesce(q.first_attempt_at,now())
    from due where q.id = due.id returning q.*;
end;
$$;
revoke all on function public.claim_storefront_order_emails(integer,boolean,text[]) from public,anon,authenticated;
grant execute on function public.claim_storefront_order_emails(integer,boolean,text[]) to service_role;

create or replace function public.prepare_storefront_order_email(p_id uuid,p_claim_token uuid,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare q public.storefront_order_email_outbox%rowtype;
begin
  select * into q from public.storefront_order_email_outbox where id = p_id for update;
  if not found or q.status <> 'processing' or q.claim_token is distinct from p_claim_token or q.claimed_until <= now() then
    raise exception 'storefront_email_claim_lost';
  end if;
  if q.provider_payload is not null then return q.provider_payload; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_payload->'to' is distinct from jsonb_build_array(q.recipient_email)
    or length(p_payload::text) > 100000 then raise exception 'storefront_email_payload_invalid'; end if;
  update public.storefront_order_email_outbox set provider_payload = p_payload where id = q.id;
  return p_payload;
end;
$$;
revoke all on function public.prepare_storefront_order_email(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_storefront_order_email(uuid,uuid,jsonb) to service_role;

create or replace function public.finish_storefront_order_email(
  p_id uuid,p_claim_token uuid,p_status text,p_provider_message_id text default null,p_error_code text default null
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare q public.storefront_order_email_outbox%rowtype; next_status text;
begin
  if p_status is null or p_status not in ('sent','pending','needs_review','failed')
    or (p_status = 'sent' and (p_provider_message_id is null or p_provider_message_id !~ '^[a-zA-Z0-9_-]{1,200}$'))
    or (p_error_code is not null and p_error_code !~ '^[a-z0-9_]{1,100}$') then raise exception 'storefront_email_result_invalid'; end if;
  select * into q from public.storefront_order_email_outbox where id = p_id for update;
  if not found or q.status <> 'processing' or q.claim_token is distinct from p_claim_token then return false; end if;
  next_status := p_status;
  if p_status = 'pending' and (q.attempts >= 8 or q.first_attempt_at <= now() - interval '23 hours') then next_status := 'needs_review'; end if;
  update public.storefront_order_email_outbox set status = next_status,
    provider_message_id = case when p_status = 'sent' then p_provider_message_id else provider_message_id end,
    accepted_at = case when p_status = 'sent' then now() else accepted_at end,
    last_error_code = p_error_code,claim_token = null,claimed_until = null,
    next_attempt_at = now() + make_interval(secs => least(3600,30 * (2 ^ least(q.attempts,7))::integer))
    where id = q.id;
  return true;
end;
$$;
revoke all on function public.finish_storefront_order_email(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_storefront_order_email(uuid,uuid,text,text,text) to service_role;
commit;

-- Rollback: set STOREFRONT_ORDER_EMAIL_MODE=disabled and stop the scheduler first.
-- Keep outbox rows, frozen payloads, accepted IDs and receipt status for diagnosis.
-- Drop only queue_storefront_order_emails trigger to stop new intents if necessary;
-- paid-order finalization remains usable. Never replay ambiguous rows with new keys.
