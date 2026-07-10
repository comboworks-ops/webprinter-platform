// Authenticated designer PDF processing facade. The browser never receives the
// private Stirling-PDF URL or API key, and processed files are stored immutably.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  jsonResponse,
  methodNotAllowed,
  optionsResponse,
} from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import {
  getStirlingOperationDefinition,
  readStirlingProviderConfig,
  runStirlingOperation,
  type StirlingOperationOptions,
  type StirlingPdfOperation,
} from "./stirlingProvider.ts";

type DesignerPdfServiceOperation =
  | "inspect"
  | "preflight"
  | StirlingPdfOperation;

type DesignerPdfServiceRequest = {
  operation?: DesignerPdfServiceOperation;
  pdfUrl?: string;
  pdfBase64?: string;
  textEditorJsonBase64?: string;
  storageBucket?: string;
  storagePath?: string;
  temporaryInput?: boolean;
  fileName?: string;
  options?: StirlingOperationOptions;
  expected?: {
    widthMm?: number;
    heightMm?: number;
    bleedMm?: number;
  };
};

const INSPECTION_OPERATIONS = new Set<DesignerPdfServiceOperation>([
  "inspect",
  "preflight",
]);
const PROCESSING_OPERATIONS = new Set<DesignerPdfServiceOperation>([
  "compress",
  "ocr",
  "repair",
  "pdfa",
  "redact",
  "flatten-forms",
  "text-edit-export",
  "text-edit-import",
]);
const ALLOWED_OPERATIONS = new Set<DesignerPdfServiceOperation>([
  ...INSPECTION_OPERATIONS,
  ...PROCESSING_OPERATIONS,
]);
const ALLOWED_STORAGE_BUCKETS = new Set([
  "order-files",
  "product-images",
  "tenant-assets",
]);
const OUTPUT_BUCKET = "order-files";
const MAX_INPUT_BYTES = 25 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 50 * 1024 * 1024;
const SIGNED_URL_SECONDS = 60 * 60;

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
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 169 && b === 254) || a === 0;
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
    hostname === "localhost" || hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "::1" || isPrivateIpv4(hostname)
  ) {
    throw new RequestError("pdfUrl cannot point to a private or local host");
  }
};

const assertSafeStorageObject = (bucket?: string, path?: string) => {
  if (!bucket || !ALLOWED_STORAGE_BUCKETS.has(bucket)) {
    throw new RequestError("Unsupported storage bucket");
  }
  if (
    !path || path.startsWith("/") || path.includes("..") || path.includes("\\")
  ) {
    throw new RequestError("Invalid storagePath");
  }
};

const assertPdfBytes = (bytes: Uint8Array, maximum = MAX_INPUT_BYTES) => {
  if (bytes.byteLength === 0) throw new RequestError("PDF file is empty");
  if (bytes.byteLength > maximum) {
    throw new RequestError(
      `PDF exceeds the ${maximum / 1024 / 1024} MB limit`,
      413,
    );
  }
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  if (header !== "%PDF-") {
    throw new RequestError("File does not look like a PDF");
  }
};

const bytesFromBase64 = (
  base64: string,
  maximum = MAX_INPUT_BYTES,
): Uint8Array => {
  const cleanBase64 = base64.includes(",")
    ? base64.split(",").pop() || ""
    : base64;
  if (Math.ceil((cleanBase64.length * 3) / 4) > maximum) {
    throw new RequestError(
      `Input exceeds the ${maximum / 1024 / 1024} MB limit`,
      413,
    );
  }
  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const safeFileStem = (fileName?: string) => {
  const withoutExtension = (fileName || "designer-pdf").replace(/\.[^.]+$/, "");
  return withoutExtension.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "")
    .slice(0, 80) || "designer-pdf";
};

const getServiceClient = () =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

const getUserClient = (authHeader: string) =>
  createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );

