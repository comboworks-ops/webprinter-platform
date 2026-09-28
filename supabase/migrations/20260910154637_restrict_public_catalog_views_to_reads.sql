-- Public catalog projections intentionally expose only published, non-secret
-- columns using owner rights. Keep that read contract; never grant callers a
-- write path around the private catalog tables' RLS. No rows/prices change.
REVOKE ALL PRIVILEGES ON TABLE public.pod_catalog_public, public.pod2_catalog_public
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.pod_catalog_public, public.pod2_catalog_public
  TO anon, authenticated;

-- Refuse deployment if inherited or column-level grants leave a write bypass.
DO $$
DECLARE
  catalog_view text;
  caller_role text;
BEGIN
  FOREACH catalog_view IN ARRAY ARRAY['public.pod_catalog_public', 'public.pod2_catalog_public'] LOOP
    FOREACH caller_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF NOT has_table_privilege(caller_role, catalog_view, 'SELECT')
        OR has_table_privilege(caller_role, catalog_view, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege(caller_role, catalog_view, 'INSERT,UPDATE,REFERENCES') THEN
        RAISE EXCEPTION 'Public catalog privilege contract failed: % / %', catalog_view, caller_role;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Rollback: keep the read-only grants. If a caller needs an authorized write,
-- repair that caller to use the existing gated catalog path. Do not restore
-- public write grants or alter POD tables/pricing as a rollback.
