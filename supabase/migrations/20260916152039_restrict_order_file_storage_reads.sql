-- Coordinated cutover only: private uploads, signed order links and supplier PDF
-- access must be deployed first. Does not move/delete objects or rewrite history.
begin;
-- Freeze historical links once. A shop administrator must not gain access to
-- another shop's object by adding its URL to a mutable order_files row later.
create table public.storefront_legacy_file_links (
  storage_path text not null,
  order_id uuid not null references public.orders(id),
  tenant_id uuid not null references public.tenants(id),
  primary key(storage_path, order_id)
);
alter table public.storefront_legacy_file_links enable row level security;
revoke all on public.storefront_legacy_file_links from public, anon, authenticated;
grant select on public.storefront_legacy_file_links to service_role;

create or replace function storefront_security.order_file_locator_path(p_url text)
returns text language plpgsql immutable strict security invoker set search_path='' as $$
declare encoded text; decoded bytea := ''::bytea; pos integer := 1; part text;
begin
  if length(p_url)>4096 or p_url !~ '^https://[a-z0-9]+[.]supabase[.]co/storage/v1/object/public/order-files/' then return null; end if;
  encoded := split_part(split_part(split_part(p_url,'/storage/v1/object/public/order-files/',2),'?',1),'#',1);
  while pos <= length(encoded) loop
    part := substr(encoded,pos,1);
    if part='%' then
      if substr(encoded,pos+1,2) !~ '^[0-9A-Fa-f]{2}$' then return null; end if;
      decoded := decoded || decode(substr(encoded,pos+1,2),'hex'); pos := pos+3;
    else decoded := decoded || convert_to(part,'UTF8'); pos := pos+1;
    end if;
  end loop;
  return nullif(convert_from(decoded,'UTF8'),'');
exception when others then return null;
end;
$$;
revoke all on function storefront_security.order_file_locator_path(text) from public, anon;
grant execute on function storefront_security.order_file_locator_path(text) to authenticated, service_role;

insert into public.storefront_legacy_file_links(storage_path,order_id,tenant_id)
select distinct storefront_security.order_file_locator_path(f.file_url),f.order_id,o.tenant_id
from public.order_files f join public.orders o on o.id=f.order_id
where storefront_security.order_file_locator_path(f.file_url) is not null
  and storefront_security.order_file_locator_path(f.file_url) !~ '^checkout-(uploads|finalized)/';

create or replace function storefront_security.order_file_is_bound(p_order_id uuid,p_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists (select 1 from public.orders o where o.id=p_order_id and (
    exists (select 1 from public.storefront_checkout_attempts a
      cross join lateral jsonb_array_elements(a.files_snapshot) f
      where a.order_id=o.id and a.tenant_id=o.tenant_id and f->>'storage_path'=p_path)
    or exists (select 1 from public.storefront_legacy_file_links l
      where l.order_id=o.id and l.tenant_id=o.tenant_id and l.storage_path=p_path)
    or (split_part(p_path,'/',1)=o.id::text and split_part(p_path,'/',2)=o.user_id::text
      and p_path ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}[.](pdf|jpg|jpeg|png|ai|eps)$'
      and exists(select 1 from public.order_files f where f.order_id=o.id
        and storefront_security.order_file_locator_path(f.file_url)=p_path))
  ));
$$;
revoke all on function storefront_security.order_file_is_bound(uuid,text) from public, anon, authenticated;
grant execute on function storefront_security.order_file_is_bound(uuid,text) to service_role;

create or replace function public.storefront_order_file_is_bound(p_order_id uuid,p_path text)
returns boolean language sql stable security invoker set search_path='' as $$
  select storefront_security.order_file_is_bound(p_order_id,p_path);
$$;
revoke all on function public.storefront_order_file_is_bound(uuid,text) from public, anon, authenticated;
grant execute on function public.storefront_order_file_is_bound(uuid,text) to service_role;

create or replace function storefront_security.can_read_order_object(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists (select 1 from public.orders o
    where storefront_security.can_read_order(o.id)
      and storefront_security.order_file_is_bound(o.id,p_path));
$$;
revoke all on function storefront_security.can_read_order_object(text) from public, anon;
grant execute on function storefront_security.can_read_order_object(text) to authenticated, service_role;

drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Allow Public Upload" on storage.objects;

create policy private_order_files_read on storage.objects for select to authenticated
using (bucket_id='order-files' and (
  owner_id=(select auth.uid())::text
  or storefront_security.can_read_order_object(name)
));
-- Both referenced application tables retain their own tenant/customer RLS.
-- Restrictive copies prevent a future broad permissive policy from reopening access.
create policy private_order_files_read_boundary on storage.objects as restrictive for select to authenticated
using (bucket_id<>'order-files' or (
  owner_id=(select auth.uid())::text
  or storefront_security.can_read_order_object(name)
));
create policy private_order_files_no_anonymous_read on storage.objects as restrictive for select to anon
using (bucket_id<>'order-files');

-- Guest uploads use a short-lived signed upload grant from storefront-file-access.
-- Direct signed-in writes retain only the existing replacement and PDF-service paths.
create policy private_order_files_owned_insert on storage.objects for insert to authenticated
with check (bucket_id='order-files' and owner_id=(select auth.uid())::text and (
  name like 'designer-pdf-service-input/'||(select auth.uid())::text||'/%'
  or exists (select 1 from public.orders o where o.id::text=split_part(storage.objects.name,'/',1)
    and o.user_id=(select auth.uid()) and split_part(storage.objects.name,'/',2)=(select auth.uid())::text
    and o.requires_file_reupload and o.status not in ('cancelled','delivered','shipped'))
));
create policy private_order_files_no_anonymous_insert on storage.objects as restrictive for insert to anon
with check (bucket_id<>'order-files');
create policy private_order_files_insert_boundary on storage.objects as restrictive for insert to authenticated
with check (bucket_id<>'order-files' or (owner_id=(select auth.uid())::text and (
  name like 'designer-pdf-service-input/'||(select auth.uid())::text||'/%'
  or exists (select 1 from public.orders o where o.id::text=split_part(storage.objects.name,'/',1)
    and o.user_id=(select auth.uid()) and split_part(storage.objects.name,'/',2)=(select auth.uid())::text
    and o.requires_file_reupload and o.status not in ('cancelled','delivered','shipped'))
)));
create policy private_order_files_no_browser_update on storage.objects as restrictive for update to anon,authenticated
using (bucket_id<>'order-files') with check (bucket_id<>'order-files');
create policy private_order_files_no_anonymous_delete on storage.objects as restrictive for delete to anon
using (bucket_id<>'order-files');
create policy private_order_files_delete_temporary on storage.objects for delete to authenticated
using (bucket_id='order-files' and owner_id=(select auth.uid())::text
  and name like 'designer-pdf-service-input/'||(select auth.uid())::text||'/%');
create policy private_order_files_delete_boundary on storage.objects as restrictive for delete to authenticated
using (bucket_id<>'order-files' or (owner_id=(select auth.uid())::text
  and name like 'designer-pdf-service-input/'||(select auth.uid())::text||'/%'));

-- Existing role grants remain unchanged; RLS governs SDK and signed-link issuance.
-- Public URLs bypass RLS on public buckets, so the flag is essential as well.
update storage.buckets set public=false where id='order-files';
commit;
-- Rollback: pause uploads/new checkout and repair the affected signed reader.
-- Keep private ACLs, claims, paid orders and immutable files. Never republish the
-- bucket to recover a broken old link. Prepared/paid attempts retain finalization.
