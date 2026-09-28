#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { inflateSync } from "node:zlib";
import { chromium } from "playwright";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../..");

export const ASSET_VERSION = "v1";
export const SVG_SIZE_PX = 256;
export const SVG_VIEW_BOX = "0 0 256 256";
export const WEBPRINTER_BLUE = "#0EA5E9";
export const NEUTRAL_GREY = "#64748B";
export const CONTACT_SHEET_FILE = "review-contact-sheet.svg";
export const CONTACT_SHEET_WIDTH_PX = 1216;
export const CONTACT_SHEET_HEIGHT_PX = 1544;
export const PNG_MASTER_SIZE_PX = 1024;
export const PNG_UI_SIZE_PX = 512;
export const PNG_RASTER_MANIFEST_FILE = "raster-manifest.json";
export const PNG_STYLE_KEY = "flat_clean";
export const EXCLUDED_PNG_MODEL_KEYS = Object.freeze(["cd-135x135--2-part-closure"]);

const PNG_RELATIVE_DIRECTORY = "png";
const SOURCE_MANIFEST_REPO_PATH = path.posix.join(
  "src/assets/product-options/sales-folders/models",
  ASSET_VERSION,
  "manifest.json"
);

const DEFAULT_OUTPUT_DIR = path.join(
  REPO_ROOT,
  "src/assets/product-options/sales-folders/models",
  ASSET_VERSION
);

const FORMAT_DEFINITIONS = Object.freeze({
  a4: Object.freeze({ labelDa: "A4", widthMm: 210, heightMm: 297, renderScale: 1 }),
  a5: Object.freeze({ labelDa: "A5", widthMm: 148, heightMm: 210, renderScale: 0.9 }),
  a6: Object.freeze({ labelDa: "A6", widthMm: 105, heightMm: 148, renderScale: 0.8 }),
  "din-lang": Object.freeze({
    labelDa: "DIN lang",
    widthMm: 105,
    heightMm: 210,
    renderScale: 0.95,
  }),
  "square-21x21": Object.freeze({
    labelDa: "21 × 21 cm",
    widthMm: 210,
    heightMm: 210,
    renderScale: 0.94,
  }),
  "cd-135x135": Object.freeze({
    labelDa: "CD-mappe 13,5 × 13,5 cm",
    widthMm: 135,
    heightMm: 135,
    renderScale: 0.78,
    cdMark: true,
  }),
});

const CONSTRUCTION_DEFINITIONS = Object.freeze({
  "2-part-standard": Object.freeze({
    labelDa: "2-delt standardmappe",
    partCount: 2,
    bottomFlapPanels: Object.freeze([1]),
  }),
  "2-part-2-flaps": Object.freeze({
    labelDa: "2-delt med 2 flapper",
    partCount: 2,
    bottomFlapPanels: Object.freeze([0, 1]),
  }),
  "2-part-3-flaps": Object.freeze({
    labelDa: "2-delt med 3 flapper",
    partCount: 2,
    bottomFlapPanels: Object.freeze([0, 1]),
    sideFlap: true,
  }),
  "3-part-1-flap": Object.freeze({
    labelDa: "3-delt med 1 flap",
    partCount: 3,
    bottomFlapPanels: Object.freeze([2]),
  }),
  "2-part-standard-window": Object.freeze({
    labelDa: "2-delt standardmappe med vinduesudstansning",
    partCount: 2,
    bottomFlapPanels: Object.freeze([1]),
    windowPunch: true,
  }),
  "2-part-2-flaps-window": Object.freeze({
    labelDa: "2-delt med 2 flapper og vinduesudstansning",
    partCount: 2,
    bottomFlapPanels: Object.freeze([0, 1]),
    windowPunch: true,
  }),
  "2-part-3-flaps-window": Object.freeze({
    labelDa: "2-delt med 3 flapper og vinduesudstansning",
    partCount: 2,
    bottomFlapPanels: Object.freeze([0, 1]),
    sideFlap: true,
    windowPunch: true,
  }),
  "2-part-closure": Object.freeze({
    labelDa: "2-delt med lukning",
    partCount: 2,
    bottomFlapPanels: Object.freeze([1]),
    closure: true,
  }),
});

// These are the 21 format/construction combinations observed by the bounded
// WMD category crawl and asserted in LIVE_NO_FINISH_MODELS. They are an
// evidence set, not a Cartesian product of every parser definition.
const OBSERVED_MODEL_PAIRS = Object.freeze([
  Object.freeze(["a4", "2-part-standard"]),
  Object.freeze(["a4", "2-part-2-flaps"]),
  Object.freeze(["a4", "2-part-3-flaps"]),
  Object.freeze(["a4", "3-part-1-flap"]),
  Object.freeze(["a4", "2-part-standard-window"]),
  Object.freeze(["a4", "2-part-2-flaps-window"]),
  Object.freeze(["a4", "2-part-3-flaps-window"]),
  Object.freeze(["a5", "2-part-standard"]),
  Object.freeze(["a5", "2-part-2-flaps"]),
  Object.freeze(["a5", "2-part-3-flaps"]),
  Object.freeze(["a5", "3-part-1-flap"]),
  Object.freeze(["a6", "2-part-2-flaps"]),
  Object.freeze(["a6", "2-part-3-flaps"]),
  Object.freeze(["a6", "2-part-closure"]),
  Object.freeze(["a6", "3-part-1-flap"]),
  Object.freeze(["din-lang", "2-part-2-flaps"]),
  Object.freeze(["din-lang", "2-part-3-flaps"]),
  Object.freeze(["din-lang", "2-part-closure"]),
  Object.freeze(["square-21x21", "2-part-2-flaps"]),
  Object.freeze(["square-21x21", "2-part-3-flaps"]),
  Object.freeze(["cd-135x135", "2-part-closure"]),
]);

