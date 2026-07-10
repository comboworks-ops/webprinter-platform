import { supabase } from "@/integrations/supabase/client";

export type DesignerPdfServiceStatus = "ok" | "warning" | "error";
export type DesignerPdfServiceRuntime = "browser" | "edge";
export type DesignerPdfServiceOperation =
    | "inspect"
    | "preflight"
    | "compress"
    | "ocr"
    | "repair"
    | "pdfa"
    | "redact"
    | "flatten-forms"
    | "text-edit-export"
    | "text-edit-import";

export interface DesignerPdfServiceOptions {
    compressionLevel?: number;
    languages?: string[];
    ocrType?: "skip-text" | "force-ocr" | "Normal";
    redactTerms?: string[];
    redactUseRegex?: boolean;
    redactWholeWords?: boolean;
    redactColor?: string;
    redactPadding?: number;
    pdfaFormat?: "pdfa" | "pdfa-1" | "pdfa-2" | "pdfa-2b" | "pdfa-3" | "pdfa-3b";
    pdfaStrict?: boolean;
    textEditorLightweight?: boolean;
}

export interface DesignerPdfServiceExpectedSpec {
    widthMm?: number;
    heightMm?: number;
    bleedMm?: number;
}

export interface DesignerPdfServiceReport {
    status: DesignerPdfServiceStatus;
    runtime: DesignerPdfServiceRuntime;
    operation: DesignerPdfServiceOperation;
    provider?: "native" | "stirling-pdf";
    fileName?: string;
    byteLength?: number;
    pageCount?: number;
    firstPage?: {
        widthMm: number;
        heightMm: number;
    } | null;
    expected?: DesignerPdfServiceExpectedSpec | null;
    warnings: string[];
    errors: string[];
    capabilities: Record<string, string>;
    output?: {
        bucket: string;
        storagePath: string;
        signedUrl: string;
        signedUrlExpiresIn: number;
        fileName: string;
        byteLength: number;
        contentType: "application/pdf" | "application/json";
        preservesVectors: boolean;
        rasterizes: boolean;
        immutable: boolean;
    } | null;
}

export interface DesignerPdfServiceRequest {
    bytes?: ArrayBuffer;
    pdfUrl?: string;
    storageBucket?: string;
    storagePath?: string;
    fileName?: string;
    operation?: DesignerPdfServiceOperation;
    options?: DesignerPdfServiceOptions;
    expected?: DesignerPdfServiceExpectedSpec;
    runtime?: DesignerPdfServiceRuntime;
}

const roundMm = (value: number) => Math.round(value * 10) / 10;

const safeFileName = (fileName?: string) =>
    (fileName || "designer.pdf").replace(/[^a-z0-9_.-]+/gi, "-").slice(0, 100) || "designer.pdf";

