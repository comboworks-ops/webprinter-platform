#!/usr/bin/env node
/**
 * fetch-salesmapper-3laschen-import.js
 *
 * Scrapes prices for the "Standard Sales Mapper 3-laschen" product from
 * wir-machen-druck.de and imports them into the Supabase database.
 *
 * Product axes:
 *   - Format:     A4 salgsmappe 3-laschen, A5 salgsmappe 3-laschen, A6 salgsmappe 3-laschen, DIN Lang salgsmappe 3-laschen, 21x21 salgsmappe 3-laschen
 *   - Print mode: 4+0, 4+4
 *   - Material:   Chromokarton 255g, Bilderdruckkarton 350g, Naturkarton 300g, Recyclingkarton 300g  (vertical axis)
 *
 * Usage:
 *   node scripts/fetch-salesmapper-3laschen-import.js import [--dry-run] [--tenant <uuid>] [--name <name>] [--slug <slug>]
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { parseLocalizedNumber, resolveTierMultiplier, roundToStep } from "./product-import/ul-prices.js";
import { ensureDir, timestampForFile } from "./product-import/snapshot-io.js";
import {
    salesmapperTransformedPrice,
    buildSalesmapperNormalizedRows,
    buildSalesmapperMaterialAxis,
    buildSalesmapperFormatSection,
    buildSalesmapperOptionSection,
    publishSalesmapperMatrix,
} from "./product-import/shared/salesmapper-matrix.js";

/* ────────── constants ────────── */

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_PRODUCT_NAME = "Standard Sales Mapper 3-laschen";
const DEFAULT_PRODUCT_SLUG = "standard-sales-mapper-3-laschen";
const EUR_TO_DKK = 7.5;

const TIERS = [
    { max_dkk_base: 2000, multiplier: 1.6 },
    { max_dkk_base: 5000, multiplier: 1.5 },
    { max_dkk_base: 10000, multiplier: 1.4 },
    { multiplier: 1.3 },
];

/**
 * Each entry defines a page to scrape.
 * `formatLabel` is the UI button text.
 * `printMode` is "4+0" or "4+4".
 * `targetQuantities` is the set of quantities to keep for that combo.
 */
const SOURCE_PAGES = [
    // ── A4 ──
    {
        formatLabel: "A4 salgsmappe 3-laschen",
        printMode: "4+0",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-3-laschen-40-farbig-aussenseite-bedruckt.html",
        targetQuantities: [50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000],
    },
    {
        formatLabel: "A4 salgsmappe 3-laschen",
        printMode: "4+4",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-3-laschen-44-farbig-aussen-und-innenseite-bedruckt.html",
        targetQuantities: [50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000],
    },
    // ── A5 ──
    {
        formatLabel: "A5 salgsmappe 3-laschen",
        printMode: "4+0",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a5-2teilig-mit-3-laschen-40-farbig-aussenseite-bedruckt.html",
        targetQuantities: [50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000],
    },
    {
        formatLabel: "A5 salgsmappe 3-laschen",
        printMode: "4+4",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a5-2teilig-mit-3-laschen-44-farbig-aussen-und-innenseite-bedruckt.html",
        targetQuantities: [50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000],
    },
    // ── A6 ──
    {
        formatLabel: "A6 salgsmappe 3-laschen",
        printMode: "4+0",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a6-2teilig-mit-3-laschen-40-farbig-aussenseite-bedruckt.html",
        targetQuantities: [50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000],
    },
    {
        formatLabel: "A6 salgsmappe 3-laschen",
        printMode: "4+4",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-a6-2teilig-mit-3-laschen-44-farbig-aussen-und-innenseite-bedruckt.html",
        targetQuantities: [50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000],
    },
    // ── DIN Lang ──
    {
        formatLabel: "DIN Lang salgsmappe 3-laschen",
        printMode: "4+0",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-lang-2teilig-mit-3-laschen-40-farbig-aussenseite-bedruckt.html",
        targetQuantities: [50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000],
    },
    {
        formatLabel: "DIN Lang salgsmappe 3-laschen",
        printMode: "4+4",
        url: "https://www.wir-machen-druck.de/mappe-fuer-din-lang-2teilig-mit-3-laschen-44-farbig-aussen-und-innenseite-bedruckt.html",
        targetQuantities: [50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000],
    },
    // ── 21 × 21 ──
    {
        formatLabel: "21x21 salgsmappe 3-laschen",
        printMode: "4+0",
        url: "https://www.wir-machen-druck.de/mappe-fuer-quadrat-21-x-21-cm-2teilig-mit-3-laschen-40-farbig-aussenseite-bedruckt.html",
        targetQuantities: [50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000],
    },
    {
        formatLabel: "21x21 salgsmappe 3-laschen",
        printMode: "4+4",
        url: "https://www.wir-machen-druck.de/mappe-fuer-quadrat-21-x-21-cm-2teilig-mit-3-laschen-44-farbig-aussen-und-innenseite-bedruckt.html",
        targetQuantities: [50, 75, 100, 150, 200, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000],
    },
];

