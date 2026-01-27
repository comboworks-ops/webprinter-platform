/**
 * Compute Export Crop Rectangle
 * 
 * Calculates the correct crop area for PDF export based on:
 * - Whether to include bleed or not
 * - Document dimensions in mm
 * - Canvas/pasteboard layout
 * 
 * Returns both pixel coordinates (for canvas capture) and mm dimensions (for PDF sizing).
 */

export interface ExportCropParams {
    includeBleed: boolean;
    width_mm: number;
    height_mm: number;
    bleed_mm: number;
    mmToPx: number;  // Conversion factor (typically DISPLAY_DPI / 25.4)
    pasteboardPaddingPx: number;
    canvasWidthPx: number;
    canvasHeightPx: number;
}

export interface ExportCropResult {
    // Pixel coordinates for canvas.toDataURL crop
    cropLeft: number;
    cropTop: number;
    cropWidth: number;
    cropHeight: number;
    // MM dimensions for PDF page size
    pdfWidthMm: number;
    pdfHeightMm: number;
    // Validation
    isValid: boolean;
    error?: string;
}

/**
 * Compute the crop rectangle for export
 */
export function computeExportCropRect(params: ExportCropParams): ExportCropResult {
    const {
        includeBleed,
        width_mm,
        height_mm,
        bleed_mm,
        mmToPx,
        pasteboardPaddingPx,
        canvasWidthPx,
        canvasHeightPx
    } = params;

    // Validate inputs
    if (width_mm <= 0 || height_mm <= 0) {
        return {
            cropLeft: 0,
            cropTop: 0,
            cropWidth: 0,
            cropHeight: 0,
            pdfWidthMm: 0,
            pdfHeightMm: 0,
            isValid: false,
            error: 'Invalid document dimensions'
        };
    }

    const bleedPx = (bleed_mm || 0) * mmToPx;

    let cropLeft: number;
    let cropTop: number;
    let cropWidth: number;
    let cropHeight: number;
    let pdfWidthMm: number;
    let pdfHeightMm: number;

    if (includeBleed) {
        // FULL BLEED: Capture from pasteboard edge (where bleed box starts)
        cropLeft = pasteboardPaddingPx;
        cropTop = pasteboardPaddingPx;
        cropWidth = (width_mm * mmToPx) + (bleedPx * 2);
        cropHeight = (height_mm * mmToPx) + (bleedPx * 2);
        pdfWidthMm = width_mm + (bleed_mm * 2);
        pdfHeightMm = height_mm + (bleed_mm * 2);
    } else {
        // TRIM BOX ONLY: Exclude bleed on all sides
        cropLeft = pasteboardPaddingPx + bleedPx;
        cropTop = pasteboardPaddingPx + bleedPx;
        cropWidth = width_mm * mmToPx;
        cropHeight = height_mm * mmToPx;
        pdfWidthMm = width_mm;
        pdfHeightMm = height_mm;
    }

    // Clamp to canvas bounds to prevent out-of-range values
    cropLeft = Math.max(0, Math.min(cropLeft, canvasWidthPx));
    cropTop = Math.max(0, Math.min(cropTop, canvasHeightPx));
    cropWidth = Math.max(1, Math.min(cropWidth, canvasWidthPx - cropLeft));
    cropHeight = Math.max(1, Math.min(cropHeight, canvasHeightPx - cropTop));

    // Validate the result
    const isValid = cropWidth > 0 && cropHeight > 0 && pdfWidthMm > 0 && pdfHeightMm > 0;

    return {
        cropLeft,
        cropTop,
        cropWidth,
        cropHeight,
        pdfWidthMm,
        pdfHeightMm,
        isValid,
        error: isValid ? undefined : 'Computed crop rectangle is invalid'
    };
}
