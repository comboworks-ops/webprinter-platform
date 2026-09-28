#!/usr/bin/env node

import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { applyConversionRule } from "./shared/conversion.js";
import {
  buildWmdSalesFolderCoverageReport,
  buildWmdSalesFolderOptionCatalog,
  classifyWmdSalesFolderSource,
  normalizeWmdSalesFolderRows,
  parseWmdSalesFolderMaterial,
  parseWmdSalesFolderQuantityPrice,
  pruneWmdSalesFolderRetryFailures,
  sortWmdSalesFolderRows,
} from "./shared/wmd-sales-folders.js";

const SOURCE_CATEGORY_URL =
  "https://www.wir-machen-druck.de/praesentationsmappen,category,9418.html";

const PRINT_BRANCHES = [
  {
    key: "4+0",
    labelDa: "Tryk på ydersiden (4+0)",
    url: "https://www.wir-machen-druck.de/mappe-einseitig-bedruckt-extrem-guenstig-online-bestellen,category,27718.html",
  },
  {
    key: "4+4",
    labelDa: "Tryk på yder- og inderside (4+4)",
    url: "https://www.wir-machen-druck.de/mappe-beidseitig-bedruckt-extrem-guenstig-online-bestellen,category,27719.html",
  },
];

const ALLOWED_HOST = "www.wir-machen-druck.de";
const CONVERSION_RULE = "wmd_tiered_fx_7_5";
const EXTRACTOR_VERSION = 5;
const CHECKPOINT_BATCH_SIZE = 8;
const RUNTIME_ALLOWED_HOSTS = new Set([ALLOWED_HOST, "cdn.wir-machen-druck.de"]);
const SENSITIVE_EVIDENCE_KEY = /(?:token|authorization|password|secret|session|cookie)/i;
const USER_IDENTIFIER_EVIDENCE_KEY = /^(?:userId|customerId|accountId)$/i;

function sha256Json(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function finiteNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeSupplierEvidencePayload(value, pathParts = [], redactedPaths = []) {
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeSupplierEvidencePayload(
      item,
      [...pathParts, String(index)],
      redactedPaths
    ));
  }
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    const itemPath = [...pathParts, key];
    if (SENSITIVE_EVIDENCE_KEY.test(key) || USER_IDENTIFIER_EVIDENCE_KEY.test(key)) {
      redactedPaths.push(itemPath.join("."));
      return [key, "[REDACTED]"];
    }
    return [key, sanitizeSupplierEvidencePayload(item, itemPath, redactedPaths)];
  }));
}

function buildSanitizedSupplierEvidence({ endpoint, request, response, capturedAt = new Date().toISOString() }) {
  const redactedPaths = [];
  const sanitizedRequest = sanitizeSupplierEvidencePayload(request, ["request"], redactedPaths);
  const sanitizedResponse = sanitizeSupplierEvidencePayload(response, ["response"], redactedPaths);
  return {
    endpoint,
    request: sanitizedRequest,
    response: sanitizedResponse,
    requestKeys: request && typeof request === "object" && !Array.isArray(request)
      ? Object.keys(request).sort()
      : [],
    responseKeys: response && typeof response === "object" && !Array.isArray(response)
      ? Object.keys(response).sort()
      : [],
    redactedPaths: [...new Set(redactedPaths)].sort(),
    sha256: sha256Json({ request: sanitizedRequest, response: sanitizedResponse }),
    sanitized: true,
    capturedAt,
  };
}

async function buildSupplierResponseEvidence(response, endpoint) {
  const requestPayload = JSON.parse(response.request().postData() || "{}");
  const responseText = await response.text();
  let responsePayload;
  try {
    responsePayload = JSON.parse(responseText);
  } catch {
    responsePayload = responseText;
  }
  return buildSanitizedSupplierEvidence({
    endpoint,
    request: requestPayload,
    response: responsePayload,
  });
}

function parseArgs(argv) {
  const args = {
    concurrency: 2,
    discoveryOnly: false,
    maxProducts: null,
    maxQuantities: null,
    output: null,
    priceVerification: "boundary",
    resume: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--output") args.output = argv[++index];
    else if (token === "--concurrency") args.concurrency = Number(argv[++index]);
    else if (token === "--discovery-only") args.discoveryOnly = true;
    else if (token === "--max-products") args.maxProducts = Number(argv[++index]);
    else if (token === "--max-quantities") args.maxQuantities = Number(argv[++index]);
    else if (token === "--price-verification") args.priceVerification = argv[++index];
    else if (token === "--resume") args.resume = true;
    else if (token === "--help") {
      console.log([
        "Usage: node scripts/product-import/fetch-wmd-sales-folders.js [options]",
        "",
        "Options:",
        "  --output DIR          Write the local extraction package to DIR",
        "  --concurrency N       Parallel product pages (1-4, default 2)",
        "  --discovery-only      Crawl the category tree without selecting prices",
        "  --max-products N      Limit product pages for a smoke run",
        "  --max-quantities N    Limit quantities per material for a smoke run",
        "  --price-verification MODE  boundary (default) or full supplier API checks",
        "  --resume              Retry failed/missing products in an existing run",
      ].join("\n"));
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!Number.isInteger(args.concurrency) || args.concurrency < 1 || args.concurrency > 4) {
    throw new Error("--concurrency must be an integer from 1 to 4");
  }
  for (const [key, value] of [["--max-products", args.maxProducts], ["--max-quantities", args.maxQuantities]]) {
    if (value !== null && (!Number.isInteger(value) || value < 1)) {
      throw new Error(`${key} must be a positive integer`);
    }
  }
  if (!new Set(["boundary", "full"]).has(args.priceVerification)) {
    throw new Error("--price-verification must be boundary or full");
  }
  return args;
}

function defaultRunDirectory() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return path.resolve("tmp", "supplier-imports", `wmd-sales-folders-${stamp}`);
}

function parseGermanMoney(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value || "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  if (!normalized || !/[0-9]/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseQuantity(text) {
  const match = String(text || "").match(/^\s*([0-9][0-9.]*)\s+/);
  if (!match) return null;
  const quantity = Number(match[1].replace(/\./g, ""));
  return Number.isInteger(quantity) && quantity > 0 ? quantity : null;
}

function optionTotalPrice(optionLabel) {
  return parseWmdSalesFolderQuantityPrice(optionLabel)?.totalEur ?? null;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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

function isAllowedSourceUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname === ALLOWED_HOST;
  } catch {
    return false;
  }
}

function uniqueBy(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = key(item);
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

async function writeJson(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporaryPath, filePath);
}

async function writeJsonl(filePath, rows) {
  const body = rows.length ? `${rows.map((row) => JSON.stringify(row)).join("\n")}\n` : "";
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, body, "utf8");
  await fs.rename(temporaryPath, filePath);
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