/**
 * Material patterns: we want the **5mm** fill-height variants for
 * Chromokarton, Bilderdruckkarton, Naturkarton, and the generic Recyclingkarton.
 *
 * Each entry maps a regex to a short Danish material label.
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
    {
        pattern: /Naturkarton\s+300g\s+hochweiß\s+für\s+5mm/i,
        label: "0,36 mm starker Naturkarton 300g hochweiß für 5mm",
    },
    {
        pattern: /Recyclingkarton\s+300g\s+weiß\s+für\s+5mm/i,
        label: "0,36 mm starker Recyclingkarton 300g weiß",
    },
];

/* ────────── helpers ────────── */

function usage() {
    return [
        "Usage:",
        "  node scripts/fetch-salesmapper-3laschen-import.js import [--dry-run] [--tenant <uuid>] [--name <name>] [--slug <slug>]",
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
    if (tenantIdx !== -1 && argv[tenantIdx + 1]) {
        args.tenantId = argv[tenantIdx + 1];
    }

    const nameIdx = argv.indexOf("--name");
    if (nameIdx !== -1 && argv[nameIdx + 1]) {
        args.productName = argv[nameIdx + 1];
    }

    const slugIdx = argv.indexOf("--slug");
    if (slugIdx !== -1 && argv[slugIdx + 1]) {
        args.productSlug = argv[slugIdx + 1];
    }

    return args;
}

function normalizeLabel(text) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .trim();
}

function parseQuantityPriceText(text) {
    const match = String(text || "").match(/([\d.]+)\s*Stück\s*\(([-\d.,]+)\s*Euro/i);
    if (!match) return null;

    const quantity = Number(String(match[1]).replace(/\./g, ""));
    const eur = parseLocalizedNumber(match[2]);

    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(eur) || eur <= 0) {
        return null;
    }

    return { quantity, eur };
}

function transformedPrice(eur) {
    return salesmapperTransformedPrice(eur);
}

function materialWanted(optionLabel) {
    const normalized = normalizeLabel(optionLabel);
    return MATERIAL_MATCHERS.find((matcher) => matcher.pattern.test(normalized)) || null;
}

async function withRetry(fn, retries = 2) {
    let lastError;
    for (let i = 0; i <= retries; i += 1) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const message = error instanceof Error ? error.message : String(error);
            const retryable =
                /Execution context was destroyed|Target page, context or browser has been closed/i.test(message);
            if (!retryable || i === retries) throw error;
        }
    }
    throw lastError;
}

/* ────────── scraping ────────── */

async function extractRowsForPage(page, pageMeta) {
    console.log(`  Navigating to: ${pageMeta.url}`);
    await page.goto(pageMeta.url, { waitUntil: "networkidle", timeout: 90_000 });

    // Get all material dropdown options
    const materials = await withRetry(async () => {
        return page.$$eval("#sorten option", (nodes) =>
            nodes.map((node) => ({
                value: node.getAttribute("value") || "",
                label: (node.textContent || "").trim(),
            }))
        );
    });

    // Filter to only the 4 target materials
    const targetMaterials = materials
        .map((item) => ({ ...item, label: normalizeLabel(item.label) }))
        .filter((item) => item.value)
        .filter((item) => materialWanted(item.label));

    if (targetMaterials.length === 0) {
        console.warn(`  ⚠ No matching materials found on ${pageMeta.url}`);
        console.warn(`    Available materials: ${materials.map((m) => m.label.substring(0, 60)).join(" | ")}`);
        return [];
    }

    console.log(`  Found ${targetMaterials.length} matching materials`);

    const rows = [];

    for (const material of targetMaterials) {
        // Select this material in the dropdown
        await withRetry(async () => {
            await page.selectOption("#sorten", material.value);
            await page.waitForTimeout(1200);
        });

        // Read the quantity/price options
        const qtyOptionTexts = await withRetry(async () => {
            return page.$$eval("#wmd_shirt_auflage option", (nodes) =>
                nodes.map((node) => (node.textContent || "").trim())
            );
        });

        const matcher = materialWanted(material.label);
        const materialLabel = matcher ? matcher.label : material.label;

        qtyOptionTexts.forEach((optionText) => {
            const parsed = parseQuantityPriceText(optionText);
            if (!parsed) return;
            if (!pageMeta.targetQuantities.includes(parsed.quantity)) return;

            rows.push({
                formatLabel: pageMeta.formatLabel,
                printMode: pageMeta.printMode,
                materialLabel,
                quantity: parsed.quantity,
                eur: parsed.eur,
                sourceOptionText: optionText,
                detailUrl: pageMeta.url,
            });
        });

        console.log(
            `    ${materialLabel.substring(0, 50).padEnd(50)} → ${rows.filter((r) => r.materialLabel === materialLabel).length} prices`
        );
    }

    return rows;
}

