import { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FileUp, ChevronLeft, ChevronRight, Check, Layers, RotateCcw, RotateCw, Crop, Type, PenLine, Palette } from 'lucide-react';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';
import { degrees, PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { mmToPt, ptToMm } from '@/utils/unitConversions';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

type PdfRotation = 0 | 90 | 180 | 270;
type PdfMarkColor = 'dark' | 'light' | 'accent';

interface PdfEditState {
    rotation: PdfRotation;
    cropToDocument: boolean;
    stampText: string;
    signatureText: string;
    markColor: PdfMarkColor;
}

const DEFAULT_EDIT_STATE: PdfEditState = {
    rotation: 0,
    cropToDocument: false,
    stampText: '',
    signatureText: '',
    markColor: 'dark',
};

const cloneArrayBuffer = (buffer: ArrayBuffer): ArrayBuffer =>
    buffer.slice(0);

const uint8ToArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

const hasPdfEdits = (editState: PdfEditState): boolean =>
    editState.rotation !== 0 ||
    editState.cropToDocument ||
    editState.stampText.trim().length > 0 ||
    editState.signatureText.trim().length > 0;

const normalizeRotation = (rotation: number): PdfRotation => {
    const normalized = ((rotation % 360) + 360) % 360;
    if (normalized === 90 || normalized === 180 || normalized === 270) return normalized;
    return 0;
};

const getPdfMarkColor = (markColor: PdfMarkColor): ReturnType<typeof rgb> => {
    if (markColor === 'light') return rgb(0.96, 0.98, 1);
    if (markColor === 'accent') return rgb(0.02, 0.36, 0.68);
    return rgb(0.06, 0.08, 0.12);
};

const sanitizePdfText = (text: string): string =>
    text
        .replace(/[^\u0020-\u007EÆØÅæøåÄÖÜäöüÉéÈèÁáÀàÓóÒòÍíÌìÑñ.,;:!?'"()&/@#%+\-_=]/g, '')
        .trim();

type PdfDrawablePage = {
    drawText: (text: string, options: Record<string, unknown>) => void;
};

type PdfFontLike = {
    widthOfTextAtSize: (text: string, size: number) => number;
};

const drawWrappedPdfText = (
    page: PdfDrawablePage,
    font: PdfFontLike,
    text: string,
    options: {
        x: number;
        y: number;
        maxWidth: number;
        size: number;
        lineHeight: number;
        color: ReturnType<typeof rgb>;
    },
) => {
    const cleanText = sanitizePdfText(text);
    if (!cleanText) return;

    const words = cleanText.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, options.size) <= options.maxWidth || currentLine.length === 0) {
            currentLine = candidate;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }

    if (currentLine) lines.push(currentLine);

    lines.slice(0, 5).forEach((line, index) => {
        page.drawText(line, {
            x: options.x,
            y: options.y - (index * options.lineHeight),
            size: options.size,
            font,
            color: options.color,
        });
    });
};

async function buildEditedSinglePagePdfBytes(
    sourceBytes: ArrayBuffer,
    sourcePageIndex: number,
    editState: PdfEditState,
    targetWidthMm: number,
    targetHeightMm: number,
): Promise<ArrayBuffer> {
    const sourcePdf = await PDFDocument.load(sourceBytes);
    const outputPdf = await PDFDocument.create();
    const [copiedPage] = await outputPdf.copyPages(sourcePdf, [sourcePageIndex]);
    outputPdf.addPage(copiedPage);

    let pageWidth = copiedPage.getSize().width;
    let pageHeight = copiedPage.getSize().height;

    if (editState.cropToDocument && targetWidthMm > 0 && targetHeightMm > 0) {
        const quarterTurn = editState.rotation === 90 || editState.rotation === 270;
        const targetRatio = quarterTurn
            ? mmToPt(targetHeightMm) / Math.max(mmToPt(targetWidthMm), 1)
            : mmToPt(targetWidthMm) / Math.max(mmToPt(targetHeightMm), 1);
        const currentRatio = pageWidth / Math.max(pageHeight, 1);

        let cropX = 0;
        let cropY = 0;
        let cropWidth = pageWidth;
        let cropHeight = pageHeight;

        if (Math.abs(currentRatio - targetRatio) > 0.01) {
            if (currentRatio > targetRatio) {
                cropWidth = pageHeight * targetRatio;
                cropX = (pageWidth - cropWidth) / 2;
            } else {
                cropHeight = pageWidth / targetRatio;
                cropY = (pageHeight - cropHeight) / 2;
            }

            copiedPage.translateContent(-cropX, -cropY);
            copiedPage.setMediaBox(0, 0, cropWidth, cropHeight);
            copiedPage.setCropBox(0, 0, cropWidth, cropHeight);
            copiedPage.setTrimBox(0, 0, cropWidth, cropHeight);
            copiedPage.setBleedBox(0, 0, cropWidth, cropHeight);
            pageWidth = cropWidth;
            pageHeight = cropHeight;
        }
    }

    const regularFont = await outputPdf.embedFont(StandardFonts.Helvetica);
    const boldFont = await outputPdf.embedFont(StandardFonts.HelveticaBold);
    const margin = Math.max(18, Math.min(pageWidth, pageHeight) * 0.045);
    const markColor = getPdfMarkColor(editState.markColor);

    if (editState.stampText.trim()) {
        const fontSize = Math.max(9, Math.min(18, Math.min(pageWidth, pageHeight) * 0.025));
        drawWrappedPdfText(copiedPage, boldFont, editState.stampText, {
            x: margin,
            y: Math.max(margin, pageHeight - margin - fontSize),
            maxWidth: Math.max(80, pageWidth - (margin * 2)),
            size: fontSize,
            lineHeight: fontSize * 1.25,
            color: markColor,
        });
    }

    if (editState.signatureText.trim()) {
        const signature = sanitizePdfText(editState.signatureText);
        if (signature) {
            const fontSize = Math.max(11, Math.min(24, Math.min(pageWidth, pageHeight) * 0.035));
            const textWidth = regularFont.widthOfTextAtSize(signature, fontSize);
            copiedPage.drawText(signature, {
                x: Math.max(margin, pageWidth - margin - textWidth),
                y: margin,
                size: fontSize,
                font: regularFont,
                color: markColor,
            });
        }
    }

    if (editState.rotation !== 0) {
        copiedPage.setRotation(degrees(editState.rotation));
    }

    const editedBytes = await outputPdf.save();
    return uint8ToArrayBuffer(editedBytes);
}

export interface PDFImportData {
    imageDataUrl: string;
    pageNumber: number;
    totalPages: number;
    // Physical dimensions of the PDF page in mm
    widthMm: number;
    heightMm: number;
    // Rendered raster dimensions in pixels
    renderedWidth: number;
    renderedHeight: number;
    // Original PDF data for vector preservation (optional)
    originalPdfBytes?: ArrayBuffer;
    originalPdfStoragePath?: string;
    originalFileName?: string;
}

export interface PDFImportInitialSource {
    bytes: ArrayBuffer;
    fileName?: string;
    pageNumber?: number;
}

interface PDFImportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (data: PDFImportData) => void;
    onImportAsTemplate?: (data: PDFImportData) => void;
    initialSource?: PDFImportInitialSource | null;
    allowedWidthMm: number;
    allowedHeightMm: number;
}