async function gotoCategory(page, url) {
  if (!isAllowedSourceUrl(url)) throw new Error(`Blocked category URL: ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  if (!isAllowedSourceUrl(page.url())) throw new Error(`Blocked category redirect: ${page.url()}`);
  await page.waitForSelector("h1", { timeout: 30_000 });
  await page.waitForTimeout(450);
}

async function restrictPageToSupplier(page) {
  await page.route("**/*", async (route) => {
    const requestUrl = route.request().url();
    if (/^(?:data:|blob:|about:)/i.test(requestUrl)) return route.continue();
    try {
      const parsed = new URL(requestUrl);
      if (parsed.protocol === "https:" && RUNTIME_ALLOWED_HOSTS.has(parsed.hostname)) {
        return route.continue();
      }
    } catch {
      // Invalid or browser-internal URLs are not needed by the extractor.
    }
    return route.abort("blockedbyclient");
  });
}

async function readCategoryPage(page) {
  return page.evaluate(() => {
    const categoryLinks = [...document.querySelectorAll("a.category-item-link[href]")]
      .map((anchor) => {
        const card = anchor.closest(".category-item, .product-card, li, article, div");
        const image = anchor.querySelector("img") || card?.querySelector("img");
        const titleNode = card?.querySelector(".category-item-title, h2, h3, h4");
        return {
          url: anchor.href,
          title: (titleNode?.textContent || image?.alt || image?.title || anchor.title || "")
            .replace(/\s+/g, " ")
            .trim(),
        };
      });

    const products = [...document.querySelectorAll(".product-card .product-thumb > a[href]")]
      .map((anchor) => {
        const card = anchor.closest(".product-card");
        const image = anchor.querySelector("img") || card?.querySelector("img");
        const titleNode = card?.querySelector(".product-title, h2, h3, h4");
        const onclick = anchor.getAttribute("onclick") || "";
        const onclickTitle = onclick.match(/googleTagManager\(['\"](.+?)['\"]\)/)?.[1] || "";
        return {
          url: anchor.href,
          title: (titleNode?.textContent || image?.alt || image?.title || onclickTitle || "")
            .replace(/\s+/g, " ")
            .trim(),
          imageUrl: image?.currentSrc || image?.src || null,
          imageAlt: (image?.alt || "").replace(/\s+/g, " ").trim(),
        };
      });

    return {
      title: document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() || "",
      categoryLinks,
      products,
    };
  });
}

async function discoverBranch(browser, branch) {
  const page = await browser.newPage({ locale: "de-DE" });
  await restrictPageToSupplier(page);
  const categories = [];
  const products = [];
  const queue = [{ url: branch.url, depth: 0, trail: [] }];
  const seenCategories = new Set();

  try {
    while (queue.length) {
      const current = queue.shift();
      if (seenCategories.has(current.url)) continue;
      seenCategories.add(current.url);
      await gotoCategory(page, current.url);
      const result = await readCategoryPage(page);
      const title = cleanText(result.title);
      const trail = [...current.trail, { url: current.url, title }];
      categories.push({
        branchKey: branch.key,
        branchLabelDa: branch.labelDa,
        depth: current.depth,
        title,
        url: current.url,
      });

      for (const product of uniqueBy(result.products, (item) => item.url)) {
        if (!isAllowedSourceUrl(product.url) || !/\.html(?:$|\?)/i.test(product.url)) continue;
        products.push({
          branchKey: branch.key,
          branchLabelDa: branch.labelDa,
          categoryTrail: trail,
          listingImageUrl: product.imageUrl,
          listingImageAlt: product.imageAlt,
          listingTitle: product.title,
          url: product.url,
        });
      }

      if (current.depth >= 4) continue;
      for (const child of uniqueBy(result.categoryLinks, (item) => item.url)) {
        if (!isAllowedSourceUrl(child.url) || !/,category,[0-9]+\.html(?:$|\?)/i.test(child.url)) continue;
        queue.push({
          url: child.url,
          depth: current.depth + 1,
          trail,
        });
      }
    }
  } finally {
    await page.close();
  }

  return { categories, products: uniqueBy(products, (item) => item.url) };
}

async function discoverCatalog(browser) {
  const categories = [];
  const products = [];
  for (const branch of PRINT_BRANCHES) {
    const result = await discoverBranch(browser, branch);
    categories.push(...result.categories);
    products.push(...result.products);
    console.log(`DISCOVERY ${branch.key}: ${result.categories.length} categories, ${result.products.length} products`);
  }
  return {
    categories,
    products: uniqueBy(products, (item) => item.url).map((product, sourceOrder) => ({
      sourceOrder,
      ...product,
      classification: classifyWmdSalesFolderSource(product.url, product.listingTitle),
    })),
  };
}

function validateDiscoverySnapshot(discovery) {
  if (!discovery || discovery.sourceCategoryUrl !== SOURCE_CATEGORY_URL) {
    throw new Error("Resume discovery source does not match the registered sales-folder category");
  }
  if (!Array.isArray(discovery.allowedHosts) || !discovery.allowedHosts.includes(ALLOWED_HOST)) {
    throw new Error("Resume discovery is missing the exact WMD hostname allowlist");
  }
  if (!Array.isArray(discovery.products) || !discovery.products.length) {
    throw new Error("Resume discovery contains no products");
  }
  const allowedBranchKeys = new Set(PRINT_BRANCHES.map((branch) => branch.key));
  const urls = new Set();
  discovery.products.forEach((product, index) => {
    if (!isAllowedSourceUrl(product?.url) || /,category,/i.test(product.url)) {
      throw new Error(`Resume discovery product ${index} has a blocked URL`);
    }
    if (!allowedBranchKeys.has(product.branchKey)) {
      throw new Error(`Resume discovery product ${index} has an unsupported print branch`);
    }
    if (urls.has(product.url)) throw new Error(`Resume discovery duplicates product URL ${product.url}`);
    urls.add(product.url);
  });
  return discovery;
}

async function readProductMetadata(page, product) {
  const metadata = await page.evaluate((listing) => {
    const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .flatMap((node) => {
        try {
          const value = JSON.parse(node.textContent || "null");
          return Array.isArray(value) ? value : [value];
        } catch {
          return [];
        }
      });
    const schema = schemas.find((value) => value && value["@type"] === "Product") || null;
    const productId = document.querySelector('input[name="c"]')?.value || schema?.sku || null;
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
      .filter((image) => image.url && /product-icon|resized\/media|produktbilder/i.test(image.url))
      .filter((image, index, all) => all.findIndex((candidate) => candidate.url === image.url) === index);
    const additionalOptionControls = [...document.querySelectorAll('input[type="checkbox"][name^="zusatz["]')]
      .map((input, sourceOrder) => ({
        sourceOrder,
        fieldKey: (input.name.match(/zusatz\[([^\]]+)\]/) || [])[1] || input.id.replace(/^feld_/, ""),
        id: input.id || null,
        labelOriginal: (input.labels?.[0]?.innerText || input.closest("label")?.innerText || input.parentElement?.innerText || "")
          .replace(/\s+/g, " ")
          .trim(),
        isClimateContribution: /klimabeitrag/i.test(
          input.labels?.[0]?.innerText || input.closest("label")?.innerText || input.parentElement?.innerText || ""
        ),
      }))
      .filter((item) => item.fieldKey && item.labelOriginal);
    const deliveryOptions = [...document.querySelectorAll('input[type="radio"][name="deliveryOption"]')]
      .map((input, sourceOrder) => ({
        sourceOrder,
        value: input.value,
        labelOriginal: (input.labels?.[0]?.innerText || input.closest("label")?.innerText || input.parentElement?.innerText || "")
          .replace(/\s+/g, " ")
          .trim(),
      }))
      .filter((item) => item.value && item.labelOriginal);
    const pageSnapshotFragments = {
      headingHtml: document.querySelector("h1")?.outerHTML || "",
      materialSelectHtml: document.querySelector('#sorten, select[name="sorten"]')?.outerHTML || "",
      quantitySelectHtml: document.querySelector('#wmd_shirt_auflage, select[name="auflage"]')?.outerHTML || "",
      additionalOptionHtml: [...document.querySelectorAll('input[type="checkbox"][name^="zusatz["]')]
        .map((input) => input.closest("label")?.outerHTML || input.parentElement?.outerHTML || input.outerHTML)
        .join("\n"),
      documentLinkHtml: [...document.querySelectorAll('a[href*=".pdf"]')]
        .map((anchor) => anchor.outerHTML)
        .join("\n"),
    };

    return {
      ...listing,
      fetchedUrl: location.href,
      title: document.title,
      name: document.querySelector("h1")?.textContent?.trim().replace(/\s+/g, " ") || schema?.name || "",
      sku: schema?.sku || productId,
      productId,
      sourceDescriptionHtml: schema?.description || "",
      sourceImage: schema?.image || null,
      materials,
      images,
      additionalOptionControls,
      deliveryOptions,
      pageSnapshotFragments,
    };
  }, product);

  metadata.sourceDescription = cleanHtmlText(metadata.sourceDescriptionHtml);
  metadata.classification = classifyWmdSalesFolderSource(metadata.url, metadata.name || metadata.listingTitle);
  metadata.pageSnapshot = {
    fragments: metadata.pageSnapshotFragments,
    sha256: sha256Json(metadata.pageSnapshotFragments),
    sanitized: true,
    excludesScriptsAndTokens: true,
  };
  delete metadata.pageSnapshotFragments;
  return metadata;
}

async function readCurrentDocuments(page) {
  const documents = await page.evaluate(() => [...document.querySelectorAll("a[href]")]
    .map((anchor) => ({
      url: anchor.href,
      label: (anchor.innerText || anchor.textContent || anchor.title || "").replace(/\s+/g, " ").trim(),
    }))
    .filter((item) => /\.pdf(?:$|\?)/i.test(item.url))
    .filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index));
  return documents
    .filter((document) => isAllowedSourceUrl(document.url))
    .map((document) => ({
      ...document,
      role: /datenblatt/i.test(document.label) || /_1\.pdf(?:$|\?)/i.test(document.url)
        ? "guide"
        : (/druckvorlage/i.test(document.label) || /_2\.pdf(?:$|\?)/i.test(document.url)
          ? "template"
          : "unknown"),
    }));
}

function inferSpineDepthFromDocuments(documents) {
  const matches = (Array.isArray(documents) ? documents : [])
    .flatMap((document) => [...String(document?.url || "").matchAll(/(?:_|-)(1|3|5|10)mm(?:_|-|\b)/gi)])
    .map((match) => Number(match[1]));
  const unique = [...new Set(matches)];
  return unique.length === 1 ? unique[0] : null;
}

async function selectMaterial(page, material) {
  if (!material.value) return null;
  const responseFor = (suffix) => page.waitForResponse((response) => {
    if (!response.url().includes(`/wmdrest/article/${suffix}`)) return false;
    try {
      const payload = JSON.parse(response.request().postData() || "{}");
      return String(payload.substrateId || "") === String(material.value);
    } catch {
      return false;
    }
  }, { timeout: 30_000 });
  const quantityResponse = responseFor("get-sorten-auflage");
  const templateResponse = responseFor("print-template");
  const priceResponse = responseFor("get-price");
  await page.$eval('#sorten, select[name="sorten"]', (select, value) => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, material.value);
  const [quantityOutcome, templateOutcome, priceOutcome] = await Promise.allSettled([
    quantityResponse,
    templateResponse,
    priceResponse,
  ]);
  const missingResponses = [
    ["get-sorten-auflage", quantityOutcome],
    ["print-template", templateOutcome],
    ["get-price", priceOutcome],
  ]
    .filter(([, outcome]) => outcome.status === "rejected")
    .map(([suffix]) => suffix);
  if (missingResponses.length) {
    throw new Error(
      `Supplier material response timeout for substrate ${material.value}: ${missingResponses.join(", ")}`
    );
  }
  const quantityResult = quantityOutcome.value;
  const templateResult = templateOutcome.value;
  const priceResult = priceOutcome.value;
  if (!quantityResult.ok() || !templateResult.ok() || !priceResult.ok()) {
    throw new Error(`Supplier material responses failed for substrate ${material.value}`);
  }
  const [quantityEvidence, templateEvidence, priceRefreshEvidence] = await Promise.all([
    buildSupplierResponseEvidence(quantityResult, "/wmdrest/article/get-sorten-auflage"),
    buildSupplierResponseEvidence(templateResult, "/wmdrest/article/print-template"),
    buildSupplierResponseEvidence(priceResult, "/wmdrest/article/get-price"),
  ]);
  const expectedTemplatePdfNames = Object.values(
    templateEvidence?.response?.data?.response || {}
  )
    .filter((value) => typeof value === "string" && /\.pdf(?:$|\?)/i.test(value))
    .map((value) => String(value).split(/[/?#]/).filter(Boolean).at(-1))
    .filter(Boolean)
    .sort();
  if (expectedTemplatePdfNames.length !== 2) {
    throw new Error(
      `Supplier print-template response returned ${expectedTemplatePdfNames.length} PDFs for substrate ${material.value}`
    );
  }
  await page.waitForFunction(({ value, expectedPdfNames }) => {
    const selected = document.querySelector('#sorten, select[name="sorten"]')?.value;
    const quantities = document.querySelectorAll('#wmd_shirt_auflage option, select[name="auflage"] option');
    const documentNames = [...document.querySelectorAll('a[href*=".pdf"]')]
      .map((anchor) => {
        try {
          return new URL(anchor.href, location.href).pathname.split("/").filter(Boolean).at(-1);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    return selected === value
      && quantities.length > 0
      && expectedPdfNames.every((name) => documentNames.includes(name));
  }, { value: material.value, expectedPdfNames: expectedTemplatePdfNames }, { timeout: 15_000 });
  return {
    quantityEvidence,
    templateEvidence,
    priceRefreshEvidence,
  };
}

async function readMaterialSnapshot(page, materialId, documents) {
  const fragments = await page.evaluate(() => ({
    selectedMaterialId: document.querySelector('#sorten, select[name="sorten"]')?.value || null,
    materialSelectHtml: document.querySelector('#sorten, select[name="sorten"]')?.outerHTML || "",
    quantitySelectHtml: document.querySelector('#wmd_shirt_auflage, select[name="auflage"]')?.outerHTML || "",
    documentLinkHtml: [...document.querySelectorAll('a[href*=".pdf"]')]
      .map((anchor) => anchor.outerHTML)
      .join("\n"),
  }));
  const documentUrls = documents.map((document) => document.url).sort();
  const snapshotPayload = {
    ...fragments,
    expectedMaterialId: materialId,
    documentUrls,
  };
  return {
    ...snapshotPayload,
    sha256: sha256Json(snapshotPayload),
    sanitized: true,
    excludesScriptsAndTokens: true,
    capturedAt: new Date().toISOString(),
  };
}

async function readDisplayedPrice(page) {
  return page.evaluate(() => {
    const rowText = [...document.querySelectorAll(".price-row")].map((row) =>
      (row.innerText || row.textContent || "").trim().replace(/\s+/g, " ")
    );
    const findRow = (label) => rowText.find((text) => text.toLowerCase().startsWith(label.toLowerCase())) || "";
    const moneyFrom = (text) => text.match(/-?\s*([0-9.]+,[0-9]{2})\s*EUR/i)?.[1] || null;
    return {
      base: document.querySelector(".base-price")?.textContent?.trim() || moneyFrom(findRow("Unser Preis")),
      discount: moneyFrom(findRow("Rabatt")),
      net: document.querySelector("#sticky-net-price")?.textContent?.trim()
        || document.querySelector(".net-price")?.textContent?.trim()
        || moneyFrom(findRow("Preis (netto)")),
      vat: moneyFrom(findRow("19% MwSt.")),
      gross: document.querySelector("#sticky-total-price")?.textContent?.trim()
        || document.querySelector(".gesamtpreis_brutto")?.textContent?.trim()
        || moneyFrom(findRow("Gesamtpreis")),
      shipping: moneyFrom(findRow("Versandkosten")),
      processing: moneyFrom(findRow("Verarbeitung")),
      weight: (document.body.innerText || "").match(/Gesamtgewicht\s+ca\.\s*([^\n]+?kg)/i)?.[1]?.trim() || null,
    };
  });
}

async function selectQuantityAndReadPrice(page, option, quantity) {
  // WMD's option label is the total net price for the selected quantity, not
  // a per-piece price. Treating it as a unit price makes every row time out.
  const expectedListPriceEur = optionTotalPrice(option.label);
  const observedGetPriceRequests = [];
  const observeGetPrice = (request) => {
    if (!request.url().includes("/wmdrest/article/get-price")) return;
    try {
      const payload = JSON.parse(request.postData() || "{}");
      observedGetPriceRequests.push({
        priceScaleId: payload.priceScaleId ?? null,
        quantity: payload.quantity ?? null,
        substrateId: payload.substrateId ?? null,
      });
    } catch {
      observedGetPriceRequests.push({ malformedPostData: true });
    }
  };
  page.on("request", observeGetPrice);
  const responsePromise = page.waitForResponse((response) => {
    if (!response.url().includes("/wmdrest/article/get-price")) return false;
    try {
      const payload = JSON.parse(response.request().postData() || "{}");
      return String(payload.priceScaleId || "") === String(option.value)
        && Number(payload.quantity) === quantity;
    } catch {
      return false;
    }
  }, { timeout: 30_000 });

  // Dispatch the supplier's native change event even for the already-selected
  // first quantity. Waiting for the matching get-price response avoids stale
  // DOM nodes and ties the captured price to this exact price-scale ID.
  let response;
  try {
    await page.selectOption('#wmd_shirt_auflage, select[name="auflage"]', option.value);
    response = await responsePromise;
  } catch (error) {
    throw new Error(
      `Supplier get-price response timeout for quantity ${quantity}, price scale ${option.value}; observed ${JSON.stringify(observedGetPriceRequests)}`,
      { cause: error }
    );
  } finally {
    page.off("request", observeGetPrice);
  }
  if (!response.ok()) {
    throw new Error(`Supplier get-price HTTP ${response.status()} for quantity ${quantity}`);
  }
  const requestPayload = JSON.parse(response.request().postData() || "{}");
  const payload = await response.json();
  const supplierPrice = payload?.data?.response;
  if (!supplierPrice || !Number.isFinite(Number(supplierPrice.price))) {
    throw new Error(`Invalid get-price response for quantity ${quantity}, price scale ${option.value}`);
  }
  if (String(supplierPrice.priceScaleId || "") !== String(option.value)) {
    throw new Error(`Supplier returned price scale ${supplierPrice.priceScaleId} instead of ${option.value}`);
  }
  if (supplierPrice.currency !== "EUR") {
    throw new Error(`Supplier returned unsupported currency ${supplierPrice.currency || "missing"}`);
  }

  const responseNetPrice = Number(supplierPrice.price);
  if (
    expectedListPriceEur !== null
    && Math.abs(responseNetPrice - expectedListPriceEur)
      > 0.02
  ) {
    throw new Error(
      `Supplier option total ${expectedListPriceEur} EUR does not match get-price response ${responseNetPrice} EUR`
    );
  }

  await page.waitForTimeout(80);
  const displayed = await readDisplayedPrice(page);
  const apiEvidence = buildSanitizedSupplierEvidence({
    endpoint: "/wmdrest/article/get-price",
    request: requestPayload,
    response: supplierPrice,
  });
  return {
    ...displayed,
    base: finiteNumberOrNull(supplierPrice.basePrice),
    discount: finiteNumberOrNull(supplierPrice.discountValue ?? supplierPrice.discount),
    net: responseNetPrice,
    vat: finiteNumberOrNull(supplierPrice.tax),
    gross: finiteNumberOrNull(supplierPrice.priceWithTax),
    shipping: finiteNumberOrNull(supplierPrice.shippingCost ?? supplierPrice.deliveryCharge),
    weight: supplierPrice.productWeight ? `${supplierPrice.productWeight} kg` : displayed.weight,
    priceScaleId: supplierPrice.priceScaleId,
    responseSource: "/wmdrest/article/get-price",
    additionalOptionsPricing: supplierPrice.mappedAdditionalOptions || {},
    apiEvidence,
  };
}

function summarizeAdditionalOptionPricing(mappedAdditionalOptions, controls) {
  const labelByField = new Map(
    (Array.isArray(controls) ? controls : []).map((control) => [String(control.fieldKey), control])
  );
  return Object.entries(mappedAdditionalOptions || {}).flatMap(([fieldKey, entries]) =>
    (Array.isArray(entries) ? entries : []).map((entry, entryIndex) => {
      const control = labelByField.get(String(fieldKey));
      const sortedChoices = Object.values(entry?.zusatzFeldValues || {})
        .sort((left, right) => Number(left?.sort ?? Number.POSITIVE_INFINITY) - Number(right?.sort ?? Number.POSITIVE_INFINITY));
      return {
        fieldKey: String(fieldKey),
        sourceOrder: control?.sourceOrder ?? entryIndex,
        labelOriginal: control?.labelOriginal || null,
        isClimateContribution: control?.isClimateContribution || false,
        supplierFieldId: entry?.zusatzfeldId || null,
        supplierOptionDescription: entry?.optionDescription || null,
        choiceRequiredWhenEnabled: Number(entry?.mandatory || 0) === 1,
        supplierMandatoryRaw: entry?.mandatory ?? null,
        choices: sortedChoices.map((choice, sourceOrder) => ({
          sourceId: choice?.id ?? null,
          labelOriginal: choice?.bezeichnung || null,
          sourceOrder,
          rawSort: finiteNumberOrNull(choice?.sort),
          supplierSalePriceEur: finiteNumberOrNull(choice?.upsell_sale_price),
          supplierPurchasePriceEur: finiteNumberOrNull(choice?.upsell_purchase_price),
          supplierSaleBasePriceEur: finiteNumberOrNull(choice?.upsell_base_price_sale),
          supplierPurchaseBasePriceEur: finiteNumberOrNull(choice?.upsell_base_price_purchase),
          supplierSalePercentage: finiteNumberOrNull(choice?.upsell_percentage),
          supplierMinimumSalePriceEur: finiteNumberOrNull(choice?.upsell_percental_min_price),
          supplierMinimumPurchasePriceEur: finiteNumberOrNull(choice?.upsell_percental_min_purchase_price),
          preselected: Number(choice?.is_preselected || 0) === 1,
        })),
      };
    })
  );
}

async function extractProduct(browser, product, args) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const page = await browser.newPage({ locale: "de-DE" });
    await restrictPageToSupplier(page);
    try {
      await page.goto(product.url, { waitUntil: "domcontentloaded", timeout: 90_000 });
      if (!isAllowedSourceUrl(page.url())) throw new Error(`Blocked product redirect: ${page.url()}`);
      await page.waitForSelector('select[name="auflage"]', { timeout: 30_000 });
      await page.waitForTimeout(450 + attempt * 200);
      const metadata = await readProductMetadata(page, product);
      const materials = metadata.materials.length ? metadata.materials : [{ value: null, label: "" }];
      const priceRows = [];
      const documentBindings = [];

      for (const [materialSourceOrder, material] of materials.entries()) {
        const parsedMaterialFacts = parseWmdSalesFolderMaterial(material.label);
        const materialResponseEvidence = await selectMaterial(page, material);
        const documents = await readCurrentDocuments(page);
        const materialSnapshot = await readMaterialSnapshot(page, material.value, documents);
        const inferredSpineDepthMm = inferSpineDepthFromDocuments(documents);
        const spineDepthMm = parsedMaterialFacts.spineDepthMm ?? inferredSpineDepthMm;
        const materialFacts = {
          ...parsedMaterialFacts,
          spineDepthMm,
          spineDepthSource: parsedMaterialFacts.spineDepthMm
            ? "material_label"
            : (inferredSpineDepthMm ? "supplier_document_filename" : null),
          classified: parsedMaterialFacts.paperKey !== null && spineDepthMm !== null,
          unclassifiedDimensions: [
            ...(parsedMaterialFacts.paperKey === null ? ["paper"] : []),
            ...(spineDepthMm === null ? ["spineDepthMm"] : []),
          ],
        };
        const documentBinding = {
          sourceUrl: metadata.url,
          productSourceOrder: metadata.sourceOrder,
          sourceProductId: metadata.productId,
          sourceSku: metadata.sku,
          classification: metadata.classification,
          materialId: material.value,
          materialSourceOrder,
          materialLabel: material.label,
          materialFacts,
          documents,
          materialSnapshot,
          materialResponseEvidence,
          additionalOptions: [],
          capturedAt: new Date().toISOString(),
        };

        let quantities = await page.$$eval(
          '#wmd_shirt_auflage option, select[name="auflage"] option',
          (options) => options.map((option) => ({
            value: option.value,
            label: (option.textContent || "").trim(),
          }))
        );
        quantities = quantities.filter((option) => parseQuantity(option.label));
        if (args.maxQuantities !== null) quantities = quantities.slice(0, args.maxQuantities);

        for (const [quantitySourceOrder, option] of quantities.entries()) {
          const quantity = parseQuantity(option.label);
          const middleQuantitySourceOrder = Math.floor((quantities.length - 1) / 2);
          const verifyWithApi = args.priceVerification === "full"
            || quantitySourceOrder === 0
            || quantitySourceOrder === middleQuantitySourceOrder
            || quantitySourceOrder === quantities.length - 1;
          const labelTotalEur = optionTotalPrice(option.label);
          if (labelTotalEur === null) {
            throw new Error(`No supplier total in quantity label: ${option.label}`);
          }
          const price = verifyWithApi
            ? await selectQuantityAndReadPrice(page, option, quantity)
            : {
              base: labelTotalEur,
              discount: null,
              net: labelTotalEur,
              vat: null,
              gross: null,
              shipping: null,
              processing: null,
              weight: null,
              priceScaleId: option.value,
              responseSource: "supplier_quantity_option_label",
              additionalOptionsPricing: {},
            };
          if (quantitySourceOrder === 0) {
            documentBinding.additionalOptions = summarizeAdditionalOptionPricing(
              price.additionalOptionsPricing,
              metadata.additionalOptionControls
            );
            const visibleOptionKeys = metadata.additionalOptionControls
              .filter((control) => !control.isClimateContribution)
              .map((control) => String(control.fieldKey));
            const apiOptionKeys = documentBinding.additionalOptions.map((optionItem) => String(optionItem.fieldKey));
            const choiceInventoryIssues = documentBinding.additionalOptions.flatMap((optionItem) => {
              if (!Array.isArray(optionItem.choices) || !optionItem.choices.length) {
                return [`${optionItem.fieldKey}:missing_choices`];
              }
              return optionItem.choices.flatMap((choice) => {
                const hasPricingEvidence = [
                  choice.supplierSalePriceEur,
                  choice.supplierSaleBasePriceEur,
                  choice.supplierSalePercentage,
                  choice.supplierMinimumSalePriceEur,
                ].some((value) => value !== null);
                return choice.sourceId !== null && choice.labelOriginal && hasPricingEvidence
                  ? []
                  : [`${optionItem.fieldKey}:${choice.sourceId ?? "missing_id"}:incomplete_choice`];
              });
            });
            const missingFromApi = visibleOptionKeys.filter((key) => !apiOptionKeys.includes(key));
            const unexpectedFromApi = apiOptionKeys.filter((key) => !visibleOptionKeys.includes(key));
            documentBinding.additionalOptionCoverage = {
              visibleOptionKeys,
              apiOptionKeys,
              missingFromApi,
              unexpectedFromApi,
              choiceInventoryIssues,
              // The get-price API can expose valid material-specific add-ons that
              // are not rendered as static checkboxes on initial page load (for
              // example field 41 on the A6 folder family). Keep those API-only
              // fields in the evidence inventory; only a visible field missing
              // from the authoritative response is a coverage failure.
              apiExtendedInventory: unexpectedFromApi.length > 0,
              fieldInventoryComplete: missingFromApi.length === 0,
              choiceInventoryComplete: choiceInventoryIssues.length === 0,
              combinationPricingVerified: false,
              eligibleForImport: false,
            };
          }
          const supplierNetPriceEur = parseGermanMoney(price.net);
          if (supplierNetPriceEur === null) {
            throw new Error(`No net price for ${metadata.url}, material ${material.label}, quantity ${quantity}`);
          }
          priceRows.push({
            sourceUrl: metadata.url,
            sourceProductId: metadata.productId,
            sourceSku: metadata.sku,
            sourceTitle: metadata.name,
            productSourceOrder: metadata.sourceOrder,
            branchKey: metadata.branchKey,
            listingTitle: metadata.listingTitle,
            classification: metadata.classification,
            materialId: material.value,
            materialSourceOrder,
            materialLabel: material.label,
            materialFacts,
            spineDepthMm,
            quantityOptionId: option.value,
            quantitySourceOrder,
            quantityPriceLabel: option.label,
            quantity,
            supplierListPriceEur: parseGermanMoney(price.base),
            supplierDiscountEur: parseGermanMoney(price.discount),
            supplierNetPriceEur,
            totalEur: supplierNetPriceEur,
            currency: "EUR",
            supplierVatEur: parseGermanMoney(price.vat),
            supplierGrossPriceEur: parseGermanMoney(price.gross),
            supplierShippingEur: parseGermanMoney(price.shipping),
            supplierProcessingEur: parseGermanMoney(price.processing),
            weight: price.weight,
            supplierPriceEvidence: {
              endpoint: price.responseSource,
              priceScaleId: price.priceScaleId,
              optionTotalEur: labelTotalEur,
              apiVerified: verifyWithApi,
            },
            supplierApiEvidence: price.apiEvidence || null,
            commercialTreatment: {
              supplierCurrency: "EUR",
              supplierVatState: "excluded",
              supplierVatRatePercent: price.apiEvidence?.response?.taxInPercentage ?? null,
              supplierShippingEur: parseGermanMoney(price.shipping),
              supplierProcessingEur: parseGermanMoney(price.processing),
              priceIncludesOptionalAddOns: false,
            },
            capturedAt: new Date().toISOString(),
          });
        }
        documentBindings.push(documentBinding);
      }
      if (!priceRows.length) throw new Error(`No price rows extracted for ${metadata.url}`);
      if (
        !documentBindings.length
        || documentBindings.some((binding) => (
          binding.documents.length !== 2
          || binding.documents.filter((document) => document.role === "guide").length !== 1
          || binding.documents.filter((document) => document.role === "template").length !== 1
          || binding.documents.some((document) => document.role === "unknown")
        ))
      ) {
        throw new Error(`Incomplete guide/template document coverage for ${metadata.url}`);
      }
      const incompleteAdditionalOptionCoverage = documentBindings
        .filter((binding) => (
          binding.additionalOptionCoverage?.fieldInventoryComplete === false
          || binding.additionalOptionCoverage?.choiceInventoryComplete === false
        ))
        .map((binding) => ({
          materialId: binding.materialId,
          missingFromApi: binding.additionalOptionCoverage?.missingFromApi || [],
          unexpectedFromApi: binding.additionalOptionCoverage?.unexpectedFromApi || [],
          choiceInventoryIssues: binding.additionalOptionCoverage?.choiceInventoryIssues || [],
        }));
      if (incompleteAdditionalOptionCoverage.length) {
        throw new Error(
          `Visible additional-option inventory does not reconcile with supplier API for ${metadata.url}: ${JSON.stringify(incompleteAdditionalOptionCoverage)}`
        );
      }
      metadata.extraction = {
        version: EXTRACTOR_VERSION,
        materialCount: materials.length,
        priceRowsCount: priceRows.length,
        documentBindingsCount: documentBindings.length,
        maxQuantitiesApplied: args.maxQuantities,
        priceVerification: args.priceVerification,
      };
      return { metadata, priceRows, documentBindings, error: null };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await page.waitForTimeout(attempt * 750).catch(() => {});
    } finally {
      await page.close().catch(() => {});
    }
  }
  return {
    metadata: { ...product },
    priceRows: [],
    documentBindings: [],
    error: lastError instanceof Error ? lastError.message : String(lastError),
  };
}

function buildReview({
  catalog,
  rawRows,
  normalizedRows,
  documentBindings,
  coverage,
  discovery,
  runScope,
  evidenceAudit,
  unresolvedFailures,
}) {
  const successful = catalog.filter((item) => !item.error);
  const failed = catalog.filter((item) => item.error);
  const distinct = (values) => [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))];
  const additionalOptionLabels = distinct(
    catalog.flatMap((item) => (item.additionalOptionControls || []))
      .filter((item) => !item.isClimateContribution)
      .map((item) => item.labelOriginal)
  );
  const lines = [
    "# WIRmachenDRUCK salgsmapper - lokal udtræksrapport",
    "",
    "## Status",
    "",
    "- Tilstand: `extracted` (lokal, skrivebeskyttet importpakke).",
    `- Delvist smoke-udtræk: ${runScope.partial ? "ja - må ikke bruges til import" : "nej"}.`,
    `- Klar til manuel udtræksreview: ${!runScope.partial && evidenceAudit.every((item) => item.eligibleForReview) ? "ja" : "nej"}.`,
    "- Klar til import: nej. Add-on-priser, PDF-filer/lag og alle skrive-/publiceringsporte er fortsat blokeret.",
    `- Kørte argumenter: ${JSON.stringify(runScope.args)}.`,
    "- Ingen Supplier Bank-, produkt-, pris-, template- eller publiceringsskrivninger er udført.",
    `- Kilde: ${SOURCE_CATEGORY_URL}`,
    `- Kategorisider fundet: ${discovery.categories.length}`,
    `- Produktkonfiguratorer fundet: ${discovery.products.length}`,
    `- Produktkonfiguratorer udtrukket: ${successful.length}`,
    `- Leverandørpriser udtrukket: ${rawRows.length}`,
    `- Prisrækker verificeret mod leverandørens get-price API: ${rawRows.filter((row) => row.supplierPriceEvidence?.apiVerified).length}`,
    `- Øvrige prisrækker læst direkte fra leverandørens officielle mængdevalg: ${rawRows.filter((row) => !row.supplierPriceEvidence?.apiVerified).length}`,
    `- Dokumentbindinger registreret: ${documentBindings.length}`,
    `- Ekstra folderfunktioner registreret: ${additionalOptionLabels.length}`,
    `- DKK-preview: ${normalizedRows.length} rækker med \`${CONVERSION_RULE}\`.`,
    "",
    "## Faktiske valgmuligheder (ingen kunstig kartesisk udfyldning)",
    "",
    `- Tryk: ${distinct(normalizedRows.map((row) => row.printLabelDa)).join(", ") || "ikke udtrukket"}`,
    `- Formater: ${distinct(normalizedRows.map((row) => row.formatLabelDa)).join(", ") || "ikke udtrukket"}`,
    `- Konstruktioner: ${distinct(normalizedRows.map((row) => row.constructionLabelDa)).join(", ") || "ikke udtrukket"}`,
    `- Ryg/lommedybde: ${distinct(normalizedRows.map((row) => row.spineDepthMm)).sort((a, b) => a - b).map((value) => `${value} mm`).join(", ") || "ikke udtrukket"}`,
    `- Papirer: ${distinct(normalizedRows.map((row) => row.paperLabelDa)).join(", ") || "ikke udtrukket"}`,
    `- Efterbehandlinger: ${distinct(normalizedRows.map((row) => row.finishLabelDa)).join(", ") || "ikke udtrukket"}`,
    `- Antal: ${distinct(normalizedRows.map((row) => row.quantity)).sort((a, b) => a - b).join(", ") || "ikke udtrukket"}`,
    "",
    "## Ekstra folderfunktioner",
    "",
    `- Registreret hos leverandøren: ${additionalOptionLabels.join(", ") || "ingen"}`,
    "- De udtrukne matrixpriser er basispriser uden disse tilvalg. Tilvalgene er bevaret separat med leverandørens undervalg og enhedspriser; de må ikke markeres som inkluderet uden en særskilt pris-/produktbeslutning.",
    "- Tilvalgsinventaret er ikke det samme som verificerede kombinationstotaler. Derfor er tilvalg endnu ikke importklare.",
    "",
    "## Dokumentgrænse",
    "",
    "PDF-links er registreret pr. leverandørvalg. De må først bindes i Designer efter download, hash-kontrol, dimensions-/lagkontrol, visuel kontrol og verificeret ikke-printende overlay.",
    "",
    "## Dækningskontrol",
    "",
    "```json",
    JSON.stringify(coverage, null, 2),
    "```",
    "",
  ];

  if (failed.length || unresolvedFailures.length) {
    lines.push("## Fejl til genkørsel", "");
    for (const item of failed) lines.push(`- ${item.url}: ${item.error}`);
    for (const item of unresolvedFailures) {
      if (!failed.some((failedItem) => failedItem.url === item.sourceUrl)) {
        lines.push(`- ${item.sourceUrl}: ${item.currentRunFailure} (tidligere evidens blev bevaret, men opfylder ikke dette runs krav)`);
      }
    }
    lines.push("");
  }

  lines.push(
    "## Næste godkendelsespunkt",
    "",
    "Gennemgå først familie, valgrækkefølge, sparse kombinationer, priser og dokumentdækning. Supplier Bank, produktkladde/live priser og publicering er separate efterfølgende godkendelser.",
    ""
  );
  return lines.join("\n");
}

