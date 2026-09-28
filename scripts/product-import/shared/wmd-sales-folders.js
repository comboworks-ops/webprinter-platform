/**
 * Pure normalization helpers for WIRmachenDRUCK presentation folders.
 *
 * This module deliberately has no filesystem, network, database, pricing, or
 * interpolation behavior. It only translates supplier evidence that a caller
 * has already collected into deterministic, reviewable rows.
 */

const FORMAT_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "a3", labelDa: "A3", widthMm: 297, heightMm: 420 }),
  Object.freeze({ key: "a4", labelDa: "A4", widthMm: 210, heightMm: 297 }),
  Object.freeze({ key: "a5", labelDa: "A5", widthMm: 148, heightMm: 210 }),
  Object.freeze({ key: "a6", labelDa: "A6", widthMm: 105, heightMm: 148 }),
  Object.freeze({ key: "din-lang", labelDa: "DIN lang", widthMm: 105, heightMm: 210 }),
  Object.freeze({
    key: "square-21x21",
    labelDa: "21 × 21 cm",
    widthMm: 210,
    heightMm: 210,
  }),
  Object.freeze({
    key: "cd-135x135",
    labelDa: "CD-mappe 13,5 × 13,5 cm",
    widthMm: 135,
    heightMm: 135,
  }),
]);

const CONSTRUCTION_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: "2-part-standard",
    labelDa: "2-delt standardmappe",
    partCount: 2,
    flapCount: null,
    windowPunch: false,
    closure: false,
  }),
  Object.freeze({
    key: "2-part-2-flaps",
    labelDa: "2-delt med 2 flapper",
    partCount: 2,
    flapCount: 2,
    windowPunch: false,
    closure: false,
  }),
  Object.freeze({
    key: "2-part-3-flaps",
    labelDa: "2-delt med 3 flapper",
    partCount: 2,
    flapCount: 3,
    windowPunch: false,
    closure: false,
  }),
  Object.freeze({
    key: "3-part-1-flap",
    labelDa: "3-delt med 1 flap",
    partCount: 3,
    flapCount: 1,
    windowPunch: false,
    closure: false,
  }),
  Object.freeze({
    key: "2-part-standard-window",
    labelDa: "2-delt standardmappe med vinduesudstansning",
    partCount: 2,
    flapCount: null,
    windowPunch: true,
    closure: false,
  }),
  Object.freeze({
    key: "2-part-2-flaps-window",
    labelDa: "2-delt med 2 flapper og vinduesudstansning",
    partCount: 2,
    flapCount: 2,
    windowPunch: true,
    closure: false,
  }),
  Object.freeze({
    key: "2-part-3-flaps-window",
    labelDa: "2-delt med 3 flapper og vinduesudstansning",
    partCount: 2,
    flapCount: 3,
    windowPunch: true,
    closure: false,
  }),
  Object.freeze({
    key: "2-part-closure",
    labelDa: "2-delt med lukning",
    partCount: 2,
    flapCount: null,
    windowPunch: false,
    closure: true,
  }),
]);

const PAPER_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: "chromo-mappekarton",
    labelDa: "Chromo mappekarton",
    pattern: /\b(?:postkarten[-\s]*)?chromokarton\b/,
  }),
  Object.freeze({
    key: "matt-billedtrykskarton",
    labelDa: "Mat billedtrykskarton",
    pattern: /\bbilderdruck(?:s)?karton\b/,
  }),
  Object.freeze({
    key: "hoejhvid-naturkarton",
    labelDa: "Højhvid naturkarton",
    pattern: /\bnaturkarton\b/,
  }),
  Object.freeze({
    key: "hvid-genbrugskarton",
    labelDa: "Hvid genbrugskarton",
    pattern: /\brecyclingkarton\b/,
  }),
]);

const FINISH_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "none", labelDa: "Ingen efterbehandling" }),
  Object.freeze({ key: "high-gloss-uv", labelDa: "Højglans UV-lak" }),
  Object.freeze({ key: "partial-uv", labelDa: "Partiel UV-lak" }),
  Object.freeze({ key: "matt-lamination", labelDa: "Mat laminering" }),
  Object.freeze({ key: "gloss-lamination", labelDa: "Blank laminering" }),
  Object.freeze({ key: "soft-touch-lamination", labelDa: "Soft-touch-laminering" }),
  Object.freeze({
    key: "soft-touch-partial-uv",
    labelDa: "Soft-touch-laminering + partiel UV-lak",
  }),
  Object.freeze({ key: "hot-foil-gold", labelDa: "Guldfoliepræg" }),
  Object.freeze({ key: "hot-foil-silver", labelDa: "Sølvfoliepræg" }),
  Object.freeze({ key: "blind-emboss", labelDa: "Blindpræg" }),
]);

