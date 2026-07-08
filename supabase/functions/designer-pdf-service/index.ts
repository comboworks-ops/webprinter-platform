// Generic designer PDF service.
// This is intentionally separate from pod2-pdf-preflight so the online designer
// can grow Stirling-PDF-style operations without coupling them to POD products.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, methodNotAllowed, optionsResponse } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

type DesignerPdfServiceOperation =
  | "inspect"
  | "preflight"
  | "compress"
  | "ocr"
  | "repair"
  | "pdfa"
  | "redact"
  | "flatten-forms";

type DesignerPdfServiceRequest = {
  operation?: DesignerPdfServiceOperation;
  pdfUrl?: string;
  pdfBase64?: string;
  storageBucket?: string;
  storagePath?: string;
  fileName?: string;
  expected?: {
    widthMm?: number;
    heightMm?: number;
    bleedMm?: number;
  };
};

const ALLOWED_OPERATIONS: DesignerPdfServiceOperation[] = [
  "inspect",
  "preflight",
  "compress",
  "ocr",
  "repair",
  "pdfa",
  "redact",
  "flatten-forms",
];
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const ALLOWED_STORAGE_BUCKETS = new Set(["order-files", "product-images", "tenant-assets"]);

const mmFromPt = (pt: number) => (pt / 72) * 25.4;

class RequestError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const isPrivateIpv4 = (host: string) => {
  const match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  const [a, b] = octets;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
};

const assertSafeRemotePdfUrl = (rawUrl: string) => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new RequestError("Invalid pdfUrl");
  }

  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:") {
    throw new RequestError("pdfUrl must use HTTPS");
  }
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "::1" ||
    isPrivateIpv4(hostname)
  ) {
    throw new RequestError("pdfUrl cannot point to a private or local host");
  }
};

const assertPdfBytes = (bytes: Uint8Array) => {
  if (bytes.byteLength === 0) throw new RequestError("PDF file is empty");
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new RequestError(`PDF exceeds the ${MAX_PDF_BYTES / 1024 / 1024} MB limit`, 413);
  }

  const header = new TextDecoder().decode(bytes.slice(0, 5));
  if (header !== "%PDF-") {
    throw new RequestError("File does not look like a PDF");
  }
};

const assertSafeStorageObject = (bucket?: string, path?: string) => {
  if (!bucket || !ALLOWED_STORAGE_BUCKETS.has(bucket)) {
    throw new RequestError("Unsupported storage bucket");
  }
  if (
    !path ||
    path.startsWith("/") ||
    path.includes("..") ||
    path.includes("\\") ||
    !path.toLowerCase().endsWith(".pdf")
  ) {
    throw new RequestError("Invalid storagePath");
  }
};

const bytesFromBase64 = (base64: string): Uint8Array => {
  const cleanBase64 = base64.includes(",") ? base64.split(",").pop() || "" : base64;
  if (Math.ceil((cleanBase64.length * 3) / 4) > MAX_PDF_BYTES) {
    throw new RequestError(`PDF exceeds the ${MAX_PDF_BYTES / 1024 / 1024} MB limit`, 413);
  }
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const getPdfBytes = async (body: DesignerPdfServiceRequest): Promise<Uint8Array> => {
  if (body.storageBucket || body.storagePath) {
    assertSafeStorageObject(body.storageBucket, body.storagePath);
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data, error } = await serviceClient.storage
      .from(body.storageBucket!)
      .download(body.storagePath!);
    if (error || !data) throw new RequestError("Could not read PDF from storage", 404);
    const bytes = new Uint8Array(await data.arrayBuffer());
    assertPdfBytes(bytes);
    return bytes;
  }

  if (body.pdfBase64) {
    const bytes = bytesFromBase64(body.pdfBase64);
    assertPdfBytes(bytes);
    return bytes;
  }

  if (body.pdfUrl) {
    assertSafeRemotePdfUrl(body.pdfUrl);
    const response = await fetch(body.pdfUrl);
    if (!response.ok) throw new Error(`Could not fetch PDF: ${response.status}`);
    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_PDF_BYTES) {
      throw new RequestError(`PDF exceeds the ${MAX_PDF_BYTES / 1024 / 1024} MB limit`, 413);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    assertPdfBytes(bytes);
    return bytes;
  }

  throw new Error("Missing pdfUrl or pdfBase64");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return optionsResponse();
  }

  if (req.method !== "POST") {
    return methodNotAllowed();
  }

  const rateLimited = checkRateLimit(req, {
    keyPrefix: "designer-pdf-service",
    limit: 30,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const body = (await req.json()) as DesignerPdfServiceRequest;
    const operation = body.operation || "inspect";
    if (!ALLOWED_OPERATIONS.includes(operation)) {
      throw new RequestError("Unsupported PDF operation");
    }

    const pdfBytes = await getPdfBytes(body);
    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pages = pdf.getPages();
    const firstPage = pages[0];
    const firstPageSize = firstPage?.getSize();
    const firstPageWidthMm = firstPageSize ? mmFromPt(firstPageSize.width) : null;
    const firstPageHeightMm = firstPageSize ? mmFromPt(firstPageSize.height) : null;
    const expectedWidthMm = body.expected?.widthMm;
    const expectedHeightMm = body.expected?.heightMm;

    const warnings: string[] = [];
    const errors: string[] = [];
    const capabilities = {
      inspect: "ready",
      preflight: "metadata-only",
      compress: "external-provider-required",
      ocr: "external-provider-required",
      repair: "external-provider-required",
      pdfa: "external-provider-required",
      redact: "external-provider-required",
      flattenForms: "external-provider-required",
    };

    if (pages.length === 0) {
      errors.push("PDF has no pages.");
    }

    if (operation !== "inspect" && operation !== "preflight") {
      warnings.push(`${operation} requires a configured external PDF processor before production use.`);
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
          `First page is ${Math.round(firstPageWidthMm)} x ${Math.round(firstPageHeightMm)} mm, expected ${Math.round(expectedWidthMm)} x ${Math.round(expectedHeightMm)} mm.`,
        );
      }
    }

    return jsonResponse({
      status: errors.length ? "error" : warnings.length ? "warning" : "ok",
      runtime: "edge",
      operation,
      fileName: body.fileName,
      byteLength: pdfBytes.byteLength,
      pageCount: pages.length,
      firstPage: firstPageWidthMm && firstPageHeightMm
        ? {
          widthMm: firstPageWidthMm,
          heightMm: firstPageHeightMm,
        }
        : null,
      expected: body.expected || null,
      warnings,
      errors,
      capabilities,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected PDF service error";
    const status = error instanceof RequestError ? error.status : 500;
    return jsonResponse({ status: "error", runtime: "edge", errors: [message], warnings: [] }, status);
  }
});
