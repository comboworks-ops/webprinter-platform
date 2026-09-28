export type ProductInfoGalleryLayout = "slideshow" | "grid";
export type ProductInfoGallerySize = "compact" | "standard" | "large" | "full";

export type ProductInfoShowWhenCondition = {
  sectionId: string;
  valueIds: string[];
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeGalleryLayout(value: unknown): ProductInfoGalleryLayout {
  return value === "grid" ? "grid" : "slideshow";
}

function normalizeGallerySize(value: unknown): ProductInfoGallerySize {
  if (value === "compact" || value === "large" || value === "full") {
    return value;
  }
  return "standard";
}

function normalizeValueIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .flatMap((item) => item.split(/[,\n]/))
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeShowWhen(value: unknown): ProductInfoShowWhenCondition[] {
  const candidates = Array.isArray(value)
    ? value
    : (isObjectRecord(value) ? [value] : []);

  return candidates
    .filter(isObjectRecord)
    .map((condition) => ({
      sectionId: typeof condition.sectionId === "string"
        ? condition.sectionId.trim()
        : "",
      valueIds: normalizeValueIds(condition.valueIds),
    }))
    .filter((condition) => (
      condition.sectionId.length > 0 || condition.valueIds.length > 0
    ));
}

export function readProductInfoV2(technicalSpecs: unknown) {
  if (!isObjectRecord(technicalSpecs)) {
    return { useSections: false, imagePosition: "above", blocks: [] };
  }

  const raw = technicalSpecs.product_page_info_v2;
  if (!isObjectRecord(raw)) {
    return { useSections: false, imagePosition: "above", blocks: [] };
  }

  const rawBlocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const blocks = rawBlocks
    .map((item, index) => {
      if (!isObjectRecord(item)) return null;
      const type = item.type;
      if (
        type !== "text" &&
        type !== "image" &&
        type !== "gallery" &&
        type !== "guide"
      ) {
        return null;
      }

      return {
        id: typeof item.id === "string" && item.id
          ? item.id
          : `block-${index + 1}`,
        type,
        title: typeof item.title === "string" ? item.title : "",
        text: typeof item.text === "string" ? item.text : "",
        imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : "",
        caption: typeof item.caption === "string" ? item.caption : "",
        images: Array.isArray(item.images)
          ? item.images.filter((url): url is string =>
            typeof url === "string" && url.length > 0
          )
          : [],
        effect: item.effect === "fade-zoom" || item.effect === "fade-up"
          ? item.effect
          : "fade",
        intervalMs: typeof item.intervalMs === "number" &&
            Number.isFinite(item.intervalMs)
          ? Math.max(2000, Math.min(12000, Math.round(item.intervalMs)))
          : 4500,
        format: typeof item.format === "string" ? item.format : "",
        configuration: typeof item.configuration === "string"
          ? item.configuration
          : "",
        placement: item.placement === "right" ? "right" : "left",
        ...(type === "gallery"
          ? {
            galleryLayout: normalizeGalleryLayout(item.galleryLayout),
            gallerySize: normalizeGallerySize(item.gallerySize),
            showWhen: normalizeShowWhen(item.showWhen),
          }
          : {}),
      };
    })
    .filter(Boolean);

  return {
    useSections: raw.useSections === true,
    imagePosition: raw.imagePosition === "below" ? "below" : "above",
    blocks,
  };
}
