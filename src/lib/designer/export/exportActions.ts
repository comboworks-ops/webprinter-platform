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
import { withCanonicalExportViewport } from './withCanonicalExportViewport';
import { setPdfPageBoxes } from './setPdfPageBoxes';
import { createProductionPdf, type ProductionPdfContext } from './createProductionPdf';
import type { ProductionOutputProfile } from './productionColor';

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

export interface ExportContext {
    documentSpec: DocumentSpec;
    fabricCanvas: fabric.Canvas | null;
    colorProofing: {
        settings: { outputProfileId: string; renderingIntent?: 0 | 1 | 2 | 3; blackPointCompensation?: boolean };
        resolveOutputProfile?: () => Promise<ProductionOutputProfile>;
        exportCMYK: (
            inputProfileUrl: string,
            outputProfileUrl: string,
            outputProfileBytes?: ArrayBuffer | null,
            cropRect?: { left: number; top: number; width: number; height: number }
        ) => Promise<{ cmykData: Uint8Array; proofedRgbDataUrl: string; width: number; height: number }>;
    };
    productProfileBytes?: ArrayBuffer | null;
    outputProfile?: ProductionOutputProfile;
    colorMode?: ProductionPdfContext['colorMode'];
    pdfSourceMeta?: PdfSourceMeta | null;
    hasChanges?: boolean;
    pdfBackgroundMeta?: PdfBackgroundMeta | null;
    displayMetrics?: {
        mmToPx: number;
        pasteboardPaddingPx: number;
    };
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
    const displayMetrics = context.displayMetrics || {
        mmToPx: MM_TO_PX,
        pasteboardPaddingPx: PASTEBOARD_PADDING_PX,
    };

    try {
        switch (mode) {
            case 'print_pdf':
            case 'vector_pdf': {
                const colorMode = options.colorMode || context.colorMode || 'convert_cmyk';
                const outputProfile = colorMode === 'preserve_rgb' ? undefined : context.outputProfile || await colorProofing.resolveOutputProfile?.();
                const result = await createProductionPdf({ documentSpec, fabricCanvas, includeBleed, displayMetrics,
                    outputProfile, colorMode, renderingIntent: colorProofing.settings.renderingIntent, blackPointCompensation: colorProofing.settings.blackPointCompensation });
                downloadPdfBytes(result.bytes, result.filename);
                return { success: true, filename: result.filename, warnings: result.warnings.map(warning => warning.message) };
            }

            case 'proof_pdf':
                {
                    const proof = await buildProofPdfBytes(context, includeBleed);
                    downloadPdfBytes(proof.bytes, proof.filename);
                    return { success: true, filename: proof.filename };
                }

            case 'original_pdf':
                if (!pdfSourceMeta || hasChanges) {
                    throw new Error('Original PDF not available - design has been modified');
                }
                return await exportOriginalPdf(pdfSourceMeta, documentSpec.name);

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

export function downloadPdfBytes(bytes: Uint8Array, filename: string): void {
    const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}


/**
 * Proof PDF: CMYK-simulated RGB export (existing behavior)
 * Uses colorProofing.exportCMYK() which returns proofedRgbDataUrl
 * Deliberately separate from production PDF export.
 */
export async function buildProofPdfBytes(context: ExportContext, includeBleed = true): Promise<{ bytes: Uint8Array; filename: string }> {
    const { documentSpec: docSpec, colorProofing, productProfileBytes, fabricCanvas } = context;
    const displayMetrics = context.displayMetrics || { mmToPx: MM_TO_PX, pasteboardPaddingPx: PASTEBOARD_PADDING_PX };
    const resolvedProfile = await colorProofing.resolveOutputProfile?.();
    const profile = OUTPUT_PROFILES.find(p => p.id === colorProofing.settings.outputProfileId);
    if (!resolvedProfile && !profile) throw new Error('Den valgte proof-profil kunne ikke indlæses.');

    // Use the helper for correct crop calculation
    const bleedMm = docSpec.bleed_mm || 0;
    const canvasWidth = ((docSpec.width_mm + (bleedMm * 2)) * displayMetrics.mmToPx)
        + (displayMetrics.pasteboardPaddingPx * 2);
    const canvasHeight = ((docSpec.height_mm + (bleedMm * 2)) * displayMetrics.mmToPx)
        + (displayMetrics.pasteboardPaddingPx * 2);

    const cropResult = computeExportCropRect({
        includeBleed,
        width_mm: docSpec.width_mm,
        height_mm: docSpec.height_mm,
        bleed_mm: docSpec.bleed_mm || 0,
        mmToPx: displayMetrics.mmToPx,
        pasteboardPaddingPx: displayMetrics.pasteboardPaddingPx,
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
            profile?.url || '',
            resolvedProfile?.bytes || productProfileBytes,
            cropOptions
        );
        return proofedRgbDataUrl;
    };

    // Execute export with guides hidden
    const proofedRgbDataUrl = fabricCanvas
        ? await withCanonicalExportViewport(
            fabricCanvas,
            () => withHiddenGuides(fabricCanvas, doExport),
        )
        : await doExport();

    const doc = new jsPDF({
        orientation: cropResult.pdfWidthMm > cropResult.pdfHeightMm ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [cropResult.pdfWidthMm, cropResult.pdfHeightMm]
    });

    doc.addImage(proofedRgbDataUrl, 'PNG', 0, 0, cropResult.pdfWidthMm, cropResult.pdfHeightMm, undefined, 'SLOW');
    setPdfPageBoxes(doc, docSpec.width_mm, docSpec.height_mm, includeBleed ? bleedMm : 0);

    const friendlyName = getExportFilename(docSpec.name);

    doc.setProperties({
        title: friendlyName,
        subject: 'Proof PDF (CMYK Simulation)',
        creator: 'Webprinter Designer',
        keywords: `CMYK, ${resolvedProfile?.name || profile?.name}, Proof`
    });

    const fileName = `${friendlyName}.pdf`;

    return { bytes: new Uint8Array(doc.output('arraybuffer')), filename: fileName };
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
