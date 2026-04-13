import type { CSSProperties } from "react";

import { mergeBrandingWithDefaults, type BrandingData } from "./types";

function hexToHsl(hex: string): string {
    if (!hex || !hex.startsWith("#")) return "0 0% 0%";

    let chars = hex.substring(1).split("");
    if (chars.length === 3) {
        chars = [chars[0], chars[0], chars[1], chars[1], chars[2], chars[2]];
    }

    const r = parseInt(chars.slice(0, 2).join(""), 16) / 255;
    const g = parseInt(chars.slice(2, 4).join(""), 16) / 255;
    const b = parseInt(chars.slice(4, 6).join(""), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const delta = max - min;
        s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

        switch (max) {
            case r:
                h = (g - b) / delta + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / delta + 2;
                break;
            case b:
                h = (r - g) / delta + 4;
                break;
        }

        h /= 6;
    }

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function buildBrandingCssVariables(branding?: Partial<BrandingData> | null): CSSProperties {
    const normalizedBranding = mergeBrandingWithDefaults(branding || {});
    const primaryColor = normalizedBranding.colors.primary || "#0EA5E9";
    const secondaryColor = normalizedBranding.colors.secondary || "#F1F5F9";
    const backgroundColor = normalizedBranding.colors.background || "#F8FAFC";
    const cardColor = normalizedBranding.colors.card || "#FFFFFF";
    const headingFont = normalizedBranding.fonts.heading || "Poppins";
    const bodyFont = normalizedBranding.fonts.body || "Inter";
    const pricingFont = normalizedBranding.fonts.pricing || "Roboto Mono";

    const headingTextColor = normalizedBranding.colors.headingText || "#1F2937";
    const bodyTextColor = normalizedBranding.colors.bodyText || "#4B5563";
    const pricingTextColor = normalizedBranding.colors.pricingText || "#0EA5E9";
    const linkTextColor = normalizedBranding.colors.linkText || "#0EA5E9";

    return {
        "--primary": hexToHsl(primaryColor),
        "--secondary": hexToHsl(secondaryColor),
        "--background": hexToHsl(backgroundColor),
        "--card": hexToHsl(cardColor),
        "--ring": hexToHsl(primaryColor),
        "--font-heading": `'${headingFont}', sans-serif`,
        "--font-body": `'${bodyFont}', sans-serif`,
        "--font-pricing": `'${pricingFont}', monospace`,
        "--heading-text": headingTextColor,
        "--body-text": bodyTextColor,
        "--pricing-text": pricingTextColor,
        "--link-text": linkTextColor,
        "--foreground": hexToHsl(headingTextColor),
        "--muted-foreground": hexToHsl(bodyTextColor),
        fontFamily: `'${bodyFont}', sans-serif`,
    } as CSSProperties;
}
