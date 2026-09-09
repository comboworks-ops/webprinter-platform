export type ProductInfoGalleryLayout = "slideshow" | "grid";

export type ProductInfoShowWhenCondition = {
  sectionId: string;
  valueIds: string[];
};

export type ProductInfoSelectedSectionValues = Record<string, string | null | undefined>;

const isObjectRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const normalizeValueIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  return Array.from(new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .flatMap((item) => item.split(/[,\n]/))
      .map((item) => item.trim())
      .filter(Boolean),
  ));
};

export const normalizeProductInfoGalleryLayout = (value: unknown): ProductInfoGalleryLayout => (
  value === "grid" ? "grid" : "slideshow"
);

export const normalizeProductInfoShowWhen = (value: unknown): ProductInfoShowWhenCondition[] => {
  const candidates = Array.isArray(value)
    ? value
    : (isObjectRecord(value) ? [value] : []);

  return candidates
    .filter(isObjectRecord)
    .map((condition) => ({
      sectionId: typeof condition.sectionId === "string" ? condition.sectionId.trim() : "",
      valueIds: normalizeValueIds(condition.valueIds),
    }))
    .filter((condition) => condition.sectionId.length > 0 || condition.valueIds.length > 0);
};

/**
 * A scoped block is visible only when every condition matches the current
 * matrix selection. Empty conditions keep legacy blocks unscoped.
 */
export const productInfoBlockMatchesSelection = (
  showWhen: ProductInfoShowWhenCondition[] | null | undefined,
  selectedSectionValues: ProductInfoSelectedSectionValues | null | undefined,
): boolean => {
  if (!showWhen?.length) return true;

  return showWhen.every((condition) => {
    if (!condition.sectionId || condition.valueIds.length === 0) return false;
    const selectedValueId = selectedSectionValues?.[condition.sectionId];
    return typeof selectedValueId === "string" && condition.valueIds.includes(selectedValueId);
  });
};