export function PDFImportModal({
    open,
    onOpenChange,
    onImport,
    onImportAsTemplate,
    initialSource,
    allowedWidthMm,
    allowedHeightMm
}: PDFImportModalProps) {
    const [loading, setLoading] = useState(false);
    const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState('');
    const [isDragActive, setIsDragActive] = useState(false);
    const [editState, setEditState] = useState<PdfEditState>(DEFAULT_EDIT_STATE);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const renderRequestRef = useRef(0);
    const activeRenderTaskRef = useRef<{ cancel: () => void } | null>(null);
    const initialSourceKeyRef = useRef<string | null>(null);
    // Store original PDF bytes for vector preservation
    const pdfBytesRef = useRef<ArrayBuffer | null>(null);


    // Render page preview
    const renderPage = useCallback(async (
        doc: pdfjsLib.PDFDocumentProxy,
        pageNum: number,
        sourceBytes?: ArrayBuffer,
        nextEditState: PdfEditState = editState,
    ) => {
        const requestId = renderRequestRef.current + 1;
        renderRequestRef.current = requestId;
        activeRenderTaskRef.current?.cancel();
        activeRenderTaskRef.current = null;
        try {
            const hasEdits = hasPdfEdits(nextEditState);
            const previewPdf = hasEdits && sourceBytes
                ? await pdfjsLib.getDocument({
                    data: await buildEditedSinglePagePdfBytes(
                        cloneArrayBuffer(sourceBytes),
                        pageNum - 1,
                        nextEditState,
                        allowedWidthMm,
                        allowedHeightMm,
                    ),
                }).promise
                : doc;
            const page = await previewPdf.getPage(hasEdits ? 1 : pageNum);
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) return;

            // Calculate scale to fit preview area (max 400x400)
            const viewport = page.getViewport({ scale: 1 });
            const previewMaxSize = 400;
            const scale = Math.min(
                previewMaxSize / viewport.width,
                previewMaxSize / viewport.height
            );
            const scaledViewport = page.getViewport({ scale });

            canvas.width = scaledViewport.width;
            canvas.height = scaledViewport.height;

            const renderTask = page.render({
                canvasContext: context,
                viewport: scaledViewport,
            });
            activeRenderTaskRef.current = renderTask;
            await renderTask.promise;
            if (activeRenderTaskRef.current === renderTask) {
                activeRenderTaskRef.current = null;
            }

            if (requestId !== renderRequestRef.current) return;
            setPreviewUrl(canvas.toDataURL('image/png'));
        } catch (err) {
            if ((err as { name?: string })?.name === 'RenderingCancelledException') return;
            console.error('Error rendering PDF page:', err);
            toast.error('Kunne ikke vise PDF-side');
        }
    }, [allowedHeightMm, allowedWidthMm, editState]);

    const loadPdfBytes = useCallback(async (
        sourceBytes: ArrayBuffer,
        nextFileName: string,
        initialPageNumber = 1,
    ) => {
        setLoading(true);
        setFileName(nextFileName);
        setEditState(DEFAULT_EDIT_STATE);

        try {
            const arrayBuffer = cloneArrayBuffer(sourceBytes);
            // Store original bytes for vector preservation
            pdfBytesRef.current = cloneArrayBuffer(arrayBuffer);

            const pdf = await pdfjsLib.getDocument({ data: cloneArrayBuffer(arrayBuffer) }).promise;
            const safePageNumber = Math.min(Math.max(1, initialPageNumber), pdf.numPages);

            setPdfDoc(pdf);
            setTotalPages(pdf.numPages);
            setCurrentPage(safePageNumber);

            await renderPage(pdf, safePageNumber, arrayBuffer, DEFAULT_EDIT_STATE);
        } catch (err) {
            console.error('Error loading PDF:', err);
            toast.error('Kunne ikke indlæse PDF-fil');
            pdfBytesRef.current = null;
        } finally {
            setLoading(false);
        }
    }, [renderPage]);

    // Load a PDF file (shared by input and drop handlers)
    const loadPdfFile = useCallback(async (file: File) => {
        // Check file type - support both MIME type and extension
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            toast.error('Kun PDF-filer understøttes');
            return;
        }

        const arrayBuffer = await file.arrayBuffer();
        await loadPdfBytes(arrayBuffer, file.name);
    }, [loadPdfBytes]);

    // Check for pending PDF file from global drag-drop and cleanup on close
    useEffect(() => {
        if (open) {
            if (initialSource?.bytes) {
                const initialPage = initialSource.pageNumber || 1;
                const sourceKey = `${initialSource.fileName || 'pdf'}:${initialSource.bytes.byteLength}:${initialPage}`;
                if (initialSourceKeyRef.current !== sourceKey) {
                    initialSourceKeyRef.current = sourceKey;
                    void loadPdfBytes(initialSource.bytes, initialSource.fileName || 'Importeret PDF', initialPage);
                }
                return;
            }

            // Check if there's a pending PDF from global drop
            const pendingPdfWindow = window as Window & { __pendingPdfFile?: File };
            const pendingFile = pendingPdfWindow.__pendingPdfFile;
            if (pendingFile) {
                delete pendingPdfWindow.__pendingPdfFile;
                // Load the dropped PDF
                loadPdfFile(pendingFile);
            }
        } else {
            // Cleanup on close
            setPdfDoc(null);
            setCurrentPage(1);
            setTotalPages(0);
            setPreviewUrl(null);
            setFileName('');
            setIsDragActive(false);
            setEditState(DEFAULT_EDIT_STATE);
            activeRenderTaskRef.current?.cancel();
            activeRenderTaskRef.current = null;
            initialSourceKeyRef.current = null;
            pdfBytesRef.current = null;
        }
    }, [initialSource, loadPdfBytes, loadPdfFile, open]);

    // Handle file selection from input
    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            await loadPdfFile(file);
        }
    }, [loadPdfFile]);

    // Drag and drop handlers
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(true);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set inactive if leaving the drop zone entirely
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragActive(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragActive(false);

        const files = Array.from(e.dataTransfer.files);
        const pdfFile = files.find(f =>
            f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
        );

        if (pdfFile) {
            await loadPdfFile(pdfFile);
        } else if (files.length > 0) {
            toast.error('Kun PDF-filer understøttes');
        }
    }, [loadPdfFile]);

    // Navigate pages
    const goToPrevPage = useCallback(() => {
        if (currentPage > 1 && pdfDoc) {
            const newPage = currentPage - 1;
            setCurrentPage(newPage);
            renderPage(pdfDoc, newPage, pdfBytesRef.current || undefined);
        }
    }, [currentPage, pdfDoc, renderPage]);

    const goToNextPage = useCallback(() => {
        if (currentPage < totalPages && pdfDoc) {
            const newPage = currentPage + 1;
            setCurrentPage(newPage);
            renderPage(pdfDoc, newPage, pdfBytesRef.current || undefined);
        }
    }, [currentPage, totalPages, pdfDoc, renderPage]);

    const updateEditState = useCallback((updater: (current: PdfEditState) => PdfEditState) => {
        setEditState((current) => {
            const next = updater(current);
            if (pdfDoc) {
                void renderPage(pdfDoc, currentPage, pdfBytesRef.current || undefined, next);
            }
            return next;
        });
    }, [currentPage, pdfDoc, renderPage]);

    const resetEditState = useCallback(() => {
        updateEditState(() => DEFAULT_EDIT_STATE);
    }, [updateEditState]);

    const getRenderablePdfSource = useCallback(async () => {
        if (!pdfBytesRef.current) {
            return {
                bytes: undefined,
                pageNumber: currentPage,
                totalPages,
                edited: false,
            };
        }

        if (!hasPdfEdits(editState)) {
            return {
                bytes: cloneArrayBuffer(pdfBytesRef.current),
                pageNumber: currentPage,
                totalPages,
                edited: false,
            };
        }

        const editedBytes = await buildEditedSinglePagePdfBytes(
            cloneArrayBuffer(pdfBytesRef.current),
            currentPage - 1,
            editState,
            allowedWidthMm,
            allowedHeightMm,
        );

        return {
            bytes: editedBytes,
            pageNumber: 1,
            totalPages: 1,
            edited: true,
        };
    }, [allowedHeightMm, allowedWidthMm, currentPage, editState, totalPages]);

    // Import selected page - render at high quality and provide physical dimensions
    const handleImport = useCallback(async () => {
        if (!pdfDoc) return;

        setLoading(true);
        try {
            const pdfSource = await getRenderablePdfSource();
            if (!pdfSource.bytes) throw new Error('Missing PDF source bytes');

            const renderPdf = await pdfjsLib.getDocument({ data: cloneArrayBuffer(pdfSource.bytes) }).promise;
            const page = await renderPdf.getPage(pdfSource.pageNumber);

            // Get page dimensions at scale=1 (which gives us points)
            // PDF uses 72 points per inch
            const viewport = page.getViewport({ scale: 1 });

            // Convert PDF points to millimeters for physical dimensions
            const widthMm = ptToMm(viewport.width);
            const heightMm = ptToMm(viewport.height);

            // Render at 3x scale for high quality raster
            // This gives us a high-res image that can be scaled down in Fabric
            const RENDER_SCALE = 3;
            const scaledViewport = page.getViewport({ scale: RENDER_SCALE });

            // Create offscreen canvas
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = Math.round(scaledViewport.width);
            offscreenCanvas.height = Math.round(scaledViewport.height);

            const context = offscreenCanvas.getContext('2d');
            if (!context) throw new Error('Could not get canvas context');

            // White background
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

            await page.render({
                canvasContext: context,
                viewport: scaledViewport,
            }).promise;

            const imageDataUrl = offscreenCanvas.toDataURL('image/png', 1.0);

            // Pass physical dimensions and original PDF bytes for vector preservation
            onImport({
                imageDataUrl,
                pageNumber: pdfSource.pageNumber,
                totalPages: pdfSource.totalPages,
                widthMm,
                heightMm,
                renderedWidth: offscreenCanvas.width,
                renderedHeight: offscreenCanvas.height,
                // Include original PDF for vector preservation
                originalPdfBytes: pdfSource.bytes,
                originalFileName: fileName,
            });
            onOpenChange(false);
            toast.success(`${pdfSource.edited ? 'Redigeret PDF' : `Side ${currentPage}`} importeret (${Math.round(widthMm)}×${Math.round(heightMm)} mm)`);
        } catch (err) {
            console.error('Error importing PDF page:', err);
            toast.error('Kunne ikke importere PDF-side');
        } finally {
            setLoading(false);
        }
    }, [pdfDoc, getRenderablePdfSource, currentPage, fileName, onImport, onOpenChange]);

    // Import as template overlay (semi-transparent, non-printing)
    const handleImportAsTemplate = useCallback(async () => {
        if (!pdfDoc || !onImportAsTemplate) return;

        setLoading(true);
        try {
            const pdfSource = await getRenderablePdfSource();
            if (!pdfSource.bytes) throw new Error('Missing PDF source bytes');

            const renderPdf = await pdfjsLib.getDocument({ data: cloneArrayBuffer(pdfSource.bytes) }).promise;
            const page = await renderPdf.getPage(pdfSource.pageNumber);
            const viewport = page.getViewport({ scale: 1 });
            const widthMm = ptToMm(viewport.width);
            const heightMm = ptToMm(viewport.height);

            // Render at 3x scale for quality
            const RENDER_SCALE = 3;
            const scaledViewport = page.getViewport({ scale: RENDER_SCALE });

            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = Math.round(scaledViewport.width);
            offscreenCanvas.height = Math.round(scaledViewport.height);

            const context = offscreenCanvas.getContext('2d');
            if (!context) throw new Error('Could not get canvas context');

            // Transparent background for template
            context.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

            await page.render({
                canvasContext: context,
                viewport: scaledViewport,
            }).promise;

            const imageDataUrl = offscreenCanvas.toDataURL('image/png', 1.0);

            onImportAsTemplate({
                imageDataUrl,
                pageNumber: pdfSource.pageNumber,
                totalPages: pdfSource.totalPages,
                widthMm,
                heightMm,
                renderedWidth: offscreenCanvas.width,
                renderedHeight: offscreenCanvas.height,
                originalFileName: fileName,
            });
            onOpenChange(false);
            toast.success(`Skabelon importeret (${Math.round(widthMm)}×${Math.round(heightMm)} mm)`);
        } catch (err) {
            console.error('Error importing PDF as template:', err);
            toast.error('Kunne ikke importere skabelon');
        } finally {
            setLoading(false);
        }
    }, [pdfDoc, getRenderablePdfSource, fileName, onImportAsTemplate, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Importer PDF</DialogTitle>
                    <DialogDescription>
                        Vælg en PDF-fil og den side du vil importere som billede
                    </DialogDescription>
                </DialogHeader>

                {/* Hidden canvas for rendering */}
                <canvas ref={canvasRef} className="hidden" />

                {/* File upload area */}
                {!pdfDoc && (
                    <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
                            ${isDragActive
                                ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2'
                                : 'hover:bg-muted/50 hover:border-muted-foreground/50'
                            }`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf,.pdf"
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                        {loading ? (
                            <Loader2 className="h-12 w-12 mx-auto animate-spin text-muted-foreground" />
                        ) : (
                            <>
                                <FileUp className={`h-12 w-12 mx-auto mb-4 transition-colors ${isDragActive ? 'text-primary' : 'text-muted-foreground'}`} />
                                <p className="font-medium">
                                    {isDragActive ? 'Slip filen her' : 'Klik for at vælge PDF'}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">eller træk filen hertil</p>
                            </>
                        )}
                    </div>
                )}

                {/* PDF Preview */}
                {pdfDoc && (
                    <div className="space-y-4">
                        {/* File info */}
                        <div className="text-sm text-muted-foreground truncate">
                            {fileName}
                        </div>

                        {/* Preview */}
                        <div className="flex justify-center bg-muted/30 rounded-lg p-4">
                            {previewUrl ? (
                                <img
                                    src={previewUrl}
                                    alt={`Side ${currentPage}`}
                                    className="max-h-80 shadow-lg rounded"
                                />
                            ) : (
                                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                            )}
                        </div>

                        {/* Page navigation */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={goToPrevPage}
                                    disabled={currentPage <= 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm font-medium">
                                    Side {currentPage} af {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={goToNextPage}
                                    disabled={currentPage >= totalPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        <Separator />

                        {/* PDF edit tools */}
                        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-medium">PDF-værktøjer</p>
                                    <p className="text-xs text-muted-foreground">
                                        Bevarer vektorindhold hvor muligt
                                    </p>
                                </div>
                                {hasPdfEdits(editState) && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={resetEditState}
                                        disabled={loading}
                                    >
                                        Nulstil
                                    </Button>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => updateEditState((current) => ({
                                        ...current,
                                        rotation: normalizeRotation(current.rotation - 90),
                                    }))}
                                    disabled={loading}
                                    title="Roter siden mod venstre"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                    Venstre
                                </Button>
                                <Button
                                    type="button"
                                    variant={editState.cropToDocument ? 'default' : 'outline'}
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => updateEditState((current) => ({
                                        ...current,
                                        cropToDocument: !current.cropToDocument,
                                    }))}
                                    disabled={loading}
                                    title="Beskær PDF-siden til dokumentets formatforhold"
                                >
                                    <Crop className="h-4 w-4" />
                                    Beskær
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="gap-2"
                                    onClick={() => updateEditState((current) => ({
                                        ...current,
                                        rotation: normalizeRotation(current.rotation + 90),
                                    }))}
                                    disabled={loading}
                                    title="Roter siden mod højre"
                                >
                                    <RotateCw className="h-4 w-4" />
                                    Højre
                                </Button>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="pdf-stamp-text" className="flex items-center gap-1.5 text-xs">
                                        <Type className="h-3.5 w-3.5" />
                                        Stempeltekst
                                    </Label>
                                    <Textarea
                                        id="pdf-stamp-text"
                                        value={editState.stampText}
                                        onChange={(event) => updateEditState((current) => ({
                                            ...current,
                                            stampText: event.target.value,
                                        }))}
                                        placeholder="Fx Godkendt korrektur"
                                        className="min-h-16 resize-none text-xs"
                                        disabled={loading}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="pdf-signature-text" className="flex items-center gap-1.5 text-xs">
                                        <PenLine className="h-3.5 w-3.5" />
                                        Signatur
                                    </Label>
                                    <Input
                                        id="pdf-signature-text"
                                        value={editState.signatureText}
                                        onChange={(event) => updateEditState((current) => ({
                                            ...current,
                                            signatureText: event.target.value,
                                        }))}
                                        placeholder="Navn / initialer"
                                        className="h-9 text-xs"
                                        disabled={loading}
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                        Placering: nederst til højre
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="flex items-center gap-1.5 text-xs">
                                    <Palette className="h-3.5 w-3.5" />
                                    Tekstfarve
                                </Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {([
                                        { value: 'dark', label: 'Mørk' },
                                        { value: 'light', label: 'Lys' },
                                        { value: 'accent', label: 'Blå' },
                                    ] as Array<{ value: PdfMarkColor; label: string }>).map((option) => (
                                        <Button
                                            key={option.value}
                                            type="button"
                                            variant={editState.markColor === option.value ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => updateEditState((current) => ({
                                                ...current,
                                                markColor: option.value,
                                            }))}
                                            disabled={loading}
                                        >
                                            {option.label}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                <span>Rotation: {editState.rotation}°</span>
                                {editState.cropToDocument && <span>Beskæring: {Math.round(allowedWidthMm)}×{Math.round(allowedHeightMm)} mm</span>}
                                {hasPdfEdits(editState) && <span>Import gemmes som redigeret enkeltside-PDF</span>}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                    setPdfDoc(null);
                                    setPreviewUrl(null);
                                    pdfBytesRef.current = null;
                                    if (fileInputRef.current) {
                                        fileInputRef.current.value = '';
                                    }
                                }}
                            >
                                Vælg anden fil
                            </Button>
                            <Button
                                className="flex-1 gap-2"
                                onClick={handleImport}
                                disabled={loading}
                            >
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="h-4 w-4" />
                                )}
                                Importer side {currentPage}
                            </Button>
                            {onImportAsTemplate && (
                                <Button
                                    variant="outline"
                                    className="flex-1 gap-2"
                                    onClick={handleImportAsTemplate}
                                    disabled={loading}
                                    title="Importér som semi-transparent skabelon/guide"
                                >
                                    {loading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Layers className="h-4 w-4" />
                                    )}
                                    Som skabelon
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default PDFImportModal;
