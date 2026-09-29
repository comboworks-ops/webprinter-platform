import { styleFeaturedButtons } from './featuredProductPresentation.ts';
import type { BrandingData, HeroButton } from '@/hooks/useBrandingDraft';
import { readSharedButtons } from './sharedButtons.ts';

export const SITE_COLOR_KEYS = ['primary', 'secondary', 'background', 'card', 'dropdown', 'hover', 'headingText', 'bodyText', 'pricingText', 'linkText'] as const;
export type SiteColorKey = typeof SITE_COLOR_KEYS[number];
export type SiteColorPalette = Record<SiteColorKey, string>;
export const STANDARD_SITE_COLORS: SiteColorPalette = {
    primary: '#087FC5', secondary: '#EFF6FC', background: '#FFFFFF', card: '#FFFFFF', dropdown: '#FFFFFF',
    hover: '#066BA8', headingText: '#0B1933', bodyText: '#4B5565', pricingText: '#087FC5', linkText: '#087FC5',
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const hexToRgba = (color: string, alpha: number): string => {
    const normalized = String(color || "").trim();
    const a = clamp(Number.isFinite(alpha) ? alpha : 1, 0, 1);

    const shortMatch = normalized.match(/^#([0-9a-f]{3})$/i);
    if (shortMatch) {
        const [r, g, b] = shortMatch[1].split("").map((c) => parseInt(c + c, 16));
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    const longMatch = normalized.match(/^#([0-9a-f]{6})$/i);
    if (longMatch) {
        const hex = longMatch[1];
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    return normalized || `rgba(0, 0, 0, ${a})`;
};

const getReadableTextForSolid = (background: string, preferred = "#FFFFFF"): string => {
    const normalized = String(background || "").trim();
    const shortMatch = normalized.match(/^#([0-9a-f]{3})$/i);
    const longMatch = normalized.match(/^#([0-9a-f]{6})$/i);
    const hex = shortMatch
        ? shortMatch[1].split("").map((part) => `${part}${part}`).join("")
        : longMatch?.[1];

    if (!hex) return preferred;

    const channels = [0, 2, 4].map((index) => {
        const value = parseInt(hex.slice(index, index + 2), 16) / 255;
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    const inkLuminance = 0.0088; // #0F172A
    return (luminance + 0.05) / (inkLuminance + 0.05) >= 1.05 / (luminance + 0.05) ? "#0F172A" : "#FFFFFF";
};

export const buildSiteColorPatch = (
    draft: BrandingData,
    presetColors: SiteColorPalette,
): Partial<BrandingData> => {
    const colors = {
        ...draft.colors,
        ...presetColors,
        backgroundType: "solid" as const,
        backgroundGradientType: draft.colors.backgroundGradientType || "linear",
        backgroundGradientStart: presetColors.background,
        backgroundGradientEnd: presetColors.secondary,
        backgroundGradientUseMiddle: false,
        backgroundGradientMiddle: presetColors.card,
        backgroundGradientAngle: draft.colors.backgroundGradientAngle ?? 135,
        backgroundImageUrl: null,
    };
    const primary = colors.primary;
    const secondary = colors.secondary;
    const background = colors.background;
    const card = colors.card;
    const dropdown = colors.dropdown || card;
    const hover = colors.hover || primary;
    const heading = colors.headingText;
    const body = colors.bodyText;
    const pricing = colors.pricingText || primary;
    const primaryFillText = getReadableTextForSolid(primary);
    const hoverFillText = getReadableTextForSolid(hover, primaryFillText);
    const cardFillText = getReadableTextForSolid(card, heading);
    const buttonText = primaryFillText;
    const brandHeader = draft.header.bgColor?.toLowerCase() === draft.colors.primary?.toLowerCase();

    const currentProductPage = draft.productPage;
    const currentHero = draft.hero;
    const currentHeroOverlay = currentHero.overlay;
    const currentUspStrip = draft.uspStrip;
    const currentMatrix = currentProductPage.matrix;
    const currentPricePanel = currentProductPage.pricePanel;
    const currentOrderButtons = currentProductPage.orderButtons;
    const currentOptionSelectors = currentProductPage.optionSelectors;
    const currentForside = draft.forside;
    const currentProductsSection = currentForside.productsSection;
    const currentFeatured = currentProductsSection.featuredProductConfig;
    const themeHeroButton = (
        button: HeroButton,
        index = 0,
    ) => {
        const isSecondary = button.variant === "secondary" || index > 0;
        const backgroundColor = isSecondary ? card : primary;
        return {
            ...button,
            textColor: isSecondary ? cardFillText : buttonText,
            bgColor: backgroundColor,
            bgHoverColor: isSecondary ? secondary : hover,
            bgOpacity: button.bgOpacity ?? 1,
        };
    };
    const themedHeroButtons = currentHeroOverlay.buttons.map(themeHeroButton);

    const shared = readSharedButtons(draft);
    return {
        themeSettings: { ...draft.themeSettings, dropdownColorsCustomized: true, sharedButtons: {
            ...shared,
            ...(shared.cta ? { cta: { ...shared.cta, bgColor: primary, hoverBgColor: hover,
                textColor: buttonText, hoverTextColor: hoverFillText, selectedBgColor: primary,
                selectedTextColor: buttonText, borderColor: primary } } : {}),
            ...(shared.selection ? { selection: { ...shared.selection, bgColor: card, hoverBgColor: secondary,
                textColor: heading, hoverTextColor: hover, selectedBgColor: primary,
                selectedTextColor: buttonText, borderColor: secondary } } : {}),
        } },
        colors,
        hero: {
            ...currentHero,
            overlay_color: heading,
            overlay_opacity: currentHero.overlay_opacity ?? 0.3,
            overlay: {
                ...currentHeroOverlay,
                titleColor: buttonText,
                subtitleColor: hexToRgba(buttonText, 0.9),
                buttons: themedHeroButtons,
            },
            images: (currentHero.images || []).map((image) => ({
                ...image,
                overlayColor: currentHero.usePerBannerOverlay ? heading : image.overlayColor,
                overlayOpacity: currentHero.usePerBannerOverlay ? (image.overlayOpacity ?? currentHero.overlay_opacity ?? 0.3) : image.overlayOpacity,
                buttons: image.buttons?.map(themeHeroButton),
            })),
        },
        header: {
            ...draft.header,
            logoTextColor: brandHeader ? buttonText : heading,
            bgColor: brandHeader ? primary : card,
            textColor: brandHeader ? buttonText : heading,
            hoverTextColor: brandHeader ? buttonText : hover,
            activeTextColor: brandHeader ? buttonText : primary,
            actionHoverBgColor: hexToRgba(primary, 0.1),
            actionHoverTextColor: hover,
            dropdownBgColor: dropdown,
            dropdownHoverColor: secondary,
            dropdownCategoryColor: body,
            dropdownProductColor: heading,
            dropdownMetaColor: body,
            cta: {
                ...draft.header.cta,
                bgColor: primary,
                textColor: buttonText,
                hoverBgColor: hover,
                hoverTextColor: hoverFillText,
            },
        },
        footer: {
            ...draft.footer,
            background: "solid" as const,
            bgColor: heading,
        },
        uspStrip: {
            ...currentUspStrip,
            backgroundColor: primary,
            useGradient: true,
            gradientFrom: primary,
            gradientTo: hover,
            textColor: buttonText,
            iconColor: buttonText,
            titleColor: buttonText,
            descriptionColor: hexToRgba(buttonText, 0.9),
        },
        forside: {
            ...currentForside,
            productsSection: {
                ...currentProductsSection,
                categoryTabs: {
                    ...currentProductsSection.categoryTabs,
                    textColor: heading,
                    hoverTextColor: hover,
                    activeTextColor: primaryFillText,
                    bgColor: card,
                    hoverBgColor: secondary,
                    activeBgColor: primary,
                    borderColor: secondary,
                    activeBorderColor: primary,
                },
                card: {
                    ...currentProductsSection.card,
                    titleColor: heading,
                    bodyColor: body,
                    priceColor: pricing,
                },
                button: {
                    ...currentProductsSection.button,
                    bgColor: primary,
                    hoverBgColor: hover,
                    textColor: buttonText,
                    hoverTextColor: hoverFillText,
                    gradientStart: primary, gradientEnd: primary, hoverGradientStart: hover, hoverGradientEnd: hover,
                },
                background: {
                    ...currentProductsSection.background,
                    type: "solid" as const,
                    color: background,
                    gradientStart: background,
                    gradientEnd: secondary,
                    opacity: 1,
                },
                featuredProductConfig: {
                    ...styleFeaturedButtons(currentFeatured, { ctaColor: primary, ctaHoverColor: hover, ctaTextColor: buttonText }),
                    backgroundColor: card,
                    ctaHoverColor: hover,
                    ctaColor: primary,
                    ctaTextColor: buttonText,
                    sidePanel: {
                        ...currentFeatured.sidePanel,
                        ctaHoverColor: hover,
                    ctaColor: primary,
                        ctaTextColor: buttonText,
                    },
                },
            },
        },
        productPage: {
            ...currentProductPage,
            heading: {
                ...currentProductPage.heading,
                color: heading,
                subtext: {
                    ...currentProductPage.heading?.subtext,
                    color: body,
                },
            },
            infoSection: {
                ...currentProductPage.infoSection,
                bgColor: card,
                borderColor: secondary,
                titleColor: heading,
                textColor: body,
            },
            matrix: {
                ...currentMatrix,
                headerBg: secondary,
                headerText: heading,
                rowHeaderBg: card,
                rowHeaderText: heading,
                cellBg: card,
                cellText: heading,
                cellHoverBg: secondary,
                cellHoverText: heading,
                selectedBg: primary,
                selectedText: buttonText,
                borderColor: secondary,
                navButtonBg: card,
                navButtonText: heading,
                navButtonHoverBg: secondary,
                navButtonHoverText: hover,
                navButtonBorder: secondary,
                navButtonHoverBorder: primary,
                boxBackgroundColor: card,
                boxBorderColor: secondary,
                textButtons: {
                    ...currentMatrix?.textButtons,
                    backgroundColor: card,
                    hoverBackgroundColor: secondary,
                    textColor: heading,
                    hoverTextColor: hover,
                    selectedBackgroundColor: primary,
                    selectedTextColor: buttonText,
                    borderColor: secondary,
                    hoverBorderColor: primary,
                },
                pictureButtons: {
                    ...currentMatrix?.pictureButtons,
                    hoverColor: primary,
                    selectedColor: primary,
                },
            },
            pricePanel: {
                ...currentPricePanel,
                backgroundType: "solid" as const,
                backgroundColor: hexToRgba(primary, 0.05),
                gradientStart: hexToRgba(primary, 0.1),
                gradientEnd: card,
                titleColor: heading,
                textColor: heading,
                mutedTextColor: body,
                priceColor: pricing,
                borderColor: hexToRgba(primary, 0.18),
                dividerColor: hexToRgba(primary, 0.12),
                optionBg: card,
                optionHoverBg: hexToRgba(primary, 0.06),
                optionSelectedBg: hexToRgba(primary, 0.1),
                optionBorderColor: secondary,
                optionHoverBorderColor: hexToRgba(primary, 0.35),
                optionSelectedBorderColor: primary,
                badgeBg: hexToRgba(primary, 0.1),
                badgeText: primary,
                badgeBorderColor: primary,
                downloadButtonBg: card,
                downloadButtonHoverBg: secondary,
                downloadButtonText: heading,
                downloadButtonHoverText: hover,
                downloadButtonBorder: secondary,
                downloadButtonHoverBorder: primary,
            },
            orderButtons: {
                ...currentOrderButtons,
                primary: {
                    ...currentOrderButtons.primary,
                    bgColor: primary,
                    hoverBgColor: hover,
                    textColor: buttonText,
                    hoverTextColor: hoverFillText,
                    borderColor: primary,
                    hoverBorderColor: hover,
                    gradientStart: primary, gradientEnd: primary, hoverGradientStart: hover, hoverGradientEnd: hover,
                },
                secondary: {
                    ...currentOrderButtons.secondary,
                    bgColor: card,
                    hoverBgColor: secondary,
                    textColor: heading,
                    hoverTextColor: hover,
                    borderColor: secondary,
                    hoverBorderColor: primary,
                },
                selected: {
                    ...currentOrderButtons.selected,
                    bgColor: primary,
                    hoverBgColor: hover,
                    textColor: buttonText,
                    hoverTextColor: hoverFillText,
                    borderColor: primary,
                    hoverBorderColor: hover,
                    gradientStart: primary, gradientEnd: primary, hoverGradientStart: hover, hoverGradientEnd: hover,
                },
            },
            optionSelectors: {
                ...currentOptionSelectors,
                button: {
                    ...currentOptionSelectors?.button,
                    bgColor: card,
                    textColor: heading,
                    selectedBgColor: primary,
                    selectedTextColor: buttonText,
                    hoverBgColor: secondary,
                    hoverTextColor: hover,
                    borderColor: secondary,
                    selectedRingColor: primary,
                },
                image: {
                    ...currentOptionSelectors?.image,
                    bgColor: card,
                    selectedBgColor: hexToRgba(primary, 0.1),
                    hoverBgColor: secondary,
                    selectedRingColor: primary,
                    hoverRingColor: primary,
                    labelColor: heading,
                },
                dropdown: {
                    ...currentOptionSelectors?.dropdown,
                    bgColor: card,
                    textColor: heading,
                    borderColor: secondary,
                },
                checkbox: {
                    ...currentOptionSelectors?.checkbox,
                    accentColor: primary,
                    labelColor: heading,
                },
            },
        },
    };
};

/** Apply only the destinations belonging to the edited color role. Unrelated local colors,
 * typography, images and layout stay intact, even when they differ from the palette. */
export function applySiteColor(draft: BrandingData, key: SiteColorKey, value: string): Partial<BrandingData> {
    if (!/^#[\da-f]{6}$/i.test(value)) return {};
    const palette = Object.fromEntries(SITE_COLOR_KEYS.map(name => [name, draft.colors[name]])) as SiteColorPalette;
    const before = buildSiteColorPatch(draft, palette);
    const after = buildSiteColorPatch(draft, { ...palette, [key]: value });
    const project = (current: unknown, oldValue: unknown, newValue: unknown): unknown => {
        if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return current;
        if (newValue && oldValue && typeof newValue === 'object' && typeof oldValue === 'object') {
            const result: Record<string, unknown> | unknown[] = Array.isArray(newValue) ? [...(current as unknown[] || [])] : { ...(current as object || {}) };
            for (const name of Object.keys(newValue)) {
                const next = project(current?.[name], oldValue[name], newValue[name]);
                if (next !== undefined) result[name] = next;
            }
            return result;
        }
        return newValue;
    };
    const result = { ...project(draft, before, after) as BrandingData };
    // Picking a solid background must also disable a previously selected image/gradient.
    if (key === 'background') {
        result.colors = { ...result.colors, backgroundType: 'solid', backgroundImageUrl: null };
        result.forside = { ...result.forside, productsSection: { ...result.forside.productsSection,
            background: { ...result.forside.productsSection.background, type: 'solid', opacity: 1 } } };
    }
    if (key === 'dropdown') result.themeSettings = { ...result.themeSettings, dropdownColorsCustomized: true };
    return result;
}

/** Color-only reset keeps composition, media, content and saved banks. Unlocking is explicit. */
export function resetSiteColors(draft: BrandingData, releaseLocks = false): Partial<BrandingData> {
    const patch = buildSiteColorPatch(draft, STANDARD_SITE_COLORS);
    if (releaseLocks) patch.themeSettings = { ...patch.themeSettings,
        sharedButtons: { ...readSharedButtons({ ...draft, ...patch }), overrides: {} } };
    return patch;
}
