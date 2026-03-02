# Folder Project Rollback

Use this SQL to safely archive the merged `folder-project` product in master tenant.

```sql
DO $$
DECLARE
  v_tenant uuid := '00000000-0000-0000-0000-000000000000';
  v_slug text := 'folder-project';
  v_product_id uuid;
  v_archived_slug text;
BEGIN
  SELECT id
  INTO v_product_id
  FROM public.products
  WHERE tenant_id = v_tenant
    AND slug = v_slug
  LIMIT 1;

  IF v_product_id IS NULL THEN
    RAISE NOTICE 'Rollback skipped: % not found for tenant %', v_slug, v_tenant;
    RETURN;
  END IF;

  v_archived_slug := 'folder-project-archived-' || to_char(now(), 'YYYYMMDDHH24MISS');

  UPDATE public.products
  SET
    is_published = false,
    slug = v_archived_slug,
    name = CASE
      WHEN left(coalesce(name, ''), 10) = '[ARCHIVED]' THEN name
      ELSE '[ARCHIVED] ' || coalesce(name, 'Folder Project')
    END,
    updated_at = now()
  WHERE id = v_product_id;
END $$;
```

This is non-destructive and reversible (rename slug back and re-publish if needed).