/* ────────── CSV serialization ────────── */

function serializeCsv(rows) {
    const header = [
        "format",
        "print_mode",
        "material",
        "quantity",
        "eur",
        "dkk_base",
        "tier_multiplier",
        "dkk_final",
        "detail_url",
    ];

    const lines = [header.join(",")];
    rows.forEach((row) => {
        const fields = [
            row.formatLabel,
            row.printMode,
            row.materialLabel,
            row.quantity,
            row.eur,
            row.dkkBase,
            row.tierMultiplier,
            row.dkkFinal,
            row.detailUrl,
        ].map((field) => {
            const text = String(field ?? "");
            if (/[",\n]/.test(text)) {
                return `"${text.replace(/"/g, '""')}"`;
            }
            return text;
        });

        lines.push(fields.join(","));
    });

    return `${lines.join("\n")}\n`;
}

/* ────────── supabase ────────── */

function getSupabaseClient() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key =
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !key) {
        throw new Error("Missing Supabase env. Expected VITE_SUPABASE_URL and a Supabase key.");
    }

    return createClient(url, key, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
}

async function ensureProduct(client, tenantId, productName, productSlug) {
    const { data: existing, error: existingError } = await client
        .from("products")
        .select("id, slug, name, is_published")
        .eq("tenant_id", tenantId)
        .eq("slug", productSlug)
        .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
        return { product: existing, created: false };
    }

    const { data: created, error: createError } = await client
        .from("products")
        .insert({
            tenant_id: tenantId,
            name: productName,
            slug: productSlug,
            icon_text: productName,
            description: "Standard salgsmappe – auto-imported from wir-machen-druck.de",
            category: "tryksager",
            pricing_type: "matrix",
            is_published: false,
            preset_key: "custom",
            technical_specs: {
                width_mm: 210,
                height_mm: 297,
                bleed_mm: 3,
                min_dpi: 300,
                is_free_form: false,
                standard_format: "A4",
            },
        })
        .select("id, slug, name, is_published")
        .single();

    if (createError) throw createError;

    return { product: created, created: true };
}

async function loadGroups(client, tenantId, productId) {
    const { data, error } = await client
        .from("product_attribute_groups")
        .select("id, name, kind, sort_order, values:product_attribute_values(id, name, width_mm, height_mm, meta)")
        .eq("tenant_id", tenantId)
        .eq("product_id", productId)
        .order("sort_order", { ascending: true });

    if (error) throw error;
    return data || [];
}

async function ensureGroup(client, context, { name, kind, sortOrder }) {
    const normalizedName = normalizeLabel(name).toLowerCase();
    const found = context.groups.find(
        (group) => group.kind === kind && normalizeLabel(group.name).toLowerCase() === normalizedName
    );

    if (found) return found;

    const { data, error } = await client
        .from("product_attribute_groups")
        .insert({
            tenant_id: context.tenantId,
            product_id: context.productId,
            name,
            kind,
            source: "product",
            ui_mode: "buttons",
            sort_order: sortOrder,
            enabled: true,
        })
        .select("id, name, kind, sort_order, values:product_attribute_values(id, name, width_mm, height_mm, meta)")
        .single();

    if (error) throw error;

    const normalized = { ...data, values: data.values || [] };
    context.groups.push(normalized);
    return normalized;
}

