#!/usr/bin/env bash
set -euo pipefail

repository_dir="$(cd "$(dirname "$0")/.." && pwd)"
container_name="webprinter-wmd-snapshot-pg17-$$"
postgres_password="wmd-snapshot-local-test"
import_output="$(mktemp)"
publish_output="$(mktemp)"
locker_output="$(mktemp)"
rejected_output="$(mktemp)"
editor_output="$(mktemp)"

cleanup() {
  docker stop "$container_name" >/dev/null 2>&1 || true
  rm -f "$import_output" "$publish_output" "$locker_output" "$rejected_output" "$editor_output"
}
trap cleanup EXIT

docker run --rm --name "$container_name" \
  -e POSTGRES_PASSWORD="$postgres_password" \
  -d postgres:17-alpine >/dev/null

for _attempt in {1..300}; do
  if docker exec "$container_name" \
    psql -U postgres -d postgres -Atc 'SELECT 1' >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done
# The image briefly runs an initialization server before the final daemon.
# Confirm again after that handoff rather than racing the socket restart.
sleep 0.5
for _attempt in {1..300}; do
  if docker exec "$container_name" \
    psql -U postgres -d postgres -Atc 'SELECT 1' >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done
docker exec "$container_name" \
  psql -U postgres -d postgres -Atc 'SELECT 1' >/dev/null

server_version="$(
  docker exec "$container_name" \
    psql -U postgres -d postgres -Atc 'SHOW server_version_num'
)"
if [[ "$server_version" -lt 170000 || "$server_version" -ge 180000 ]]; then
  echo "Expected PostgreSQL 17, got server_version_num=$server_version" >&2
  exit 1
fi

docker exec -i "$container_name" psql -U postgres -d postgres \
  < "$repository_dir/scripts/product-import/__tests__/postgres/wmd-snapshot-draft-schema.sql"
docker exec -i "$container_name" psql -U postgres -d postgres \
  < "$repository_dir/supabase/migrations/20260731123000_wmd_snapshot_draft_import.sql"
docker exec -i "$container_name" psql -U postgres -d postgres \
  < "$repository_dir/scripts/product-import/__tests__/postgres/wmd-snapshot-draft-test.sql"

docker exec -i "$container_name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE OR REPLACE FUNCTION public.test_pause_snapshot_import()
RETURNS trigger
LANGUAGE plpgsql
AS $pause$
BEGIN
  PERFORM pg_advisory_xact_lock(8675309);
  RETURN NEW;
END;
$pause$;

CREATE TRIGGER test_pause_snapshot_import
BEFORE INSERT ON public.storformat_materials
FOR EACH ROW EXECUTE FUNCTION public.test_pause_snapshot_import();

UPDATE public.products
SET is_published = false
WHERE slug = 'wmd-roll-labels-test';
SELECT public.apply_wmd_roll_label_snapshot_draft_import(
  '00000000-0000-4000-8000-000000000001',
  public.test_wmd_replace_payload(
    'Before import-first race',
    'Before import-first material',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7',
    repeat('3', 64)
  )
);
SQL

docker exec -e PGAPPNAME=wmd_advisory_locker "$container_name" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c 'SELECT pg_advisory_lock(8675309); SELECT pg_sleep(3); SELECT pg_advisory_unlock(8675309);' \
  >"$locker_output" 2>&1 &
locker_pid=$!

for _attempt in {1..100}; do
  lock_count="$(
    docker exec "$container_name" psql -U postgres -d postgres -Atc \
      "SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND granted"
  )"
  if [[ "$lock_count" -ge 1 ]]; then
    break
  fi
  sleep 0.1
done

docker exec -e PGAPPNAME=wmd_import_first "$container_name" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT public.apply_wmd_roll_label_snapshot_draft_import('00000000-0000-4000-8000-000000000001', public.test_wmd_replace_payload('Import-first race', 'Import-first material', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa8', repeat('4', 64)));" \
  >"$import_output" 2>&1 &
import_pid=$!

for _attempt in {1..100}; do
  waiting_count="$(
    docker exec "$container_name" psql -U postgres -d postgres -Atc \
      "SELECT count(*) FROM pg_stat_activity WHERE application_name = 'wmd_import_first' AND wait_event_type = 'Lock'"
  )"
  if [[ "$waiting_count" -eq 1 ]]; then
    break
  fi
  sleep 0.1
done
if [[ "$waiting_count" -ne 1 ]]; then
  echo "Import did not reach the locked transaction race point" >&2
  exit 1
fi

if docker exec -e PGAPPNAME=wmd_manual_editor_race "$container_name" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "SET ROLE authenticated; INSERT INTO public.storformat_configs (tenant_id, product_id, rounding_step, global_markup_pct, quantities) SELECT tenant_id, id, 77, 0, ARRAY[1] FROM public.products WHERE slug = 'wmd-roll-labels-test' ON CONFLICT (product_id) DO UPDATE SET rounding_step = excluded.rounding_step;" \
  >"$editor_output" 2>&1; then
  echo "Manual editor unexpectedly wrote through the WMD import fence" >&2
  exit 1
fi

docker exec -e PGAPPNAME=wmd_publish_after_import "$container_name" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "UPDATE public.products SET is_published = true WHERE slug = 'wmd-roll-labels-test';" \
  >"$publish_output" 2>&1 &
publish_pid=$!

for _attempt in {1..100}; do
  publisher_waiting="$(
    docker exec "$container_name" psql -U postgres -d postgres -Atc \
      "SELECT count(*) FROM pg_stat_activity WHERE application_name = 'wmd_publish_after_import' AND wait_event_type = 'Lock'"
  )"
  if [[ "$publisher_waiting" -eq 1 ]]; then
    break
  fi
  sleep 0.1