export const MODEL_DEFINITIONS = Object.freeze(
  OBSERVED_MODEL_PAIRS.map(([formatKey, constructionKey], sourceOrder) => {
    const format = FORMAT_DEFINITIONS[formatKey];
    const construction = CONSTRUCTION_DEFINITIONS[constructionKey];
    if (!format || !construction) {
      throw new Error(`Unknown model definition: ${formatKey}--${constructionKey}`);
    }
    return Object.freeze({
      key: `${formatKey}--${constructionKey}`,
      formatKey,
      constructionKey,
      labelDa: `${format.labelDa} · ${construction.labelDa}`,
      accessibleNameDa: `Illustration af ${format.labelDa}, ${construction.labelDa}`,
      sourceOrder,
      format,
      construction,
    });
  })
);

export const APPROVED_PNG_MODEL_DEFINITIONS = Object.freeze(
  MODEL_DEFINITIONS.filter((model) => !EXCLUDED_PNG_MODEL_KEYS.includes(model.key))
);

if (APPROVED_PNG_MODEL_DEFINITIONS.length !== 20) {
  throw new Error(
    `Expected 20 approved PNG models after exclusions, found ${APPROVED_PNG_MODEL_DEFINITIONS.length}`
  );
}

function number(value) {
  return Number(value.toFixed(2));
}

function svgPathForRectangle(x, y, width, height) {
  return `M ${number(x)} ${number(y)} H ${number(x + width)} V ${number(
    y + height
  )} H ${number(x)} Z`;
}

function bottomFlapPath(x, bodyBottom, panelWidth, flapHeight) {
  const inset = Math.min(8, panelWidth * 0.1);
  return [
    `M ${number(x + 3)} ${number(bodyBottom)}`,
    `L ${number(x + panelWidth - 3)} ${number(bodyBottom)}`,
    `L ${number(x + panelWidth - inset)} ${number(bodyBottom + flapHeight)}`,
    `L ${number(x + inset)} ${number(bodyBottom + flapHeight)}`,
    "Z",
  ].join(" ");
}

function sideFlapPath(bodyRight, y, bodyHeight, flapWidth) {
  const top = y + bodyHeight * 0.35;
  const bottom = y + bodyHeight * 0.9;
  return [
    `M ${number(bodyRight)} ${number(top)}`,
    `L ${number(bodyRight + flapWidth)} ${number(top + 8)}`,
    `L ${number(bodyRight + flapWidth)} ${number(bottom - 8)}`,
    `L ${number(bodyRight)} ${number(bottom)}`,
    "Z",
  ].join(" ");
}

function iconGeometry(model) {
  const { format, construction } = model;
  const panelRatio = format.widthMm / format.heightMm;
  const bottomFlapHeight = construction.bottomFlapPanels.length > 0 ? 25 : 0;
  const sideFlapWidth = construction.sideFlap || construction.closure ? 25 : 0;
  const gap = 3;
  const margin = 22;
  const maxBodyWidth = SVG_SIZE_PX - margin * 2 - sideFlapWidth;
  const maxBodyHeight = SVG_SIZE_PX - margin * 2 - bottomFlapHeight;
  let bodyHeight = Math.min(156 * format.renderScale, maxBodyHeight);
  let panelWidth = bodyHeight * panelRatio;
  let bodyWidth = panelWidth * construction.partCount + gap * (construction.partCount - 1);

  if (bodyWidth > maxBodyWidth) {
    const fit = maxBodyWidth / bodyWidth;
    bodyHeight *= fit;
    panelWidth *= fit;
    bodyWidth = maxBodyWidth;
  }

  const totalWidth = bodyWidth + sideFlapWidth;
  const totalHeight = bodyHeight + bottomFlapHeight;
  const x = (SVG_SIZE_PX - totalWidth) / 2;
  const y = (SVG_SIZE_PX - totalHeight) / 2;

  return {
    x,
    y,
    gap,
    bodyWidth,
    bodyHeight,
    bodyRight: x + bodyWidth,
    bodyBottom: y + bodyHeight,
    panelWidth,
    bottomFlapHeight,
    sideFlapWidth,
  };
}

