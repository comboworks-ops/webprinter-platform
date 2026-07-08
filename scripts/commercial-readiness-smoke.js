#!/usr/bin/env node

const DEFAULT_BASE_URL = "https://www.webprinter.dk";
const DEFAULT_TIMEOUT_MS = 15000;

const args = process.argv.slice(2);

function readArg(name, fallback) {
  const eqArg = args.find((arg) => arg.startsWith(`${name}=`));
  if (eqArg) return eqArg.slice(name.length + 1);
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) return args[index + 1];
  return fallback;
}

function hasFlag(name) {
  return args.includes(name);
}

if (hasFlag("--help") || hasFlag("-h")) {
  console.log(`
Read-only smoke check for the Webprinter commercial proof routes.

Usage:
  node scripts/commercial-readiness-smoke.js
  node scripts/commercial-readiness-smoke.js --base-url http://127.0.0.1:8083
  node scripts/commercial-readiness-smoke.js --browser --base-url http://127.0.0.1:8083

Options:
  --base-url <url>          Site root to check. Default: ${DEFAULT_BASE_URL}
  --timeout-ms <number>    Per-request timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --skip-bundle-markers    Skip built bundle marker checks.
  --browser                Also verify rendered React pages with Playwright.
`);
  process.exit(0);
}

