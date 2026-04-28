import {
    DEFAULT_PICTURE_BUTTON_STYLING,
    DEFAULT_SELECTOR_BOX_STYLING,
    DEFAULT_TEXT_BUTTON_STYLING,
    type PictureButtonHoverEffect,
    type PictureButtonSelectedEffect,
    type PictureButtonStyling,
    type SelectorBoxStyling,
    type SelectorStyling,
    type TextButtonStyling,
} from "@/types/pricingStructure";
import {
    resolveThumbnailSizePx,
    type ThumbnailSizeMode,
} from "@/lib/pricing/thumbnailSizes";
import { PICTURE_SIZES, type PictureSizeMode } from "@/lib/storformat-pricing/types";

export const PICTURE_UI_MODES = ["small", "medium", "large", "xl", "xl_notext"] as const;

type PictureUiMode = (typeof PICTURE_UI_MODES)[number];

export interface ResolvedPictureButtonStyling extends PictureButtonStyling {
    sizePx: number;
    showImage: boolean;
    showLabel: boolean;
    isTextBelow: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const isPictureUiMode = (value?: string | null): value is PictureUiMode =>
    Boolean(value && PICTURE_UI_MODES.includes(value as PictureUiMode));

export const getPictureSizeModeFromUiMode = (uiMode?: string | null): PictureSizeMode => {
    switch (uiMode) {
        case "small":
            return "small";
        case "large":
            return "large";
        case "xl":
        case "xl_notext":
            return "xl";
        case "medium":
        default:
            return "medium";
    }
};

export const getThumbnailSizeFromUiMode = (uiMode?: string | null): ThumbnailSizeMode => {
    switch (uiMode) {
        case "small":
            return "small";
        case "large":
            return "large";
        case "xl":
        case "xl_notext":
            return "xl";
        case "medium":
        default:
            return "medium";
    }
};

export const hexToRgba = (color: string, alpha: number): string => {
    const normalized = String(color || "").trim();
    const safeAlpha = clamp(Number.isFinite(alpha) ? alpha : 1, 0, 1);

    if (/^rgba?\(/i.test(normalized)) {
        return normalized.replace(/rgba?\(([^)]+)\)/i, (_match, channels) => {
            const [r = "0", g = "0", b = "0"] = String(channels).split(",").map((part) => part.trim());
            return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
        });
    }

    const hex = normalized.replace("#", "");
    const expanded = hex.length === 3
        ? hex.split("").map((part) => `${part}${part}`).join("")
        : hex;

    if (expanded.length !== 6) {
        return `rgba(14, 165, 233, ${safeAlpha})`;
    }

    const r = parseInt(expanded.slice(0, 2), 16);
    const g = parseInt(expanded.slice(2, 4), 16);
    const b = parseInt(expanded.slice(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
};

const withOpacity = (color: string, alpha: number): string => {
    const normalized = String(color || "").trim().toLowerCase();
    if (!normalized || normalized === "transparent") return "transparent";
    return hexToRgba(color, alpha);
};

const resolveHoverEffect = (
    cfg: Partial<PictureButtonStyling>,
    fallback?: Partial<PictureButtonStyling>,
): PictureButtonHoverEffect => {
    if (cfg.hoverEffect) return cfg.hoverEffect;
    if (fallback?.hoverEffect) return fallback.hoverEffect;
    if (cfg.hoverEnabled === false || fallback?.hoverEnabled === false) return "none";
    return DEFAULT_PICTURE_BUTTON_STYLING.hoverEffect;
};

const resolveSelectedEffect = (
    cfg: Partial<PictureButtonStyling>,
    fallback?: Partial<PictureButtonStyling>,
): PictureButtonSelectedEffect => {
    if (cfg.selectedEffect) return cfg.selectedEffect;
    if (fallback?.selectedEffect) return fallback.selectedEffect;
    if (cfg.outlineEnabled === false || fallback?.outlineEnabled === false) return "fill";
    return DEFAULT_PICTURE_BUTTON_STYLING.selectedEffect;
};

export const resolveTextButtonsConfig = (options?: {
    globalConfig?: Partial<TextButtonStyling>;
    productConfig?: Partial<TextButtonStyling>;
    selectorConfig?: Partial<TextButtonStyling>;
}): TextButtonStyling => {
    return {
        ...DEFAULT_TEXT_BUTTON_STYLING,
        ...(options?.globalConfig || {}),
        ...(options?.productConfig || {}),
        ...(options?.selectorConfig || {}),
    };
};

export const resolveSelectorBoxConfig = (selectorConfig?: Partial<SelectorBoxStyling>): SelectorBoxStyling => ({
    ...DEFAULT_SELECTOR_BOX_STYLING,
    ...(selectorConfig || {}),
});

export const resolvePictureButtonsConfig = (options?: {
    globalConfig?: Partial<PictureButtonStyling>;
    productConfig?: Partial<PictureButtonStyling>;
    selectorConfig?: Partial<PictureButtonStyling>;
    uiMode?: string | null;
    thumbnailSize?: ThumbnailSizeMode;
    thumbnailCustomPx?: number;
    fallbackHoverColor?: string;
    fallbackSelectedColor?: string;
}): ResolvedPictureButtonStyling => {
    const globalConfig = options?.globalConfig || {};
    const productConfig = options?.productConfig || {};
    const selectorConfig = options?.selectorConfig || {};
    const merged = {
        ...DEFAULT_PICTURE_BUTTON_STYLING,
        ...globalConfig,
        ...productConfig,
        ...selectorConfig,
    };

    const sizeMode = merged.size || getPictureSizeModeFromUiMode(options?.uiMode);
    const uiModeThumbnail = getThumbnailSizeFromUiMode(options?.uiMode);
    const resolvedSizePx = options?.thumbnailCustomPx
        ?? resolveThumbnailSizePx(options?.thumbnailSize || uiModeThumbnail)
        ?? PICTURE_SIZES[sizeMode].width;

    const displayMode = merged.displayMode || (options?.uiMode === "xl_notext" ? "image_only" : "text_below_image");
    const showImage = displayMode !== "text_only";
    const showLabel = displayMode !== "image_only" && displayMode !== "text_only" && options?.uiMode !== "xl_notext";

    return {
        ...merged,
        size: sizeMode,
        displayMode,
        transparentBackground: merged.transparentBackground === true,
        labelOutsideImage: merged.labelOutsideImage === true,
        labelFontSizePx: clamp(Number(merged.labelFontSizePx ?? DEFAULT_PICTURE_BUTTON_STYLING.labelFontSizePx), 9, 24),
        backgroundColor: merged.transparentBackground === true
            ? "transparent"
            : (merged.backgroundColor || DEFAULT_PICTURE_BUTTON_STYLING.backgroundColor),
        textColor: merged.textColor || DEFAULT_PICTURE_BUTTON_STYLING.textColor,
        borderWidthPx: clamp(Number(merged.borderWidthPx ?? DEFAULT_PICTURE_BUTTON_STYLING.borderWidthPx), 0, 8),
        borderColor: merged.borderColor || DEFAULT_PICTURE_BUTTON_STYLING.borderColor,
        hoverBorderColor: merged.hoverBorderColor || merged.hoverColor || options?.fallbackHoverColor || DEFAULT_PICTURE_BUTTON_STYLING.hoverBorderColor,
        selectedBorderColor: merged.selectedBorderColor || merged.selectedColor || options?.fallbackSelectedColor || DEFAULT_PICTURE_BUTTON_STYLING.selectedBorderColor,
        selectedRingColor: merged.selectedRingColor || merged.selectedColor || options?.fallbackSelectedColor || DEFAULT_PICTURE_BUTTON_STYLING.selectedRingColor,
        hoverColor: merged.hoverColor || options?.fallbackHoverColor || DEFAULT_PICTURE_BUTTON_STYLING.hoverColor,
        selectedColor: merged.selectedColor || options?.fallbackSelectedColor || DEFAULT_PICTURE_BUTTON_STYLING.selectedColor,
        hoverOpacity: clamp(Number(merged.hoverOpacity ?? DEFAULT_PICTURE_BUTTON_STYLING.hoverOpacity), 0, 1),
        selectedOpacity: clamp(Number(merged.selectedOpacity ?? DEFAULT_PICTURE_BUTTON_STYLING.selectedOpacity), 0, 1),
        outlineOpacity: clamp(Number(merged.outlineOpacity ?? DEFAULT_PICTURE_BUTTON_STYLING.outlineOpacity), 0, 1),
        hoverZoomScale: clamp(Number(merged.hoverZoomScale ?? DEFAULT_PICTURE_BUTTON_STYLING.hoverZoomScale), 1, 1.2),
        hoverZoomDurationMs: clamp(Number(merged.hoverZoomDurationMs ?? DEFAULT_PICTURE_BUTTON_STYLING.hoverZoomDurationMs), 60, 400),
        hoverEffect: resolveHoverEffect(selectorConfig, merged),
        selectedEffect: resolveSelectedEffect(selectorConfig, merged),
        sizePx: resolvedSizePx,
        showImage,
        showLabel,
        isTextBelow: displayMode === "text_and_image",
    };
};

export const resolvePictureButtonStateStyles = (
    config: ResolvedPictureButtonStyling,
    options: {
        isHovered: boolean;
        isSelected: boolean;
    },
) => {
    const { isHovered, isSelected } = options;
    const hoverActive = isHovered && !isSelected && config.hoverEnabled !== false;

    let backgroundColor = config.backgroundColor;
    let borderColor = config.borderWidthPx > 0
        ? withOpacity(config.borderColor, config.outlineOpacity)
        : "transparent";
    let boxShadow: string | undefined;

    if (isSelected) {
        switch (config.selectedEffect) {
            case "fill":
                backgroundColor = hexToRgba(config.selectedColor, config.selectedOpacity);
                borderColor = withOpacity(config.selectedBorderColor, config.outlineOpacity);
                break;
            case "outline":
                borderColor = withOpacity(config.selectedBorderColor, config.outlineOpacity);
                break;
            case "ring":
                borderColor = withOpacity(config.selectedBorderColor, config.outlineOpacity);
                boxShadow = `0 0 0 3px ${withOpacity(config.selectedRingColor, config.selectedOpacity)}`;
                break;
            case "none":
            default:
                break;
        }
    } else if (hoverActive) {
        switch (config.hoverEffect) {
            case "fill":
                backgroundColor = hexToRgba(config.hoverColor, config.hoverOpacity);
                borderColor = withOpacity(config.hoverBorderColor, config.outlineOpacity);
                break;
            case "outline":
                borderColor = withOpacity(config.hoverBorderColor, config.outlineOpacity);
                break;
            case "none":
            default:
                break;
        }
    }

    const transform = hoverActive && config.hoverZoomEnabled
        ? `scale(${config.hoverZoomScale})`
        : "scale(1)";

    return {
        backgroundColor,
        borderColor,
        boxShadow,
        transform,
        transitionDuration: `${config.hoverZoomDurationMs}ms`,
    };
};

export const getOptionImageUrl = (
    settings?: {
        customImage?: string | null;
        showThumbnail?: boolean;
    } | null,
    fallbackUrl?: string | null,
) => settings?.customImage || fallbackUrl || undefined;

export const getSectionSelectorStyling = (selectorStyling?: SelectorStyling | null) => ({
    textButtons: selectorStyling?.textButtons || {},
    pictureButtons: selectorStyling?.pictureButtons || {},
});

export type { SelectorStyling };
