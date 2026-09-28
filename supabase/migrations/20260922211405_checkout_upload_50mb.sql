-- Match the checkout upload claim to the new 50 MiB file limit. The storage
-- bucket stays private, and existing rows and capabilities are unchanged.
begin;

alter table public.storefront_file_uploads
  drop constraint storefront_file_uploads_file_size_check;

alter table public.storefront_file_uploads
  add constraint storefront_file_uploads_file_size_check
  check (file_size >= 1 and file_size <= 52428800);

commit;

-- Rollback: first lower the frontend/backend acceptance limit. Keep this wider
-- constraint while any claims over 25 MiB exist; restoring the old CHECK would
-- reject those retained rows. Do not delete upload claims or files to roll back.
