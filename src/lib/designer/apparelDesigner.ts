export type ApparelPrintSide = "front" | "back" | "sleeve";
export type ApparelPrintPosition = "front-center" | "back-center" | "chest-left" | "chest-right";

export interface ApparelMockupPlacement {
  leftPct: number;
  topPct: number;
  widthPct: number;
  aspectRatio: number;
  topOffsetMm?: number;
  referenceGarmentLengthMm?: number;
}

export interface ApparelColorOption {
  id: string;
  label: string;
  hex: string;
  pantone?: string;
  terms: string[];
}

export interface ApparelDesignerConfig {
  enabled: boolean;
  productName: string;
  garmentColor: string;
  printMethod: string;
  printPositionId: ApparelPrintPosition;
  printAreaLabel: string;
  activeSide: ApparelPrintSide;
  sides: ApparelPrintSide[];
  printWidthMm: number;
  printHeightMm: number;
  bleedMm: number;
  safeAreaMm: number;
  mockupSrc: string;
  mockupAlt: string;
  mockupPlacement: ApparelMockupPlacement;
  garmentSize?: string | null;
  garmentWidthCm?: number | null;
  garmentLengthCm?: number | null;
}

const DEFAULT_APPAREL_PRINT_WIDTH_MM = 297;
const DEFAULT_APPAREL_PRINT_HEIGHT_MM = 420;
const DEFAULT_APPAREL_SAFE_AREA_MM = 3;
const DEFAULT_REFERENCE_GARMENT_LENGTH_MM = 745;
const APPAREL_FRONT_MOCKUP_SRC = "/designer/apparel/tshirt-white-front.png";
const APPAREL_BACK_MOCKUP_SRC = "/designer/apparel/tshirt-white-back.png";

// WIRmachenDRUCK / Fruit of the Loom Valueweight palette from the linked supplier PDF.
// Hex values mirror the vector fills in that PDF; Pantone names remain approximate as stated there.
export const APPAREL_COLOR_OPTIONS: ApparelColorOption[] = [
  { id: "white", label: "Hvid", hex: "#FFFFFF", terms: ["hvid", "white", "weiss", "weiß"] },
  { id: "black", label: "Sort", hex: "#000000", pantone: "Pro Black C", terms: ["sort", "black", "schwarz", "pro black"] },
  { id: "heather-grey", label: "Heather Grey", hex: "#BFC4C8", pantone: "428 C", terms: ["heather grey", "heather gray", "grau meliert", "grå melange", "grå", "graa", "grey", "gray"] },
  { id: "navy", label: "Navy", hex: "#10284C", pantone: "2767 C", terms: ["navy", "marine", "deep navy"] },
  { id: "royal-blue", label: "Royal Blue", hex: "#003DA7", pantone: "293 C", terms: ["royal blue", "royalblau", "kongeblå"] },
  { id: "sky-blue", label: "Sky Blue", hex: "#8FBFE9", pantone: "283 C", terms: ["sky blue", "skyblue", "himmelblau", "lyseblå"] },
  { id: "lime", label: "Lime", hex: "#68BF4B", pantone: "360 C", terms: ["lime", "limette"] },
  { id: "yellow", label: "Gul", hex: "#FDD900", pantone: "108 C", terms: ["gul", "yellow", "gelb", "sunflower"] },
  { id: "burgundy", label: "Burgundy", hex: "#71263D", pantone: "209 C", terms: ["burgundy", "bordeaux", "weinrot"] },
  { id: "red", label: "Rød", hex: "#CD122D", pantone: "186 C", terms: ["rød", "roed", "red", "rot"] },
  { id: "fuchsia", label: "Fuchsia", hex: "#E4437B", pantone: "205 C", terms: ["fuchsia", "pink", "magenta"] },
  { id: "bottle-green", label: "Bottle Green", hex: "#274635", pantone: "553 C", terms: ["bottle green", "flaskegrøn", "flaskegroen", "dunkelgrün", "dunkelgruen"] },
];

const APPAREL_METHODS: Array<{ label: string; terms: string[] }> = [
  { label: "Silketryk", terms: ["silketryk", "screen"] },
  { label: "DTG print", terms: ["dtg"] },
  { label: "Digitaltransfer", terms: ["digitaltransfer", "transfer"] },
  { label: "DTF transfer", terms: ["dtf"] },
  { label: "Sublimation", terms: ["sublimation"] },
  { label: "Broderi", terms: ["broderi", "embroidery"] },
];

