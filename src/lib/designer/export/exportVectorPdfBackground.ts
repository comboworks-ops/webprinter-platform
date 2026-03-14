/**
 * Export Vector PDF Background
 * PROTECTED - See .agent/workflows/vector-pdf-protected.md
 *
 * Preserves vector content from imported PDF pages by:
 * 1. Embedding the original PDF page as a vector base
 * 2. Rendering overlay objects (text, shapes, images added by user) as a transparent PNG
 * 3. Writing CutContour objects back as vector stroke paths in the final PDF
 *
 * Uses pdf-lib for PDF manipulation in the browser.
 */

import {
    PDFDict,
    PDFDocument,
    PDFName,
    PDFNumber,
    PDFOperator,
    concatTransformationMatrix,
    popGraphicsState,
    pushGraphicsState,
    setDashPattern,
    setGraphicsState,
    setLineWidth,
    stroke,
} from 'pdf-lib';
import { fabric } from 'fabric';
import { svgPathToOperators } from 'pdf-lib/cjs/api/svgPath';
import { ExportResult, DocumentSpec } from './types';

// CRITICAL: Must match Designer's DISPLAY_DPI
const DISPLAY_DPI = 50.8;
const MM_TO_PX = DISPLAY_DPI / 25.4;
const PASTEBOARD_PADDING_PX = 100;
const CUT_CONTOUR_COLORSPACE_NAME = 'CS_CutContour';
const CUT_CONTOUR_GSTATE_NAME = 'GS_CutContour';
const CUT_CONTOUR_SPOT_NAME = 'CutContour';
const CUT_CONTOUR_LINE_WIDTH_PT = 0.25;

type Matrix = [number, number, number, number, number, number];

interface SvgPathSpec {
    path: string;
    matrix: Matrix;
}

interface BuiltVectorPdf {
    pdfBytes: Uint8Array;
    filename: string;
}

export interface PdfBackgroundMeta {
    kind: 'pdf_page_background';
    originalPdfBytes: ArrayBuffer;
    pageIndex: number;
    originalFileName?: string;
}

export interface VectorExportOptions {
    documentSpec: DocumentSpec;
    fabricCanvas: fabric.Canvas;
    pdfBackgroundMeta: PdfBackgroundMeta;
    includeBleed: boolean;
}

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
                originalFileName: data.originalFileName,
            };
        }
    }

    return null;
}

export function hasOverlayObjects(fabricCanvas: fabric.Canvas | null): boolean {
    if (!fabricCanvas) return false;

    const objects = fabricCanvas.getObjects();

    for (const obj of objects) {
        const isBackground = (obj as any).__isDocumentBackground === true;
        const isGuide = (obj as any).__isGuide === true;
        const isPdfBackground = (obj as any).data?.kind === 'pdf_page_background';
        const isCutContour = (obj as any).__isCutContour === true;

        if (!isBackground && !isGuide && !isPdfBackground && !isCutContour) {
            return true;
        }
    }

    return false;
}

export async function buildVectorPdfBackgroundPdf(
    options: VectorExportOptions
): Promise<BuiltVectorPdf> {
    const { documentSpec, fabricCanvas, pdfBackgroundMeta, includeBleed } = options;

    const originalPdf = await PDFDocument.load(pdfBackgroundMeta.originalPdfBytes);
    const pageIndex = pdfBackgroundMeta.pageIndex;

    if (pageIndex >= originalPdf.getPageCount()) {
        throw new Error(`Page ${pageIndex + 1} not found in original PDF`);
    }

    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(originalPdf, [pageIndex]);
    newPdf.addPage(copiedPage);

    const page = newPdf.getPage(0);

    if (hasOverlayObjects(fabricCanvas)) {
        const overlayDataUrl = await renderOverlaysOnly(fabricCanvas, documentSpec, includeBleed);
        if (overlayDataUrl) {
            const overlayImageBytes = await fetchDataUrlAsBytes(overlayDataUrl);
            const overlayImage = await newPdf.embedPng(overlayImageBytes);
            const { width: pageWidth, height: pageHeight } = page.getSize();

            page.drawImage(overlayImage, {
                x: 0,
                y: 0,
                width: pageWidth,
                height: pageHeight,
            });
        }
    }

    await drawCutContoursAsVector(page, newPdf, fabricCanvas, documentSpec, includeBleed);

    const pdfBytes = await newPdf.save();
    return {
        pdfBytes,
        filename: getExportFilename(documentSpec.name, pdfBackgroundMeta.originalFileName),
    };
}

