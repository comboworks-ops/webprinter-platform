/**
 * Export Vector PDF Background
 * PROTECTED - See .agent/workflows/vector-pdf-protected.md
 * 
 * Preserves vector content from imported PDF pages by:
 * 1. Embedding the original PDF page as a vector base
 * 2. Rendering overlay objects (text, shapes, images added by user) as a transparent PNG
 * 3. Compositing the overlay on top of the vector page
 * 
 * Uses pdf-lib for PDF manipulation in the browser.
 */

import { PDFDocument, rgb } from 'pdf-lib';
import { fabric } from 'fabric';
import { ExportResult, DocumentSpec } from './types';
import { hideGuides, restoreGuides } from './hideExportGuides';

// CRITICAL: Must match Designer's DISPLAY_DPI
const DISPLAY_DPI = 50.8;
const MM_TO_PX = DISPLAY_DPI / 25.4;
const PASTEBOARD_PADDING_PX = 100;

export interface PdfBackgroundMeta {
    kind: 'pdf_page_background';
    originalPdfBytes: ArrayBuffer;
    pageIndex: number;  // 0-based page index
    originalFileName?: string;
}

export interface VectorExportOptions {
    documentSpec: DocumentSpec;
    fabricCanvas: fabric.Canvas;
    pdfBackgroundMeta: PdfBackgroundMeta;
    includeBleed: boolean;
}

/**
 * Check if a Fabric canvas has a PDF background that can be preserved as vector
 */
export function detectPdfBackground(fabricCanvas: fabric.Canvas | null): PdfBackgroundMeta | null {
    if (!fabricCanvas) return null;

    const objects = fabricCanvas.getObjects();

    for (const obj of objects) {
        const data = (obj as any).data;
        if (data?.kind === 'pdf_page_background' && data.originalPdfBytes) {
            return {
                kind: 'pdf_page_background',
                originalPdfBytes: data.originalPdfBytes,
                pageIndex: data.pageIndex || 0,
                originalFileName: data.originalFileName
            };
        }
    }

    return null;
}

/**
 * Check if canvas has any overlay objects (non-background, non-guide objects)
 */
export function hasOverlayObjects(fabricCanvas: fabric.Canvas | null): boolean {
    if (!fabricCanvas) return false;

    const objects = fabricCanvas.getObjects();

    for (const obj of objects) {
        const isBackground = (obj as any).__isDocumentBackground === true;
        const isGuide = (obj as any).__isGuide === true;
        const isPdfBackground = (obj as any).data?.kind === 'pdf_page_background';

        if (!isBackground && !isGuide && !isPdfBackground) {
            return true;
        }
    }

    return false;
}

/**
 * Export PDF with preserved vector background
 * 
 * Strategy:
 * 1. Load original PDF and extract the specific page
 * 2. Create a new PDF with that page as the base
 * 3. Render overlays as transparent PNG
 * 4. Embed the overlay image on top
 */
export async function exportVectorPdfBackground(
    options: VectorExportOptions
): Promise<ExportResult> {
    const { documentSpec, fabricCanvas, pdfBackgroundMeta, includeBleed } = options;

    try {
        // 1. Load the original PDF
        const originalPdf = await PDFDocument.load(pdfBackgroundMeta.originalPdfBytes);
        const pageIndex = pdfBackgroundMeta.pageIndex;

        if (pageIndex >= originalPdf.getPageCount()) {
            throw new Error(`Page ${pageIndex + 1} not found in original PDF`);
        }

        // 2. Create new PDF and copy the page
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(originalPdf, [pageIndex]);
        newPdf.addPage(copiedPage);

        // 3. Check if there are overlays to render
        if (hasOverlayObjects(fabricCanvas)) {
            // 4. Render overlay objects as transparent PNG
            const overlayDataUrl = await renderOverlaysOnly(fabricCanvas, documentSpec, includeBleed);

            if (overlayDataUrl) {
                // 5. Embed overlay image on the page
                const overlayImageBytes = await fetchDataUrlAsBytes(overlayDataUrl);
                const overlayImage = await newPdf.embedPng(overlayImageBytes);

                const page = newPdf.getPage(0);
                const { width: pageWidth, height: pageHeight } = page.getSize();

                // Draw overlay image covering the entire page
                page.drawImage(overlayImage, {
                    x: 0,
                    y: 0,
                    width: pageWidth,
                    height: pageHeight,
                });
            }
        }

        // 6. Generate final PDF
        const pdfBytes = await newPdf.save();
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        // 7. Download
        const fileName = getExportFilename(documentSpec.name, pdfBackgroundMeta.originalFileName);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return { success: true, filename: fileName };
    } catch (error) {
        console.error('[VectorExport] Error:', error);
        return {
            success: false,
            filename: '',
            error: error instanceof Error ? error.message : 'Vector PDF export failed'
        };
    }
}

