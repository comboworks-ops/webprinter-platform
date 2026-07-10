#!/usr/bin/env node

import { chromium } from "playwright";

const DEFAULT_BASE_URL = "http://127.0.0.1:8083";
const DEFAULT_TIMEOUT_MS = 25000;
const TRANSIENT_SUPABASE_RETRY_DELAY_MS = 32000;

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
Read-only smoke check for owned tenant proof routes.

Usage:
  node scripts/check-tenant-proof-routes.mjs
  node scripts/check-tenant-proof-routes.mjs --base-url http://127.0.0.1:8083

Options:
  --base-url <url>        Site root to check. Default: ${DEFAULT_BASE_URL}
  --timeout-ms <number>  Per-route timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --json                 Print machine-readable results.
`);
  process.exit(0);
}

const baseUrl = normalizeBaseUrl(readArg("--base-url", process.env.TENANT_PROOF_BASE_URL || DEFAULT_BASE_URL));
const timeoutMs = Number(readArg("--timeout-ms", process.env.TENANT_PROOF_TIMEOUT_MS || DEFAULT_TIMEOUT_MS));
const printJson = hasFlag("--json");

const htmlRoutes = [
  {
    name: "Webprinter home",
    path: "/?force_domain=webprinter.dk",
    titleIncludes: ["Webprinter"],
    textIncludes: ["Webprinter"],
  },
  {
    name: "Webprinter aluminium",
    path: "/produkt/aluminium?force_domain=webprinter.dk",
    titleIncludes: ["Aluminium"],
    textIncludes: ["Aluminium"],
    orderWorkflow: {
      orderButtonPattern: "Bestil nu|Upload fil og bestil|Upload eller bestil",
      checkoutUrlIncludes: ["/checkout/konfigurer", "force_domain=webprinter.dk"],
      checkoutTextIncludes: [
        "Storformat fil-tjek",
        "Valgt konfiguration",
        "Aluminium Skilte",
        "Upload",
      ],
      session: {
        productSlug: "aluminium",
        productName: "Aluminium Skilte",
        selectedVariantIncludes: "alu",
        selectedFormatIncludes: "cm",
        minProductPrice: 1,
        minTotalPrice: 1,
        minQuantity: 1,
        areaM2: 1,
      },
    },
  },
  {
    name: "Banner Builder Pro site package preview",
    path: "/preview-shop?preview_mode=1&tenantId=00000000-0000-0000-0000-000000000000&siteId=banner-builder-pro&sitePreview=1&page=%2F",
    titleIncludes: ["Webprinter"],
    textIncludes: ["Banner Builder Pro", "repo bundle", "Åbn bundle", "GitHub"],
    sitePreviewWorkflow: {
      iframeUrlIncludes: "/site-previews/banner-builder-pro/index.html",
      iframeTextIncludes: [
        "Storformat print i topkvalitet",
        "PVC Banner",
        "Beregn pris",
        "Ringe / Øskner",
      ],
    },
  },
  {
    name: "Salgsmapper home",
    path: "/?force_domain=www.salgsmapper.dk",
    titleIncludes: ["Salgsmapper"],
    textIncludes: ["salgsmapper"],
  },
  {
    name: "Salgsmapper category landing",
    path: "/produkter?force_domain=www.salgsmapper.dk",
    titleIncludes: ["Webprinter"],
    textIncludes: ["Alle produkter", "Salgsmapper", "4 produkter i Salgsmapper"],
    categoryWorkflow: {
      linkHrefIncludes: "category=salgsmapper",
      targetUrlIncludes: ["/produkter", "category=salgsmapper", "force_domain=www.salgsmapper.dk"],
      targetTextIncludes: ["Standard", "Salgsmapper", "Flere priser & bestil"],
    },
  },
  {
    name: "Salgsmapper standard folder",
    path: "/produkt/standard-sales-mapper-kopi-2?force_domain=www.salgsmapper.dk",
    titleIncludes: ["salgsmapper"],
    textIncludes: ["Standard", "Salgsmapper"],
    templateWorkflow: {
      downloadText: "Download skabelon",
      downloadHrefPattern: "\\.pdf(?:$|[?#])",
      downloadNameIncludes: "salgsmappe",
      designButtonPattern: "Design online|Design klar|Design i skabelon",
      designerUrlIncludes: [
        "/designer",
        "templatePdfUrl=",
        "productId=",
      ],
      designerTextIncludes: ["PDF-skabelon", "ikke-printbar"],
      verifyDesignerReturnToCheckout: true,
    },
  },
  {
    name: "Salgsmapper laminated folder",
    path: "/produkt/salgsmapper-med-kachering?force_domain=www.salgsmapper.dk",
    titleIncludes: ["Salgsmapper"],
    textIncludes: ["Salgsmapper"],
  },
  {
    name: "Onlinetryksager home",
    path: "/?force_domain=www.onlinetryksager.dk",
    titleIncludes: ["Billige tryksager online"],
    textIncludes: ["onlinetryksager"],
  },
  {
    name: "Onlinetryksager category landing",
    path: "/produkter?force_domain=www.onlinetryksager.dk",
    titleIncludes: ["Tryksager"],
    textIncludes: ["Alle produkter", "Tryksager", "Plakater", "1 produkt i Tryksager"],
    categoryWorkflow: {
      linkHrefIncludes: "category=tryksager",
      targetUrlIncludes: ["/produkter", "category=tryksager", "force_domain=www.onlinetryksager.dk"],
      targetTextIncludes: ["Flyers", "Priser"],
    },
  },
  {
    name: "Onlinetryksager flyer",
    path: "/produkt/flyer-demand?force_domain=www.onlinetryksager.dk",
    titleIncludes: ["Flyers"],
    textIncludes: ["Flyers"],
    orderWorkflow: {
      orderButtonPattern: "Bestil nu|Upload fil og bestil|Upload eller bestil",
      checkoutUrlIncludes: ["/checkout/konfigurer", "force_domain=www.onlinetryksager.dk"],
      checkoutTextIncludes: [
        "Konfigurer dit design",
        "Valgt konfiguration",
        "Flyers",
        "Upload",
      ],
      session: {
        productSlug: "flyer-demand",
        productName: "Flyers",
        selectedVariantIncludes: "papir",
        selectedFormatIncludes: "A5",
        minProductPrice: 1,
        minTotalPrice: 1,
        minQuantity: 50,
        areaM2: 1,
      },
    },
  },
  {
    name: "Onlinetryksager poster",
    path: "/produkt/standard-plakater?force_domain=www.onlinetryksager.dk",
    titleIncludes: ["Plakater"],
    textIncludes: ["Plakater"],
  },
];

const binaryRoutes = [
  {
    name: "Salgsmapper PDF template",
    path: "/designer-templates/salgsmapper/salgsmappe-a5-5mm-ryg.pdf",
    contentTypeIncludes: "application/pdf",
  },
];

const ignoredConsoleErrorParts = [
  "Failed to load resource",
  "favicon",
  "net::ERR_ABORTED",
];

const results = [];

for (const route of binaryRoutes) {
  results.push(await checkBinaryRoute(route));
}

const browser = await chromium.launch({ headless: true });
try {
  for (const route of htmlRoutes) {
    results.push(await checkHtmlRouteWithRetry(browser, route));
  }
} finally {
  await browser.close();
}

const failures = results.filter((result) => !result.ok);

if (printJson) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const result of results) {
    const status = result.ok ? "PASS" : "FAIL";
    console.log(`${status} ${result.name}: ${result.detail}`);
  }
}

if (failures.length) {
  console.error(`Tenant proof smoke failed: ${failures.map((result) => result.name).join(", ")}`);
  process.exit(1);
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function resolveUrl(path) {
  return `${baseUrl}${path}`;
}

async function checkBinaryRoute(route) {
  const url = resolveUrl(route.path);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { method: "GET", signal: controller.signal });
    clearTimeout(timer);

    const contentType = response.headers.get("content-type") || "";
    const bytes = await response.arrayBuffer();
    const issues = [];

    if (!response.ok) issues.push(`HTTP ${response.status}`);
    if (route.contentTypeIncludes && !contentType.toLowerCase().includes(route.contentTypeIncludes)) {
      issues.push(`content-type ${contentType || "missing"}`);
    }
    if (bytes.byteLength < 1000) issues.push(`small payload ${bytes.byteLength} bytes`);

    return {
      name: route.name,
      ok: issues.length === 0,
      detail: issues.length ? issues.join("; ") : `${response.status} ${contentType}, ${bytes.byteLength} bytes`,
      url,
    };
  } catch (error) {
    return {
      name: route.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
      url,
    };
  }
}

async function checkHtmlRoute(browser, route) {
  const url = resolveUrl(route.path);
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const consoleErrors = [];

  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await waitForRouteEvidence(page, route);

    const bodyText = await page.locator("body").innerText().catch(() => "");
    const normalizedBodyText = bodyText.toLowerCase();
    const title = await page.title().catch(() => "");
    const runtimeFallback = await page.locator("text=Siden kunne ikke vises korrekt lige nu").count().catch(() => 0);
    const issues = [];
    const evidence = [];

    if (!response || response.status() >= 400) issues.push(`HTTP ${response?.status() ?? "missing"}`);
    if (runtimeFallback > 0) issues.push("runtime fallback visible");
    if (normalizedBodyText.includes("shells marble")) issues.push("wrong tenant copy: Shells Marble");
    for (const expectedTitle of route.titleIncludes || []) {
      if (!title.toLowerCase().includes(expectedTitle.toLowerCase())) {
        issues.push(`title missing ${expectedTitle}`);
      }
    }
    for (const expectedText of route.textIncludes || []) {
      if (!normalizedBodyText.includes(expectedText.toLowerCase())) {
        issues.push(`body missing ${expectedText}`);
      }
    }

    if (route.templateWorkflow) {
      const workflowEvidence = await checkTemplateWorkflow(page, route.templateWorkflow, issues);
      evidence.push(...workflowEvidence);
    }
  if (route.categoryWorkflow) {
    const workflowEvidence = await checkCategoryWorkflow(page, route.categoryWorkflow, issues);
    evidence.push(...workflowEvidence);
  }
  if (route.sitePreviewWorkflow) {
    const workflowEvidence = await checkSitePreviewWorkflow(page, route.sitePreviewWorkflow, issues);
    evidence.push(...workflowEvidence);
  }
  if (route.orderWorkflow) {
    const workflowEvidence = await checkOrderWorkflow(page, route.orderWorkflow, issues);
    evidence.push(...workflowEvidence);
    }

    const filteredErrors = consoleErrors.filter((error) => (
      !ignoredConsoleErrorParts.some((part) => error.includes(part))
    ));
    if (filteredErrors.length) issues.push(`console errors: ${filteredErrors.slice(0, 2).join(" | ")}`);

    return {
      name: route.name,
      ok: issues.length === 0,
      detail: issues.length ? issues.join("; ") : `${response?.status() ?? "unknown"} ${title}${evidence.length ? `; ${evidence.join("; ")}` : ""}`,
      finalUrl: page.url(),
      url,
    };
  } catch (error) {
    return {
      name: route.name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
      finalUrl: page.url(),
      url,
    };
  } finally {
    await page.close();
  }
}

async function checkHtmlRouteWithRetry(browser, route) {
  const firstResult = await checkHtmlRoute(browser, route);
  if (firstResult.ok || !isTransientSupabaseTransportFailure(firstResult.detail)) {
    return firstResult;
  }

  await delay(TRANSIENT_SUPABASE_RETRY_DELAY_MS);
  const retryResult = await checkHtmlRoute(browser, route);
  if (retryResult.ok) {
    return {
      ...retryResult,
      detail: `retry after Supabase transport pause; ${retryResult.detail}`,
    };
  }

  return {
    ...retryResult,
    detail: `${retryResult.detail}; first attempt: ${firstResult.detail}`,
  };
}

function isTransientSupabaseTransportFailure(detail) {
  const normalizedDetail = String(detail || "").toLowerCase();
  return normalizedDetail.includes("temporarily_unavailable")
    && normalizedDetail.includes("supabase transport is temporarily paused");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRouteEvidence(page, route) {
  const expectedTitleParts = route.titleIncludes || [];
  const expectedTextParts = route.textIncludes || [];
  const waitMs = Math.min(15000, Math.max(4000, Math.round(timeoutMs * 0.6)));

  await page.waitForFunction(
    ({ expectedTitleParts, expectedTextParts }) => {
      const title = document.title.toLowerCase();
      const body = (document.body?.innerText || "").toLowerCase();
      const titleReady = expectedTitleParts.every((part) => title.includes(String(part).toLowerCase()));
      const bodyReady = expectedTextParts.every((part) => body.includes(String(part).toLowerCase()));
      const fallbackVisible = body.includes("siden kunne ikke vises korrekt lige nu");
      return fallbackVisible || (titleReady && bodyReady);
    },
    { expectedTitleParts, expectedTextParts },
    { timeout: waitMs },
  ).catch(() => {});

  if (route.templateWorkflow) {
    await page.getByRole("button", { name: new RegExp(route.templateWorkflow.designButtonPattern, "i") })
      .first()
      .waitFor({ state: "visible", timeout: waitMs })
      .catch(() => {});
    await page.getByRole("link", { name: route.templateWorkflow.downloadText, exact: false })
      .first()
      .waitFor({ state: "visible", timeout: waitMs })
      .catch(() => {});
  }

  if (route.orderWorkflow) {
    await page.waitForFunction(
      (pattern) => {
        const regex = new RegExp(pattern, "i");
        return [...document.querySelectorAll("button")]
          .some((button) => regex.test(button.textContent || "") && !button.disabled);
      },
      route.orderWorkflow.orderButtonPattern,
      { timeout: waitMs },
    ).catch(() => {});
  }

  if (route.categoryWorkflow) {
    await page.waitForFunction(
      (hrefPart) => [...document.querySelectorAll("a")]
        .some((anchor) => String(anchor.getAttribute("href") || "").includes(hrefPart)),
      route.categoryWorkflow.linkHrefIncludes,
      { timeout: waitMs },
    ).catch(() => {});
  }

  if (route.sitePreviewWorkflow) {
    await waitForSitePreviewFrame(page, route.sitePreviewWorkflow, waitMs).catch(() => {});
  }
}

async function waitForSitePreviewFrame(page, workflow, timeout) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    const frame = page.frames().find((candidate) =>
      candidate.url().includes(workflow.iframeUrlIncludes)
    );
    if (frame) {
      const frameText = await frame.locator("body").innerText({ timeout: 1000 }).catch(() => "");
      const normalizedFrameText = frameText.toLowerCase();
      const textReady = (workflow.iframeTextIncludes || []).every((part) =>
        normalizedFrameText.includes(String(part).toLowerCase())
      );
      if (textReady) return frame;
    }
    await page.waitForTimeout(250);
  }
  return null;
}

async function checkSitePreviewWorkflow(page, workflow, issues) {
  const evidence = [];
  const frame = await waitForSitePreviewFrame(page, workflow, 15000);

  if (!frame) {
    issues.push(`missing site preview iframe ${workflow.iframeUrlIncludes}`);
    return evidence;
  }

  const frameUrl = frame.url();
  if (!frameUrl.includes(workflow.iframeUrlIncludes)) {
    issues.push(`site preview iframe URL missing ${workflow.iframeUrlIncludes}`);
  }

  const frameText = await frame.locator("body").innerText().catch(() => "");
  const normalizedFrameText = frameText.toLowerCase();
  for (const expectedText of workflow.iframeTextIncludes || []) {
    if (!normalizedFrameText.includes(expectedText.toLowerCase())) {
      issues.push(`site preview iframe body missing ${expectedText}`);
    }
  }

  evidence.push("site package iframe proof");
  return evidence;
}

async function checkCategoryWorkflow(page, workflow, issues) {
  const evidence = [];
  const categoryLink = page.locator(`a[href*="${workflow.linkHrefIncludes}"]`).last();
  const categoryLinkCount = await categoryLink.count().catch(() => 0);

  if (categoryLinkCount < 1) {
    issues.push(`missing category link ${workflow.linkHrefIncludes}`);
    return evidence;
  }

  await categoryLink.click({ timeout: 10000 });
  await page.waitForURL((url) => (
    workflow.targetUrlIncludes.every((part) => decodeURIComponent(url.href).includes(part))
  ), { timeout: 15000 }).catch(() => {
    issues.push(`category target URL missing ${workflow.targetUrlIncludes.join(", ")}`);
  });
  await page.waitForTimeout(2200);

  const targetUrl = decodeURIComponent(page.url());
  for (const expectedUrlPart of workflow.targetUrlIncludes || []) {
    if (!targetUrl.includes(expectedUrlPart)) {
      issues.push(`category URL missing ${expectedUrlPart}`);
    }
  }

  const bodyText = await page.locator("body").innerText().catch(() => "");
  const normalizedBodyText = bodyText.toLowerCase();
  for (const expectedText of workflow.targetTextIncludes || []) {
    if (!normalizedBodyText.includes(expectedText.toLowerCase())) {
      issues.push(`category body missing ${expectedText}`);
    }
  }

  evidence.push("category landing drilldown");
  return evidence;
}

async function checkTemplateWorkflow(page, workflow, issues) {
  const evidence = [];
  const downloadLink = page.getByRole("link", { name: workflow.downloadText, exact: false });
  const downloadCount = await downloadLink.count().catch(() => 0);

  if (downloadCount < 1) {
    issues.push(`missing ${workflow.downloadText} link`);
  } else {
    const firstDownloadLink = downloadLink.first();
    const href = await firstDownloadLink.getAttribute("href").catch(() => "");
    const downloadName = await firstDownloadLink.getAttribute("download").catch(() => "");

    if (workflow.downloadHrefIncludes && !String(href || "").includes(workflow.downloadHrefIncludes)) {
      issues.push(`${workflow.downloadText} href missing ${workflow.downloadHrefIncludes}`);
    }
    if (workflow.downloadHrefPattern && !(new RegExp(workflow.downloadHrefPattern, "i")).test(String(href || ""))) {
      issues.push(`${workflow.downloadText} href does not match ${workflow.downloadHrefPattern}`);
    }
    if (
      workflow.downloadNameIncludes
      && !String(downloadName || "").toLowerCase().includes(String(workflow.downloadNameIncludes).toLowerCase())
    ) {
      issues.push(`${workflow.downloadText} download name missing ${workflow.downloadNameIncludes}`);
    }
    evidence.push("template download link");
  }

  const designButton = page.getByRole("button", { name: new RegExp(workflow.designButtonPattern, "i") });
  const designButtonCount = await designButton.count().catch(() => 0);
  if (designButtonCount < 1) {
    issues.push(`missing design button ${workflow.designButtonPattern}`);
    return evidence;
  }

  await designButton.first().click({ timeout: 10000 });
  await page.waitForURL(/\/designer/, { timeout: 15000 });
  await page.waitForTimeout(2200);

  const designerUrl = decodeURIComponent(page.url());
  for (const expectedUrlPart of workflow.designerUrlIncludes || []) {
    if (!designerUrl.includes(expectedUrlPart)) {
      issues.push(`designer URL missing ${expectedUrlPart}`);
    }
  }

  const designerBodyText = await page.locator("body").innerText().catch(() => "");
  const normalizedDesignerText = designerBodyText.toLowerCase();
  const designerFallback = await page.locator("text=Siden kunne ikke vises korrekt lige nu").count().catch(() => 0);

  if (designerFallback > 0) issues.push("designer runtime fallback visible");
  for (const expectedText of workflow.designerTextIncludes || []) {
    if (!normalizedDesignerText.includes(expectedText.toLowerCase())) {
      issues.push(`designer body missing ${expectedText}`);
    }
  }

  evidence.push("designer template handoff");

  if (workflow.verifyDesignerReturnToCheckout) {
    await verifyDesignerReturnToCheckout(page, issues, evidence);
  }

  return evidence;
}

async function verifyDesignerReturnToCheckout(page, issues, evidence) {
  const interceptedUploads = [];

  await page.route("**/storage/v1/object/order-files/**", async (route) => {
    interceptedUploads.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ Key: "order-files/designer-production/proof-smoke.pdf" }),
    });
  });

  const addTextButton = page.getByRole("button", { name: /Tilføj tekst/i }).first();
  const addTextCount = await addTextButton.count().catch(() => 0);
  if (addTextCount < 1) {
    issues.push("designer return proof missing text tool");
    return;
  }

  await addTextButton.click({ timeout: 10000 });
  await page.waitForTimeout(600);

  const returnButton = page.getByRole("button", { name: /Tilbage til bestilling/i }).first();
  const returnButtonCount = await returnButton.count().catch(() => 0);
  if (returnButtonCount < 1) {
    issues.push("designer return proof missing return button");
    return;
  }

  await returnButton.click({ timeout: 10000 });
  await page.waitForFunction(
    () => !window.location.pathname.includes("/designer"),
    { timeout: 25000 },
  );
  await page.waitForTimeout(2200);

  const returnUrl = decodeURIComponent(page.url());
  if (!returnUrl.includes("force_domain=www.salgsmapper.dk")) {
    issues.push("designer return URL missing Salgsmapper domain context");
  }

  if (!returnUrl.includes("/checkout/konfigurer")) {
    await page.goto(resolveUrl("/checkout/konfigurer?force_domain=www.salgsmapper.dk"), {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    await page.waitForTimeout(2200);
  }

  if (interceptedUploads.length < 1) {
    issues.push("designer return proof did not generate production upload");
  }

  const checkoutBodyText = await page.locator("body").innerText().catch(() => "");
  const normalizedCheckoutText = checkoutBodyText.toLowerCase();
  for (const expectedText of ["Designer-PDF", "Genereret i designeren og klar til ordre"]) {
    if (!normalizedCheckoutText.includes(expectedText.toLowerCase())) {
      issues.push(`designer return checkout body missing ${expectedText}`);
    }
  }

  const checkoutSession = await page.evaluate(() => {
    const raw = window.sessionStorage.getItem("wp_site_checkout_session");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }).catch(() => null);

  if (!checkoutSession?.designerExport?.fileUrl) {
    issues.push("designer return checkout session missing designerExport");
  }
  if (checkoutSession?.designerExport?.sourceMode !== "print_pdf") {
    issues.push(`designer return sourceMode ${checkoutSession?.designerExport?.sourceMode || "missing"}`);
  }

  evidence.push("designer production PDF return");
}

async function checkOrderWorkflow(page, workflow, issues) {
  const evidence = [];
  const orderButton = page.getByRole("button", { name: new RegExp(workflow.orderButtonPattern, "i") });
  const orderButtonCount = await orderButton.count().catch(() => 0);

  if (orderButtonCount < 1) {
    issues.push(`missing order button ${workflow.orderButtonPattern}`);
    return evidence;
  }

  await page.waitForFunction(
    (pattern) => {
      const regex = new RegExp(pattern, "i");
      return [...document.querySelectorAll("button")]
        .some((button) => regex.test(button.textContent || "") && !button.disabled);
    },
    workflow.orderButtonPattern,
    { timeout: 15000 },
  ).catch(() => {
    issues.push(`order button ${workflow.orderButtonPattern} did not become enabled`);
  });

  if (issues.some((issue) => issue.includes(`order button ${workflow.orderButtonPattern}`))) {
    return evidence;
  }

  await orderButton.first().click({ timeout: 10000 });
  await page.waitForURL(/\/checkout\/konfigurer/, { timeout: 15000 });
  await page.waitForTimeout(2200);

  const checkoutUrl = decodeURIComponent(page.url());
  for (const expectedUrlPart of workflow.checkoutUrlIncludes || []) {
    if (!checkoutUrl.includes(expectedUrlPart)) {
      issues.push(`checkout URL missing ${expectedUrlPart}`);
    }
  }

  const checkoutBodyText = await page.locator("body").innerText().catch(() => "");
  const normalizedCheckoutText = checkoutBodyText.toLowerCase();
  const checkoutFallback = await page.locator("text=Siden kunne ikke vises korrekt lige nu").count().catch(() => 0);

  if (checkoutFallback > 0) issues.push("checkout runtime fallback visible");
  for (const expectedText of workflow.checkoutTextIncludes || []) {
    if (!normalizedCheckoutText.includes(expectedText.toLowerCase())) {
      issues.push(`checkout body missing ${expectedText}`);
    }
  }

  const checkoutSession = await page.evaluate(() => {
    const raw = window.sessionStorage.getItem("wp_site_checkout_session");
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }).catch(() => null);

  if (!checkoutSession) {
    issues.push("missing checkout session");
    return evidence;
  }

  const expectedSession = workflow.session || {};
  if (expectedSession.productSlug && checkoutSession.productSlug !== expectedSession.productSlug) {
    issues.push(`checkout session productSlug ${checkoutSession.productSlug || "missing"}`);
  }
  if (expectedSession.productName && checkoutSession.productName !== expectedSession.productName) {
    issues.push(`checkout session productName ${checkoutSession.productName || "missing"}`);
  }
  if (
    expectedSession.selectedVariantIncludes
    && !String(checkoutSession.selectedVariant || "").toLowerCase().includes(expectedSession.selectedVariantIncludes.toLowerCase())
  ) {
    issues.push(`checkout session selectedVariant missing ${expectedSession.selectedVariantIncludes}`);
  }
  if (
    expectedSession.selectedFormatIncludes
    && !String(checkoutSession.selectedFormat || "").toLowerCase().includes(expectedSession.selectedFormatIncludes.toLowerCase())
  ) {
    issues.push(`checkout session selectedFormat missing ${expectedSession.selectedFormatIncludes}`);
  }
  if (Number(checkoutSession.productPrice || 0) < Number(expectedSession.minProductPrice || 0)) {
    issues.push(`checkout session productPrice ${checkoutSession.productPrice || 0}`);
  }
  if (Number(checkoutSession.totalPrice || 0) < Number(expectedSession.minTotalPrice || 0)) {
    issues.push(`checkout session totalPrice ${checkoutSession.totalPrice || 0}`);
  }
  if (Number(checkoutSession.quantity || 0) < Number(expectedSession.minQuantity || 0)) {
    issues.push(`checkout session quantity ${checkoutSession.quantity || 0}`);
  }
  if (
    typeof expectedSession.areaM2 === "number"
    && Number(checkoutSession.pricingQuote?.areaM2 || 0) !== expectedSession.areaM2
  ) {
    issues.push(`checkout session areaM2 ${checkoutSession.pricingQuote?.areaM2 || "missing"}`);
  }

  evidence.push("order checkout handoff");
  return evidence;
}
