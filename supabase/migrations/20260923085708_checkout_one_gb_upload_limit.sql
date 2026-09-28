-- Matched release only: resumable frontend + streaming checkout verification.
-- Preflight: the project's global Storage limit must permit 1 GiB (paid plan).
-- No product/pricing/POD changes and no existing object deletion.
BEGIN;
ALTER TABLE public.storefront_file_uploads
  DROP CONSTRAINT storefront_file_uploads_file_size_check;
ALTER TABLE public.storefront_file_uploads
  ADD CONSTRAINT storefront_file_uploads_file_size_check
  CHECK (file_size BETWEEN 1 AND 1073741824);
UPDATE storage.buckets SET file_size_limit = 1073741824
  WHERE id = 'order-files' AND public = false;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'order-files'
    AND public = false AND file_size_limit = 1073741824) THEN
    RAISE EXCEPTION 'Private order-files bucket required';
  END IF;
END $$;
COMMIT;
-- Rollback: turn off the large-upload frontend first. Restore the bucket limit
-- captured in preflight; retain this wider metadata constraint while existing
-- >50 MiB claims exist. Never delete large files/claims to force a rollback.
-- No tables, functions, views, grants or RLS policies are added/changed.