/**
 * Render only overlay objects (hide background and guides)
 * Returns a data URL of a transparent PNG
 */
async function renderOverlaysOnly(
    fabricCanvas: fabric.Canvas,
    docSpec: DocumentSpec,
    includeBleed: boolean
): Promise<string | null> {
    const objects = fabricCanvas.getObjects();
    const hiddenObjects: { obj: fabric.Object; wasVisible: boolean }[] = [];

    try {
        // Hide background and PDF background objects
        for (const obj of objects) {
            const isBackground = (obj as any).__isDocumentBackground === true;
            const isGuide = (obj as any).__isGuide === true;
            const isPdfBackground = (obj as any).data?.kind === 'pdf_page_background';

            if (isBackground || isGuide || isPdfBackground) {
                hiddenObjects.push({
                    obj,
                    wasVisible: obj.visible !== false
                });
                obj.visible = false;
            }
        }

        fabricCanvas.renderAll();

        // Calculate crop area
        const bleedPx = includeBleed ? (docSpec.bleed_mm || 0) * MM_TO_PX : 0;
        const cropLeft = PASTEBOARD_PADDING_PX + (includeBleed ? 0 : bleedPx);
        const cropTop = PASTEBOARD_PADDING_PX + (includeBleed ? 0 : bleedPx);
        const cropWidth = (docSpec.width_mm * MM_TO_PX) + (includeBleed ? bleedPx * 2 : 0);
        const cropHeight = (docSpec.height_mm * MM_TO_PX) + (includeBleed ? bleedPx * 2 : 0);

        // Set canvas background to transparent for overlay
        const originalBg = fabricCanvas.backgroundColor;
        fabricCanvas.backgroundColor = 'transparent';
        fabricCanvas.renderAll();

        // Render at high resolution
        const multiplier = 300 / 96;
        const dataUrl = fabricCanvas.toDataURL({
            format: 'png',
            multiplier,
            left: cropLeft,
            top: cropTop,
            width: cropWidth,
            height: cropHeight,
        });

        // Restore background color
        fabricCanvas.backgroundColor = originalBg;

        return dataUrl;
    } finally {
        // Restore hidden objects
        for (const { obj, wasVisible } of hiddenObjects) {
            obj.visible = wasVisible;
        }
        fabricCanvas.renderAll();
    }
}

/**
 * Convert data URL to Uint8Array
 */
async function fetchDataUrlAsBytes(dataUrl: string): Promise<Uint8Array> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}

/**
 * Generate filename for export
 */
function getExportFilename(designName: string | undefined, originalFileName?: string): string {
    if (designName && designName.trim() && designName !== 'Uden titel') {
        return `${sanitize(designName)}.pdf`;
    }
    if (originalFileName) {
        // Remove .pdf extension and add it back
        const base = originalFileName.replace(/\.pdf$/i, '');
        return `${sanitize(base)}_edited.pdf`;
    }
    return 'WebPrinter_PDF.pdf';
}

function sanitize(name: string): string {
    return name.replace(/[^a-z0-9æøåÆØÅ\s-]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}
