import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPOSITORY_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE_GATE_PATH = join(
  REPOSITORY_DIR,
  "scripts/check-reference-integrations-release.sh",
);

const MIGRATION_URL = new URL(
  "../supabase/migrations/20260731120000_reference_integration_evidence.sql",
  import.meta.url,
);
const POSTNORD_ADMISSION_MIGRATION_URL = new URL(
  "../supabase/migrations/20260801133000_postnord_tracking_admission.sql",
  import.meta.url,
);
const EVIDENCE_CASCADE_CORRECTION_MIGRATION_URL = new URL(
  "../supabase/migrations/20260801140000_reference_evidence_cascade_correction.sql",
  import.meta.url,
);
const DEFINER_MIGRATION_URLS = [
  MIGRATION_URL,
  new URL(
    "../supabase/migrations/20260801120000_business_evidence_request_hardening.sql",
    import.meta.url,
  ),
  new URL(
    "../supabase/migrations/20260801130000_postnord_tracking_contract_and_atomicity.sql",
    import.meta.url,
  ),
  POSTNORD_ADMISSION_MIGRATION_URL,
];

async function migrationSql() {
  return (await readFile(MIGRATION_URL, "utf8")).replace(/\r\n/g, "\n");
}

async function postNordAdmissionMigrationSql() {
  return (await readFile(POSTNORD_ADMISSION_MIGRATION_URL, "utf8"))
    .replace(/\r\n/g, "\n");
}

async function evidenceCascadeCorrectionMigrationSql() {
  return (await readFile(EVIDENCE_CASCADE_CORRECTION_MIGRATION_URL, "utf8"))
    .replace(/\r\n/g, "\n");
}

test("all reference integration definers use a pg_catalog-only search path", async () => {
  for (const migrationUrl of DEFINER_MIGRATION_URLS) {
    const sql = (await readFile(migrationUrl, "utf8")).replace(/\r\n/g, "\n");
    const definers = [...sql.matchAll(/security definer/gi)];
    for (const definer of definers) {
      assert.match(
        sql.slice(definer.index, definer.index + 160),
        /security definer[\s\S]*set search_path = pg_catalog\s*(?:\n|$)/i,
        String(migrationUrl),
      );
    }
    assert.doesNotMatch(sql, /set search_path = pg_catalog\s*,/i);
  }
});

test("reference evidence migration records the exact safe rollback order", async () => {
  const sql = await migrationSql();

  assert.match(
    sql,
    /-- 1\. Disable reference-fx-snapshot, tenant-business-evidence, and postnord-tracking-sync\.\n-- 2\. Stop all reference-integration cron invocations\.\n-- 3\. Drop policies and explicit grants\/functions introduced here\.\n-- 4\. Drop carrier_tracking_events_v1, tenant_business_evidence, supplier_fx_rate_snapshots\.\n-- Existing products, product prices, orders, delivery_tracking, POD tables, and ERP shadow files are untouched\./,
  );
});

test("all three additive evidence tables have bounded, versioned contracts", async () => {
  const sql = await migrationSql();

  for (const table of [
    "supplier_fx_rate_snapshots",
    "tenant_business_evidence",
    "carrier_tracking_events_v1",
  ]) {
    assert.match(sql, new RegExp(`create table public\\.${table} \\(`, "i"));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  }

  assert.match(sql, /schema_version smallint not null default 1/i);
  assert.match(sql, /check \(schema_version = 1\)/i);
  assert.match(sql, /check \(rate > 0 and rate <= 100\)/i);
  assert.match(sql, /source_payload_sha256 ~ '\^\[a-f0-9\]\{64\}\$'/i);
  assert.match(sql, /jsonb_typeof\(display_fields\) = 'object'/i);
  assert.match(sql, /octet_length\(display_fields::text\) <= 8192/i);
  assert.match(
    sql,
    /response_digest text\s+check \(response_digest is null or response_digest ~ '\^\[a-f0-9\]\{64\}\$'\)/i,
  );
  assert.match(
    sql,
    /evidence_digest text not null\s+check \(evidence_digest ~ '\^\[a-f0-9\]\{64\}\$'\)/i,
  );
  assert.match(sql, /check \(carrier = 'postnord'\)/i);
  assert.match(
    sql,
    /check \(\s*char_length\(tracking_number\) between 1 and 100[\s\S]*?tracking_number = btrim\(tracking_number\)\s*\)/i,
  );
});

test("FX rate storage rejects values beyond the six-decimal evidence contract", async () => {
  const sql = await migrationSql();

  assert.match(sql, /rate numeric not null/i);
  assert.doesNotMatch(sql, /rate numeric\s*\(\s*\d+\s*,\s*\d+\s*\)/i);
  assert.match(sql, /scale\(rate\) between 0 and 6/i);
});

test("FX chronology compares rate dates with the UTC fetch date", async () => {
  const sql = await migrationSql();

  assert.match(
    sql,
    /check \(rate_date <= \(fetched_at at time zone 'UTC'\)::date\)/i,
  );
  assert.doesNotMatch(sql, /rate_date <= fetched_at::date/i);
});

