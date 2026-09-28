begin;

-- Nullable, additive evidence. Historical orders are never repriced/backfilled.
-- Existing orders grants/RLS apply; no new browser write authority is granted.
alter table public.orders add column if not exists checkout_tax jsonb;

create or replace function public.protect_storefront_order_tax()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  a public.storefront_checkout_attempts%rowtype;
  tax jsonb;
begin
  if tg_op = 'UPDATE' then
    if new.checkout_tax is distinct from old.checkout_tax then
      raise exception 'checkout_tax_immutable' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.checkout_attempt_id is null then
    if new.checkout_tax is not null then raise exception 'checkout_tax_server_only' using errcode = '42501'; end if;
    return new;
  end if;
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'checkout_tax_server_only' using errcode = '42501';
  end if;
  select * into strict a from public.storefront_checkout_attempts
    where id = new.checkout_attempt_id and tenant_id = new.tenant_id;
  tax := a.quote_snapshot->'tax';
  if tax is not null then
    if jsonb_typeof(tax) is distinct from 'object'
      or tax->>'policy' is distinct from 'dk-domestic-v1'
      or tax->>'sellerCountry' is distinct from 'DK'
      or tax->>'deliveryCountry' is distinct from 'DK'
      or a.order_snapshot->>'delivery_country' is distinct from 'DK'
      or (tax->>'rateBps')::numeric is distinct from 2500
      or (tax->>'netAmountOre')::numeric is distinct from
        ((a.quote_snapshot->>'productPriceOre')::numeric + (a.quote_snapshot->>'optionExtraOre')::numeric + (a.quote_snapshot->>'shippingOre')::numeric)
      or (tax->>'vatAmountOre')::numeric is distinct from round((tax->>'netAmountOre')::numeric / 4)
      or (tax->>'grossAmountOre')::numeric is distinct from
        ((tax->>'netAmountOre')::numeric + (tax->>'vatAmountOre')::numeric)
      or (tax->>'grossAmountOre')::numeric is distinct from a.amount_ore::numeric
      or a.amount_ore::numeric is distinct from new.total_price * 100 then
      raise exception 'checkout_tax_snapshot_invalid' using errcode = '23514';
    end if;
  end if;
  -- Copy only the server-frozen evidence, never a browser-supplied value.
  new.checkout_tax := tax;
  return new;
end;
$$;
revoke all on function public.protect_storefront_order_tax() from public,anon,authenticated;
-- data-api: private protect_storefront_order_tax
create trigger protect_storefront_order_tax before insert or update on public.orders
for each row execute function public.protect_storefront_order_tax();

-- The email trigger replacement below includes the same immutable tax evidence.

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
    'checkout_tax',o.checkout_tax,
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

commit;

-- Rollback: pause new checkout/email effects, keep reconciliation functions,
-- frozen tax evidence, orders and outbox. Do not remove VAT from issued amounts
-- or rewrite historical attempts. Redeploy the matched reviewed packet to resume.
