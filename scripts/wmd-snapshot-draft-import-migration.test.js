import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const MIGRATION_URL = new URL(
  "../supabase/migrations/20260731123000_wmd_snapshot_draft_import.sql",
  import.meta.url,
);

async function migrationSql() {
  return (await readFile(MIGRATION_URL, "utf8")).replace(/\r\n/g, "\n");
}

test("snapshot draft import is one service-role-only locked transaction", async () => {
  const sql = await migrationSql();

  assert.match(
    sql,
    /create function public\.apply_wmd_roll_label_snapshot_draft_import\(/i,
  );
  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path = pg_catalog\s+as \$function\$/i);
  assert.doesNotMatch(sql, /set search_path = pg_catalog\s*,/i);
  assert.match(
    sql,
    /from public\.products[\s\S]*for update/i,
  );
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /target_input\.product_id/i);
  assert.match(sql, /target_input\.expected_revision/i);
  assert.match(sql, /target_input\.import_id/i);
  assert.match(sql, /target_input\.payload_digest/i);
  assert.match(
    sql,
    /where products\.tenant_id = _tenant_id\s+and products\.id = target_input\.product_id\s+for update/i,
  );
  assert.match(sql, /snapshot draft create target already exists/i);
  assert.match(sql, /stale snapshot draft revision/i);
  assert.match(sql, /snapshot import id was reused with different payload/i);
  assert.match(sql, /create table public\.wmd_snapshot_draft_import_state/i);
  assert.match(sql, /revision bigint not null/i);
  assert.match(sql, /import_id uuid not null/i);
  assert.match(sql, /payload_digest text not null/i);
  assert.match(sql, /payload_fingerprint text not null/i);
  assert.match(
    sql,
    /authoritative_payload_fingerprint := encode\([\s\S]*extensions\.digest\([\s\S]*_payload #- '\{target,payload_digest\}'::text\[\][\s\S]*'sha256'/i,
  );
  assert.match(
    sql,
    /existing_import_state\.payload_fingerprint[\s\S]*is distinct from authoritative_payload_fingerprint/i,
  );
  assert.match(
    sql,
    /revoke all on table public\.wmd_snapshot_draft_import_state[\s\S]*from public, anon, authenticated, service_role/i,
  );
  assert.doesNotMatch(
    sql,
    /grant (?:insert|update|delete|all)[^;]*wmd_snapshot_draft_import_state/i,
  );
  assert.match(
    sql,
    /from public\.wmd_snapshot_draft_import_state[\s\S]*for update/i,
  );
  assert.match(sql, /rounding_mode/i);
  assert.match(sql, /if target_is_published then[\s\S]*raise exception/i);
  assert.doesNotMatch(
    sql,
    /update public\.products\s+set\s+is_published\s*=/i,
  );
  assert.match(
    sql,
    /revoke all on function public\.apply_wmd_roll_label_snapshot_draft_import[\s\S]*from public, anon, authenticated/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.apply_wmd_roll_label_snapshot_draft_import[\s\S]*to service_role/i,
  );
});

test("snapshot draft import owns the complete destructive replacement", async () => {
  const sql = await migrationSql();

  for (const table of [
    "storformat_product_m2_prices",
    "storformat_product_price_tiers",
    "storformat_product_fixed_prices",
    "storformat_m2_prices",
    "storformat_finish_prices",
    "storformat_material_price_tiers",
    "storformat_finish_price_tiers",
    "storformat_products",
    "storformat_finishes",
    "storformat_materials",
  ]) {
    assert.match(
      sql,
      new RegExp(`delete from public\\.${table}\\s+where product_id = target_product_id`, "i"),
    );
  }

  for (const table of [
    "storformat_materials",
    "storformat_material_price_tiers",
    "storformat_m2_prices",
    "storformat_products",
    "storformat_product_price_tiers",
    "storformat_product_m2_prices",
    "storformat_configs",
  ]) {
    assert.match(sql, new RegExp(`(?:insert into|update) public\\.${table}`, "i"));
  }
});
