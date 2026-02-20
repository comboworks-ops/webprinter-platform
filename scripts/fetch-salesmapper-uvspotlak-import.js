#!/usr/bin/env node
/**
 * fetch-salesmapper-uvspotlak-import.js
 *
 * Scrapes prices for the "Salgsmapper med UV Spotlak" product from
 * wir-machen-druck.de (partieller UV-Lack-Veredelung pages) and imports
 * them into the Supabase database.
 *
 * Product axes:
 *   - Format:     A4/A5/A6/DIN Lang/21x21 salgsmappe med UV Spotlak
 *   - Print mode: 4+0, 4+4
 *   - Material:   Chromokarton 255g, Bilderdruckkarton 350g  (vertical axis)
 *
 * Usage:
 *   node scripts/fetch-salesmapper-uvspotlak-import.js import [--dry-run]
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { parseLocalizedNumber, resolveTierMultiplier, roundToStep } from "./product-import/ul-prices.js";
import { ensureDir, timestampForFile } from "./product-import/snapshot-io.js";

/* ────────── constants ────────── */

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_PRODUCT_NAME = "Salgsmapper med UV Spotlak";
const DEFAULT_PRODUCT_SLUG = "salgsmapper-med-uv-spotlak";
const EUR_TO_DKK = 7.5;

const TIERS = [
    { max_dkk_base: 2000, multiplier: 1.6 },
    { max_dkk_base: 5000, multiplier: 1.5 },
    { max_dkk_base: 10000, multiplier: 1.4 },
    { multiplier: 1.3 },
];

const TARGET_QUANTITIES = [50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000];

