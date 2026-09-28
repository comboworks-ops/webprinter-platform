-- Keep the private order-files bucket aligned with checkout's 50 MiB cap.
-- A NULL bucket limit already inherits the project's global setting.
update storage.buckets
set file_size_limit = 52428800
where id = 'order-files'
  and file_size_limit is not null
  and file_size_limit < 52428800;

-- Rollback: first lower all checkout writers. Preserve existing uploaded files;
-- reduce this cap only when no accepted checkout flow requires larger uploads.