function isValidRetainedPriceRow(row) {
  if (!isAllowedSourceUrl(row?.sourceUrl)) return false;
  if (row?.currency !== "EUR") return false;
  if (!Number.isInteger(row?.quantity) || row.quantity <= 0) return false;
  if (!Number.isFinite(row?.totalEur) || row.totalEur <= 0) return false;
  const evidence = row?.supplierPriceEvidence;
  if (!evidence || typeof evidence.apiVerified !== "boolean" || !evidence.priceScaleId) return false;
  if (!Number.isFinite(evidence.optionTotalEur) || Math.abs(evidence.optionTotalEur - row.totalEur) > 0.02) {
    return false;
  }
  const parsedLabel = parseWmdSalesFolderQuantityPrice(row.quantityPriceLabel);
  if (
    !parsedLabel
    || parsedLabel.quantity !== row.quantity
    || Math.abs(parsedLabel.totalEur - row.totalEur) > 0.02
  ) return false;
  if (evidence.apiVerified) {
    const api = row?.supplierApiEvidence;
    if (!api || api.endpoint !== "/wmdrest/article/get-price" || !/^[0-9a-f]{64}$/i.test(api.sha256 || "")) {
      return false;
    }
    if (sha256Json({ request: api.request, response: api.response }) !== api.sha256) return false;
    if (String(api.request?.priceScaleId || "") !== String(evidence.priceScaleId)) return false;
    if (String(api.response?.priceScaleId || "") !== String(evidence.priceScaleId)) return false;
    if (String(row.quantityOptionId || "") !== String(evidence.priceScaleId)) return false;
    if (Number(api.request?.quantity) !== row.quantity) return false;
    if (String(api.request?.substrateId || "") !== String(row.materialId || "")) return false;
    if (String(api.request?.articleId || "") !== String(row.sourceProductId || "")) return false;
    if (!Number.isFinite(Number(api.response?.price))) return false;
    if (Math.abs(Number(api.response.price) - row.totalEur) > 0.02) return false;
    if (api.response?.currency !== "EUR") return false;
  } else if (evidence.endpoint !== "supplier_quantity_option_label") {
    return false;
  }
  return row?.commercialTreatment?.supplierVatState === "excluded";
}

