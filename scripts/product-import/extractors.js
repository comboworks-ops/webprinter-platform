const DEFAULT_FIRECRAWL_BASE = "https://api.firecrawl.dev/v1";

function normalizeTexts(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function pickFirecrawlItems(payload) {
  const candidatePaths = [
    payload?.data?.json?.items,
    payload?.json?.items,
    payload?.data?.items,
    payload?.items,
    payload?.data?.extract?.items,
    payload?.extract?.items,
  ];

  for (const candidate of candidatePaths) {
    const normalized = normalizeTexts(candidate);
    if (normalized.length > 0) return normalized;
  }

  return [];
}

export async function extractWithFirecrawl({ url, ulSelector }) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY not configured");
  }

  const baseUrl = process.env.FIRECRAWL_API_BASE || DEFAULT_FIRECRAWL_BASE;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(`${baseUrl}/scrape`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        onlyMainContent: false,
        formats: [
          {
            type: "json",
            prompt:
              `Extract plain text from all <li> elements inside the <ul> matching CSS selector "${ulSelector}". Return only text values in an items array.`,
            schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Firecrawl HTTP ${response.status}: ${body}`);
    }

    const payload = await response.json();
    const items = pickFirecrawlItems(payload);

    if (items.length === 0) {
      throw new Error("Firecrawl returned no LI texts for selector");
    }

    return {
      provider: "firecrawl",
      liTexts: items,
      payload,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function extractWithPlaywright({ url, ulSelector }) {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright fallback unavailable: install playwright (e.g. pnpm add -D playwright)"
    );
  }

  const browser = await playwright.chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });

    const result = await page.evaluate((selector) => {
      const hasPassword = Boolean(document.querySelector('input[type="password"]'));
      const ul = document.querySelector(selector);

      if (!ul) {
        return {
          hasPassword,
          items: [],
          error: `No element found for selector: ${selector}`,
        };
      }

      const items = Array.from(ul.querySelectorAll("li"))
        .map((el) => (el.textContent || "").trim())
        .filter((text) => text.length > 0);

      return {
        hasPassword,
        items,
        error: null,
      };
    }, ulSelector);

    if (result.hasPassword) {
      throw new Error("Page appears to require login; credentials are not supported by importer");
    }

    if (!result.items || result.items.length === 0) {
      throw new Error(result.error || "Playwright found no LI texts under selector");
    }

    return {
      provider: "playwright",
      liTexts: result.items,
      payload: result,
    };
  } finally {
    await browser.close();
  }
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&euro;/gi, "€")
    .replace(/\s+/g, " ")
    .trim();
}

function getAttrValue(tag, attrName) {
  const pattern = new RegExp(`${attrName}\\s*=\\s*["']([^"']+)["']`, "i");
  const match = tag.match(pattern);
  return match ? match[1] : "";
}

function selectorMatchesUlTag(openTag, selector) {
  const normalized = selector.trim();
  if (!normalized || normalized === "ul") return true;

  const id = getAttrValue(openTag, "id");
  const classAttr = getAttrValue(openTag, "class");
  const classSet = new Set(classAttr.split(/\s+/).filter(Boolean));

  if (normalized.startsWith("#")) {
    return id === normalized.slice(1);
  }
  if (normalized.startsWith(".")) {
    return classSet.has(normalized.slice(1));
  }

  const ulIdMatch = normalized.match(/^ul#([a-zA-Z0-9_-]+)$/);
  if (ulIdMatch) return id === ulIdMatch[1];

  const ulClassMatch = normalized.match(/^ul\.([a-zA-Z0-9_-]+)$/);
  if (ulClassMatch) return classSet.has(ulClassMatch[1]);

  return false;
}

export async function extractWithStaticHtml({ url, ulSelector }) {
  const response = await fetch(url, {
    method: "GET",
    headers: { "User-Agent": "webprinter-blueprint-importer/1.0" },
  });

  if (!response.ok) {
    throw new Error(`Static fetch HTTP ${response.status}`);
  }

  const html = await response.text();
  const ulMatches = Array.from(html.matchAll(/<ul\b[^>]*>[\s\S]*?<\/ul>/gi));

  if (ulMatches.length === 0) {
    throw new Error("No <ul> elements found in HTML");
  }

  const target = ulMatches.find((match) => {
    const [ulBlock] = match;
    const openTagMatch = ulBlock.match(/^<ul\b[^>]*>/i);
    if (!openTagMatch) return false;
    return selectorMatchesUlTag(openTagMatch[0], ulSelector);
  });

  if (!target) {
    throw new Error(`No <ul> matched selector: ${ulSelector}`);
  }

  const ulHtml = target[0];
  const liTexts = Array.from(ulHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi))
    .map((liMatch) => stripTags(liMatch[1] || ""))
    .filter(Boolean);

  if (liTexts.length === 0) {
    throw new Error("Matched <ul> has no <li> items");
  }

  return {
    provider: "static-html",
    liTexts,
    payload: {
      selector: ulSelector,
      itemCount: liTexts.length,
    },
  };
}

export async function extractLiTexts({ url, ulSelector }) {
  try {
    return await extractWithFirecrawl({ url, ulSelector });
  } catch (firecrawlError) {
    try {
      const fallback = await extractWithPlaywright({ url, ulSelector });
      return {
        ...fallback,
        firecrawlError:
          firecrawlError instanceof Error ? firecrawlError.message : String(firecrawlError),
      };
    } catch (playwrightError) {
      const staticFallback = await extractWithStaticHtml({ url, ulSelector });
      return {
        ...staticFallback,
        firecrawlError:
          firecrawlError instanceof Error ? firecrawlError.message : String(firecrawlError),
        playwrightError:
          playwrightError instanceof Error ? playwrightError.message : String(playwrightError),
      };
    }
  }
}
