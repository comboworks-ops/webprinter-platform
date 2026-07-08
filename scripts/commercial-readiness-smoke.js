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

const designLaunchChecks = [
  {
    name: "Aluminium product opens designer",
    path: "/produkt/aluminium?force_domain=webprinter.dk",
    expectedDesignerText: ["Design til Aluminium", "Tilbage til bestilling"],
    expectedSearchParams: {
      productId: true,
      order: "1",
      returnTo: "/produkt/aluminium",
    },
    expectedSession: {
      productSlug: "aluminium",
      templatePdfUrl: null,
    },
  },
  {
    name: "Salgsmapper product opens template designer",
    path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    expectedDesignerText: ["Design til Standard Salgsmapper", "504x371mm", "Tilbage til bestilling"],
    expectedSearchParams: {
      productId: true,
      order: "1",
      returnTo: "/produkt/standard-sales-mapper-kopi-2",
      templatePdfUrl: "/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf",
    },
    expectedSession: {
      productSlug: "standard-sales-mapper-kopi-2",
      templatePdfUrl: "/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf",
    },
  },
];

const templateDownloadChecks = [
  {
    name: "Salgsmapper product exposes template download",
    path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    linkName: /^Download skabelon$/i,
    expectedHrefPath: "/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf",
    expectedDownloadName: "Salgsmappe A5 5 mm ryg.pdf",
  },
];

const checkoutLaunchChecks = [
  {
    name: "Aluminium product opens checkout",
    path: "/produkt/aluminium?force_domain=webprinter.dk",
    expectedCheckoutText: ["Konfigurer dit design", "Aluminium Skilte", "100 x 100 cm", "Total (ex. moms): 565 kr", "Fil Upload"],
    expectedSearchParams: {
      force_domain: "webprinter.dk",
    },
    expectedSession: {
      productSlug: "aluminium",
      productName: "Aluminium Skilte",
      selectedFormat: "100 x 100 cm",
      quantity: 1,
      productPrice: 436,
      totalPrice: 565,
      templatePdfUrl: null,
    },
  },
  {
    name: "Salgsmapper product opens checkout",
    path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    expectedCheckoutText: ["Konfigurer dit design", "Standard Salgsmapper", "A4 salgsmappe", "Total (ex. moms): 622 kr", "Fil Upload"],
    expectedSearchParams: {
      force_domain: "www.salgsmapper.dk",
    },
    expectedSession: {
      productSlug: "standard-sales-mapper-kopi-2",
      productName: "Standard Salgsmapper",
      selectedFormat: "A4",
      quantity: 50,
      productPrice: 573,
      totalPrice: 622,
      templatePdfUrl: "/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf",
    },
  },
];

const uploadReadinessChecks = [
  {
    name: "Aluminium checkout shows upload path",
    path: "/produkt/aluminium?force_domain=webprinter.dk",
    expectedUploadText: ["Fil Upload", "Klik eller træk fil hertil", "PDF", "JPG", "TIFF"],
    expectedFileAccept: [".pdf", ".jpg", ".jpeg", ".png", ".tiff"],
    expectedSession: {
      productSlug: "aluminium",
      productName: "Aluminium Skilte",
      selectedFormat: "100 x 100 cm",
      siteUpload: null,
    },
  },
  {
    name: "Salgsmapper checkout shows upload path",
    path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    expectedUploadText: ["Fil Upload", "Klik eller træk fil hertil", "PDF", "JPG", "TIFF"],
    expectedFileAccept: [".pdf", ".jpg", ".jpeg", ".png", ".tiff"],
    expectedSession: {
      productSlug: "standard-sales-mapper-kopi-2",
      productName: "Standard Salgsmapper",
      selectedFormat: "A4",
      templatePdfUrl: "/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf",
      siteUpload: null,
    },
  },
];

