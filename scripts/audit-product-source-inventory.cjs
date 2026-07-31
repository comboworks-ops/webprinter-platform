#!/usr/bin/env node
require("dotenv/config");

const { createClient } = require("@supabase/supabase-js");

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";

const args = new Map(
  process.argv.slice(2).flatMap((arg, index, all) => {
    if (!arg.startsWith("--")) return [];
    const key = arg.slice(2);
    const next = all[index + 1];
    if (!next || next.startsWith("--")) return [[key, "true"]];
    return [[key, next]];
  }),
);

const limit = Number(args.get("limit") || 250);
const jsonOutput = args.has("json");
const tenantFilter = args.get("tenant-id") || null;
const prioritySlugs = String(
  args.get("priority-slugs")
    || "aluminium,plexiglass,flyers,visitkort,salgsmapper,skilte,folie,klistermaerker,plakater,haefter,neon",
)
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing VITE_SUPABASE_URL and Supabase key in environment.");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function countRows(table, productId) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);

  if (error) return { count: null, error: error.message };
  return { count: typeof count === "number" ? count : 0 };
}

async function mapLimit(items, concurrency, mapper) {
  const result = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      result[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return result;
}

function classifyProduct(product, genericPriceRows, storformatCounts) {
  const specs = product.technical_specs || {};
  const structure = product.pricing_structure || {};
  const source = specs.source || specs.import_source || null;
  const importType = specs.import_type || null;
  const importScript = specs.import_script || null;
  const flags = [];

  if (specs.is_pod) flags.push("pod-v1");
  if (specs.is_pod_v2 || specs.pod2_catalog_id) flags.push("pod-v2");
  if (source === "pixart" || String(importScript || "").includes("pixart")) flags.push("pixart-fetch");
  if (source === "wmd" || String(importScript || "").includes("wmd")) flags.push("wmd-fetch");
  if (importType && !flags.some((flag) => flag.includes("fetch"))) flags.push("imported");
  if (!flags.length && product.pricing_type === "STORFORMAT") flags.push("manual-or-legacy-storformat");
  if (!flags.length && structure?.mode === "matrix_layout_v1") flags.push("manual-matrix-v1");
  if (!flags.length) flags.push("manual-or-static");

  const storformatTotal = Object.values(storformatCounts || {}).reduce((sum, entry) => {
    return sum + (typeof entry?.count === "number" ? entry.count : 0);
  }, 0);

  const expectedPricingStore = product.pricing_type === "STORFORMAT"
    ? "storformat_tables"
    : structure?.mode === "matrix_layout_v1"
      ? "generic_product_prices"
      : "product_specific_or_static";

  return {
    source,
    importType,
    importScript,
    flags,
    pricingMode: structure?.mode || null,
    pricingType: product.pricing_type || null,
    expectedPricingStore,
    genericPriceRows,
    storformatRows: storformatTotal,
    quantities: Array.isArray(structure?.quantities) ? structure.quantities.length : 0,
    layoutRows: Array.isArray(structure?.layout_rows) ? structure.layout_rows.length : 0,
    hasVerticalAxis: Boolean(structure?.vertical_axis),
  };
}

function addCount(map, key) {
  map.set(key, (map.get(key) || 0) + 1);
}

function rowHasPriority(row) {
  const haystack = `${row.slug || ""} ${row.name || ""} ${row.category || ""}`.toLowerCase();
  return prioritySlugs.some((slug) => haystack.includes(slug));
}

async function main() {
  let query = supabase
    .from("products")
    .select("id, tenant_id, slug, name, category, pricing_type, is_published, technical_specs, pricing_structure, updated_at")
    .order("updated_at", { ascending: false })
    .limit(Number.isFinite(limit) && limit > 0 ? limit : 250);

  if (tenantFilter) query = query.eq("tenant_id", tenantFilter);

  const { data: products, error } = await query;
  if (error) throw error;

  const genericCounts = new Map();
  await mapLimit(products, 8, async (product) => {
    const { count } = await countRows("generic_product_prices", product.id);
    genericCounts.set(product.id, count || 0);
  });

  const storformatTables = [
    "storformat_product_m2_prices",
    "storformat_product_price_tiers",
    "storformat_product_fixed_prices",
    "storformat_m2_prices",
    "storformat_finish_prices",
  ];
  const storformatCountsByProduct = new Map();
  const storformatProducts = products.filter((product) => product.pricing_type === "STORFORMAT");
  await mapLimit(storformatProducts, 4, async (product) => {
    const entries = {};
    for (const table of storformatTables) {
      entries[table] = await countRows(table, product.id);
    }
    storformatCountsByProduct.set(product.id, entries);
  });

  const rows = products.map((product) => {
    const classification = classifyProduct(
      product,
      genericCounts.get(product.id) || 0,
      storformatCountsByProduct.get(product.id) || {},
    );

    return {
      id: product.id,
      tenant_id: product.tenant_id,
      tenantScope: product.tenant_id === MASTER_TENANT_ID ? "master" : "tenant",
      slug: product.slug,
      name: product.name,
      category: product.category,
      is_published: product.is_published,
      ...classification,
    };
  });

  const byFlag = new Map();
  const byPricingType = new Map();
  const byExpectedStore = new Map();

  for (const row of rows) {
    for (const flag of row.flags) addCount(byFlag, flag);
    addCount(byPricingType, row.pricingType || "none");
    addCount(byExpectedStore, row.expectedPricingStore);
  }

  const issues = rows.filter((row) => {
    if (row.is_published && row.expectedPricingStore === "generic_product_prices" && row.genericPriceRows === 0) return true;
    if (row.is_published && row.expectedPricingStore === "generic_product_prices" && (!row.quantities || !row.hasVerticalAxis)) return true;
    if (row.is_published && row.expectedPricingStore === "storformat_tables" && row.storformatRows === 0) return true;
    return false;
  });

  const output = {
    generatedAt: new Date().toISOString(),
    limit,
    tenantFilter,
    totalProducts: rows.length,
    byFlag: Object.fromEntries([...byFlag.entries()].sort()),
    byPricingType: Object.fromEntries([...byPricingType.entries()].sort()),
    byExpectedStore: Object.fromEntries([...byExpectedStore.entries()].sort()),
    priorityRows: rows.filter(rowHasPriority),
    issues,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log(`Product source inventory (${output.generatedAt})`);
  console.log(`Products scanned: ${output.totalProducts}`);
  console.log("\nBy source flag:");
  for (const [key, value] of Object.entries(output.byFlag)) console.log(`- ${key}: ${value}`);
  console.log("\nBy pricing store:");
  for (const [key, value] of Object.entries(output.byExpectedStore)) console.log(`- ${key}: ${value}`);
  console.log(`\nPotential issues: ${output.issues.length}`);
  for (const row of output.issues.slice(0, 20)) {
    console.log(`- ${row.slug} (${row.name}) [${row.expectedPricingStore}]`);
  }
  console.log("\nPriority products:");
  for (const row of output.priorityRows.slice(0, 30)) {
    console.log(`- ${row.slug}: ${row.name} | ${row.flags.join(", ")} | ${row.expectedPricingStore}`);
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
