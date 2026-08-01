import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MIGRATION_URL = new URL(
  "../supabase/migrations/20260731120000_reference_integration_evidence.sql",
  import.meta.url,
);

async function migrationSql() {
  return (await readFile(MIGRATION_URL, "utf8")).replace(/\r\n/g, "\n");
}

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
  assert.match(sql, /check \(carrier = 'postnord'\)/i);
  assert.match(
    sql,
    /check \(\s*char_length\(tracking_number\) between 1 and 100[\s\S]*?tracking_number = btrim\(tracking_number\)\s*\)/i,
  );
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
    /create trigger tenant_business_evidence_immutable\s*before update on public\.tenant_business_evidence/i,
  );
  assert.match(
    sql,
    /create trigger carrier_tracking_events_v1_immutable\s*before update on public\.carrier_tracking_events_v1/i,
  );
  assert.doesNotMatch(
    sql,
    /create trigger (?:tenant_business_evidence|carrier_tracking_events_v1)_immutable\s*before update or delete/i,
  );
  assert.doesNotMatch(
    sql,
    /create\s+(?:or\s+replace\s+)?function[^;]*(?:update|delete)_.*snapshot/i,
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
