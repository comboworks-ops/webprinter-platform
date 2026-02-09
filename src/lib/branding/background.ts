import type { CSSProperties } from "react";
import type { BrandingData } from "@/hooks/useBrandingDraft";

export function getPageBackgroundStyle(branding?: BrandingData | null): CSSProperties {
    const colors = branding?.colors;
    const solid = colors?.background || "#F8FAFC";
    const backgroundType = colors?.backgroundType || "solid";

    if (backgroundType !== "gradient") {
        return { backgroundColor: solid };
    }

    const gradientType = colors?.backgroundGradientType || "linear";
    const start = colors?.backgroundGradientStart || solid;
    const end = colors?.backgroundGradientEnd || solid;
    const useMiddle = colors?.backgroundGradientUseMiddle ?? false;
    const middle = colors?.backgroundGradientMiddle || solid;
    const angle = typeof colors?.backgroundGradientAngle === "number"
        ? colors.backgroundGradientAngle
        : 135;

    const stops = useMiddle ? `${start}, ${middle}, ${end}` : `${start}, ${end}`;
    const backgroundImage = gradientType === "radial"
        ? `radial-gradient(circle, ${stops})`
        : `linear-gradient(${angle}deg, ${stops})`;

    return {
        backgroundColor: solid,
        backgroundImage,
    };
}
