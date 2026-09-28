#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { applyConversionRule } from "./shared/conversion.js";

const SOURCE_CATEGORY_URL =
  "https://www.wir-machen-druck.de/adventskalender-guenstig-drucken,category,24057.html";

const TARGET_QUANTITIES = new Set([
  1, 5, 10, 25, 50, 75, 100, 150, 200, 250, 300, 350, 400, 450, 500,
  750, 1000, 1500, 2000, 2500,
]);

const PRODUCTS = [
  ["premium", "wall-landscape", "https://www.wir-machen-druck.de/schokoadventskalender-klassikwandkalender-querformat-40farbig-bedruckt.html"],
  ["premium", "wall-portrait", "https://www.wir-machen-druck.de/schokoadventskalender-klassikwandkalender-hochformat-40farbig-bedruckt.html"],
  ["premium", "table-landscape", "https://www.wir-machen-druck.de/schokoadventskalender-kompakttischkalender-querformat-40farbig-bedruckt.html"],
  ["premium", "table-portrait", "https://www.wir-machen-druck.de/schokoadventskalender-kompakttischkalender-hochformat-40farbig-bedruckt.html"],
  ["multi-box", "celebrations", "https://www.wir-machen-druck.de/celebrationsadventskalender-40farbig-bedruckt.html"],
  ["multi-box", "kinder-mini-mix", "https://www.wir-machen-druck.de/kinderminimixadventskalender-40farbig-bedruckt.html"],
  ["multi-box", "milka-favourites", "https://www.wir-machen-druck.de/milka-favouritesadventskalender-40farbig-bedruckt.html"],
  ["multi-box", "merci-petits", "https://www.wir-machen-druck.de/mercipetitsadventskalender-40farbig-bedruckt.html"],
  ["self-fill", "standard-portrait", "https://www.wir-machen-druck.de/adventskalender-zum-selbst-befuellen-hochformat-40-farbig-bedruckt.html"],
  ["self-fill", "standard-landscape", "https://www.wir-machen-druck.de/adventskalender-zum-selbst-befuellen-querformat-40-farbig-bedruckt.html"],
  ["self-fill", "sustainable-portrait", "https://www.wir-machen-druck.de/nachhaltiger-adventskalender-zum-selbst-befuellen-hochformat-40-farbig-bedruckt.html"],
  ["self-fill", "sustainable-landscape", "https://www.wir-machen-druck.de/nachhaltiger-adventskalender-zum-selbst-befuellen-querformat-40-farbig-bedruckt.html"],
  ["self-fill", "folding-boxes", "https://www.wir-machen-druck.de/adventskalender-mit-faltschachteln-40-farbig-bedruckt.html"],
  ["multi-box", "toblerone-mix", "https://www.wir-machen-druck.de/tobleronemixadventskalender-40farbig-bedruckt.html"],
  ["table-naps", "klettinis", "https://www.wir-machen-druck.de/klettinisnapsadventskalender-40farbig-bedruckt.html"],
  ["table-naps", "sarotti", "https://www.wir-machen-druck.de/sarottinapsadventskalender-40farbig-bedruckt.html"],
  ["lindt", "lindor-table", "https://www.wir-machen-druck.de/lindt-lindor-tischadventskalender-40-farbig-bedruckt.html"],
  ["lindt", "lindor-wall", "https://www.wir-machen-druck.de/lindt-lindor-wandadventskalender-40-farbig-bedruckt.html"],
  ["lindt", "lindor-mix-table", "https://www.wir-machen-druck.de/lindtlindorschokoladenmixtischadventskalender-40farbig-bedruckt.html"],
  ["lindt", "xmas-box", "https://www.wir-machen-druck.de/lindt-xmas-box-40-farbig-bedruckt-deckel-bedruckt.html"],
  ["lindt", "book", "https://www.wir-machen-druck.de/lindt-lindor-adventskalender-buch-40-farbig-bedruckt.html"],
  ["multi-box", "lindt-hello-mini-sticks", "https://www.wir-machen-druck.de/multi-adventskalender-lindt-hello-mini-sticks-40-farbig-bedruckt.html"],
  ["multi-box", "lindt-lindor-balls", "https://www.wir-machen-druck.de/multi-adventskalender-lindt-lindor-kugel-40-farbig-bedruckt.html"],
  ["special", "beer-crate", "https://www.wir-machen-druck.de/bierkastenadventskalender-395-x-298-x-98-cm-40-farbig-bedruckt.html"],
  ["coupon", "a4-landscape-2-page", "https://www.wir-machen-druck.de/couponkalender-din-a4-quer-2seiter.html"],
  ["coupon", "a5-landscape-4-page", "https://www.wir-machen-druck.de/couponkalender-din-a5-quer-4seiter.html"],
  ["ritter-sport", "classic", "https://www.wir-machen-druck.de/rittersportadventskalender-40farbig-bedruckt.html"],
  ["multi-box", "ritter-sport-cubes", "https://www.wir-machen-druck.de/multi-adventskalender-ritter-sport-schokowuerfel-40-farbig-bedruckt.html"],
].map(([family, variant, url]) => ({ family, variant, url }));