done
if [[ "$publisher_waiting" -ne 1 ]]; then
  echo "Publisher did not wait behind the atomic import" >&2
  exit 1
fi

wait "$locker_pid"
wait "$import_pid"
wait "$publish_pid"

docker exec -i "$container_name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SELECT public.test_assert(
  (SELECT is_published FROM public.products WHERE slug = 'wmd-roll-labels-test'),
  'publisher must run after the import commits'
);
SELECT public.test_assert(
  (SELECT name = 'Import-first race' FROM public.products WHERE slug = 'wmd-roll-labels-test'),
  'import-first product update must commit atomically before publication'
);
SELECT public.test_assert(
  (SELECT name = 'Import-first material' FROM public.storformat_materials),
  'import-first child replacement must commit before publication'
);
SELECT public.test_assert(
  (SELECT rounding_step = 1 FROM public.storformat_configs),
  'concurrent manual editor must not overwrite managed snapshot config'
);
DROP TRIGGER test_pause_snapshot_import ON public.storformat_materials;
DROP FUNCTION public.test_pause_snapshot_import();

UPDATE public.products
SET is_published = false
WHERE slug = 'wmd-roll-labels-test';
SELECT public.apply_wmd_roll_label_snapshot_draft_import(
  '00000000-0000-4000-8000-000000000001',
  public.test_wmd_replace_payload(
    'Before publish-first race',
    'Before publish-first material',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9',
    repeat('5', 64)
  )
);
SQL

docker exec -e PGAPPNAME=wmd_publish_first "$container_name" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "BEGIN; UPDATE public.products SET is_published = true WHERE slug = 'wmd-roll-labels-test'; SELECT pg_sleep(3); COMMIT;" \
  >"$publish_output" 2>&1 &
publish_first_pid=$!

for _attempt in {1..100}; do
  publisher_sleeping="$(
    docker exec "$container_name" psql -U postgres -d postgres -Atc \
      "SELECT count(*) FROM pg_stat_activity WHERE application_name = 'wmd_publish_first' AND wait_event = 'PgSleep'"
  )"
  if [[ "$publisher_sleeping" -eq 1 ]]; then
    break
  fi
  sleep 0.1
done
if [[ "$publisher_sleeping" -ne 1 ]]; then
  echo "Publish-first transaction did not reach its race point" >&2
  exit 1
fi

if docker exec -e PGAPPNAME=wmd_import_after_publish "$container_name" \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "SELECT public.apply_wmd_roll_label_snapshot_draft_import('00000000-0000-4000-8000-000000000001', public.test_wmd_replace_payload('Must lose publish race', 'Must lose publish race', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('6', 64)));" \
  >"$rejected_output" 2>&1; then
  echo "Import unexpectedly mutated a concurrently published product" >&2
  exit 1
fi
wait "$publish_first_pid"
if ! rg -q "unpublished draft" "$rejected_output"; then
  echo "Publish-first rejection did not return the draft-only error" >&2
  sed -n '1,80p' "$rejected_output" >&2
  exit 1
fi

docker exec -i "$container_name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
SELECT public.test_assert(
  (SELECT is_published FROM public.products WHERE slug = 'wmd-roll-labels-test'),
  'publish-first transaction must commit publication'
);
SELECT public.test_assert(
  (SELECT name = 'Before publish-first race' FROM public.products WHERE slug = 'wmd-roll-labels-test'),
  'losing import must not mutate the published product'
);
SELECT public.test_assert(
  (SELECT name = 'Before publish-first material' FROM public.storformat_materials),
  'losing import must not partially replace child rows'
);
SELECT 'WMD snapshot draft PostgreSQL 17 race checks passed' AS result;
SQL