const PRINT_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "4+0", labelDa: "4+0 – tryk på ydersiden" }),
  Object.freeze({ key: "4+4", labelDa: "4+4 – tryk på yder- og indersiden" }),
]);

const ALLOWED_SPINE_DEPTHS_MM = Object.freeze([1, 3, 5, 10]);
const PRICE_EVIDENCE_TOLERANCE_EUR = 0.01;

export const WMD_SALES_FOLDER_SOURCE_ORDER = Object.freeze({
  format: Object.freeze(FORMAT_DEFINITIONS.map((item) => item.key)),
  construction: Object.freeze(CONSTRUCTION_DEFINITIONS.map((item) => item.key)),
  print: Object.freeze(PRINT_DEFINITIONS.map((item) => item.key)),
  finish: Object.freeze(FINISH_DEFINITIONS.map((item) => item.key)),
  paper: Object.freeze(PAPER_DEFINITIONS.map((item) => item.key)),
  spineDepthMm: ALLOWED_SPINE_DEPTHS_MM,
});

export const WMD_SALES_FOLDER_DANISH_LABELS = Object.freeze({
  format: Object.freeze(
    Object.fromEntries(FORMAT_DEFINITIONS.map((item) => [item.key, item.labelDa]))
  ),
  construction: Object.freeze(
    Object.fromEntries(CONSTRUCTION_DEFINITIONS.map((item) => [item.key, item.labelDa]))
  ),
  print: Object.freeze(
    Object.fromEntries(PRINT_DEFINITIONS.map((item) => [item.key, item.labelDa]))
  ),
  finish: Object.freeze(
    Object.fromEntries(FINISH_DEFINITIONS.map((item) => [item.key, item.labelDa]))
  ),
  paper: Object.freeze(
    Object.fromEntries(PAPER_DEFINITIONS.map((item) => [item.key, item.labelDa]))
  ),
});

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceString(value) {
  return value == null ? "" : String(value);
}

