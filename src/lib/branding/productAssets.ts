export type ProductImageSettings = {
  setId?: string | null;
  hueRotate?: number | null;
  saturate?: number | null;
};

export type ProductIconKey =
  | "flyers"
  | "folders"
  | "salesFolders"
  | "posters"
  | "booklets"
  | "banners";

const PRODUCT_SET_FILTERS: Record<string, string> = {
  default: "",
  lifestyle: "contrast(1.04) brightness(1.03)",
  dark: "brightness(0.88) contrast(1.12) saturate(0.92)",
};

function toSafeNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildProductFilter(settings?: ProductImageSettings | null): string {
  const hueRotate = toSafeNumber(settings?.hueRotate, 0);
  const saturate = toSafeNumber(settings?.saturate, 100);
  const setId = String(settings?.setId || "default");
  const setFilter = PRODUCT_SET_FILTERS[setId] || PRODUCT_SET_FILTERS.default;
  const colorFilter = `hue-rotate(${hueRotate}deg) saturate(${saturate}%)`;

  return [setFilter, colorFilter].filter(Boolean).join(" ").trim();
}

export function resolveProductIconKey(slug: string, category?: string | null): ProductIconKey {
  const normalized = String(slug || "").toLowerCase();
  const normalizedCategory = String(category || "").toLowerCase();

  if (normalized.includes("salgsmapper") || normalized.includes("salesfolder")) {
    return "salesFolders";
  }

  if (
    normalized.includes("folder")
    || normalized.includes("foldere")
    || normalized.includes("falz")
    || normalized.includes("mittelfalz")
    || normalized.includes("rullefalset")
    || normalized.includes("wickelfalz")
  ) {
    return "folders";
  }

  if (
    normalized.includes("haefter")
    || normalized.includes("hæfter")
    || normalized.includes("booklet")
    || normalized.includes("brochure")
  ) {
    return "booklets";
  }

  if (normalized.includes("plakat") || normalized.includes("poster")) {
    return "posters";
  }

  if (
    normalizedCategory === "storformat"
    || normalized.includes("banner")
    || normalized.includes("beachflag")
    || normalized.includes("messeudstyr")
    || normalized.includes("display")
    || normalized.includes("skilte")
    || normalized.includes("folie")
  ) {
    return "banners";
  }

  return "flyers";
}