function parseArgs(argv) {
  const args = { concurrency: 3, output: null, resume: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--output") args.output = argv[++index];
    else if (token === "--concurrency") args.concurrency = Number(argv[++index]);
    else if (token === "--resume") args.resume = true;
    else if (token === "--help") {
      console.log("Usage: node scripts/product-import/fetch-wmd-advent-calendars.mjs [--output DIR] [--concurrency N] [--resume]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  if (!Number.isInteger(args.concurrency) || args.concurrency < 1 || args.concurrency > 6) {
    throw new Error("--concurrency must be an integer from 1 to 6");
  }
  return args;
}

function defaultRunDirectory() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return path.resolve("tmp", "supplier-imports", `wmd-advent-calendars-${stamp}`);
}

function parseGermanMoney(value) {
  const normalized = String(value || "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseQuantity(text) {
  const match = String(text || "").match(/^\s*([0-9][0-9.]*)\s+/);
  if (!match) return null;
  const quantity = Number(match[1].replace(/\./g, ""));
  return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
}

function approximateListPrice(optionLabel, quantity) {
  const match = String(optionLabel || "").match(/\(([0-9.]+,[0-9]{2})\s+Euro\s+netto/i);
  const unitPrice = match ? parseGermanMoney(match[1]) : null;
  return unitPrice === null ? null : Number((unitPrice * quantity).toFixed(2));
}

function cleanHtmlText(value) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&auml;/gi, "ä")
    .replace(/&ouml;/gi, "ö")
    .replace(/&uuml;/gi, "ü")
    .replace(/&szlig;/gi, "ß")
    .replace(/&sup2;/gi, "²")
    .replace(/&reg;/gi, "®")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

async function readProductMetadata(page, product) {
  return page.evaluate((meta) => {
    const schema = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((node) => {
        try {
          return JSON.parse(node.textContent || "null");
        } catch {
          return null;
        }
      })
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .find((value) => value && value["@type"] === "Product") || null;

    const scripts = [...document.scripts].map((node) => node.textContent || "").join("\n");
    const sizeMatch = scripts.match(/\\?"size\\?"\s*:\s*\\?"\s*\(([^)]+)\)/i);
    const productId = document.querySelector('input[name="c"]')?.value || schema?.sku || null;
    const bodyText = (document.body.innerText || "").replace(/\s+/g, " ");
    const promotionMatch = bodyText.match(/(\d+)\s*%\s*FRÜHBUCHER-RABATT\s+BIS\s+ZUM\s+([^,]+),/i);
    const materials = [...document.querySelectorAll('#sorten option, select[name="sorten"] option')]
      .map((option) => ({ value: option.value, label: (option.textContent || "").trim() }))
      .filter((item) => item.value && item.value !== "0");
    const images = [...document.querySelectorAll("img")]
      .map((image) => ({
        url: image.currentSrc || image.src || image.dataset.src || "",
        alt: image.alt || "",
        width: image.naturalWidth || 0,
        height: image.naturalHeight || 0,
      }))
      .filter((image) => image.url && (/product-icon|resized\/media|produktbilder/i.test(image.url)))
      .filter((image, index, all) => all.findIndex((candidate) => candidate.url === image.url) === index);
    const documents = [...document.querySelectorAll("a[href]")]
      .map((anchor) => ({
        url: anchor.href,
        label: (anchor.innerText || anchor.textContent || "").trim().replace(/\s+/g, " "),
      }))
      .filter((item) => /\.pdf(?:$|\?)/i.test(item.url) || /druckvorlage|datenblatt|template/i.test(item.url + " " + item.label))
      .filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index);

    return {
      ...meta,
      fetchedUrl: location.href,
      title: document.title,
      name: document.querySelector("h1")?.textContent?.trim().replace(/\s+/g, " ") || schema?.name || "",
      sku: schema?.sku || productId,
      productId,
      sourceDescriptionHtml: schema?.description || "",
      sourceImage: schema?.image || null,
      printSize: sizeMatch?.[1]?.trim() || null,
      promotion: promotionMatch ? { percent: Number(promotionMatch[1]), endsLabel: promotionMatch[2].trim() } : null,
      materials,
      images,
      documents,
    };
  }, product);
}

async function extractPriceRows(page, productMeta) {
  const rows = [];
  const materials = productMeta.materials.length > 0 ? productMeta.materials : [{ value: null, label: "" }];

  for (const material of materials) {
    if (material.value) {
      await page.selectOption('#sorten, select[name="sorten"]', material.value);
      await page.waitForFunction(
        (value) => {
          const selected = document.querySelector('#sorten, select[name="sorten"]')?.value;
          const quantities = document.querySelectorAll('#wmd_shirt_auflage option, select[name="auflage"] option');
          return selected === value && quantities.length > 1;
        },
        material.value,
        { timeout: 20_000 }
      );
      await page.waitForTimeout(650);
    }

    const quantities = await page.$$eval(
      '#wmd_shirt_auflage option, select[name="auflage"] option',
      (options) => options.map((option) => ({ value: option.value, label: (option.textContent || "").trim() }))
    );

    for (const option of quantities) {
      const quantity = parseQuantity(option.label);
      if (!quantity || !TARGET_QUANTITIES.has(quantity)) continue;

      const expectedListPriceEur = approximateListPrice(option.label, quantity);
      const previousState = await page.evaluate(() => ({
        option: document.querySelector('select[name="auflage"]')?.value || "",
        net: document.querySelector("#sticky-net-price")?.textContent || "",
      }));
      await page.selectOption('select[name="auflage"]', option.value);
      await page.waitForFunction(
        ({ value, previous, expected, quantity }) => {
          const selected = document.querySelector('select[name="auflage"]')?.value;
          const net = document.querySelector("#sticky-net-price")?.textContent || "";
          const baseText = document.querySelector(".base-price")?.textContent || "";
          const parseMoney = (text) => {
            const normalized = String(text || "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : null;
          };
          const base = parseMoney(baseText);
          const expectedMatches = expected === null || (base !== null && Math.abs(base - expected) <= Math.max(0.35, expected * 0.003, quantity * 0.006));
          const changed = previous.option === value || net !== previous.net;
          return selected === value && net.trim() && expectedMatches && changed;
        },
        { value: option.value, previous: previousState, expected: expectedListPriceEur, quantity },
        { timeout: 20_000 }
      );
      await page.waitForTimeout(120);

      const price = await page.evaluate(() => {
        const rowText = [...document.querySelectorAll(".price-row")].map((row) =>
          (row.innerText || row.textContent || "").trim().replace(/\s+/g, " ")
        );
        const findRow = (label) => rowText.find((text) => text.toLowerCase().startsWith(label.toLowerCase())) || "";
        const moneyFrom = (text) => text.match(/-?\s*([0-9.]+,[0-9]{2})\s*EUR/i)?.[1] || null;
        return {
          base: document.querySelector(".base-price")?.textContent?.trim() || moneyFrom(findRow("Unser Preis")),
          discount: moneyFrom(findRow("Rabatt")),
          net: document.querySelector("#sticky-net-price")?.textContent?.trim() || document.querySelector(".net-price")?.textContent?.trim() || moneyFrom(findRow("Preis (netto)")),
          vat: moneyFrom(findRow("19% MwSt.")),
          gross: document.querySelector("#sticky-total-price")?.textContent?.trim() || document.querySelector(".gesamtpreis_brutto")?.textContent?.trim() || moneyFrom(findRow("Gesamtpreis")),
          shipping: moneyFrom(findRow("Versandkosten")),
          processing: moneyFrom(findRow("Verarbeitung")),
          weight: (document.body.innerText || "").match(/Gesamtgewicht\s+ca\.\s*([^\n]+?kg)/i)?.[1]?.trim() || null,
        };
      });

      const supplierNetPriceEur = parseGermanMoney(price.net);
      if (supplierNetPriceEur === null) {
        throw new Error(`No net price found for ${productMeta.variant}, quantity ${quantity}`);
      }

      rows.push({
        sourceUrl: productMeta.url,
        sourceProductId: productMeta.productId,
        sourceSku: productMeta.sku,
        family: productMeta.family,
        variant: productMeta.variant,
        productName: productMeta.name,
        materialId: material.value,
        material: material.label,
        quantityOptionId: option.value,
        quantityOptionLabel: option.label,
        quantity,
        supplierListPriceEur: parseGermanMoney(price.base),
        supplierDiscountEur: parseGermanMoney(price.discount),
        supplierNetPriceEur,
        supplierVatEur: parseGermanMoney(price.vat),
        supplierGrossPriceEur: parseGermanMoney(price.gross),
        supplierShippingEur: parseGermanMoney(price.shipping),
        supplierProcessingEur: parseGermanMoney(price.processing),
        weight: price.weight,
        promotion: productMeta.promotion,
        capturedAt: new Date().toISOString(),
      });
    }
  }

  return rows;
}

async function extractProduct(browser, product) {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const page = await browser.newPage({ locale: "de-DE" });
    try {
      await page.goto(product.url, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForSelector('select[name="auflage"]', { timeout: 30_000 });
      await page.waitForTimeout(600 + attempt * 250);
      const metadata = await readProductMetadata(page, product);
      metadata.sourceDescription = cleanHtmlText(metadata.sourceDescriptionHtml);
      const prices = await extractPriceRows(page, metadata);
      return { metadata, prices, error: null };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await page.waitForTimeout(attempt * 750).catch(() => {});
    } finally {
      await page.close().catch(() => {});
    }
  }

  return {
    metadata: { ...product },
    prices: [],
    error: lastError instanceof Error ? lastError.message : String(lastError),
  };
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeJsonl(filePath, rows) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`, "utf8");
}

async function readJsonIfPresent(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
}

async function readJsonlIfPresent(filePath) {
  try {
    const content = (await fs.readFile(filePath, "utf8")).trim();
    return content ? content.split("\n").map((line) => JSON.parse(line)) : [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function buildReview(results, rawRows, normalizedRows) {
  const successful = results.filter((result) => !result.error);
  const failed = results.filter((result) => result.error);
  const families = new Map();
  for (const result of successful) {
    const family = result.metadata.family;
    const entries = families.get(family) || [];
    entries.push(result.metadata);
    families.set(family, entries);
  }

  const lines = [
    "# WIRmachenDRUCK julekalendere - udtræksrapport",
    "",
    "## Status",
    "",
    "- Tilstand: `extracted` (skrivebeskyttet importkladde).",
    "- Ingen Supplier Bank-, produkt-, pris- eller publiceringsskrivninger er udført.",
    `- Kategorikilde: ${SOURCE_CATEGORY_URL}`,
    `- Konfiguratorer fundet: ${PRODUCTS.length}`,
    `- Konfiguratorer udtrukket: ${successful.length}`,
    `- Prispunkter udtrukket: ${rawRows.length}`,
    `- DKK-preview: ${normalizedRows.length} rækker med \`wmd_tiered_fx_7_6\`.`,
    "",
    "## Foreslåede konstruktionsfamilier",
    "",
  ];

  for (const [family, products] of [...families.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`### ${family}`, "");
    for (const product of products) {
      lines.push(`- **${product.variant}**: ${product.name} (${product.pricesCount || 0} priser)`);
    }
    lines.push("");
  }

  if (failed.length > 0) {
    lines.push("## Fejl til manuel kontrol", "");
    for (const result of failed) lines.push(`- ${result.metadata.url}: ${result.error}`);
    lines.push("");
  }

  lines.push(
    "## Næste godkendelsespunkt",
    "",
    "Godkend først familie-/variantopdelingen og de foreslåede DKK-priser. Supplier Bank, produktkladder, live priser og publicering er efterfølgende separate godkendelser.",
    ""
  );
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runDirectory = path.resolve(args.output || defaultRunDirectory());
  const rawDirectory = path.join(runDirectory, "raw");
  const normalizedDirectory = path.join(runDirectory, "normalized");
  const reviewDirectory = path.join(runDirectory, "review");
  await Promise.all([
    fs.mkdir(rawDirectory, { recursive: true }),
    fs.mkdir(normalizedDirectory, { recursive: true }),
    fs.mkdir(reviewDirectory, { recursive: true }),
  ]);

  const catalogPath = path.join(rawDirectory, "catalog.json");
  const rawPricingPath = path.join(rawDirectory, "pricing.jsonl");
  const existingCatalog = args.resume ? await readJsonIfPresent(catalogPath, []) : [];
  const existingRawRows = args.resume ? await readJsonlIfPresent(rawPricingPath) : [];
  const existingByUrl = new Map(existingCatalog.map((item) => [item.url, item]));
  const productsToExtract = args.resume
    ? PRODUCTS.filter((product) => !existingByUrl.has(product.url) || existingByUrl.get(product.url)?.error)
    : PRODUCTS;

  if (args.resume && productsToExtract.length === 0) {
    console.log("Resume requested, but the existing snapshot has no failed or missing products.");
  }

  const browser = await chromium.launch({ headless: true });
  const extractedResults = new Array(productsToExtract.length);
  let nextIndex = 0;

  try {
    const worker = async () => {
      while (nextIndex < productsToExtract.length) {
        const index = nextIndex++;
        const product = productsToExtract[index];
        const result = await extractProduct(browser, product);
        if (!result.error) result.metadata.pricesCount = result.prices.length;
        extractedResults[index] = result;
        console.log(`${result.error ? "FAILED" : "OK"} ${index + 1}/${productsToExtract.length} ${product.family}/${product.variant} ${result.prices.length}`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(args.concurrency, Math.max(1, productsToExtract.length)) }, worker));
  } finally {
    await browser.close();
  }

  const retriedUrls = new Set(productsToExtract.map((product) => product.url));
  const rawRows = [
    ...existingRawRows.filter((row) => !retriedUrls.has(row.sourceUrl)),
    ...extractedResults.flatMap((result) => result?.prices || []),
  ];
  const extractedByUrl = new Map(extractedResults.map((result) => [result.metadata.url, result]));
  const catalog = PRODUCTS.map((product) => {
    const extracted = extractedByUrl.get(product.url);
    if (extracted) return { ...extracted.metadata, error: extracted.error };
    return existingByUrl.get(product.url) || { ...product, error: "Missing from extraction snapshot" };
  });
  const results = catalog.map((metadata) => ({
    metadata,
    prices: rawRows.filter((row) => row.sourceUrl === metadata.url),
    error: metadata.error,
  }));
  const normalizedRows = rawRows.map((row, sourceOrder) => ({
    sourceOrder,
    ...row,
    ...applyConversionRule(row.supplierNetPriceEur, "wmd_tiered_fx_7_6"),
    conversionRule: "wmd_tiered_fx_7_6",
  }));
  await Promise.all([
    writeJson(catalogPath, catalog),
    writeJsonl(rawPricingPath, rawRows),
    writeJsonl(path.join(normalizedDirectory, "pricing-preview.jsonl"), normalizedRows),
    writeJson(path.join(runDirectory, "discovery.json"), {
      state: "extracted",
      sourceCategoryUrl: SOURCE_CATEGORY_URL,
      capturedAt: new Date().toISOString(),
      conversionRule: "wmd_tiered_fx_7_6",
      supplierBankWritten: false,
      productDraftsWritten: false,
      pricingWritten: false,
      published: false,
      products: PRODUCTS,
    }),
    fs.writeFile(path.join(reviewDirectory, "report.md"), buildReview(results, rawRows, normalizedRows), "utf8"),
  ]);

  console.log(`Run directory: ${runDirectory}`);
  console.log(`Successful products: ${results.filter((result) => !result.error).length}/${results.length}`);
  console.log(`Raw price rows: ${rawRows.length}`);
  console.log("No Supplier Bank, product, pricing, or publishing writes were performed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