function isValidSupplierResponseEvidence(evidence, expectedEndpoint, materialId) {
  if (!evidence || evidence.endpoint !== expectedEndpoint) return false;
  if (!evidence.sanitized || !/^[0-9a-f]{64}$/i.test(evidence.sha256 || "")) return false;
  if (sha256Json({ request: evidence.request, response: evidence.response }) !== evidence.sha256) return false;
  if (String(evidence.request?.substrateId || "") !== String(materialId || "")) return false;
  return true;
}

function isValidRetainedDocumentBinding(binding) {
  if (!isAllowedSourceUrl(binding?.sourceUrl) || !binding?.materialId) return false;
  const documents = Array.isArray(binding.documents) ? binding.documents : [];
  if (documents.length !== 2) return false;
  if (documents.filter((document) => document.role === "guide").length !== 1) return false;
  if (documents.filter((document) => document.role === "template").length !== 1) return false;
  if (documents.some((document) => document.role === "unknown")) return false;
  if (documents.some((document) => !isAllowedSourceUrl(document.url))) return false;
  const snapshot = binding.materialSnapshot;
  if (!snapshot?.sanitized || !/^[0-9a-f]{64}$/i.test(snapshot.sha256 || "")) return false;
  const snapshotPayload = {
    selectedMaterialId: snapshot.selectedMaterialId,
    materialSelectHtml: snapshot.materialSelectHtml,
    quantitySelectHtml: snapshot.quantitySelectHtml,
    documentLinkHtml: snapshot.documentLinkHtml,
    expectedMaterialId: snapshot.expectedMaterialId,
    documentUrls: snapshot.documentUrls,
  };
  if (sha256Json(snapshotPayload) !== snapshot.sha256) return false;
  if (String(snapshot.selectedMaterialId || "") !== String(binding.materialId)) return false;
  if (String(snapshot.expectedMaterialId || "") !== String(binding.materialId)) return false;
  const expectedDocumentUrls = documents.map((document) => document.url).sort();
  if (JSON.stringify(snapshot.documentUrls) !== JSON.stringify(expectedDocumentUrls)) return false;
  const responseEvidence = binding.materialResponseEvidence;
  if (!isValidSupplierResponseEvidence(
    responseEvidence?.quantityEvidence,
    "/wmdrest/article/get-sorten-auflage",
    binding.materialId
  )) return false;
  if (!isValidSupplierResponseEvidence(
    responseEvidence?.templateEvidence,
    "/wmdrest/article/print-template",
    binding.materialId
  )) return false;
  if (!isValidSupplierResponseEvidence(
    responseEvidence?.priceRefreshEvidence,
    "/wmdrest/article/get-price",
    binding.materialId
  )) return false;
  const optionCoverage = binding.additionalOptionCoverage;
  if (optionCoverage) {
    if (!optionCoverage.fieldInventoryComplete || !optionCoverage.choiceInventoryComplete) return false;
    if (optionCoverage.eligibleForImport !== false) return false;
  }
  return true;
}