const APPAREL_GARMENT_SIZES: Record<string, { widthCm: number; lengthCm: number }> = {
  S: { widthCm: 48.5, lengthCm: 69.5 },
  M: { widthCm: 53.5, lengthCm: 72 },
  L: { widthCm: 56, lengthCm: 74.5 },
  XL: { widthCm: 61, lengthCm: 77 },
  XXL: { widthCm: 66, lengthCm: 78.5 },
  "3XL": { widthCm: 71, lengthCm: 80 },
  "4XL": { widthCm: 76, lengthCm: 81.5 },
  "5XL": { widthCm: 81, lengthCm: 83 },
};

const APPAREL_PRINT_PRESETS: Record<ApparelPrintPosition, {
  label: string;
  side: ApparelPrintSide;
  widthMm: number;
  heightMm: number;
  mockupSrc: string;
  mockupAlt: string;
  safeAreaMm: number;
  placement: ApparelMockupPlacement;
}> = {
  "front-center": {
    label: "Foran midt",
    side: "front",
    widthMm: 297,
    heightMm: 420,
    mockupSrc: APPAREL_FRONT_MOCKUP_SRC,
    mockupAlt: "T-shirt forside",
    safeAreaMm: 3,
    placement: {
      leftPct: 34.5,
      topPct: 23,
      widthPct: 31,
      aspectRatio: 297 / 420,
      topOffsetMm: 70,
      referenceGarmentLengthMm: DEFAULT_REFERENCE_GARMENT_LENGTH_MM,
    },
  },
  "back-center": {
    label: "Ryg midt",
    side: "back",
    widthMm: 297,
    heightMm: 420,
    mockupSrc: APPAREL_BACK_MOCKUP_SRC,
    mockupAlt: "T-shirt bagside",
    safeAreaMm: 3,
    placement: {
      leftPct: 34.5,
      topPct: 20,
      widthPct: 31,
      aspectRatio: 297 / 420,
      topOffsetMm: 45,
      referenceGarmentLengthMm: DEFAULT_REFERENCE_GARMENT_LENGTH_MM,
    },
  },
  "chest-left": {
    label: "Bryst venstre",
    side: "front",
    widthMm: 100,
    heightMm: 100,
    mockupSrc: APPAREL_FRONT_MOCKUP_SRC,
    mockupAlt: "T-shirt forside med brystprint",
    safeAreaMm: 3,
    placement: { leftPct: 35, topPct: 27, widthPct: 14, aspectRatio: 1 },
  },
  "chest-right": {
    label: "Bryst højre",
    side: "front",
    widthMm: 100,
    heightMm: 100,
    mockupSrc: APPAREL_FRONT_MOCKUP_SRC,
    mockupAlt: "T-shirt forside med brystprint",
    safeAreaMm: 3,
    placement: { leftPct: 51, topPct: 27, widthPct: 14, aspectRatio: 1 },
  },
};

