#!/usr/bin/env node
/**
 * fetch-salesmapper-3laschen-uvlak-import.js
 *
 * Scrapes prices for the "Salgsmapper med UV-Lak 3-laschen" product from
 * wir-machen-druck.de and imports them into the Supabase database.
 *
 * Product axes:
 *   - Format:     A4 salgsmappe med UV lak 3-laschen, A5 …, A6 …, DIN Lang …, 21x21 …
 *   - Print mode: 4+0, 4+4
 *   - Material:   Chromokarton 255g, Bilderdruckkarton 350g  (vertical axis, 2 materials only)
 *
 * Usage:
 *   node scripts/fetch-salesmapper-3laschen-uvlak-import.js import [--dry-run] [--tenant <uuid>] [--name <name>] [--slug <slug>]
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
const DEFAULT_PRODUCT_NAME = "Salgsmapper med UV-Lak 3-laschen";
const DEFAULT_PRODUCT_SLUG = "salgsmapper-med-uv-lak-3-laschen";
const EUR_TO_DKK = 7.5;

const TIERS = [
    { max_dkk_base: 2000, multiplier: 1.6 },
    { max_dkk_base: 5000, multiplier: 1.5 },
    { max_dkk_base: 10000, multiplier: 1.4 },
    { multiplier: 1.3 },
];

const TARGET_QUANTITIES = [50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000];

/**
 * Each entry defines a page to scrape.
 * All URLs use the Hochglanz-UV-Lack variant.
 */