export async function exportVectorPdfBackground(
    options: VectorExportOptions
): Promise<ExportResult> {
    try {
        const { pdfBytes, filename } = await buildVectorPdfBackgroundPdf(options);
        const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return { success: true, filename };
    } catch (error) {
        console.error('[VectorExport] Error:', error);
        return {
            success: false,
            filename: '',
            error: error instanceof Error ? error.message : 'Vector PDF export failed',
        };
    }
}

function getCutContourObjects(fabricCanvas: fabric.Canvas): fabric.Object[] {
    return fabricCanvas.getObjects().filter((obj) => {
        const isGuide = (obj as any).__isGuide === true;
        const isVisible = obj.visible !== false;
        return (obj as any).__isCutContour === true && !isGuide && isVisible;
    });
}

async function drawCutContoursAsVector(
    page: any,
    pdfDoc: PDFDocument,
    fabricCanvas: fabric.Canvas,
    docSpec: DocumentSpec,
    includeBleed: boolean
): Promise<void> {
    const cutContourObjects = getCutContourObjects(fabricCanvas);
    if (cutContourObjects.length === 0) return;

    const { width: pageWidth, height: pageHeight } = page.getSize();
    const canvasToPageMatrix = getCanvasCropToPageMatrix(docSpec, includeBleed, pageWidth, pageHeight);
    ensureCutContourPdfResources(page, pdfDoc);

    for (const contourObject of cutContourObjects) {
        const contourSvg = wrapSvgMarkup(contourObject.toSVG());
        const pathSpecs = extractSvgPathSpecs(contourSvg);
        if (pathSpecs.length === 0) continue;

        for (const pathSpec of pathSpecs) {
            const finalMatrix = multiplyMatrices(canvasToPageMatrix, pathSpec.matrix);
            const lineWidth = CUT_CONTOUR_LINE_WIDTH_PT / Math.max(estimateMatrixScale(finalMatrix), 0.0001);
            page.pushOperators(
                pushGraphicsState(),
                setGraphicsState(PDFName.of(CUT_CONTOUR_GSTATE_NAME)),
                PDFOperator.of('CS', [PDFName.of(CUT_CONTOUR_COLORSPACE_NAME)]),
                PDFOperator.of('SCN', [PDFNumber.of(1)]),
                concatTransformationMatrix(
                    finalMatrix[0],
                    finalMatrix[1],
                    finalMatrix[2],
                    finalMatrix[3],
                    finalMatrix[4],
                    finalMatrix[5],
                ),
                setLineWidth(lineWidth),
                setDashPattern([], 0),
                ...svgPathToOperators(pathSpec.path),
                stroke(),
                popGraphicsState(),
            );
        }
    }
}

function ensureCutContourPdfResources(page: any, pdfDoc: PDFDocument): void {
    const normalized = page.node.normalizedEntries();
    const resources = normalized.Resources;

    let colorSpaces = resources.lookupMaybe(PDFName.of('ColorSpace'), PDFDict);
    if (!colorSpaces) {
        colorSpaces = pdfDoc.context.obj({}) as PDFDict;
        resources.set(PDFName.of('ColorSpace'), colorSpaces);
    }

    const colorSpaceName = PDFName.of(CUT_CONTOUR_COLORSPACE_NAME);
    if (!colorSpaces.has(colorSpaceName)) {
        const tintFunction = pdfDoc.context.obj({
            FunctionType: 2,
            Domain: [0, 1],
            C0: [0, 0, 0, 0],
            C1: [0, 1, 0, 0],
            N: 1,
        });

        const separation = pdfDoc.context.obj([
            PDFName.of('Separation'),
            PDFName.of(CUT_CONTOUR_SPOT_NAME),
            PDFName.of('DeviceCMYK'),
            tintFunction,
        ]) as PDFArray;

        colorSpaces.set(colorSpaceName, separation);
    }

    const extGStateName = PDFName.of(CUT_CONTOUR_GSTATE_NAME);
    if (!normalized.ExtGState.has(extGStateName)) {
        const extGState = pdfDoc.context.obj({
            Type: 'ExtGState',
            OP: true,
            op: true,
            OPM: 1,
        }) as PDFDict;
        page.node.setExtGState(extGStateName, extGState);
    }
}