const getInputBytes = async (
  body: DesignerPdfServiceRequest,
  authHeader: string,
  processing: boolean,
): Promise<{ bytes: Uint8Array; contentType: string }> => {
  if (body.storageBucket || body.storagePath) {
    assertSafeStorageObject(body.storageBucket, body.storagePath);
    const { data, error } = await getUserClient(authHeader).storage
      .from(body.storageBucket!)
      .download(body.storagePath!);
    if (error || !data) {
      throw new RequestError(
        "Could not read PDF from user-accessible storage",
        404,
      );
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (body.operation === "text-edit-import") {
      if (bytes.byteLength > MAX_INPUT_BYTES) {
        throw new RequestError("Text editor input is too large", 413);
      }
      return { bytes, contentType: "application/json" };
    }
    assertPdfBytes(bytes);
    return { bytes, contentType: "application/pdf" };
  }

  if (body.operation === "text-edit-import" && body.textEditorJsonBase64) {
    const bytes = bytesFromBase64(body.textEditorJsonBase64);
    JSON.parse(new TextDecoder().decode(bytes));
    return { bytes, contentType: "application/json" };
  }

  if (body.pdfBase64) {
    const bytes = bytesFromBase64(body.pdfBase64);
    assertPdfBytes(bytes);
    return { bytes, contentType: "application/pdf" };
  }

  if (body.pdfUrl) {
    if (processing) {
      throw new RequestError(
        "Processing requires an uploaded PDF, not a remote URL",
      );
    }
    assertSafeRemotePdfUrl(body.pdfUrl);
    const response = await fetch(body.pdfUrl);
    if (!response.ok) {
      throw new RequestError(`Could not fetch PDF: ${response.status}`, 502);
    }
    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_INPUT_BYTES) {
      throw new RequestError(
        `PDF exceeds the ${MAX_INPUT_BYTES / 1024 / 1024} MB limit`,
        413,
      );
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    assertPdfBytes(bytes);
    return { bytes, contentType: "application/pdf" };
  }

  throw new RequestError("Missing PDF input");
};

const inspectPdf = async (
  pdfBytes: Uint8Array,
  body: DesignerPdfServiceRequest,
) => {
  assertPdfBytes(pdfBytes, MAX_OUTPUT_BYTES);
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = pdf.getPages();
  const firstPageSize = pages[0]?.getSize();
  const firstPageWidthMm = firstPageSize ? mmFromPt(firstPageSize.width) : null;
  const firstPageHeightMm = firstPageSize
    ? mmFromPt(firstPageSize.height)
    : null;
  const warnings: string[] = [];
  const errors: string[] = [];

  if (pages.length === 0) errors.push("PDF has no pages.");
  if (
    typeof body.expected?.widthMm === "number" &&
    typeof body.expected?.heightMm === "number" &&
    firstPageWidthMm && firstPageHeightMm &&
    (Math.abs(firstPageWidthMm - body.expected.widthMm) > 1 ||
      Math.abs(firstPageHeightMm - body.expected.heightMm) > 1)
  ) {
    warnings.push(
      `First page is ${Math.round(firstPageWidthMm)} x ${
        Math.round(firstPageHeightMm)
      } mm, expected ${Math.round(body.expected.widthMm)} x ${
        Math.round(body.expected.heightMm)
      } mm.`,
    );
  }

  return {
    pageCount: pages.length,
    firstPage: firstPageWidthMm && firstPageHeightMm
      ? { widthMm: firstPageWidthMm, heightMm: firstPageHeightMm }
      : null,
    warnings,
    errors,
  };
};

const capabilityReport = () => {
  const config = (() => {
    try {
      return readStirlingProviderConfig((name) => Deno.env.get(name));
    } catch {
      return null;
    }
  })();
  if (!config) {
    return {
      inspect: "ready",
      preflight: "metadata-only",
      compress: "provider-config-invalid",
      ocr: "provider-config-invalid",
      repair: "provider-config-invalid",
      pdfa: "provider-config-invalid",
      redact: "provider-config-invalid",
      flattenForms: "provider-config-invalid",
      textEdit: "alpha-disabled",
    };
  }
  const providerReady = config.enabled && Boolean(config.baseUrl) &&
    Boolean(config.apiKey) && config.licenseAcknowledged;
  return {
    inspect: "ready",
    preflight: "metadata-only",
    compress: providerReady ? "ready" : "provider-disabled",
    ocr: providerReady ? "ready" : "provider-disabled",
    repair: providerReady ? "ready" : "provider-disabled",
    pdfa: providerReady ? "ready" : "provider-disabled",
    redact: providerReady ? "ready-rasterizes" : "provider-disabled",
    flattenForms: providerReady ? "ready" : "provider-disabled",
    textEdit: providerReady && config.textEditorEnabled
      ? "alpha-enabled"
      : "alpha-disabled",
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return methodNotAllowed();

  const rateLimited = checkRateLimit(req, {
    keyPrefix: "designer-pdf-service",
    limit: 12,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  let temporaryInput: { bucket: string; path: string; userId: string } | null =
    null;
  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const body = (await req.json()) as DesignerPdfServiceRequest;
    const operation = body.operation || "inspect";
    if (!ALLOWED_OPERATIONS.has(operation)) {
      throw new RequestError("Unsupported PDF operation");
    }
    const processing = PROCESSING_OPERATIONS.has(operation);
    if (body.temporaryInput && body.storageBucket && body.storagePath) {
      const expectedPrefix = `designer-pdf-service-input/${auth.user.id}/`;
      if (
        body.storageBucket !== OUTPUT_BUCKET ||
        !body.storagePath.startsWith(expectedPrefix)
      ) {
        throw new RequestError(
          "Temporary input path does not belong to the authenticated user",
          403,
        );
      }
      temporaryInput = {
        bucket: body.storageBucket,
        path: body.storagePath,
        userId: auth.user.id,
      };
    }

    const input = await getInputBytes(body, auth.authHeader, processing);
    const capabilities = capabilityReport();

    if (!processing) {
      const inspection = await inspectPdf(input.bytes, body);
      return jsonResponse({
        status: inspection.errors.length
          ? "error"
          : inspection.warnings.length
          ? "warning"
          : "ok",
        runtime: "edge",
        operation,
        provider: "native",
        fileName: body.fileName,
        byteLength: input.bytes.byteLength,
        ...inspection,
        expected: body.expected || null,
        capabilities,
      });
    }

    const providerOperation = operation as StirlingPdfOperation;
    const config = readStirlingProviderConfig((name) => Deno.env.get(name));
    const result = await runStirlingOperation({
      config,
      operation: providerOperation,
      inputBytes: input.bytes,
      inputContentType: input.contentType,
      fileName: body.fileName ||
        (providerOperation === "text-edit-import"
          ? "editor.json"
          : "designer.pdf"),
      options: body.options,
    });
    if (result.bytes.byteLength > MAX_OUTPUT_BYTES) {
      throw new RequestError(
        `Processed output exceeds the ${
          MAX_OUTPUT_BYTES / 1024 / 1024
        } MB limit`,
        413,
      );
    }

    const now = new Date();
    const datePath = now.toISOString().slice(0, 10);
    const outputName = `${Date.now()}-${providerOperation}-${
      safeFileStem(body.fileName)
    }.${result.definition.outputExtension}`;
    const outputPath =
      `designer-pdf-service-output/${auth.user.id}/${datePath}/${outputName}`;
    const serviceClient = getServiceClient();
    const { error: uploadError } = await serviceClient.storage.from(
      OUTPUT_BUCKET,
    ).upload(
      outputPath,
      result.bytes,
      { contentType: result.definition.outputContentType, upsert: false },
    );
    if (uploadError) {
      throw new Error(`Could not store processed PDF: ${uploadError.message}`);
    }

    const { data: signedData, error: signedError } = await serviceClient.storage
      .from(OUTPUT_BUCKET)
      .createSignedUrl(outputPath, SIGNED_URL_SECONDS);
    if (signedError || !signedData?.signedUrl) {
      throw new Error("Could not create a signed output URL");
    }

    const warnings: string[] = [];
    let inspection: Awaited<ReturnType<typeof inspectPdf>> | null = null;
    if (result.definition.outputContentType === "application/pdf") {
      inspection = await inspectPdf(result.bytes, body);
      warnings.push(...inspection.warnings);
    }
    if (result.definition.rasterizes) {
      warnings.unshift(
        "Resultatet er rasteriseret for at gøre fjernelsen permanent. Brug ikke denne fil som vektor-master.",
      );
    }
    if (providerOperation === "compress") {
      warnings.push(
        "Komprimering kan ændre billedkvalitet. Kontrollér resultatet før det bruges til tryk.",
      );
    }
    if (providerOperation === "pdfa") {
      warnings.push(
        "PDF/A er et arkivformat og erstatter ikke Webprinters tryk-preflight eller PDF/X-kontrol.",
      );
    }
    if (result.definition.alpha) {
      warnings.push(
        "Avanceret tekstredigering er en licenskrævende pilotfunktion og må ikke bruges som automatisk produktions-master.",
      );
    }

    return jsonResponse({
      status: inspection?.errors.length
        ? "error"
        : warnings.length
        ? "warning"
        : "ok",
      runtime: "edge",
      operation,
      provider: "stirling-pdf",
      fileName: body.fileName,
      byteLength: input.bytes.byteLength,
      pageCount: inspection?.pageCount,
      firstPage: inspection?.firstPage,
      expected: body.expected || null,
      warnings,
      errors: inspection?.errors || [],
      capabilities,
      output: {
        bucket: OUTPUT_BUCKET,
        storagePath: outputPath,
        signedUrl: signedData.signedUrl,
        signedUrlExpiresIn: SIGNED_URL_SECONDS,
        fileName: outputName,
        byteLength: result.bytes.byteLength,
        contentType: result.definition.outputContentType,
        preservesVectors: result.definition.preservesVectors,
        rasterizes: result.definition.rasterizes,
        immutable: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Unexpected PDF service error";
    const status = error instanceof RequestError ? error.status : 500;
    return jsonResponse({
      status: "error",
      runtime: "edge",
      errors: [message],
      warnings: [],
      capabilities: capabilityReport(),
    }, status);
  } finally {
    if (temporaryInput) {
      await getServiceClient().storage.from(temporaryInput.bucket).remove([
        temporaryInput.path,
      ]);
    }
  }
});