const baseUrl = normalizeBaseUrl(
  readArg("--base-url", process.env.COMMERCIAL_SMOKE_BASE_URL || DEFAULT_BASE_URL),
);
const timeoutMs = Number(readArg("--timeout-ms", process.env.COMMERCIAL_SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
const skipBundleMarkers = hasFlag("--skip-bundle-markers");
const runBrowserSmoke = hasFlag("--browser") || process.env.COMMERCIAL_SMOKE_BROWSER === "1";

const checks = [
  {
    name: "Webprinter forside",
    kind: "html",
    path: "/?force_domain=webprinter.dk",
    expectedText: ["root"],
  },
  {
    name: "Webprinter aluminium produkt",
    kind: "html",
    path: "/produkt/aluminium?force_domain=webprinter.dk",
    expectedText: ["root"],
  },
  {
    name: "Salgsmapper forside",
    kind: "html",
    path: "/?force_domain=www.salgsmapper.dk",
    expectedText: ["root"],
  },
  {
    name: "Salgsmapper første skabelonprodukt",
    kind: "html",
    path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    expectedText: ["root"],
  },
  {
    name: "Designer med Salgsmapper PDF kontekst",
    kind: "html",
    path:
      "/designer?force_domain=www.salgsmapper.dk&templatePdfName=salgsmappe-a5-5mm-ryg.pdf&templatePdfUrl=%2Fdesigner-templates%2Fsalgsmapper%2Fsalgsmappe-a5-5mm-ryg.pdf",
    expectedText: ["root"],
  },
  {
    name: "Driftsklarhed cockpit",
    kind: "html",
    path: "/admin/commercial-readiness?force_domain=webprinter.dk",
    expectedText: ["root"],
  },
  {
    name: "Leverandørbank admin",
    kind: "html",
    path: "/admin/supplier-bank?force_domain=webprinter.dk",
    expectedText: ["root"],
  },
  {
    name: "Salgsmapper PDF-skabelon",
    kind: "pdf",
    path: "/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf",
  },
];

const bundleMarkers = [
  "Download skabelon",
  "Produktionsklarhed",
  "templatePdfUrl",
  "sales-mapper",
];

const renderedChecks = [
  {
    name: "Rendered Webprinter home",
    path: "/?force_domain=webprinter.dk",
    expectedText: ["Den komplette løsning"],
  },
  {
    name: "Rendered aluminium product",
    path: "/produkt/aluminium?force_domain=webprinter.dk",
    expectedText: ["Prisberegning"],
  },
  {
    name: "Rendered Salgsmapper product",
    path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    expectedText: ["Standard Salgsmapper", "Download skabelon"],
  },
  {
    name: "Rendered designer template",
    path:
      "/designer?force_domain=www.salgsmapper.dk&templatePdfName=salgsmappe-a5-5mm-ryg.pdf&templatePdfUrl=%2Fdesigner-templates%2Fsalgsmapper%2Fsalgsmappe-a5-5mm-ryg.pdf",
    expectedText: ["Format-skabelon indlæst", "salgsmappe-a5-5mm-ryg.pdf"],
  },
];

const results = [];

console.log(`\nCommercial readiness smoke for ${baseUrl}`);
console.log("Read-only: no database writes, no orders, no product changes.\n");

for (const check of checks) {
  results.push(await runRouteCheck(check));
}

if (!skipBundleMarkers) {
  results.push(await runBundleMarkerCheck());
}

if (runBrowserSmoke) {
  results.push(...(await runRenderedChecks()));
}

const failed = results.filter((result) => !result.ok);
for (const result of results) {
  const icon = result.ok ? "OK" : "FAIL";
  console.log(`${icon} ${result.name}`);
  if (result.detail) console.log(`   ${result.detail}`);
}

if (failed.length > 0) {
  console.error(`\nSmoke failed: ${failed.length}/${results.length} checks failed.`);
  process.exit(1);
}

console.log(`\nSmoke passed: ${results.length}/${results.length} checks OK.`);

async function runRouteCheck(check) {
  const url = new URL(check.path, baseUrl);
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      return {
        name: check.name,
        ok: false,
        detail: `${response.status} ${response.statusText} at ${url.href}`,
      };
    }

    const contentType = response.headers.get("content-type") || "";

    if (check.kind === "pdf") {
      const bytes = new Uint8Array(await response.arrayBuffer());
      const header = new TextDecoder().decode(bytes.slice(0, 4));
      const looksLikePdf = header === "%PDF";
      const isPdfType = contentType.includes("application/pdf");
      return {
        name: check.name,
        ok: looksLikePdf && isPdfType,
        detail: `${contentType || "unknown content-type"}, ${bytes.length} bytes`,
      };
    }

    const text = await response.text();
    const missing = (check.expectedText || []).filter((marker) => !text.includes(marker));
    return {
      name: check.name,
      ok: missing.length === 0,
      detail: `${response.status}, ${contentType || "unknown content-type"}${missing.length ? `, missing: ${missing.join(", ")}` : ""}`,
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runBundleMarkerCheck() {
  const indexUrl = new URL("/?force_domain=webprinter.dk", baseUrl);
  try {
    const response = await fetchWithTimeout(indexUrl);
    if (!response.ok) {
      return {
        name: "Shipped bundle markers",
        ok: false,
        detail: `${response.status} ${response.statusText} at ${indexUrl.href}`,
      };
    }

    const html = await response.text();
    const scriptPaths = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*>/g)].map((match) => match[1]);
    const assetPaths = scriptPaths.filter((path) => path.includes("/assets/"));

    if (assetPaths.length === 0) {
      return {
        name: "Shipped bundle markers",
        ok: true,
        detail: "Skipped: no built /assets/*.js bundle found, likely local Vite dev server.",
      };
    }

    const bundleText = (
      await Promise.all(
        assetPaths.map(async (path) => {
          const bundleUrl = new URL(path, baseUrl);
          const bundleResponse = await fetchWithTimeout(bundleUrl);
          if (!bundleResponse.ok) return "";
          return bundleResponse.text();
        }),
      )
    ).join("\n");

    const missing = bundleMarkers.filter((marker) => !bundleText.includes(marker));
    return {
      name: "Shipped bundle markers",
      ok: missing.length === 0,
      detail: missing.length
        ? `Missing markers: ${missing.join(", ")}`
        : `Found markers: ${bundleMarkers.join(", ")}`,
    };
  } catch (error) {
    return {
      name: "Shipped bundle markers",
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runRenderedChecks() {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch (error) {
    return [
      {
        name: "Rendered page smoke",
        ok: false,
        detail: `Playwright is unavailable: ${error instanceof Error ? error.message : String(error)}`,
      },
    ];
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleMessages = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  const renderedResults = [];

  try {
    for (const check of renderedChecks) {
      const url = new URL(check.path, baseUrl);
      const startMessageCount = consoleMessages.length;

      try {
        await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
        await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
        await page.waitForTimeout(1000);

        const text = normalizeVisibleText(await page.locator("body").innerText({ timeout: timeoutMs }));
        const missing = check.expectedText.filter((marker) => !text.includes(marker));
        const runtimeError = text.includes("MIDLERTIDIG FEJL") || text.includes("Siden kunne ikke vises korrekt");
        const newConsoleErrors = consoleMessages
          .slice(startMessageCount)
          .filter((message) => !message.includes("A preload for") && !message.includes("was not used within a few seconds"));

        renderedResults.push({
          name: check.name,
          ok: !runtimeError && missing.length === 0,
          detail: [
            runtimeError ? "rendered the temporary error screen" : "rendered",
            missing.length ? `missing: ${missing.join(", ")}` : null,
            newConsoleErrors.length ? `console: ${newConsoleErrors.slice(0, 2).join(" | ")}` : null,
          ].filter(Boolean).join("; "),
        });
      } catch (error) {
        renderedResults.push({
          name: check.name,
          ok: false,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } finally {
    await browser.close();
  }

  return renderedResults;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "webprinter-commercial-readiness-smoke/1.0",
        accept: "*/*",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "/");
}

function normalizeVisibleText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
