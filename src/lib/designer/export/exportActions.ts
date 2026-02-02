/**
 * Export Actions for Designer
 * 
 * Orchestrates different export modes (print_pdf, proof_pdf, original_pdf).
 * Does NOT modify existing export logic - wraps and reuses it.
 */

import jsPDF from 'jspdf';
import { ExportMode, ExportOptions, DocumentSpec, PdfSourceMeta, ExportResult } from './types';
import { OUTPUT_PROFILES, SRGB_PROFILE_URL } from '@/lib/color/iccProofing';
import { withHiddenGuides } from './hideExportGuides';
import { computeExportCropRect } from './computeExportCropRect';
import { exportVectorPdfBackground } from './exportVectorPdfBackground';

// CRITICAL: Must match Designer's DISPLAY_DPI (50.8 DPI = ~2 pixels per mm)
const DISPLAY_DPI = 50.8;
const MM_TO_PX = DISPLAY_DPI / 25.4; // ≈ 2 pixels per mm
const PASTEBOARD_PADDING_PX = 100;

// Import type for vector PDF background (avoid circular dependency with dynamic import)
interface PdfBackgroundMeta {
    kind: 'pdf_page_background';
    originalPdfBytes: ArrayBuffer;
    pageIndex: number;
    originalFileName?: string;
}

interface ExportContext {
    documentSpec: DocumentSpec;
    fabricCanvas: fabric.Canvas | null;
    colorProofing: {
        settings: { outputProfileId: string };
        exportCMYK: (
            inputProfileUrl: string,
            outputProfileUrl: string,
            outputProfileBytes?: ArrayBuffer | null,
            cropRect?: { left: number; top: number; width: number; height: number }
        ) => Promise<{ cmykData: Uint8Array; proofedRgbDataUrl: string; width: number; height: number }>;
    };
    productProfileBytes?: ArrayBuffer | null;
    pdfSourceMeta?: PdfSourceMeta | null;
    hasChanges?: boolean;
    pdfBackgroundMeta?: PdfBackgroundMeta | null;
}

/**
 * Run the designer export based on selected mode
 */
export async function runDesignerExport(
    options: ExportOptions,
    context: ExportContext
): Promise<ExportResult> {
    const { mode, includeBleed } = options;
    const { documentSpec, fabricCanvas, colorProofing, productProfileBytes, pdfSourceMeta, hasChanges, pdfBackgroundMeta } = context;

    try {
        switch (mode) {
            case 'print_pdf':
                // Both print and proof use the same capture pipeline for reliability
                // The colorProofing.exportCMYK provides high-quality canvas capture
                return await exportProofPdf(documentSpec, colorProofing, productProfileBytes, includeBleed, 'print', fabricCanvas);

            case 'proof_pdf':
                return await exportProofPdf(documentSpec, colorProofing, productProfileBytes, includeBleed, 'proof', fabricCanvas);

            case 'original_pdf':
                if (!pdfSourceMeta || hasChanges) {
                    throw new Error('Original PDF not available - design has been modified');
                }
                return await exportOriginalPdf(pdfSourceMeta, documentSpec.name);

            case 'vector_pdf':
                if (!pdfBackgroundMeta || !fabricCanvas) {
                    throw new Error('Vector PDF export requires an imported PDF background');
                }
                return await exportVectorPdfBackground({
                    documentSpec,
                    fabricCanvas,
                    pdfBackgroundMeta,
                    includeBleed
                });

            default:
                throw new Error(`Unknown export mode: ${mode}`);
        }
    } catch (error) {
        console.error('Export failed:', error);
        return {
            success: false,
            filename: '',
            error: error instanceof Error ? error.message : 'Unknown export error'
        };
    }
}


/**
 * Print PDF: Standard high-quality export from Fabric canvas
 * Uses direct canvas capture WITHOUT color proofing transformation
 */
async function exportPrintPdf(
    docSpec: DocumentSpec,
    fabricCanvas: fabric.Canvas | null,
    includeBleed: boolean
): Promise<ExportResult> {
    if (!fabricCanvas) {
        throw new Error('Canvas not available');
    }

    const bleedMm = includeBleed ? (docSpec.bleed_mm || 0) : 0;
    const bleedPx = bleedMm * MM_TO_PX;

    // Calculate crop area
    const cropLeft = includeBleed ? PASTEBOARD_PADDING_PX : PASTEBOARD_PADDING_PX + bleedPx;
    const cropTop = includeBleed ? PASTEBOARD_PADDING_PX : PASTEBOARD_PADDING_PX + bleedPx;
    const cropWidth = includeBleed
        ? (docSpec.width_mm * MM_TO_PX) + (bleedPx * 2)
        : docSpec.width_mm * MM_TO_PX;
    const cropHeight = includeBleed
        ? (docSpec.height_mm * MM_TO_PX) + (bleedPx * 2)
        : docSpec.height_mm * MM_TO_PX;



    // High-res export (300 DPI)
    const multiplier = 300 / 96;

    const dataUrl = fabricCanvas.toDataURL({
        format: 'png',
        multiplier,
        left: cropLeft,
        top: cropTop,
        width: cropWidth,
        height: cropHeight,
        withoutTransform: true
    });



    // PDF dimensions
    const pdfWidth = docSpec.width_mm + (includeBleed ? bleedMm * 2 : 0);
    const pdfHeight = docSpec.height_mm + (includeBleed ? bleedMm * 2 : 0);

    const doc = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
    });

    doc.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'SLOW');

    const friendlyName = getExportFilename(docSpec.name);



    doc.setProperties({
        title: friendlyName,
        subject: 'Print PDF',
        creator: 'Webprinter Designer',
        keywords: 'Print, Production'
    });

    const fileName = `${friendlyName}.pdf`;

    doc.save(fileName);

    return { success: true, filename: fileName };
}

