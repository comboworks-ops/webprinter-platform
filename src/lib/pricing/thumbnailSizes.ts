export type ThumbnailSizeMode = "small" | "medium" | "large" | "xl";

export const THUMBNAIL_SIZE_PX: Record<ThumbnailSizeMode, number> = {
  small: 20,
  medium: 32,
  large: 48,
  xl: 72
};

export const THUMBNAIL_SIZE_OPTIONS: Array<{ value: ThumbnailSizeMode; label: string }> = [
  { value: "small", label: "Lille (20px)" },
  { value: "medium", label: "Medium (32px)" },
  { value: "large", label: "Stor (48px)" },
  { value: "xl", label: "Ekstra stor (72px)" }
];

export const THUMBNAIL_CUSTOM_PX_MIN = 16;
export const THUMBNAIL_CUSTOM_PX_MAX = 160;
export const THUMBNAIL_CUSTOM_PX_STEP = 4;

export function normalizeThumbnailSize(value?: string | null): ThumbnailSizeMode {
  if (value === "small" || value === "medium" || value === "large" || value === "xl") {
    return value;
  }
  return "small";
}

export function normalizeThumbnailCustomPx(value?: unknown): number | undefined {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(
    THUMBNAIL_CUSTOM_PX_MAX,
    Math.max(THUMBNAIL_CUSTOM_PX_MIN, Math.round(parsed))
  );
}

export function getThumbnailSizePx(value?: string | null): number {
  return THUMBNAIL_SIZE_PX[normalizeThumbnailSize(value)];
}

export function resolveThumbnailSizePx(
  value?: string | null,
  customPx?: unknown
): number {
  const normalizedCustom = normalizeThumbnailCustomPx(customPx);
  if (normalizedCustom) return normalizedCustom;
  return getThumbnailSizePx(value);
}

export function clearPerValueThumbnailSizeOverrides<
  T extends Record<string, { imageSizePx?: number }>
>(valueSettings: T): T {
  let changed = false;
  const normalizedEntries = Object.entries(valueSettings).map(([valueId, setting]) => {
    if (!Object.prototype.hasOwnProperty.call(setting, "imageSizePx")) {
      return [valueId, setting] as const;
    }

    const normalizedSetting = { ...setting };
    delete normalizedSetting.imageSizePx;
    changed = true;
    return [valueId, normalizedSetting] as const;
  });

  return changed ? Object.fromEntries(normalizedEntries) as T : valueSettings;
}
