import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
    BadgeCheck,
    ChevronLeft,
    ChevronRight,
    Crop,
    Download,
    Edit3,
    FileCheck,
    FilePlus2,
    Move,
    Scissors,
} from "lucide-react";

export interface SelectedPdfMeta {
    originalFileName?: string;
    pageIndex: number;
    totalPages?: number;
    pdfWidthMm?: number;
    pdfHeightMm?: number;
    renderWidthPx?: number;
    renderHeightPx?: number;
    vectorReady: boolean;
}

interface PdfToolsPanelProps {
    pdfMeta: SelectedPdfMeta | null;
    preflightIssueCount?: number;
    allowCutContour?: boolean;
    onFitToDocument: () => void;
    onCenterOnDocument: () => void;
    onImportNewPdf: () => void;
    onEditPdf: () => void;
    onChangePage: (direction: -1 | 1) => void;
    onExtractCutContour: () => void;
    onOpenExport: () => void;
    onOpenPreflight: () => void;
}

const formatMm = (value?: number) =>
    typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)} mm` : "-";

export function PdfToolsPanel({
    pdfMeta,
    preflightIssueCount = 0,
    allowCutContour = false,
    onFitToDocument,
    onCenterOnDocument,
    onImportNewPdf,
    onEditPdf,
    onChangePage,
    onExtractCutContour,
    onOpenExport,
    onOpenPreflight,
}: PdfToolsPanelProps) {
    if (!pdfMeta) {
        return (
            <div className="p-4 text-center text-sm text-muted-foreground">
                Vælg en importeret PDF.
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4">
            <div className="space-y-1">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <FileCheck className="h-4 w-4" />
                    PDF til tryk
                </h3>
                <p className="truncate text-xs text-muted-foreground" title={pdfMeta.originalFileName}>
                    {pdfMeta.originalFileName || "Importeret PDF"}
                </p>
            </div>

            <div className="rounded-md border bg-muted/20 p-3 text-xs">
                <div className={pdfMeta.vectorReady ? "flex items-center gap-2 text-green-700" : "flex items-center gap-2 text-amber-700"}>
                    <BadgeCheck className="h-4 w-4" />
                    <span className="font-medium">
                        {pdfMeta.vectorReady ? "Original PDF bevares som vektor" : "Original PDF-kilde mangler"}
                    </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-muted-foreground">
                    <span>Side</span>
                    <span className="text-right text-foreground">
                        {pdfMeta.pageIndex + 1}{pdfMeta.totalPages ? ` af ${pdfMeta.totalPages}` : ""}
                    </span>
                    <span>PDF-format</span>
                    <span className="text-right text-foreground">
                        {formatMm(pdfMeta.pdfWidthMm)} x {formatMm(pdfMeta.pdfHeightMm)}
                    </span>
                    <span>Output</span>
                    <span className="text-right text-foreground">PDF</span>
                </div>
            </div>

            {Boolean(pdfMeta.totalPages && pdfMeta.totalPages > 1) && (
                <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => onChangePage(-1)}
                        disabled={pdfMeta.pageIndex <= 0}
                        title="Forrige PDF-side"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="text-center text-xs text-muted-foreground">
                        Side <span className="font-medium text-foreground">{pdfMeta.pageIndex + 1}</span> af {pdfMeta.totalPages}
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => onChangePage(1)}
                        disabled={pdfMeta.pageIndex >= (pdfMeta.totalPages || 1) - 1}
                        title="Næste PDF-side"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}

            <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onCenterOnDocument}>
                    <Move className="h-4 w-4" />
                    Centrer
                </Button>
                <Button type="button" variant="outline" size="sm" className="gap-2" onClick={onFitToDocument}>
                    <Crop className="h-4 w-4" />
                    Tilpas format
                </Button>
            </div>

            <Separator />

            <div className="space-y-2">
                <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2" onClick={onEditPdf}>
                    <Edit3 className="h-4 w-4" />
                    Rediger PDF-side
                </Button>
                <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2" onClick={onImportNewPdf}>
                    <FilePlus2 className="h-4 w-4" />
                    Erstat med anden PDF
                </Button>
                <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2" onClick={onOpenPreflight}>
                    <FileCheck className="h-4 w-4" />
                    Preflight{preflightIssueCount > 0 ? ` (${preflightIssueCount})` : ""}
                </Button>
            </div>

            {allowCutContour && (
                <div className="space-y-2 rounded-md border border-fuchsia-300 bg-fuchsia-50/60 p-3">
                    <p className="text-xs font-medium text-fuchsia-950">Konturskæring</p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-start gap-2 border-fuchsia-300"
                        onClick={onExtractCutContour}
                    >
                        <Scissors className="h-4 w-4 text-fuchsia-700" />
                        Tilføj CutContour-spotfarve
                    </Button>
                    <p className="text-[11px] leading-4 text-fuchsia-900">
                        Eksporteres som spotfarven CutContour med 100 % magenta og overprint.
                    </p>
                </div>
            )}

            <Button type="button" size="sm" className="w-full justify-start gap-2" onClick={onOpenExport}>
                <Download className="h-4 w-4" />
                Eksporter som vektor PDF
            </Button>

            <div className="rounded-md border bg-muted/10 p-3 text-[11px] leading-4 text-muted-foreground">
                <div className="flex items-center justify-between gap-2">
                    <span>PDF-base</span>
                    <span className={pdfMeta.vectorReady ? "text-green-700" : "text-amber-700"}>
                        {pdfMeta.vectorReady ? "vektor" : "mangler"}
                    </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                    <span>Tilføjede elementer</span>
                    <span className="text-foreground">overlay</span>
                </div>
            </div>
        </div>
    );
}

export default PdfToolsPanel;
