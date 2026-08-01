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
  assert.match(sql, /set search_path = pg_catalog, public/i);
  assert.match(
    sql,
    /from public\.products[\s\S]*for update/i,
  );
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
