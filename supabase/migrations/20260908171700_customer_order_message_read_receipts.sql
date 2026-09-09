-- Narrow customer acknowledgement; no customer UPDATE access to message content.
begin;
create schema if not exists customer_account_private;
revoke all on schema customer_account_private from public, anon;
grant usage on schema customer_account_private to authenticated;

create or replace function customer_account_private.mark_order_messages_read(
  p_order_id uuid, p_tenant_id uuid, p_message_ids uuid[]
) returns uuid[] language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_expected uuid[];
  v_actual uuid[];
begin
  if v_user is null or p_tenant_id is null or p_message_ids is null
     or cardinality(p_message_ids) > 500 or array_position(p_message_ids, null) is not null then
    raise exception 'customer_message_access_denied' using errcode = '42501';
  end if;
  -- Prevent an ownership change until the acknowledgement transaction commits.
  perform id from public.orders
    where id = p_order_id and user_id = v_user and tenant_id = p_tenant_id for share;
  if not found then raise exception 'customer_message_access_denied' using errcode = '42501'; end if;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_expected
    from (select distinct unnest(p_message_ids) as id) requested;
  perform id from public.order_messages
    where order_id = p_order_id and sender_type = 'admin' and id = any(v_expected) for update;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_actual
    from public.order_messages
    where order_id = p_order_id and sender_type = 'admin' and id = any(v_expected);
  -- Reject the entire request if it contains another order's/customer's message.
  if v_actual is distinct from v_expected then
    raise exception 'customer_message_access_denied' using errcode = '42501';
  end if;
  update public.order_messages set is_read = true
    where order_id = p_order_id and sender_type = 'admin' and id = any(v_actual) and is_read is distinct from true;
  -- Includes messages already read, allowing an uncertain response to be retried.
  return v_actual;
end;
$$;
revoke all on function customer_account_private.mark_order_messages_read(uuid,uuid,uuid[]) from public, anon;
grant execute on function customer_account_private.mark_order_messages_read(uuid,uuid,uuid[]) to authenticated;

create or replace function public.customer_mark_order_messages_read(
  p_order_id uuid, p_tenant_id uuid, p_message_ids uuid[]
) returns uuid[] language sql security invoker set search_path = '' as $$
  select customer_account_private.mark_order_messages_read(p_order_id,p_tenant_id,p_message_ids);
$$;
-- Explicit Data API permission; only the narrow wrapper is exposed.
revoke all on function public.customer_mark_order_messages_read(uuid,uuid,uuid[]) from public, anon;
grant execute on function public.customer_mark_order_messages_read(uuid,uuid,uuid[]) to authenticated;

-- Legacy permissive ALL policies allowed sender_id = auth.uid() independently
-- of order ownership and sender_type. Constrain those policies without widening
-- existing operator access. Customers send messages and use the acknowledgement
-- RPC; they cannot rewrite/delete messages or forge an operator's identity.
create policy customer_order_message_insert_boundary on public.order_messages
  as restrictive for insert to anon, authenticated
  with check (
    public.is_admin()
    or (sender_id = (select auth.uid()) and sender_type = 'customer' and is_read = false
      and exists (select 1 from public.orders o where o.id = order_messages.order_id
        and o.user_id = (select auth.uid())))
  );
create policy customer_order_message_update_boundary on public.order_messages
  as restrictive for update to anon, authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy customer_order_message_delete_boundary on public.order_messages
  as restrictive for delete to anon, authenticated
  using (public.is_admin());
commit;

-- Rollback: remove the frontend RPC call first, then drop the public wrapper and
-- private function with signatures above. Keep recorded is_read values and all
-- existing rows. Keep the restrictive message write policies: they close the
-- legacy spoofing/foreign-order loophole. Never restore broad customer writes.
