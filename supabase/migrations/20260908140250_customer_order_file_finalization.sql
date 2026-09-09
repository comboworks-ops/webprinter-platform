-- Atomic customer-requested replacement of an existing order's print file.
-- No customer UPDATE grants or RLS policy changes. The narrow privileged
-- operation lives outside the exposed schema and validates ownership itself.
-- Deploy together with server checkout finalization: customer browser INSERTs
-- into order_files are removed below. Operator policies and bucket read access
-- remain unchanged. Replacement objects use an immutable order/user/UUID path.
begin;
create schema if not exists customer_account_private;
revoke all on schema customer_account_private from public, anon;
grant usage on schema customer_account_private to authenticated;

create or replace function customer_account_private.finalize_order_file(
  p_order_id uuid, p_tenant_id uuid, p_file_name text, p_file_size integer,
  p_expected_current_file_ids uuid[], p_storage_path text, p_validate_only boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_order public.orders%rowtype;
  v_current uuid[];
  v_expected uuid[];
  v_file_id uuid;
  v_extension text;
  v_issuer text;
  v_file_url text;
  v_size bigint;
  v_existing public.order_files%rowtype;
begin
  if v_user is null or p_tenant_id is null or p_expected_current_file_ids is null
     or cardinality(p_expected_current_file_ids) > 500
     or array_position(p_expected_current_file_ids, null) is not null then
    raise exception 'customer_file_access_denied' using errcode = '42501';
  end if;
  select * into v_order from public.orders
    where id = p_order_id and user_id = v_user and tenant_id = p_tenant_id for update;
  if not found then raise exception 'customer_file_access_denied' using errcode = '42501'; end if;
  v_extension := lower(substring(p_file_name from '\.([^.]+)$'));
  if p_file_name is null or char_length(p_file_name) > 255 or p_file_name ~ '[[:cntrl:]]'
     or v_extension is null or v_extension not in ('pdf','jpg','jpeg','png','ai','eps')
     or p_file_size is null or p_file_size < 1 or p_file_size > 104857600 then
    raise exception 'customer_file_invalid';
  end if;

  -- Derive the existing absolute storage URL format from the signed JWT issuer,
  -- never from a browser-supplied URL. Storage access/publicness stays unchanged.
  v_issuer := auth.jwt()->>'iss';
  if v_issuer is null or v_issuer !~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?/auth/v1/?$' then
    raise exception 'customer_file_storage_origin_unavailable';
  end if;
  if not coalesce(p_validate_only, false) then
    if p_storage_path is null or p_storage_path !~ (
      '^' || p_order_id::text || '/' || v_user::text || '/[a-f0-9-]{36}\.' || v_extension || '$') then
      raise exception 'customer_file_invalid_path';
    end if;
    v_file_url := regexp_replace(v_issuer, '/auth/v1/?$', '') || '/storage/v1/object/public/order-files/' || p_storage_path;
    -- Idempotent reconciliation of the same immutable upload, including after
    -- a successful commit whose network response was lost.
    select * into v_existing from public.order_files
      where order_id = p_order_id and uploaded_by = v_user and file_url = v_file_url;
    if found then
      if v_existing.is_current is distinct from true or v_existing.file_name is distinct from p_file_name
         or v_existing.file_size is distinct from p_file_size then
        raise exception 'customer_file_version_changed';
      end if;
      return v_existing.id;
    end if;
  end if;
  if not coalesce(v_order.requires_file_reupload, false) then raise exception 'customer_file_request_closed'; end if;
  if v_order.status in ('cancelled','delivered','shipped') then raise exception 'customer_file_order_closed'; end if;

  perform id from public.order_files where order_id = p_order_id for update;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_current
    from public.order_files where order_id = p_order_id and is_current = true;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_expected
    from unnest(p_expected_current_file_ids) as ids(id);
  if v_current is distinct from v_expected then raise exception 'customer_file_version_changed'; end if;
  if coalesce(p_validate_only, false) then return p_order_id; end if;

  select (metadata->>'size')::bigint into v_size from storage.objects
    where bucket_id = 'order-files' and name = p_storage_path and owner_id = v_user::text for share;
  if not found or v_size is distinct from p_file_size::bigint then
    raise exception 'customer_file_storage_unverified';
  end if;
  update public.order_files set is_current = false where order_id = p_order_id and is_current = true;
  insert into public.order_files(order_id,file_name,file_url,file_type,file_size,uploaded_by,is_current)
    values(p_order_id,p_file_name,v_file_url,v_extension,p_file_size,v_user,true) returning id into v_file_id;
  update public.orders set requires_file_reupload = false where id = p_order_id;
  return v_file_id;
end;
$$;
revoke all on function customer_account_private.finalize_order_file(uuid,uuid,text,integer,uuid[],text,boolean) from public, anon;
grant execute on function customer_account_private.finalize_order_file(uuid,uuid,text,integer,uuid[],text,boolean) to authenticated;

create or replace function public.customer_finalize_order_file(
  p_order_id uuid, p_tenant_id uuid, p_file_name text, p_file_size integer,
  p_expected_current_file_ids uuid[], p_storage_path text, p_validate_only boolean default false
) returns uuid language sql security invoker set search_path = '' as $$
  select customer_account_private.finalize_order_file(
    p_order_id,p_tenant_id,p_file_name,p_file_size,p_expected_current_file_ids,p_storage_path,p_validate_only
  );
$$;
-- Explicit Data API boundary; anonymous callers cannot execute either function.
revoke all on function public.customer_finalize_order_file(uuid,uuid,text,integer,uuid[],text,boolean) from public, anon;
grant execute on function public.customer_finalize_order_file(uuid,uuid,text,integer,uuid[],text,boolean) to authenticated;

-- The old browser INSERT allowed a customer to bypass version/request checks.
-- Initial paid files now come from the service-only checkout finalizer. The
-- existing operator policy still permits authorized manual order workflows.
drop policy if exists "Users can upload files to own orders" on public.order_files;

-- Restrictive policies remain effective even if a future permissive bucket
-- policy allows upserts/deletes. They apply only to the replacement namespace.
create policy customer_replacement_object_immutable_update on storage.objects
  as restrictive for update to anon, authenticated
  using (bucket_id <> 'order-files' or name !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.(pdf|jpg|jpeg|png|ai|eps)$')
  with check (bucket_id <> 'order-files' or name !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.(pdf|jpg|jpeg|png|ai|eps)$');
create policy customer_replacement_object_immutable_delete on storage.objects
  as restrictive for delete to anon, authenticated
  using (bucket_id <> 'order-files' or name !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.(pdf|jpg|jpeg|png|ai|eps)$');
create policy customer_replacement_object_owned_insert on storage.objects
  as restrictive for insert to authenticated
  with check (
    bucket_id <> 'order-files'
    or name !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.(pdf|jpg|jpeg|png|ai|eps)$'
    or (owner_id = (select auth.uid())::text
      and split_part(name, '/', 2) = (select auth.uid())::text
      and exists (select 1 from public.orders o where o.id::text = split_part(name, '/', 1)
        and o.user_id = (select auth.uid()) and o.requires_file_reupload = true
        and o.status not in ('cancelled','delivered','shipped')))
  );
-- Keep the anonymous policy free of private table references, so unrelated
-- anonymous uploads do not acquire a new SELECT dependency on orders.
create policy customer_replacement_object_anonymous_insert on storage.objects
  as restrictive for insert to anon
  with check (bucket_id <> 'order-files' or name !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}\.(pdf|jpg|jpeg|png|ai|eps)$');
commit;

-- Rollback: deploy the customer UI with replacement disabled first, then drop
-- public.customer_finalize_order_file(uuid,uuid,text,integer,uuid[],text,boolean)
-- and customer_account_private.finalize_order_file(uuid,uuid,text,integer,uuid[],text,boolean).
-- Keep all order_files rows and objects: they remain valid version history.
-- Do not restore the old multi-write browser handler or delete customer files.
-- Keep restrictive storage policies and the removed direct INSERT policy in
-- place; rolling back to an unchecked legacy checkout requires a separate review.
