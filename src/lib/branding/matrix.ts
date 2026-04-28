import type { CSSProperties } from "react";
import { DEFAULT_BRANDING, type BrandingData } from "@/hooks/useBrandingDraft";

interface MatrixBoxConfig {
    backgroundColor?: string;
    borderRadiusPx?: number;
    borderWidthPx?: number;
    borderColor?: string;
    paddingPx?: number;
}

export const getMatrixStyleVars = (
    branding?: BrandingData | null,
    matrixBoxOverride?: MatrixBoxConfig | null
): CSSProperties => {
    const matrix = branding?.productPage?.matrix || DEFAULT_BRANDING.productPage.matrix;
    const font = matrix.font || DEFAULT_BRANDING.productPage.matrix.font;

    // Use override if provided, otherwise use branding
    const boxBg = matrixBoxOverride?.backgroundColor || matrix.boxBackgroundColor || matrix.cellBg || "#FFFFFF";
    const boxRadius = matrixBoxOverride?.borderRadiusPx ?? matrix.boxBorderRadiusPx ?? 12;
    const boxBorderWidth = matrixBoxOverride?.borderWidthPx ?? matrix.boxBorderWidthPx ?? 1;
    const boxBorderColor = matrixBoxOverride?.borderColor || matrix.boxBorderColor || matrix.borderColor || "#E2E8F0";
    const boxPadding = matrixBoxOverride?.paddingPx ?? matrix.boxPaddingPx ?? 16;

    return {
        "--matrix-font": `'${font}', sans-serif`,
        "--matrix-header-bg": matrix.headerBg,
        "--matrix-header-text": matrix.headerText,
        "--matrix-row-header-bg": matrix.rowHeaderBg,
        "--matrix-row-header-text": matrix.rowHeaderText,
        "--matrix-cell-bg": matrix.cellBg,
        "--matrix-cell-text": matrix.cellText,
        "--matrix-cell-hover-bg": matrix.cellHoverBg,
        "--matrix-cell-hover-text": matrix.cellHoverText,
        "--matrix-selected-bg": matrix.selectedBg,
        "--matrix-selected-text": matrix.selectedText,
        "--matrix-border": matrix.borderColor,
        "--matrix-nav-button-bg": matrix.navButtonBg || matrix.cellBg,
        "--matrix-nav-button-text": matrix.navButtonText || matrix.cellText,
        "--matrix-nav-button-hover-bg": matrix.navButtonHoverBg || matrix.cellHoverBg,
        "--matrix-nav-button-hover-text": matrix.navButtonHoverText || matrix.cellHoverText,
        "--matrix-nav-button-border": matrix.navButtonBorder || matrix.borderColor,
        "--matrix-nav-button-hover-border": matrix.navButtonHoverBorder || matrix.borderColor,
        // Box styling
        "--matrix-box-bg": boxBg,
        "--matrix-box-radius": `${boxRadius}px`,
        "--matrix-box-border-width": `${boxBorderWidth}px`,
        "--matrix-box-border-color": boxBorderColor,
        "--matrix-box-padding": `${boxPadding}px`,
    } as CSSProperties;
};