/**
 * Proof PDF: CMYK-simulated RGB export (existing behavior)
 * Uses colorProofing.exportCMYK() which returns proofedRgbDataUrl
 * Also used for Print PDF mode (same capture pipeline, different metadata)
 */
async function exportProofPdf(
    docSpec: DocumentSpec,
    colorProofing: ExportContext['colorProofing'],
    productProfileBytes: ArrayBuffer | null | undefined,
    includeBleed: boolean,
    variant: 'print' | 'proof' = 'proof',
    fabricCanvas?: fabric.Canvas | null
): Promise<ExportResult> {
    const profile = OUTPUT_PROFILES.find(p => p.id === colorProofing.settings.outputProfileId)
        || OUTPUT_PROFILES[0];

    // Use the helper for correct crop calculation
    const canvasWidth = fabricCanvas?.getWidth() || 1000;
    const canvasHeight = fabricCanvas?.getHeight() || 1000;

    const cropResult = computeExportCropRect({
        includeBleed,
        width_mm: docSpec.width_mm,
        height_mm: docSpec.height_mm,
        bleed_mm: docSpec.bleed_mm || 0,
        mmToPx: MM_TO_PX,
        pasteboardPaddingPx: PASTEBOARD_PADDING_PX,
        canvasWidthPx: canvasWidth,
        canvasHeightPx: canvasHeight
    });

    if (!cropResult.isValid) {
        throw new Error(cropResult.error || 'Invalid crop dimensions');
    }

    const cropOptions = {
        left: cropResult.cropLeft,
        top: cropResult.cropTop,
        width: cropResult.cropWidth,
        height: cropResult.cropHeight
    };

    // Hide guides during export (if fabricCanvas available)
    const doExport = async () => {
        // Use existing exportCMYK - this is the PROTECTED pipeline
        const { proofedRgbDataUrl } = await colorProofing.exportCMYK(
            SRGB_PROFILE_URL,
            profile.url,
            productProfileBytes,
            cropOptions
        );
        return proofedRgbDataUrl;
    };

    // Execute export with guides hidden
    const proofedRgbDataUrl = fabricCanvas
        ? await withHiddenGuides(fabricCanvas, doExport)
        : await doExport();

    const doc = new jsPDF({
        orientation: cropResult.pdfWidthMm > cropResult.pdfHeightMm ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [cropResult.pdfWidthMm, cropResult.pdfHeightMm]
    });

    doc.addImage(proofedRgbDataUrl, 'PNG', 0, 0, cropResult.pdfWidthMm, cropResult.pdfHeightMm, undefined, 'SLOW');

    const friendlyName = getExportFilename(docSpec.name);
    const isPrint = variant === 'print';

    doc.setProperties({
        title: friendlyName,
        subject: isPrint ? 'Print PDF' : 'Proof PDF (CMYK Simulation)',
        creator: 'Webprinter Designer',
        keywords: isPrint ? 'Print, Production' : `CMYK, ${profile.name}, Proof`
    });

    const fileName = `${friendlyName}.pdf`;

    // Use blob download for better browser compatibility (especially Chrome)
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, filename: fileName };
}


/**
 * Original PDF: Pass-through of uploaded PDF (no processing)
 * Only available when PDF was uploaded and no edits were made
 */
async function exportOriginalPdf(
    pdfSourceMeta: PdfSourceMeta,
    designName: string
): Promise<ExportResult> {
    // Download the original PDF
    const response = await fetch(pdfSourceMeta.originalUrl);
    if (!response.ok) {
        throw new Error('Could not fetch original PDF');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    // Trigger download
    const friendlyName = getExportFilename(designName);
    const link = document.createElement('a');
    link.href = url;
    link.download = pdfSourceMeta.originalFilename || `${friendlyName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, filename: link.download };
}

/**
 * Check if Original PDF mode should be available
 */
export function isOriginalPdfAvailable(
    pdfSourceMeta: PdfSourceMeta | null | undefined,
    hasChanges: boolean
): boolean {
    return Boolean(pdfSourceMeta && !hasChanges);
}

/**
 * Get export filename - uses design name or defaults to "WebPrinter PDF"
 */
function getExportFilename(name: string | undefined | null): string {
    const baseName = name && name.trim() && name !== 'Uden titel'
        ? name.trim()
        : 'WebPrinter PDF';
    return sanitizeFilename(baseName);
}

/**
 * Sanitize filename for safe download
 */
function sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9æøåÆØÅ\s-]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}