async function ensureValue(client, context, group, valueName) {
    const normalized = normalizeLabel(valueName);

    const existing = (group.values || []).find(
        (value) => String(value.name || "").toLowerCase() === normalized.toLowerCase()
    );

    if (existing) return existing;

    const { data: inserted, error: insertError } = await client
        .from("product_attribute_values")
        .insert({
            tenant_id: context.tenantId,
            product_id: context.productId,
            group_id: group.id,
            name: normalized,
            sort_order: (group.values || []).length,
            enabled: true,
        })
        .select("id, name, width_mm, height_mm, meta")
        .single();

    if (insertError) throw insertError;

    group.values = [...(group.values || []), inserted];
    return inserted;
}

/* ────────── pricing structure ────────── */

function buildPricingStructure({
    materialGroup,
    materialValues,
    formatGroup,
    formatValues,
    printModeGroup,
    printModeValues,
    allQuantities,
}) {
    return {
        mode: "matrix_layout_v1",
        version: 1,
        vertical_axis: {
            sectionId: "vertical-axis",
            sectionType: "materials",
            groupId: materialGroup.id,
            valueIds: materialValues.map((v) => v.id),
            ui_mode: "buttons",
            valueSettings: {},
            title: "Materiale",
            description: "",
        },
        layout_rows: [
            {
                id: "row-format",
                title: "",
                description: "",
                columns: [
                    {
                        id: "format-section",
                        sectionType: "formats",
                        groupId: formatGroup.id,
                        valueIds: formatValues.map((v) => v.id),
                        ui_mode: "buttons",
                        selection_mode: "required",
                        valueSettings: {},
                        title: "Format",
                        description: "",
                    },
                ],
            },
            {
                id: "row-print-mode",
                title: "",
                description: "",
                columns: [
                    {
                        id: "print-mode-section",
                        sectionType: "finishes",
                        groupId: printModeGroup.id,
                        valueIds: printModeValues.map((v) => v.id),
                        ui_mode: "buttons",
                        selection_mode: "required",
                        valueSettings: {},
                        title: "Tryk",
                        description: "",
                    },
                ],
            },
        ],
        quantities: allQuantities,
    };
}

/* ────────── import to supabase ────────── */

async function importToSupabase({ tenantId, productName, productSlug, transformedRows, dryRun }) {
    if (transformedRows.length === 0) {
        throw new Error("No transformed rows to import");
    }

    const formatNames = Array.from(new Set(SOURCE_PAGES.map((page) => page.formatLabel)));
    const printModeNames = ["4+0", "4+4"];
    const materialNames = MATERIAL_MATCHERS.map((entry) => entry.label);
    const normalizedRows = buildSalesmapperNormalizedRows(transformedRows, {
        importerKey: "salesmapper_fetch_import",
        supplierProductType: "standard-sales-mapper-3-laschen",
        selectionsForRow: (row) => ({
            material: row.materialLabel,
            format: row.formatLabel,
            printMode: row.printMode,
        }),
    });

    if (dryRun) {
        return {
            dryRun: true,
            productSlug,
            rowsPrepared: normalizedRows.length,
            uniqueFormats: formatNames.length,
            uniquePrintModes: printModeNames.length,
            uniqueMaterials: materialNames.length,
        };
    }

    const client = getSupabaseClient();

    const ensured = await ensureProduct(client, tenantId, productName, productSlug);
    const result = await publishSalesmapperMatrix({
        client,
        tenantId,
        productId: ensured.product.id,
        normalizedRows,
        matrixConfig: {
            verticalAxis: buildSalesmapperMaterialAxis(materialNames, 2),
            sections: [
                buildSalesmapperFormatSection(formatNames),
                buildSalesmapperOptionSection({
                    key: "printMode",
                    rowId: "row-print-mode",
                    sectionId: "print-mode-section",
                    groupName: "Tryk",
                    title: "Tryk",
                    valueNames: printModeNames,
                    sortOrder: 1,
                    extraDataIdField: "printModeId",
                }),
            ],
        },
        productUpdate: {
            name: productName,
            slug: productSlug,
        },
    });

    return {
        dryRun: false,
        productId: ensured.product.id,
        productSlug,
        productCreated: ensured.created,
        rowsInserted: result.rowsInserted,
        uniqueFormats: formatNames.length,
        uniquePrintModes: printModeNames.length,
        uniqueMaterials: materialNames.length,
    };
}

/* ────────── main runner ────────── */