const SOURCE_PAGES = [
    // ── A4 ──
    {
        formatLabel: "A4 salgsmappe med UV Spotlak",
        printMode: "4+0",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-2-laschen-40-farbig-aussenseite-bedruckt-mit-partieller-uvlackveredelung.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    {
        formatLabel: "A4 salgsmappe med UV Spotlak",
        printMode: "4+4",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-2-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-partieller-uvlackveredelung.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    // ── A5 ──
    {
        formatLabel: "A5 salgsmappe med UV Spotlak",
        printMode: "4+0",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a5-2teilig-mit-2-laschen-40-farbig-aussenseite-bedruckt-mit-partieller-uvlackveredelung.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    {
        formatLabel: "A5 salgsmappe med UV Spotlak",
        printMode: "4+4",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a5-2teilig-mit-2-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-partieller-uvlackveredelung.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    // ── A6 ──
    {
        formatLabel: "A6 salgsmappe med UV Spotlak",
        printMode: "4+0",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a6-2teilig-mit-2-laschen-40-farbig-aussenseite-bedruckt-mit-partieller-uvlackveredelung.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    {
        formatLabel: "A6 salgsmappe med UV Spotlak",
        printMode: "4+4",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a6-2teilig-mit-2-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-partieller-uvlackveredelung.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    // ── DIN Lang ──
    {
        formatLabel: "DIN Lang salgsmappe med UV Spotlak",
        printMode: "4+0",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-lang-2teilig-mit-2-laschen-40-farbig-aussenseite-bedruckt-mit-partieller-uvlackveredelung.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    {
        formatLabel: "DIN Lang salgsmappe med UV Spotlak",
        printMode: "4+4",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-lang-2teilig-mit-2-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-partieller-uvlackveredelung.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    // ── 21 × 21 ──
    {
        formatLabel: "21x21 salgsmappe med UV Spotlak",
        printMode: "4+0",
        url: "https://www.wir-machen-druck.de/mappe-fuer-quadrat-21-x-21-cm-2teilig-mit-2-laschen-40-farbig-aussenseite-bedruckt-mit-partieller-uvlackveredelung.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    {
        formatLabel: "21x21 salgsmappe med UV Spotlak",
        printMode: "4+4",
        url: "https://www.wir-machen-druck.de/mappe-fuer-quadrat-21-x-21-cm-2teilig-mit-2-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-partieller-uvlackveredelung.html",
        targetQuantities: TARGET_QUANTITIES,
    },
];

const MATERIAL_MATCHERS = [
    { pattern: /Chromokarton\s+255g\s+für\s+5mm/i, label: "0,40 mm starker Chromokarton 255g für 5mm" },
    { pattern: /Bilderdruckkarton\s+350g\s+matt\s+für\s+5mm/i, label: "0,36 mm starker Bilderdruckkarton 350g matt für 5mm" },
];

/* ────────── helpers ────────── */

function usage() { return "Usage:\n  node scripts/fetch-salesmapper-uvspotlak-import.js import [--dry-run] [--tenant <uuid>] [--name <name>] [--slug <slug>]"; }

function parseArgs(argv) {
    const args = { command: argv[2] || "", dryRun: argv.includes("--dry-run"), tenantId: DEFAULT_TENANT_ID, productName: DEFAULT_PRODUCT_NAME, productSlug: DEFAULT_PRODUCT_SLUG };
    const ti = argv.indexOf("--tenant"); if (ti !== -1 && argv[ti + 1]) args.tenantId = argv[ti + 1];
    const ni = argv.indexOf("--name"); if (ni !== -1 && argv[ni + 1]) args.productName = argv[ni + 1];
    const si = argv.indexOf("--slug"); if (si !== -1 && argv[si + 1]) args.productSlug = argv[si + 1];
    return args;
}

function normalizeLabel(t) { return String(t || "").replace(/\s+/g, " ").trim(); }

function parseQuantityPriceText(t) {
    const m = String(t || "").match(/([\d.]+)\s*Stück\s*\(([-\d.,]+)\s*Euro/i);
    if (!m) return null;
    const qty = Number(String(m[1]).replace(/\./g, ""));
    const eur = parseLocalizedNumber(m[2]);
    return Number.isFinite(qty) && qty > 0 && Number.isFinite(eur) && eur > 0 ? { quantity: qty, eur } : null;
}

function transformedPrice(eur) {
    const dkkBase = eur * EUR_TO_DKK;
    const tierMultiplier = resolveTierMultiplier(dkkBase, TIERS);
    const dkkFinal = Math.round(roundToStep(dkkBase * tierMultiplier, 1));
    return { dkkBase: Number(dkkBase.toFixed(4)), tierMultiplier, dkkFinal };
}

function materialWanted(label) { const n = normalizeLabel(label); return MATERIAL_MATCHERS.find((m) => m.pattern.test(n)) || null; }

async function withRetry(fn, retries = 2) {
    let last; for (let i = 0; i <= retries; i++) { try { return await fn(); } catch (e) { last = e; if (i === retries || !/Execution context|Target page/i.test(e?.message || "")) throw e; } } throw last;
}

/* ────────── scraping ────────── */

async function extractRowsForPage(page, pm) {
    console.log(`  Navigating to: ${pm.url}`);
    await page.goto(pm.url, { waitUntil: "networkidle", timeout: 90_000 });

    const materials = await withRetry(() => page.$$eval("#sorten option", (ns) => ns.map((n) => ({ value: n.getAttribute("value") || "", label: (n.textContent || "").trim() }))));
    const targets = materials.map((m) => ({ ...m, label: normalizeLabel(m.label) })).filter((m) => m.value && materialWanted(m.label));

    if (!targets.length) { console.warn(`  ⚠ No matching materials on ${pm.url}`); return []; }
    console.log(`  Found ${targets.length} matching materials`);

    const rows = [];
    for (const mat of targets) {
        await withRetry(async () => { await page.selectOption("#sorten", mat.value); await page.waitForTimeout(1200); });
        const texts = await withRetry(() => page.$$eval("#wmd_shirt_auflage option", (ns) => ns.map((n) => (n.textContent || "").trim())));
        const matcher = materialWanted(mat.label);
        const label = matcher ? matcher.label : mat.label;
        texts.forEach((t) => { const p = parseQuantityPriceText(t); if (p && pm.targetQuantities.includes(p.quantity)) rows.push({ formatLabel: pm.formatLabel, printMode: pm.printMode, materialLabel: label, quantity: p.quantity, eur: p.eur, sourceOptionText: t, detailUrl: pm.url }); });
        console.log(`    ${label.substring(0, 50).padEnd(50)} → ${rows.filter((r) => r.materialLabel === label).length} prices`);
    }
    return rows;
}

/* ────────── CSV ────────── */

function serializeCsv(rows) {
    const h = ["format", "print_mode", "material", "quantity", "eur", "dkk_base", "tier_multiplier", "dkk_final", "detail_url"];
    const lines = [h.join(",")];
    rows.forEach((r) => { lines.push([r.formatLabel, r.printMode, r.materialLabel, r.quantity, r.eur, r.dkkBase, r.tierMultiplier, r.dkkFinal, r.detailUrl].map((f) => { const t = String(f ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }).join(",")); });
    return lines.join("\n") + "\n";
}

/* ────────── supabase ────────── */

function getSupabaseClient() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Missing Supabase env vars.");
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensureProduct(client, tenantId, name, slug) {
    const { data: ex, error: e1 } = await client.from("products").select("id, slug, name, is_published").eq("tenant_id", tenantId).eq("slug", slug).maybeSingle();
    if (e1) throw e1; if (ex) return { product: ex, created: false };
    const { data: cr, error: e2 } = await client.from("products").insert({ tenant_id: tenantId, name, slug, icon_text: name, description: "Salgsmappe med UV Spotlak – auto-imported", category: "tryksager", pricing_type: "matrix", is_published: false, preset_key: "custom", technical_specs: { width_mm: 210, height_mm: 297, bleed_mm: 3, min_dpi: 300, is_free_form: false, standard_format: "A4" } }).select("id, slug, name, is_published").single();
    if (e2) throw e2; return { product: cr, created: true };
}

async function loadGroups(client, tenantId, productId) {
    const { data, error } = await client.from("product_attribute_groups").select("id, name, kind, sort_order, values:product_attribute_values(id, name, width_mm, height_mm, meta)").eq("tenant_id", tenantId).eq("product_id", productId).order("sort_order", { ascending: true });
    if (error) throw error; return data || [];
}

async function ensureGroup(client, ctx, { name, kind, sortOrder }) {
    const n = normalizeLabel(name).toLowerCase();
    const f = ctx.groups.find((g) => g.kind === kind && normalizeLabel(g.name).toLowerCase() === n);
    if (f) return f;
    const { data, error } = await client.from("product_attribute_groups").insert({ tenant_id: ctx.tenantId, product_id: ctx.productId, name, kind, source: "product", ui_mode: "buttons", sort_order: sortOrder, enabled: true }).select("id, name, kind, sort_order, values:product_attribute_values(id, name, width_mm, height_mm, meta)").single();
    if (error) throw error; const norm = { ...data, values: data.values || [] }; ctx.groups.push(norm); return norm;
}

async function ensureValue(client, ctx, group, valueName) {
    const n = normalizeLabel(valueName);
    const ex = (group.values || []).find((v) => String(v.name || "").toLowerCase() === n.toLowerCase());
    if (ex) return ex;
    const { data, error } = await client.from("product_attribute_values").insert({ tenant_id: ctx.tenantId, product_id: ctx.productId, group_id: group.id, name: n, sort_order: (group.values || []).length, enabled: true }).select("id, name, width_mm, height_mm, meta").single();
    if (error) throw error; group.values = [...(group.values || []), data]; return data;
}

function buildPricingStructure({ materialGroup, materialValues, formatGroup, formatValues, printModeGroup, printModeValues, allQuantities }) {
    return {
        mode: "matrix_layout_v1", version: 1,
        vertical_axis: { sectionId: "vertical-axis", sectionType: "materials", groupId: materialGroup.id, valueIds: materialValues.map((v) => v.id), ui_mode: "buttons", valueSettings: {}, title: "Materiale", description: "" },
        layout_rows: [
            { id: "row-format", title: "", description: "", columns: [{ id: "format-section", sectionType: "formats", groupId: formatGroup.id, valueIds: formatValues.map((v) => v.id), ui_mode: "buttons", selection_mode: "required", valueSettings: {}, title: "Format", description: "" }] },
            { id: "row-print-mode", title: "", description: "", columns: [{ id: "print-mode-section", sectionType: "finishes", groupId: printModeGroup.id, valueIds: printModeValues.map((v) => v.id), ui_mode: "buttons", selection_mode: "required", valueSettings: {}, title: "Tryk", description: "" }] },
        ],
        quantities: allQuantities,
    };
}

async function importToSupabase({ tenantId, productName, productSlug, transformedRows, dryRun }) {
    if (!transformedRows.length) throw new Error("No rows");
    if (dryRun) return { dryRun: true, productSlug, rowsPrepared: transformedRows.length, uniqueFormats: new Set(transformedRows.map((r) => r.formatLabel)).size, uniquePrintModes: new Set(transformedRows.map((r) => r.printMode)).size, uniqueMaterials: new Set(transformedRows.map((r) => r.materialLabel)).size };

    const client = getSupabaseClient();
    const ensured = await ensureProduct(client, tenantId, productName, productSlug);
    const ctx = { tenantId, productId: ensured.product.id, groups: await loadGroups(client, tenantId, ensured.product.id) };

    const fmtGrp = await ensureGroup(client, ctx, { name: "Format", kind: "format", sortOrder: 0 });
    const pmGrp = await ensureGroup(client, ctx, { name: "Tryk", kind: "finish", sortOrder: 1 });
    const matGrp = await ensureGroup(client, ctx, { name: "Materiale", kind: "material", sortOrder: 2 });

    const fmtMap = new Map(), pmMap = new Map(), matMap = new Map();
    const FMT_ORDER = ["A4 salgsmappe med UV Spotlak", "A5 salgsmappe med UV Spotlak", "A6 salgsmappe med UV Spotlak", "DIN Lang salgsmappe med UV Spotlak", "21x21 salgsmappe med UV Spotlak"];
    for (const n of FMT_ORDER) fmtMap.set(n, await ensureValue(client, ctx, fmtGrp, n));
    for (const n of ["4+0", "4+4"]) pmMap.set(n, await ensureValue(client, ctx, pmGrp, n));
    for (const n of MATERIAL_MATCHERS.map((m) => m.label)) matMap.set(n, await ensureValue(client, ctx, matGrp, n));

    const fmtVals = FMT_ORDER.map((n) => fmtMap.get(n)).filter(Boolean);
    const pmVals = ["4+0", "4+4"].map((n) => pmMap.get(n)).filter(Boolean);
    const matVals = MATERIAL_MATCHERS.map((m) => m.label).map((n) => matMap.get(n)).filter(Boolean);
    const allQty = Array.from(new Set(transformedRows.map((r) => r.quantity))).sort((a, b) => a - b);

    const ps = buildPricingStructure({ materialGroup: matGrp, materialValues: matVals, formatGroup: fmtGrp, formatValues: fmtVals, printModeGroup: pmGrp, printModeValues: pmVals, allQuantities: allQty });

    const dedup = new Map();
    transformedRows.forEach((r) => {
        const fv = fmtMap.get(r.formatLabel), pv = pmMap.get(r.printMode), mv = matMap.get(r.materialLabel);
        if (!fv || !pv || !mv) return;
        const vn = [fv.id, pv.id].sort().join("|");
        const payload = { tenant_id: tenantId, product_id: ensured.product.id, variant_name: vn, variant_value: mv.id, quantity: r.quantity, price_dkk: r.dkkFinal, extra_data: { verticalAxisGroupId: matGrp.id, verticalAxisValueId: mv.id, formatId: fv.id, materialId: mv.id, printModeId: pv.id, variantValueIds: [pv.id], selectionMap: { format: fv.id, material: mv.id, variantValueIds: [pv.id] }, source: "salesmapper_uvspotlak_fetch_import", sourceUrl: r.detailUrl, eur: r.eur, dkkBase: r.dkkBase, tierMultiplier: r.tierMultiplier } };
        dedup.set(`${payload.product_id}|${vn}|${mv.id}|${r.quantity}`, payload);
    });

    const priceRows = Array.from(dedup.values());
    const { error: upErr } = await client.from("products").update({ name: productName, slug: productSlug, pricing_type: "matrix", pricing_structure: ps }).eq("id", ensured.product.id);
    if (upErr) throw upErr;
    const { error: delErr } = await client.from("generic_product_prices").delete().eq("product_id", ensured.product.id);
    if (delErr) throw delErr;
    let inserted = 0;
    for (let i = 0; i < priceRows.length; i += 500) { const b = priceRows.slice(i, i + 500); const { error } = await client.from("generic_product_prices").insert(b); if (error) throw error; inserted += b.length; }

    return { dryRun: false, productId: ensured.product.id, productSlug, productCreated: ensured.created, rowsInserted: inserted, uniqueFormats: fmtVals.length, uniquePrintModes: pmVals.length, uniqueMaterials: matVals.length };
}

/* ────────── main ────────── */

async function runImport(args) {
    const root = process.cwd();
    ensureDir(path.join(root, "pricing_raw")); ensureDir(path.join(root, "pricing_clean"));
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.goto("https://www.wir-machen-druck.de", { waitUntil: "domcontentloaded", timeout: 90_000 });
        try { await page.locator("button:has-text('Alle akzeptieren'), #onetrust-accept-btn-handler").click({ timeout: 5_000 }); console.log("Accepted cookies"); } catch { /* no banner */ }

        const allRows = [];
        for (const pm of SOURCE_PAGES) { console.log(`\n── ${pm.formatLabel} (${pm.printMode}) ──`); const rows = await extractRowsForPage(page, pm); allRows.push(...rows); console.log(`  Total rows from page: ${rows.length}`); }
        if (!allRows.length) throw new Error("No rows extracted");

        const dedup = new Map();
        allRows.forEach((r) => { const p = transformedPrice(r.eur); dedup.set([r.formatLabel, r.printMode, r.materialLabel, r.quantity].join("||"), { ...r, ...p }); });
        const transformed = Array.from(dedup.values()).sort((a, b) => a.formatLabel.localeCompare(b.formatLabel) || a.printMode.localeCompare(b.printMode) || a.materialLabel.localeCompare(b.materialLabel) || a.quantity - b.quantity);

        const ts = timestampForFile();
        const rawPath = path.join(root, "pricing_raw", args.productSlug, `${ts}.json`);
        const cleanPath = path.join(root, "pricing_clean", args.productSlug, `${ts}.csv`);
        ensureDir(path.dirname(rawPath)); ensureDir(path.dirname(cleanPath));
        fs.writeFileSync(rawPath, JSON.stringify({ timestamp: ts, product: { name: args.productName, slug: args.productSlug, tenant_id: args.tenantId }, source_pages: SOURCE_PAGES.map((p) => ({ format: p.formatLabel, printMode: p.printMode, url: p.url })), material_matchers: MATERIAL_MATCHERS.map((m) => ({ pattern: m.pattern.source, label: m.label })), extracted_rows: allRows }, null, 2), "utf8");
        fs.writeFileSync(cleanPath, serializeCsv(transformed), "utf8");

        console.log(`\nRaw snapshot: ${rawPath}\nClean CSV: ${cleanPath}\nExtracted rows: ${allRows.length}\nPrepared rows: ${transformed.length}`);

        const result = await importToSupabase({ tenantId: args.tenantId, productName: args.productName, productSlug: args.productSlug, transformedRows: transformed, dryRun: args.dryRun });
        if (result.dryRun) { console.log(`\nDry-run complete\n  Slug: ${result.productSlug}\n  Rows: ${result.rowsPrepared}\n  Formats: ${result.uniqueFormats}, Print modes: ${result.uniquePrintModes}, Materials: ${result.uniqueMaterials}`); return; }
        console.log(`\n✅ Import complete\n  Product ID: ${result.productId}\n  Slug: ${result.productSlug}\n  Created: ${result.productCreated ? "yes" : "no"}\n  Rows inserted: ${result.rowsInserted}\n  Formats: ${result.uniqueFormats}, Print modes: ${result.uniquePrintModes}, Materials: ${result.uniqueMaterials}`);
    } finally { await browser.close(); }
}

async function main() {
    const args = parseArgs(process.argv);
    if (!args.command || ["-h", "--help", "help"].includes(args.command)) { console.log(usage()); return; }
    if (args.command !== "import") throw new Error(`Unknown command: ${args.command}`);
    await runImport(args);
}

main().catch((e) => { console.error(`Error: ${e.message}`); process.exitCode = 1; });