function decodeText(value) {
  const text = normalizeWhitespace(value);
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function normalizeForMatch(value) {
  return decodeText(value)
    .toLocaleLowerCase("de-DE")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-");
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function definitionFor(definitions, key) {
  return definitions.find((item) => item.key === key) || null;
}

function coerceSource(source, titleArgument) {
  if (source && typeof source === "object" && !Array.isArray(source)) {
    return {
      url: sourceString(source.url ?? source.detailUrl ?? source.sourceUrl),
      title: sourceString(
        source.title ?? source.sourceTitle ?? source.productTitle ?? titleArgument
      ),
    };
  }

  const value = sourceString(source);
  const comparableValue = normalizeWhitespace(value);
  const looksLikeUrl =
    /^(?:https?:\/\/|www\.)/i.test(comparableValue) || /\.html(?:[?#]|$)/i.test(comparableValue);
  return {
    url: looksLikeUrl ? value : "",
    title: sourceString(titleArgument || (looksLikeUrl ? "" : value)),
  };
}

function classifyFormat(text) {
  if (/\b(?:cd[-_\s]*(?:verpackung|mappe)|cdverpackung)\b/.test(text)) {
    return definitionFor(FORMAT_DEFINITIONS, "cd-135x135");
  }

  const dinLangMatch = text.match(/\bdin[-_\s]*lang\b/);
  if (dinLangMatch) return definitionFor(FORMAT_DEFINITIONS, "din-lang");

  const dinMatch = text.match(/\bdin[-_\s]*a([3-6])\b/);
  if (dinMatch) return definitionFor(FORMAT_DEFINITIONS, `a${dinMatch[1]}`);

  const compactDinMatch = text.match(/\bformat[-_\s]*a([3-6])\b/);
  if (compactDinMatch) return definitionFor(FORMAT_DEFINITIONS, `a${compactDinMatch[1]}`);

  const dimensionMatch = text.match(
    /(?:quadrat[-_\s]*)?(\d{1,3}(?:[.,]\d+)?)\s*[-_\s]*x\s*[-_\s]*(\d{1,3}(?:[.,]\d+)?)\s*(mm|cm)?\b/
  );
  if (!dimensionMatch) return null;

  const first = Number(dimensionMatch[1].replace(",", "."));
  const second = Number(dimensionMatch[2].replace(",", "."));
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

  const unit = dimensionMatch[3] || "cm";
  const widthMm = unit === "mm" ? first : first * 10;
  const heightMm = unit === "mm" ? second : second * 10;
  if (widthMm === 210 && heightMm === 210) {
    return definitionFor(FORMAT_DEFINITIONS, "square-21x21");
  }

  const key = `custom-${String(widthMm).replace(".", "_")}x${String(heightMm).replace(".", "_")}-mm`;
  const labelDa =
    unit === "mm"
      ? `${formatDecimalDa(first)} × ${formatDecimalDa(second)} mm`
      : `${formatDecimalDa(first)} × ${formatDecimalDa(second)} cm`;
  return Object.freeze({ key, labelDa, widthMm, heightMm });
}

function formatDecimalDa(value) {
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

function classifyConstruction(text) {
  const windowPunch = /\bfensterstanzung\b|\bmit[-_\s]+fenster\b/.test(text);
  const closure = /\bverschluss\b/.test(text);
  const numericPartMatch = text.match(/\b(\d+)[-\s]*(?:teilig|geteilt|part)\b/);
  const partCount = numericPartMatch
    ? Number(numericPartMatch[1])
    : /\bzweiteilig\b/.test(text)
      ? 2
      : /\bdreiteilig\b/.test(text)
        ? 3
        : null;
  const numericFlapMatch = text.match(/\b(\d+)[-\s]*(?:laschen?|klappen?|tabs?)\b/);
  const hasSingularFlap = /\bmit[-_\s]+(?:einer?[-_\s]+)?(?:lasche|klappe|tab)\b/.test(text);
  const flapCount = numericFlapMatch ? Number(numericFlapMatch[1]) : hasSingularFlap ? 1 : null;
  const isPresentationFolder =
    /\bpraesentationsmappen?\b/.test(text) ||
    /\bmappe[-_\s]+fuer[-_\s]+(?:din|quadrat|cd)/.test(text);

  if (closure) {
    if (partCount != null && partCount !== 2) return null;
    return definitionFor(CONSTRUCTION_DEFINITIONS, "2-part-closure");
  }

  let construction = null;
  if (Number.isInteger(partCount) && Number.isInteger(flapCount)) {
    const key = `${partCount}-part-${flapCount}-${flapCount === 1 ? "flap" : "flaps"}`;
    construction =
      definitionFor(CONSTRUCTION_DEFINITIONS, key) ||
      {
        key,
        labelDa: `${partCount}-delt med ${flapCount} ${flapCount === 1 ? "flap" : "flapper"}`,
        partCount,
        flapCount,
        windowPunch: false,
        closure: false,
      };
  } else if ((partCount == null || partCount === 2) && isPresentationFolder) {
    construction = definitionFor(CONSTRUCTION_DEFINITIONS, "2-part-standard");
  }

  if (!construction || !windowPunch) return construction;
  const windowKey = `${construction.key}-window`;
  return (
    definitionFor(CONSTRUCTION_DEFINITIONS, windowKey) || {
      ...construction,
      key: windowKey,
      labelDa: `${construction.labelDa} med vinduesudstansning`,
      windowPunch: true,
    }
  );
}

function classifyPrint(text) {
  if (/\b4\s*(?:\+|\/)\s*0\b/.test(text) || /\b40[-_\s]*farbig\b/.test(text)) {
    return definitionFor(PRINT_DEFINITIONS, "4+0");
  }
  if (/\b4\s*(?:\+|\/)\s*4\b/.test(text) || /\b44[-_\s]*farbig\b/.test(text)) {
    return definitionFor(PRINT_DEFINITIONS, "4+4");
  }
  return null;
}

function finishDefinition(key) {
  return definitionFor(FINISH_DEFINITIONS, key);
}

function classifyFinish(text) {
  const hasSoftTouch = /\b(?:soft[-_\s]*(?:feel|touch)|softfeel(?:folie)?)\b/.test(text);
  const hasPartialUv = /\bpartiell(?:er|e|en)?[-_\s].{0,30}\buv[-_\s]*lack/.test(text);

  if (hasSoftTouch && hasPartialUv) return finishDefinition("soft-touch-partial-uv");
  if (/\bheissfolienpraegung\b.{0,20}\bgold\b|\bhot[-_\s]*foil\b.{0,20}\bgold\b/.test(text)) {
    return finishDefinition("hot-foil-gold");
  }
  if (/\bheissfolienpraegung\b.{0,20}\bsilber\b|\bhot[-_\s]*foil\b.{0,20}\bsilver\b/.test(text)) {
    return finishDefinition("hot-foil-silver");
  }
  if (/\bblindpraegung\b|\bblind[-_\s]*(?:emboss|praeg)\w*/.test(text)) {
    return finishDefinition("blind-emboss");
  }
  if (/\bhochglanz[-_\s]*uv[-_\s]*lack\b|\buv[-_\s]*lack\b.{0,20}\bhochglanz\b/.test(text)) {
    return finishDefinition("high-gloss-uv");
  }
  if (hasPartialUv) return finishDefinition("partial-uv");
  if (/\bmatt(?:folie|folien)?(?:[-_\s]*kasch\w*)?\b|\bmatte?[-_\s]*laminier\w*/.test(text)) {
    return finishDefinition("matt-lamination");
  }
  if (/\bglanz(?:folie|folien)?(?:[-_\s]*kasch\w*)?\b|\bgloss[-_\s]*lamin\w*/.test(text)) {
    return finishDefinition("gloss-lamination");
  }
  if (hasSoftTouch) return finishDefinition("soft-touch-lamination");

  // An otherwise recognized, plain folder URL has no finishing suffix.
  // If evidence explicitly says "printed with ..." but that suffix is unknown,
  // retain the uncertainty instead of silently calling it unfinished.
  if (/\bbedruckt[-_\s]+mit[-_\s]+/.test(text)) return null;
  return finishDefinition("none");
}

/**
 * Classify one supplier URL/title without fetching it.
 */
export function classifyWmdSalesFolderSource(source, titleArgument) {
  const supplierSource = coerceSource(source, titleArgument);
  const combined = normalizeForMatch(`${supplierSource.url} ${supplierSource.title}`);
  const format = classifyFormat(combined);
  const construction = classifyConstruction(combined);
  const print = classifyPrint(combined);
  const finish = classifyFinish(combined);
  const unclassifiedDimensions = [];

  if (!format) unclassifiedDimensions.push("format");
  if (!construction) unclassifiedDimensions.push("construction");
  if (!print) unclassifiedDimensions.push("print");
  if (!finish) unclassifiedDimensions.push("finish");

  return {
    formatKey: format?.key ?? null,
    formatLabelDa: format?.labelDa ?? null,
    widthMm: format?.widthMm ?? null,
    heightMm: format?.heightMm ?? null,
    constructionKey: construction?.key ?? null,
    constructionLabelDa: construction?.labelDa ?? null,
    partCount: construction?.partCount ?? null,
    flapCount: construction?.flapCount ?? null,
    windowPunch: construction?.windowPunch ?? /\bfensterstanzung\b|\bmit[-_\s]+fenster\b/.test(combined),
    closure: construction?.closure ?? /\bverschluss\b/.test(combined),
    printMode: print?.key ?? null,
    printLabelDa: print?.labelDa ?? null,
    finishKey: finish?.key ?? null,
    finishLabelDa: finish?.labelDa ?? null,
    classified: unclassifiedDimensions.length === 0,
    unclassifiedDimensions,
    sourceUrl: supplierSource.url || null,
    sourceTitle: supplierSource.title || null,
  };
}

function parseSpineDepthMm(text) {
  const patterns = [
    /\bfuer\s+(?:eine\s+)?(?:ca\.?\s*)?(?:(?:mappen[-\s]*)?fuellhoehe\s+(?:von\s+)?)?(\d{1,2})\s*mm\b/,
    /\bmappen[-\s]*fuellhoehe[^\d]{0,16}(\d{1,2})\s*mm\b/,
    /\b(\d{1,2})\s*mm\s+(?:mappen[-\s]*)?fuellhoehe\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

/**
 * Parse a supplier material label. The paper identity and folder fill/spine
 * depth are intentionally separate dimensions.
 */
export function parseWmdSalesFolderMaterial(label) {
  const sourceLabel = sourceString(label);
  const comparable = normalizeForMatch(sourceLabel);
  const paper = PAPER_DEFINITIONS.find((definition) => definition.pattern.test(comparable)) || null;
  const grammageMatch = comparable.match(/\b(\d{2,4})\s*g(?:\s*\/\s*(?:m2|qm))?\b/);
  const caliperMatch = comparable.match(/\b(\d+(?:[.,]\d+)?)\s*mm\s+stark/);
  const parsedSpineDepthMm = parseSpineDepthMm(comparable);
  const spineDepthMm = ALLOWED_SPINE_DEPTHS_MM.includes(parsedSpineDepthMm)
    ? parsedSpineDepthMm
    : null;
  const unclassifiedDimensions = [];

  if (!paper) unclassifiedDimensions.push("paper");
  if (spineDepthMm == null) unclassifiedDimensions.push("spineDepthMm");

  return {
    paperKey: paper?.key ?? null,
    paperLabelDa: paper
      ? `${grammageMatch?.[1] ? `${grammageMatch[1]}g ` : ""}${paper.labelDa}`
      : null,
    grammageGsm: grammageMatch ? Number(grammageMatch[1]) : null,
    caliperMm: caliperMatch ? Number(caliperMatch[1].replace(",", ".")) : null,
    spineDepthMm,
    parsedSpineDepthMm,
    isFscCertified: /\bfsc\b/.test(comparable),
    classified: unclassifiedDimensions.length === 0,
    unclassifiedDimensions,
    sourceLabel,
  };
}

function parseGermanNumber(value) {
  let normalized = normalizeWhitespace(value).replace(/[^\d.,+-]/g, "");
  if (!normalized) return null;

  const commaIndex = normalized.lastIndexOf(",");
  const dotIndex = normalized.lastIndexOf(".");
  if (commaIndex >= 0 && dotIndex >= 0) {
    if (commaIndex > dotIndex) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (commaIndex >= 0) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Parse labels such as `1.000 Stück (1.234,56 Euro)`. */
export function parseWmdSalesFolderQuantityPrice(label) {
  const sourceLabel = sourceString(label);
  const comparable = normalizeForMatch(sourceLabel);
  const quantityMatch = comparable.match(/\b(\d[\d.\s]*)\s*(?:stueck|stk\.?)\b/);
  if (!quantityMatch) return null;

  const quantity = Number(quantityMatch[1].replace(/[.\s]/g, ""));
  if (!Number.isInteger(quantity) || quantity <= 0) return null;

  let totalEurToken = null;
  const explicitTotalMatch = comparable.match(
    /\b(?:gesamtpreis|gesamt|summe)\b[^\d+-]{0,20}([+-]?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|[+-]?\d+(?:[.,]\d{1,2})?)\s*(?:eur|euro|€)/
  );
  if (explicitTotalMatch) totalEurToken = explicitTotalMatch[1];

  if (!totalEurToken) {
    for (const match of comparable.matchAll(/\(([^)]*)\)/g)) {
      const contents = match[1];
      const euroTokens = Array.from(
        contents.matchAll(
          /([+-]?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|[+-]?\d+(?:[.,]\d{1,2})?)\s*(?:eur|euro|€)/g
        )
      );
      const mentionsPerUnit = /\b(?:pro|je)\s+stueck\b|\/\s*stueck\b/.test(contents);
      // WMD can show `(total Euro / unit Euro pro Stück)`. In that shape the
      // first amount is the total. A lone explicitly per-unit amount is not.
      const token = euroTokens.length > 1 || !mentionsPerUnit ? euroTokens[0]?.[1] : null;
      if (token) {
        totalEurToken = token;
        break;
      }
    }
  }

  if (!totalEurToken) {
    const euroTokens = Array.from(
      comparable.matchAll(
        /([+-]?\d{1,3}(?:[.\s]\d{3})*(?:,\d{1,2})?|[+-]?\d+(?:[.,]\d{1,2})?)\s*(?:eur|euro|€)/g
      )
    );
    const onlyPerUnit = /\b(?:pro|je)\s+stueck\b|\/\s*stueck\b/.test(comparable);
    if (!onlyPerUnit || euroTokens.length > 1) {
      totalEurToken = euroTokens.at(-1)?.[1] ?? null;
    }
  }

  const totalEur = parseGermanNumber(totalEurToken);
  if (!Number.isFinite(totalEur) || totalEur <= 0) return null;

  return {
    quantity,
    totalEur,
    currency: "EUR",
    sourceLabel,
    sourceQuantityToken: quantityMatch[1].trim(),
    sourceTotalEurToken: totalEurToken,
  };
}

const KEY_FIELDS = Object.freeze([
  ["format", "formatKey"],
  ["construction", "constructionKey"],
  ["print", "printMode"],
  ["finish", "finishKey"],
  ["paper", "paperKey"],
  ["spine_mm", "spineDepthMm"],
]);

function keyPart(name, value) {
  if (value == null || value === "") {
    throw new TypeError(`Missing ${name} for WMD sales-folder selection key`);
  }
  return `${name}=${encodeURIComponent(String(value))}`;
}

/** Build a stable key from every real selection dimension and, by default, quantity. */
export function buildWmdSalesFolderSelectionKey(row, { includeQuantity = true } = {}) {
  const parts = KEY_FIELDS.map(([name, field]) => keyPart(name, row?.[field]));
  if (includeQuantity) {
    const quantity = finitePositive(row?.quantity);
    if (!Number.isInteger(quantity)) {
      throw new TypeError("Missing quantity for WMD sales-folder selection key");
    }
    parts.push(keyPart("quantity", quantity));
  }
  return parts.join("|");
}

function compareByOrder(left, right, order) {
  const leftIndex = order.indexOf(left);
  const rightIndex = order.indexOf(right);
  if (leftIndex !== rightIndex) {
    if (leftIndex < 0) return 1;
    if (rightIndex < 0) return -1;
    return leftIndex - rightIndex;
  }
  return String(left ?? "").localeCompare(String(right ?? ""), "da");
}

export function sortWmdSalesFolderRows(rows) {
  return [...(Array.isArray(rows) ? rows : [])].sort((left, right) => {
    return (
      compareByOrder(left?.formatKey, right?.formatKey, WMD_SALES_FOLDER_SOURCE_ORDER.format) ||
      compareByOrder(
        left?.constructionKey,
        right?.constructionKey,
        WMD_SALES_FOLDER_SOURCE_ORDER.construction
      ) ||
      compareByOrder(left?.printMode, right?.printMode, WMD_SALES_FOLDER_SOURCE_ORDER.print) ||
      compareByOrder(left?.finishKey, right?.finishKey, WMD_SALES_FOLDER_SOURCE_ORDER.finish) ||
      Number(left?.spineDepthMm ?? Number.POSITIVE_INFINITY) -
        Number(right?.spineDepthMm ?? Number.POSITIVE_INFINITY) ||
      compareByOrder(left?.paperKey, right?.paperKey, WMD_SALES_FOLDER_SOURCE_ORDER.paper) ||
      Number(left?.quantity ?? Number.POSITIVE_INFINITY) -
        Number(right?.quantity ?? Number.POSITIVE_INFINITY)
    );
  });
}

function firstValue(row, fields) {
  for (const field of fields) {
    if (row?.[field] != null && row[field] !== "") return row[field];
  }
  return null;
}

export function normalizeWmdSalesFolderRow(rawRow, { sourceIndex = null } = {}) {
  const raw = rawRow && typeof rawRow === "object" ? rawRow : {};
  const sourceUrl = sourceString(firstValue(raw, ["url", "detailUrl", "sourceUrl"]));
  const sourceTitle = sourceString(
    firstValue(raw, ["title", "sourceTitle", "productTitle"])
  );
  const sourceMaterialLabel = sourceString(
    firstValue(raw, ["materialLabel", "material", "sourceMaterialLabel"])
  );
  const sourceQuantityPriceLabel = sourceString(
    firstValue(raw, ["quantityPriceLabel", "sourceOptionText", "priceLabel"])
  );
  const sourceClassification = classifyWmdSalesFolderSource({
    url: sourceUrl,
    title: sourceTitle,
  });
  const material = parseWmdSalesFolderMaterial(sourceMaterialLabel);
  const parsedQuantityPrice = parseWmdSalesFolderQuantityPrice(sourceQuantityPriceLabel);
  const numericQuantity = finitePositive(firstValue(raw, ["quantity", "qty"]));
  const numericTotalEur = finitePositive(
    firstValue(raw, ["totalEur", "supplierPrice", "supplierNetPriceEur", "eur"])
  );
  const rawSpineDepthMm = finitePositive(firstValue(raw, ["spineDepthMm", "spineMm"]));
  const validatedRawSpineDepthMm = ALLOWED_SPINE_DEPTHS_MM.includes(rawSpineDepthMm)
    ? rawSpineDepthMm
    : null;
  const effectiveSpineDepthMm =
    material.spineDepthMm ??
    (material.parsedSpineDepthMm == null ? validatedRawSpineDepthMm : null);
  const quantity = parsedQuantityPrice?.quantity ?? numericQuantity;
  const labelTotalEur = parsedQuantityPrice?.totalEur ?? null;
  const totalEur = numericTotalEur ?? labelTotalEur;
  const priceEvidenceDifferenceEur =
    numericTotalEur != null && labelTotalEur != null
      ? Number(Math.abs(numericTotalEur - labelTotalEur).toFixed(6))
      : null;
  const priceEvidenceMismatch =
    priceEvidenceDifferenceEur != null &&
    priceEvidenceDifferenceEur > PRICE_EVIDENCE_TOLERANCE_EUR + 1e-9
      ? {
          authoritativeTotalEur: numericTotalEur,
          labelTotalEur,
          differenceEur: priceEvidenceDifferenceEur,
          toleranceEur: PRICE_EVIDENCE_TOLERANCE_EUR,
        }
      : null;
  const unclassifiedDimensions = [
    ...sourceClassification.unclassifiedDimensions,
    ...material.unclassifiedDimensions.filter(
      (dimension) => dimension !== "spineDepthMm" || effectiveSpineDepthMm == null
    ),
  ];

  if (!Number.isInteger(quantity)) unclassifiedDimensions.push("quantity");
  if (!Number.isFinite(totalEur)) unclassifiedDimensions.push("totalEur");
  if (priceEvidenceMismatch) unclassifiedDimensions.push("priceEvidenceMismatch");

  const uniqueUnclassifiedDimensions = Array.from(new Set(unclassifiedDimensions));
  const normalized = {
    formatKey: sourceClassification.formatKey,
    formatLabelDa: sourceClassification.formatLabelDa,
    widthMm: sourceClassification.widthMm,
    heightMm: sourceClassification.heightMm,
    constructionKey: sourceClassification.constructionKey,
    constructionLabelDa: sourceClassification.constructionLabelDa,
    partCount: sourceClassification.partCount,
    flapCount: sourceClassification.flapCount,
    windowPunch: sourceClassification.windowPunch,
    closure: sourceClassification.closure,
    printMode: sourceClassification.printMode,
    printLabelDa: sourceClassification.printLabelDa,
    finishKey: sourceClassification.finishKey,
    finishLabelDa: sourceClassification.finishLabelDa,
    paperKey: material.paperKey,
    paperLabelDa: material.paperLabelDa,
    grammageGsm: material.grammageGsm,
    caliperMm: material.caliperMm,
    spineDepthMm: effectiveSpineDepthMm,
    quantity: Number.isInteger(quantity) ? quantity : null,
    totalEur: Number.isFinite(totalEur) ? totalEur : null,
    currency: "EUR",
    priceEvidenceMismatch,
    classified: uniqueUnclassifiedDimensions.length === 0,
    unclassifiedDimensions: uniqueUnclassifiedDimensions,
    selectionKey: null,
    source: {
      index: sourceIndex,
      url: sourceUrl || null,
      title: sourceTitle || null,
      materialLabel: sourceMaterialLabel || null,
      quantityPriceLabel: sourceQuantityPriceLabel || null,
      labelTotalEur,
      quantity: firstValue(raw, ["quantity", "qty"]),
      totalEur: firstValue(raw, ["totalEur", "supplierPrice", "supplierNetPriceEur", "eur"]),
      spineDepthMm: firstValue(raw, ["spineDepthMm", "spineMm"]),
    },
  };

  try {
    normalized.selectionKey = buildWmdSalesFolderSelectionKey(normalized);
  } catch {
    // A quarantined row can still carry a key when its selection dimensions
    // are complete. Missing selection evidence intentionally leaves it null.
  }
  return normalized;
}

function dimensionCoverage(rows, field) {
  const classifiedRows = rows.filter((row) => row?.[field] != null && row[field] !== "");
  return {
    classified: classifiedRows.length,
    unclassified: rows.length - classifiedRows.length,
    values: Array.from(new Set(classifiedRows.map((row) => row[field]))),
  };
}

export function buildWmdSalesFolderCoverageReport(rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const classifiedRows = sourceRows.filter((row) => row?.classified);
  const priceEvidenceMismatches = sourceRows
    .filter((row) => row?.priceEvidenceMismatch)
    .map((row) => ({
      selectionKey: row?.selectionKey ?? null,
      sourceIndex: row?.source?.index ?? null,
      sourceUrl: row?.source?.url ?? null,
      sourceQuantityPriceLabel: row?.source?.quantityPriceLabel ?? null,
      ...row.priceEvidenceMismatch,
    }));
  const keys = classifiedRows.map((row) => row.selectionKey).filter(Boolean);
  const duplicateKeys = Array.from(
    keys.reduce((counts, key) => counts.set(key, (counts.get(key) || 0) + 1), new Map())
  )
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));
  const selectionKeys = new Set(
    classifiedRows.map((row) => buildWmdSalesFolderSelectionKey(row, { includeQuantity: false }))
  );

  return {
    totalSourceRows: sourceRows.length,
    classifiedRows: classifiedRows.length,
    unclassifiedRows: sourceRows.length - classifiedRows.length,
    coveragePct:
      sourceRows.length === 0 ? 100 : Number(((classifiedRows.length / sourceRows.length) * 100).toFixed(2)),
    uniqueSelections: selectionKeys.size,
    uniqueSelectionQuantities: new Set(keys).size,
    duplicateSelectionQuantityKeys: duplicateKeys,
    priceEvidenceMismatchRows: priceEvidenceMismatches.length,
    priceEvidenceMismatches,
    dimensions: {
      format: dimensionCoverage(sourceRows, "formatKey"),
      construction: dimensionCoverage(sourceRows, "constructionKey"),
      print: dimensionCoverage(sourceRows, "printMode"),
      finish: dimensionCoverage(sourceRows, "finishKey"),
      paper: dimensionCoverage(sourceRows, "paperKey"),
      spineDepthMm: dimensionCoverage(sourceRows, "spineDepthMm"),
      quantity: dimensionCoverage(sourceRows, "quantity"),
      totalEur: dimensionCoverage(sourceRows, "totalEur"),
    },
    unclassified: sourceRows
      .filter((row) => !row?.classified)
      .map((row) => ({
        sourceIndex: row?.source?.index ?? null,
        sourceUrl: row?.source?.url ?? null,
        sourceTitle: row?.source?.title ?? null,
        sourceMaterialLabel: row?.source?.materialLabel ?? null,
        sourceQuantityPriceLabel: row?.source?.quantityPriceLabel ?? null,
        priceEvidenceMismatch: row?.priceEvidenceMismatch ?? null,
        dimensions: [...(row?.unclassifiedDimensions || [])],
      })),
  };
}

function collectOptions(rows, keyField, labelField, order = []) {
  const seen = new Map();
  rows.forEach((row) => {
    const key = row?.[keyField];
    if (key == null || seen.has(key)) return;
    seen.set(key, { key, labelDa: row?.[labelField] ?? String(key) });
  });
  return Array.from(seen.values()).sort((left, right) =>
    compareByOrder(left.key, right.key, order)
  );
}

/**
 * Build ordered option metadata from observed rows only. `combinations` is an
 * evidence set, not a Cartesian product, so unavailable choices stay absent.
 */
export function buildWmdSalesFolderOptionCatalog(rows) {
  const classifiedRows = sortWmdSalesFolderRows(
    (Array.isArray(rows) ? rows : []).filter((row) => row?.classified)
  );
  const combinationsByKey = new Map();

  classifiedRows.forEach((row) => {
    const selectionKey = buildWmdSalesFolderSelectionKey(row, { includeQuantity: false });
    const current = combinationsByKey.get(selectionKey) || {
      selectionKey,
      quantities: [],
      selection: {
        formatKey: row.formatKey,
        constructionKey: row.constructionKey,
        windowPunch: row.windowPunch,
        closure: row.closure,
        printMode: row.printMode,
        finishKey: row.finishKey,
        paperKey: row.paperKey,
        spineDepthMm: row.spineDepthMm,
      },
    };
    if (!current.quantities.includes(row.quantity)) current.quantities.push(row.quantity);
    current.quantities.sort((left, right) => left - right);
    combinationsByKey.set(selectionKey, current);
  });

  const formats = collectOptions(
    classifiedRows,
    "formatKey",
    "formatLabelDa",
    WMD_SALES_FOLDER_SOURCE_ORDER.format
  ).map((option) => {
    const row = classifiedRows.find((candidate) => candidate.formatKey === option.key);
    return { ...option, widthMm: row?.widthMm ?? null, heightMm: row?.heightMm ?? null };
  });

  return {
    axisOrder: ["format", "construction", "spineDepthMm", "paper", "finish", "print"],
    formats,
    constructions: collectOptions(
      classifiedRows,
      "constructionKey",
      "constructionLabelDa",
      WMD_SALES_FOLDER_SOURCE_ORDER.construction
    ),
    spineDepths: Array.from(new Set(classifiedRows.map((row) => row.spineDepthMm)))
      .sort((left, right) => left - right)
      .map((spineDepthMm) => ({
        key: String(spineDepthMm),
        spineDepthMm,
        labelDa: `${spineDepthMm} mm ryg`,
      })),
    papers: collectOptions(
      classifiedRows,
      "paperKey",
      "paperLabelDa",
      WMD_SALES_FOLDER_SOURCE_ORDER.paper
    ),
    finishes: collectOptions(
      classifiedRows,
      "finishKey",
      "finishLabelDa",
      WMD_SALES_FOLDER_SOURCE_ORDER.finish
    ),
    prints: collectOptions(
      classifiedRows,
      "printMode",
      "printLabelDa",
      WMD_SALES_FOLDER_SOURCE_ORDER.print
    ),
    combinations: Array.from(combinationsByKey.values()),
    availableSelectionKeys: Array.from(combinationsByKey.keys()),
  };
}

export function normalizeWmdSalesFolderRows(rawRows) {
  const normalizedRows = (Array.isArray(rawRows) ? rawRows : []).map((row, sourceIndex) =>
    normalizeWmdSalesFolderRow(row, { sourceIndex })
  );
  const rows = sortWmdSalesFolderRows(normalizedRows.filter((row) => row.classified));
  const unclassifiedRows = normalizedRows.filter((row) => !row.classified);
  return {
    rows,
    unclassifiedRows,
    coverage: buildWmdSalesFolderCoverageReport(normalizedRows),
  };
}

export function pruneWmdSalesFolderRetryFailures(retryFailures, resolvedSourceUrls) {
  const resolved = new Set(
    Array.from(resolvedSourceUrls || [], (value) => String(value || "")).filter(Boolean)
  );
  return (Array.isArray(retryFailures) ? retryFailures : [])
    .filter((failure) => !resolved.has(String(failure?.sourceUrl || "")));
}