const SOURCE_PAGES = [
    // ── A4 ──
    {
        formatLabel: "A4 salgsmappe med UV lak 3-laschen",
        printMode: "4+0",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-3-laschen-40-farbig-aussenseite-bedruckt-mit-hochglanzuvlack.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    {
        formatLabel: "A4 salgsmappe med UV lak 3-laschen",
        printMode: "4+4",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-3-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-hochglanzuvlack.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    // ── A5 ──
    {
        formatLabel: "A5 salgsmappe med UV lak 3-laschen",
        printMode: "4+0",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a5-2teilig-mit-3-laschen-40-farbig-aussenseite-bedruckt-mit-hochglanzuvlack.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    {
        formatLabel: "A5 salgsmappe med UV lak 3-laschen",
        printMode: "4+4",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a5-2teilig-mit-3-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-hochglanzuvlack.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    // ── A6 ──
    {
        formatLabel: "A6 salgsmappe med UV lak 3-laschen",
        printMode: "4+0",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a6-2teilig-mit-3-laschen-40-farbig-aussenseite-bedruckt-mit-hochglanzuvlack.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    {
        formatLabel: "A6 salgsmappe med UV lak 3-laschen",
        printMode: "4+4",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a6-2teilig-mit-3-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-hochglanzuvlack.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    // ── DIN Lang ──
    {
        formatLabel: "DIN Lang salgsmappe med UV lak 3-laschen",
        printMode: "4+0",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-lang-2teilig-mit-3-laschen-40-farbig-aussenseite-bedruckt-mit-hochglanzuvlack.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    {
        formatLabel: "DIN Lang salgsmappe med UV lak 3-laschen",
        printMode: "4+4",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-lang-2teilig-mit-3-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-hochglanzuvlack.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    // ── 21 × 21 ──
    {
        formatLabel: "21x21 salgsmappe med UV lak 3-laschen",
        printMode: "4+0",
        url: "https://www.wir-machen-druck.de/mappe-fuer-quadrat-21-x-21-cm-2teilig-mit-3-laschen-40-farbig-aussenseite-bedruckt-mit-hochglanzuvlack.html",
        targetQuantities: TARGET_QUANTITIES,
    },
    {
        formatLabel: "21x21 salgsmappe med UV lak 3-laschen",
        printMode: "4+4",
        url: "https://www.wir-machen-druck.de/mappe-fuer-quadrat-21-x-21-cm-2teilig-mit-3-laschen-44-farbig-aussen-und-innenseite-bedruckt-mit-hochglanzuvlack.html",
        targetQuantities: TARGET_QUANTITIES,
    },
];

/**
 * UV-Lak product has only 2 materials (Chromokarton + Bilderdruckkarton),
 * both at 5mm fill-height.
 */
const MATERIAL_MATCHERS = [
    {
        pattern: /Chromokarton\s+255g\s+für\s+5mm/i,
        label: "0,40 mm starker Chromokarton 255g für 5mm",
    },
    {
        pattern: /Bilderdruckkarton\s+350g\s+matt\s+für\s+5mm/i,
        label: "0,36 mm starker Bilderdruckkarton 350g matt für 5mm",
    },
];

/* ────────── helpers ────────── */

function usage() {
    return [
        "Usage:",
        "  node scripts/fetch-salesmapper-3laschen-uvlak-import.js import [--dry-run] [--tenant <uuid>] [--name <name>] [--slug <slug>]",
    ].join("\n");
}

function parseArgs(argv) {
    const args = {
        command: argv[2] || "",
        dryRun: argv.includes("--dry-run"),
        tenantId: DEFAULT_TENANT_ID,
        productName: DEFAULT_PRODUCT_NAME,
        productSlug: DEFAULT_PRODUCT_SLUG,
    };

    const tenantIdx = argv.indexOf("--tenant");
    if (tenantIdx !== -1 && argv[tenantIdx + 1]) args.tenantId = argv[tenantIdx + 1];

    const nameIdx = argv.indexOf("--name");
    if (nameIdx !== -1 && argv[nameIdx + 1]) args.productName = argv[nameIdx + 1];

    const slugIdx = argv.indexOf("--slug");
    if (slugIdx !== -1 && argv[slugIdx + 1]) args.productSlug = argv[slugIdx + 1];

    return args;
}

function normalizeLabel(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
}

function parseQuantityPriceText(text) {
    const match = String(text || "").match(/([\d.]+)\s*Stück\s*\(([-\d.,]+)\s*Euro/i);
    if (!match) return null;
    const quantity = Number(String(match[1]).replace(/\./g, ""));
    const eur = parseLocalizedNumber(match[2]);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(eur) || eur <= 0) return null;
    return { quantity, eur };
}

function transformedPrice(eur) {
    const dkkBase = eur * EUR_TO_DKK;
    const tierMultiplier = resolveTierMultiplier(dkkBase, TIERS);
    const dkkFinal = Math.round(roundToStep(dkkBase * tierMultiplier, 1));
    return { dkkBase: Number(dkkBase.toFixed(4)), tierMultiplier, dkkFinal };
}

function materialWanted(optionLabel) {
    const normalized = normalizeLabel(optionLabel);
    return MATERIAL_MATCHERS.find((m) => m.pattern.test(normalized)) || null;
}

async function withRetry(fn, retries = 2) {
    let lastError;
    for (let i = 0; i <= retries; i++) {
        try { return await fn(); } catch (err) {
            lastError = err;
            if (i === retries || !/Execution context was destroyed|Target page/i.test(err?.message || "")) throw err;
        }
    }
    throw lastError;
}

/* ────────── scraping ────────── */

async function extractRowsForPage(page, pageMeta) {
    console.log(`  Navigating to: ${pageMeta.url}`);
    await page.goto(pageMeta.url, { waitUntil: "networkidle", timeout: 90_000 });

    const materials = await withRetry(() =>
        page.$$eval("#sorten option", (nodes) =>
            nodes.map((n) => ({ value: n.getAttribute("value") || "", label: (n.textContent || "").trim() }))
        )
    );

    const targetMaterials = materials
        .map((m) => ({ ...m, label: normalizeLabel(m.label) }))
        .filter((m) => m.value && materialWanted(m.label));

    if (!targetMaterials.length) {
        console.warn(`  ⚠ No matching materials on ${pageMeta.url}`);
        console.warn(`    Available: ${materials.map((m) => m.label.substring(0, 60)).join(" | ")}`);
        return [];
    }

    console.log(`  Found ${targetMaterials.length} matching materials`);
    const rows = [];

    for (const material of targetMaterials) {
        await withRetry(async () => {
            await page.selectOption("#sorten", material.value);
            await page.waitForTimeout(1200);
        });

        const qtyTexts = await withRetry(() =>
            page.$$eval("#wmd_shirt_auflage option", (nodes) => nodes.map((n) => (n.textContent || "").trim()))
        );

        const matcher = materialWanted(material.label);
        const materialLabel = matcher ? matcher.label : material.label;

        qtyTexts.forEach((text) => {
            const parsed = parseQuantityPriceText(text);
            if (!parsed || !pageMeta.targetQuantities.includes(parsed.quantity)) return;
            rows.push({
                formatLabel: pageMeta.formatLabel,
                printMode: pageMeta.printMode,
                materialLabel,
                quantity: parsed.quantity,
                eur: parsed.eur,
                sourceOptionText: text,
                detailUrl: pageMeta.url,
            });
        });

        console.log(
            `    ${materialLabel.substring(0, 50).padEnd(50)} → ${rows.filter((r) => r.materialLabel === materialLabel).length} prices`
        );
    }

    return rows;
}

/* ────────── CSV ────────── */

function serializeCsv(rows) {
    const header = ["format", "print_mode", "material", "quantity", "eur", "dkk_base", "tier_multiplier", "dkk_final", "detail_url"];
    const lines = [header.join(",")];
    rows.forEach((row) => {
        const fields = [row.formatLabel, row.printMode, row.materialLabel, row.quantity, row.eur, row.dkkBase, row.tierMultiplier, row.dkkFinal, row.detailUrl]
            .map((f) => { const t = String(f ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; });
        lines.push(fields.join(","));
    });
    return `${lines.join("\n")}\n`;
}

/* ────────── supabase ────────── */

function getSupabaseClient() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Missing Supabase env vars.");
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function ensureProduct(client, tenantId, name, slug) {
    const { data: existing, error: e1 } = await client.from("products").select("id, slug, name, is_published").eq("tenant_id", tenantId).eq("slug", slug).maybeSingle();
    if (e1) throw e1;
    if (existing) return { product: existing, created: false };
    const { data: created, error: e2 } = await client.from("products").insert({
        tenant_id: tenantId, name, slug, icon_text: name,
        description: "Salgsmappe med UV-Lak – auto-imported from wir-machen-druck.de",
        category: "tryksager", pricing_type: "matrix", is_published: false, preset_key: "custom",
        technical_specs: { width_mm: 210, height_mm: 297, bleed_mm: 3, min_dpi: 300, is_free_form: false, standard_format: "A4" },
    }).select("id, slug, name, is_published").single();
    if (e2) throw e2;
    return { product: created, created: true };
}

async function loadGroups(client, tenantId, productId) {
    const { data, error } = await client.from("product_attribute_groups").select("id, name, kind, sort_order, values:product_attribute_values(id, name, width_mm, height_mm, meta)").eq("tenant_id", tenantId).eq("product_id", productId).order("sort_order", { ascending: true });
    if (error) throw error;
    return data || [];
}

async function ensureGroup(client, ctx, { name, kind, sortOrder }) {
    const n = normalizeLabel(name).toLowerCase();
    const found = ctx.groups.find((g) => g.kind === kind && normalizeLabel(g.name).toLowerCase() === n);
    if (found) return found;
    const { data, error } = await client.from("product_attribute_groups").insert({
        tenant_id: ctx.tenantId, product_id: ctx.productId, name, kind, source: "product", ui_mode: "buttons", sort_order: sortOrder, enabled: true,
    }).select("id, name, kind, sort_order, values:product_attribute_values(id, name, width_mm, height_mm, meta)").single();
    if (error) throw error;
    const norm = { ...data, values: data.values || [] };
    ctx.groups.push(norm);
    return norm;
}

async function ensureValue(client, ctx, group, valueName) {
    const normalized = normalizeLabel(valueName);
    const existing = (group.values || []).find((v) => String(v.name || "").toLowerCase() === normalized.toLowerCase());
    if (existing) return existing;
    const { data, error } = await client.from("product_attribute_values").insert({
        tenant_id: ctx.tenantId, product_id: ctx.productId, group_id: group.id, name: normalized, sort_order: (group.values || []).length, enabled: true,
    }).select("id, name, width_mm, height_mm, meta").single();
    if (error) throw error;
    group.values = [...(group.values || []), data];
    return data;
}

/* ────────── pricing structure ────────── */

function buildPricingStructure({ materialGroup, materialValues, formatGroup, formatValues, printModeGroup, printModeValues, allQuantities }) {
    return {
        mode: "matrix_layout_v1", version: 1,
        vertical_axis: {
            sectionId: "vertical-axis", sectionType: "materials", groupId: materialGroup.id,
            valueIds: materialValues.map((v) => v.id), ui_mode: "buttons", valueSettings: {}, title: "Materiale", description: "",
        },
        layout_rows: [
            {
                id: "row-format", title: "", description: "",
                columns: [{ id: "format-section", sectionType: "formats", groupId: formatGroup.id, valueIds: formatValues.map((v) => v.id), ui_mode: "buttons", selection_mode: "required", valueSettings: {}, title: "Format", description: "" }],
            },
            {
                id: "row-print-mode", title: "", description: "",
                columns: [{ id: "print-mode-section", sectionType: "finishes", groupId: printModeGroup.id, valueIds: printModeValues.map((v) => v.id), ui_mode: "buttons", selection_mode: "required", valueSettings: {}, title: "Tryk", description: "" }],
            },
        ],
        quantities: allQuantities,
    };
}

/* ────────── import ────────── */

async function importToSupabase({ tenantId, productName, productSlug, transformedRows, dryRun }) {
    if (!transformedRows.length) throw new Error("No rows to import");

    if (dryRun) {
        return {
            dryRun: true, productSlug, rowsPrepared: transformedRows.length,
            uniqueFormats: new Set(transformedRows.map((r) => r.formatLabel)).size,
            uniquePrintModes: new Set(transformedRows.map((r) => r.printMode)).size,
            uniqueMaterials: new Set(transformedRows.map((r) => r.materialLabel)).size
        };
    }

    const client = getSupabaseClient();
    const ensured = await ensureProduct(client, tenantId, productName, productSlug);
    const ctx = { tenantId, productId: ensured.product.id, groups: await loadGroups(client, tenantId, ensured.product.id) };

    const formatGroup = await ensureGroup(client, ctx, { name: "Format", kind: "format", sortOrder: 0 });
    const printModeGroup = await ensureGroup(client, ctx, { name: "Tryk", kind: "finish", sortOrder: 1 });
    const materialGroup = await ensureGroup(client, ctx, { name: "Materiale", kind: "material", sortOrder: 2 });

    const formatMap = new Map();
    const printModeMap = new Map();
    const materialMap = new Map();

    const FORMAT_ORDER = ["A4 salgsmappe med UV lak 3-laschen", "A5 salgsmappe med UV lak 3-laschen", "A6 salgsmappe med UV lak 3-laschen", "DIN Lang salgsmappe med UV lak 3-laschen", "21x21 salgsmappe med UV lak 3-laschen"];
    for (const n of FORMAT_ORDER) { formatMap.set(n, await ensureValue(client, ctx, formatGroup, n)); }

    for (const n of ["4+0", "4+4"]) { printModeMap.set(n, await ensureValue(client, ctx, printModeGroup, n)); }

    const MATERIAL_ORDER = MATERIAL_MATCHERS.map((m) => m.label);
    for (const n of MATERIAL_ORDER) { materialMap.set(n, await ensureValue(client, ctx, materialGroup, n)); }

    const formatValues = FORMAT_ORDER.map((n) => formatMap.get(n)).filter(Boolean);
    const printModeValues = ["4+0", "4+4"].map((n) => printModeMap.get(n)).filter(Boolean);
    const materialValues = MATERIAL_ORDER.map((n) => materialMap.get(n)).filter(Boolean);

    const allQuantities = Array.from(new Set(transformedRows.map((r) => r.quantity))).sort((a, b) => a - b);

    const pricingStructure = buildPricingStructure({ materialGroup, materialValues, formatGroup, formatValues, printModeGroup, printModeValues, allQuantities });

    const dedupeRows = new Map();
    transformedRows.forEach((row) => {
        const fv = formatMap.get(row.formatLabel), pm = printModeMap.get(row.printMode), mv = materialMap.get(row.materialLabel);
        if (!fv || !pm || !mv) return;
        const variantValueIds = [fv.id, pm.id].sort();
        const variantName = variantValueIds.join("|");
        const payload = {
            tenant_id: tenantId, product_id: ensured.product.id, variant_name: variantName, variant_value: mv.id,
            quantity: row.quantity, price_dkk: row.dkkFinal,
            extra_data: {
                verticalAxisGroupId: materialGroup.id, verticalAxisValueId: mv.id,
                formatId: fv.id, materialId: mv.id, printModeId: pm.id,
                variantValueIds: [pm.id],
                selectionMap: { format: fv.id, material: mv.id, variantValueIds: [pm.id] },
                source: "salesmapper_uvlak_fetch_import", sourceUrl: row.detailUrl,
                eur: row.eur, dkkBase: row.dkkBase, tierMultiplier: row.tierMultiplier,
            },
        };
        dedupeRows.set(`${payload.product_id}|${variantName}|${mv.id}|${row.quantity}`, payload);
    });

    const priceRows = Array.from(dedupeRows.values());

    const { error: upErr } = await client.from("products").update({ name: productName, slug: productSlug, pricing_type: "matrix", pricing_structure: pricingStructure }).eq("id", ensured.product.id);
    if (upErr) throw upErr;

    const { error: delErr } = await client.from("generic_product_prices").delete().eq("product_id", ensured.product.id);
    if (delErr) throw delErr;

    let inserted = 0;
    for (let i = 0; i < priceRows.length; i += 500) {
        const batch = priceRows.slice(i, i + 500);
        const { error: insErr } = await client.from("generic_product_prices").insert(batch);
        if (insErr) throw insErr;
        inserted += batch.length;
    }

    return {
        dryRun: false, productId: ensured.product.id, productSlug, productCreated: ensured.created, rowsInserted: inserted,
        uniqueFormats: formatValues.length, uniquePrintModes: printModeValues.length, uniqueMaterials: materialValues.length
    };
}

/* ────────── main ────────── */

async function runImport(args) {
    const root = process.cwd();
    ensureDir(path.join(root, "pricing_raw"));
    ensureDir(path.join(root, "pricing_clean"));

    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.goto("https://www.wir-machen-druck.de", { waitUntil: "domcontentloaded", timeout: 90_000 });
        try {
            await page.locator("button:has-text('Alle akzeptieren'), #onetrust-accept-btn-handler").click({ timeout: 5_000 });
            console.log("Accepted cookies");
        } catch { /* no cookie banner */ }

        const allRows = [];
        for (const pm of SOURCE_PAGES) {
            console.log(`\n── ${pm.formatLabel} (${pm.printMode}) ──`);
            const rows = await extractRowsForPage(page, pm);
            allRows.push(...rows);
            console.log(`  Total rows from page: ${rows.length}`);
        }

        if (!allRows.length) throw new Error("No rows extracted");

        const dedupe = new Map();
        allRows.forEach((r) => {
            const p = transformedPrice(r.eur);
            dedupe.set([r.formatLabel, r.printMode, r.materialLabel, r.quantity].join("||"), { ...r, ...p });
        });

        const transformed = Array.from(dedupe.values()).sort((a, b) =>
            a.formatLabel.localeCompare(b.formatLabel) || a.printMode.localeCompare(b.printMode) || a.materialLabel.localeCompare(b.materialLabel) || a.quantity - b.quantity
        );

        const ts = timestampForFile();
        const rawPath = path.join(root, "pricing_raw", args.productSlug, `${ts}.json`);
        const cleanPath = path.join(root, "pricing_clean", args.productSlug, `${ts}.csv`);
        ensureDir(path.dirname(rawPath));
        ensureDir(path.dirname(cleanPath));

        fs.writeFileSync(rawPath, JSON.stringify({
            timestamp: ts, product: { name: args.productName, slug: args.productSlug, tenant_id: args.tenantId },
            source_pages: SOURCE_PAGES.map((p) => ({ format: p.formatLabel, printMode: p.printMode, url: p.url })),
            material_matchers: MATERIAL_MATCHERS.map((m) => ({ pattern: m.pattern.source, label: m.label })),
            extracted_rows: allRows,
        }, null, 2), "utf8");
        fs.writeFileSync(cleanPath, serializeCsv(transformed), "utf8");

        console.log(`\nRaw snapshot: ${rawPath}`);
        console.log(`Clean CSV: ${cleanPath}`);
        console.log(`Extracted rows: ${allRows.length}`);
        console.log(`Prepared rows: ${transformed.length}`);

        const result = await importToSupabase({ tenantId: args.tenantId, productName: args.productName, productSlug: args.productSlug, transformedRows: transformed, dryRun: args.dryRun });

        if (result.dryRun) {
            console.log("\nDry-run complete (no DB writes)");
            console.log(`  Product slug: ${result.productSlug}`);
            console.log(`  Rows prepared: ${result.rowsPrepared}`);
            console.log(`  Formats: ${result.uniqueFormats}, Print modes: ${result.uniquePrintModes}, Materials: ${result.uniqueMaterials}`);
            return;
        }

        console.log("\n✅ Import complete");
        console.log(`  Product ID: ${result.productId}`);
        console.log(`  Product slug: ${result.productSlug}`);
        console.log(`  Product created: ${result.productCreated ? "yes" : "no (existing)"}`);
        console.log(`  Rows inserted: ${result.rowsInserted}`);
        console.log(`  Formats: ${result.uniqueFormats}, Print modes: ${result.uniquePrintModes}, Materials: ${result.uniqueMaterials}`);
    } finally { await browser.close(); }
}

async function main() {
    const args = parseArgs(process.argv);
    if (!args.command || ["-h", "--help", "help"].includes(args.command)) { console.log(usage()); return; }
    if (args.command !== "import") throw new Error(`Unknown command: ${args.command}\n\n${usage()}`);
    await runImport(args);
}

main().catch((err) => { console.error(`Error: ${err.message}`); process.exitCode = 1; });
