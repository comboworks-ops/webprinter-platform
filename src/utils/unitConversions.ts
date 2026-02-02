/**
 * Unit Conversion Utilities for Print Designer
 * 
 * Ensures consistent physical scale across canvas, guides, and imported content.
 * All conversions are based on DPI (dots per inch) for print accuracy.
 */

// Constants
const MM_PER_INCH = 25.4;
const POINTS_PER_INCH = 72; // PDF standard

/**
 * Convert millimeters to pixels at the given DPI
 * @param mm - Size in millimeters
 * @param dpi - Dots per inch (default: 300 for print)
 * @returns Size in pixels
 */
export function mmToPx(mm: number, dpi: number = 300): number {
    return (mm / MM_PER_INCH) * dpi;
}

/**
 * Convert pixels to millimeters at the given DPI
 * @param px - Size in pixels
 * @param dpi - Dots per inch (default: 300 for print)
 * @returns Size in millimeters
 */
export function pxToMm(px: number, dpi: number = 300): number {
    return (px / dpi) * MM_PER_INCH;
}

/**
 * Convert PDF points to millimeters
 * PDF uses 72 points per inch
 * @param pt - Size in points
 * @returns Size in millimeters
 */
export function ptToMm(pt: number): number {
    return (pt / POINTS_PER_INCH) * MM_PER_INCH;
}

/**
 * Convert PDF points to pixels at the given DPI
 * @param pt - Size in points
 * @param dpi - Dots per inch (default: 300 for print)
 * @returns Size in pixels
 */
export function ptToPx(pt: number, dpi: number = 300): number {
    return mmToPx(ptToMm(pt), dpi);
}

/**
 * Convert millimeters to PDF points
 * @param mm - Size in millimeters
 * @returns Size in points
 */
export function mmToPt(mm: number): number {
    return (mm / MM_PER_INCH) * POINTS_PER_INCH;
}

/**
 * Calculate document canvas dimensions in pixels
 * @param widthMm - Document width in mm
 * @param heightMm - Document height in mm
 * @param bleedMm - Bleed area in mm (added to all sides)
 * @param dpi - Document DPI
 * @returns { canvasWidth, canvasHeight, bleedPx } in pixels
 */
export function calculateCanvasDimensions(
    widthMm: number,
    heightMm: number,
    bleedMm: number,
    dpi: number
): { canvasWidth: number; canvasHeight: number; bleedPx: number } {
    const totalWidthMm = widthMm + (bleedMm * 2);
    const totalHeightMm = heightMm + (bleedMm * 2);

    return {
        canvasWidth: Math.round(mmToPx(totalWidthMm, dpi)),
        canvasHeight: Math.round(mmToPx(totalHeightMm, dpi)),
        bleedPx: Math.round(mmToPx(bleedMm, dpi)),
    };
}

/**
 * Calculate the scale factor needed to display a canvas at a reasonable screen size
 * while maintaining the correct physical proportions internally.
 * 
 * @param canvasWidthPx - Full canvas width in pixels
 * @param canvasHeightPx - Full canvas height in pixels
 * @param maxDisplayWidth - Maximum display width in CSS pixels (default: 600)
 * @param maxDisplayHeight - Maximum display height in CSS pixels (default: 800)
 * @returns Display scale factor (< 1 means zoom out to fit)
 */
export function calculateDisplayScale(
    canvasWidthPx: number,
    canvasHeightPx: number,
    maxDisplayWidth: number = 600,
    maxDisplayHeight: number = 800
): number {
    const scaleX = maxDisplayWidth / canvasWidthPx;
    const scaleY = maxDisplayHeight / canvasHeightPx;
    return Math.min(scaleX, scaleY, 1); // Never zoom in beyond 100%
}

/**
 * For PDF import: calculate the physical dimensions and required scale
 * @param pdfWidthPt - PDF page width in points (from viewport at scale=1)
 * @param pdfHeightPt - PDF page height in points
 * @param documentDpi - Target document DPI
 * @param renderScale - Scale used to render PDF (for quality, e.g., 2-4)
 * @returns Object with physical mm dimensions and fabric scale factors
 */
export function calculatePdfImportScale(
    pdfWidthPt: number,
    pdfHeightPt: number,
    documentDpi: number,
    renderScale: number = 3
): {
    pdfWidthMm: number;
    pdfHeightMm: number;
    desiredWidthPx: number;
    desiredHeightPx: number;
    renderedWidthPx: number;
    renderedHeightPx: number;
    fabricScaleX: number;
    fabricScaleY: number;
} {
    // Convert PDF points to mm
    const pdfWidthMm = ptToMm(pdfWidthPt);
    const pdfHeightMm = ptToMm(pdfHeightPt);

    // Calculate desired pixel size in the document at its DPI
    const desiredWidthPx = mmToPx(pdfWidthMm, documentDpi);
    const desiredHeightPx = mmToPx(pdfHeightMm, documentDpi);

    // The PDF will be rendered at renderScale, so the raster dimensions are:
    const renderedWidthPx = pdfWidthPt * renderScale;
    const renderedHeightPx = pdfHeightPt * renderScale;

    // The Fabric image scale needed to display at the correct physical size:
    const fabricScaleX = desiredWidthPx / renderedWidthPx;
    const fabricScaleY = desiredHeightPx / renderedHeightPx;

    return {
        pdfWidthMm,
        pdfHeightMm,
        desiredWidthPx,
        desiredHeightPx,
        renderedWidthPx,
        renderedHeightPx,
        fabricScaleX,
        fabricScaleY,
    };
}

// Standard paper sizes in mm for reference
export const PAPER_SIZES_MM: Record<string, { width: number; height: number }> = {
    'A0': { width: 841, height: 1189 },
    'A1': { width: 594, height: 841 },
    'A2': { width: 420, height: 594 },
    'A3': { width: 297, height: 420 },
    'A4': { width: 210, height: 297 },
    'A5': { width: 148, height: 210 },
    'A6': { width: 105, height: 148 },
    'A7': { width: 74, height: 105 },
};
