import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

import Footer from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import {
    OUTPUT_PROFILES,
    SRGB_PROFILE_URL
} from "@/lib/color/iccProofing";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import EditorCanvas, { EditorCanvasRef, LayerInfo, SelectedObjectProps } from "@/components/designer/EditorCanvas";
import { fabric } from 'fabric';
import LayerPanel from "@/components/designer/LayerPanel";
import PropertiesPanel from "@/components/designer/PropertiesPanel";
import PreflightPanel from "@/components/designer/PreflightPanel";
import ColorProofingPanel from "@/components/designer/ColorProofingPanel";
import PDFImportModal, { PDFImportData, PDFImportInitialSource } from "@/components/designer/PDFImportModal";
import PdfToolsPanel, { SelectedPdfMeta } from "@/components/designer/PdfToolsPanel";
import { DesignLibraryDrawer } from "@/components/designer/DesignLibraryDrawer";
import { ExportDialog } from "@/components/designer/ExportDialog";
import { runDesignerExport } from "@/lib/designer/export/exportActions";
import { withHiddenGuides } from "@/lib/designer/export/hideExportGuides";
import { withCanonicalExportViewport } from "@/lib/designer/export/withCanonicalExportViewport";
import { buildVectorPdfBackgroundPdf, detectPdfBackground, hasOverlayObjects } from "@/lib/designer/export/exportVectorPdfBackground";
import type { ExportOptions } from "@/lib/designer/export/types";
import { mmToPx } from "@/utils/unitConversions";
import { runPreflightChecks, PreflightWarning } from "@/utils/preflightChecks";
import { useColorProofing } from "@/hooks/useColorProofing";
import { useProductColorProfile } from "@/hooks/useProductColorProfile";
import { getImageDpi } from "@/utils/imageMetadata";
import { markSiteCheckoutDesignReady, readSiteCheckoutSession, writeSiteCheckoutSession } from "@/lib/checkout/siteCheckoutSession";
import {
    downloadDesignerPdfServiceOutput,
    runDesignerPdfService,
    type DesignerPdfServiceOperation,
    type DesignerPdfServiceOptions,
    type DesignerPdfServiceReport,
} from "@/lib/designer/pdfService";
import { ptToMm } from "@/utils/unitConversions";
import { cn } from "@/lib/utils";
import {
    APPAREL_COLOR_OPTIONS,
    apparelSideLabel,
    buildApparelDesignerConfig,
    getApparelColorHex,
    getApparelColorOption,
    normalizeApparelSide,
    type ApparelDesignerConfig,
    type ApparelPrintSide,
} from "@/lib/designer/apparelDesigner";
import {
    Loader2,
    ArrowLeft,
    Save,
    Download,
    AlertTriangle,
    Type,
    Image as ImageIcon,
    Square,
    Circle,
    Minus,
    Undo2,
    Redo2,
    MousePointer2,
    FileUp,
    Settings2,
    Trash2,
    Upload,
    FileCheck,
    ShoppingCart,
    Palette,
    Copy,
    LayoutGrid,
    Ruler,
    GripHorizontal,
    GripVertical,
    ZoomIn,
    ZoomOut,
    Hand,
    Maximize,
    Scissors,
    FileText,
    Layers3,
    PanelRightClose,
    Smartphone,
    Monitor,
    Tablet,
    Shirt,
    type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

// Display DPI for the designer canvas (50.8 DPI = 2 pixels per mm)
// This provides a reasonable screen size while maintaining correct proportions
const BASE_DISPLAY_DPI = 50.8;
const MAX_DISPLAY_CANVAS_PX = 4096;
const PASTEBOARD_PADDING_MM = 50;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_DESIGNER_BREAKPOINT_PX = 700;

type DesignerPanelTab = 'layers' | 'properties' | 'apparel' | 'pdf' | 'preflight' | 'proofing';

type DesignerOrderFlowNotice = {
    title: string;
    body: string;
    detail: string;
    toneClassName: string;
};

const getDesignerOrderFlowNotice = (
    designerMode?: string | null,
    productFlowLabel?: string | null,
    pricingModel?: string | null,
    hasCheckoutUpload = false,
): DesignerOrderFlowNotice => {
    const mode = String(designerMode || "").trim();
    const label = String(productFlowLabel || "Ordredesigner").trim();
    const pricing = pricingModel ? `Prismodel: ${pricingModel}` : "Pris og antal kommer fra bestillingen.";

    if (mode === "pdf_template") {
        return {
            title: "Designer med PDF-skabelon",
            body: "Placer grafik i forhold til skabelonens fold, ryg, beskæring og sikkerhedszone.",
            detail: "Skabelonlinjer er til kontrol og skal ikke bruges som trykbar grafik.",
            toneClassName: "border-sky-200 bg-sky-50 text-sky-950",
        };
    }

    if (mode === "storformat" || mode === "signage") {
        return {
            title: mode === "signage" ? "Skilt/facade designer" : "Storformat designer",
            body: "Canvas følger de valgte mål fra bestillingen, så motivet kan kontrolleres mod størrelse og bleed.",
            detail: hasCheckoutUpload ? "Den uploadede fil indsættes automatisk, når den kan hentes sikkert." : pricing,
            toneClassName: "border-emerald-200 bg-emerald-50 text-emerald-950",
        };
    }

    if (mode === "apparel") {
        return {
            title: "Tekstiltryk designer",
            body: "Brug designeren til placering af motivet. Størrelser og antal styres stadig af ordreflowet.",
            detail: pricing,
            toneClassName: "border-amber-200 bg-amber-50 text-amber-950",
        };
    }

    if (mode === "upload_only") {
        return {
            title: "Manuel kontrol for upload-produkt",
            body: "Produktet er sat til upload-only. Designeren er her kun som ekstra visuel kontrol.",
            detail: "Gå tilbage til bestilling, når filen er kontrolleret.",
            toneClassName: "border-slate-200 bg-slate-50 text-slate-900",
        };
    }

    return {
        title: label,
        body: hasCheckoutUpload
            ? "Den uploadede fil indsættes på canvas, så du kan kontrollere placering før bestilling."
            : "Brug designeren til at placere grafik og kontrollere bleed, sikkerhedszone og eksport.",
        detail: pricing,
        toneClassName: "border-sky-200 bg-sky-50 text-sky-950",
    };
};

interface CheckoutImportPlacement {
    left: number;
    top: number;
    scaleMultiplier: number;
    markAsCheckoutImport?: boolean;
    replaceObject?: fabric.Object;
    originX?: fabric.OriginX;
    originY?: fabric.OriginY;
    angle?: number;
    scaleX?: number;
    scaleY?: number;
}

const getPdfMetaFromObject = (obj: fabric.Object | null | undefined): SelectedPdfMeta | null => {
    const data = (obj as any)?.data;
    if (data?.kind !== "pdf_page_background") return null;

    return {
        originalFileName: data.originalFileName,
        pageIndex: typeof data.pageIndex === "number" ? data.pageIndex : 0,
        totalPages: typeof data.totalPages === "number" ? data.totalPages : undefined,
        pdfWidthMm: typeof data.pdfWidthMm === "number" ? data.pdfWidthMm : undefined,
        pdfHeightMm: typeof data.pdfHeightMm === "number" ? data.pdfHeightMm : undefined,
        renderWidthPx: typeof data.renderWidthPx === "number" ? data.renderWidthPx : undefined,
        renderHeightPx: typeof data.renderHeightPx === "number" ? data.renderHeightPx : undefined,
        vectorReady: Boolean(data.originalPdfBytes),
    };
};

const getPdfInitialSourceFromObject = (obj: fabric.Object | null | undefined): PDFImportInitialSource | null => {
    const data = (obj as any)?.data;
    if (data?.kind !== "pdf_page_background" || !data.originalPdfBytes) return null;

    return {
        bytes: data.originalPdfBytes.slice(0),
        fileName: data.originalFileName || "Importeret PDF",
        pageNumber: (typeof data.pageIndex === "number" ? data.pageIndex : 0) + 1,
    };
};

const STANDARD_FORMATS: Record<string, { width: number; height: number; bleed?: number }> = {
    "A0": { width: 841, height: 1189 },
    "A1": { width: 594, height: 841 },
    "A2": { width: 420, height: 594 },
    "A3": { width: 297, height: 420 },
    "A4": { width: 210, height: 297 },
    "A5": { width: 148, height: 210 },
    "A6": { width: 105, height: 148 },
    "A7": { width: 74, height: 105 },
    "M65": { width: 99, height: 210 },
    "M50": { width: 120, height: 175 },
    "85x55": { width: 85, height: 55 },
    "standard": { width: 85, height: 55 },
    "50x50": { width: 50, height: 50 },
    "80x50": { width: 80, height: 50 },
    "100x70": { width: 100, height: 70 },
};

function useIsPhoneDesignerViewport() {
    const getIsPhone = useCallback(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
        return window.matchMedia(`(max-width: ${PHONE_DESIGNER_BREAKPOINT_PX - 1}px)`).matches;
    }, []);
    const [isPhone, setIsPhone] = useState(getIsPhone);

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
        const query = window.matchMedia(`(max-width: ${PHONE_DESIGNER_BREAKPOINT_PX - 1}px)`);
        const update = () => setIsPhone(query.matches);
        update();
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
    }, []);

    return isPhone;
}

function DesignerPhoneUnsupported() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const returnTo = searchParams.get("returnTo");
    const safeReturnTo = returnTo && returnTo.startsWith("/") ? returnTo : null;

    return (
        <div className="min-h-screen bg-slate-50 text-slate-950">
            <SEO title="Print Designer virker bedst på større skærme" />
            <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-5 py-6">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Tilbage
                    </Button>
                </div>

                <section className="flex flex-1 items-center py-8">
                    <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                            <Smartphone className="h-7 w-7" />
                        </div>
                        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-700">
                            Telefon understøttes ikke
                        </p>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                            Designeren virker bedst på computer eller iPad
                        </h1>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                            Printdesigneren bruger et præcist canvas med zoom, lag, preflight, bleed og filplacering.
                            På en telefon er skærmen for lille til at redigere tryksager sikkert.
                        </p>

                        <div className="mt-6 grid gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                            <div className="flex gap-3">
                                <Monitor className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                                <div>
                                    <p className="font-medium text-slate-900">Anbefalet</p>
                                    <p>Brug en computer til fuld designer, upload, preflight og eksport.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Tablet className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                                <div>
                                    <p className="font-medium text-slate-900">iPad/tablet</p>
                                    <p>Kan bruges på større skærme, men computer er stadig bedst til præcis redigering.</p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-3">
                            {safeReturnTo && (
                                <Button className="min-h-12 w-full" onClick={() => navigate(safeReturnTo)}>
                                    Tilbage til checkout
                                </Button>
                            )}
                            <Button
                                variant={safeReturnTo ? "outline" : "default"}
                                className="min-h-12 w-full"
                                onClick={() => navigate(-1)}
                            >
                                Gå tilbage
                            </Button>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

function parseApparelSides(value: string | null): ApparelPrintSide[] {
    if (!value) return [];
    return value
        .split(",")
        .map((side) => normalizeApparelSide(side, ["front", "back", "sleeve"]))
        .filter((side, index, list) => list.indexOf(side) === index);
}

function dataUrlToBlob(dataUrl: string): Blob {
    const [meta, payload] = dataUrl.split(",");
    const mimeString = meta?.split(":")[1]?.split(";")[0] || "application/octet-stream";
    const byteString = atob(payload || "");
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
}

function ApparelMockupArtboard({
    config,
    viewportWidth,
    viewportHeight,
    mockupWidth,
    mockupHeight,
}: {
    config: ApparelDesignerConfig;
    viewportWidth: number;
    viewportHeight: number;
    mockupWidth: number;
    mockupHeight: number;
}) {
    const mockupLeft = (viewportWidth - mockupWidth) / 2;
    const mockupTop = (viewportHeight - mockupHeight) / 2;
    const garmentColor = getApparelColorHex(config.garmentColor);

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
            <div
                role="img"
                aria-label={`${config.mockupAlt}, ${config.garmentColor}`}
                className="absolute"
                style={{
                    left: mockupLeft,
                    top: mockupTop,
                    width: mockupWidth,
                    height: mockupHeight,
                    maxWidth: "none",
                    maxHeight: "none",
                }}
            >
                <div
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{
                        backgroundColor: garmentColor,
                        WebkitMaskImage: `url(${config.mockupSrc})`,
                        maskImage: `url(${config.mockupSrc})`,
                        WebkitMaskPosition: "center",
                        maskPosition: "center",
                        WebkitMaskRepeat: "no-repeat",
                        maskRepeat: "no-repeat",
                        WebkitMaskSize: "100% 100%",
                        maskSize: "100% 100%",
                    }}
                />
                <img
                    src={config.mockupSrc}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 h-full w-full object-fill"
                    style={{ opacity: 0.42, mixBlendMode: "multiply", maxWidth: "none" }}
                />
            </div>
        </div>
    );
}

