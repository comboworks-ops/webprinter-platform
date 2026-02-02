import { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, FileUp, ChevronLeft, ChevronRight, Check, Layers } from 'lucide-react';
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';
import { ptToMm } from '@/utils/unitConversions';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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

interface PDFImportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onImport: (data: PDFImportData) => void;
    onImportAsTemplate?: (data: PDFImportData) => void;
    allowedWidthMm: number;
    allowedHeightMm: number;
}

export function PDFImportModal({
    open,
    onOpenChange,
    onImport,
    onImportAsTemplate,
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
    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Store original PDF bytes for vector preservation
    const pdfBytesRef = useRef<ArrayBuffer | null>(null);


    // Render page preview
    const renderPage = useCallback(async (doc: pdfjsLib.PDFDocumentProxy, pageNum: number) => {
        try {
            const page = await doc.getPage(pageNum);
            const canvas = canvasRef.current;
            if (!canvas) return;

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

            await page.render({
                canvasContext: context,
                viewport: scaledViewport,
            }).promise;

            setPreviewUrl(canvas.toDataURL('image/png'));
        } catch (err) {
            console.error('Error rendering PDF page:', err);
            toast.error('Kunne ikke vise PDF-side');
        }
    }, []);

    // Load a PDF file (shared by input and drop handlers)
    const loadPdfFile = useCallback(async (file: File) => {
        // Check file type - support both MIME type and extension
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            toast.error('Kun PDF-filer understøttes');
            return;
        }

        setLoading(true);
        setFileName(file.name);

        try {
            const arrayBuffer = await file.arrayBuffer();
            // Store original bytes for vector preservation
            pdfBytesRef.current = arrayBuffer.slice(0); // Clone the buffer

            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            setPdfDoc(pdf);
            setTotalPages(pdf.numPages);
            setCurrentPage(1);

            await renderPage(pdf, 1);
        } catch (err) {
            console.error('Error loading PDF:', err);
            toast.error('Kunne ikke indlæse PDF-fil');
            pdfBytesRef.current = null;
        } finally {
            setLoading(false);
        }
    }, [renderPage]);

    // Check for pending PDF file from global drag-drop and cleanup on close
    useEffect(() => {
        if (open) {
            // Check if there's a pending PDF from global drop
            const pendingFile = (window as any).__pendingPdfFile as File | undefined;
            if (pendingFile) {
                delete (window as any).__pendingPdfFile;
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
        }
    }, [open, loadPdfFile]);

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
            renderPage(pdfDoc, newPage);
        }
    }, [currentPage, pdfDoc, renderPage]);

    const goToNextPage = useCallback(() => {
        if (currentPage < totalPages && pdfDoc) {
            const newPage = currentPage + 1;
            setCurrentPage(newPage);
            renderPage(pdfDoc, newPage);
        }
    }, [currentPage, totalPages, pdfDoc, renderPage]);

    // Import selected page - render at high quality and provide physical dimensions
    const handleImport = useCallback(async () => {
        if (!pdfDoc) return;

        setLoading(true);
        try {
            const page = await pdfDoc.getPage(currentPage);

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
                pageNumber: currentPage,
                totalPages,
                widthMm,
                heightMm,
                renderedWidth: offscreenCanvas.width,
                renderedHeight: offscreenCanvas.height,
                // Include original PDF for vector preservation
                originalPdfBytes: pdfBytesRef.current || undefined,
                originalFileName: fileName,
            });
            onOpenChange(false);
            toast.success(`Side ${currentPage} importeret (${Math.round(widthMm)}×${Math.round(heightMm)} mm)`);
        } catch (err) {
            console.error('Error importing PDF page:', err);
            toast.error('Kunne ikke importere PDF-side');
        } finally {
            setLoading(false);
        }
    }, [pdfDoc, currentPage, totalPages, fileName, onImport, onOpenChange]);

    // Import as template overlay (semi-transparent, non-printing)
    const handleImportAsTemplate = useCallback(async () => {
        if (!pdfDoc || !onImportAsTemplate) return;

        setLoading(true);
        try {
            const page = await pdfDoc.getPage(currentPage);
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
                pageNumber: currentPage,
                totalPages,
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
    }, [pdfDoc, currentPage, totalPages, fileName, onImportAsTemplate, onOpenChange]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
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

                        {/* Actions */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                    setPdfDoc(null);
                                    setPreviewUrl(null);
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