export function renderModelSvg(model) {
  const { format, construction } = model;
  const geometry = iconGeometry(model);
  const panelStarts = Array.from(
    { length: construction.partCount },
    (_, index) => geometry.x + index * (geometry.panelWidth + geometry.gap)
  );
  const windowPanelX = panelStarts[0];
  const windowWidth = geometry.panelWidth * 0.48;
  const windowHeight = Math.max(18, geometry.bodyHeight * 0.18);
  const windowX = windowPanelX + (geometry.panelWidth - windowWidth) / 2;
  const windowY = geometry.y + geometry.bodyHeight * 0.31;
  const bodyPath = [
    svgPathForRectangle(geometry.x, geometry.y, geometry.bodyWidth, geometry.bodyHeight),
    construction.windowPunch
      ? svgPathForRectangle(windowX, windowY, windowWidth, windowHeight)
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const body = `  <path d="${bodyPath}" fill="${WEBPRINTER_BLUE}" fill-opacity="0.1" fill-rule="evenodd" stroke="${WEBPRINTER_BLUE}" stroke-width="5" stroke-linejoin="round"/>`;
  const folds = panelStarts
    .slice(1)
    .map(
      (panelX) =>
        `  <path d="M ${number(panelX - geometry.gap / 2)} ${number(
          geometry.y + 5
        )} V ${number(geometry.bodyBottom - 5)}" fill="none" stroke="${NEUTRAL_GREY}" stroke-width="3" stroke-linecap="round" stroke-dasharray="7 7"/>`
    )
    .join("\n");
  const flaps = construction.bottomFlapPanels
    .map((panelIndex) => {
      const panelX = panelStarts[panelIndex];
      return `  <path d="${bottomFlapPath(
        panelX,
        geometry.bodyBottom,
        geometry.panelWidth,
        geometry.bottomFlapHeight
      )}" fill="${WEBPRINTER_BLUE}" fill-opacity="0.22" stroke="${WEBPRINTER_BLUE}" stroke-width="5" stroke-linejoin="round"/>`;
    })
    .join("\n");
  const sideFlap = construction.sideFlap
    ? `  <path d="${sideFlapPath(
        geometry.bodyRight,
        geometry.y,
        geometry.bodyHeight,
        geometry.sideFlapWidth
      )}" fill="${WEBPRINTER_BLUE}" fill-opacity="0.22" stroke="${WEBPRINTER_BLUE}" stroke-width="5" stroke-linejoin="round"/>`
    : "";
  const windowOutline = construction.windowPunch
    ? `  <rect x="${number(windowX)}" y="${number(windowY)}" width="${number(
        windowWidth
      )}" height="${number(
        windowHeight
      )}" rx="6" fill="none" stroke="${WEBPRINTER_BLUE}" stroke-width="4"/>`
    : "";
  const closure = construction.closure
    ? [
        `  <path d="M ${number(geometry.bodyRight)} ${number(
          geometry.y + geometry.bodyHeight * 0.46
        )} H ${number(geometry.bodyRight + geometry.sideFlapWidth)} L ${number(
          geometry.bodyRight + geometry.sideFlapWidth - 7
        )} ${number(geometry.y + geometry.bodyHeight * 0.56)} H ${number(
          geometry.bodyRight
        )} Z" fill="${WEBPRINTER_BLUE}" fill-opacity="0.28" stroke="${WEBPRINTER_BLUE}" stroke-width="5" stroke-linejoin="round"/>`,
        `  <path d="M ${number(geometry.x + geometry.panelWidth * 0.24)} ${number(
          geometry.y + geometry.bodyHeight * 0.5
        )} H ${number(geometry.x + geometry.panelWidth * 0.56)}" fill="none" stroke="${NEUTRAL_GREY}" stroke-width="5" stroke-linecap="round"/>`,
      ].join("\n")
    : "";
  const cdMark = format.cdMark
    ? [
        `  <circle cx="${number(geometry.x + geometry.panelWidth * 0.5)}" cy="${number(
          geometry.y + geometry.bodyHeight * 0.48
        )}" r="${number(Math.min(geometry.panelWidth, geometry.bodyHeight) * 0.27)}" fill="none" stroke="${NEUTRAL_GREY}" stroke-width="4"/>`,
        `  <circle cx="${number(geometry.x + geometry.panelWidth * 0.5)}" cy="${number(
          geometry.y + geometry.bodyHeight * 0.48
        )}" r="5" fill="none" stroke="${NEUTRAL_GREY}" stroke-width="3"/>`,
      ].join("\n")
    : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_SIZE_PX}" height="${SVG_SIZE_PX}" viewBox="${SVG_VIEW_BOX}" fill="none" aria-hidden="true" focusable="false">`,
    body,
    folds,
    flaps,
    sideFlap,
    windowOutline,
    closure,
    cdMark,
    "</svg>",
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapLabel(label, maximumCharacters = 31) {
  const lines = [];
  let current = "";
  for (const word of String(label).split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > maximumCharacters) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function innerSvgMarkup(svg) {
  return svg
    .replace(/^<svg[^>]*>\n?/, "")
    .replace(/\n?<\/svg>\n?$/, "")
    .trim();
}

export function renderReviewContactSheet(svgByKey) {
  const columns = 4;
  const margin = 24;
  const gap = 16;
  const headerHeight = 72;
  const tileWidth = 280;
  const tileHeight = 224;
  const iconSize = 128;
  const iconScale = iconSize / SVG_SIZE_PX;
  const rows = Math.ceil(MODEL_DEFINITIONS.length / columns);
  const expectedHeight =
    margin + headerHeight + rows * tileHeight + (rows - 1) * gap + margin;
  if (expectedHeight !== CONTACT_SHEET_HEIGHT_PX) {
    throw new Error(`Contact-sheet height drift: ${expectedHeight}`);
  }

  const cards = MODEL_DEFINITIONS.map((model, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const tileX = margin + column * (tileWidth + gap);
    const tileY = margin + headerHeight + row * (tileHeight + gap);
    const iconX = tileX + (tileWidth - iconSize) / 2;
    const iconY = tileY + 16;
    const labelLines = wrapLabel(model.labelDa);
    const labelStartY = tileY + 164;
    const labelMarkup = labelLines
      .map(
        (line, lineIndex) =>
          `      <tspan x="${tileX + tileWidth / 2}" y="${labelStartY + lineIndex * 19}">${escapeXml(line)}</tspan>`
      )
      .join("\n");
    const modelSvg = svgByKey.get(model.key);
    if (!modelSvg) throw new Error(`Missing rendered SVG for contact sheet: ${model.key}`);

    return [
      `  <g data-model-key="${escapeXml(model.key)}">`,
      `    <rect x="${tileX}" y="${tileY}" width="${tileWidth}" height="${tileHeight}" rx="14" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="2"/>`,
      `    <g transform="translate(${iconX} ${iconY}) scale(${iconScale})">`,
      innerSvgMarkup(modelSvg)
        .split("\n")
        .map((line) => `      ${line}`)
        .join("\n"),
      "    </g>",
      `    <text x="${tileX + tileWidth / 2}" y="${labelStartY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="600" fill="#0F172A">`,
      labelMarkup,
      "    </text>",
      "  </g>",
    ].join("\n");
  }).join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CONTACT_SHEET_WIDTH_PX}" height="${CONTACT_SHEET_HEIGHT_PX}" viewBox="0 0 ${CONTACT_SHEET_WIDTH_PX} ${CONTACT_SHEET_HEIGHT_PX}" role="img" aria-labelledby="contact-sheet-title contact-sheet-description">`,
    "  <title id=\"contact-sheet-title\">Salgsmapper – modelikoner v1</title>",
    "  <desc id=\"contact-sheet-description\">Kun til review. Ikke en storefront-asset.</desc>",
    `  <rect width="${CONTACT_SHEET_WIDTH_PX}" height="${CONTACT_SHEET_HEIGHT_PX}" fill="#FFFFFF"/>`,
    "  <text x=\"24\" y=\"42\" font-family=\"Arial, Helvetica, sans-serif\" font-size=\"24\" font-weight=\"700\" fill=\"#0F172A\">Salgsmapper – modelikoner v1</text>",
    `  <text x="24" y="68" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="600" fill="${NEUTRAL_GREY}">Kun til review – ikke en storefront-asset</text>`,
    cards,
    "</svg>",
    "",
  ].join("\n");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function pngAssetPath(modelKey, variant) {
  return path.posix.join(
    "src/assets/product-options/sales-folders/models",
    ASSET_VERSION,
    PNG_RELATIVE_DIRECTORY,
    variant,
    `${modelKey}.png`
  );
}

export function assertSafeRasterSourceSvg(svg, modelKey = "unknown-model") {
  if (!String(svg).startsWith("<svg")) {
    throw new Error(`${modelKey}: raster source is not an SVG document`);
  }
  if (/<(?:text|image|foreignObject|script|style|a)\b/i.test(svg)) {
    throw new Error(`${modelKey}: raster source contains labelled, external, or executable SVG content`);
  }
  if (/wir.?machen.?druck|supplier|lieferant|logo|watermark|brand(?:ing)?/i.test(svg)) {
    throw new Error(`${modelKey}: raster source contains supplier or branding text`);
  }

  const colors = [...String(svg).matchAll(/#[0-9a-f]{6}/gi)].map((match) =>
    match[0].toUpperCase()
  );
  if (
    colors.length === 0 ||
    colors.some((color) => ![WEBPRINTER_BLUE, NEUTRAL_GREY].includes(color))
  ) {
    throw new Error(`${modelKey}: raster source uses colors outside the approved palette`);
  }
}

function paethPredictor(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

export function inspectTransparentPng(pngBytes, expectedSizePx = null) {
  const bytes = Buffer.isBuffer(pngBytes) ? pngBytes : Buffer.from(pngBytes);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) {
    throw new Error("Raster output is not a PNG file");
  }

  let offset = 8;
  let ihdr = null;
  const idatChunks = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const nextOffset = dataEnd + 4;
    if (nextOffset > bytes.length) throw new Error(`PNG chunk ${type} exceeds file bounds`);
    const data = bytes.subarray(dataStart, dataEnd);
    if (type === "IHDR") ihdr = data;
    if (type === "IDAT") idatChunks.push(data);
    offset = nextOffset;
    if (type === "IEND") break;
  }

  if (!ihdr || ihdr.length !== 13 || idatChunks.length === 0) {
    throw new Error("PNG is missing IHDR or IDAT data");
  }

  const widthPx = ihdr.readUInt32BE(0);
  const heightPx = ihdr.readUInt32BE(4);
  const bitDepth = ihdr[8];
  const colorType = ihdr[9];
  const compressionMethod = ihdr[10];
  const filterMethod = ihdr[11];
  const interlaceMethod = ihdr[12];
  if (expectedSizePx != null && (widthPx !== expectedSizePx || heightPx !== expectedSizePx)) {
    throw new Error(
      `PNG dimensions are ${widthPx}x${heightPx}; expected ${expectedSizePx}x${expectedSizePx}`
    );
  }
  if (
    bitDepth !== 8 ||
    colorType !== 6 ||
    compressionMethod !== 0 ||
    filterMethod !== 0 ||
    interlaceMethod !== 0
  ) {
    throw new Error(
      `PNG must be non-interlaced 8-bit RGBA (bitDepth=${bitDepth}, colorType=${colorType})`
    );
  }

  const bytesPerPixel = 4;
  const rowByteLength = widthPx * bytesPerPixel;
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const expectedInflatedLength = (rowByteLength + 1) * heightPx;
  if (inflated.length !== expectedInflatedLength) {
    throw new Error(
      `PNG pixel payload has ${inflated.length} bytes; expected ${expectedInflatedLength}`
    );
  }

  let previousRow = Buffer.alloc(rowByteLength);
  let transparentPixelCount = 0;
  let visiblePixelCount = 0;
  let minimumAlpha = 255;
  let maximumAlpha = 0;

  for (let rowIndex = 0; rowIndex < heightPx; rowIndex += 1) {
    const sourceOffset = rowIndex * (rowByteLength + 1);
    const filterType = inflated[sourceOffset];
    if (filterType > 4) throw new Error(`Unsupported PNG filter type ${filterType}`);
    const sourceRow = inflated.subarray(sourceOffset + 1, sourceOffset + 1 + rowByteLength);
    const currentRow = Buffer.allocUnsafe(rowByteLength);

    for (let byteIndex = 0; byteIndex < rowByteLength; byteIndex += 1) {
      const left = byteIndex >= bytesPerPixel ? currentRow[byteIndex - bytesPerPixel] : 0;
      const above = previousRow[byteIndex];
      const upperLeft = byteIndex >= bytesPerPixel ? previousRow[byteIndex - bytesPerPixel] : 0;
      let predictor = 0;
      if (filterType === 1) predictor = left;
      if (filterType === 2) predictor = above;
      if (filterType === 3) predictor = Math.floor((left + above) / 2);
      if (filterType === 4) predictor = paethPredictor(left, above, upperLeft);
      currentRow[byteIndex] = (sourceRow[byteIndex] + predictor) & 0xff;
    }

    for (let alphaIndex = 3; alphaIndex < rowByteLength; alphaIndex += bytesPerPixel) {
      const alpha = currentRow[alphaIndex];
      minimumAlpha = Math.min(minimumAlpha, alpha);
      maximumAlpha = Math.max(maximumAlpha, alpha);
      if (alpha === 0) transparentPixelCount += 1;
      else visiblePixelCount += 1;
    }
    previousRow = currentRow;
  }

  if (transparentPixelCount === 0 || visiblePixelCount === 0 || minimumAlpha !== 0) {
    throw new Error("PNG does not contain both transparent background pixels and visible icon pixels");
  }

  return {
    widthPx,
    heightPx,
    bitDepth,
    colorType: "rgba",
    hasAlpha: true,
    minimumAlpha,
    maximumAlpha,
    transparentPixelCount,
    visiblePixelCount,
  };
}

async function renderSvgToTransparentPng(page, svg, sizePx, modelKey) {
  assertSafeRasterSourceSvg(svg, modelKey);
  await page.setViewportSize({ width: sizePx, height: sizePx });
  const source = Buffer.from(svg, "utf8").toString("base64");
  await page.setContent(
    [
      "<!doctype html>",
      "<html><head><meta charset=\"utf-8\"><style>",
      `html,body{margin:0;padding:0;width:${sizePx}px;height:${sizePx}px;overflow:hidden;background:transparent;}`,
      `#icon{display:block;width:${sizePx}px;height:${sizePx}px;object-fit:contain;}`,
      "</style></head><body>",
      `<img id=\"icon\" alt=\"\" src=\"data:image/svg+xml;base64,${source}\">`,
      "</body></html>",
    ].join(""),
    { waitUntil: "load" }
  );
  await page.locator("#icon").evaluate((image) => image.decode());
  const png = await page.screenshot({
    type: "png",
    omitBackground: true,
    animations: "disabled",
    clip: { x: 0, y: 0, width: sizePx, height: sizePx },
  });
  const inspection = inspectTransparentPng(png, sizePx);
  return { bytes: png, inspection };
}

export function buildPngRasterManifest({
  svgByKey,
  rasterByKey,
  chromiumVersion,
  sourceManifestSha256,
}) {
  const models = Object.fromEntries(
    APPROVED_PNG_MODEL_DEFINITIONS.map((model) => {
      const svg = svgByKey.get(model.key);
      const raster = rasterByKey.get(model.key);
      if (!svg || !raster?.master?.bytes || !raster?.ui?.bytes) {
        throw new Error(`Missing SVG or PNG derivative for ${model.key}`);
      }
      return [
        model.key,
        {
          modelKey: model.key,
          folderModelKey: model.key,
          labelDa: model.labelDa,
          accessibleNameDa: model.accessibleNameDa,
          sourceOrder: model.sourceOrder,
          styleKey: PNG_STYLE_KEY,
          transparent: true,
          supplierBrandingRemoved: true,
          sourceSvg: {
            repoAssetPath: path.posix.join(
              "src/assets/product-options/sales-folders/models",
              ASSET_VERSION,
              `${model.key}.svg`
            ),
            sha256: sha256(svg),
          },
          master: {
            repoAssetPath: pngAssetPath(model.key, "master"),
            mimeType: "image/png",
            widthPx: PNG_MASTER_SIZE_PX,
            heightPx: PNG_MASTER_SIZE_PX,
            byteSize: raster.master.bytes.length,
            sha256: sha256(raster.master.bytes),
            alpha: raster.master.inspection,
          },
          ui: {
            repoAssetPath: pngAssetPath(model.key, "ui"),
            mimeType: "image/png",
            widthPx: PNG_UI_SIZE_PX,
            heightPx: PNG_UI_SIZE_PX,
            byteSize: raster.ui.bytes.length,
            sha256: sha256(raster.ui.bytes),
            alpha: raster.ui.inspection,
          },
        },
      ];
    })
  );

  return {
    schemaVersion: 1,
    assetVersion: `${ASSET_VERSION}-png1`,
    sourceSvgAssetVersion: ASSET_VERSION,
    optionAxis: "folder_model",
    displayType: "icon_grid",
    styleKey: PNG_STYLE_KEY,
    approvedModelCount: APPROVED_PNG_MODEL_DEFINITIONS.length,
    modelOrder: APPROVED_PNG_MODEL_DEFINITIONS.map((model) => model.key),
    excludedModels: EXCLUDED_PNG_MODEL_KEYS.map((modelKey) => ({
      modelKey,
      reason: "Explicitly excluded from the approved 20-model sales-folder scope (CD folder).",
    })),
    sourceSvgManifest: {
      repoAssetPath: SOURCE_MANIFEST_REPO_PATH,
      sha256: sourceManifestSha256,
      mutatedByRasterGeneration: false,
    },
    rasterization: {
      renderer: "playwright-chromium",
      chromiumVersion,
      deviceScaleFactor: 1,
      colorScheme: "light",
      background: "transparent",
      masterSizePx: PNG_MASTER_SIZE_PX,
      uiSizePx: PNG_UI_SIZE_PX,
      sourceInterpolation: "browser-svg-rasterization",
    },
    provenance: {
      generator: "scripts/product-import/generate-wmd-sales-folder-model-icons.js",
      supplierAssetsCopied: false,
      supplierBrandingIncluded: false,
      aiGenerated: false,
      sourceType: "deterministic-svg-derivative",
    },
    models,
  };
}

export function buildCanonicalIconGridArtifact({
  rasterManifest,
  rasterManifestSha256,
  sourceProposalPath,
  sourceProposalSha256,
}) {
  const values = rasterManifest.modelOrder.map((modelKey) => {
    const model = rasterManifest.models[modelKey];
    return {
      key: model.modelKey,
      modelKey: model.modelKey,
      labelDa: model.labelDa,
      accessibleNameDa: model.accessibleNameDa,
      sourceOrder: model.sourceOrder,
      icon: {
        styleKey: model.styleKey,
        generatedAssetPath: model.ui.repoAssetPath,
        masterAssetPath: model.master.repoAssetPath,
        transparent: model.transparent,
        supplierBrandingRemoved: model.supplierBrandingRemoved,
        sourceSvg: model.sourceSvg,
        master: model.master,
        ui: model.ui,
        resolvedPublicCustomImageUrl: null,
        publicAssetResolutionRequiredAtApprovedProductDraftGate: true,
      },
    };
  });

  return {
    schemaVersion: 1,
    artifactType: "canonical_sales_folder_icon_grid",
    state: "extracted",
    optionAxis: "folder_model",
    displayType: "icon_grid",
    styleKey: rasterManifest.styleKey,
    modelCount: values.length,
    modelOrder: rasterManifest.modelOrder,
    excludedModels: rasterManifest.excludedModels,
    sourceProposal: {
      path: sourceProposalPath,
      sha256: sourceProposalSha256,
      writePerformed: false,
      purpose: "hash-pinned evidence only; this additive artifact does not rewrite the proposal",
    },
    sourceSvgManifest: rasterManifest.sourceSvgManifest,
    rasterManifest: {
      repoAssetPath: path.posix.join(
        "src/assets/product-options/sales-folders/models",
        ASSET_VERSION,
        PNG_RASTER_MANIFEST_FILE
      ),
      sha256: rasterManifestSha256,
    },
    backendProjection: {
      displayType: "icon_grid",
      imageField: "valueSettings[valueId].customImage",
      orderField: "section.valueIds",
      recommendedSizePx: 128,
      savedBackendImageTakesPrecedence: true,
      canonicalGeneratedAsset: "ui",
    },
    validation: {
      deterministicRenderer: true,
      masterSizePx: PNG_MASTER_SIZE_PX,
      uiSizePx: PNG_UI_SIZE_PX,
      rgbaAlphaVerifiedForEveryAsset: true,
      transparentBackgroundVerifiedForEveryAsset: true,
      supplierBrandingRemovedForEveryAsset: true,
      supplierAssetsCopied: false,
      aiGenerated: false,
    },
    mutationBoundary: {
      supplierBankWritePerformed: false,
      productWritePerformed: false,
      pricingWritePerformed: false,
      publishingPerformed: false,
      uploadPerformed: false,
    },
    values,
  };
}

export function buildManifest(svgByKey, contactSheetSvg = renderReviewContactSheet(svgByKey)) {
  const models = Object.fromEntries(
    MODEL_DEFINITIONS.map((model) => {
      const svg = svgByKey.get(model.key);
      if (!svg) throw new Error(`Missing rendered SVG for ${model.key}`);
      const relativePath = path.posix.join(
        "src/assets/product-options/sales-folders/models",
        ASSET_VERSION,
        `${model.key}.svg`
      );
      return [
        model.key,
        {
          modelKey: model.key,
          folderModelKey: model.key,
          formatKey: model.formatKey,
          constructionKey: model.constructionKey,
          labelDa: model.labelDa,
          accessibleNameDa: model.accessibleNameDa,
          sourceOrder: model.sourceOrder,
          formatDimensionsMm: {
            width: model.format.widthMm,
            height: model.format.heightMm,
          },
          svg: {
            path: relativePath,
            widthPx: SVG_SIZE_PX,
            heightPx: SVG_SIZE_PX,
            viewBox: SVG_VIEW_BOX,
            sha256: sha256(svg),
          },
        },
      ];
    })
  );

  return {
    schemaVersion: 1,
    assetVersion: ASSET_VERSION,
    optionAxis: "folder_model",
    modelKeyConvention: "<formatKey>--<constructionKey>",
    modelCount: MODEL_DEFINITIONS.length,
    palette: {
      primary: WEBPRINTER_BLUE,
      neutral: NEUTRAL_GREY,
      background: "transparent",
    },
    backendProjection: {
      displayType: "icon_grid",
      imageField: "valueSettings[valueId].customImage",
      orderField: "section.valueIds",
      recommendedSizePx: 128,
      savedBackendImageTakesPrecedence: true,
    },
    reviewArtifacts: {
      contactSheet: {
        purpose: "review_only",
        storefrontAsset: false,
        backendOptionAsset: false,
        path: `src/assets/product-options/sales-folders/models/${ASSET_VERSION}/${CONTACT_SHEET_FILE}`,
        widthPx: CONTACT_SHEET_WIDTH_PX,
        heightPx: CONTACT_SHEET_HEIGHT_PX,
        sha256: sha256(contactSheetSvg),
        background: "white",
        labels: "Danish labels outside each embedded icon",
      },
      rasterDerivative: {
        status: "not_generated",
        reason:
          "No deterministic repo-local SVG rasterizer is installed; the SVG contact sheet is the canonical review artifact.",
      },
    },
    provenance: {
      type: "deterministic-svg",
      generator: "scripts/product-import/generate-wmd-sales-folder-model-icons.js",
      catalogEvidence: [
        "scripts/product-import/shared/wmd-sales-folders.js",
        "scripts/product-import/__tests__/wmd-sales-folders.test.js#LIVE_NO_FINISH_MODELS",
      ],
      supplierAssetsCopied: false,
      supplierBrandingIncluded: false,
      aiGenerated: false,
      prompt: null,
      notes:
        "Transparent structural pictograms. Visible Danish labels remain outside the SVG in the backend-owned option UI.",
    },
    models,
  };
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function checkFile(filePath, expected) {
  let actual;
  try {
    actual = await fs.readFile(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  const expectedBytes = Buffer.isBuffer(expected) ? expected : Buffer.from(expected, "utf8");
  return actual.equals(expectedBytes);
}

function checksumSidecarBytes(filePath, bytes) {
  return Buffer.from(`${sha256(bytes)}  ${path.basename(filePath)}\n`, "utf8");
}

async function writeGeneratedFiles(files) {
  await Promise.all(
    files.map(async (file) => {
      await fs.mkdir(path.dirname(file.path), { recursive: true });
      await fs.writeFile(file.path, file.content);
    })
  );
}

export async function writePngAssets({
  outputDir = DEFAULT_OUTPUT_DIR,
  canonicalArtifactPath = null,
  sourceProposalPath = null,
  sourceProposalArtifactPath = null,
  check = false,
} = {}) {
  if (canonicalArtifactPath && !sourceProposalPath) {
    throw new Error("canonicalArtifactPath requires sourceProposalPath");
  }

  const svgByKey = new Map(
    MODEL_DEFINITIONS.map((model) => [model.key, renderModelSvg(model)])
  );
  const contactSheetSvg = renderReviewContactSheet(svgByKey);
  const sourceManifestBytes = Buffer.from(
    stableJson(buildManifest(svgByKey, contactSheetSvg)),
    "utf8"
  );
  const sourceManifestPath = path.join(outputDir, "manifest.json");
  let checkedInSourceManifest;
  try {
    checkedInSourceManifest = await fs.readFile(sourceManifestPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(
        `Source SVG manifest is missing at ${sourceManifestPath}; generate or restore the frozen SVG asset set first`
      );
    }
    throw error;
  }
  if (!checkedInSourceManifest.equals(sourceManifestBytes)) {
    throw new Error(
      `Source SVG manifest is stale at ${sourceManifestPath}; refusing to rasterize against an unpinned source`
    );
  }
  const sourceManifestSha256 = sha256(checkedInSourceManifest);

  let sourceProposalBytes = null;
  let sourceProposalSha256 = null;
  if (sourceProposalPath) {
    sourceProposalBytes = await fs.readFile(sourceProposalPath);
    sourceProposalSha256 = sha256(sourceProposalBytes);
  }

  const browser = await chromium.launch({ headless: true });
  let chromiumVersion;
  const rasterByKey = new Map();
  try {
    chromiumVersion = browser.version();
    const context = await browser.newContext({
      viewport: { width: PNG_MASTER_SIZE_PX, height: PNG_MASTER_SIZE_PX },
      deviceScaleFactor: 1,
      colorScheme: "light",
      reducedMotion: "reduce",
      locale: "da-DK",
      timezoneId: "UTC",
    });
    const page = await context.newPage();

    for (const model of APPROVED_PNG_MODEL_DEFINITIONS) {
      const svg = svgByKey.get(model.key);
      const master = await renderSvgToTransparentPng(
        page,
        svg,
        PNG_MASTER_SIZE_PX,
        model.key
      );
      const ui = await renderSvgToTransparentPng(page, svg, PNG_UI_SIZE_PX, model.key);
      rasterByKey.set(model.key, { master, ui });
    }

    await context.close();
  } finally {
    await browser.close();
  }

  const rasterManifest = buildPngRasterManifest({
    svgByKey,
    rasterByKey,
    chromiumVersion,
    sourceManifestSha256,
  });
  const rasterManifestPath = path.join(outputDir, PNG_RASTER_MANIFEST_FILE);
  const rasterManifestBytes = Buffer.from(stableJson(rasterManifest), "utf8");
  const rasterManifestSidecarPath = `${rasterManifestPath}.sha256`;
  const files = [
    ...APPROVED_PNG_MODEL_DEFINITIONS.flatMap((model) => {
      const raster = rasterByKey.get(model.key);
      return [
        {
          path: path.join(outputDir, PNG_RELATIVE_DIRECTORY, "master", `${model.key}.png`),
          content: raster.master.bytes,
        },
        {
          path: path.join(outputDir, PNG_RELATIVE_DIRECTORY, "ui", `${model.key}.png`),
          content: raster.ui.bytes,
        },
      ];
    }),
    { path: rasterManifestPath, content: rasterManifestBytes },
    {
      path: rasterManifestSidecarPath,
      content: checksumSidecarBytes(rasterManifestPath, rasterManifestBytes),
    },
  ];

  let canonicalArtifact = null;
  let canonicalArtifactBytes = null;
  if (canonicalArtifactPath) {
    canonicalArtifact = buildCanonicalIconGridArtifact({
      rasterManifest,
      rasterManifestSha256: sha256(rasterManifestBytes),
      sourceProposalPath:
        sourceProposalArtifactPath ||
        path.posix.join("review", path.basename(sourceProposalPath)),
      sourceProposalSha256,
    });
    canonicalArtifactBytes = Buffer.from(stableJson(canonicalArtifact), "utf8");
    files.push(
      { path: canonicalArtifactPath, content: canonicalArtifactBytes },
      {
        path: `${canonicalArtifactPath}.sha256`,
        content: checksumSidecarBytes(canonicalArtifactPath, canonicalArtifactBytes),
      }
    );
  }

  if (check) {
    const stale = [];
    for (const file of files) {
      if (!(await checkFile(file.path, file.content))) stale.push(file.path);
    }
    if (stale.length > 0) {
      throw new Error(`Generated sales-folder PNG assets are missing or stale:\n${stale.join("\n")}`);
    }
  } else {
    await writeGeneratedFiles(files);
  }

  const sourceManifestAfter = await fs.readFile(sourceManifestPath);
  if (!sourceManifestAfter.equals(checkedInSourceManifest)) {
    throw new Error("Raster generation unexpectedly changed the hash-pinned source SVG manifest");
  }
  if (sourceProposalPath) {
    const sourceProposalAfter = await fs.readFile(sourceProposalPath);
    if (!sourceProposalAfter.equals(sourceProposalBytes)) {
      throw new Error("Raster generation unexpectedly changed the hash-pinned product proposal");
    }
  }

  return {
    outputDir,
    rasterManifest,
    canonicalArtifact,
    canonicalArtifactPath,
    files,
    checked: check,
    sourceManifestSha256,
    sourceProposalSha256,
  };
}

export async function writeAssets({ outputDir = DEFAULT_OUTPUT_DIR, check = false } = {}) {
  const svgByKey = new Map(
    MODEL_DEFINITIONS.map((model) => [model.key, renderModelSvg(model)])
  );
  const contactSheetSvg = renderReviewContactSheet(svgByKey);
  const manifest = buildManifest(svgByKey, contactSheetSvg);
  const files = [
    ...MODEL_DEFINITIONS.map((model) => ({
      path: path.join(outputDir, `${model.key}.svg`),
      content: svgByKey.get(model.key),
    })),
    {
      path: path.join(outputDir, CONTACT_SHEET_FILE),
      content: contactSheetSvg,
    },
    {
      path: path.join(outputDir, "manifest.json"),
      content: stableJson(manifest),
    },
  ];

  if (check) {
    const stale = [];
    for (const file of files) {
      if (!(await checkFile(file.path, file.content))) stale.push(file.path);
    }
    if (stale.length > 0) {
      throw new Error(`Generated sales-folder model assets are missing or stale:\n${stale.join("\n")}`);
    }
    return { outputDir, manifest, files, checked: true };
  }

  await fs.mkdir(outputDir, { recursive: true });
  await Promise.all(files.map((file) => fs.writeFile(file.path, file.content, "utf8")));
  return { outputDir, manifest, files, checked: false };
}

async function main() {
  const check = process.argv.includes("--check");
  const rasterizePng = process.argv.includes("--rasterize-png");
  const outputFlagIndex = process.argv.indexOf("--output");
  const outputDir =
    outputFlagIndex >= 0
      ? path.resolve(process.argv[outputFlagIndex + 1] || "")
      : DEFAULT_OUTPUT_DIR;

  if (rasterizePng) {
    const canonicalArtifactFlagIndex = process.argv.indexOf("--canonical-artifact");
    const sourceProposalFlagIndex = process.argv.indexOf("--source-proposal");
    const canonicalArtifactPath =
      canonicalArtifactFlagIndex >= 0
        ? path.resolve(process.argv[canonicalArtifactFlagIndex + 1] || "")
        : null;
    const sourceProposalPath =
      sourceProposalFlagIndex >= 0
        ? path.resolve(process.argv[sourceProposalFlagIndex + 1] || "")
        : null;
    const result = await writePngAssets({
      outputDir,
      canonicalArtifactPath,
      sourceProposalPath,
      check,
    });
    process.stdout.write(
      `${check ? "Checked" : "Generated"} ${result.rasterManifest.approvedModelCount} approved sales-folder model PNG pairs in ${result.outputDir}\n`
    );
    if (canonicalArtifactPath) {
      process.stdout.write(
        `${check ? "Checked" : "Generated"} canonical icon-grid artifact at ${canonicalArtifactPath}\n`
      );
    }
    return;
  }

  const result = await writeAssets({ outputDir, check });
  process.stdout.write(
    `${check ? "Checked" : "Generated"} ${result.manifest.modelCount} sales-folder model icons in ${result.outputDir}\n`
  );
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}