const checkoutValidationChecks = [
  {
    name: "Aluminium checkout validates customer details before payment",
    path: "/produkt/aluminium?force_domain=webprinter.dk",
    syntheticUploadName: "smoke-aluminium-upload.png",
    expectedValidationText: "Udfyld kunde- og leveringsoplysninger før betaling.",
    expectedSession: {
      productSlug: "aluminium",
      productName: "Aluminium Skilte",
      selectedFormat: "100 x 100 cm",
    },
  },
  {
    name: "Salgsmapper checkout validates customer details before payment",
    path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    syntheticUploadName: "smoke-salgsmapper-upload.png",
    expectedValidationText: "Udfyld kunde- og leveringsoplysninger før betaling.",
    expectedSession: {
      productSlug: "standard-sales-mapper-kopi-2",
      productName: "Standard Salgsmapper",
      selectedFormat: "A4",
      templatePdfUrl: "/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf",
    },
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
  results.push(...(await runBrowserChecks()));
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

async function runBrowserChecks() {
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

    for (const check of designLaunchChecks) {
      renderedResults.push(await runDesignLaunchCheck(browser, check));
    }

    for (const check of templateDownloadChecks) {
      renderedResults.push(await runTemplateDownloadCheck(browser, check));
    }

    for (const check of checkoutLaunchChecks) {
      renderedResults.push(await runCheckoutLaunchCheck(browser, check));
    }

    for (const check of uploadReadinessChecks) {
      renderedResults.push(await runUploadReadinessCheck(browser, check));
    }

    for (const check of checkoutValidationChecks) {
      renderedResults.push(await runCheckoutValidationCheck(browser, check));
    }
  } finally {
    await browser.close();
  }

  return renderedResults;
}

async function runDesignLaunchCheck(browser, check) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const consoleMessages = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  try {
    const url = new URL(check.path, baseUrl);
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /Design online|Design klar/i }).click({ timeout: timeoutMs });
    await page.waitForURL(/\/designer\?/, { timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);

    const currentUrl = new URL(page.url());
    const text = normalizeVisibleText(await page.locator("body").innerText({ timeout: timeoutMs }));
    const session = await readCheckoutSession(page);
    const missingText = check.expectedDesignerText.filter((marker) => !text.includes(marker));
    const missingParams = expectedParamFailures(currentUrl.searchParams, check.expectedSearchParams);
    const sessionFailures = expectedSessionFailures(session, check.expectedSession);
    const runtimeError = text.includes("MIDLERTIDIG FEJL") || text.includes("Siden kunne ikke vises korrekt");
    const meaningfulConsole = consoleMessages.filter(
      (message) => !message.includes("A preload for") && !message.includes("was not used within a few seconds"),
    );
    const ok = !runtimeError && missingText.length === 0 && missingParams.length === 0 && sessionFailures.length === 0;

    return {
      name: check.name,
      ok,
      detail: [
        ok ? "opened designer with order context" : "designer handoff mismatch",
        runtimeError ? "rendered the temporary error screen" : null,
        missingText.length ? `missing text: ${missingText.join(", ")}` : null,
        missingParams.length ? `params: ${missingParams.join(", ")}` : null,
        sessionFailures.length ? `session: ${sessionFailures.join(", ")}` : null,
        meaningfulConsole.length ? `console: ${meaningfulConsole.slice(0, 2).join(" | ")}` : null,
      ].filter(Boolean).join("; "),
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function runTemplateDownloadCheck(browser, check) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const consoleMessages = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  try {
    const url = new URL(check.path, baseUrl);
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);

    const text = normalizeVisibleText(await page.locator("body").innerText({ timeout: timeoutMs }));
    const runtimeError = text.includes("MIDLERTIDIG FEJL") || text.includes("Siden kunne ikke vises korrekt");
    const link = page.getByRole("link", { name: check.linkName }).first();
    const linkCount = await link.count();

    let href = null;
    let downloadName = null;
    let responseOk = false;
    let contentType = "";
    let byteCount = 0;
    let looksLikePdf = false;

    if (linkCount > 0) {
      href = await link.getAttribute("href");
      downloadName = await link.getAttribute("download");

      if (href) {
        const templateUrl = new URL(href, page.url());
        const response = await page.request.get(templateUrl.href, { timeout: timeoutMs });
        responseOk = response.ok();
        contentType = response.headers()["content-type"] || "";
        const bytes = await response.body();
        byteCount = bytes.length;
        looksLikePdf = bytes.subarray(0, 4).toString("utf8") === "%PDF";
      }
    }

    const hrefPath = href ? new URL(href, page.url()).pathname : null;
    const meaningfulConsole = consoleMessages.filter(
      (message) => !message.includes("A preload for") && !message.includes("was not used within a few seconds"),
    );
    const mismatches = [
      runtimeError ? "rendered the temporary error screen" : null,
      linkCount === 0 ? "download link missing" : null,
      hrefPath !== check.expectedHrefPath ? `href=${JSON.stringify(hrefPath)} expected ${JSON.stringify(check.expectedHrefPath)}` : null,
      downloadName !== check.expectedDownloadName ? `download=${JSON.stringify(downloadName)} expected ${JSON.stringify(check.expectedDownloadName)}` : null,
      !responseOk ? "template request failed" : null,
      !contentType.includes("application/pdf") ? `content-type=${contentType || "missing"}` : null,
      !looksLikePdf ? "template response is not a PDF" : null,
    ].filter(Boolean);
    const ok = mismatches.length === 0;

    return {
      name: check.name,
      ok,
      detail: [
        ok ? "download link resolves to template PDF" : "template download mismatch",
        byteCount ? `${byteCount} bytes` : null,
        meaningfulConsole.length ? `console: ${meaningfulConsole.slice(0, 2).join(" | ")}` : null,
        mismatches.length ? mismatches.join("; ") : null,
      ].filter(Boolean).join("; "),
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function runCheckoutLaunchCheck(browser, check) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const consoleMessages = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  try {
    const url = new URL(check.path, baseUrl);
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /Bestil nu/i }).click({ timeout: timeoutMs });
    await page.waitForURL(/\/checkout\/konfigurer/, { timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);

    const currentUrl = new URL(page.url());
    const text = normalizeVisibleText(await page.locator("body").innerText({ timeout: timeoutMs }));
    const session = await readCheckoutSession(page);
    const missingText = check.expectedCheckoutText.filter((marker) => !text.includes(marker));
    const missingParams = expectedParamFailures(currentUrl.searchParams, check.expectedSearchParams);
    const sessionFailures = expectedSessionFailures(session, check.expectedSession);
    const runtimeError = text.includes("MIDLERTIDIG FEJL") || text.includes("Siden kunne ikke vises korrekt");
    const meaningfulConsole = consoleMessages.filter(
      (message) => !message.includes("A preload for") && !message.includes("was not used within a few seconds"),
    );
    const ok = !runtimeError && currentUrl.pathname === "/checkout/konfigurer" && missingText.length === 0 && missingParams.length === 0 && sessionFailures.length === 0;

    return {
      name: check.name,
      ok,
      detail: [
        ok ? "opened checkout with current selection" : "checkout handoff mismatch",
        currentUrl.pathname !== "/checkout/konfigurer" ? `path=${currentUrl.pathname}` : null,
        runtimeError ? "rendered the temporary error screen" : null,
        missingText.length ? `missing text: ${missingText.join(", ")}` : null,
        missingParams.length ? `params: ${missingParams.join(", ")}` : null,
        sessionFailures.length ? `session: ${sessionFailures.join(", ")}` : null,
        meaningfulConsole.length ? `console: ${meaningfulConsole.slice(0, 2).join(" | ")}` : null,
      ].filter(Boolean).join("; "),
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function runUploadReadinessCheck(browser, check) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const consoleMessages = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  try {
    const url = new URL(check.path, baseUrl);
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /Bestil nu/i }).click({ timeout: timeoutMs });
    await page.waitForURL(/\/checkout\/konfigurer/, { timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);

    const text = normalizeVisibleText(await page.locator("body").innerText({ timeout: timeoutMs }));
    const session = await readCheckoutSession(page);
    const fileInput = page.locator('input[type="file"]').first();
    const fileInputCount = await fileInput.count();
    const fileAccept = fileInputCount > 0 ? await fileInput.getAttribute("accept") : null;
    const paymentButton = page.getByRole("button", { name: /Gå til betaling/i }).first();
    const paymentButtonCount = await paymentButton.count();
    const paymentButtonDisabled = paymentButtonCount > 0 ? await paymentButton.isDisabled() : false;
    const runtimeError = text.includes("MIDLERTIDIG FEJL") || text.includes("Siden kunne ikke vises korrekt");
    const missingText = check.expectedUploadText.filter((marker) => !text.includes(marker));
    const missingAccepts = check.expectedFileAccept.filter((marker) => !String(fileAccept || "").includes(marker));
    const sessionFailures = expectedSessionFailures(session, check.expectedSession);
    const meaningfulConsole = consoleMessages.filter(
      (message) => !message.includes("A preload for") && !message.includes("was not used within a few seconds"),
    );
    const mismatches = [
      runtimeError ? "rendered the temporary error screen" : null,
      missingText.length ? `missing text: ${missingText.join(", ")}` : null,
      fileInputCount === 0 ? "file input missing" : null,
      missingAccepts.length ? `missing accepted types: ${missingAccepts.join(", ")}` : null,
      paymentButtonCount === 0 ? "payment button missing" : null,
      !paymentButtonDisabled ? "payment button enabled before upload/customer details" : null,
      sessionFailures.length ? `session: ${sessionFailures.join(", ")}` : null,
      meaningfulConsole.length ? `console: ${meaningfulConsole.slice(0, 2).join(" | ")}` : null,
    ].filter(Boolean);
    const ok = mismatches.length === 0;

    return {
      name: check.name,
      ok,
      detail: [
        ok ? "upload panel ready without writing a file" : "upload readiness mismatch",
        fileAccept ? `accept=${fileAccept}` : null,
        mismatches.length ? mismatches.join("; ") : null,
      ].filter(Boolean).join("; "),
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function runCheckoutValidationCheck(browser, check) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const consoleMessages = [];
  const blockedWriteRequests = [];

  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`);
    }
  });

  page.on("pageerror", (error) => {
    consoleMessages.push(`pageerror: ${error.message}`);
  });

  page.on("request", (request) => {
    const url = request.url();
    const method = request.method().toUpperCase();
    const isStripePaymentIntent = url.includes("/functions/v1/stripe-create-payment-intent");
    const isOrderFileWrite = url.includes("/storage/v1/object/order-files") && !["GET", "HEAD", "OPTIONS"].includes(method);
    const isOrderInsert = url.includes("/rest/v1/orders") && method !== "GET";
    if (isStripePaymentIntent || isOrderFileWrite || isOrderInsert) {
      blockedWriteRequests.push(`${method} ${url}`);
    }
  });

  try {
    const url = new URL(check.path, baseUrl);
    await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: /Bestil nu/i }).click({ timeout: timeoutMs });
    await page.waitForURL(/\/checkout\/konfigurer/, { timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1000);

    await installSyntheticCheckoutUpload(page, check.syntheticUploadName);
    await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 10000) }).catch(() => undefined);
    await page.waitForTimeout(1500);

    const beforeApproveText = normalizeVisibleText(await page.locator("body").innerText({ timeout: timeoutMs }));
    const hasSyntheticUpload = beforeApproveText.includes(check.syntheticUploadName);
    const paymentButton = page.getByRole("button", { name: /Gå til betaling/i }).first();
    const paymentDisabledBeforeApproval = await paymentButton.isDisabled({ timeout: timeoutMs });
    await page.getByRole("button", { name: /^Godkend fil$/i }).first().click({ timeout: timeoutMs });
    await page.waitForTimeout(750);
    const paymentDisabledAfterApproval = await paymentButton.isDisabled({ timeout: timeoutMs });
    await paymentButton.click({ timeout: timeoutMs });
    await page.waitForTimeout(1000);

    const text = normalizeVisibleText(await page.locator("body").innerText({ timeout: timeoutMs }));
    const session = await readCheckoutSession(page);
    const runtimeError = text.includes("MIDLERTIDIG FEJL") || text.includes("Siden kunne ikke vises korrekt");
    const sessionFailures = expectedSessionFailures(session, check.expectedSession);
    const uploadPath = session?.siteUpload?.filePath ?? null;
    const meaningfulConsole = consoleMessages.filter(
      (message) => !message.includes("A preload for") && !message.includes("was not used within a few seconds"),
    );
    const mismatches = [
      runtimeError ? "rendered the temporary error screen" : null,
      !hasSyntheticUpload ? "synthetic upload not rendered" : null,
      uploadPath !== "smoke-readonly/no-storage-write.png" ? `siteUpload.filePath=${JSON.stringify(uploadPath)}` : null,
      !paymentDisabledBeforeApproval ? "payment enabled before file approval" : null,
      paymentDisabledAfterApproval ? "payment still disabled after file approval" : null,
      !text.includes(check.expectedValidationText) ? "missing customer/details validation message" : null,
      blockedWriteRequests.length ? `unexpected write/payment request: ${blockedWriteRequests[0]}` : null,
      sessionFailures.length ? `session: ${sessionFailures.join(", ")}` : null,
      meaningfulConsole.length ? `console: ${meaningfulConsole.slice(0, 2).join(" | ")}` : null,
    ].filter(Boolean);
    const ok = mismatches.length === 0;

    return {
      name: check.name,
      ok,
      detail: [
        ok ? "customer/detail validation blocked payment without writes" : "checkout validation mismatch",
        mismatches.length ? mismatches.join("; ") : null,
      ].filter(Boolean).join("; "),
    };
  } catch (error) {
    return {
      name: check.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await page.close();
  }
}

async function installSyntheticCheckoutUpload(page, name) {
  const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/l0D9GwAAAABJRU5ErkJggg==";
  await page.evaluate(({ dataUrl, name }) => {
    const key = "wp_site_checkout_session";
    const raw = sessionStorage.getItem(key);
    const session = raw ? JSON.parse(raw) : {};
    const widthMm = Number(session.designWidthMm || 100);
    const heightMm = Number(session.designHeightMm || 100);

    session.siteUpload = {
      name,
      mimeType: "image/png",
      fileUrl: dataUrl,
      filePath: "smoke-readonly/no-storage-write.png",
      previewDataUrl: dataUrl,
      widthPx: 3000,
      heightPx: 3000,
      physicalWidthMm: widthMm,
      physicalHeightMm: heightMm,
      estimatedDpi: 300,
      sourceDpi: 300,
      uploadedAt: new Date().toISOString(),
    };

    sessionStorage.setItem(key, JSON.stringify(session));
    window.history.replaceState(null, "", window.location.href);
  }, { dataUrl, name });
}

async function readCheckoutSession(page) {
  const raw = await page.evaluate(() => sessionStorage.getItem("wp_site_checkout_session"));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function expectedParamFailures(searchParams, expected) {
  return Object.entries(expected || {}).flatMap(([key, expectedValue]) => {
    const actual = searchParams.get(key);
    if (expectedValue === true) return actual ? [] : [`${key} missing`];
    return actual === expectedValue ? [] : [`${key}=${JSON.stringify(actual)} expected ${JSON.stringify(expectedValue)}`];
  });
}

function expectedSessionFailures(session, expected) {
  if (!session || typeof session !== "object") return ["checkout session missing"];
  return Object.entries(expected || {}).flatMap(([key, expectedValue]) => {
    const actual = session[key] ?? null;
    return actual === expectedValue ? [] : [`${key}=${JSON.stringify(actual)} expected ${JSON.stringify(expectedValue)}`];
  });
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
