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
    | "flatten-forms";

export interface DesignerPdfServiceExpectedSpec {
    widthMm?: number;
    heightMm?: number;
    bleedMm?: number;
}

export interface DesignerPdfServiceReport {
    status: DesignerPdfServiceStatus;
    runtime: DesignerPdfServiceRuntime;
    operation: DesignerPdfServiceOperation;
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
}

export interface DesignerPdfServiceRequest {
    bytes?: ArrayBuffer;
    pdfUrl?: string;
    storageBucket?: string;
    storagePath?: string;
    fileName?: string;
    operation?: DesignerPdfServiceOperation;
    expected?: DesignerPdfServiceExpectedSpec;
    runtime?: DesignerPdfServiceRuntime;
}

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
};

const roundMm = (value: number) => Math.round(value * 10) / 10;

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
        },
    };
}

export async function runDesignerPdfService(request: DesignerPdfServiceRequest): Promise<DesignerPdfServiceReport> {
    if (request.runtime !== "edge") {
        return inspectPdfInBrowser(request);
    }

    const { data, error } = await supabase.functions.invoke("designer-pdf-service", {
        body: {
            operation: request.operation || "inspect",
            pdfUrl: request.pdfUrl,
            storageBucket: request.storageBucket,
            storagePath: request.storagePath,
            pdfBase64: request.bytes ? arrayBufferToBase64(request.bytes) : undefined,
            fileName: request.fileName,
            expected: request.expected,
        },
    });

    if (error) {
        throw error;
    }

    return data as DesignerPdfServiceReport;
}