test("FX snapshots and provider events are immutable and replay-safe", async () => {
  const sql = await migrationSql();

  assert.match(
    sql,
    /unique \(provider, base_currency, quote_currency, rate_date, source_payload_sha256\)/i,
  );
  assert.match(sql, /unique \(tenant_id, provider, request_fingerprint\)/i);
  assert.match(sql, /unique \(carrier, tracking_number, provider_event_id\)/i);
  assert.match(sql, /unique \(carrier, tracking_number, fallback_dedupe_key\)/i);
  assert.match(
    sql,
    /create trigger supplier_fx_rate_snapshots_immutable[\s\S]*before update or delete on public\.supplier_fx_rate_snapshots[\s\S]*execute function public\.reject_reference_evidence_mutation\(\)/i,
  );
  assert.match(
    sql,
    /create trigger tenant_business_evidence_immutable\s*before update or delete on public\.tenant_business_evidence/i,
  );
  assert.match(
    sql,
    /create trigger carrier_tracking_events_v1_immutable\s*before update or delete on public\.carrier_tracking_events_v1/i,
  );
  assert.doesNotMatch(
    sql,
    /create\s+(?:or\s+replace\s+)?function[^;]*(?:update|delete)_.*snapshot/i,
  );
});

test("forward correction preserves update immutability while allowing declared parent cascades", async () => {
  const sql = await evidenceCascadeCorrectionMigrationSql();

  for (const table of [
    "tenant_business_evidence",
    "carrier_tracking_events_v1",
  ]) {
    assert.match(
      sql,
      new RegExp(
        `revoke delete on table public\\.${table}\\s+from public, anon, authenticated, service_role`,
        "i",
      ),
    );
    assert.match(
      sql,
      new RegExp(
        `create trigger ${table}_immutable\\s+before update on public\\.${table}`,
        "i",
      ),
    );
    assert.doesNotMatch(
      sql,
      new RegExp(
        `create trigger ${table}_immutable[\\s\\S]*before update or delete on public\\.${table}`,
        "i",
      ),
    );
  }

  assert.match(
    sql,
    /drop trigger tenant_business_evidence_immutable\s+on public\.tenant_business_evidence/i,
  );
  assert.match(
    sql,
    /drop trigger carrier_tracking_events_v1_immutable\s+on public\.carrier_tracking_events_v1/i,
  );
  assert.doesNotMatch(sql, /pg_trigger_depth\s*\(/i);
  assert.match(sql, /Rollback order:[\s\S]*disable all evidence writers/i);
  assert.match(
    sql,
    /declared tenant\/order foreign-key cascades remain the only application deletion path/i,
  );
});

test("authenticated users receive read-only Data API grants", async () => {
  const sql = await migrationSql();

  for (const table of [
    "supplier_fx_rate_snapshots",
    "tenant_business_evidence",
    "carrier_tracking_events_v1",
  ]) {
    assert.match(
      sql,
      new RegExp(
        `revoke all on table public\\.${table} from public, anon, authenticated`,
        "i",
      ),
    );
    assert.match(
      sql,
      new RegExp(`grant select on table public\\.${table} to authenticated`, "i"),
    );
    assert.match(
      sql,
      new RegExp(`grant all on table public\\.${table} to service_role`, "i"),
    );
    assert.doesNotMatch(
      sql,
      new RegExp(
        `grant (?:insert|update|delete|all)[^;]*public\\.${table}[^;]*authenticated`,
        "i",
      ),
    );
  }
});

test("tenant evidence policies are SELECT-only and tracking rows match an accessible order", async () => {
  const sql = await migrationSql();

  assert.match(
    sql,
    /create policy tenant_business_evidence_tenant_read[\s\S]*for select to authenticated[\s\S]*using \(public\.can_access_tenant\(tenant_id\)\)/i,
  );
  assert.match(
    sql,
    /create policy carrier_tracking_events_v1_tenant_order_read[\s\S]*for select to authenticated[\s\S]*public\.can_access_tenant\(carrier_tracking_events_v1\.tenant_id\)[\s\S]*from public\.orders/i,
  );
  assert.match(sql, /orders\.id = carrier_tracking_events_v1\.order_id/i);
  assert.match(sql, /orders\.tenant_id = carrier_tracking_events_v1\.tenant_id/i);
  assert.match(
    sql,
    /create trigger carrier_tracking_events_v1_order_tenant_guard[\s\S]*before insert on public\.carrier_tracking_events_v1[\s\S]*execute function public\.enforce_reference_tracking_order_tenant\(\)/i,
  );
  assert.match(
    sql,
    /from public\.orders[\s\S]*id = new\.order_id[\s\S]*tenant_id = new\.tenant_id[\s\S]*for share/i,
  );
  assert.doesNotMatch(
    sql,
    /create policy[^;]*for (?:insert|update|delete|all) to authenticated/is,
  );
});

test("PostNord provider work has one private fenced claim, completion, and block boundary", async () => {
  const sql = await postNordAdmissionMigrationSql();

  assert.match(sql, /create table public\.postnord_tracking_sync_claims/i);
  assert.match(sql, /create table public\.postnord_tracking_provider_state/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /create function public\.claim_postnord_tracking_sync\(/i);
  assert.match(sql, /create function public\.renew_postnord_tracking_sync\(/i);
  assert.match(sql, /create function public\.complete_postnord_tracking_sync\(/i);
  assert.match(sql, /create function public\.finish_postnord_tracking_sync\(/i);
  assert.match(sql, /tracking_identity/i);
  assert.match(sql, /claim_token uuid/i);
  assert.match(sql, /fence_token bigint/i);
  assert.match(sql, /latest_fence is distinct from owned_claim\.fence_token/i);
  assert.match(sql, /from public\.orders[\s\S]*for share/i);
  assert.match(sql, /'cached'::text, 0::integer, null::uuid/i);
  assert.match(sql, /'in_flight'::text/i);
  assert.match(sql, /'provider_blocked'::text/i);
  assert.match(sql, /'rate_limited'::text/i);
  assert.match(sql, /global_request_count >= 120/i);
  assert.match(sql, /interval '10 minutes'/i);
  assert.match(sql, /interval '24 hours'/i);
  assert.match(sql, /cache_expires_at = completion_time \+ interval '1 minute'/i);
  assert.match(sql, /status = 'succeeded'/i);
  assert.match(sql, /status = new_status/i);
  assert.match(sql, /blocked_until = greatest/i);
  assert.match(sql, /make_interval\(secs => _retry_after_seconds\)/i);
  assert.match(
    sql,
    /from public\.persist_postnord_tracking_events_v1\(_events\)[\s\S]*status = 'succeeded'/i,
  );
  assert.match(
    sql,
    /revoke all on table public\.postnord_tracking_sync_claims[\s\S]*from public, anon, authenticated, service_role/i,
  );
  assert.doesNotMatch(
    sql,
    /grant (?:insert|update|delete|all)[^;]*postnord_tracking_sync_claims/i,
  );
  assert.doesNotMatch(
    sql,
    /grant (?:select|insert|update|delete|all)[^;]*postnord_tracking_provider_state/i,
  );
  assert.match(
    sql,
    /revoke execute on function public\.claim_postnord_tracking_sync\([\s\S]*from public, anon, authenticated/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.claim_postnord_tracking_sync\([\s\S]*to service_role/i,
  );
  for (const functionName of [
    "renew_postnord_tracking_sync",
    "complete_postnord_tracking_sync",
    "finish_postnord_tracking_sync",
  ]) {
    assert.match(
      sql,
      new RegExp(
        `revoke execute on function public\\.${functionName}\\([\\s\\S]*from public, anon, authenticated, service_role`,
        "i",
      ),
    );
    assert.match(
      sql,
      new RegExp(
        `grant execute on function public\\.${functionName}\\([\\s\\S]*to service_role`,
        "i",
      ),
    );
  }
  assert.match(
    sql,
    /revoke execute on function public\.persist_postnord_tracking_events_v1\(jsonb\)\s+from service_role/i,
  );
});

test("reference integrations release gate requires both PostgreSQL 17 suites", async () => {
  const [gate, packageJson, runbook, plan] = await Promise.all([
    readFile(RELEASE_GATE_PATH, "utf8"),
    readFile(join(REPOSITORY_DIR, "package.json"), "utf8"),
    readFile(join(REPOSITORY_DIR, "docs/REFERENCE_INTEGRATIONS.md"), "utf8"),
    readFile(
      join(
        REPOSITORY_DIR,
        "docs/superpowers/plans/2026-07-31-webprinter-reference-integrations.md",
      ),
      "utf8",
    ),
  ]);

  assert.match(gate, /run-business-evidence-hardening-pg17\.sh/);
  assert.match(gate, /run-wmd-snapshot-draft-pg17\.sh/);
  assert.match(
    await readFile(
      join(REPOSITORY_DIR, "scripts/run-business-evidence-hardening-pg17.sh"),
      "utf8",
    ),
    /20260801140000_reference_evidence_cascade_correction\.sql/,
  );
  assert.match(
    packageJson,
    /"check:reference-integrations:release":\s*"bash scripts\/check-reference-integrations-release\.sh"/,
  );
  assert.match(runbook, /BLOCKED[^\n]*not a pass/i);
  assert.match(plan, /check:reference-integrations:release/);
});

test("reference integrations release gate fails closed when Docker is unavailable", () => {
  const result = spawnSync("/bin/bash", [RELEASE_GATE_PATH], {
    cwd: REPOSITORY_DIR,
    encoding: "utf8",
    env: {
      ...process.env,
      REFERENCE_INTEGRATIONS_FORCE_DOCKER_UNAVAILABLE: "1",
    },
  });

  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /BLOCKED.*Docker.*not passed/is);
});
