import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
    Archive,
    BadgeCheck,
    ChevronLeft,
    ChevronRight,
    Crop,
    Download,
    Edit3,
    Eraser,
    FileCheck,
    FileCog,
    FilePlus2,
    Loader2,
    Move,
    ScanText,
    ServerCog,
    Scissors,
} from "lucide-react";
import type {
    DesignerPdfServiceOperation,
    DesignerPdfServiceOptions,
    DesignerPdfServiceReport,
} from "@/lib/designer/pdfService";

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
    pdfServiceReport?: DesignerPdfServiceReport | null;
    pdfServiceRunning?: boolean;
    preflightIssueCount?: number;
    onFitToDocument: () => void;
    onCenterOnDocument: () => void;
    onImportNewPdf: () => void;
    onEditPdf: () => void;
    onChangePage: (direction: -1 | 1) => void;
    onRunPdfServiceScan: () => void;
    onRunPdfServiceOperation: (operation: DesignerPdfServiceOperation, options?: DesignerPdfServiceOptions) => void;
    onApplyPdfServiceOutput: () => void;
    onDownloadPdfServiceOutput: () => void;
    onExtractCutContour: () => void;
    onOpenExport: () => void;
    onOpenPreflight: () => void;
}

const formatMm = (value?: number) =>
    typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)} mm` : "-";

export function PdfToolsPanel({
    pdfMeta,
    pdfServiceReport,
    pdfServiceRunning = false,
    preflightIssueCount = 0,
    onFitToDocument,
    onCenterOnDocument,
    onImportNewPdf,
    onEditPdf,
    onChangePage,
    onRunPdfServiceScan,
    onRunPdfServiceOperation,
    onApplyPdfServiceOutput,
    onDownloadPdfServiceOutput,
    onExtractCutContour,
    onOpenExport,
    onOpenPreflight,
}: PdfToolsPanelProps) {
    const [redactTerms, setRedactTerms] = useState("");

    if (!pdfMeta) {
        return (
            <div className="p-4 text-center text-sm text-muted-foreground">
                Vælg en importeret PDF for at se PDF-værktøjer.
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4">
            <div className="space-y-1">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <FileCheck className="h-4 w-4" />
                    PDF-værktøjer
                </h3>
                <p className="truncate text-xs text-muted-foreground" title={pdfMeta.originalFileName}>
                    {pdfMeta.originalFileName || "Importeret PDF"}
                </p>
            </div>

            <div className="rounded-md border bg-muted/20 p-3 text-xs">
                <div className="flex items-center gap-2 text-green-700">
                    <BadgeCheck className="h-4 w-4" />
                    <span className="font-medium">
                        {pdfMeta.vectorReady ? "Klar til vektor PDF" : "Mangler PDF-kilde"}
                    </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-muted-foreground">
                    <span>Side</span>
                    <span className="text-right text-foreground">
                        {pdfMeta.pageIndex + 1}{pdfMeta.totalPages ? ` af ${pdfMeta.totalPages}` : ""}
                    </span>
                    <span>Format</span>
                    <span className="text-right text-foreground">
                        {formatMm(pdfMeta.pdfWidthMm)} x {formatMm(pdfMeta.pdfHeightMm)}
                    </span>
                    <span>Preview</span>
                    <span className="text-right text-foreground">
                        {pdfMeta.renderWidthPx && pdfMeta.renderHeightPx
                            ? `${Math.round(pdfMeta.renderWidthPx)} x ${Math.round(pdfMeta.renderHeightPx)} px`
                            : "-"}
                    </span>
                </div>
            </div>

            {pdfMeta.totalPages && pdfMeta.totalPages > 1 && (
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
                        disabled={pdfMeta.pageIndex >= pdfMeta.totalPages - 1}
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
                    Tilpas
                </Button>
            </div>

            <Separator />

            <div className="space-y-2 rounded-md border bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="flex items-center gap-2 text-sm font-medium">
                            <ServerCog className="h-4 w-4" />
                            PDF-service
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                            Browser nu, edge-service klar til tunge PDF-job.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={onRunPdfServiceScan}
                        disabled={pdfServiceRunning}
                    >
                        {pdfServiceRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ServerCog className="h-4 w-4" />}
                        Scan
                    </Button>
                </div>
                {pdfServiceReport ? (
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>Status</span>
                        <span className="text-right text-foreground">
                            {pdfServiceReport.status === "ok" ? "OK" : pdfServiceReport.status === "warning" ? "Advarsel" : "Fejl"}
                        </span>
                        <span>Runtime</span>
                        <span className="text-right text-foreground">{pdfServiceReport.runtime}</span>
                        <span>Sider</span>
                        <span className="text-right text-foreground">{pdfServiceReport.pageCount ?? "-"}</span>
                        <span>Filstørrelse</span>
                        <span className="text-right text-foreground">
                            {pdfServiceReport.byteLength ? `${Math.round(pdfServiceReport.byteLength / 1024)} KB` : "-"}
                        </span>
                    </div>
                ) : (
                    <p className="text-xs text-muted-foreground">
                        Kør scan for at registrere PDF-metadata i produktflowet.
                    </p>
                )}
                {pdfServiceReport?.warnings?.[0] && (
                    <p className="rounded-sm bg-amber-50 px-2 py-1 text-[11px] leading-4 text-amber-800">
                        {pdfServiceReport.warnings[0]}
                    </p>
                )}
                {pdfServiceReport?.errors?.[0] && (
                    <p className="rounded-sm bg-red-50 px-2 py-1 text-[11px] leading-4 text-red-700">
                        {pdfServiceReport.errors[0]}
                    </p>
                )}
            </div>

            <div className="space-y-3">
                <div>
                    <p className="text-sm font-medium">Klargør PDF</p>
                    <p className="text-[11px] leading-4 text-muted-foreground">
                        Originalen ændres ikke. Hvert resultat gemmes som en ny, privat fil.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto min-h-10 justify-start gap-2 whitespace-normal py-2 text-left"
                        disabled={pdfServiceRunning}
                        onClick={() => onRunPdfServiceOperation("flatten-forms")}
                        title="Lås formularfelter uden at rasterisere siden"
                    >
                        <FileCheck className="h-4 w-4 shrink-0" />
                        Lås formularer
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto min-h-10 justify-start gap-2 whitespace-normal py-2 text-left"
                        disabled={pdfServiceRunning}
                        onClick={() => onRunPdfServiceOperation("repair")}
                        title="Reparer en beskadiget eller inkompatibel PDF"
                    >
                        <FileCog className="h-4 w-4 shrink-0" />
                        Reparer
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto min-h-10 justify-start gap-2 whitespace-normal py-2 text-left"
                        disabled={pdfServiceRunning}
                        onClick={() => onRunPdfServiceOperation("compress", { compressionLevel: 2 })}
                        title="Forsigtig komprimering med farver bevaret"
                    >
                        <Archive className="h-4 w-4 shrink-0" />
                        Komprimer
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto min-h-10 justify-start gap-2 whitespace-normal py-2 text-left"
                        disabled={pdfServiceRunning}
                        onClick={() => onRunPdfServiceOperation("ocr", { languages: ["dan", "eng"], ocrType: "skip-text" })}
                        title="Gør scannet dansk og engelsk tekst søgbar"
                    >
                        <ScanText className="h-4 w-4 shrink-0" />
                        OCR
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto min-h-10 justify-start gap-2 whitespace-normal py-2 text-left"
                        disabled={pdfServiceRunning}
                        onClick={() => onRunPdfServiceOperation("pdfa", { pdfaFormat: "pdfa-2b" })}
                        title="Opret PDF/A-2b til arkivering; dette er ikke PDF/X"
                    >
                        <Archive className="h-4 w-4 shrink-0" />
                        PDF/A-2b
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-auto min-h-10 justify-start gap-2 whitespace-normal py-2 text-left"
                        disabled={pdfServiceRunning || pdfServiceReport?.capabilities?.textEdit !== "alpha-enabled"}
                        onClick={() => onRunPdfServiceOperation("text-edit-export", { textEditorLightweight: true })}
                        title="Licenskrævende pilot: udtræk redigerbar tekststruktur"
                    >
                        <Edit3 className="h-4 w-4 shrink-0" />
                        Tekstpilot
                    </Button>
                </div>

                <div className="space-y-2 border-t pt-3">
                    <label className="text-xs font-medium" htmlFor="pdf-redact-terms">
                        Permanent fjernelse
                    </label>
                    <Textarea
                        id="pdf-redact-terms"
                        value={redactTerms}
                        onChange={(event) => setRedactTerms(event.target.value)}
                        placeholder="Ét ord eller udtryk pr. linje"
                        className="min-h-16 resize-y text-xs"
                        disabled={pdfServiceRunning}
                    />
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="w-full gap-2"
                        disabled={pdfServiceRunning || !redactTerms.trim()}
                        onClick={() => onRunPdfServiceOperation("redact", {
                            redactTerms: redactTerms.split("\n").map((term) => term.trim()).filter(Boolean),
                            redactWholeWords: true,
                        })}
                        title="Fjerner teksten permanent ved at rasterisere PDF'en"
                    >
                        <Eraser className="h-4 w-4" />
                        Fjern og rasteriser
                    </Button>
                    <p className="text-[11px] leading-4 text-muted-foreground">
                        Denne handling bevarer originalen, men resultatet mister vektorindhold.
                    </p>
                </div>
            </div>

            {pdfServiceReport?.output && (
                <div className="space-y-2 border-t pt-3">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-sm font-medium">Behandlet resultat</p>
                            <p className="truncate text-[11px] text-muted-foreground" title={pdfServiceReport.output.fileName}>
                                {pdfServiceReport.output.fileName}
                            </p>
                        </div>
                        <span className={pdfServiceReport.output.rasterizes ? "text-xs text-amber-700" : "text-xs text-green-700"}>
                            {pdfServiceReport.output.rasterizes ? "raster" : "vektor"}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {pdfServiceReport.output.contentType === "application/pdf" && (
                            <Button type="button" size="sm" onClick={onApplyPdfServiceOutput} disabled={pdfServiceRunning}>
                                Brug i design
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className={pdfServiceReport.output.contentType === "application/pdf" ? "" : "col-span-2"}
                            onClick={onDownloadPdfServiceOutput}
                            disabled={pdfServiceRunning}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Hent
                        </Button>
                    </div>
                </div>
            )}

            <div className="space-y-2 rounded-md border bg-muted/10 p-3 text-xs">
                <p className="font-medium text-foreground">Designprodukt-flow</p>
                <div className="space-y-1.5 text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                        <span>1. PDF-kilde</span>
                        <span className={pdfMeta.vectorReady ? "text-green-700" : "text-amber-700"}>
                            {pdfMeta.vectorReady ? "klar" : "mangler"}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span>2. Service-scan</span>
                        <span className={pdfServiceReport ? "text-green-700" : "text-amber-700"}>
                            {pdfServiceReport ? "registreret" : "afventer"}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span>3. Preflight</span>
                        <button type="button" className="text-right text-primary hover:underline" onClick={onOpenPreflight}>
                            {preflightIssueCount > 0 ? `${preflightIssueCount} punkter` : "åbn"}
                        </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span>4. Vektor eksport</span>
                        <button type="button" className="text-right text-primary hover:underline" onClick={onOpenExport}>
                            klar
                        </button>
                    </div>
                </div>
            </div>

            <Separator />

            <div className="space-y-2">
                <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2" onClick={onEditPdf}>
                    <Edit3 className="h-4 w-4" />
                    Rediger valgt PDF
                </Button>
                <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2" onClick={onExtractCutContour}>
                    <Scissors className="h-4 w-4" />
                    Find/opret CutContour
                </Button>
                <Button type="button" variant="outline" size="sm" className="w-full justify-start gap-2" onClick={onImportNewPdf}>
                    <FilePlus2 className="h-4 w-4" />
                    Importer ny PDF
                </Button>
                <Button type="button" size="sm" className="w-full justify-start gap-2" onClick={onOpenExport}>
                    <Download className="h-4 w-4" />
                    Eksporter som vektor PDF
                </Button>
            </div>

            <p className="text-[11px] leading-4 text-muted-foreground">
                PDF-basen bevares som original vektor i eksporten. Canvas-previewet er kun en arbejdsvisning.
            </p>
        </div>
    );
}

export default PdfToolsPanel;