function normalize(value: unknown): string {
  return String(value || "").toLocaleLowerCase("da-DK");
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getApparelColorHex(colorLabel: string): string {
  return getApparelColorOption(colorLabel)?.hex || "#FFFFFF";
}

export function getApparelColorOption(colorLabel: string): ApparelColorOption | null {
  const normalized = normalize(colorLabel);
  return APPAREL_COLOR_OPTIONS.find((color) =>
    color.terms.some((term) => normalized.includes(term))
  ) || null;
}

export function readApparelOptionText(input: {
  productName?: string | null;
  selectedVariant?: string | null;
  summary?: string | null;
  optionSelections?: Record<string, { name?: string | null } | unknown> | null;
}): string {
  const optionNames = Object.values(input.optionSelections || {})
    .map((option) => {
      if (option && typeof option === "object" && "name" in option) {
        return String((option as { name?: string | null }).name || "");
      }
      return "";
    })
    .filter(Boolean);

  return [
    input.productName,
    input.selectedVariant,
    input.summary,
    ...optionNames,
  ].filter(Boolean).join(" ");
}

export function inferApparelColor(optionText: string): string {
  return getApparelColorOption(optionText)?.label || "Hvid";
}

export function inferApparelPrintMethod(optionText: string): string {
  const normalized = normalize(optionText);
  return APPAREL_METHODS.find((method) => method.terms.some((term) => normalized.includes(term)))?.label || "Tekstiltryk";
}

export function inferApparelPrintPosition(optionText: string, activeSide: ApparelPrintSide): ApparelPrintPosition {
  const normalized = normalize(optionText);
  if (activeSide === "back" || /hinten|bagside|ryg|back/.test(normalized)) return "back-center";
  if (/brust\s*rechts|bryst\s*højre|bryst\s*hoejre|chest\s*right/.test(normalized)) return "chest-right";
  if (/brust\s*links|bryst\s*venstre|chest\s*left/.test(normalized)) return "chest-left";
  return "front-center";
}

export function inferApparelGarmentSize(optionText: string): string | null {
  const normalized = ` ${String(optionText || "").toUpperCase()} `;
  const match = normalized.match(/\b(5XL|4XL|3XL|XXL|XL|L|M|S)\b/);
  return match?.[1] || null;
}

export function inferApparelSides(optionText: string): ApparelPrintSide[] {
  const normalized = normalize(optionText);
  const hasBack = /ryg|bagside|back|front\/back|for og bag|for- og bag|4\+4/.test(normalized);
  const hasSleeve = /ærme|aerme|sleeve/.test(normalized);
  const sides: ApparelPrintSide[] = ["front"];
  if (hasBack) sides.push("back");
  if (hasSleeve) sides.push("sleeve");
  return sides;
}

export function normalizeApparelSide(value: unknown, sides: ApparelPrintSide[] = ["front"]): ApparelPrintSide {
  const side = normalize(value);
  if (side === "back" || side === "ryg" || side === "bagside") return sides.includes("back") ? "back" : sides[0] || "front";
  if (side === "sleeve" || side === "ærme" || side === "aerme") return sides.includes("sleeve") ? "sleeve" : sides[0] || "front";
  return sides.includes("front") ? "front" : sides[0] || "front";
}

export function buildApparelDesignerConfig(input: {
  enabled?: boolean;
  productName?: string | null;
  garmentColor?: string | null;
  printMethod?: string | null;
  printPosition?: string | null;
  side?: string | null;
  sides?: string[] | null;
  optionText?: string | null;
  widthMm?: unknown;
  heightMm?: unknown;
  bleedMm?: unknown;
  safeAreaMm?: unknown;
}): ApparelDesignerConfig {
  const optionText = input.optionText || "";
  const inferredSides = inferApparelSides(optionText);
  const sides = (input.sides || [])
    .map((side) => normalizeApparelSide(side, ["front", "back", "sleeve"]))
    .filter((side, index, list) => list.indexOf(side) === index);
  const resolvedSides = sides.length > 0 ? sides : inferredSides;
  const activeSide = normalizeApparelSide(input.side, resolvedSides);
  const inferredPosition = inferApparelPrintPosition(optionText, activeSide);
  const requestedPosition = normalize(input.printPosition);
  const printPositionId = (Object.keys(APPAREL_PRINT_PRESETS) as ApparelPrintPosition[])
    .find((position) => position === requestedPosition) || inferredPosition;
  const preset = APPAREL_PRINT_PRESETS[printPositionId] || APPAREL_PRINT_PRESETS["front-center"];
  const garmentSize = inferApparelGarmentSize(optionText);
  const garmentMeasurements = garmentSize ? APPAREL_GARMENT_SIZES[garmentSize] : null;

  return {
    enabled: input.enabled !== false,
    productName: input.productName || "Tekstilprodukt",
    garmentColor: getApparelColorOption(input.garmentColor || optionText)?.label
      || input.garmentColor
      || inferApparelColor(optionText),
    printMethod: input.printMethod || inferApparelPrintMethod(optionText),
    printPositionId,
    printAreaLabel: preset.label,
    activeSide,
    sides: resolvedSides,
    printWidthMm: preset.widthMm || parsePositiveNumber(input.widthMm) || DEFAULT_APPAREL_PRINT_WIDTH_MM,
    printHeightMm: preset.heightMm || parsePositiveNumber(input.heightMm) || DEFAULT_APPAREL_PRINT_HEIGHT_MM,
    bleedMm: parseNonNegativeNumber(input.bleedMm, 0),
    safeAreaMm: preset.safeAreaMm ?? parseNonNegativeNumber(input.safeAreaMm, DEFAULT_APPAREL_SAFE_AREA_MM),
    mockupSrc: preset.mockupSrc,
    mockupAlt: preset.mockupAlt,
    mockupPlacement: preset.placement,
    garmentSize,
    garmentWidthCm: garmentMeasurements?.widthCm || null,
    garmentLengthCm: garmentMeasurements?.lengthCm || null,
  };
}

export function apparelSideLabel(side: ApparelPrintSide): string {
  if (side === "back") return "Ryg";
  if (side === "sleeve") return "Ærme";
  return "Front";
}