function getCanvasCropToPageMatrix(
    docSpec: DocumentSpec,
    includeBleed: boolean,
    pageWidth: number,
    pageHeight: number
): Matrix {
    const bleedPx = includeBleed ? (docSpec.bleed_mm || 0) * MM_TO_PX : 0;
    const cropLeft = PASTEBOARD_PADDING_PX + (includeBleed ? 0 : bleedPx);
    const cropTop = PASTEBOARD_PADDING_PX + (includeBleed ? 0 : bleedPx);
    const cropWidth = (docSpec.width_mm * MM_TO_PX) + (includeBleed ? bleedPx * 2 : 0);
    const cropHeight = (docSpec.height_mm * MM_TO_PX) + (includeBleed ? bleedPx * 2 : 0);
    const scaleX = pageWidth / Math.max(cropWidth, 1);
    const scaleY = pageHeight / Math.max(cropHeight, 1);

    return [
        scaleX,
        0,
        0,
        -scaleY,
        -cropLeft * scaleX,
        pageHeight + (cropTop * scaleY),
    ];
}

function wrapSvgMarkup(markup: string): string {
    const trimmed = markup.trim();
    if (trimmed.startsWith('<svg')) {
        return trimmed;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg">${trimmed}</svg>`;
}

function extractSvgPathSpecs(svgMarkup: string): SvgPathSpec[] {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgMarkup, 'image/svg+xml');
    const root = svgDoc.documentElement;
    const results: SvgPathSpec[] = [];

    const visit = (element: Element, parentMatrix: Matrix) => {
        const ownMatrix = parseTransformString(element.getAttribute('transform'));
        const matrix = multiplyMatrices(parentMatrix, ownMatrix);
        const tagName = element.tagName.toLowerCase();
        const directPath = shapeElementToPath(element);

        if (directPath) {
            results.push({ path: directPath, matrix });
        }

        if (tagName !== 'path') {
            Array.from(element.children).forEach((child) => visit(child, matrix));
        }
    };

    visit(root, identityMatrix());
    return results;
}

function shapeElementToPath(element: Element): string | null {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'path') {
        return element.getAttribute('d');
    }

    if (tagName === 'line') {
        const x1 = parseNumber(element.getAttribute('x1'));
        const y1 = parseNumber(element.getAttribute('y1'));
        const x2 = parseNumber(element.getAttribute('x2'));
        const y2 = parseNumber(element.getAttribute('y2'));
        return `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    if (tagName === 'polyline' || tagName === 'polygon') {
        const points = parsePointsAttribute(element.getAttribute('points'));
        if (points.length === 0) return null;
        const commands = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`);
        return `${commands.join(' ')}${tagName === 'polygon' ? ' Z' : ''}`;
    }

    if (tagName === 'rect') {
        const x = parseNumber(element.getAttribute('x'));
        const y = parseNumber(element.getAttribute('y'));
        const width = parseNumber(element.getAttribute('width'));
        const height = parseNumber(element.getAttribute('height'));
        return `M ${x} ${y} H ${x + width} V ${y + height} H ${x} Z`;
    }

    if (tagName === 'circle') {
        const cx = parseNumber(element.getAttribute('cx'));
        const cy = parseNumber(element.getAttribute('cy'));
        const r = parseNumber(element.getAttribute('r'));
        return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy}`;
    }

    if (tagName === 'ellipse') {
        const cx = parseNumber(element.getAttribute('cx'));
        const cy = parseNumber(element.getAttribute('cy'));
        const rx = parseNumber(element.getAttribute('rx'));
        const ry = parseNumber(element.getAttribute('ry'));
        return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy}`;
    }

    return null;
}

function parsePointsAttribute(raw: string | null): Array<[number, number]> {
    if (!raw) return [];
    const values = raw
        .trim()
        .replace(/,/g, ' ')
        .split(/\s+/)
        .map((part) => Number(part))
        .filter((value) => Number.isFinite(value));

    const points: Array<[number, number]> = [];
    for (let index = 0; index < values.length - 1; index += 2) {
        points.push([values[index], values[index + 1]]);
    }
    return points;
}

