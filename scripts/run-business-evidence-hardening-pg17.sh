#!/usr/bin/env bash
set -euo pipefail

repository_dir="$(cd "$(dirname "$0")/.." && pwd)"
container_name="webprinter-business-evidence-pg17-$$"
postgres_password="business-evidence-local-test"
concurrency_dir="$(mktemp -d)"

cleanup() {
  docker stop "$container_name" >/dev/null 2>&1 || true
  rm -rf "$concurrency_dir"
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
# The image briefly exposes its initialization server before the final daemon.
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
  < "$repository_dir/scripts/business-evidence/__tests__/postgres/business-evidence-hardening-schema.sql"
docker exec -i "$container_name" psql -U postgres -d postgres \
  < "$repository_dir/supabase/migrations/20260731120000_reference_integration_evidence.sql"
docker exec -i "$container_name" psql -U postgres -d postgres \
  < "$repository_dir/supabase/migrations/20260801120000_business_evidence_request_hardening.sql"
docker exec -i "$container_name" psql -U postgres -d postgres \
  < "$repository_dir/supabase/migrations/20260801130000_postnord_tracking_contract_and_atomicity.sql"
docker exec -i "$container_name" psql -U postgres -d postgres \
  < "$repository_dir/supabase/migrations/20260801133000_postnord_tracking_admission.sql"
docker exec -i "$container_name" psql -U postgres -d postgres \
  < "$repository_dir/supabase/migrations/20260801140000_reference_evidence_cascade_correction.sql"
docker exec -i "$container_name" psql -U postgres -d postgres \
  < "$repository_dir/supabase/migrations/20260802090000_carrier_tracking_customer_read_authority.sql"
docker exec -i "$container_name" psql -U postgres -d postgres \
  < "$repository_dir/scripts/business-evidence/__tests__/postgres/business-evidence-hardening-test.sql"

docker exec "$container_name" psql -U postgres -d postgres -c \
  'truncate public.tenant_business_evidence_request_claims' >/dev/null

for index in {1..8}; do
  docker exec "$container_name" psql -U postgres -d postgres -Atc \
    "set role service_role; select disposition from public.claim_tenant_business_evidence_request('10000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','vies','EU VIES','eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee');" \
    >"$concurrency_dir/$index" &
done
wait

claimed_count="$(
  { rg -l '^claimed$' "$concurrency_dir" || true; } | wc -l | tr -d ' '
)"
in_flight_count="$(
  { rg -l '^in_flight$' "$concurrency_dir" || true; } | wc -l | tr -d ' '
)"
if [[ "$claimed_count" -ne 1 || "$in_flight_count" -ne 7 ]]; then
  echo "Expected one atomic provider claim and seven in-flight rejections; got claimed=$claimed_count in_flight=$in_flight_count" >&2
  sed -n '1,20p' "$concurrency_dir"/* >&2
  exit 1
fi

docker exec "$container_name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  -c "truncate public.postnord_tracking_sync_claims; truncate public.postnord_tracking_provider_state; update public.orders set tracking_number = '0037 3500-4895 3047 0000' where id = '60000000-0000-4000-8000-000000000001';" \
  >/dev/null

for index in {1..8}; do
  docker exec "$container_name" psql -U postgres -d postgres -Atc \
    "set role service_role; select disposition from public.claim_postnord_tracking_sync('10000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','00373500489530470000');" \
    >"$concurrency_dir/$index" &
done
wait

claimed_count="$(
  { rg -l '^claimed$' "$concurrency_dir" || true; } | wc -l | tr -d ' '
)"
in_flight_count="$(
  { rg -l '^in_flight$' "$concurrency_dir" || true; } | wc -l | tr -d ' '
)"
if [[ "$claimed_count" -ne 1 || "$in_flight_count" -ne 7 ]]; then
  echo "Expected one atomic PostNord claim and seven local in-flight rejections; got claimed=$claimed_count in_flight=$in_flight_count" >&2
  sed -n '1,20p' "$concurrency_dir"/* >&2
  exit 1
fi

docker exec -i "$container_name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
truncate public.tenant_business_evidence_request_claims;

do $test$
declare
  result text;
  index integer;
  actor_id uuid;
begin
  for index in 1..12 loop
    select disposition into result
    from public.claim_tenant_business_evidence_request(
      '10000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      'vies',
      'EU VIES',
      repeat('a', 64)
    );
    perform public.test_assert(result = 'replay', 'first twelve cached evidence requests must replay');
  end loop;

  select disposition into result
  from public.claim_tenant_business_evidence_request(
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'vies',
    'EU VIES',
    repeat('a', 64)
  );
  perform public.test_assert(result = 'rate_limited', 'thirteenth cached evidence request must be rate limited');

  truncate public.tenant_business_evidence_request_claims;
  select disposition into result
  from public.claim_tenant_business_evidence_request(
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'vies',
    'EU VIES',
    repeat('e', 64)
  );
  perform public.test_assert(result = 'claimed', 'first uncached request must be claimed');
  for index in 2..12 loop
    select disposition into result
    from public.claim_tenant_business_evidence_request(
      '10000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      'vies',
      'EU VIES',
      repeat('e', 64)
    );
    perform public.test_assert(result = 'in_flight', 'duplicate in-flight requests must be rejected before the provider');
  end loop;

  select disposition into result
  from public.claim_tenant_business_evidence_request(
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'vies',
    'EU VIES',
    repeat('e', 64)
  );
  perform public.test_assert(result = 'rate_limited', 'thirteenth in-flight request must be rate limited');

  truncate public.tenant_business_evidence_request_claims;
  for index in 1..12 loop
    select disposition into result
    from public.claim_tenant_business_evidence_request(
      '10000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      'vies',
      'EU VIES',
      lpad(to_hex(index), 64, '0')
    );
    perform public.test_assert(result = 'claimed', 'first twelve varied user requests must be claimed');
  end loop;

  select disposition into result
  from public.claim_tenant_business_evidence_request(
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    'vies',
    'EU VIES',
    repeat('f', 64)
  );
  perform public.test_assert(result = 'rate_limited', 'thirteenth varied user request must be rate limited');

  truncate public.tenant_business_evidence_request_claims;
  for index in 1..60 loop
    actor_id := ('50000000-0000-4000-8000-' || lpad(index::text, 12, '0'))::uuid;
    select disposition into result
    from public.claim_tenant_business_evidence_request(
      '10000000-0000-4000-8000-000000000001',
      actor_id,
      'danish_company',
      'Datafordeler CVR',
      lpad(to_hex(index + 100), 64, '0')
    );
    perform public.test_assert(result = 'claimed', 'first sixty varied tenant requests must be claimed');
  end loop;

  select disposition into result
  from public.claim_tenant_business_evidence_request(
    '10000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000099',
    'danish_company',
    'Datafordeler CVR',
    repeat('9', 64)
  );
  perform public.test_assert(result = 'rate_limited', 'sixty-first varied tenant request must be rate limited');
end;
$test$;

select 'business evidence PostgreSQL 17 concurrency and quota checks passed' as result;
SQL