export async function inspectPdfInBrowser(request: DesignerPdfServiceRequest): Promise<DesignerPdfServiceReport> {
    if (!request.bytes) {
        return {
            status: "error",
            runtime: "browser",
            operation: request.operation || "inspect",
            fileName: request.fileName,
            expected: request.expected || null,
            warnings: [],
            errors: ["PDF-kilden mangler i browseren."],
            capabilities: {},
        };
    }

    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(request.bytes.slice(0), { ignoreEncryption: true });
    const pages = pdf.getPages();
    const firstPage = pages[0];
    const firstPageSize = firstPage?.getSize();
    const firstPageWidthMm = firstPageSize ? (firstPageSize.width / 72) * 25.4 : null;
    const firstPageHeightMm = firstPageSize ? (firstPageSize.height / 72) * 25.4 : null;
    const warnings: string[] = [];
    const errors: string[] = [];
    const expectedWidthMm = request.expected?.widthMm;
    const expectedHeightMm = request.expected?.heightMm;

    if (pages.length === 0) {
        errors.push("PDF'en har ingen sider.");
    }

    if (
        typeof expectedWidthMm === "number" &&
        typeof expectedHeightMm === "number" &&
        firstPageWidthMm &&
        firstPageHeightMm
    ) {
        const widthDelta = Math.abs(firstPageWidthMm - expectedWidthMm);
        const heightDelta = Math.abs(firstPageHeightMm - expectedHeightMm);
        if (widthDelta > 1 || heightDelta > 1) {
            warnings.push(
                `Første side er ${Math.round(firstPageWidthMm)} x ${Math.round(firstPageHeightMm)} mm, forventet ${Math.round(expectedWidthMm)} x ${Math.round(expectedHeightMm)} mm.`,
            );
        }
    }

    return {
        status: errors.length ? "error" : warnings.length ? "warning" : "ok",
        runtime: "browser",
        operation: request.operation || "inspect",
        fileName: request.fileName,
        byteLength: request.bytes.byteLength,
        pageCount: pages.length,
        firstPage: firstPageWidthMm && firstPageHeightMm
            ? {
                widthMm: roundMm(firstPageWidthMm),
                heightMm: roundMm(firstPageHeightMm),
            }
            : null,
        expected: request.expected || null,
        warnings,
        errors,
        capabilities: {
            inspect: "ready",
            preflight: "metadata-only",
            compress: "edge-provider-required",
            ocr: "edge-provider-required",
            repair: "edge-provider-required",
            pdfa: "edge-provider-required",
            redact: "edge-provider-required",
            flattenForms: "edge-provider-required",
            textEdit: "alpha-edge-provider-required",
        },
    };
}

export async function runDesignerPdfService(request: DesignerPdfServiceRequest): Promise<DesignerPdfServiceReport> {
    if (request.runtime !== "edge") {
        return inspectPdfInBrowser(request);
    }

    let temporaryStoragePath: string | undefined;
    let storageBucket = request.storageBucket;
    let storagePath = request.storagePath;

    try {
        if (request.bytes && !storagePath) {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError || !authData.user) throw new Error("Du skal være logget ind for at behandle en PDF.");

            storageBucket = "order-files";
            temporaryStoragePath = `designer-pdf-service-input/${authData.user.id}/${Date.now()}-${crypto.randomUUID()}-${safeFileName(request.fileName)}`;
            storagePath = temporaryStoragePath;
            const { error: uploadError } = await supabase.storage
                .from(storageBucket)
                .upload(storagePath, new Blob([request.bytes], { type: "application/pdf" }), {
                    contentType: "application/pdf",
                    upsert: false,
                });
            if (uploadError) throw new Error(`PDF'en kunne ikke klargøres til behandling: ${uploadError.message}`);
        }

        const { data, error } = await supabase.functions.invoke("designer-pdf-service", {
            body: {
                operation: request.operation || "inspect",
                pdfUrl: request.pdfUrl,
                storageBucket,
                storagePath,
                temporaryInput: Boolean(temporaryStoragePath),
                fileName: request.fileName,
                expected: request.expected,
                options: request.options,
            },
        });

        if (error) {
            const context = (error as { context?: Response }).context;
            if (context && typeof context.clone === "function") {
                const payload = await context.clone().json().catch(() => null) as { errors?: string[]; error?: string } | null;
                const detail = payload?.errors?.[0] || payload?.error;
                if (detail) throw new Error(detail);
            }
            throw error;
        }
        return data as DesignerPdfServiceReport;
    } finally {
        if (temporaryStoragePath && storageBucket) {
            await supabase.storage.from(storageBucket).remove([temporaryStoragePath]);
        }
    }
}

export async function downloadDesignerPdfServiceOutput(report: DesignerPdfServiceReport): Promise<ArrayBuffer> {
    if (!report.output?.signedUrl) throw new Error("PDF-servicen har ikke returneret en fil.");
    const response = await fetch(report.output.signedUrl, { credentials: "omit" });
    if (!response.ok) throw new Error(`Den behandlede fil kunne ikke hentes (${response.status}).`);
    const bytes = await response.arrayBuffer();
    if (report.output.contentType === "application/pdf") {
        const header = new TextDecoder().decode(bytes.slice(0, 5));
        if (header !== "%PDF-") throw new Error("Den behandlede fil er ikke en gyldig PDF.");
    }
    return bytes;
}
