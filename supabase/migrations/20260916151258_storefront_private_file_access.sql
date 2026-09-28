-- Private upload capabilities preserve guest checkout without making artwork public.
-- Apply this foundation before the upload handler/frontend. Bucket privacy and
-- existing object ACLs change separately after all readers support signed links.
begin;
create table public.storefront_file_uploads (
  id uuid primary key,
  tenant_id uuid not null references public.tenants(id),
  user_id uuid references auth.users(id),
  access_token_hash text not null check (access_token_hash ~ '^[a-f0-9]{64}$'),
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_size integer not null check (file_size between 1 and 26214400),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);
alter table public.storefront_file_uploads enable row level security;
-- Only the handler can read capability hashes. No public/customer Data API access.
revoke all on table public.storefront_file_uploads from public, anon, authenticated;
grant select, insert on table public.storefront_file_uploads to service_role;
create index storefront_file_uploads_expiry_idx on public.storefront_file_uploads(expires_at);
commit;
-- Rollback: disable new allocations and deploy the prior upload UI first.
-- Retain claims and objects needed by already prepared/paid attempts. Do not
-- roll back privacy by publishing customer files or deleting their upload records.