async function runImport(args) {
    const repoRoot = process.cwd();
    ensureDir(path.join(repoRoot, "pricing_raw"));
    ensureDir(path.join(repoRoot, "pricing_clean"));

    const browser = await chromium.launch({ headless: true });

    try {
        const page = await browser.newPage();

        // Accept cookies if prompted
        await page.goto("https://www.wir-machen-druck.de", { waitUntil: "domcontentloaded", timeout: 90_000 });
        try {
            const cookieBtn = page.locator("button:has-text('Alle akzeptieren'), #onetrust-accept-btn-handler");
            await cookieBtn.click({ timeout: 5_000 });
            console.log("Accepted cookies");
        } catch {
            // No cookie banner, continue
        }

        const allExtractedRows = [];

        for (const pageMeta of SOURCE_PAGES) {
            console.log(`\n── ${pageMeta.formatLabel} (${pageMeta.printMode}) ──`);
            const rows = await extractRowsForPage(page, pageMeta);
            allExtractedRows.push(...rows);
            console.log(`  Total rows from page: ${rows.length}`);
        }

        if (allExtractedRows.length === 0) {
            throw new Error("No rows extracted from any page");
        }

        // Apply price transformation
        const transformedMap = new Map();

        allExtractedRows.forEach((row) => {
            const pricing = transformedPrice(row.eur);
            const key = [row.formatLabel, row.printMode, row.materialLabel, row.quantity].join("||");
            transformedMap.set(key, {
                ...row,
                dkkBase: pricing.dkkBase,
                tierMultiplier: pricing.tierMultiplier,
                dkkFinal: pricing.dkkFinal,
            });
        });

        const transformedRows = Array.from(transformedMap.values()).sort((a, b) => {
            if (a.formatLabel !== b.formatLabel) return a.formatLabel.localeCompare(b.formatLabel);
            if (a.printMode !== b.printMode) return a.printMode.localeCompare(b.printMode);
            if (a.materialLabel !== b.materialLabel) return a.materialLabel.localeCompare(b.materialLabel);
            return a.quantity - b.quantity;
        });

        // Save raw + clean files
        const timestamp = timestampForFile();
        const rawPath = path.join(repoRoot, "pricing_raw", args.productSlug, `${timestamp}.json`);
        const cleanPath = path.join(repoRoot, "pricing_clean", args.productSlug, `${timestamp}.csv`);

        ensureDir(path.dirname(rawPath));
        ensureDir(path.dirname(cleanPath));

        fs.writeFileSync(
            rawPath,
            JSON.stringify(
                {
                    timestamp,
                    product: { name: args.productName, slug: args.productSlug, tenant_id: args.tenantId },
                    source_pages: SOURCE_PAGES.map((p) => ({ format: p.formatLabel, printMode: p.printMode, url: p.url })),
                    material_matchers: MATERIAL_MATCHERS.map((m) => ({ pattern: m.pattern.source, label: m.label })),
                    extracted_rows: allExtractedRows,
                },
                null,
                2
            ),
            "utf8"
        );

        fs.writeFileSync(cleanPath, serializeCsv(transformedRows), "utf8");

        console.log(`\nRaw snapshot: ${rawPath}`);
        console.log(`Clean CSV: ${cleanPath}`);
        console.log(`Extracted rows: ${allExtractedRows.length}`);
        console.log(`Prepared rows: ${transformedRows.length}`);

        const result = await importToSupabase({
            tenantId: args.tenantId,
            productName: args.productName,
            productSlug: args.productSlug,
            transformedRows,
            dryRun: args.dryRun,
        });

        if (result.dryRun) {
            console.log("\nDry-run complete (no DB writes)");
            console.log(`  Product slug: ${result.productSlug}`);
            console.log(`  Rows prepared: ${result.rowsPrepared}`);
            console.log(`  Formats: ${result.uniqueFormats}`);
            console.log(`  Print modes: ${result.uniquePrintModes}`);
            console.log(`  Materials: ${result.uniqueMaterials}`);
            return;
        }

        console.log("\n✅ Import complete");
        console.log(`  Product ID: ${result.productId}`);
        console.log(`  Product slug: ${result.productSlug}`);
        console.log(`  Product created: ${result.productCreated ? "yes" : "no (existing)"}`);
        console.log(`  Rows inserted: ${result.rowsInserted}`);
        console.log(`  Formats: ${result.uniqueFormats}`);
        console.log(`  Print modes: ${result.uniquePrintModes}`);
        console.log(`  Materials: ${result.uniqueMaterials}`);
    } finally {
        await browser.close();
    }
}

async function main() {
    const args = parseArgs(process.argv);

    if (!args.command || ["-h", "--help", "help"].includes(args.command)) {
        console.log(usage());
        return;
    }

    if (args.command !== "import") {
        throw new Error(`Unknown command: ${args.command}\n\n${usage()}`);
    }

    await runImport(args);
}

main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
});
