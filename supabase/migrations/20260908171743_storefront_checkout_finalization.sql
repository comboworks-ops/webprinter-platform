-- Storefront payment contract v2. Additive; no repricing, POD or historic updates.
-- Deploy only as a matched frontend/edge/webhook/database release in test mode.
begin;
create table public.storefront_checkout_attempts (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  user_id uuid references auth.users(id),
  access_token_hash text not null check (access_token_hash ~ '^[a-f0-9]{64}$'),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  order_snapshot jsonb not null,
  quote_snapshot jsonb not null,
  files_snapshot jsonb not null default '[]'::jsonb,
  amount_ore integer not null check (amount_ore > 0),
  currency text not null default 'dkk' check (currency = 'dkk'),
  stripe_destination text,
  stripe_application_fee integer not null default 0,
  livemode boolean not null,
  payment_intent_id text unique,
  order_id uuid unique references public.orders(id),
  state text not null default 'prepared' check (state in ('prepared','ready','completed','cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.storefront_checkout_attempts enable row level security;
revoke all on table public.storefront_checkout_attempts from public, anon, authenticated;
grant select, insert, update on table public.storefront_checkout_attempts to service_role;
-- data-api: private storefront_checkout_attempts

-- A rejected/never-started checkout can be abandoned safely even while another
-- request is preparing it. A shared transaction lock closes the absent-row race.
create table public.storefront_checkout_cancellations (
  id uuid primary key,access_token_hash text not null check(access_token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.storefront_checkout_cancellations enable row level security;
revoke all on table public.storefront_checkout_cancellations from public,anon,authenticated;
grant select,insert on table public.storefront_checkout_cancellations to service_role;
-- data-api: private storefront_checkout_cancellations

create or replace function public.cancel_unstarted_storefront_checkout(p_attempt_id uuid,p_access_token_hash text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_attempt_id::text,8192));
  if exists(select 1 from public.storefront_checkout_attempts where id = p_attempt_id) then return false; end if;
  if exists(select 1 from public.storefront_checkout_cancellations where id = p_attempt_id and access_token_hash <> p_access_token_hash) then
    raise exception 'checkout_access_denied' using errcode = '42501';
  end if;
  insert into public.storefront_checkout_cancellations(id,access_token_hash) values(p_attempt_id,p_access_token_hash) on conflict(id) do nothing;
  return true;
end;
$$;
revoke all on function public.cancel_unstarted_storefront_checkout(uuid,text) from public,anon,authenticated;
grant execute on function public.cancel_unstarted_storefront_checkout(uuid,text) to service_role;

create or replace function public.protect_cancelled_checkout_attempt()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.id::text,8192));
  if exists(select 1 from public.storefront_checkout_cancellations where id = new.id) then
    raise exception 'checkout_attempt_cancelled';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_cancelled_checkout_attempt() from public,anon,authenticated;
-- data-api: private protect_cancelled_checkout_attempt
create trigger protect_cancelled_checkout_attempt before insert on public.storefront_checkout_attempts
for each row execute function public.protect_cancelled_checkout_attempt();

alter table public.orders
  add column if not exists checkout_attempt_id uuid references public.storefront_checkout_attempts(id),
  add column if not exists stripe_payment_intent_id text,
  add column if not exists delivery_address2 text;
create unique index orders_checkout_attempt_once on public.orders(checkout_attempt_id) where checkout_attempt_id is not null;
create unique index orders_storefront_payment_once on public.orders(stripe_payment_intent_id) where stripe_payment_intent_id is not null;

-- Paid order and all production files are committed together under one row lock.
-- Only a trusted edge after Stripe verification can call this security invoker RPC.
create or replace function public.finalize_storefront_checkout(
  p_attempt_id uuid, p_payment_intent_id text, p_amount_ore integer,
  p_currency text, p_livemode boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  a public.storefront_checkout_attempts%rowtype;
  o public.orders%rowtype;
  f jsonb;
  file_index integer := 0;
begin
  select * into a from public.storefront_checkout_attempts where id = p_attempt_id for update;
  if not found then raise exception 'checkout_attempt_not_found'; end if;
  if a.payment_intent_id is distinct from p_payment_intent_id or a.amount_ore is distinct from p_amount_ore
    or a.currency is distinct from p_currency or a.livemode is distinct from p_livemode then
    raise exception 'checkout_payment_mismatch';
  end if;
  if a.order_id is not null then
    select * into strict o from public.orders where id = a.order_id;
    return jsonb_build_object('id',o.id,'order_number',o.order_number,'customer_email',o.customer_email,
      'customer_name',o.customer_name,'product_name',o.product_name,'quantity',o.quantity,'total_price',o.total_price);
  end if;
  if a.state <> 'ready' or jsonb_array_length(a.files_snapshot) < 1 then
    raise exception 'checkout_artifacts_not_ready';
  end if;
  for f in select value from jsonb_array_elements(a.files_snapshot) loop
    if not exists (select 1 from storage.objects where bucket_id = 'order-files'
      and name = f->>'storage_path' and (metadata->>'size')::bigint = (f->>'file_size')::bigint)
      or (f->>'storage_path') not like ('checkout-finalized/' || a.id::text || '/%') then
      raise exception 'checkout_production_file_missing';
    end if;
  end loop;
  insert into public.orders (
    order_number,user_id,tenant_id,customer_email,customer_name,customer_phone,
    product_name,product_slug,quantity,total_price,currency,status,delivery_type,
    delivery_address,delivery_address2,delivery_zip,delivery_city,delivery_country,
    product_configuration,status_note,checkout_attempt_id,stripe_payment_intent_id
  ) values (
    'WP-' || upper(replace(a.id::text,'-','')),a.user_id,a.tenant_id,
    a.order_snapshot->>'customer_email',a.order_snapshot->>'customer_name',a.order_snapshot->>'customer_phone',
    a.order_snapshot->>'product_name',a.order_snapshot->>'product_slug',(a.order_snapshot->>'quantity')::integer,
    a.amount_ore::numeric / 100,'DKK','pending',a.order_snapshot->>'delivery_type',
    a.order_snapshot->>'delivery_address',a.order_snapshot->>'delivery_address2',a.order_snapshot->>'delivery_zip',
    a.order_snapshot->>'delivery_city',a.order_snapshot->>'delivery_country',
    a.order_snapshot->>'product_configuration',a.order_snapshot->>'status_note',a.id,a.payment_intent_id
  ) returning * into o;
  for f in select value from jsonb_array_elements(a.files_snapshot) loop
    insert into public.order_files(order_id,file_name,file_url,file_type,file_size,is_current,uploaded_by,notes)
      values(o.id,f->>'file_name',f->>'file_url',f->>'file_type',(f->>'file_size')::integer,
      file_index = 0,a.user_id,'Approved production bytes SHA-256: ' || (f->>'sha256'));
    file_index := file_index + 1;
  end loop;
  update public.storefront_checkout_attempts set order_id = o.id,state = 'completed',completed_at = now() where id = a.id;
  return jsonb_build_object('id',o.id,'order_number',o.order_number,'customer_email',o.customer_email,
    'customer_name',o.customer_name,'product_name',o.product_name,'quantity',o.quantity,'total_price',o.total_price);
end;
$$;
revoke all on function public.finalize_storefront_checkout(uuid,text,integer,text,boolean) from public, anon, authenticated;
grant execute on function public.finalize_storefront_checkout(uuid,text,integer,text,boolean) to service_role;

-- Defend immutable artifact copies even if older broad storage policies allow writes.
create or replace function public.protect_checkout_artifact_object()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (tg_op <> 'INSERT' and old.bucket_id = 'order-files' and old.name like 'checkout-finalized/%') then
    raise exception 'checkout_artifact_immutable' using errcode = '42501';
  end if;
  if tg_op <> 'DELETE' and new.bucket_id = 'order-files' and new.name like 'checkout-finalized/%'
    and coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'checkout_artifact_server_only' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.protect_checkout_artifact_object() from public, anon, authenticated;
-- data-api: private protect_checkout_artifact_object
create trigger protect_checkout_artifact_object before insert or update or delete on storage.objects
for each row execute function public.protect_checkout_artifact_object();

-- Browser/admin APIs may update operating status, but cannot forge a paid identity.
create or replace function public.protect_checkout_order_identity()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'INSERT' and (new.checkout_attempt_id is not null or new.stripe_payment_intent_id is not null)
    and coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'checkout_order_server_only' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if (new.checkout_attempt_id is distinct from old.checkout_attempt_id
      or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id)
      or (old.checkout_attempt_id is not null and (new.tenant_id is distinct from old.tenant_id
      or new.user_id is distinct from old.user_id or new.total_price is distinct from old.total_price
      or new.currency is distinct from old.currency)) then
      raise exception 'checkout_order_identity_immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.protect_checkout_order_identity() from public, anon, authenticated;
-- data-api: private protect_checkout_order_identity
create trigger protect_checkout_order_identity before insert or update on public.orders
for each row execute function public.protect_checkout_order_identity();
commit;

-- Rollback: disable new payments first; keep the finalizer/webhook, attempt rows,
-- order references and immutable files until all issued intents are reconciled.
-- Never roll back to browser order inserts for already-created v2 payments.
-- Retain additive columns/data; drop entry points only after payment reconciliation.