function ApparelDesignerPanel({
    config,
    onSideChange,
    onColorChange,
}: {
    config: ApparelDesignerConfig;
    onSideChange: (side: ApparelPrintSide) => void;
    onColorChange: (color: string) => void;
}) {
    const selectedColorId = getApparelColorOption(config.garmentColor)?.id;

    return (
        <div className="p-4">
            <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
                    <Shirt className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold">Tekstiltryk</p>
                    <p className="truncate text-xs text-slate-500">{config.productName}</p>
                </div>
            </div>

            <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-950">
                T-shirten ligger nu i artboardet som visuel mockup. Kun selve printfeltet eksporteres som PNG først og PDF som backup.
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-slate-100 px-2 py-1.5">
                    <span className="block text-slate-500">Farve</span>
                    <span className="font-semibold">{config.garmentColor}</span>
                </div>
                <div className="rounded-md bg-slate-100 px-2 py-1.5">
                    <span className="block text-slate-500">Metode</span>
                    <span className="font-semibold">{config.printMethod}</span>
                </div>
                <div className="rounded-md bg-slate-100 px-2 py-1.5">
                    <span className="block text-slate-500">Printfelt</span>
                    <span className="font-semibold">{config.printWidthMm}x{config.printHeightMm} mm</span>
                </div>
                <div className="rounded-md bg-slate-100 px-2 py-1.5">
                    <span className="block text-slate-500">Sikkerhed</span>
                    <span className="font-semibold">{config.safeAreaMm} mm</span>
                </div>
                <div className="rounded-md bg-slate-100 px-2 py-1.5">
                    <span className="block text-slate-500">Placering</span>
                    <span className="font-semibold">{config.printAreaLabel}</span>
                </div>
                <div className="rounded-md bg-slate-100 px-2 py-1.5">
                    <span className="block text-slate-500">Størrelse</span>
                    <span className="font-semibold">
                        {config.garmentSize && config.garmentWidthCm && config.garmentLengthCm
                            ? `${config.garmentSize} · ${config.garmentWidthCm}x${config.garmentLengthCm} cm`
                            : "Produktvalg"}
                    </span>
                </div>
            </div>

            <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-slate-700">T-shirtfarve</p>
                <div className="grid grid-cols-3 gap-2" role="group" aria-label="Vælg T-shirtfarve">
                    {APPAREL_COLOR_OPTIONS.map((color) => {
                        const isSelected = selectedColorId === color.id;
                        const isLight = color.id === "white" || color.id === "yellow" || color.id === "sky-blue";
                        return (
                            <button
                                key={color.id}
                                type="button"
                                aria-pressed={isSelected}
                                aria-label={`${color.label}${color.pantone ? `, cirka Pantone ${color.pantone}` : ""}`}
                                title={`${color.label}${color.pantone ? ` · ca. Pantone ${color.pantone}` : ""}`}
                                onClick={() => onColorChange(color.label)}
                                className={cn(
                                    "relative flex min-h-14 touch-manipulation flex-col items-center justify-center gap-1 rounded-md border px-1.5 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2",
                                    isSelected
                                        ? "border-sky-600 bg-sky-50 font-semibold text-sky-950"
                                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                                )}
                            >
                                <Shirt
                                    className="h-6 w-6"
                                    fill={color.hex}
                                    strokeWidth={isSelected ? 2.5 : 1.8}
                                    style={{ color: isLight ? "#475569" : color.hex }}
                                />
                                <span className="line-clamp-2 text-[10px] leading-tight">{color.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {config.sides.length > 1 && (
                <div className="mt-3 flex gap-2">
                    {config.sides.map((side) => (
                        <Button
                            key={side}
                            type="button"
                            size="sm"
                            variant={config.activeSide === side ? "default" : "outline"}
                            className="min-h-9 flex-1 text-xs"
                            onClick={() => onSideChange(side)}
                        >
                            {apparelSideLabel(side)}
                        </Button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function Designer() {
    const isPhoneViewport = useIsPhoneDesignerViewport();
    if (isPhoneViewport) {
        return <DesignerPhoneUnsupported />;
    }

    return <DesignerWorkspace />;
}

function DesignerWorkspace() {
    const queryClient = useQueryClient();
    const { variantId } = useParams<{ variantId?: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const editorRef = useRef<EditorCanvasRef>(null);
    const proofingOverlayRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cutContourInputRef = useRef<HTMLInputElement>(null);
    const autoPreflightTimerRef = useRef<NodeJS.Timeout | null>(null);
    const pdfRerenderTimerRef = useRef<NodeJS.Timeout | null>(null);
    const pdfRerenderInFlightRef = useRef<Set<string>>(new Set());
    const canvasAreaRef = useRef<HTMLDivElement>(null);
    const apparelDraftLoadKeyRef = useRef<string | null>(null);
    const apparelSideChangeRef = useRef(false);
    const checkoutSession = useMemo(() => readSiteCheckoutSession(), []);

    const productId = searchParams.get("productId");
    const templateId = searchParams.get("templateId");
    const designId = searchParams.get("designId");
    const queryTenantIdRaw = searchParams.get("tenantId") || searchParams.get("tenant_id");
    const queryTenantId = queryTenantIdRaw && UUID_REGEX.test(queryTenantIdRaw) ? queryTenantIdRaw : null;
    const format = searchParams.get("format");
    const variant = searchParams.get("variant");
    const orderMode = searchParams.get("order") === "1" || searchParams.get("mode") === "order";
    const directTemplatePdfUrl = searchParams.get("templatePdfUrl") || searchParams.get("templatePdf") || (orderMode ? checkoutSession?.templatePdfUrl || null : null);
    const directTemplatePdfName = searchParams.get("templatePdfName") || (orderMode ? checkoutSession?.templatePdfName || null : null);
    const designerMode = searchParams.get("designerMode") || checkoutSession?.designerMode || null;
    const pricingModel = searchParams.get("pricingModel") || checkoutSession?.pricingModel || null;
    const productFlowLabel = checkoutSession?.productFlowLabel || null;
    const returnTo = searchParams.get("returnTo");
    const safeReturnTo = returnTo && returnTo.startsWith("/") ? returnTo : null;
    const designerOrderFlowNotice = useMemo(
        () => getDesignerOrderFlowNotice(
            designerMode,
            productFlowLabel,
            pricingModel,
            Boolean(checkoutSession?.siteUpload?.fileUrl),
        ),
        [checkoutSession?.siteUpload?.fileUrl, designerMode, pricingModel, productFlowLabel],
    );
    const parseDimension = (value: string | null) => {
        if (!value) return null;
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return null;
        return parsed;
    };
    const parseNonNegative = (value: string | null) => {
        if (value === null || value === undefined || value === "") return null;
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) return null;
        return parsed;
    };
    const customWidthMm = parseDimension(searchParams.get("widthMm"));
    const customHeightMm = parseDimension(searchParams.get("heightMm"));
    const customBleedMm = parseNonNegative(searchParams.get("bleedMm"));
    const customSafeMm = parseNonNegative(searchParams.get("safeMm"));
    const apparelConfig = useMemo(() => {
        if (designerMode !== "apparel" && searchParams.get("apparel") !== "1" && !checkoutSession?.apparelConfig) {
            return null;
        }

        const sessionConfig = checkoutSession?.apparelConfig || null;
        const sides = parseApparelSides(searchParams.get("apparelSides") || null)
            || [];

        return buildApparelDesignerConfig({
            productName: searchParams.get("apparelProduct") || sessionConfig?.productName || checkoutSession?.productName || null,
            garmentColor: searchParams.get("apparelColor") || sessionConfig?.garmentColor || null,
            printMethod: searchParams.get("apparelMethod") || sessionConfig?.printMethod || null,
            printPosition: searchParams.get("apparelPosition") || sessionConfig?.printPositionId || null,
            side: searchParams.get("apparelSide") || sessionConfig?.activeSide || null,
            sides: sides.length > 0 ? sides : sessionConfig?.sides || null,
            widthMm: customWidthMm ?? sessionConfig?.printWidthMm,
            heightMm: customHeightMm ?? sessionConfig?.printHeightMm,
            bleedMm: customBleedMm ?? sessionConfig?.bleedMm,
            safeAreaMm: customSafeMm ?? sessionConfig?.safeAreaMm,
        });
    }, [
        checkoutSession?.apparelConfig,
        checkoutSession?.productName,
        customBleedMm,
        customHeightMm,
        customSafeMm,
        customWidthMm,
        designerMode,
        searchParams,
    ]);

    // State
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasSelection, setHasSelection] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [layers, setLayers] = useState<LayerInfo[]>([]);
    const [selectedProps, setSelectedProps] = useState<SelectedObjectProps | null>(null);
    const [selectedPdfMeta, setSelectedPdfMeta] = useState<SelectedPdfMeta | null>(null);
    const [pdfServiceReport, setPdfServiceReport] = useState<DesignerPdfServiceReport | null>(null);
    const [pdfServiceRunning, setPdfServiceRunning] = useState(false);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [pendingCutContour, setPendingCutContour] = useState<string | null>(null);
    const [pendingTemplatePdf, setPendingTemplatePdf] = useState<string | null>(directTemplatePdfUrl);
    const [pendingTemplateEditorJson, setPendingTemplateEditorJson] = useState<any | null>(null);
    const [linkedTemplateFetchComplete, setLinkedTemplateFetchComplete] = useState(() => !templateId);
    const [checkoutUploadImported, setCheckoutUploadImported] = useState(false);
    const [returningToOrder, setReturningToOrder] = useState(false);
    // Keep URL-first initialization to avoid A4 flash before async spec loads.
    const [documentSpec, setDocumentSpec] = useState(() => {
        const defaultSpec = {
            name: apparelConfig
                ? `${apparelConfig.productName} - ${apparelConfig.printAreaLabel} printfelt`
                : directTemplatePdfName || "Uden titel",
            width_mm: 210,
            height_mm: 297,
            bleed_mm: 3,
            safe_area_mm: 3,
            dpi: 300,
            color_profile: "FOGRA39",
            template_id: null as string | null,
            product_id: null as string | null,
            preview_thumbnail_url: null as string | null,
            tenant_id: queryTenantId,
            format: null as string | null,
        };

        if (apparelConfig) {
            return {
                ...defaultSpec,
                width_mm: apparelConfig.printWidthMm,
                height_mm: apparelConfig.printHeightMm,
                bleed_mm: apparelConfig.bleedMm,
                safe_area_mm: apparelConfig.safeAreaMm,
                dpi: 300,
                format: "TEKSTIL",
            };
        }

        if (customWidthMm !== null && customHeightMm !== null) {
            const areaM2 = (customWidthMm * customHeightMm) / 1_000_000;
            return {
                ...defaultSpec,
                width_mm: customWidthMm,
                height_mm: customHeightMm,
                bleed_mm: typeof customBleedMm === "number" ? customBleedMm : defaultSpec.bleed_mm,
                safe_area_mm: typeof customSafeMm === "number" ? customSafeMm : defaultSpec.safe_area_mm,
                dpi: areaM2 >= 1 ? 150 : defaultSpec.dpi
            };
        }

        if (format && STANDARD_FORMATS[format.toUpperCase()]) {
            const dims = STANDARD_FORMATS[format.toUpperCase()];
            return {
                ...defaultSpec,
                width_mm: dims.width,
                height_mm: dims.height,
                bleed_mm: typeof customBleedMm === "number" ? customBleedMm : (dims.bleed || defaultSpec.bleed_mm),
                safe_area_mm: typeof customSafeMm === "number" ? customSafeMm : defaultSpec.safe_area_mm,
                format: format.toUpperCase(),
            };
        }

        return defaultSpec;
    });
    const [canvasAreaSize, setCanvasAreaSize] = useState({ width: 0, height: 0 });
    const [selectedTool, setSelectedTool] = useState<string>("select");
    const [activeTab, setActiveTab] = useState<DesignerPanelTab>(() => apparelConfig ? 'apparel' : 'layers');
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
    const rightPanelTabs = useMemo<Array<{ id: DesignerPanelTab; label: string; Icon: LucideIcon }>>(() => {
        const tabs: Array<{ id: DesignerPanelTab; label: string; Icon: LucideIcon }> = [
            { id: 'layers', label: 'Lag', Icon: Layers3 },
            { id: 'properties', label: 'Egenskaber', Icon: Settings2 },
        ];

        if (apparelConfig) tabs.push({ id: 'apparel', label: 'Tekstiltryk', Icon: Shirt });
        if (selectedPdfMeta) tabs.push({ id: 'pdf', label: 'PDF-værktøjer', Icon: FileText });

        tabs.push(
            { id: 'preflight', label: 'Preflight', Icon: FileCheck },
            { id: 'proofing', label: 'Farvevisning', Icon: Palette },
        );

        return tabs;
    }, [apparelConfig, selectedPdfMeta]);
    const activeRightPanel = rightPanelTabs.find((tab) => tab.id === activeTab) || rightPanelTabs[0];
    const handleRightPanelTabClick = useCallback((tab: DesignerPanelTab) => {
        if (tab === activeTab) {
            setIsRightPanelOpen((open) => !open);
            return;
        }
        setActiveTab(tab);
    }, [activeTab]);

    useEffect(() => {
        setIsRightPanelOpen(true);
    }, [activeTab]);
    const isUuid = useCallback((value: string | null) => {
        if (!value) return false;
        return UUID_REGEX.test(value);
    }, []);

    // PDF Import
    const [showPDFImport, setShowPDFImport] = useState(false);
    const [pdfImportInitialSource, setPdfImportInitialSource] = useState<PDFImportInitialSource | null>(null);
    const pdfImportModeRef = useRef<'add' | 'replace-selected'>('add');
    const pdfReplaceTargetRef = useRef<fabric.Object | null>(null);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const dragCounterRef = useRef(0);

    // Preflight
    const [preflightWarnings, setPreflightWarnings] = useState<PreflightWarning[]>([]);
    const [preflightErrors, setPreflightErrors] = useState<PreflightWarning[]>([]);
    const [preflightInfos, setPreflightInfos] = useState<PreflightWarning[]>([]);
    const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);

    // Show landing page when no parameters are provided
    const productDbId = useMemo(() => (isUuid(productId) ? productId : null), [isUuid, productId]);
    const variantDbId = useMemo(() => (isUuid(variantId || null) ? variantId || null : null), [isUuid, variantId]);
    const hasCustomFormat = customWidthMm !== null && customHeightMm !== null;
    const showLanding = !variantId && !productId && !templateId && !designId && !format && !hasCustomFormat && !directTemplatePdfUrl;

    // Unsaved changes navigation guard
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

    // Save dialog for naming new designs
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [saveDesignName, setSaveDesignName] = useState("");
    const [savedDesignId, setSavedDesignId] = useState<string | null>(null);
    const [isSavingAndLeaving, setIsSavingAndLeaving] = useState(false);

    // Color Proofing & Profiles
    const { profile: productProfile } = useProductColorProfile({ productId: productDbId });

    const [fabricCanvas, setFabricCanvas] = useState<fabric.Canvas | null>(null);
    const displayDpi = useMemo(() => {
        const totalWidthMm = documentSpec.width_mm + (documentSpec.bleed_mm * 2);
        const totalHeightMm = documentSpec.height_mm + (documentSpec.bleed_mm * 2);
        const baseDocWidth = mmToPx(totalWidthMm, BASE_DISPLAY_DPI);
        const baseDocHeight = mmToPx(totalHeightMm, BASE_DISPLAY_DPI);
        const basePaddingPx = mmToPx(PASTEBOARD_PADDING_MM, BASE_DISPLAY_DPI);
        const baseCanvasWidth = Math.round(baseDocWidth + (basePaddingPx * 2));
        const baseCanvasHeight = Math.round(baseDocHeight + (basePaddingPx * 2));
        const maxSide = Math.max(baseCanvasWidth, baseCanvasHeight);
        if (!Number.isFinite(maxSide) || maxSide <= 0) return BASE_DISPLAY_DPI;

        const scale = Math.min(1, MAX_DISPLAY_CANVAS_PX / maxSide);
        return BASE_DISPLAY_DPI * scale;
    }, [documentSpec.width_mm, documentSpec.height_mm, documentSpec.bleed_mm]);
    const pasteboardPaddingPx = useMemo(() => {
        return Math.round(mmToPx(PASTEBOARD_PADDING_MM, displayDpi));
    }, [displayDpi]);
    const displayMmToPx = displayDpi / 25.4;

    useEffect(() => {
        const element = canvasAreaRef.current;
        if (!element) return;

        const updateSize = () => {
            const styles = getComputedStyle(element);
            const paddingX = parseFloat(styles.paddingLeft || "0") + parseFloat(styles.paddingRight || "0");
            const paddingY = parseFloat(styles.paddingTop || "0") + parseFloat(styles.paddingBottom || "0");
            const width = Math.max(0, element.clientWidth - paddingX);
            const height = Math.max(0, element.clientHeight - paddingY);
            setCanvasAreaSize({ width, height });
        };

        updateSize();

        const observer = new ResizeObserver(updateSize);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    // Poll for canvas initialization
    useEffect(() => {
        if (fabricCanvas) return;
        const interval = setInterval(() => {
            const canvas = editorRef.current?.getCanvas();
            if (canvas) {
                setFabricCanvas(canvas);
                clearInterval(interval);
            }
        }, 500);
        return () => clearInterval(interval);
    }, [fabricCanvas]);

    // Calculate dimensions for proofing overlay matching EditorCanvas logic
    // We use standard variable names to match usage later in the file
    const docWidth = mmToPx(documentSpec.width_mm + (documentSpec.bleed_mm * 2), displayDpi);
    const docHeight = mmToPx(documentSpec.height_mm + (documentSpec.bleed_mm * 2), displayDpi);
    const canvasWidth = Math.round(docWidth + (pasteboardPaddingPx * 2));
    const canvasHeight = Math.round(docHeight + (pasteboardPaddingPx * 2));
    const apparelPreviewWidth = apparelConfig
        ? docWidth / Math.max(0.01, apparelConfig.mockupPlacement.widthPct / 100)
        : canvasWidth;
    const apparelPreviewHeight = apparelConfig
        ? apparelPreviewWidth / (762 / 954)
        : canvasHeight;
    const fitScale = useMemo(() => {
        const availableWidth = canvasAreaSize.width;
        const availableHeight = canvasAreaSize.height;
        if (!availableWidth || !availableHeight || !canvasWidth || !canvasHeight) return 1;

        const visualWidth = Math.max(canvasWidth, apparelPreviewWidth);
        const visualHeight = Math.max(canvasHeight, apparelPreviewHeight);
        const scaleX = availableWidth / visualWidth;
        const scaleY = availableHeight / visualHeight;
        const scale = Math.min(1, scaleX, scaleY);
        return Number.isFinite(scale) && scale > 0 ? scale : 1;
    }, [
        apparelPreviewHeight,
        apparelPreviewWidth,
        canvasAreaSize.height,
        canvasAreaSize.width,
        canvasHeight,
        canvasWidth,
    ]);
    const zoomScale = useMemo(() => {
        if (!Number.isFinite(zoomLevel)) return 1;
        return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoomLevel));
    }, [zoomLevel]);
    const effectiveScale = fitScale * zoomScale;
    const viewportWidth = useMemo(() => {
        return Math.max(1, canvasAreaSize.width || canvasWidth);
    }, [canvasAreaSize.width, canvasWidth]);
    const viewportHeight = useMemo(() => {
        return Math.max(1, canvasAreaSize.height || canvasHeight);
    }, [canvasAreaSize.height, canvasHeight]);
    const viewportOffsetX = useMemo(() => {
        const baseOffset = (viewportWidth - canvasWidth * effectiveScale) / 2;
        if (!apparelConfig) return baseOffset;
        const previewDisplayWidth = apparelPreviewWidth * effectiveScale;
        const desiredCenterPct = (
            apparelConfig.mockupPlacement.leftPct
            + (apparelConfig.mockupPlacement.widthPct / 2)
        ) / 100;
        return baseOffset + (previewDisplayWidth * (desiredCenterPct - 0.5));
    }, [apparelConfig, apparelPreviewWidth, viewportWidth, canvasWidth, effectiveScale]);
    const apparelDocumentOffsetX = viewportOffsetX - ((viewportWidth - canvasWidth * effectiveScale) / 2);
    const apparelDocumentOffsetY = useMemo(() => {
        if (!apparelConfig) return 0;
        const placement = apparelConfig.mockupPlacement;
        const previewDisplayHeight = apparelPreviewHeight * effectiveScale;
        const documentDisplayHeight = docHeight * effectiveScale;
        const garmentLengthMm = apparelConfig.garmentLengthCm
            ? apparelConfig.garmentLengthCm * 10
            : placement.referenceGarmentLengthMm || 745;
        const topFraction = typeof placement.topOffsetMm === "number"
            ? placement.topOffsetMm / Math.max(1, garmentLengthMm)
            : placement.topPct / 100;
        return (documentDisplayHeight / 2) - (previewDisplayHeight * (0.5 - topFraction));
    }, [apparelConfig, apparelPreviewHeight, docHeight, effectiveScale]);
    const viewportOffsetY = useMemo(() => {
        return ((viewportHeight - canvasHeight * effectiveScale) / 2) + apparelDocumentOffsetY;
    }, [apparelDocumentOffsetY, viewportHeight, canvasHeight, effectiveScale]);
    const controlScale = useMemo(() => {
        const scale = fitScale > 0 ? 1 / fitScale : 1;
        return Math.max(1, Math.min(4, Math.round(scale * 10) / 10));
    }, [fitScale]);
    const labelScale = 1;

    const colorProofing = useColorProofing({
        fabricCanvas,
        overlayCanvasRef: proofingOverlayRef,
        canvasWidth,
        canvasHeight,
        docWidth: Math.round(docWidth),
        docHeight: Math.round(docHeight),
        pasteboardOffset: pasteboardPaddingPx,
        customProfileId: productProfile.id || undefined,
        customProfileName: productProfile.name || undefined,
        customProfileBytes: productProfile.profileBytes,
    });
    const zoomPercent = Math.round(zoomScale * 100);
    const updateZoom = useCallback((nextZoom: number) => {
        const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, nextZoom));
        setZoomLevel(Number.isFinite(clamped) ? clamped : 1);
    }, []);
    const getApparelDraftKey = useCallback((side: ApparelPrintSide) => {
        if (!apparelConfig) return null;
        const productRef = documentSpec.product_id || productId || checkoutSession?.productSlug || apparelConfig.productName;
        const dimensionRef = `${apparelConfig.printWidthMm}x${apparelConfig.printHeightMm}`;
        return `wp_apparel_side_draft:${productRef}:${dimensionRef}:${side}`;
    }, [apparelConfig, checkoutSession?.productSlug, documentSpec.product_id, productId]);

    const getCurrentCanvasSnapshot = useCallback(() => {
        return editorRef.current?.getJSON() as { objects?: any[] } | undefined;
    }, []);

    const buildEmptySideSnapshot = useCallback(() => {
        const currentSnapshot = getCurrentCanvasSnapshot();
        const systemObjects = Array.isArray(currentSnapshot?.objects)
            ? currentSnapshot.objects.filter((obj) =>
                Boolean(obj?.__isDocumentBackground || obj?.__isGuide || obj?.__isGuideLabel || obj?.__isStaticFrame)
            )
            : [];

        return {
            ...currentSnapshot,
            version: (fabric as any).version,
            objects: systemObjects,
        };
    }, [getCurrentCanvasSnapshot]);

    const saveApparelSideDraft = useCallback((side: ApparelPrintSide) => {
        const draftKey = getApparelDraftKey(side);
        if (!draftKey || typeof sessionStorage === "undefined") return;
        const snapshot = getCurrentCanvasSnapshot();
        if (!snapshot) return;
        sessionStorage.setItem(draftKey, JSON.stringify(snapshot));
    }, [getApparelDraftKey, getCurrentCanvasSnapshot]);

    const loadApparelSideDraft = useCallback(async (side: ApparelPrintSide, options: { clearIfMissing?: boolean } = {}) => {
        const draftKey = getApparelDraftKey(side);
        if (!draftKey || typeof sessionStorage === "undefined" || !editorRef.current) return false;

        const rawDraft = sessionStorage.getItem(draftKey);
        const shouldClear = options.clearIfMissing === true;
        if (!rawDraft && !shouldClear) return false;

        let snapshot: object | null = null;
        if (rawDraft) {
            try {
                snapshot = JSON.parse(rawDraft);
            } catch {
                snapshot = null;
            }
        }
        snapshot = snapshot || buildEmptySideSnapshot();

        apparelSideChangeRef.current = true;
        await editorRef.current.loadJSON(snapshot);
        window.setTimeout(() => {
            apparelSideChangeRef.current = false;
            setLayers(editorRef.current?.getLayers() || []);
        }, 150);
        return true;
    }, [buildEmptySideSnapshot, getApparelDraftKey]);

    useEffect(() => {
        if (!apparelConfig || !fabricCanvas || loading) return;
        const draftKey = getApparelDraftKey(apparelConfig.activeSide);
        if (!draftKey || apparelDraftLoadKeyRef.current === draftKey || typeof sessionStorage === "undefined") return;

        apparelDraftLoadKeyRef.current = draftKey;
        if (sessionStorage.getItem(draftKey)) {
            void loadApparelSideDraft(apparelConfig.activeSide);
        }
    }, [apparelConfig, fabricCanvas, getApparelDraftKey, loadApparelSideDraft, loading]);

    const handleApparelSideChange = useCallback((side: ApparelPrintSide) => {
        if (!apparelConfig || apparelConfig.activeSide === side) return;

        const nextPosition = side === "back"
            ? "back-center"
            : apparelConfig.printPositionId === "back-center"
                ? "front-center"
                : apparelConfig.printPositionId;
        const nextConfig = buildApparelDesignerConfig({
            productName: apparelConfig.productName,
            garmentColor: apparelConfig.garmentColor,
            printMethod: apparelConfig.printMethod,
            printPosition: nextPosition,
            side,
            sides: apparelConfig.sides,
            bleedMm: apparelConfig.bleedMm,
            safeAreaMm: apparelConfig.safeAreaMm,
        });

        saveApparelSideDraft(apparelConfig.activeSide);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("apparelSide", side);
        nextParams.set("apparelPosition", nextConfig.printPositionId);
        nextParams.set("widthMm", String(nextConfig.printWidthMm));
        nextParams.set("heightMm", String(nextConfig.printHeightMm));
        nextParams.set("bleedMm", String(nextConfig.bleedMm));
        nextParams.set("safeMm", String(nextConfig.safeAreaMm));
        setSearchParams(nextParams, { replace: true });
        setDocumentSpec((current) => ({
            ...current,
            name: `${nextConfig.productName} - ${nextConfig.printAreaLabel} printfelt`,
            width_mm: nextConfig.printWidthMm,
            height_mm: nextConfig.printHeightMm,
            bleed_mm: nextConfig.bleedMm,
            safe_area_mm: nextConfig.safeAreaMm,
        }));
        window.setTimeout(() => {
            void loadApparelSideDraft(side, { clearIfMissing: true });
        }, 0);
        toast.info(`Aktiv side: ${nextConfig.printAreaLabel}. Sider gemmes som separate printfelter i ordren.`);
    }, [apparelConfig, loadApparelSideDraft, saveApparelSideDraft, searchParams, setSearchParams]);

    const handleApparelColorChange = useCallback((color: string) => {
        if (!apparelConfig || apparelConfig.garmentColor === color) return;
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("apparelColor", color);
        setSearchParams(nextParams, { replace: true });

        const existingSession = readSiteCheckoutSession();
        if (existingSession?.apparelConfig) {
            writeSiteCheckoutSession({
                ...existingSession,
                apparelConfig: {
                    ...existingSession.apparelConfig,
                    garmentColor: color,
                },
            });
        }
    }, [apparelConfig, searchParams, setSearchParams]);

    // Load spec
    useEffect(() => {
        const loadSpec = async () => {
            try {
                setLoading(true);

                if (designId) {
                    // Skip reloading if this is the design we just saved
                    if (savedDesignId === designId) {
                        setLoading(false);
                        return;
                    }

                    const { data: design, error } = await supabase
                        .from('designer_saved_designs' as any)
                        .select('*')
                        .eq('id', designId)
                        .single();

                    if (design && !error) {
                        setDocumentSpec({
                            name: (design as any).name,
                            width_mm: (design as any).width_mm,
                            height_mm: (design as any).height_mm,
                            bleed_mm: (design as any).bleed_mm || 3,
                            safe_area_mm: (design as any).safe_area_mm || 3,
                            dpi: (design as any).dpi || 300,
                            color_profile: (design as any).color_profile || "FOGRA39",
                            template_id: (design as any).template_id,
                            product_id: (design as any).product_id,
                            preview_thumbnail_url: (design as any).preview_thumbnail_url,
                            tenant_id: (design as any).tenant_id,
                            format: null,
                        });
                        setTimeout(() => {
                            if ((design as any).editor_json && editorRef.current) {
                                editorRef.current.loadJSON((design as any).editor_json);
                            }
                        }, 100);
                        setLoading(false);
                        return;
                    }
                }

                if (apparelConfig) {
                    setDocumentSpec(prev => ({
                        ...prev,
                        name: `${apparelConfig.productName} - ${apparelConfig.printAreaLabel} printfelt`,
                        width_mm: apparelConfig.printWidthMm,
                        height_mm: apparelConfig.printHeightMm,
                        bleed_mm: apparelConfig.bleedMm,
                        safe_area_mm: apparelConfig.safeAreaMm,
                        dpi: 300,
                        color_profile: productProfile.name || prev.color_profile || "FOGRA39",
                        product_id: productDbId || variantDbId || prev.product_id,
                        format: "TEKSTIL",
                    }));
                    setLoading(false);
                    return;
                }

                if (customWidthMm !== null && customHeightMm !== null) {
                    const widthMm = customWidthMm;
                    const heightMm = customHeightMm;
                    let resolvedProductId = productDbId || variantDbId || null;
                    let productName = apparelConfig
                        ? `${apparelConfig.productName} - ${apparelConfig.printAreaLabel} printfelt`
                        : directTemplatePdfName || "Design: Tilpasset format";
                    let specs: any = null;

                    if (resolvedProductId) {
                        const { data: product, error } = await supabase
                            .from('products')
                            .select('id, name, technical_specs')
                            .eq('id', resolvedProductId)
                            .single();

                        if (product && !error) {
                            productName = apparelConfig
                                ? `${product.name} - ${apparelConfig.printAreaLabel} printfelt`
                                : `Design til ${product.name}`;
                            specs = product.technical_specs || null;
                            resolvedProductId = product.id;
                        }
                    }

                    const areaM2 = (widthMm * heightMm) / 1_000_000;
                    const fallbackBleed = typeof specs?.bleed_mm === "number" ? specs.bleed_mm : 3;
                    const fallbackSafeArea = typeof specs?.safe_area_mm === "number" ? specs.safe_area_mm : 3;
                    const baseDpi = typeof specs?.min_dpi === "number" ? specs.min_dpi : 300;
                    const resolvedDpi = areaM2 >= 1 ? 150 : baseDpi;

                    setDocumentSpec(prev => ({
                        ...prev,
                        name: productName,
                        width_mm: widthMm,
                        height_mm: heightMm,
                        bleed_mm: typeof customBleedMm === "number"
                            ? customBleedMm
                            : typeof specs?.bleed_mm === "number"
                                ? specs.bleed_mm
                                : (prev.bleed_mm || fallbackBleed),
                        safe_area_mm: typeof customSafeMm === "number"
                            ? customSafeMm
                            : typeof specs?.safe_area_mm === "number"
                                ? specs.safe_area_mm
                                : (prev.safe_area_mm || fallbackSafeArea),
                        dpi: resolvedDpi,
                        color_profile: productProfile.name || "FOGRA39",
                        product_id: resolvedProductId,
                        format: null,
                    }));
                    setLoading(false);
                    return;
                }

                if (format && isUuid(format)) {
                    const formatQuery = supabase
                        .from('product_attribute_values' as any)
                        .select('id, name, width_mm, height_mm, product_id, meta')
                        .eq('id', format);
                    if (productDbId) {
                        formatQuery.eq('product_id', productDbId);
                    }
                    const { data: formatValue, error: formatError } = await formatQuery.maybeSingle();

                    if (formatValue && !formatError) {
                        let formatMeta: any = (formatValue as any).meta || null;
                        if (typeof formatMeta === "string") {
                            try {
                                formatMeta = JSON.parse(formatMeta);
                            } catch {
                                formatMeta = null;
                            }
                        }
                        const formatBleed = typeof formatMeta?.bleed_mm === "number" ? formatMeta.bleed_mm : null;
                        const formatSafeArea = typeof formatMeta?.safe_area_mm === "number" ? formatMeta.safe_area_mm : null;
                        let productName = formatValue.name;
                        if (productDbId) {
                            const { data: product } = await supabase
                                .from('products')
                                .select('name')
                                .eq('id', productDbId)
                                .single();
                            if (product) {
                                productName = `${product.name} - ${formatValue.name}`;
                            }
                        }

                        setDocumentSpec(prev => ({
                            ...prev,
                            name: `Design: ${productName}`,
                            width_mm: formatValue.width_mm || 210,
                            height_mm: formatValue.height_mm || 297,
                            bleed_mm: typeof customBleedMm === "number"
                                ? customBleedMm
                                : typeof formatBleed === "number"
                                    ? formatBleed
                                    : prev.bleed_mm || 3,
                            safe_area_mm: typeof customSafeMm === "number"
                                ? customSafeMm
                                : typeof formatSafeArea === "number"
                                    ? formatSafeArea
                                    : prev.safe_area_mm || 3,
                            product_id: productDbId || formatValue.product_id,
                            format: formatValue.name || null,
                        }));
                        setLoading(false);
                        return;
                    }
                }

                if (format && STANDARD_FORMATS[format.toUpperCase()]) {
                    const dims = STANDARD_FORMATS[format.toUpperCase()];
                    let productName = format.toUpperCase();

                    if (productDbId) {
                        const { data: product } = await supabase
                            .from('products')
                            .select('name')
                            .eq('id', productDbId)
                            .single();
                        if (product) {
                            productName = `${product.name} - ${format.toUpperCase()}`;
                        }
                    }

                    setDocumentSpec(prev => ({
                        ...prev,
                        name: `Design: ${productName}`,
                        width_mm: dims.width,
                        height_mm: dims.height,
                        bleed_mm: typeof customBleedMm === "number" ? customBleedMm : (dims.bleed || 3),
                        safe_area_mm: typeof customSafeMm === "number" ? customSafeMm : (prev.safe_area_mm || 3),
                        product_id: productDbId,
                        format: format.toUpperCase(),
                    }));
                    setLoading(false);
                    return;
                }

                if (productDbId || variantDbId) {
                    const pid = productDbId || variantDbId;
                    const { data: product, error } = await supabase
                        .from('products')
                        .select('id, name, technical_specs')
                        .eq('id', pid)
                        .single();

                    if (product && !error) {
                        const specs = product.technical_specs as any || {};
                        setDocumentSpec(prev => ({
                            ...prev,
                            name: `Design til ${product.name}`,
                            width_mm: specs.width_mm || 210,
                            height_mm: specs.height_mm || 297,
                            bleed_mm: typeof customBleedMm === "number" ? customBleedMm : (specs.bleed_mm || 3),
                            safe_area_mm: typeof customSafeMm === "number" ? customSafeMm : (specs.safe_area_mm || 3),
                            dpi: specs.min_dpi || 300,
                            color_profile: productProfile.name || "FOGRA39",
                            product_id: product.id,
                            format: format?.toUpperCase() || null,
                        }));
                        setLoading(false);
                        return;
                    }
                }

                if (templateId) {
                    setLinkedTemplateFetchComplete(false);
                    const { data: template, error } = await supabase
                        .from('designer_templates' as any)
                        .select('*')
                        .eq('id', templateId)
                        .single();

                    if (template && !error) {
                        setDocumentSpec(prev => ({
                            ...prev,
                            name: `Design: ${(template as any).name}`,
                            width_mm: (template as any).width_mm,
                            height_mm: (template as any).height_mm,
                            bleed_mm: (template as any).bleed_mm || 3,
                            safe_area_mm: (template as any).safe_area_mm || 3,
                            dpi: (template as any).dpi_default || 300,
                            color_profile: (template as any).color_profile || "FOGRA39",
                            template_id: (template as any).id,
                            format: null,
                        }));

                        // Store cut contour path to apply once canvas is ready
                        if ((template as any).cut_contour_path) {
                            setPendingCutContour((template as any).cut_contour_path);
                        }

                        // Store template PDF URL to apply once canvas is ready
                        if ((template as any).template_pdf_url) {
                            setPendingTemplatePdf((template as any).template_pdf_url);
                        }

                        if ((template as any).editor_json) {
                            setPendingTemplateEditorJson((template as any).editor_json);
                        }

                        setLinkedTemplateFetchComplete(true);
                        setLoading(false);
                        return;
                    }

                    setLinkedTemplateFetchComplete(true);
                }

                setLoading(false);

            } catch (err) {
                console.error("Error loading spec:", err);
                toast.error("Kunne ikke indlæse design-specifikationer");
                if (templateId) {
                    setLinkedTemplateFetchComplete(true);
                }
                setLoading(false);
            }
        };

        loadSpec();
    }, [variantId, productId, productDbId, variantDbId, templateId, designId, format, savedDesignId, customWidthMm, customHeightMm, customBleedMm, customSafeMm, directTemplatePdfName, productProfile.name, apparelConfig]);

    useEffect(() => {
        const hasBaseSpecContext = Boolean(
            productId
            || variantId
            || format
            || (customWidthMm !== null && customHeightMm !== null)
        );

        if (!templateId || !hasBaseSpecContext) return;

        let active = true;
        setLinkedTemplateFetchComplete(false);

        const applyLinkedTemplate = async () => {
            try {
                const { data: template, error } = await supabase
                    .from('designer_templates' as any)
                    .select('*')
                    .eq('id', templateId)
                    .single();

                if (!active || error || !template) {
                    if (active) setLinkedTemplateFetchComplete(true);
                    return;
                }

                setDocumentSpec((prev) => ({
                    ...prev,
                    template_id: (template as any).id,
                    bleed_mm: typeof customBleedMm === "number"
                        ? customBleedMm
                        : (template as any).bleed_mm || prev.bleed_mm || 3,
                    safe_area_mm: typeof customSafeMm === "number"
                        ? customSafeMm
                        : (template as any).safe_area_mm || prev.safe_area_mm || 3,
                    color_profile: prev.color_profile || (template as any).color_profile || "FOGRA39",
                }));

                setPendingCutContour((template as any).cut_contour_path || null);
                setPendingTemplatePdf((template as any).template_pdf_url || null);
                setPendingTemplateEditorJson((template as any).editor_json || null);
                if (!(template as any).template_pdf_url && !(template as any).editor_json) {
                    setLinkedTemplateFetchComplete(true);
                }
            } catch (error) {
                console.error("[Designer] Failed to apply linked template", error);
                if (active) setLinkedTemplateFetchComplete(true);
            }
        };

        applyLinkedTemplate();

        return () => {
            active = false;
        };
    }, [templateId, productId, variantId, format, customWidthMm, customHeightMm, customBleedMm, customSafeMm]);

    useEffect(() => {
        if (!templateId) {
            setLinkedTemplateFetchComplete(true);
            return;
        }
        if (!pendingTemplatePdf && !pendingTemplateEditorJson) {
            setLinkedTemplateFetchComplete(true);
        }
    }, [templateId, pendingTemplatePdf, pendingTemplateEditorJson]);

    // Apply pending cut contour once canvas is ready
    useEffect(() => {
        if (pendingCutContour && fabricCanvas && editorRef.current) {
            // Small delay to ensure canvas is fully initialized
            const timer = setTimeout(() => {
                editorRef.current?.addCutContour(pendingCutContour);
                setPendingCutContour(null); // Clear after applying
                console.log('[Designer] Auto-loaded cut contour from template');
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [pendingCutContour, fabricCanvas]);

    // Apply pending template PDF once canvas is ready
    useEffect(() => {
        if (!pendingTemplatePdf || !fabricCanvas || !editorRef.current) return;

        const loadTemplatePdf = async () => {
            try {
                // Dynamically import PDF.js
                const pdfjs = await import('pdfjs-dist');

                // Fetch and parse PDF
                const loadingTask = pdfjs.getDocument(pendingTemplatePdf);
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 3 }); // High res render

                // Render to offscreen canvas
                const offscreenCanvas = document.createElement('canvas');
                offscreenCanvas.width = Math.round(viewport.width);
                offscreenCanvas.height = Math.round(viewport.height);
                const context = offscreenCanvas.getContext('2d');
                if (!context) return;

                await page.render({
                    canvasContext: context,
                    viewport: viewport,
                }).promise;

                // Convert to image URL and add as template
                const imageDataUrl = offscreenCanvas.toDataURL('image/png', 1.0);
                const widthMm = documentSpec.width_mm + (documentSpec.bleed_mm * 2);
                const heightMm = documentSpec.height_mm + (documentSpec.bleed_mm * 2);

                editorRef.current?.addPdfTemplate(imageDataUrl, widthMm, heightMm);
                setPendingTemplatePdf(null);

                toast.info('Format-skabelon indlæst - placer dit design inden for linjerne');
                console.log('[Designer] Auto-loaded template PDF overlay');
            } catch (err) {
                console.error('[Designer] Failed to load template PDF:', err);
                setPendingTemplatePdf(null);
            }
        };

        // Small delay to ensure canvas is ready
        const timer = setTimeout(loadTemplatePdf, 500);
        return () => clearTimeout(timer);
    }, [pendingTemplatePdf, fabricCanvas, documentSpec.width_mm, documentSpec.height_mm, documentSpec.bleed_mm]);

    useEffect(() => {
        if (!pendingTemplateEditorJson || !fabricCanvas || !editorRef.current) return;

        const timer = setTimeout(() => {
            editorRef.current?.loadJSON(pendingTemplateEditorJson);
            setPendingTemplateEditorJson(null);
            setHasChanges(false);
            toast.info("Startdesign indlæst fra templatebiblioteket");
        }, 250);

        return () => clearTimeout(timer);
    }, [pendingTemplateEditorJson, fabricCanvas]);

    // Beforeunload handler for tab close/refresh with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasChanges) {
                e.preventDefault();
                // Modern browsers ignore custom messages, but we still need to set returnValue
                e.returnValue = 'Du har ændringer, der ikke er gemt. Er du sikker på, at du vil forlade siden?';
                return e.returnValue;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasChanges]);

    // Navigate back helper - used after save or discard
    const navigateBack = useCallback(() => {
        if (orderMode) {
            if (safeReturnTo) {
                navigate(safeReturnTo);
                return;
            }
            if (window.history.length > 1) {
                navigate(-1);
                return;
            }
            navigate('/');
            return;
        }
        // Admin/backend designer: always return to dashboard
        navigate('/admin');
    }, [navigate, orderMode, safeReturnTo]);

    // Handle back navigation with unsaved changes guard
    const handleBackClick = useCallback(() => {
        if (hasChanges) {
            setShowUnsavedDialog(true);
        } else {
            navigateBack();
        }
    }, [hasChanges, navigateBack]);

    const markDesignReady = useCallback(() => {
        if (!documentSpec.product_id) return;
        markSiteCheckoutDesignReady(documentSpec.product_id, readSiteCheckoutSession());
    }, [documentSpec.product_id]);

    const buildCanvasOrderPdfBlob = useCallback(async (fabricCanvas: fabric.Canvas, nameOverride?: string) => {
        const exportName = nameOverride || documentSpec.name;
        const profile = OUTPUT_PROFILES.find(p => p.id === colorProofing.settings.outputProfileId)
            || OUTPUT_PROFILES[0];
        const bleedPx = (documentSpec.bleed_mm || 0) * displayMmToPx;
        const pdfWidth = documentSpec.width_mm + ((documentSpec.bleed_mm || 0) * 2);
        const pdfHeight = documentSpec.height_mm + ((documentSpec.bleed_mm || 0) * 2);

        const proofedRgbDataUrl = await withCanonicalExportViewport(
            fabricCanvas,
            () => withHiddenGuides(fabricCanvas, async () => {
                const result = await colorProofing.exportCMYK(
                    SRGB_PROFILE_URL,
                    profile.url,
                    productProfile.profileBytes,
                    {
                        left: pasteboardPaddingPx,
                        top: pasteboardPaddingPx,
                        width: (documentSpec.width_mm * displayMmToPx) + (bleedPx * 2),
                        height: (documentSpec.height_mm * displayMmToPx) + (bleedPx * 2),
                    }
                );

                return result.proofedRgbDataUrl;
            }),
        );

        const doc = new jsPDF({
            orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
            unit: 'mm',
            format: [pdfWidth, pdfHeight],
        });

        doc.addImage(proofedRgbDataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'SLOW');
        doc.setProperties({
            title: exportName,
            subject: 'Trykklar PDF',
            creator: 'Webprinter Designer',
            keywords: `CMYK, ${profile.name}, Print`,
        });

        return {
            blob: doc.output('blob') as Blob,
            filename: `${exportName.replace(/[^a-z0-9_.-]/gi, '_')}.pdf`,
        };
    }, [
        colorProofing,
        displayMmToPx,
        documentSpec,
        pasteboardPaddingPx,
        productProfile.profileBytes,
    ]);

    const buildCanvasOrderPngBlob = useCallback(async (fabricCanvas: fabric.Canvas, nameOverride?: string) => {
        const exportName = nameOverride || documentSpec.name;
        const profile = OUTPUT_PROFILES.find(p => p.id === colorProofing.settings.outputProfileId)
            || OUTPUT_PROFILES[0];
        const bleedPx = (documentSpec.bleed_mm || 0) * displayMmToPx;

        const proofedRgbDataUrl = await withCanonicalExportViewport(
            fabricCanvas,
            () => withHiddenGuides(fabricCanvas, async () => {
                const result = await colorProofing.exportCMYK(
                    SRGB_PROFILE_URL,
                    profile.url,
                    productProfile.profileBytes,
                    {
                        left: pasteboardPaddingPx,
                        top: pasteboardPaddingPx,
                        width: (documentSpec.width_mm * displayMmToPx) + (bleedPx * 2),
                        height: (documentSpec.height_mm * displayMmToPx) + (bleedPx * 2),
                    }
                );

                return result.proofedRgbDataUrl;
            }),
        );

        return {
            blob: dataUrlToBlob(proofedRgbDataUrl),
            filename: `${exportName.replace(/[^a-z0-9_.-]/gi, '_')}.png`,
        };
    }, [
        colorProofing,
        displayMmToPx,
        documentSpec,
        pasteboardPaddingPx,
        productProfile.profileBytes,
    ]);

    const handleReturnToOrder = useCallback(() => {
        const completeReturn = () => {
            markDesignReady();
            if (safeReturnTo) {
                navigate(safeReturnTo);
                return;
            }
            if (window.history.length > 1) {
                navigate(-1);
                return;
            }
            navigate('/');
        };

        const prepareDesignerOrderFile = async () => {
            if (!orderMode || returningToOrder) return;

            const fabricCanvas = editorRef.current?.getCanvas();
            const pdfBackgroundMeta = detectPdfBackground(fabricCanvas || null);

            if (!fabricCanvas || (!apparelConfig && !pdfBackgroundMeta && !hasOverlayObjects(fabricCanvas))) {
                completeReturn();
                return;
            }

            setReturningToOrder(true);
            try {
                const productRef = documentSpec.product_id || productId || "designer";
                const uploadProductionFile = async (
                    file: { blob: Blob; filename: string },
                    contentType: string,
                    sourceMode: "vector_pdf" | "print_pdf" | "apparel_png",
                ) => {
                    const safeFileName = file.filename.replace(/[^a-z0-9_.-]/gi, "_");
                    const filePath = `designer-production/${productRef}-${Date.now()}-${safeFileName}`;

                    const { error: uploadError } = await supabase.storage
                        .from("order-files")
                        .upload(filePath, file.blob, {
                            contentType,
                            upsert: false,
                        });

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from("order-files")
                        .getPublicUrl(filePath);

                    return {
                        name: file.filename,
                        mimeType: contentType,
                        fileUrl: publicUrl,
                        filePath,
                        sourceMode,
                    };
                };

                if (apparelConfig) {
                    saveApparelSideDraft(apparelConfig.activeSide);

                    const productionFiles: Array<{
                        format: "png" | "pdf";
                        apparelSide: ApparelPrintSide;
                        isPrimary?: boolean;
                        name?: string | null;
                        mimeType?: string | null;
                        fileUrl?: string | null;
                        filePath?: string | null;
                        sourceMode?: "vector_pdf" | "print_pdf" | "apparel_png" | null;
                    }> = [];

                    for (const side of apparelConfig.sides) {
                        const draftLoaded = await loadApparelSideDraft(side, { clearIfMissing: side === apparelConfig.activeSide });
                        if (!draftLoaded) continue;

                        const sideCanvas = editorRef.current?.getCanvas();
                        if (!sideCanvas || (!detectPdfBackground(sideCanvas) && !hasOverlayObjects(sideCanvas))) {
                            continue;
                        }

                        const sidePosition = side === "back"
                            ? "back-center"
                            : apparelConfig.printPositionId === "back-center"
                                ? "front-center"
                                : apparelConfig.printPositionId;
                        const sideConfig = buildApparelDesignerConfig({
                            productName: apparelConfig.productName,
                            garmentColor: apparelConfig.garmentColor,
                            printMethod: apparelConfig.printMethod,
                            printPosition: sidePosition,
                            side,
                            sides: apparelConfig.sides,
                            bleedMm: apparelConfig.bleedMm,
                            safeAreaMm: apparelConfig.safeAreaMm,
                        });
                        const sideName = `${sideConfig.productName} - ${sideConfig.printAreaLabel} printfelt`;
                        const sidePdfBackgroundMeta = detectPdfBackground(sideCanvas);
                        const isFirstProductionSide = productionFiles.length === 0;
                        const pngFile = await buildCanvasOrderPngBlob(sideCanvas, sideName);
                        const pngUpload = await uploadProductionFile(pngFile, "image/png", "apparel_png");
                        productionFiles.push({
                            format: "png",
                            apparelSide: side,
                            isPrimary: isFirstProductionSide && !sidePdfBackgroundMeta,
                            ...pngUpload,
                        });

                        const pdfFile = sidePdfBackgroundMeta
                            ? await (async () => {
                                const { pdfBytes, filename } = await buildVectorPdfBackgroundPdf({
                                    documentSpec: { ...documentSpec, name: sideName },
                                    fabricCanvas: sideCanvas,
                                    pdfBackgroundMeta: sidePdfBackgroundMeta,
                                    includeBleed: true,
                                    displayMetrics: {
                                        mmToPx: displayMmToPx,
                                        pasteboardPaddingPx,
                                    },
                                });

                                return {
                                    blob: new Blob([pdfBytes], { type: "application/pdf" }),
                                    filename,
                                    sourceMode: "vector_pdf" as const,
                                };
                            })()
                            : {
                                ...(await buildCanvasOrderPdfBlob(sideCanvas, sideName)),
                                sourceMode: "print_pdf" as const,
                            };
                        const pdfUpload = await uploadProductionFile(pdfFile, "application/pdf", pdfFile.sourceMode);
                        productionFiles.push({
                            format: "pdf",
                            apparelSide: side,
                            isPrimary: isFirstProductionSide && Boolean(sidePdfBackgroundMeta),
                            ...pdfUpload,
                        });
                    }

                    await loadApparelSideDraft(apparelConfig.activeSide, { clearIfMissing: true });

                    const primaryPngUpload = productionFiles.find((file) => file.format === "png") || null;
                    if (!primaryPngUpload) {
                        completeReturn();
                        return;
                    }

                    const existingSession = readSiteCheckoutSession();
                    writeSiteCheckoutSession({
                        ...existingSession,
                        apparelConfig: {
                            ...existingSession?.apparelConfig,
                            productName: apparelConfig.productName,
                            garmentColor: apparelConfig.garmentColor,
                            printMethod: apparelConfig.printMethod,
                            printPositionId: apparelConfig.printPositionId,
                            printAreaLabel: apparelConfig.printAreaLabel,
                            activeSide: apparelConfig.activeSide,
                            sides: apparelConfig.sides,
                            printWidthMm: apparelConfig.printWidthMm,
                            printHeightMm: apparelConfig.printHeightMm,
                            bleedMm: apparelConfig.bleedMm,
                            safeAreaMm: apparelConfig.safeAreaMm,
                            garmentSize: apparelConfig.garmentSize,
                            garmentWidthCm: apparelConfig.garmentWidthCm,
                            garmentLengthCm: apparelConfig.garmentLengthCm,
                        },
                        designerExport: {
                            name: primaryPngUpload.name,
                            mimeType: primaryPngUpload.mimeType,
                            fileUrl: primaryPngUpload.fileUrl,
                            filePath: primaryPngUpload.filePath,
                            sourceMode: primaryPngUpload.sourceMode,
                            primaryFormat: "png",
                            alternateFormats: ["pdf"],
                            productionFiles,
                            apparelSide: primaryPngUpload.apparelSide,
                            apparelSides: apparelConfig.sides,
                            generatedAt: new Date().toISOString(),
                        },
                    });

                    completeReturn();
                    return;
                }

                const productionFile = pdfBackgroundMeta
                    ? await (async () => {
                        const { pdfBytes, filename } = await buildVectorPdfBackgroundPdf({
                            documentSpec,
                            fabricCanvas,
                            pdfBackgroundMeta,
                            includeBleed: true,
                            displayMetrics: {
                                mmToPx: displayMmToPx,
                                pasteboardPaddingPx,
                            },
                        });

                        return {
                            blob: new Blob([pdfBytes], { type: "application/pdf" }),
                            filename,
                            sourceMode: "vector_pdf" as const,
                        };
                    })()
                    : {
                        ...(await buildCanvasOrderPdfBlob(fabricCanvas)),
                        sourceMode: "print_pdf" as const,
                    };

                const pdfUpload = await uploadProductionFile(productionFile, "application/pdf", productionFile.sourceMode);

                const existingSession = readSiteCheckoutSession();
                writeSiteCheckoutSession({
                    ...existingSession,
                    designerExport: {
                        ...pdfUpload,
                        primaryFormat: "pdf",
                        alternateFormats: [],
                        productionFiles: [
                            { format: "pdf", ...pdfUpload },
                        ],
                        generatedAt: new Date().toISOString(),
                    },
                });

                completeReturn();
            } catch (error) {
                console.error("[Designer] Failed to prepare production PDF for checkout:", error);
                toast.error("Kunne ikke lave produktionsfil til checkout. Bliv i designeren og prøv igen.");
            } finally {
                setReturningToOrder(false);
            }
        };

        void prepareDesignerOrderFile();
    }, [apparelConfig, buildCanvasOrderPdfBlob, buildCanvasOrderPngBlob, documentSpec, markDesignReady, navigate, orderMode, productId, returningToOrder, safeReturnTo, saveApparelSideDraft]);

    // Save and then navigate back
    const handleSaveAndLeave = useCallback(async () => {
        setIsSavingAndLeaving(true);
        try {
            await handleSave();
            // After successful save, hasChanges will be false, navigate back
            navigateBack();
        } catch (err) {
            // Save failed, stay on page
            console.error('Save failed during exit:', err);
        } finally {
            setIsSavingAndLeaving(false);
            setShowUnsavedDialog(false);
        }
    }, [navigateBack]);

    // Discard changes and navigate back
    const handleDiscardAndLeave = useCallback(() => {
        setHasChanges(false);
        setShowUnsavedDialog(false);
        navigateBack();
    }, [navigateBack]);

    // Run preflight checks
    // PROTECTED - See .agent/workflows/preflight-protected.md
    const runPreflight = useCallback(() => {
        const canvas = editorRef.current?.getCanvas();
        if (!canvas) return;

        const result = runPreflightChecks(canvas, {
            documentWidth: documentSpec.width_mm,
            documentHeight: documentSpec.height_mm,
            bleed: documentSpec.bleed_mm,
            safeArea: documentSpec.safe_area_mm || 3,
            minDPI: 96,
            targetDPI: 150,
            optimalDPI: 300,
            mmToPx: displayMmToPx,
        });

        setPreflightWarnings(result.warnings);
        setPreflightErrors(result.errors);
        setPreflightInfos(result.infos);

        // Only switch to preflight tab and show toast when there are actual problems
        // Don't interrupt the user's workflow when everything is fine
        if (result.errors.length > 0) {
            setActiveTab('preflight');
            toast.error(`Preflight fandt ${result.errors.length} fejl`);
        } else if (result.warnings.length > 0) {
            setActiveTab('preflight');
            toast.warning(`Preflight fandt ${result.warnings.length} advarsler`);
        }
    }, [documentSpec, displayMmToPx]);

    // Handle selection changes
    const handleSelectionChange = useCallback((hasSel: boolean, props?: SelectedObjectProps) => {
        setHasSelection(hasSel);
        setSelectedProps(hasSel && props ? props : null);
        const activeObject = editorRef.current?.getCanvas()?.getActiveObject();
        const pdfMeta = hasSel ? getPdfMetaFromObject(activeObject) : null;
        setSelectedPdfMeta(pdfMeta);
        if (!pdfMeta) setPdfServiceReport(null);
        if (hasSel) setActiveTab(pdfMeta ? 'pdf' : 'properties');
    }, []);

    // Handle layers change
    const handleLayersChange = useCallback((newLayers: LayerInfo[]) => {
        setLayers(newLayers);
    }, []);

    const resetPdfImportMode = useCallback(() => {
        pdfImportModeRef.current = 'add';
        pdfReplaceTargetRef.current = null;
        setPdfImportInitialSource(null);
    }, []);

    const openPdfImportForAdd = useCallback((initialSource: PDFImportInitialSource | null = null) => {
        pdfImportModeRef.current = 'add';
        pdfReplaceTargetRef.current = null;
        setPdfImportInitialSource(initialSource);
        setShowPDFImport(true);
    }, []);

    // Tool actions
    const handleToolClick = useCallback((toolId: string) => {
        // Actions that don't change mode
        if (toolId === 'image') {
            fileInputRef.current?.click();
            return;
        }
        if (toolId === 'pdf') {
            openPdfImportForAdd();
            return;
        }


        // Tools that change mode
        setSelectedTool(toolId);

        // Instant actions that might need setup
        switch (toolId) {
            case 'text':
                editorRef.current?.addText();
                setSelectedTool('select');
                break;
            case 'rectangle':
                editorRef.current?.addRectangle();
                setSelectedTool('select');
                break;
            case 'circle':
                editorRef.current?.addCircle();
                setSelectedTool('select');
                break;
            case 'line':
                editorRef.current?.addLine();
                setSelectedTool('select');
                break;
            case 'guide-h':
                editorRef.current?.addHorizontalGuide();
                setSelectedTool('select');
                break;
            case 'guide-v':
                editorRef.current?.addVerticalGuide();
                setSelectedTool('select');
                break;
        }
    }, [openPdfImportForAdd]);

    // Handle image upload
    const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Extract DPI from metadata
        const sourceDpi = await getImageDpi(file);
        if (sourceDpi) {
            console.log(`[Designer] Detected image DPI: ${sourceDpi}`);
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            editorRef.current?.addImage(dataUrl, sourceDpi || undefined);
        };
        reader.readAsDataURL(file);

        if (fileInputRef.current) fileInputRef.current.value = '';
        setSelectedTool('select');
    }, []);

    // Handle CutContour SVG upload
    const handleCutContourUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate SVG file type
        if (!file.type.includes('svg') && !file.name.endsWith('.svg')) {
            toast.error('Kun SVG-filer understøttes til CutContour');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const svgString = event.target?.result as string;
            editorRef.current?.addCutContour(svgString);
            toast.success('CutContour tilføjet');
        };
        reader.readAsText(file);

        if (cutContourInputRef.current) cutContourInputRef.current.value = '';
        setSelectedTool('select');
    }, []);

    const extractCutContourSvgFromPdf = useCallback(async (pdfBytes: ArrayBuffer, pageIndex = 0): Promise<string | null> => {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const pdf = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
        const page = await pdf.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale: 1 });
        const operatorList = await page.getOperatorList();
        const svgGfx = new (pdfjsLib as any).SVGGraphics(page.commonObjs, page.objs);
        const svgElement = await svgGfx.getSVG(operatorList, viewport) as SVGSVGElement;
        const serializer = new XMLSerializer();
        return serializer.serializeToString(svgElement);
    }, []);

    const handleCutContourAction = useCallback(async () => {
        if (hasSelection) {
            const activeObject = editorRef.current?.getCanvas()?.getActiveObject();
            const activePdfBytes =
                activeObject && (activeObject as any).data?.kind === 'pdf_page_background'
                    ? ((activeObject as any).data?.originalPdfBytes as ArrayBuffer | undefined)
                    : undefined;

            if (activePdfBytes) {
                const rawPdf = new TextDecoder().decode(new Uint8Array(activePdfBytes));
                const cutContourDetected =
                    /(?:\/|\()CutContour\b/i.test(rawPdf) || /\bCutContour\b/i.test(rawPdf);

                if (cutContourDetected) {
                    try {
                        const svgString = await extractCutContourSvgFromPdf(
                            activePdfBytes,
                            ((activeObject as any).data?.pageIndex as number | undefined) || 0
                        );
                        const created = svgString
                            ? await editorRef.current?.addCutContourFromPdfSvg(svgString, {
                                left: activeObject?.left,
                                top: activeObject?.top,
                                originX: activeObject?.originX as fabric.OriginX,
                                originY: activeObject?.originY as fabric.OriginY,
                                angle: activeObject?.angle,
                                scaleX: activeObject?.scaleX,
                                scaleY: activeObject?.scaleY,
                                flipX: activeObject?.flipX,
                                flipY: activeObject?.flipY,
                                width: activeObject?.width,
                                height: activeObject?.height,
                            }, 'detected-contour')
                            : false;

                        if (created) {
                            toast.success('Embedded CutContour importeret fra PDF.');
                        } else {
                            toast.error('PDF-scannen fandt CutContour-navnet, men kunne ikke udlede en magenta contour-sti til lærredet.');
                        }
                    } catch (error) {
                        console.error('[Designer] Failed to extract embedded PDF CutContour:', error);
                        toast.error('Kunne ikke importere embedded CutContour fra PDF.');
                    }
                } else {
                    try {
                        const svgString = await extractCutContourSvgFromPdf(
                            activePdfBytes,
                            ((activeObject as any).data?.pageIndex as number | undefined) || 0
                        );
                        const created = svgString
                            ? await editorRef.current?.addCutContourFromPdfSvg(svgString, {
                                left: activeObject?.left,
                                top: activeObject?.top,
                                originX: activeObject?.originX as fabric.OriginX,
                                originY: activeObject?.originY as fabric.OriginY,
                                angle: activeObject?.angle,
                                scaleX: activeObject?.scaleX,
                                scaleY: activeObject?.scaleY,
                                flipX: activeObject?.flipX,
                                flipY: activeObject?.flipY,
                                width: activeObject?.width,
                                height: activeObject?.height,
                            }, 'vector-outline')
                            : false;

                        if (created) {
                            toast.success('CutContour oprettet fra PDF-vektorformer.');
                        } else {
                            toast.error('Denne PDF kunne ikke omsættes til en brugbar vector contour. Brug eksisterende contour eller importér en separat SVG.');
                        }
                    } catch (error) {
                        console.error('[Designer] Failed to generate CutContour from PDF vectors:', error);
                        toast.error('Kunne ikke oprette contour fra PDF-vektorformer.');
                    }
                }
                return;
            }

            const created = await editorRef.current?.createCutContourFromSelection();
            if (created) {
                toast.success('CutContour oprettet fra valgt vektor');
            } else {
                toast.error('Vælg en vektorform eller SVG-sti for at oprette CutContour. PDF-baggrunde og rasterfiler kræver eksisterende contour eller SVG-import.');
            }
            return;
        }

        cutContourInputRef.current?.click();
    }, [extractCutContourSvgFromPdf, hasSelection]);

    // Handle PDF import with correct physical scaling
    const handlePDFImport = useCallback((data: PDFImportData, placement?: CheckoutImportPlacement) => {
        const canvas = editorRef.current?.getCanvas();
        if (!canvas) return;

        // Calculate the desired display size based on the PDF's physical dimensions
        const desiredWidthPx = mmToPx(data.widthMm, displayDpi);
        const desiredHeightPx = mmToPx(data.heightMm, displayDpi);

        // Calculate scale factor to apply to the rendered raster
        const scaleX = desiredWidthPx / data.renderedWidth;
        const scaleY = desiredHeightPx / data.renderedHeight;
        const scale = Math.min(scaleX, scaleY) * (placement?.scaleMultiplier || 1); // Use uniform scale

        // Add the image with correct scaling
        fabric.Image.fromURL(data.imageDataUrl, (img) => {
            const replaceObject = placement?.replaceObject || null;
            const replaceIndex = replaceObject ? canvas.getObjects().indexOf(replaceObject) : -1;
            img.set({
                left: placement?.left ?? canvasWidth / 2,
                top: placement?.top ?? canvasHeight / 2,
                originX: placement?.originX ?? 'center',
                originY: placement?.originY ?? 'center',
                angle: placement?.angle ?? 0,
                scaleX: placement?.scaleX ?? scale,
                scaleY: placement?.scaleY ?? scale,
            });

            // Store PDF metadata for vector export preservation
            if (data.originalPdfBytes) {
                (img as any).data = {
                    kind: 'pdf_page_background',
                    originalPdfBytes: data.originalPdfBytes,
                    pageIndex: data.pageNumber - 1,  // Convert to 0-based index
                    originalFileName: data.originalFileName,
                    totalPages: data.totalPages,
                    renderWidthPx: data.renderedWidth,
                    renderHeightPx: data.renderedHeight,
                    pdfWidthMm: data.widthMm,
                    pdfHeightMm: data.heightMm,
                };
            }
            if (placement?.markAsCheckoutImport) {
                (img as any).__isCheckoutImported = true;
            }

            if (replaceObject) {
                canvas.remove(replaceObject);
            }
            if (replaceIndex >= 0 && typeof (canvas as any).insertAt === 'function') {
                (canvas as any).insertAt(img, replaceIndex, false);
            } else {
                canvas.add(img);
            }
            canvas.setActiveObject(img);
            canvas.renderAll();
            setSelectedPdfMeta(getPdfMetaFromObject(img));
            setPdfServiceReport(null);
            setActiveTab('pdf');
            setHasChanges(true);

            console.log(`[PDF Import] ${Math.round(data.widthMm)}×${Math.round(data.heightMm)}mm rendered at scale ${scale.toFixed(3)}`);
        }, { crossOrigin: 'anonymous' });
    }, [canvasHeight, canvasWidth, displayDpi]);

    const renderPdfPageToImportData = useCallback(async (
        sourceBytes: ArrayBuffer,
        pageIndex: number,
        fileName?: string,
    ): Promise<PDFImportData> => {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const originalPdfBytes = sourceBytes.slice(0);
        const pdf = await pdfjsLib.getDocument({ data: sourceBytes.slice(0) }).promise;
        const safePageIndex = Math.min(Math.max(0, pageIndex), pdf.numPages - 1);
        const page = await pdf.getPage(safePageIndex + 1);
        const baseViewport = page.getViewport({ scale: 1 });
        const renderScale = 3;
        const viewport = page.getViewport({ scale: renderScale });

        const offscreenCanvas = document.createElement("canvas");
        offscreenCanvas.width = Math.round(viewport.width);
        offscreenCanvas.height = Math.round(viewport.height);
        const context = offscreenCanvas.getContext("2d");
        if (!context) throw new Error("Kunne ikke oprette PDF-preview");

        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        await page.render({
            canvasContext: context,
            viewport,
        }).promise;

        return {
            imageDataUrl: offscreenCanvas.toDataURL("image/png", 1.0),
            pageNumber: safePageIndex + 1,
            totalPages: pdf.numPages,
            widthMm: ptToMm(baseViewport.width),
            heightMm: ptToMm(baseViewport.height),
            renderedWidth: offscreenCanvas.width,
            renderedHeight: offscreenCanvas.height,
            originalPdfBytes,
            originalFileName: fileName,
        };
    }, []);

    const rerenderPdfBackgroundForQuality = useCallback(async (pdfObject: fabric.Image, viewportScale: number) => {
        const data = (pdfObject as any).data;
        if (data?.kind !== 'pdf_page_background' || !data.originalPdfBytes) return;

        const objectId = (pdfObject as any).__layerId || `pdf-bg-${data.pageIndex || 0}`;
        if (pdfRerenderInFlightRef.current.has(objectId)) return;

        const currentDisplayWidthPx = Math.max(1, (pdfObject.width || 1) * Math.abs(pdfObject.scaleX || 1));
        const currentDisplayHeightPx = Math.max(1, (pdfObject.height || 1) * Math.abs(pdfObject.scaleY || 1));
        const currentRenderedWidth = data.renderWidthPx || pdfObject.width || 0;
        const currentRenderedHeight = data.renderHeightPx || pdfObject.height || 0;
        const desiredRenderWidth = Math.min(6000, Math.max(1400, Math.round(currentDisplayWidthPx * Math.max(viewportScale, 1) * 1.25)));
        const desiredRenderHeight = Math.min(6000, Math.max(1400, Math.round(currentDisplayHeightPx * Math.max(viewportScale, 1) * 1.25)));

        if (desiredRenderWidth <= currentRenderedWidth * 1.1 && desiredRenderHeight <= currentRenderedHeight * 1.1) {
            return;
        }

        pdfRerenderInFlightRef.current.add(objectId);
        try {
            const pdfjsLib = await import("pdfjs-dist");
            pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

            const pdf = await pdfjsLib.getDocument({ data: data.originalPdfBytes.slice(0) }).promise;
            const page = await pdf.getPage((data.pageIndex || 0) + 1);
            const baseViewport = page.getViewport({ scale: 1 });
            const renderScale = Math.min(
                8,
                Math.max(
                    desiredRenderWidth / Math.max(baseViewport.width, 1),
                    desiredRenderHeight / Math.max(baseViewport.height, 1),
                    2
                )
            );
            const viewport = page.getViewport({ scale: renderScale });

            const offscreenCanvas = document.createElement("canvas");
            offscreenCanvas.width = Math.round(viewport.width);
            offscreenCanvas.height = Math.round(viewport.height);
            const context = offscreenCanvas.getContext("2d");
            if (!context) return;

            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
            await page.render({
                canvasContext: context,
                viewport,
            }).promise;

            const currentScaleX = pdfObject.scaleX || 1;
            const currentScaleY = pdfObject.scaleY || 1;
            const currentCanvasWidth = (pdfObject.width || 1) * currentScaleX;
            const currentCanvasHeight = (pdfObject.height || 1) * currentScaleY;
            const nextDataUrl = offscreenCanvas.toDataURL("image/png", 1.0);

            await new Promise<void>((resolve) => {
                (pdfObject as any).setSrc(nextDataUrl, () => {
                    const nextWidth = pdfObject.width || offscreenCanvas.width || 1;
                    const nextHeight = pdfObject.height || offscreenCanvas.height || 1;
                    pdfObject.set({
                        scaleX: currentCanvasWidth / nextWidth,
                        scaleY: currentCanvasHeight / nextHeight,
                    });
                    (pdfObject as any).data = {
                        ...data,
                        renderWidthPx: offscreenCanvas.width,
                        renderHeightPx: offscreenCanvas.height,
                    };
                    pdfObject.canvas?.requestRenderAll();
                    resolve();
                }, { crossOrigin: 'anonymous' });
            });
        } catch (error) {
            console.error('[Designer] Failed to rerender PDF background sharply:', error);
        } finally {
            pdfRerenderInFlightRef.current.delete(objectId);
        }
    }, []);

    // Handle PDF import as template overlay (semi-transparent, non-printing)
    const handlePDFImportAsTemplate = useCallback((data: PDFImportData) => {
        editorRef.current?.addPdfTemplate(data.imageDataUrl, data.widthMm, data.heightMm);
    }, []);

    useEffect(() => {
        if (!orderMode || checkoutUploadImported) return;
        const upload = checkoutSession?.siteUpload;
        if (!upload?.fileUrl || !editorRef.current?.getCanvas()) return;
        if (templateId && (!linkedTemplateFetchComplete || pendingTemplatePdf || pendingTemplateEditorJson || loading)) return;
        if (productId && checkoutSession?.productId && checkoutSession.productId !== productId) return;
        const expectedWidth = Number(checkoutSession?.designWidthMm || 0);
        const expectedHeight = Number(checkoutSession?.designHeightMm || 0);
        const expectedBleed = Number(checkoutSession?.designBleedMm || 0);
        if (
            expectedWidth > 0 &&
            expectedHeight > 0 &&
            (
                Math.abs(documentSpec.width_mm - expectedWidth) > 0.5 ||
                Math.abs(documentSpec.height_mm - expectedHeight) > 0.5 ||
                Math.abs(documentSpec.bleed_mm - expectedBleed) > 0.5
            )
        ) {
            return;
        }

        const canvas = editorRef.current.getCanvas();
        const existingUserObjects = canvas?.getObjects().filter((obj: any) =>
            !obj.__isDocumentBackground
            && !obj.__isGuide
            && !obj.__isPdfTemplate
        ) || [];
        if (designId && existingUserObjects.length > 0) {
            setCheckoutUploadImported(true);
            return;
        }

        let cancelled = false;

        const importCheckoutUpload = async () => {
            try {
                const response = await fetch(upload.fileUrl as string);
                if (!response.ok) throw new Error("Kunne ikke hente den uploadede fil til designeren.");
                const blob = await response.blob();
                if (cancelled) return;

                const mimeType = upload.mimeType || blob.type || "";
                const fileName = upload.name || "checkout-upload";
                const targetWidthMm = Number(checkoutSession?.designWidthMm || 0) + (Number(checkoutSession?.designBleedMm || 0) * 2);
                const targetHeightMm = Number(checkoutSession?.designHeightMm || 0) + (Number(checkoutSession?.designBleedMm || 0) * 2);
                const logicalCanvasCenterX = canvasWidth / 2;
                const logicalCanvasCenterY = canvasHeight / 2;
                const placement: CheckoutImportPlacement | undefined =
                    Number.isFinite(Number(upload.proofingScalePercent))
                    && Number.isFinite(Number(upload.proofingOffsetXPercent))
                    && Number.isFinite(Number(upload.proofingOffsetYPercent))
                    && targetWidthMm > 0
                    && targetHeightMm > 0
                        ? {
                            left: logicalCanvasCenterX + mmToPx(targetWidthMm, displayDpi) * (Number(upload.proofingOffsetXPercent || 0) / 100),
                            top: logicalCanvasCenterY + mmToPx(targetHeightMm, displayDpi) * (Number(upload.proofingOffsetYPercent || 0) / 100),
                            scaleMultiplier: Math.max(0.01, Number(upload.proofingScalePercent || 100) / 100),
                        }
                        : undefined;

                if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) {
                    const pdfjsLib = await import("pdfjs-dist");
                    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

                    const arrayBuffer = await blob.arrayBuffer();
                    const originalPdfBytes = arrayBuffer.slice(0);
                    const renderPdfBytes = arrayBuffer.slice(0);
                    const pdf = await pdfjsLib.getDocument({ data: renderPdfBytes }).promise;
                    const page = await pdf.getPage(1);
                    const baseViewport = page.getViewport({ scale: 1 });
                    const widthMm = Number(upload.physicalWidthMm || 0) > 0
                        ? Number(upload.physicalWidthMm)
                        : ptToMm(baseViewport.width);
                    const heightMm = Number(upload.physicalHeightMm || 0) > 0
                        ? Number(upload.physicalHeightMm)
                        : ptToMm(baseViewport.height);
                    const renderScale = 3;
                    const viewport = page.getViewport({ scale: renderScale });

                    const offscreenCanvas = document.createElement("canvas");
                    offscreenCanvas.width = Math.round(viewport.width);
                    offscreenCanvas.height = Math.round(viewport.height);
                    const context = offscreenCanvas.getContext("2d");
                    if (!context) throw new Error("Kunne ikke oprette PDF-preview");

                    context.fillStyle = "#ffffff";
                    context.fillRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
                    await page.render({
                        canvasContext: context,
                        viewport,
                    }).promise;

                    if (cancelled) return;

                    handlePDFImport({
                        imageDataUrl: offscreenCanvas.toDataURL("image/png", 1.0),
                        pageNumber: 1,
                        totalPages: pdf.numPages,
                        widthMm,
                        heightMm,
                        renderedWidth: offscreenCanvas.width,
                        renderedHeight: offscreenCanvas.height,
                        originalPdfBytes,
                        originalFileName: fileName,
                    }, {
                        ...placement,
                        markAsCheckoutImport: true,
                    });
                } else {
                    const file = new File([blob], fileName, { type: mimeType || "application/octet-stream" });
                    const detectedDpi = await getImageDpi(file);
                    const sourceDpi = detectedDpi || upload.sourceDpi || undefined;
                    const dataUrl = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    });

                    if (cancelled) return;
                    await editorRef.current?.addImage(dataUrl, sourceDpi, placement);
                    const activeObject = editorRef.current?.getCanvas()?.getActiveObject();
                    if (activeObject) {
                        (activeObject as any).__isCheckoutImported = true;
                    }
                }

                if (!cancelled) {
                    setCheckoutUploadImported(true);
                    toast.success("Uploadet fil indsat i designeren.");
                }
            } catch (error) {
                if (cancelled) return;
                console.error("Failed to import checkout upload into designer:", error);
                toast.error("Kunne ikke åbne den uploadede fil i designeren.");
            }
        };

        importCheckoutUpload();

        return () => {
            cancelled = true;
        };
    }, [orderMode, checkoutUploadImported, checkoutSession, productId, handlePDFImport, displayDpi, documentSpec.width_mm, documentSpec.height_mm, documentSpec.bleed_mm, templateId, linkedTemplateFetchComplete, pendingTemplatePdf, pendingTemplateEditorJson, loading, designId]);

    useEffect(() => {
        const canvas = editorRef.current?.getCanvas();
        if (!canvas) return;

        if (pdfRerenderTimerRef.current) {
            clearTimeout(pdfRerenderTimerRef.current);
        }

        pdfRerenderTimerRef.current = setTimeout(() => {
            canvas.getObjects().forEach((obj) => {
                if ((obj as any).data?.kind === 'pdf_page_background') {
                    void rerenderPdfBackgroundForQuality(obj as fabric.Image, effectiveScale);
                }
            });
        }, 250);

        return () => {
            if (pdfRerenderTimerRef.current) {
                clearTimeout(pdfRerenderTimerRef.current);
            }
        };
    }, [effectiveScale, layers, rerenderPdfBackgroundForQuality]);

    // Prompt to save - shows dialog for new designs
    const handleSave = async () => {
        // For new designs, show the save dialog to get a name
        if (!designId) {
            // Set default name based on format
            const defaultName = `${documentSpec.name || format || 'Design'} - ${new Date().toLocaleDateString('da-DK')}`;
            setSaveDesignName(defaultName);
            setShowSaveDialog(true);
            return;
        }

        // For existing designs, save directly
        await performSave();
    };

    // Actually perform the save operation
    const performSave = async (customName?: string) => {
        try {
            setSaving(true);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error("Du skal være logget ind for at gemme");
                navigate('/auth?redirect=/designer');
                return;
            }

            const canvas = editorRef.current?.getCanvas();
            const editorJson = editorRef.current?.getJSON() || {};
            const saveName = customName || documentSpec.name;

            // Resolve tenant ID to ensure storage paths are correct
            let tenantId = (documentSpec as any).tenant_id;

            if (!tenantId) {
                const { data: roleRow } = await supabase
                    .from('user_roles')
                    .select('tenant_id')
                    .eq('user_id', user.id)
                    .maybeSingle();
                tenantId = (roleRow as any)?.tenant_id;
            }

            tenantId = tenantId || '00000000-0000-0000-0000-000000000000';

            // Generate thumbnail if possible
            let preview_thumbnail_url = (documentSpec as any).preview_thumbnail_url;
            if (canvas) {
                try {
                    // Create a small preview
                    const dataUrl = canvas.toDataURL({
                        format: 'jpeg',
                        quality: 0.6,
                        multiplier: 0.2, // Small preview
                    });

                    // Upload to storage
                    // Convert dataURL to Blob more reliably without fetch
                    const byteString = atob(dataUrl.split(',')[1]);
                    const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) {
                        ia[i] = byteString.charCodeAt(i);
                    }
                    const blob = new Blob([ab], { type: mimeString });

                    // Put previews under the tenant directory to match existing patterns
                    const fileName = `${tenantId}/previews/${user.id}-${Date.now()}.jpg`;
                    console.log("Saving thumbnail to bucket 'product-images' path:", fileName);

                    const { error: uploadError } = await supabase.storage
                        .from('product-images')
                        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

                    if (!uploadError) {
                        const { data: { publicUrl } } = supabase.storage
                            .from('product-images')
                            .getPublicUrl(fileName);
                        console.log("Thumbnail saved successfully. URL:", publicUrl);
                        preview_thumbnail_url = publicUrl;
                    } else {
                        console.error("Storage upload error:", uploadError);
                    }
                } catch (thumbErr) {
                    console.error("Failed to generate thumbnail:", thumbErr);
                }
            }

            const designData = {
                user_id: user.id,
                name: saveName,
                width_mm: documentSpec.width_mm,
                height_mm: documentSpec.height_mm,
                bleed_mm: documentSpec.bleed_mm,
                safe_area_mm: documentSpec.safe_area_mm,
                dpi: documentSpec.dpi,
                color_profile: documentSpec.color_profile,
                template_id: documentSpec.template_id,
                product_id: documentSpec.product_id,
                editor_json: editorJson,
                preview_thumbnail_url,
                preflight_warnings: [...preflightWarnings, ...preflightErrors, ...combinedPreflightInfos],
                preflight_errors_count: preflightErrors.length,
                preflight_warnings_count: preflightWarnings.length,
                warnings_accepted: dismissedWarnings.size > 0,
                warnings_accepted_at: dismissedWarnings.size > 0 ? new Date().toISOString() : null,
                tenant_id: tenantId,
            };

            if (designId) {
                const { error } = await supabase
                    .from('designer_saved_designs' as any)
                    .update(designData)
                    .eq('id', designId);

                if (error) throw error;
                toast.success("Design opdateret!");
                setHasChanges(false);
            } else {
                const { data, error } = await supabase
                    .from('designer_saved_designs' as any)
                    .insert(designData)
                    .select()
                    .single();

                if (error) throw error;
                toast.success(`"${saveName}" gemt!`);
                setHasChanges(false);

                // Update documentSpec with new name and preview
                setDocumentSpec(prev => ({ ...prev, name: saveName, preview_thumbnail_url }));

                if (data) {
                    // Track that we just saved this design to skip reloading
                    const newId = (data as any).id;
                    setSavedDesignId(newId);

                    // Update URL without causing a full reload
                    const nextParams = new URLSearchParams(searchParams);
                    nextParams.set('designId', newId);
                    setSearchParams(nextParams, { replace: true });
                }
            }

            // Invalidate query to refresh library
            queryClient.invalidateQueries({ queryKey: ['design-library'] });
        } catch (err: any) {
            console.error("Save error:", err);
            toast.error("Kunne ikke gemme: " + err.message);
        } finally {
            setSaving(false);
            setShowSaveDialog(false);
        }
    };

    // Handle save dialog confirmation
    const handleSaveDialogConfirm = () => {
        if (!saveDesignName.trim()) {
            toast.error("Indtast venligst et navn til dit design");
            return;
        }
        performSave(saveDesignName.trim());
    };

    // Export print-ready PDF
    const handleExport = async () => {
        // Run preflight first
        runPreflight();

        if (preflightErrors.length > 0) {
            toast.error("Ret venligst preflight-fejl før eksport");
            setActiveTab('preflight');
            return;
        }

        try {
            setSaving(true);
            toast.info("Forbereder trykklar PDF (CMYK)... Dette kan tage et øjeblik.");

            // Find current profile URLs
            const profile = OUTPUT_PROFILES.find(p => p.id === colorProofing.settings.outputProfileId)
                || OUTPUT_PROFILES[0];

            // Calculate crop rect to capture TRIM + BLEED area (excluding pasteboard)
            // Note: pasteboard padding marks the start of the Bleed Box
            const bleedPx = (documentSpec.bleed_mm || 0) * displayMmToPx;

            // We want to capture the full bleed area, which starts at pasteboard padding
            const cropOptions = {
                left: pasteboardPaddingPx,
                top: pasteboardPaddingPx,
                width: (documentSpec.width_mm * displayMmToPx) + (bleedPx * 2),
                height: (documentSpec.height_mm * displayMmToPx) + (bleedPx * 2)
            };

            // 1. Transform to CMYK and get proofed RGB (Cropped to Bleed Box).
            // Template PDFs, fold guides, safe zones and document backgrounds are editor-only
            // objects and must not be captured in the printable export.
            const { cmykData, proofedRgbDataUrl, width, height } = await withCanonicalExportViewport(
                fabricCanvas,
                () => withHiddenGuides(
                    fabricCanvas,
                    () => colorProofing.exportCMYK(
                    SRGB_PROFILE_URL,
                    profile.url,
                    productProfile.profileBytes,
                    cropOptions
                    ),
                ),
            );

            if (cmykData.length === 0) {
                toast.warning("ICC-profiler blev ikke fundet. Eksporterer optimeret RGB PDF i stedet.");
            }

            // 2. Create PDF with full BLEED dimensions
            const bleedMm = documentSpec.bleed_mm || 0;
            const pdfWidth = documentSpec.width_mm + (bleedMm * 2);
            const pdfHeight = documentSpec.height_mm + (bleedMm * 2);

            const doc = new jsPDF({
                orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [pdfWidth, pdfHeight]
            });

            // 3. Add CMYK-simulated Image (Now full bleed size)
            doc.addImage(proofedRgbDataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'SLOW');

            // Set Output Intent (Metadata)
            doc.setProperties({
                title: documentSpec.name,
                subject: 'Trykklar PDF',
                creator: 'Webprinter Designer',
                keywords: `CMYK, ${profile.name}, Print`
            });

            // Save
            const fileName = `${documentSpec.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
            doc.save(fileName);

            toast.success("Trykklar PDF eksporteret!");
        } catch (err: any) {
            console.error("Export error:", err);
            toast.error("Kunne ikke eksportere PDF: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Export with dialog - uses runDesignerExport for mode selection
    const handleExportWithDialog = async (options: ExportOptions) => {
        // Run preflight first
        runPreflight();

        if (preflightErrors.length > 0) {
            toast.error("Ret venligst preflight-fejl før eksport");
            setActiveTab('preflight');
            return;
        }

        try {
            setSaving(true);
            const modeLabels: Record<string, string> = {
                print_pdf: 'Print PDF',
                proof_pdf: 'Proof PDF',
                original_pdf: 'Original PDF',
                vector_pdf: 'Vektor PDF'
            };
            toast.info(`Forbereder ${modeLabels[options.mode] || options.mode}...`);

            // Detect PDF background for vector export
            let pdfBackgroundMeta = null;
            if (fabricCanvas) {
                const objects = fabricCanvas.getObjects();
                for (const obj of objects) {
                    const data = (obj as any).data;
                    if (data?.kind === 'pdf_page_background' && data.originalPdfBytes) {
                        pdfBackgroundMeta = {
                            kind: 'pdf_page_background' as const,
                            originalPdfBytes: data.originalPdfBytes,
                            pageIndex: data.pageIndex || 0,
                            originalFileName: data.originalFileName
                        };
                        break;
                    }
                }
            }

            const result = await runDesignerExport(options, {
                documentSpec,
                fabricCanvas,
                colorProofing: {
                    settings: colorProofing.settings,
                    exportCMYK: colorProofing.exportCMYK,
                },
                productProfileBytes: productProfile.profileBytes,
                pdfSourceMeta: null, // No PDF source tracking yet
                hasChanges,
                pdfBackgroundMeta,
                displayMetrics: {
                    mmToPx: displayMmToPx,
                    pasteboardPaddingPx,
                },
            });

            if (result.success) {
                toast.success(`${modeLabels[options.mode] || options.mode} eksporteret!`);
                setIsExportDialogOpen(false);
            } else {
                toast.error(result.error || 'Eksport fejlede');
            }
        } catch (err: any) {
            console.error("Export error:", err);
            toast.error("Kunne ikke eksportere PDF: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Library actions
    const handleInsertDesign = (item: any) => {
        if (!editorRef.current) return;

        if (item.kind === 'fabric_json') {
            editorRef.current.importJSON(item.fabric_json);
            toast.success("Design indsat!");
        } else if (item.kind === 'svg' && item.storage_path) {
            // Fetch SVG string from storage or URL
            const { data } = supabase.storage.from('design-library').getPublicUrl(item.storage_path);
            fetch(data.publicUrl)
                .then(res => res.text())
                .then(svg => {
                    editorRef.current?.importSVG(svg);
                    toast.success("SVG indsat!");
                });
        }
        setIsLibraryOpen(false);
    };

    // State to track pending design replacement when there are unsaved changes
    const [pendingReplaceItem, setPendingReplaceItem] = useState<any>(null);
    const [showReplaceConfirmDialog, setShowReplaceConfirmDialog] = useState(false);

    const handleReplaceDesign = async (item: any) => {
        if (hasChanges) {
            // Store the pending item and show confirmation dialog
            setPendingReplaceItem(item);
            setShowReplaceConfirmDialog(true);
            return;
        }

        // No unsaved changes, proceed directly
        await executeReplaceDesign(item);
    };

    const executeReplaceDesign = async (item: any) => {
        // Handle template (format) items - navigate to designer with template
        if (item.kind === 'template' && item.id) {
            if (item.source_kind === 'canva' && item.external_launch_url) {
                window.open(item.external_launch_url, '_blank', 'noopener,noreferrer');
                toast.info("Canva-template åbnet i nyt vindue");
                setIsLibraryOpen(false);
                return;
            }
            navigate(`/designer?templateId=${item.id}`, { replace: true });
            setIsLibraryOpen(false);
            return;
        }

        if (item.kind === 'fabric_json' && item.fabric_json) {
            editorRef.current?.loadJSON(item.fabric_json);

            // If it's a saved design (from 'mine' tab), update the URL
            if (item.created_at) { // Simple check to see if it's from the hook's 'mine' mapping
                navigate(`/designer?designId=${item.id}`, { replace: true });
            }

            toast.success("Design åbnet!");
            setHasChanges(false);
        } else if (item.kind !== 'template') {
            toast.error("Dette filformat kan kun indsættes, ikke åbnes som nyt dokument.");
        }
        setIsLibraryOpen(false);
    };

    // Handle confirm replace (user clicked Replace in replace dialog)
    const handleConfirmReplace = useCallback(async () => {
        if (pendingReplaceItem) {
            await executeReplaceDesign(pendingReplaceItem);
            setPendingReplaceItem(null);
        }
        setShowReplaceConfirmDialog(false);
    }, [pendingReplaceItem]);

    // Add to order
    const handleAddToOrder = async () => {
        // Run preflight
        runPreflight();

        // Save first
        await handleSave();

        // Navigate to checkout with design
        if (documentSpec.product_id) {
            const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
            params.set('productId', documentSpec.product_id);
            params.set('designId', designId);
            navigate(`/checkout/konfigurer?${params.toString()}`);
        } else {
            toast.info('Vælg et produkt for at tilføje til kurv');
        }
    };

    // Update props
    const handleUpdateProps = useCallback((props: Partial<SelectedObjectProps>) => {
        editorRef.current?.updateSelectedProps(props);
    }, []);

    // Layer actions
    const handleSelectLayer = useCallback((id: string) => {
        setSelectedLayerId(id);
        editorRef.current?.selectLayer(id);
    }, []);

    const getActivePdfObject = useCallback((): fabric.Object | null => {
        const activeObject = editorRef.current?.getCanvas()?.getActiveObject() || null;
        return getPdfMetaFromObject(activeObject) ? activeObject : null;
    }, []);

    const getPdfReplacementPlacement = useCallback((target: fabric.Object): CheckoutImportPlacement => ({
        left: target.left ?? canvasWidth / 2,
        top: target.top ?? canvasHeight / 2,
        scaleMultiplier: 1,
        markAsCheckoutImport: Boolean((target as any).__isCheckoutImported),
        replaceObject: target,
        originX: target.originX as fabric.OriginX,
        originY: target.originY as fabric.OriginY,
        angle: target.angle,
        scaleX: target.scaleX,
        scaleY: target.scaleY,
    }), [canvasHeight, canvasWidth]);

    const updateActivePdfMeta = useCallback(() => {
        const activeObject = editorRef.current?.getCanvas()?.getActiveObject() || null;
        setSelectedPdfMeta(getPdfMetaFromObject(activeObject));
    }, []);

    const handleCenterSelectedPdf = useCallback(() => {
        const canvas = editorRef.current?.getCanvas();
        const pdfObject = getActivePdfObject();
        if (!canvas || !pdfObject) {
            toast.error("Vælg en importeret PDF først");
            return;
        }

        pdfObject.set({
            originX: "center",
            originY: "center",
            left: pasteboardPaddingPx + (docWidth / 2),
            top: pasteboardPaddingPx + (docHeight / 2),
        });
        canvas.setActiveObject(pdfObject);
        canvas.requestRenderAll();
        canvas.fire("object:modified", { target: pdfObject });
        setHasChanges(true);
        updateActivePdfMeta();
        toast.success("PDF centreret på dokumentet");
    }, [docHeight, docWidth, getActivePdfObject, pasteboardPaddingPx, updateActivePdfMeta]);

    const handleFitSelectedPdfToDocument = useCallback(() => {
        const canvas = editorRef.current?.getCanvas();
        const pdfObject = getActivePdfObject();
        if (!canvas || !pdfObject) {
            toast.error("Vælg en importeret PDF først");
            return;
        }

        const baseWidth = Math.max(1, pdfObject.width || 1);
        const baseHeight = Math.max(1, pdfObject.height || 1);
        const fitScale = Math.min(docWidth / baseWidth, docHeight / baseHeight);
        const safeScale = Number.isFinite(fitScale) && fitScale > 0 ? fitScale : 1;

        pdfObject.set({
            originX: "center",
            originY: "center",
            left: pasteboardPaddingPx + (docWidth / 2),
            top: pasteboardPaddingPx + (docHeight / 2),
            scaleX: safeScale,
            scaleY: safeScale,
        });
        canvas.setActiveObject(pdfObject);
        canvas.requestRenderAll();
        canvas.fire("object:modified", { target: pdfObject });
        setHasChanges(true);
        updateActivePdfMeta();
        toast.success("PDF tilpasset dokumentområdet");
    }, [docHeight, docWidth, getActivePdfObject, pasteboardPaddingPx, updateActivePdfMeta]);

    const handleImportNewPdfFromPanel = useCallback(() => {
        const pdfObject = getActivePdfObject();
        if (!pdfObject) {
            toast.error("Vælg en importeret PDF først");
            return;
        }

        pdfImportModeRef.current = 'replace-selected';
        pdfReplaceTargetRef.current = pdfObject;
        setPdfImportInitialSource(null);
        setShowPDFImport(true);
    }, [getActivePdfObject]);

    const handleEditSelectedPdfFromPanel = useCallback(() => {
        const pdfObject = getActivePdfObject();
        const initialSource = getPdfInitialSourceFromObject(pdfObject);
        if (!pdfObject || !initialSource) {
            toast.error("Den valgte PDF mangler original kilde");
            return;
        }

        pdfImportModeRef.current = 'replace-selected';
        pdfReplaceTargetRef.current = pdfObject;
        setPdfImportInitialSource(initialSource);
        setShowPDFImport(true);
    }, [getActivePdfObject]);

    const handleChangeSelectedPdfPage = useCallback(async (direction: -1 | 1) => {
        const pdfObject = getActivePdfObject();
        const data = (pdfObject as any)?.data;
        if (!pdfObject || data?.kind !== 'pdf_page_background' || !data.originalPdfBytes) {
            toast.error("Vælg en importeret PDF først");
            return;
        }

        const totalPages = typeof data.totalPages === "number" ? data.totalPages : 1;
        const currentPageIndex = typeof data.pageIndex === "number" ? data.pageIndex : 0;
        const nextPageIndex = Math.min(Math.max(0, currentPageIndex + direction), totalPages - 1);
        if (nextPageIndex === currentPageIndex) return;

        try {
            const importData = await renderPdfPageToImportData(
                data.originalPdfBytes.slice(0),
                nextPageIndex,
                data.originalFileName,
            );
            handlePDFImport(importData, getPdfReplacementPlacement(pdfObject));
            toast.success(`Skiftet til PDF-side ${nextPageIndex + 1}`);
        } catch (error) {
            console.error("[Designer] Failed to switch PDF page:", error);
            toast.error("Kunne ikke skifte PDF-side");
        }
    }, [getActivePdfObject, getPdfReplacementPlacement, handlePDFImport, renderPdfPageToImportData]);

    const handleRunSelectedPdfServiceScan = useCallback(async () => {
        const pdfObject = getActivePdfObject();
        const data = (pdfObject as any)?.data;
        if (!pdfObject || data?.kind !== 'pdf_page_background' || !data.originalPdfBytes) {
            toast.error("Vælg en importeret PDF med original kilde først");
            return;
        }

        setPdfServiceRunning(true);
        try {
            const request = {
                operation: "inspect" as const,
                bytes: data.originalPdfBytes.slice(0) as ArrayBuffer,
                fileName: data.originalFileName as string | undefined,
                expected: {
                    widthMm: documentSpec.width_mm,
                    heightMm: documentSpec.height_mm,
                    bleedMm: documentSpec.bleed_mm,
                },
            };
            let report: DesignerPdfServiceReport;
            try {
                report = await runDesignerPdfService({ ...request, runtime: "edge" });
            } catch (edgeError) {
                console.info("[Designer] Edge PDF scan unavailable; using browser inspection", edgeError);
                report = await runDesignerPdfService({ ...request, runtime: "browser" });
                report.warnings = [
                    "Den private PDF-service er ikke tilgængelig. Metadata er kontrolleret lokalt i browseren.",
                    ...report.warnings,
                ];
                if (report.status === "ok") report.status = "warning";
            }
            setPdfServiceReport(report);
            if (report.status === "ok") {
                toast.success("PDF-service scan gennemført");
            } else if (report.status === "warning") {
                toast.warning("PDF-service scan fandt advarsler");
            } else {
                toast.error("PDF-service scan fandt fejl");
            }
        } catch (error) {
            console.error("[Designer] PDF service scan failed:", error);
            toast.error("PDF-service scan fejlede");
        } finally {
            setPdfServiceRunning(false);
        }
    }, [documentSpec.bleed_mm, documentSpec.height_mm, documentSpec.width_mm, getActivePdfObject]);

    const handleRunSelectedPdfServiceOperation = useCallback(async (
        operation: DesignerPdfServiceOperation,
        options?: DesignerPdfServiceOptions,
    ) => {
        const pdfObject = getActivePdfObject();
        const data = (pdfObject as any)?.data;
        if (!pdfObject || data?.kind !== 'pdf_page_background' || !data.originalPdfBytes) {
            toast.error("Vælg en importeret PDF med original kilde først");
            return;
        }

        if (
            operation === "redact" &&
            !window.confirm("Den nye fil bliver rasteriseret, så den valgte tekst fjernes permanent. Originalen bevares. Fortsæt?")
        ) {
            return;
        }

        setPdfServiceRunning(true);
        try {
            const report = await runDesignerPdfService({
                runtime: "edge",
                operation,
                options,
                bytes: data.originalPdfBytes.slice(0),
                fileName: data.originalFileName || "designer.pdf",
                expected: {
                    widthMm: documentSpec.width_mm,
                    heightMm: documentSpec.height_mm,
                    bleedMm: documentSpec.bleed_mm,
                },
            });
            setPdfServiceReport(report);
            if (report.output) {
                toast.success("PDF'en er behandlet. Kontrollér resultatet før du bruger det i designet.");
            } else if (report.errors?.[0]) {
                toast.error(report.errors[0]);
            } else {
                toast.warning("PDF-servicen returnerede ikke en ny fil");
            }
        } catch (error) {
            console.error("[Designer] PDF processing failed:", error);
            toast.error(error instanceof Error ? error.message : "PDF-behandlingen fejlede");
        } finally {
            setPdfServiceRunning(false);
        }
    }, [documentSpec.bleed_mm, documentSpec.height_mm, documentSpec.width_mm, getActivePdfObject]);

    const handleApplyPdfServiceOutput = useCallback(async () => {
        const pdfObject = getActivePdfObject();
        if (!pdfObject || !pdfServiceReport?.output || pdfServiceReport.output.contentType !== "application/pdf") {
            toast.error("Der er ikke et PDF-resultat at bruge");
            return;
        }

        setPdfServiceRunning(true);
        try {
            const outputBytes = await downloadDesignerPdfServiceOutput(pdfServiceReport);
            const currentPageIndex = Math.max(0, Math.min(
                Number((pdfObject as any).data?.pageIndex) || 0,
                Math.max(0, (pdfServiceReport.pageCount || 1) - 1),
            ));
            const importData = await renderPdfPageToImportData(
                outputBytes.slice(0),
                currentPageIndex,
                pdfServiceReport.output.fileName,
            );
            handlePDFImport(importData, getPdfReplacementPlacement(pdfObject));
            toast.success("Den behandlede PDF bruges nu i designet");
        } catch (error) {
            console.error("[Designer] Could not apply processed PDF:", error);
            toast.error(error instanceof Error ? error.message : "Resultatet kunne ikke bruges i designet");
        } finally {
            setPdfServiceRunning(false);
        }
    }, [getActivePdfObject, getPdfReplacementPlacement, handlePDFImport, pdfServiceReport, renderPdfPageToImportData]);

    const handleDownloadPdfServiceOutput = useCallback(async () => {
        if (!pdfServiceReport?.output) {
            toast.error("Der er ikke et resultat at hente");
            return;
        }

        setPdfServiceRunning(true);
        try {
            const bytes = await downloadDesignerPdfServiceOutput(pdfServiceReport);
            const blob = new Blob([bytes], { type: pdfServiceReport.output.contentType });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = pdfServiceReport.output.fileName;
            anchor.click();
            setTimeout(() => URL.revokeObjectURL(url), 1_000);
        } catch (error) {
            console.error("[Designer] Could not download processed PDF:", error);
            toast.error(error instanceof Error ? error.message : "Resultatet kunne ikke hentes");
        } finally {
            setPdfServiceRunning(false);
        }
    }, [pdfServiceReport]);

    const handlePDFImportFromModal = useCallback((data: PDFImportData) => {
        const replaceTarget = pdfImportModeRef.current === 'replace-selected'
            ? pdfReplaceTargetRef.current
            : null;

        if (replaceTarget) {
            handlePDFImport(data, getPdfReplacementPlacement(replaceTarget));
        } else {
            handlePDFImport(data);
        }

        resetPdfImportMode();
    }, [getPdfReplacementPlacement, handlePDFImport, resetPdfImportMode]);

    const handlePDFImportOpenChange = useCallback((open: boolean) => {
        setShowPDFImport(open);
        if (!open) resetPdfImportMode();
    }, [resetPdfImportMode]);

    const handleOpenVectorExportFromPanel = useCallback(() => {
        setIsExportDialogOpen(true);
    }, []);

    // Preflight actions
    const handleDismissWarning = useCallback((id: string) => {
        setDismissedWarnings(prev => new Set([...prev, id]));
    }, []);

    const handleAcceptAllWarnings = useCallback(() => {
        const allIds = [...preflightWarnings, ...preflightInfos].map(w => w.id);
        setDismissedWarnings(new Set(allIds));
    }, [preflightWarnings, preflightInfos]);

    const handleHighlightObject = useCallback((objectId: string) => {
        editorRef.current?.selectLayer(objectId);
        setActiveTab('properties');
    }, []);

    // Tools
    const tools = [
        { id: "select", icon: MousePointer2, label: "Vælg (V)" },
        { id: "text", icon: Type, label: "Tilføj tekst (T)" },
        { id: "image", icon: ImageIcon, label: "Tilføj billede (I)" },
        { id: "pdf", icon: FileUp, label: "Tilføj PDF (P)" },
        { id: "rectangle", icon: Square, label: "Rektangel (R)" },
        { id: "circle", icon: Circle, label: "Cirkel (C)" },
        { id: "line", icon: Minus, label: "Linje (L)" },
        { id: "guide-h", icon: GripHorizontal, label: "Horisontal guide (G) - Fold/beskæring" },
        { id: "guide-v", icon: GripVertical, label: "Vertikal guide (Shift+G) - Fold/beskæring" },
    ];

    // Total warnings count
    const hasVectorPdfBase = useMemo(
        () => layers.some((layer) => (layer.object as any).data?.kind === "pdf_page_background" && (layer.object as any).data?.originalPdfBytes),
        [layers]
    );
    const hasPdfTemplateOverlay = useMemo(
        () => layers.some((layer) => Boolean((layer.object as any).__isPdfTemplate)),
        [layers]
    );
    const hasCutContourOnCanvas = useMemo(
        () => layers.some((layer) => Boolean((layer.object as any).__isCutContour)),
        [layers]
    );
    const detectedPdfCutContour = useMemo(() => {
        const pdfLayer = layers.find((layer) => (layer.object as any).data?.kind === "pdf_page_background" && (layer.object as any).data?.originalPdfBytes);
        const pdfBytes = pdfLayer ? ((pdfLayer.object as any).data?.originalPdfBytes as ArrayBuffer | undefined) : undefined;
        if (!pdfBytes) return null;

        const rawPdf = new TextDecoder().decode(new Uint8Array(pdfBytes));
        return {
            cutContourNameDetected: /(?:\/|\()CutContour\b/i.test(rawPdf) || /\bCutContour\b/i.test(rawPdf),
            separationHintDetected: /\/Separation\s*\/CutContour\b/i.test(rawPdf)
                || /\/DeviceN\s*\[[^\]]*\/CutContour\b/i.test(rawPdf),
            overprintHintDetected: /\/OP\s+true\b/i.test(rawPdf)
                || /\/op\s+true\b/i.test(rawPdf)
                || /\/OPM\s+[12]\b/i.test(rawPdf),
        };
    }, [layers]);
    const designerReadinessInfos = useMemo<PreflightWarning[]>(() => {
        const infos: PreflightWarning[] = [];

        if (hasPdfTemplateOverlay) {
            infos.push({
                id: "designer-pdf-template-non-printing",
                type: "info",
                code: "PDF_TEMPLATE_NON_PRINTING",
                message: "PDF-skabelon er ikke-printbar",
                details: "Skabelonen vises over designet som hjælp til fold, ryg, beskæring og sikkerhedszone, men skjules automatisk ved print/proof eksport.",
                canIgnore: false,
            });
        }

        if (hasVectorPdfBase) {
            infos.push({
                id: "designer-vector-pdf-ready",
                type: "info",
                code: "VECTOR_PDF_READY",
                message: "PDF-base er klar til vektor eksport",
                details: "Den importerede PDF bevares som vektor i Vektor PDF-eksport. Live canvas-previewet vises stadig som renderet billede under redigering.",
                canIgnore: false,
            });
        }

        if (pdfServiceReport) {
            infos.push({
                id: "designer-pdf-service-report",
                type: pdfServiceReport.status === "error" ? "warning" : "info",
                code: "PDF_SERVICE_REPORT",
                message: pdfServiceReport.status === "ok"
                    ? "PDF-service scan er gennemført"
                    : "PDF-service scan kræver opmærksomhed",
                details: [
                    `${pdfServiceReport.runtime} scan`,
                    typeof pdfServiceReport.pageCount === "number" ? `${pdfServiceReport.pageCount} sider` : null,
                    pdfServiceReport.warnings[0] || pdfServiceReport.errors[0] || null,
                ].filter(Boolean).join(" · "),
                canIgnore: pdfServiceReport.status !== "error",
            });
        }

        if (detectedPdfCutContour?.cutContourNameDetected) {
            infos.push({
                id: "designer-cut-contour-pdf-detected",
                type: "info",
                code: "CUT_CONTOUR_FOUND_IN_PDF",
                message: "CutContour fundet i PDF-basen",
                details: `PDF-scannen fandt CutContour${detectedPdfCutContour.separationHintDetected ? ", spotfarve/separation" : ""}${detectedPdfCutContour.overprintHintDetected ? " og overprint" : ""}. Du behøver ikke oprette en ny contour i designeren, hvis denne PDF skal bevares som vector ved eksport.`,
                canIgnore: false,
            });
        } else if (hasVectorPdfBase && hasCutContourOnCanvas) {
            infos.push({
                id: "designer-cut-contour-ready",
                type: "info",
                code: "CUT_CONTOUR_READY",
                message: "CutContour er tilføjet",
                details: "Lærredet indeholder en CutContour. Brug Vektor PDF-eksport når du vil bevare PDF-basen skarpt.",
                canIgnore: false,
            });
        } else if (hasVectorPdfBase) {
            infos.push({
                id: "designer-cut-contour-missing",
                type: "info",
                code: "CUT_CONTOUR_MISSING",
                message: "CutContour mangler",
                details: "Hvis produktet kræver konturskæring, skal du importere eller oprette en CutContour i designeren før eksport.",
                canIgnore: false,
            });
        }

        return infos;
    }, [hasPdfTemplateOverlay, hasVectorPdfBase, hasCutContourOnCanvas, detectedPdfCutContour, pdfServiceReport]);
    const combinedPreflightInfos = useMemo(
        () => [...preflightInfos, ...designerReadinessInfos],
        [preflightInfos, designerReadinessInfos]
    );
    const totalWarningsCount = preflightErrors.length + preflightWarnings.length - dismissedWarnings.size;

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            // Ignore if meta, ctrl, or alt keys are pressed for single-letter shortcuts
            const hasModifier = e.metaKey || e.ctrlKey || e.altKey;

            switch (e.key.toLowerCase()) {
                case 'v': if (!hasModifier) setSelectedTool('select'); break;
                case 't': if (!hasModifier) handleToolClick('text'); break;
                case 'i': if (!hasModifier) handleToolClick('image'); break;
                case 'p': if (!hasModifier) handleToolClick('pdf'); break;
                case 'r': if (!hasModifier) handleToolClick('rectangle'); break;
                case 'c':
                    if (!hasModifier) {
                        handleToolClick('circle');
                    }
                    // If meta/ctrl is pressed, we let the browser handle the standard Copy action
                    break;
                case 'l': if (!hasModifier) handleToolClick('line'); break;
                case 'g':
                    if (!hasModifier) {
                        if (e.shiftKey) {
                            handleToolClick('guide-v');
                        } else {
                            handleToolClick('guide-h');
                        }
                    }
                    break;
                case 'delete':
                case 'backspace':
                    if (hasSelection) editorRef.current?.deleteSelected();
                    break;
                case 'z':
                    if (e.metaKey || e.ctrlKey) {
                        if (e.shiftKey) editorRef.current?.redo();
                        else editorRef.current?.undo();
                        e.preventDefault();
                    }
                    break;
                case 's':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        handleSave();
                    }
                    break;
                case 'd':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        if (hasSelection) editorRef.current?.duplicateSelected();
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleToolClick, hasSelection]);

    // Global drag and drop for PDF files
    const handleGlobalDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;

        // Check if dragging files (not internal drag)
        if (e.dataTransfer.types.includes('Files')) {
            setIsDraggingFile(true);
        }
    }, []);

    const handleGlobalDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleGlobalDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;

        if (dragCounterRef.current === 0) {
            setIsDraggingFile(false);
        }
    }, []);

    const handleGlobalDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(false);
        dragCounterRef.current = 0;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                (window as any).__pendingPdfFile = file;
                openPdfImportForAdd();
            }
        }
    }, [openPdfImportForAdd]);

    // Prevent browser default drag behavior on window
    useEffect(() => {
        window.addEventListener('dragover', (e) => e.preventDefault());
        window.addEventListener('drop', (e) => e.preventDefault());
        return () => {
            window.removeEventListener('dragover', (e) => e.preventDefault());
            window.removeEventListener('drop', (e) => e.preventDefault());
        };
    }, []);



    // Use auto-sizing for the canvas style, but let EditorCanvas control internal resolution
    // const canvasWidth = docWidth + (PASTEBOARD_PADDING * 2);
    // const canvasHeight = docHeight + (PASTEBOARD_PADDING * 2);


    // Landing page for showcasing the designer
    if (showLanding) {
        return (
            <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
                <SEO title="Print Designer - Webprinter" />

                {/* Header */}
                <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
                    <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Tilbage
                        </Button>
                        <Button onClick={() => navigate('/designer?format=A4')}>
                            Åbn Print Designer
                        </Button>
                    </div>
                </header>

                {/* Hero Section */}
                <section className="py-20 px-6">
                    <div className="max-w-4xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                            <Palette className="h-4 w-4" />
                            Professionelt Designværktøj
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                            Skab trykkeklare designs
                            <br />
                            <span className="text-primary">direkte i browseren</span>
                        </h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                            Vores professionelle designværktøj giver dig fuld kontrol over dit artwork
                            med CMYK-farver, bleed-områder og høj opløsning – alt sammen uden at installere
                            noget software.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button size="lg" onClick={() => navigate('/designer?format=A4')} className="gap-2">
                                <MousePointer2 className="h-5 w-5" />
                                Start Print Designer
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mt-4">
                            <span className="text-green-600 font-medium">✓ Inkluderet gratis</span> på denne konto
                        </p>
                    </div>
                </section>

                {/* Feature Image Placeholder */}
                <section className="px-6 pb-16">
                    <div className="max-w-5xl mx-auto">
                        <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center">
                            <div className="text-center text-muted-foreground">
                                <ImageIcon className="h-16 w-16 mx-auto mb-4 opacity-30" />
                                <p className="text-lg font-medium">Designer preview billede</p>
                                <p className="text-sm">Tilføj et screenshot af designeren her</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features Grid */}
                <section className="py-20 px-6 bg-white border-t">
                    <div className="max-w-6xl mx-auto">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-bold text-gray-900 mb-4">Alt hvad du har brug for</h2>
                            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                                Print Designer er fyldt med professionelle funktioner der gør det nemt at skabe
                                trykkeklare designs.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {/* Feature 1 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                                    <Square className="h-6 w-6 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Professionelt Canvas</h3>
                                <p className="text-muted-foreground text-sm">
                                    Lag-baseret editor med bleed, trim og sikkerhedszoner.
                                    Præcis placering af alle elementer.
                                </p>
                            </div>

                            {/* Feature 2 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                                    <FileUp className="h-6 w-6 text-green-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">PDF Import</h3>
                                <p className="text-muted-foreground text-sm">
                                    Upload eksisterende PDF-filer og brug dem som udgangspunkt.
                                    Vælg enkeltside fra flersidede dokumenter.
                                </p>
                            </div>

                            {/* Feature 3 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center mb-4">
                                    <AlertTriangle className="h-6 w-6 text-amber-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Preflight Tjek</h3>
                                <p className="text-muted-foreground text-sm">
                                    Automatisk validering af opløsning, tekststørrelse og marginer.
                                    Få advarsler før du bestiller.
                                </p>
                            </div>

                            {/* Feature 4 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                                    <Palette className="h-6 w-6 text-purple-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">CMYK Soft Proofing</h3>
                                <p className="text-muted-foreground text-sm">
                                    Se hvordan dine farver vil se ud på tryk med vores ICC-baserede
                                    farvekonvertering og gamut-advarsel.
                                </p>
                            </div>

                            {/* Feature 5 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-red-100 flex items-center justify-center mb-4">
                                    <Type className="h-6 w-6 text-red-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Tekst & Typografi</h3>
                                <p className="text-muted-foreground text-sm">
                                    Bred vifte af fonte med fuld kontrol over størrelse, farve,
                                    linjeafstand og tekstformatering.
                                </p>
                            </div>

                            {/* Feature 6 */}
                            <div className="bg-slate-50 rounded-xl p-6 border">
                                <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-4">
                                    <Download className="h-6 w-6 text-indigo-600" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">Print-klar Eksport</h3>
                                <p className="text-muted-foreground text-sm">
                                    Eksporter dit design som højopløselig PDF klar til professionelt tryk
                                    med korrekte farver.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA Section */}
                <section className="py-20 px-6 bg-gradient-to-r from-primary/5 to-primary/10 border-t">
                    <div className="max-w-4xl mx-auto text-center">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">Klar til at komme i gang?</h2>
                        <p className="text-lg text-muted-foreground mb-8">
                            Start med at designe dit første trykkeklare artwork i dag.
                        </p>
                        <Button size="lg" onClick={() => navigate('/designer?format=A4')} className="gap-2">
                            <MousePointer2 className="h-5 w-5" />
                            Åbn Print Designer
                        </Button>
                    </div>
                </section>

                {/* Footer */}
                <Footer />
            </div>
        );
    }

    return (
        <div
            className="flex h-screen flex-col"
            onDragEnter={handleGlobalDragEnter}
            onDragOver={handleGlobalDragOver}
            onDragLeave={handleGlobalDragLeave}
            onDrop={handleGlobalDrop}
        >
            <SEO title={documentSpec.name || "Design Editor"} />

            {/* Subheader / Toolbar */}
            <div className="h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleBackClick}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Tilbage
                    </Button>
                    <div className="h-4 w-px bg-border mx-2" />
                    <div>
                        <h1 className="text-lg font-semibold">{documentSpec.name}</h1>
                        <div className="flex items-center gap-2 text-base text-muted-foreground pt-0.5">
                            <span>{documentSpec.width_mm}x{documentSpec.height_mm}mm</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-border" />
                            <span>{documentSpec.bleed_mm}mm bleed</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-border" />
                            <span>{documentSpec.safe_area_mm ?? 3}mm safe zone</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-border" />
                            <span>{documentSpec.dpi} DPI</span>
                            <span className="w-0.5 h-0.5 rounded-full bg-border" />
                            <span>{documentSpec.color_profile}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {hasChanges ? (
                        <span className="text-base text-amber-600 flex items-center gap-1.5 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Ugemte ændringer
                        </span>
                    ) : (
                        <span className="text-base text-muted-foreground flex items-center gap-1.5 px-2 py-1">
                            <FileCheck className="h-3.5 w-3.5" />
                            Gemt
                        </span>
                    )}

                    {orderMode && (productFlowLabel || designerMode || pricingModel) && (
                        <span className="hidden items-center gap-1 rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-xs text-primary md:flex">
                            <FileText className="h-3.5 w-3.5" />
                            {[productFlowLabel, designerMode, pricingModel].filter(Boolean).join(" / ")}
                        </span>
                    )}

                    <div className="h-4 w-px bg-border mx-2" />

                    {!orderMode && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsLibraryOpen(true)}
                            title="Åbn Templates"
                        >
                            <LayoutGrid className="h-4 w-4 mr-2" />
                            Templates
                        </Button>
                    )}

                    <Button variant="outline" size="sm" onClick={() => setIsExportDialogOpen(true)} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                        Eksportér
                    </Button>

                    {orderMode ? (
                        <Button onClick={handleReturnToOrder} className="bg-green-600 text-white hover:bg-green-700" disabled={returningToOrder}>
                            {returningToOrder ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <ShoppingCart className="h-4 w-4 mr-2" />
                            )}
                            {returningToOrder ? "Forbereder produktionsfil..." : "Tilbage til bestilling"}
                        </Button>
                    ) : (
                        <Button onClick={() => handleSave()} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                            Gem design
                        </Button>
                    )}
                </div>
            </div>

            {orderMode && (
                <div className={`border-b px-4 py-3 ${designerOrderFlowNotice.toneClassName}`}>
                    <div className="mx-auto flex max-w-7xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold">{designerOrderFlowNotice.title}</p>
                                <p className="text-xs leading-5 opacity-80">{designerOrderFlowNotice.body}</p>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-xs opacity-80">
                            <FileCheck className="h-3.5 w-3.5" />
                            <span>{designerOrderFlowNotice.detail}</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden">
                {/* PDF Import Modal */}
                <PDFImportModal
                    open={showPDFImport}
                    onOpenChange={handlePDFImportOpenChange}
                    onImport={handlePDFImportFromModal}
                    onImportAsTemplate={handlePDFImportAsTemplate}
                    initialSource={pdfImportInitialSource}
                    allowedWidthMm={documentSpec.width_mm}
                    allowedHeightMm={documentSpec.height_mm}
                />

                {/* Library Drawer */}
                <DesignLibraryDrawer
                    open={isLibraryOpen}
                    onOpenChange={setIsLibraryOpen}
                    onReplaceDesign={handleReplaceDesign}
                    onInsertDesign={handleInsertDesign}
                />

                {/* Export Dialog */}
                <ExportDialog
                    open={isExportDialogOpen}
                    onOpenChange={setIsExportDialogOpen}
                    onExport={handleExportWithDialog}
                    isExporting={saving}
                    hasBleed={(documentSpec.bleed_mm || 0) > 0}
                    pdfSourceMeta={null}
                    hasChanges={hasChanges}
                    hasPdfBackground={(() => {
                        if (!fabricCanvas) return false;
                        return fabricCanvas.getObjects().some((obj: any) =>
                            obj.data?.kind === 'pdf_page_background' && obj.data?.originalPdfBytes
                        );
                    })()}
                />

                {/* Left Toolbar */}
                <aside className="w-16 flex flex-col items-center py-4 border-r bg-background z-10">
                    <div className="flex flex-col gap-2">
                        {tools.map((tool) => (
                            <Button
                                key={tool.id}
                                variant={selectedTool === tool.id ? "default" : "ghost"}
                                size="icon"
                                className="h-10 w-10 relative group"
                                onClick={() => handleToolClick(tool.id)}
                                title={tool.label}
                            >
                                <tool.icon className="h-5 w-5" />
                                <span className="absolute left-12 bg-popover text-popover-foreground px-2 py-1 rounded text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                                    {tool.label}
                                </span>
                            </Button>
                        ))}
                    </div>

                    <div className="flex-1" />
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                    />
                    <input
                        type="file"
                        ref={cutContourInputRef}
                        className="hidden"
                        accept=".svg,image/svg+xml"
                        onChange={handleCutContourUpload}
                    />

                    {/* CutContour Import Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        title={hasSelection ? "Opret CutContour fra valgt vektor" : "Import CutContour (SVG)"}
                        className="h-10 w-10"
                        onClick={handleCutContourAction}
                    >
                        <Scissors className="h-5 w-5" />
                    </Button>

                    <div className="flex flex-col gap-2 mb-2">
                        {/* Undo */}
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Fortryd (Ctrl+Z)"
                            className="h-10 w-10"
                            onClick={() => editorRef.current?.undo()}
                        >
                            <Undo2 className="h-5 w-5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Gentag (Ctrl+Shift+Z)"
                            className="h-10 w-10"
                            onClick={() => editorRef.current?.redo()}
                        >
                            <Redo2 className="h-5 w-5" />
                        </Button>

                        <div className="h-px bg-border w-8 mx-auto my-1" />

                        {/* Duplicate/Copy */}
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Kopier valgte (Ctrl+D)"
                            className="h-10 w-10"
                            onClick={() => editorRef.current?.duplicateSelected()}
                            disabled={!hasSelection}
                        >
                            <Copy className="h-5 w-5" />
                        </Button>

                        {/* Delete */}
                        <Button
                            variant="ghost"
                            size="icon"
                            title="Slet valgte (Delete)"
                            className="h-10 w-10 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={() => editorRef.current?.deleteSelected()}
                            disabled={!hasSelection}
                        >
                            <Trash2 className="h-5 w-5" />
                        </Button>
                    </div>
                </aside>

                {/* Canvas Area */}
                <main
                    ref={canvasAreaRef}
                    className="flex-1 overflow-auto bg-[#e5e5e5] relative flex items-center justify-center p-20"
                >
                    {/* Wrapper for canvas and overlays - provides positioning context */}
                    <div
                        className="relative"
                        style={{
                            width: viewportWidth,
                            height: viewportHeight
                        }}
                    >
                        {apparelConfig && (
                            <ApparelMockupArtboard
                                config={apparelConfig}
                                viewportWidth={viewportWidth}
                                viewportHeight={viewportHeight}
                                mockupWidth={apparelPreviewWidth * effectiveScale}
                                mockupHeight={apparelPreviewHeight * effectiveScale}
                            />
                        )}

                        <EditorCanvas
                            ref={editorRef}
                            width={documentSpec.width_mm}
                            height={documentSpec.height_mm}
                            bleed={documentSpec.bleed_mm}
                            dpi={documentSpec.dpi}
                            displayDpi={displayDpi}
                            controlScale={controlScale}
                            safeArea={documentSpec.safe_area_mm}
                            viewportWidth={viewportWidth}
                            viewportHeight={viewportHeight}
                            viewportScale={effectiveScale}
                            viewportOffsetXAdjustment={apparelDocumentOffsetX}
                            viewportOffsetYAdjustment={apparelDocumentOffsetY}
                            pasteboardColor={apparelConfig ? 'transparent' : undefined}
                            showPasteboardMasks={!apparelConfig}
                            showDocumentGuideOverlay={Boolean(apparelConfig)}
                            documentBackgroundFill={apparelConfig ? 'transparent' : undefined}
                            documentBackgroundStroke={apparelConfig ? 'transparent' : undefined}
                            selectedTool={selectedTool}
                            onSelectionChange={handleSelectionChange}
                            onCanvasChange={() => {
                                if (apparelSideChangeRef.current) return;
                                setHasChanges(true);
                                // Debounce auto-preflight
                                if (autoPreflightTimerRef.current) clearTimeout(autoPreflightTimerRef.current);
                                autoPreflightTimerRef.current = setTimeout(() => {
                                    runPreflight();
                                }, 500);
                            }}
                            onLayersChange={handleLayersChange}
                        />

                        {/* Soft proofing overlay - positioned over document area only */}
                        {/* PROTECTED - See .agent/workflows/soft-proof-protected.md */}
                        {colorProofing.settings.enabled && (
                            <canvas
                                ref={proofingOverlayRef}
                                className="absolute pointer-events-none"
                                style={{
                                    left: viewportOffsetX + pasteboardPaddingPx * effectiveScale,
                                    top: viewportOffsetY + pasteboardPaddingPx * effectiveScale,
                                    width: docWidth * effectiveScale,
                                    height: docHeight * effectiveScale,
                                    mixBlendMode: 'normal',
                                    zIndex: 10,  // Below guide lines (z-index 20+) but above Fabric canvas
                                }}
                            />
                        )}

                        {/* Live Dimensions Label - inside wrapper for correct positioning */}
                        {hasSelection && selectedProps?.boundingRect && (
                            <div
                                className="absolute pointer-events-none bg-black/80 text-white text-sm font-medium px-3 py-1.5 rounded shadow-lg flex items-center gap-2 z-[60] backdrop-blur-sm"
                                style={{
                                    left: selectedProps.boundingRect.left + selectedProps.boundingRect.width / 2,
                                    top: selectedProps.boundingRect.top + selectedProps.boundingRect.height + 10,
                                    transform: `translateX(-50%) scale(${labelScale})`,
                                    transformOrigin: 'top center'
                                }}
                            >
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-400">B:</span>
                                    <span>{((selectedProps.boundingRect.width) / (displayMmToPx * effectiveScale)).toFixed(1)} mm</span>
                                </div>
                                <div className="w-px h-2 bg-white/20" />
                                <div className="flex items-center gap-1">
                                    <span className="text-gray-400">H:</span>
                                    <span>{((selectedProps.boundingRect.height) / (displayMmToPx * effectiveScale)).toFixed(1)} mm</span>
                                </div>
                            </div>
                        )}
                    </div>
                    {colorProofing.settings.enabled && (
                        <div className="absolute top-2 left-2 bg-purple-600 text-white text-xs px-2 py-1 rounded shadow-lg flex items-center gap-1">
                            <Palette className="h-3 w-3" />
                            CMYK Preview
                            {colorProofing.isProcessing && <Loader2 className="h-3 w-3 animate-spin" />}
                        </div>
                    )}
                    <div className="absolute bottom-4 left-4 z-30">
                        <div className="flex items-center gap-2 rounded-full border bg-white/90 px-3 py-2 shadow-sm backdrop-blur">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateZoom(zoomScale - ZOOM_STEP)}
                                title="Zoom ud"
                            >
                                <ZoomOut className="h-4 w-4" />
                            </Button>
                            <div className="w-28">
                                <Slider
                                    min={ZOOM_MIN}
                                    max={ZOOM_MAX}
                                    step={ZOOM_STEP}
                                    value={[zoomScale]}
                                    onValueChange={(value) => updateZoom(value[0] ?? 1)}
                                />
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => updateZoom(zoomScale + ZOOM_STEP)}
                                title="Zoom ind"
                            >
                                <ZoomIn className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => updateZoom(1)}
                                title="Tilpas visning"
                            >
                                {zoomPercent}%
                            </Button>
                        </div>
                    </div>
                </main>

                {/* Right inspector */}
                <aside className="flex shrink-0 bg-background" aria-label="Designerens sidepanel">
                    {isRightPanelOpen && activeRightPanel && (
                        <section
                            id={`designer-panel-${activeRightPanel.id}`}
                            className="flex w-80 flex-col border-l"
                            aria-label={`${activeRightPanel.label}-panel`}
                        >
                            <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
                                <activeRightPanel.Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                                    {activeRightPanel.label}
                                </h2>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9"
                                    onClick={() => setIsRightPanelOpen(false)}
                                    aria-label={`Skjul ${activeRightPanel.label}`}
                                    title={`Skjul ${activeRightPanel.label}`}
                                >
                                    <PanelRightClose className="h-4 w-4" />
                                </Button>
                            </header>

                            <div className="min-h-0 flex-1 overflow-y-auto">
                                {activeTab === 'layers' && (
                                    <LayerPanel
                                        layers={layers}
                                        selectedLayerId={selectedLayerId}
                                        onSelectLayer={handleSelectLayer}
                                        onMoveUp={(id) => editorRef.current?.moveLayerUp(id)}
                                        onMoveDown={(id) => editorRef.current?.moveLayerDown(id)}
                                        onToggleVisibility={(id) => editorRef.current?.toggleLayerVisibility(id)}
                                    />
                                )}
                                {activeTab === 'properties' && (
                                    <PropertiesPanel
                                        selectedObject={selectedProps}
                                        onUpdateProps={handleUpdateProps}
                                        onBringToFront={() => editorRef.current?.bringToFront()}
                                        onSendToBack={() => editorRef.current?.sendToBack()}
                                    />
                                )}
                                {activeTab === 'apparel' && apparelConfig && (
                                    <ApparelDesignerPanel
                                        config={apparelConfig}
                                        onSideChange={handleApparelSideChange}
                                        onColorChange={handleApparelColorChange}
                                    />
                                )}
                                {activeTab === 'pdf' && (
                                    <PdfToolsPanel
                                        pdfMeta={selectedPdfMeta}
                                        pdfServiceReport={pdfServiceReport}
                                        pdfServiceRunning={pdfServiceRunning}
                                        preflightIssueCount={Math.max(0, preflightErrors.length + preflightWarnings.length)}
                                        onFitToDocument={handleFitSelectedPdfToDocument}
                                        onCenterOnDocument={handleCenterSelectedPdf}
                                        onImportNewPdf={handleImportNewPdfFromPanel}
                                        onEditPdf={handleEditSelectedPdfFromPanel}
                                        onChangePage={handleChangeSelectedPdfPage}
                                        onRunPdfServiceScan={handleRunSelectedPdfServiceScan}
                                        onRunPdfServiceOperation={handleRunSelectedPdfServiceOperation}
                                        onApplyPdfServiceOutput={handleApplyPdfServiceOutput}
                                        onDownloadPdfServiceOutput={handleDownloadPdfServiceOutput}
                                        onExtractCutContour={handleCutContourAction}
                                        onOpenExport={handleOpenVectorExportFromPanel}
                                        onOpenPreflight={() => setActiveTab('preflight')}
                                    />
                                )}
                                {activeTab === 'preflight' && (
                                    <PreflightPanel
                                        warnings={preflightWarnings}
                                        errors={preflightErrors}
                                        infos={combinedPreflightInfos}
                                        onAcceptAll={handleAcceptAllWarnings}
                                        onHighlightObject={handleHighlightObject}
                                        onDismiss={handleDismissWarning}
                                        dismissed={dismissedWarnings}
                                    />
                                )}
                                {activeTab === 'proofing' && (
                                    <ColorProofingPanel
                                        settings={colorProofing.settings}
                                        isReady={true}
                                        isProcessing={colorProofing.isProcessing}
                                        error={colorProofing.error}
                                        onSetEnabled={colorProofing.setEnabled}
                                        onSetOutputProfile={colorProofing.setOutputProfile}
                                        onSetShowGamutWarning={colorProofing.setShowGamutWarning}
                                        hasCustomProfile={colorProofing.hasCustomProfile}
                                        productProfileId={productProfile.id || undefined}
                                        productProfileName={productProfile.name || undefined}
                                    />
                                )}
                            </div>
                        </section>
                    )}

                    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-l py-2" aria-label="Designerpaneler">
                        {rightPanelTabs.map(({ id, label, Icon }) => {
                            const isActive = activeTab === id;
                            const isExpanded = isActive && isRightPanelOpen;
                            const badgeCount = id === 'preflight' ? totalWarningsCount : 0;

                            return (
                                <button
                                    key={id}
                                    type="button"
                                    className={cn(
                                        "relative flex h-11 w-11 items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                        isExpanded
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                    )}
                                    onClick={() => handleRightPanelTabClick(id)}
                                    aria-label={`${label}${isExpanded ? ', åben' : ', lukket'}`}
                                    aria-expanded={isExpanded}
                                    aria-controls={`designer-panel-${id}`}
                                    title={isExpanded ? `${label} (skjul)` : `${label} (åbn)`}
                                >
                                    <Icon className="h-5 w-5" aria-hidden="true" />
                                    {badgeCount > 0 && (
                                        <span className="absolute right-0 top-0 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                                            {badgeCount}
                                        </span>
                                    )}
                                    {id === 'proofing' && colorProofing.settings.enabled && (
                                        <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-fuchsia-500 ring-2 ring-background" />
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </aside>
            </div>

            {/* Unsaved Changes Dialog */}
            <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Du har ændringer, der ikke er gemt</AlertDialogTitle>
                        <AlertDialogDescription>
                            Hvis du forlader siden nu, kan dine ændringer gå tabt.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                        <AlertDialogCancel onClick={() => setShowUnsavedDialog(false)}>
                            Bliv her
                        </AlertDialogCancel>
                        <Button
                            variant="outline"
                            onClick={handleDiscardAndLeave}
                            className="text-destructive hover:text-destructive"
                        >
                            Forlad uden at gemme
                        </Button>
                        <AlertDialogAction
                            onClick={handleSaveAndLeave}
                            disabled={isSavingAndLeaving}
                        >
                            {isSavingAndLeaving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Gemmer...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Gem og gå tilbage
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Save Design Dialog - for naming new designs */}
            <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Save className="h-5 w-5 text-primary" />
                            Gem dit design
                        </DialogTitle>
                        <DialogDescription>
                            Giv dit design et navn, så du nemt kan finde det igen i Design Biblioteket.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="design-name">Design navn</Label>
                            <Input
                                id="design-name"
                                value={saveDesignName}
                                onChange={(e) => setSaveDesignName(e.target.value)}
                                placeholder="F.eks. Visitkort til firma"
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSaveDialogConfirm();
                                    }
                                }}
                            />
                        </div>
                        <div className="text-lg text-muted-foreground bg-muted/50 p-3 rounded-lg">
                            <p className="font-semibold mb-1">Format:</p>
                            <p>{documentSpec.width_mm}×{documentSpec.height_mm}mm • {documentSpec.bleed_mm}mm bleed • {documentSpec.safe_area_mm ?? 3}mm safe zone</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                            Annuller
                        </Button>
                        <Button onClick={handleSaveDialogConfirm} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Gemmer...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Gem design
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Replace Design Confirm Dialog */}
            <AlertDialog open={showReplaceConfirmDialog} onOpenChange={setShowReplaceConfirmDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Erstat nuværende design?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Du har ændringer, der ikke er gemt. Hvis du erstatter designet, vil dine nuværende ændringer gå tabt.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setShowReplaceConfirmDialog(false);
                            setPendingReplaceItem(null);
                        }}>
                            Annuller
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmReplace}>
                            Erstat design
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default Designer;
