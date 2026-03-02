import type { CSSProperties } from "react";
import { DEFAULT_BRANDING, type BrandingData } from "@/hooks/useBrandingDraft";

export const getMatrixStyleVars = (branding?: BrandingData | null): CSSProperties => {
    const matrix = branding?.productPage?.matrix || DEFAULT_BRANDING.productPage.matrix;
    const font = matrix.font || DEFAULT_BRANDING.productPage.matrix.font;

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
    } as CSSProperties;
};