function parseTransformString(transform: string | null): Matrix {
    if (!transform) return identityMatrix();

    const operations = transform.match(/\w+\([^)]*\)/g) || [];
    return operations.reduce<Matrix>((current, operation) => {
        const match = operation.match(/^(\w+)\(([^)]*)\)$/);
        if (!match) return current;

        const [, type, rawArgs] = match;
        const args = rawArgs
            .split(/[\s,]+/)
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value));

        let nextMatrix = identityMatrix();

        if (type === 'matrix' && args.length >= 6) {
            nextMatrix = [args[0], args[1], args[2], args[3], args[4], args[5]];
        } else if (type === 'translate') {
            nextMatrix = [1, 0, 0, 1, args[0] || 0, args[1] || 0];
        } else if (type === 'scale') {
            const scaleX = args[0] ?? 1;
            const scaleY = args[1] ?? scaleX;
            nextMatrix = [scaleX, 0, 0, scaleY, 0, 0];
        } else if (type === 'rotate') {
            const angle = ((args[0] || 0) * Math.PI) / 180;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const cx = args[1] || 0;
            const cy = args[2] || 0;
            nextMatrix = multiplyMatrices(
                multiplyMatrices([1, 0, 0, 1, cx, cy], [cos, sin, -sin, cos, 0, 0]),
                [1, 0, 0, 1, -cx, -cy],
            );
        } else if (type === 'skewX') {
            const angle = ((args[0] || 0) * Math.PI) / 180;
            nextMatrix = [1, 0, Math.tan(angle), 1, 0, 0];
        } else if (type === 'skewY') {
            const angle = ((args[0] || 0) * Math.PI) / 180;
            nextMatrix = [1, Math.tan(angle), 0, 1, 0, 0];
        }

        return multiplyMatrices(current, nextMatrix);
    }, identityMatrix());
}

function identityMatrix(): Matrix {
    return [1, 0, 0, 1, 0, 0];
}

function multiplyMatrices(left: Matrix, right: Matrix): Matrix {
    return [
        left[0] * right[0] + left[2] * right[1],
        left[1] * right[0] + left[3] * right[1],
        left[0] * right[2] + left[2] * right[3],
        left[1] * right[2] + left[3] * right[3],
        left[0] * right[4] + left[2] * right[5] + left[4],
        left[1] * right[4] + left[3] * right[5] + left[5],
    ];
}

function estimateMatrixScale(matrix: Matrix): number {
    const scaleX = Math.sqrt((matrix[0] * matrix[0]) + (matrix[1] * matrix[1]));
    const scaleY = Math.sqrt((matrix[2] * matrix[2]) + (matrix[3] * matrix[3]));
    return Math.max((scaleX + scaleY) / 2, 0.0001);
}

function parseNumber(value: string | null, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

async function renderOverlaysOnly(
    fabricCanvas: fabric.Canvas,
    docSpec: DocumentSpec,
    includeBleed: boolean
): Promise<string | null> {
    const objects = fabricCanvas.getObjects();
    const hiddenObjects: Array<{ obj: fabric.Object; wasVisible: boolean }> = [];

    try {
        for (const obj of objects) {
            const isBackground = (obj as any).__isDocumentBackground === true;
            const isGuide = (obj as any).__isGuide === true;
            const isPdfBackground = (obj as any).data?.kind === 'pdf_page_background';
            const isCutContour = (obj as any).__isCutContour === true;

            if (isBackground || isGuide || isPdfBackground || isCutContour) {
                hiddenObjects.push({
                    obj,
                    wasVisible: obj.visible !== false,
                });
                obj.visible = false;
            }
        }

        fabricCanvas.renderAll();

        const bleedPx = includeBleed ? (docSpec.bleed_mm || 0) * MM_TO_PX : 0;
        const cropLeft = PASTEBOARD_PADDING_PX + (includeBleed ? 0 : bleedPx);
        const cropTop = PASTEBOARD_PADDING_PX + (includeBleed ? 0 : bleedPx);
        const cropWidth = (docSpec.width_mm * MM_TO_PX) + (includeBleed ? bleedPx * 2 : 0);
        const cropHeight = (docSpec.height_mm * MM_TO_PX) + (includeBleed ? bleedPx * 2 : 0);

        const originalBg = fabricCanvas.backgroundColor;
        fabricCanvas.backgroundColor = 'transparent';
        fabricCanvas.renderAll();

        const multiplier = 300 / 96;
        const dataUrl = fabricCanvas.toDataURL({
            format: 'png',
            multiplier,
            left: cropLeft,
            top: cropTop,
            width: cropWidth,
            height: cropHeight,
        });

        fabricCanvas.backgroundColor = originalBg;

        return dataUrl;
    } finally {
        for (const { obj, wasVisible } of hiddenObjects) {
            obj.visible = wasVisible;
        }
        fabricCanvas.renderAll();
    }
}

async function fetchDataUrlAsBytes(dataUrl: string): Promise<Uint8Array> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}

function getExportFilename(designName: string | undefined, originalFileName?: string): string {
    if (designName && designName.trim() && designName !== 'Uden titel') {
        return `${sanitize(designName)}.pdf`;
    }
    if (originalFileName) {
        const base = originalFileName.replace(/\.pdf$/i, '');
        return `${sanitize(base)}_edited.pdf`;
    }
    return 'WebPrinter_PDF.pdf';
}

function sanitize(name: string): string {
    return name.replace(/[^a-z0-9æøåÆØÅ\s-]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}
