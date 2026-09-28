export type ExtractedPriceCandidate = {
  quantity: number;
  supplierPrice: number;
  currency: string;
  source: "visible_text" | "json_ld";
};

export type SupplierUrlExtraction = {
  title: string | null;
  description: string | null;
  prices: ExtractedPriceCandidate[];
  warnings: string[];
};

const normalizeText = (value: unknown) => String(value || "").replace(/\s+/g, " ").trim();

const decodeHtml = (value: string) => value
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">");

const stripTags = (value: string) => normalizeText(decodeHtml(
  value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " "),
));

const parsePrice = (value: unknown) => {
  const raw = normalizeText(value).replace(/[^0-9,.-]/g, "");
  if (!raw) return null;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : null;
};

const readAttribute = (tag: string, name: string) => {
  const pattern = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  return decodeHtml(pattern.exec(tag)?.[1] || "").trim() || null;
};

const readMetaContent = (html: string, key: string) => {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const property = readAttribute(tag, "property") || readAttribute(tag, "name");
    if (property?.toLowerCase() !== key.toLowerCase()) continue;
    const content = readAttribute(tag, "content");
    if (content) return normalizeText(content);
  }
  return null;
};

const readFirstTagText = (html: string, tagName: string) => {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = pattern.exec(html);
  return match ? stripTags(match[1]) || null : null;
};

const collectJsonLdOffers = (value: unknown, output: ExtractedPriceCandidate[]) => {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectJsonLdOffers(entry, output));
    return;
  }
  if (!value || typeof value !== "object") return;

  const row = value as Record<string, unknown>;
  const price = parsePrice(row.price ?? row.lowPrice);
  const eligibleQuantity = row.eligibleQuantity && typeof row.eligibleQuantity === "object"
    ? row.eligibleQuantity as Record<string, unknown>
    : null;
  const quantity = Number(eligibleQuantity?.value ?? row.quantity);
  const currency = normalizeText(row.priceCurrency || "EUR").toUpperCase();

  if (price && Number.isInteger(quantity) && quantity > 0) {
    output.push({ quantity, supplierPrice: price, currency, source: "json_ld" });
  }

  Object.values(row).forEach((entry) => collectJsonLdOffers(entry, output));
};

const extractJsonLdPrices = (html: string) => {
  const prices: ExtractedPriceCandidate[] = [];
  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const script of scripts) {
    const body = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    if (!body) continue;
    try {
      collectJsonLdOffers(JSON.parse(body), prices);
    } catch {
      // Invalid third-party JSON-LD is ignored; visible extraction can still succeed.
    }
  }
  return prices;
};

const extractVisiblePrices = (html: string) => {
  const text = stripTags(html);
  const prices: ExtractedPriceCandidate[] = [];
  const patterns = [
    /(\d{1,7})\s*(?:stk\.?|stück|stueck|exemplare|auflage)\b.{0,100}?(\d{1,7}(?:[.,]\d{2}))\s*(?:€|eur)/gi,
    /(?:^|\s)(\d{1,7})\s+(?:ab\s+)?(\d{1,7}(?:[.,]\d{2}))\s*(?:€|eur)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const quantity = Number(match[1]);
      const supplierPrice = parsePrice(match[2]);
      if (!Number.isInteger(quantity) || quantity <= 0 || !supplierPrice) continue;
      prices.push({ quantity, supplierPrice, currency: "EUR", source: "visible_text" });
    }
  }

  return prices;
};

const deduplicatePrices = (prices: ExtractedPriceCandidate[]) => {
  const seen = new Set<string>();
  return prices
    .filter((row) => {
      const key = `${row.quantity}:${row.supplierPrice.toFixed(4)}:${row.currency}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.quantity - right.quantity || left.supplierPrice - right.supplierPrice);
};

export function extractSupplierProductHtml(html: string): SupplierUrlExtraction {
  const title = readMetaContent(html, "og:title")
    || readFirstTagText(html, "h1")
    || readFirstTagText(html, "title");
  const description = readMetaContent(html, "description")
    || readMetaContent(html, "og:description");
  const prices = deduplicatePrices([
    ...extractJsonLdPrices(html),
    ...extractVisiblePrices(html),
  ]);
  const warnings: string[] = [];

  if (!title) warnings.push("Produktnavnet kunne ikke læses sikkert fra siden.");
  if (prices.length === 0) {
    warnings.push("Siden viser ikke en statisk mængde/prismatrix. Dynamisk leverandørudtræk er nødvendigt.");
  }

  const duplicateQuantities = new Set<number>();
  const quantityCounts = new Map<number, number>();
  prices.forEach((row) => quantityCounts.set(row.quantity, (quantityCounts.get(row.quantity) || 0) + 1));
  quantityCounts.forEach((count, quantity) => {
    if (count > 1) duplicateQuantities.add(quantity);
  });
  if (duplicateQuantities.size > 0) {
    warnings.push("Flere priser blev fundet for samme oplag. Valgmulighederne skal gennemgås før import.");
  }

  return {
    title: title ? normalizeText(title) : null,
    description: description ? normalizeText(description) : null,
    prices,
    warnings,
  };
}