function hasValidRetainedProductEvidence(product, priceRows, documentBindings) {
  const expected = product?.extraction;
  if (!expected || expected.version !== EXTRACTOR_VERSION) return false;
  if (!product?.pageSnapshot?.sanitized || !/^[0-9a-f]{64}$/i.test(product.pageSnapshot.sha256 || "")) {
    return false;
  }
  if (sha256Json(product.pageSnapshot.fragments) !== product.pageSnapshot.sha256) return false;
  if (priceRows.length !== expected.priceRowsCount || !priceRows.every(isValidRetainedPriceRow)) return false;
  if (
    documentBindings.length !== expected.documentBindingsCount
    || !documentBindings.every(isValidRetainedDocumentBinding)
  ) return false;
  const documentByMaterialId = new Map(
    documentBindings.map((binding) => [String(binding.materialId), binding])
  );
  if (!priceRows.every((row) => {
    const binding = documentByMaterialId.get(String(row.materialId));
    const quantityHtml = binding?.materialSnapshot?.quantitySelectHtml || "";
    return quantityHtml.includes(`value="${row.quantityOptionId}"`)
      && quantityHtml.includes(row.quantityPriceLabel);
  })) return false;
  return true;
}

function extractionMeetsRequestedScope(product, args) {
  const extraction = product?.extraction;
  if (!extraction || extraction.version !== EXTRACTOR_VERSION) return false;
  const quantityCoverageSufficient = args.maxQuantities === null
    ? extraction.maxQuantitiesApplied === null
    : (
      extraction.maxQuantitiesApplied === null
      || Number(extraction.maxQuantitiesApplied) >= args.maxQuantities
    );
  const verificationRank = { boundary: 1, full: 2 };
  const verificationSufficient = (verificationRank[extraction.priceVerification] || 0)
    >= verificationRank[args.priceVerification];
  return quantityCoverageSufficient && verificationSufficient;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const runDirectory = path.resolve(args.output || defaultRunDirectory());
  if (!args.resume) {
    try {
      const existingEntries = await fs.readdir(runDirectory);
      if (existingEntries.length) {
        throw new Error(`Refusing to overwrite nonempty run directory without --resume: ${runDirectory}`);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  const rawDirectory = path.join(runDirectory, "raw");
  const normalizedDirectory = path.join(runDirectory, "normalized");
  const reviewDirectory = path.join(runDirectory, "review");
  await Promise.all([
    fs.mkdir(rawDirectory, { recursive: true }),
    fs.mkdir(normalizedDirectory, { recursive: true }),
    fs.mkdir(reviewDirectory, { recursive: true }),
  ]);

  const lockPath = path.join(runDirectory, ".extractor.lock");
  let lockHandle;
  try {
    lockHandle = await fs.open(lockPath, "wx");
    await lockHandle.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(`Another extractor may be using this run directory: ${lockPath}`);
    }
    throw error;
  }
  let lockReleased = false;
  const releaseLock = async () => {
    if (lockReleased) return;
    lockReleased = true;
    await lockHandle?.close().catch(() => {});
    await fs.unlink(lockPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  };
  const handleSignal = () => {
    releaseLock().finally(() => process.exit(130));
  };
  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);

  const discoveryPath = path.join(runDirectory, "discovery.json");
  const catalogPath = path.join(rawDirectory, "catalog.json");
  const rawPricingPath = path.join(rawDirectory, "pricing.jsonl");
  const rawDocumentsPath = path.join(rawDirectory, "document-bindings.jsonl");
  const retryFailuresPath = path.join(rawDirectory, "retry-failures.jsonl");

  let browser = null;
  let discovery;
  try {
    browser = await chromium.launch({ headless: true });
    discovery = args.resume
      ? await readJsonIfPresent(discoveryPath, null)
      : null;
    if (discovery) validateDiscoverySnapshot(discovery);
    if (!discovery?.products?.length) {
      const discovered = await discoverCatalog(browser);
      discovery = {
        state: "extracted",
        sourceCategoryUrl: SOURCE_CATEGORY_URL,
        allowedHosts: [ALLOWED_HOST],
        capturedAt: new Date().toISOString(),
        conversionRule: CONVERSION_RULE,
        extractorVersion: EXTRACTOR_VERSION,
        supplierBankWritten: false,
        productDraftWritten: false,
        pricingWritten: false,
        templatesWritten: false,
        published: false,
        branches: PRINT_BRANCHES,
        ...discovered,
      };
      validateDiscoverySnapshot(discovery);
      await writeJson(discoveryPath, discovery);
    }

    if (args.discoveryOnly) {
      console.log(`Run directory: ${runDirectory}`);
      console.log(`Discovered products: ${discovery.products.length}`);
      console.log("Discovery only; no product pages, prices, PDFs, database records, or publishing were changed.");
      return;
    }

    const selectedProducts = args.maxProducts === null
      ? discovery.products
      : discovery.products.slice(0, args.maxProducts);
    const runScope = {
      partial: args.maxProducts !== null || args.maxQuantities !== null,
      args: {
        concurrency: args.concurrency,
        maxProducts: args.maxProducts,
        maxQuantities: args.maxQuantities,
        priceVerification: args.priceVerification,
        resume: args.resume,
      },
      selectedProductCount: selectedProducts.length,
      fullDiscoveredProductCount: discovery.products.length,
    };
    const selectedProductUrls = new Set(selectedProducts.map((product) => product.url));
    const existingCatalog = args.resume ? await readJsonIfPresent(catalogPath, []) : [];
    const existingRawRows = args.resume ? await readJsonlIfPresent(rawPricingPath) : [];
    const existingDocuments = args.resume ? await readJsonlIfPresent(rawDocumentsPath) : [];
    let retryFailures = args.resume ? await readJsonlIfPresent(retryFailuresPath) : [];
    const outOfScopeUrls = new Set([
      ...existingCatalog.map((item) => item.url),
      ...existingRawRows.map((item) => item.sourceUrl),
      ...existingDocuments.map((item) => item.sourceUrl),
    ].filter((url) => url && !selectedProductUrls.has(url)));
    if (outOfScopeUrls.size) {
      throw new Error(
        `Refusing to shrink a resumed extraction scope; ${outOfScopeUrls.size} existing product URL(s) are outside the requested scope`
      );
    }
    const existingByUrl = new Map(existingCatalog.map((item) => [item.url, item]));
    const existingPricesByUrl = existingRawRows.reduce(
      (groups, row) => groups.set(row.sourceUrl, [...(groups.get(row.sourceUrl) || []), row]),
      new Map()
    );
    const existingDocumentsByUrl = existingDocuments
      .reduce(
        (groups, row) => groups.set(row.sourceUrl, [...(groups.get(row.sourceUrl) || []), row]),
        new Map()
      );
    const resolvedRetainedSourceUrls = new Set(existingCatalog.flatMap((retainedProduct) => {
      const sourceUrl = retainedProduct?.url;
      if (!sourceUrl) return [];
      return hasValidRetainedProductEvidence(
        retainedProduct,
        existingPricesByUrl.get(sourceUrl) || [],
        existingDocumentsByUrl.get(sourceUrl) || []
      ) ? [sourceUrl] : [];
    }));
    retryFailures = pruneWmdSalesFolderRetryFailures(retryFailures, resolvedRetainedSourceUrls);
    const productsToExtract = args.resume
      ? selectedProducts.filter((product) => {
        const existing = existingByUrl.get(product.url);
        const expected = existing?.extraction;
        const expandsQuantityCoverage = args.maxQuantities === null
          ? expected?.maxQuantitiesApplied !== null
          : (
            expected?.maxQuantitiesApplied !== null
            && Number(expected?.maxQuantitiesApplied || 0) < args.maxQuantities
          );
        const verificationRank = { boundary: 1, full: 2 };
        const expandsPriceVerification = (verificationRank[expected?.priceVerification] || 0)
          < verificationRank[args.priceVerification];
        return (
          !existing
          || existing.error
          || !expected
          || expected.version !== EXTRACTOR_VERSION
          || !hasValidRetainedProductEvidence(
            existing,
            existingPricesByUrl.get(product.url) || [],
            existingDocumentsByUrl.get(product.url) || []
          )
          || expandsQuantityCoverage
          || expandsPriceVerification
        );
      })
      : selectedProducts;
    const completed = new Map(existingCatalog.map((item) => [item.url, item]));
    let rawRows = [...existingRawRows];
    let documentBindings = [...existingDocuments];
    const unresolvedCurrentRunFailures = new Map();
    let nextIndex = 0;
    let persistQueue = Promise.resolve();
    let resultsSinceCheckpoint = 0;

    const queueCheckpoint = ({ force = false } = {}) => {
      if (!force && resultsSinceCheckpoint < CHECKPOINT_BATCH_SIZE) return persistQueue;
      resultsSinceCheckpoint = 0;
      const catalogSnapshot = selectedProducts.map((product) => completed.get(product.url) || {
        ...product,
        error: "Missing from extraction snapshot",
      });
      const pricingSnapshot = rawRows;
      const documentSnapshot = documentBindings;
      const retryFailureSnapshot = [...retryFailures];
      persistQueue = persistQueue.then(() => Promise.all([
        writeJson(catalogPath, catalogSnapshot),
        writeJsonl(rawPricingPath, pricingSnapshot),
        writeJsonl(rawDocumentsPath, documentSnapshot),
        writeJsonl(retryFailuresPath, retryFailureSnapshot),
      ]));
      return persistQueue;
    };

    const persist = (retriedUrl, result) => {
      if (result.error) {
        unresolvedCurrentRunFailures.set(retriedUrl, result.error);
        retryFailures.push({
          sourceUrl: retriedUrl,
          error: result.error,
          attemptedAt: new Date().toISOString(),
          preservedPriorEvidence: rawRows.some((row) => row.sourceUrl === retriedUrl)
            && documentBindings.some((row) => row.sourceUrl === retriedUrl),
        });
        const existing = completed.get(retriedUrl);
        if (!existing || existing.error) {
          completed.set(retriedUrl, { ...result.metadata, error: result.error });
        }
      } else {
        unresolvedCurrentRunFailures.delete(retriedUrl);
        retryFailures = pruneWmdSalesFolderRetryFailures(retryFailures, [retriedUrl]);
        completed.set(retriedUrl, { ...result.metadata, error: null });
        rawRows = [
          ...rawRows.filter((row) => row.sourceUrl !== retriedUrl),
          ...result.priceRows,
        ];
        documentBindings = [
          ...documentBindings.filter((row) => row.sourceUrl !== retriedUrl),
          ...result.documentBindings,
        ];
      }
      resultsSinceCheckpoint += 1;
      return queueCheckpoint({ force: Boolean(result.error) });
    };

    const worker = async () => {
      while (nextIndex < productsToExtract.length) {
        const index = nextIndex++;
        const product = productsToExtract[index];
        const result = await extractProduct(browser, product, args);
        await persist(product.url, result);
        console.log(`${result.error ? "FAILED" : "OK"} ${index + 1}/${productsToExtract.length} ${product.branchKey} ${result.priceRows.length} prices ${result.documentBindings.length} document selections`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(args.concurrency, Math.max(1, productsToExtract.length)) }, worker));
    await queueCheckpoint({ force: true });
    await persistQueue;

    const catalog = selectedProducts.map((product) => completed.get(product.url) || {
      ...product,
      error: "Missing from extraction snapshot",
    });
    const normalized = normalizeWmdSalesFolderRows(rawRows);
    const orderedNormalizedRows = sortWmdSalesFolderRows(normalized.rows).map((row, sourceOrder) => ({
      sourceOrder,
      ...row,
      supplierPrice: row.totalEur,
      ...applyConversionRule(row.totalEur, CONVERSION_RULE),
      conversionRule: CONVERSION_RULE,
    }));
    const coverage = normalized.coverage;
    const optionCatalog = buildWmdSalesFolderOptionCatalog(orderedNormalizedRows);
    const finalPricesByUrl = rawRows.reduce(
      (groups, row) => groups.set(row.sourceUrl, [...(groups.get(row.sourceUrl) || []), row]),
      new Map()
    );
    const finalDocumentsByUrl = documentBindings.reduce(
      (groups, binding) => groups.set(binding.sourceUrl, [...(groups.get(binding.sourceUrl) || []), binding]),
      new Map()
    );
    const evidenceAudit = catalog.map((product) => {
      const evidenceValid = hasValidRetainedProductEvidence(
        product,
        finalPricesByUrl.get(product.url) || [],
        finalDocumentsByUrl.get(product.url) || []
      );
      const requestedScopeSatisfied = extractionMeetsRequestedScope(product, args);
      const currentRunFailure = unresolvedCurrentRunFailures.get(product.url) || null;
      return {
        sourceUrl: product.url,
        evidenceValid,
        requestedScopeSatisfied,
        currentRunFailure,
        eligibleForReview: !product.error
          && evidenceValid
          && requestedScopeSatisfied
          && !currentRunFailure,
      };
    });
    const unresolvedFailures = evidenceAudit.filter((item) => item.currentRunFailure);
    const eligibleForReview = !runScope.partial
      && evidenceAudit.every((item) => item.eligibleForReview)
      && normalized.coverage.unclassifiedRows === 0
      && normalized.coverage.priceEvidenceMismatchRows === 0
      && normalized.coverage.duplicateSelectionQuantityKeys.length === 0;
    const additionalOptionBindings = documentBindings
      .filter((binding) => Array.isArray(binding.additionalOptions) && binding.additionalOptions.length)
      .map((binding) => ({
        sourceUrl: binding.sourceUrl,
        productSourceOrder: binding.productSourceOrder,
        materialId: binding.materialId,
        materialSourceOrder: binding.materialSourceOrder,
        materialLabel: binding.materialLabel,
        spineDepthMm: binding.materialFacts?.spineDepthMm ?? null,
        additionalOptions: binding.additionalOptions,
        additionalOptionCoverage: binding.additionalOptionCoverage,
        capturedAt: binding.capturedAt,
      }));
    const apiEvidenceRows = rawRows
      .filter((row) => row.supplierApiEvidence)
      .map((row) => ({
        sourceUrl: row.sourceUrl,
        sourceProductId: row.sourceProductId,
        materialId: row.materialId,
        quantityOptionId: row.quantityOptionId,
        quantity: row.quantity,
        evidence: row.supplierApiEvidence,
      }));
    const pageSnapshotRows = catalog
      .filter((product) => product.pageSnapshot)
      .map((product) => ({
        sourceUrl: product.url,
        sourceProductId: product.productId,
        snapshot: product.pageSnapshot,
      }));
    const materialEvidenceRows = documentBindings.map((binding) => ({
      sourceUrl: binding.sourceUrl,
      sourceProductId: binding.sourceProductId,
      materialId: binding.materialId,
      materialLabel: binding.materialLabel,
      snapshot: binding.materialSnapshot,
      supplierResponses: binding.materialResponseEvidence,
    }));
    await Promise.all([
      writeJsonl(path.join(normalizedDirectory, "pricing-preview.jsonl"), orderedNormalizedRows),
      writeJsonl(path.join(rawDirectory, "additional-option-bindings.jsonl"), additionalOptionBindings),
      writeJsonl(path.join(rawDirectory, "api-evidence.jsonl"), apiEvidenceRows),
      writeJsonl(path.join(rawDirectory, "page-snapshots.jsonl"), pageSnapshotRows),
      writeJsonl(path.join(rawDirectory, "material-evidence.jsonl"), materialEvidenceRows),
      writeJson(path.join(normalizedDirectory, "coverage.json"), coverage),
      writeJson(path.join(normalizedDirectory, "options.json"), optionCatalog),
      writeJson(path.join(reviewDirectory, "evidence-audit.json"), evidenceAudit),
      writeJson(path.join(reviewDirectory, "extraction-summary.json"), {
        state: "extracted",
        partial: runScope.partial,
        eligibleForReview,
        eligibleForImport: false,
        importBlockers: [
          "Supplier Bank review and write approval are pending",
          "Optional add-on combination pricing is not verified",
          "PDF bytes, hashes, dimensions, layers, visual output, and non-printing Designer overlay are not yet verified",
          "Product draft, price write, template write, and publication gates are pending",
        ],
        runScope,
        sourceCategoryUrl: SOURCE_CATEGORY_URL,
        conversionRule: CONVERSION_RULE,
        catalogProducts: catalog.length,
        successfulProducts: catalog.filter((item) => !item.error).length,
        failedProducts: catalog.filter((item) => item.error).length,
        unresolvedCurrentRunFailures: unresolvedFailures.length,
        rawPriceRows: rawRows.length,
        normalizedPriceRows: orderedNormalizedRows.length,
        documentBindings: documentBindings.length,
        parserCoverage: normalized.coverage,
        evidenceAuditPassedProducts: evidenceAudit.filter((item) => item.eligibleForReview).length,
        addOnInventoryExtracted: true,
        addOnCombinationPricingVerified: false,
        pdfLinksExtracted: true,
        pdfFilesDownloadedAndVerified: false,
        supplierBankWritten: false,
        productDraftWritten: false,
        pricingWritten: false,
        templatesWritten: false,
        published: false,
      }),
      fs.writeFile(path.join(reviewDirectory, "report.md"), buildReview({
        catalog,
        rawRows,
        normalizedRows: orderedNormalizedRows,
        documentBindings,
        coverage,
        discovery,
        runScope,
        evidenceAudit,
        unresolvedFailures,
      }), "utf8"),
    ]);

    console.log(`Run directory: ${runDirectory}`);
    console.log(`Successful products: ${catalog.filter((item) => !item.error).length}/${catalog.length}`);
    console.log(`Raw price rows: ${rawRows.length}`);
    console.log(`Document selections: ${documentBindings.length}`);
    console.log("No Supplier Bank, product, pricing, template, or publishing writes were performed.");
  } finally {
    process.off("SIGINT", handleSignal);
    process.off("SIGTERM", handleSignal);
    await browser?.close().catch(() => {});
    await releaseLock();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
