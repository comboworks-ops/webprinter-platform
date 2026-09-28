#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_VERSION = 2;
const STATE_SCHEMA_VERSION = 1;
const EXACT_SUPPLIER_ORIGIN = "https://www.wir-machen-druck.de";
const EXACT_SUPPLIER_HOST = "www.wir-machen-druck.de";
const EXPECTED_SOURCE_CATEGORY_URL =
  "https://www.wir-machen-druck.de/praesentationsmappen,category,9418.html";
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_PROCESS_TIMEOUT_MS = 60_000;
const PROCESS_TERMINATION_GRACE_MS = 500;
const DEFAULT_PYTHON_BINARY =
  "/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const OPTIONAL_CONTENT_INSPECTOR = path.join(
  SCRIPT_DIRECTORY,
  "inspect_pdf_optional_content.py"
);
const PDF_HEADER = Buffer.from("%PDF-");
const BOX_NAMES = ["MediaBox", "CropBox", "BleedBox", "TrimBox", "ArtBox"];

export class DocumentPreparationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "DocumentPreparationError";
    this.details = details;
  }
}

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha256Text(value) {
  return sha256Buffer(Buffer.from(String(value), "utf8"));
}

function normalizeUrl(value) {
  try {
    return new URL(String(value || ""));
  } catch {
    throw new DocumentPreparationError(`Invalid URL: ${String(value || "(empty)")}`);
  }
}

export function assertExactSupplierUrl(value) {
  const url = normalizeUrl(value);
  if (
    url.protocol !== "https:"
    || url.hostname !== EXACT_SUPPLIER_HOST
    || url.port !== ""
    || url.username !== ""
    || url.password !== ""
    || url.hash !== ""
  ) {
    throw new DocumentPreparationError(
      `Only exact ${EXACT_SUPPLIER_ORIGIN} HTTPS URLs are allowed: ${url.href}`
    );
  }
  return url;
}

export function assertExactSupplierPdfUrl(value) {
  const url = assertExactSupplierUrl(value);
  if (!/\.pdf$/i.test(url.pathname) || url.search !== "") {
    throw new DocumentPreparationError(
      `Only exact supplier PDF URLs without query parameters are allowed: ${url.href}`
    );
  }
  return url.href;
}

export function hasPdfMagic(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value || []);
  return bytes.length >= PDF_HEADER.length && bytes.subarray(0, PDF_HEADER.length).equals(PDF_HEADER);
}

function sanitizedSourceFilename(sourceUrl) {
  const parsed = new URL(sourceUrl);
  let basename = path.posix.basename(parsed.pathname);
  try {
    basename = decodeURIComponent(basename);
  } catch {
    // Keep the encoded basename when percent-decoding fails.
  }
  const safeBasename = basename
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-140) || "supplier-document.pdf";
  const pdfBasename = /\.pdf$/i.test(safeBasename) ? safeBasename : `${safeBasename}.pdf`;
  return `${sha256Text(sourceUrl).slice(0, 16)}-${pdfBasename}`;
}

function compactSelection(binding, bindingKey) {
  return {
    bindingKey,
    sourceUrl: binding.sourceUrl,
    productSourceOrder: binding.productSourceOrder ?? null,
    sourceProductId: binding.sourceProductId ?? null,
    sourceSku: binding.sourceSku ?? null,
    materialId: String(binding.materialId),
    materialSourceOrder: binding.materialSourceOrder ?? null,
    materialLabel: binding.materialLabel ?? null,
    classification: binding.classification ?? null,
    materialFacts: binding.materialFacts ?? null,
  };
}

function parseJsonl(text, sourceName = "document-bindings.jsonl") {
  const rows = [];
  for (const [index, rawLine] of String(text).split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      rows.push(JSON.parse(line));
    } catch (error) {
      throw new DocumentPreparationError(
        `${sourceName}:${index + 1} is not valid JSON: ${error.message}`
      );
    }
  }
  return rows;
}

export function buildDocumentPlan(bindings) {
  if (!Array.isArray(bindings) || bindings.length === 0) {
    throw new DocumentPreparationError("document-bindings.jsonl contains no bindings");
  }

  const seenBindingKeys = new Set();
  const documentsByUrl = new Map();

  for (const [index, binding] of bindings.entries()) {
    if (!binding || typeof binding !== "object" || Array.isArray(binding)) {
      throw new DocumentPreparationError(`Binding ${index + 1} is not an object`);
    }
    const sourceUrl = assertExactSupplierUrl(binding.sourceUrl).href;
    const materialId = String(binding.materialId ?? "").trim();
    if (!materialId) {
      throw new DocumentPreparationError(`Binding ${index + 1} has no materialId`);
    }
    const bindingKey = `${sourceUrl}|${materialId}`;
    if (seenBindingKeys.has(bindingKey)) {
      throw new DocumentPreparationError(`Duplicate selection binding: ${bindingKey}`);
    }
    seenBindingKeys.add(bindingKey);

    const sourceDocuments = Array.isArray(binding.documents) ? binding.documents : [];
    const guides = sourceDocuments.filter((document) => document?.role === "guide");
    const templates = sourceDocuments.filter((document) => document?.role === "template");
    const unknownRoles = sourceDocuments.filter(
      (document) => !document || !["guide", "template"].includes(document.role)
    );
    if (
      sourceDocuments.length !== 2
      || guides.length !== 1
      || templates.length !== 1
      || unknownRoles.length !== 0
    ) {
      throw new DocumentPreparationError(
        `${bindingKey} must contain exactly one guide and one template document`
      );
    }

    const normalizedDocuments = sourceDocuments.map((document) => ({
      role: document.role,
      label: document.label ?? null,
      sourceUrl: assertExactSupplierPdfUrl(document.url),
    }));
    if (new Set(normalizedDocuments.map((document) => document.sourceUrl)).size !== 2) {
      throw new DocumentPreparationError(
        `${bindingKey} uses the same PDF as both guide and template`
      );
    }

    const selection = compactSelection({ ...binding, sourceUrl }, bindingKey);
    for (const document of normalizedDocuments) {
      let planned = documentsByUrl.get(document.sourceUrl);
      if (!planned) {
        planned = {
          sourceUrl: document.sourceUrl,
          role: document.role,
          labelOriginals: [],
          localRelativePath: path.posix.join(
            "documents",
            "source-pdfs",
            sanitizedSourceFilename(document.sourceUrl)
          ),
          selectionBindings: [],
        };
        documentsByUrl.set(document.sourceUrl, planned);
      }
      if (planned.role !== document.role) {
        throw new DocumentPreparationError(
          `A supplier PDF is assigned conflicting roles: ${document.sourceUrl}`
        );
      }
      if (document.label && !planned.labelOriginals.includes(document.label)) {
        planned.labelOriginals.push(document.label);
      }
      planned.selectionBindings.push({ ...selection, documentRole: document.role });
    }
  }

  const documents = [...documentsByUrl.values()]
    .map((document) => ({
      ...document,
      labelOriginals: [...document.labelOriginals].sort(),
      selectionBindings: [...document.selectionBindings].sort((left, right) => (
        left.bindingKey.localeCompare(right.bindingKey)
      )),
    }))
    .sort((left, right) => left.sourceUrl.localeCompare(right.sourceUrl));

  return {
    schemaVersion: 1,
    bindingCount: bindings.length,
    uniqueDocumentCount: documents.length,
    uniqueGuideCount: documents.filter((document) => document.role === "guide").length,
    uniqueTemplateCount: documents.filter((document) => document.role === "template").length,
    documents,
  };
}

function headerValue(headers, name) {
  if (!headers || typeof headers.get !== "function") return null;
  return headers.get(name) || null;
}

function isRedirectStatus(status) {
  return [301, 302, 303, 307, 308].includes(status);
}

async function fetchOnce(fetchImpl, url, timeoutMs, consumeResponse) {
  const controller = new AbortController();
  let timedOut = false;
  let rejectDeadline;
  const deadline = new Promise((_, reject) => {
    rejectDeadline = reject;
  });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
    rejectDeadline(new DocumentPreparationError(
      `Supplier PDF request timed out after ${timeoutMs} ms: ${url}`,
      { timeoutMs, sourceUrl: url }
    ));
  }, timeoutMs);
  const withinDeadline = (promise) => Promise.race([Promise.resolve(promise), deadline]);
  try {
    const response = await withinDeadline(fetchImpl(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        accept: "application/pdf,*/*;q=0.1",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/139 Safari/537.36",
      },
    }));
    return await consumeResponse(response, { controller, withinDeadline });
  } catch (error) {
    if (timedOut || error?.name === "AbortError") {
      throw new DocumentPreparationError(
        `Supplier PDF request timed out after ${timeoutMs} ms: ${url}`,
        { timeoutMs, sourceUrl: url }
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readResponseBody(response, {
  controller,
  withinDeadline,
  maxBytes,
  sourceUrl,
}) {
  const reader = response?.body?.getReader?.();
  if (!reader) {
    throw new DocumentPreparationError(
      `Supplier PDF response has no readable streaming body: ${sourceUrl}`
    );
  }

  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const result = await withinDeadline(reader.read());
      if (!result || result.done) break;
      const chunk = result.value instanceof Uint8Array
        ? result.value
        : new Uint8Array(result.value || []);
      const nextTotal = totalBytes + chunk.byteLength;
      if (!Number.isSafeInteger(nextTotal) || nextTotal > maxBytes) {
        controller.abort();
        void Promise.resolve(reader.cancel("maximum PDF byte size exceeded")).catch(() => {});
        throw new DocumentPreparationError(
          `Supplier PDF exceeds the ${maxBytes}-byte safety limit while streaming: ${nextTotal}`
        );
      }
      chunks.push(chunk);
      totalBytes = nextTotal;
    }
  } catch (error) {
    void Promise.resolve(reader.cancel("PDF body read failed")).catch(() => {});
    throw error;
  } finally {
    try {
      reader.releaseLock?.();
    } catch {
      // A timed-out custom stream can retain a pending read briefly; abort/cancel still owns cleanup.
    }
  }

  const bytes = Buffer.allocUnsafe(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength).copy(bytes, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function fetchExactSupplierPdf(sourceUrl, {
  fetchImpl = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytes = DEFAULT_MAX_BYTES,
  maxRedirects = 5,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new DocumentPreparationError("No fetch implementation is available");
  }
  const normalizedSourceUrl = assertExactSupplierPdfUrl(sourceUrl);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new DocumentPreparationError("PDF request timeout must be a positive integer");
  }
  if (!Number.isInteger(maxBytes) || maxBytes < PDF_HEADER.length) {
    throw new DocumentPreparationError(
      `PDF maximum byte size must be an integer of at least ${PDF_HEADER.length}`
    );
  }
  let currentUrl = normalizedSourceUrl;
  const redirects = [];

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    assertExactSupplierUrl(currentUrl);
    const result = await fetchOnce(
      fetchImpl,
      currentUrl,
      timeoutMs,
      async (response, deadlineContext) => {
        if (isRedirectStatus(response.status)) {
          const location = headerValue(response.headers, "location");
          if (!location) {
            throw new DocumentPreparationError(`Redirect has no Location header: ${currentUrl}`);
          }
          const nextUrl = new URL(location, currentUrl).href;
          assertExactSupplierUrl(nextUrl);
          deadlineContext.controller.abort();
          return { kind: "redirect", status: response.status, nextUrl };
        }
        if (response.status !== 200) {
          deadlineContext.controller.abort();
          throw new DocumentPreparationError(
            `Supplier PDF request returned HTTP ${response.status}: ${currentUrl}`
          );
        }
        const finalUrl = response.url ? new URL(response.url, currentUrl).href : currentUrl;
        assertExactSupplierPdfUrl(finalUrl);
        const contentLengthHeader = headerValue(response.headers, "content-length");
        const contentLength = /^\d+$/.test(contentLengthHeader || "")
          ? Number(contentLengthHeader)
          : null;
        if (contentLength !== null && contentLength > maxBytes) {
          deadlineContext.controller.abort();
          throw new DocumentPreparationError(
            `Supplier PDF exceeds the ${maxBytes}-byte safety limit: ${contentLength}`
          );
        }
        const bytes = await readResponseBody(response, {
          ...deadlineContext,
          maxBytes,
          sourceUrl: finalUrl,
        });
        if (!hasPdfMagic(bytes)) {
          throw new DocumentPreparationError(
            `Supplier response does not start with PDF magic: ${finalUrl}`
          );
        }
        return {
          kind: "pdf",
          bytes,
          httpEvidence: {
            sourceUrl: normalizedSourceUrl,
            finalUrl,
            redirects: [...redirects],
            status: response.status,
            contentType: headerValue(response.headers, "content-type"),
            contentLength,
            etag: headerValue(response.headers, "etag"),
            lastModified: headerValue(response.headers, "last-modified"),
          },
        };
      }
    );
    if (result.kind === "redirect") {
      redirects.push({ status: result.status, from: currentUrl, to: result.nextUrl });
      currentUrl = result.nextUrl;
      continue;
    }
    return { bytes: result.bytes, httpEvidence: result.httpEvidence };
  }
  throw new DocumentPreparationError(`Too many redirects for supplier PDF: ${normalizedSourceUrl}`);
}

function parseNumericList(value, expectedLength) {
  const numbers = String(value || "").match(/[-+]?(?:\d+(?:\.\d*)?|\.\d+)/g)?.map(Number) || [];
  if (numbers.length !== expectedLength || numbers.some((number) => !Number.isFinite(number))) {
    return null;
  }
  return numbers;
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseBox(value) {
  const coordinatesPt = parseNumericList(value, 4);
  if (!coordinatesPt) return null;
  const [x1, y1, x2, y2] = coordinatesPt;
  const widthPt = x2 - x1;
  const heightPt = y2 - y1;
  return {
    coordinatesPt,
    widthPt: round(widthPt),
    heightPt: round(heightPt),
    widthMm: round(widthPt * 25.4 / 72),
    heightMm: round(heightPt * 25.4 / 72),
  };
}

function parsePageSize(value) {
  const numbers = parseNumericList(value, 2);
  if (!numbers) return null;
  return {
    widthPt: round(numbers[0]),
    heightPt: round(numbers[1]),
    widthMm: round(numbers[0] * 25.4 / 72),
    heightMm: round(numbers[1] * 25.4 / 72),
  };
}

function yesNo(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "yes") return true;
  if (normalized === "no") return false;
  return null;
}

export function parsePdfInfoOutput(stdout, xmpMetadata = "") {
  const keyValues = {};
  const pageValues = new Map();
  const pagePattern = /^Page\s+(\d+)\s+(size|rot|MediaBox|CropBox|BleedBox|TrimBox|ArtBox):\s*(.*)$/i;
  const unnumberedPagePattern = /^(Page size|Page rot|MediaBox|CropBox|BleedBox|TrimBox|ArtBox):\s*(.*)$/i;

  for (const line of String(stdout || "").split(/\r?\n/)) {
    const pageMatch = line.match(pagePattern);
    if (pageMatch) {
      const pageNumber = Number(pageMatch[1]);
      const values = pageValues.get(pageNumber) || {};
      values[pageMatch[2]] = pageMatch[3].trim();
      pageValues.set(pageNumber, values);
      continue;
    }
    const unnumberedMatch = line.match(unnumberedPagePattern);
    if (unnumberedMatch) {
      const values = pageValues.get(1) || {};
      const key = unnumberedMatch[1].replace(/^Page\s+/i, "");
      values[key] = unnumberedMatch[2].trim();
      pageValues.set(1, values);
      continue;
    }
    const separator = line.indexOf(":");
    if (separator > 0) {
      keyValues[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
    }
  }

  const pageCount = Number(keyValues.Pages);
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new DocumentPreparationError("pdfinfo did not return a valid page count");
  }

  const pages = [];
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const raw = pageValues.get(pageNumber) || {};
    const boxes = Object.fromEntries(BOX_NAMES.map((name) => [name, parseBox(raw[name])]));
    const missingBoxes = BOX_NAMES.filter((name) => boxes[name] === null);
    if (missingBoxes.length > 0) {
      throw new DocumentPreparationError(
        `pdfinfo is missing ${missingBoxes.join(", ")} for page ${pageNumber}`
      );
    }
    pages.push({
      pageNumber,
      size: parsePageSize(raw.size),
      rotation: Number.isFinite(Number(raw.rot)) ? Number(raw.rot) : null,
      boxes,
    });
  }

  const xmp = String(xmpMetadata || "");
  return {
    inspector: "pdfinfo",
    pdfVersion: keyValues["PDF version"] || null,
    pageCount,
    encrypted: yesNo(keyValues.Encrypted),
    optimized: yesNo(keyValues.Optimized),
    fileSizeReportedBytes: Number.parseInt(keyValues["File size"], 10) || null,
    metadata: {
      title: keyValues.Title || null,
      subject: keyValues.Subject || null,
      keywords: keyValues.Keywords || null,
      author: keyValues.Author || null,
      creator: keyValues.Creator || null,
      producer: keyValues.Producer || null,
      creationDate: keyValues.CreationDate || null,
      modificationDate: keyValues.ModDate || null,
      customMetadata: yesNo(keyValues["Custom Metadata"]),
      metadataStream: yesNo(keyValues["Metadata Stream"]),
      tagged: yesNo(keyValues.Tagged),
      form: keyValues.Form || null,
      javascript: yesNo(keyValues.JavaScript),
      xmp: {
        present: xmp.trim().length > 0,
        byteSize: Buffer.byteLength(xmp),
        sha256: xmp.trim().length > 0 ? sha256Text(xmp) : null,
        content: xmp.trim().length > 0 ? xmp : null,
      },
    },
    pages,
  };
}

export function parsePdfInfoPageCount(stdout) {
  const match = String(stdout || "").match(/^Pages:\s*(\d+)\s*$/mi);
  const pageCount = Number(match?.[1]);
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new DocumentPreparationError("pdfinfo did not return a valid page count");
  }
  return pageCount;
}

export function parseOptionalContentInspectorOutput(stdout) {
  let value;
  try {
    value = JSON.parse(String(stdout || ""));
  } catch (error) {
    throw new DocumentPreparationError(
      `Optional-content inspector did not return valid JSON: ${error.message}`
    );
  }
  return value;
}

export function validateOptionalContentInspection(value, {
  documentRole,
  expectedPageCount,
} = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DocumentPreparationError("Optional-content inspection result is not an object");
  }
  if (value.inspectionPerformed !== true) {
    const roleLabel = documentRole === "template" ? "template" : "document";
    throw new DocumentPreparationError(
      `Optional-content inspection was not performed for ${roleLabel} PDF`
    );
  }
  if (!Number.isInteger(value.pageCount) || value.pageCount < 1) {
    throw new DocumentPreparationError("Optional-content inspection has an invalid page count");
  }
  if (value.pageCount !== expectedPageCount) {
    throw new DocumentPreparationError(
      `pdfinfo/pypdf page-count mismatch: ${expectedPageCount} != ${value.pageCount}`
    );
  }
  if (value.multiPage !== (value.pageCount > 1)) {
    throw new DocumentPreparationError("Optional-content multi-page flag does not match page count");
  }

  const optionalContent = value.optionalContent;
  if (!optionalContent || typeof optionalContent !== "object" || Array.isArray(optionalContent)) {
    throw new DocumentPreparationError("Optional-content inspection has no optionalContent object");
  }
  if (typeof optionalContent.propertiesPresent !== "boolean") {
    throw new DocumentPreparationError("Optional-content presence is not a boolean");
  }
  if (!Number.isInteger(optionalContent.ocgCount) || optionalContent.ocgCount < 0) {
    throw new DocumentPreparationError("Optional-content inspection has an invalid OCG count");
  }
  if (
    !Array.isArray(optionalContent.layerNames)
    || optionalContent.layerNames.some((name) => typeof name !== "string" || !name.trim())
    || !Array.isArray(optionalContent.layers)
    || optionalContent.layerNames.length !== optionalContent.ocgCount
    || optionalContent.layers.length !== optionalContent.ocgCount
    || optionalContent.layers.some((layer, index) => (
      !layer
      || layer.index !== index
      || layer.name !== optionalContent.layerNames[index]
    ))
  ) {
    throw new DocumentPreparationError("Optional-content layer names/details do not match OCG count");
  }
  if (!optionalContent.propertiesPresent && optionalContent.ocgCount !== 0) {
    throw new DocumentPreparationError("OCG layers were reported without /OCProperties");
  }

  const spotColors = value.spotColors;
  if (!spotColors || typeof spotColors !== "object" || Array.isArray(spotColors)) {
    throw new DocumentPreparationError("Optional-content inspection has no spotColors object");
  }
  if (
    !Array.isArray(spotColors.declarations)
    || !Number.isInteger(spotColors.declarationCount)
    || spotColors.declarationCount !== spotColors.declarations.length
    || !Number.isInteger(spotColors.separationDeclarationCount)
    || !Number.isInteger(spotColors.deviceNDeclarationCount)
    || !Array.isArray(spotColors.colorantNames)
    || spotColors.colorantNames.some((name) => typeof name !== "string")
  ) {
    throw new DocumentPreparationError("Spot-color declaration summary is inconsistent");
  }
  for (const declaration of spotColors.declarations) {
    if (
      !declaration
      || !["Separation", "DeviceN"].includes(declaration.type)
      || !Array.isArray(declaration.colorantNames)
      || declaration.colorantNames.length === 0
      || declaration.colorantNames.some((name) => typeof name !== "string" || !name)
      || !Array.isArray(declaration.pageNumbers)
      || declaration.pageNumbers.some((pageNumber) => (
        !Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > value.pageCount
      ))
    ) {
      throw new DocumentPreparationError("Spot-color declaration details are invalid");
    }
  }
  const separationCount = spotColors.declarations.filter(
    (declaration) => declaration.type === "Separation"
  ).length;
  const deviceNCount = spotColors.declarations.filter(
    (declaration) => declaration.type === "DeviceN"
  ).length;
  if (
    separationCount !== spotColors.separationDeclarationCount
    || deviceNCount !== spotColors.deviceNDeclarationCount
  ) {
    throw new DocumentPreparationError("Spot-color declaration type counts are inconsistent");
  }
  return {
    ...value,
    documentRole: documentRole || null,
    templateMultiPage: documentRole === "template" ? value.multiPage : null,
  };
}

export function runProcess(command, args, {
  timeoutMs = DEFAULT_PROCESS_TIMEOUT_MS,
  terminationGraceMs = PROCESS_TERMINATION_GRACE_MS,
  maxStdoutBytes = 20_000_000,
  maxStderrBytes = 2_000_000,
} = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    return Promise.reject(new DocumentPreparationError(
      `Subprocess timeout must be a positive integer: ${timeoutMs}`
    ));
  }
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;
    let terminationReason = null;
    let forceKillTimer = null;

    const clearTimers = () => {
      clearTimeout(timeoutTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
    };
    const terminate = (reason) => {
      if (terminationReason) return;
      terminationReason = reason;
      child.kill("SIGTERM");
      forceKillTimer = setTimeout(() => {
        child.kill("SIGKILL");
      }, terminationGraceMs);
    };
    const timeoutTimer = setTimeout(() => {
      terminate(`timed out after ${timeoutMs} ms`);
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.byteLength;
      stdout += chunk.toString();
      if (stdoutBytes > maxStdoutBytes) terminate(
        `exceeded the ${maxStdoutBytes}-byte stdout safety limit`
      );
    });
    child.stderr.on("data", (chunk) => {
      stderrBytes += chunk.byteLength;
      stderr += chunk.toString();
      if (stderrBytes > maxStderrBytes) terminate(
        `exceeded the ${maxStderrBytes}-byte stderr safety limit`
      );
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimers();
      reject(new DocumentPreparationError(`Could not start ${command}: ${error.message}`));
    });
    child.once("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimers();
      if (terminationReason) {
        reject(new DocumentPreparationError(`${command} ${terminationReason}`));
        return;
      }
      if (code === 0) resolve({ stdout, stderr });
      else reject(new DocumentPreparationError(
        `${command} failed (${signal || `exit ${code}`}): ${(stderr || stdout).trim()}`
      ));
    });
  });
}

export async function inspectPdf(filePath, {
  pdfinfoBinary = "pdfinfo",
  pythonBinary = DEFAULT_PYTHON_BINARY,
  documentRole = null,
  processTimeoutMs = DEFAULT_PROCESS_TIMEOUT_MS,
} = {}) {
  const processOptions = { timeoutMs: processTimeoutMs };
  const first = await runProcess(
    pdfinfoBinary,
    ["-box", "-f", "1", "-l", "1", filePath],
    processOptions
  );
  const pageCount = parsePdfInfoPageCount(first.stdout);
  const boxed = pageCount > 1
    ? await runProcess(pdfinfoBinary, [
      "-box",
      "-f",
      "1",
      "-l",
      String(pageCount),
      filePath,
    ], processOptions)
    : first;
  const xmp = await runProcess(pdfinfoBinary, ["-meta", filePath], processOptions);
  const inspection = parsePdfInfoOutput(boxed.stdout, xmp.stdout);
  const optionalContentProcess = await runProcess(
    pythonBinary,
    [OPTIONAL_CONTENT_INSPECTOR, filePath],
    processOptions
  );
  const optionalContentInspection = validateOptionalContentInspection(
    parseOptionalContentInspectorOutput(optionalContentProcess.stdout),
    { documentRole, expectedPageCount: inspection.pageCount }
  );
  const issues = [];
  if (inspection.encrypted !== false) issues.push("encrypted_or_unknown_encryption_state");
  if (inspection.metadata.javascript === true) issues.push("javascript_present");
  if (!inspection.pdfVersion) issues.push("missing_pdf_version");
  return {
    ...inspection,
    documentRole,
    multiPage: inspection.pageCount > 1,
    templateMultiPage: documentRole === "template" ? inspection.pageCount > 1 : null,
    optionalContentInspection,
    toolWarnings: [
      ...first.stderr.split(/\r?\n/),
      ...boxed.stderr.split(/\r?\n/),
      ...xmp.stderr.split(/\r?\n/),
      ...optionalContentProcess.stderr.split(/\r?\n/),
    ]
      .map((line) => line.trim())
      .filter(Boolean),
    inspectionIssues: issues,
    structurallyReadable: issues.length === 0,
  };
}

async function readFileAndHash(filePath) {
  const bytes = await fs.readFile(filePath);
  if (!hasPdfMagic(bytes)) {
    throw new DocumentPreparationError(`Local file does not start with PDF magic: ${filePath}`);
  }
  return { bytes, sha256: sha256Buffer(bytes), byteSize: bytes.length };
}

function assertInspectionMatchesFile(inspection, file, sourceUrl) {
  if (!inspection.structurallyReadable) {
    throw new DocumentPreparationError(
      `PDF did not pass structural inspection: ${sourceUrl}`,
      inspection.inspectionIssues
    );
  }
  if (
    inspection.fileSizeReportedBytes !== null
    && inspection.fileSizeReportedBytes !== file.byteSize
  ) {
    throw new DocumentPreparationError(
      `pdfinfo/file byte-size mismatch for ${sourceUrl}: ${inspection.fileSizeReportedBytes} != ${file.byteSize}`
    );
  }
}

async function atomicWrite(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const handle = await fs.open(temporaryPath, "wx");
  try {
    await handle.writeFile(contents);
  } finally {
    await handle.close();
  }
  await fs.rename(temporaryPath, filePath);
}

async function atomicWriteJson(filePath, value) {
  await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function atomicWriteJsonl(filePath, rows) {
  const text = rows.map((row) => JSON.stringify(row)).join("\n");
  await atomicWrite(filePath, text ? `${text}\n` : "");
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new DocumentPreparationError(`Could not read ${filePath}: ${error.message}`);
  }
}

async function assertFileSha256(filePath, expectedSha256) {
  let currentBytes;
  try {
    currentBytes = await fs.readFile(filePath);
  } catch (error) {
    throw new DocumentPreparationError(
      `Could not re-read source evidence before finalization: ${filePath}: ${error.message}`,
      { inputMutationDetected: true, suppressFailureStatus: true }
    );
  }
  const actualSha256 = sha256Buffer(currentBytes);
  if (actualSha256 !== expectedSha256) {
    throw new DocumentPreparationError(
      `Source evidence changed during PDF preparation: ${filePath}`,
      {
        inputMutationDetected: true,
        expectedSha256,
        actualSha256,
        suppressFailureStatus: true,
      }
    );
  }
  return actualSha256;
}

export async function readExtractionSummaryGate(runDirectory, plan) {
  const summaryPath = path.join(runDirectory, "review", "extraction-summary.json");
  let bytes;
  try {
    bytes = await fs.readFile(summaryPath);
  } catch (error) {
    return {
      summaryPath: "review/extraction-summary.json",
      sha256: null,
      eligibleForDownload: false,
      blockers: [error?.code === "ENOENT"
        ? "Completed extraction summary is missing"
        : `Extraction summary could not be read: ${error.message}`],
      observed: null,
    };
  }

  let summary;
  try {
    summary = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    return {
      summaryPath: "review/extraction-summary.json",
      sha256: sha256Buffer(bytes),
      eligibleForDownload: false,
      blockers: [`Extraction summary is not valid JSON: ${error.message}`],
      observed: null,
    };
  }

  const blockers = [];
  if (summary?.state !== "extracted") blockers.push("Extraction summary state must be extracted");
  if (summary?.sourceCategoryUrl !== EXPECTED_SOURCE_CATEGORY_URL) {
    blockers.push("Extraction summary source category does not match the WMD sales-folder catalog");
  }
  if (summary?.partial !== false) blockers.push("Extraction summary must declare partial:false");
  if (summary?.eligibleForReview !== true) {
    blockers.push("Extraction summary must declare eligibleForReview:true");
  }
  if (summary?.eligibleForImport !== false) {
    blockers.push("Extraction summary must preserve eligibleForImport:false");
  }
  if (summary?.runScope?.partial !== false) {
    blockers.push("Extraction runScope must declare partial:false");
  }
  const selectedProductCount = Number(summary?.runScope?.selectedProductCount);
  const fullDiscoveredProductCount = Number(summary?.runScope?.fullDiscoveredProductCount);
  if (
    !Number.isInteger(selectedProductCount)
    || selectedProductCount < 1
    || selectedProductCount !== fullDiscoveredProductCount
  ) {
    blockers.push("Extraction selected product count must equal the full discovered product count");
  }
  if (!Number.isInteger(summary?.documentBindings) || summary.documentBindings !== plan.bindingCount) {
    blockers.push("Extraction summary document-binding count does not match raw evidence");
  }
  if (summary?.failedProducts !== 0) {
    blockers.push("Extraction summary must have zero failed products");
  }
  if (summary?.unresolvedCurrentRunFailures !== 0) {
    blockers.push("Extraction summary must have zero unresolved current-run failures");
  }
  if (
    !Number.isInteger(summary?.catalogProducts)
    || !Number.isInteger(summary?.successfulProducts)
    || summary.catalogProducts !== selectedProductCount
    || summary.successfulProducts !== selectedProductCount
  ) {
    blockers.push("Extraction summary must show every selected product as successful");
  }
  if (summary?.pdfLinksExtracted !== true) {
    blockers.push("Extraction summary must confirm PDF links were extracted");
  }

  return {
    summaryPath: "review/extraction-summary.json",
    sha256: sha256Buffer(bytes),
    eligibleForDownload: blockers.length === 0,
    blockers,
    observed: {
      state: summary?.state ?? null,
      sourceCategoryUrl: summary?.sourceCategoryUrl ?? null,
      partial: summary?.partial ?? null,
      eligibleForReview: summary?.eligibleForReview ?? null,
      eligibleForImport: summary?.eligibleForImport ?? null,
      runScopePartial: summary?.runScope?.partial ?? null,
      selectedProductCount: Number.isFinite(selectedProductCount) ? selectedProductCount : null,
      fullDiscoveredProductCount: Number.isFinite(fullDiscoveredProductCount)
        ? fullDiscoveredProductCount
        : null,
      catalogProducts: summary?.catalogProducts ?? null,
      successfulProducts: summary?.successfulProducts ?? null,
      failedProducts: summary?.failedProducts ?? null,
      unresolvedCurrentRunFailures: summary?.unresolvedCurrentRunFailures ?? null,
      documentBindings: summary?.documentBindings ?? null,
      pdfLinksExtracted: summary?.pdfLinksExtracted ?? null,
    },
  };
}

async function ensureFreshState(statePath, inputSha256) {
  const existing = await readJsonIfPresent(statePath);
  if (!existing) {
    return {
      schemaVersion: STATE_SCHEMA_VERSION,
      scriptVersion: SCRIPT_VERSION,
      inputSha256,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      documents: {},
    };
  }
  if (
    existing.schemaVersion !== STATE_SCHEMA_VERSION
    || existing.scriptVersion !== SCRIPT_VERSION
    || existing.inputSha256 !== inputSha256
    || !existing.documents
    || typeof existing.documents !== "object"
    || Array.isArray(existing.documents)
  ) {
    throw new DocumentPreparationError(
      "Existing document-preparation state does not match this extractor evidence; use a new run directory"
    );
  }
  return existing;
}

async function acquireOwnedJsonLock(lockPath, {
  role,
  metadata = {},
  existsMessage,
  existsDetails = null,
}) {
  const token = randomUUID();
  let handle;
  let handleStat;
  try {
    handle = await fs.open(lockPath, "wx");
    handleStat = await handle.stat();
    await handle.writeFile(`${JSON.stringify({
      schemaVersion: 1,
      pid: process.pid,
      role,
      token,
      startedAt: new Date().toISOString(),
      ...metadata,
    }, null, 2)}\n`);
  } catch (error) {
    await handle?.close().catch(() => {});
    if (handleStat) {
      try {
        const currentStat = await fs.lstat(lockPath);
        if (currentStat.dev === handleStat.dev && currentStat.ino === handleStat.ino) {
          await fs.unlink(lockPath);
        }
      } catch {
        // Preserve any path that is no longer the inode created by this process.
      }
    }
    if (error?.code === "EEXIST") {
      throw new DocumentPreparationError(existsMessage, existsDetails);
    }
    throw error;
  }

  const assertOwned = async (stage) => {
    let currentStat;
    let currentLock;
    try {
      [currentStat, currentLock] = await Promise.all([
        fs.lstat(lockPath),
        fs.readFile(lockPath, "utf8").then((text) => JSON.parse(text)),
      ]);
    } catch (error) {
      throw new DocumentPreparationError(
        `PDF preparation lost its ${role} lock during ${stage}: ${error.message}`,
        { lockOwnershipLost: true, suppressFailureStatus: true }
      );
    }
    if (
      currentStat.dev !== handleStat.dev
      || currentStat.ino !== handleStat.ino
      || currentLock?.role !== role
      || currentLock?.token !== token
    ) {
      throw new DocumentPreparationError(
        `PDF preparation no longer owns its ${role} lock during ${stage}`,
        { lockOwnershipLost: true, suppressFailureStatus: true }
      );
    }
  };

  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    await handle.close().catch(() => {});
    let currentStat;
    let currentLock;
    try {
      [currentStat, currentLock] = await Promise.all([
        fs.lstat(lockPath),
        fs.readFile(lockPath, "utf8").then((text) => JSON.parse(text)),
      ]);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      return;
    }
    if (
      currentStat.dev === handleStat.dev
      && currentStat.ino === handleStat.ino
      && currentLock?.role === role
      && currentLock?.token === token
    ) {
      await fs.unlink(lockPath).catch((error) => {
        if (error?.code !== "ENOENT") throw error;
      });
    }
  };
  return { lockPath, role, token, assertOwned, release };
}

async function acquireSharedRunLock(runDirectory) {
  const lockPath = path.join(runDirectory, ".extractor.lock");
  return acquireOwnedJsonLock(lockPath, {
    role: "sales_folder_pdf_preparation",
    metadata: { readOnlySupplierEvidence: true },
    existsMessage: `Refusing PDF preparation while the supplier extractor lock exists: ${lockPath}`,
    existsDetails: {
      extractorLockPresent: true,
      suppressFailureStatus: true,
    },
  });
}

async function acquirePreparationLock(lockPath, inputSha256) {
  return acquireOwnedJsonLock(lockPath, {
    role: "sales_folder_pdf_preparation_internal",
    metadata: { inputSha256 },
    existsMessage: `Another document-preparation process or a stale lock exists: ${lockPath}`,
  });
}

function resolveRunFile(runDirectory, relativePath) {
  const resolvedRun = path.resolve(runDirectory);
  const resolvedFile = path.resolve(resolvedRun, relativePath);
  if (!resolvedFile.startsWith(`${resolvedRun}${path.sep}`)) {
    throw new DocumentPreparationError(`Generated path escapes the run directory: ${relativePath}`);
  }
  return resolvedFile;
}

async function prepareOneDocument(planned, state, context) {
  const targetPath = resolveRunFile(context.runDirectory, planned.localRelativePath);
  const stagedRelativePath = `${planned.localRelativePath}.part`;
  const stagedPath = resolveRunFile(context.runDirectory, stagedRelativePath);
  let existing = state.documents[planned.sourceUrl];

  if (existing?.phase === "downloading") {
    if (existing.localRelativePath !== planned.localRelativePath) {
      throw new DocumentPreparationError(`Resume path mismatch for ${planned.sourceUrl}`);
    }
    await fs.unlink(stagedPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
    delete state.documents[planned.sourceUrl];
    state.updatedAt = new Date().toISOString();
    await atomicWriteJson(context.statePath, state);
    existing = null;
  }

  if (existing?.phase === "staged") {
    if (
      existing.localRelativePath !== planned.localRelativePath
      || existing.stagedRelativePath !== stagedRelativePath
    ) {
      throw new DocumentPreparationError(`Resume path mismatch for ${planned.sourceUrl}`);
    }
    let candidatePath = stagedPath;
    let targetExists = false;
    try {
      await fs.stat(targetPath);
      targetExists = true;
      candidatePath = targetPath;
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    if (targetExists) {
      try {
        await fs.stat(stagedPath);
        throw new DocumentPreparationError(
          `Both staged and final PDFs exist during resume: ${planned.sourceUrl}`
        );
      } catch (error) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    const file = await readFileAndHash(candidatePath);
    if (file.sha256 !== existing.sha256 || file.byteSize !== existing.byteSize) {
      throw new DocumentPreparationError(`Staged resume hash/size mismatch for ${candidatePath}`);
    }
    const inspection = await inspectPdf(candidatePath, context);
    assertInspectionMatchesFile(inspection, file, planned.sourceUrl);
    if (!targetExists) await fs.rename(stagedPath, targetPath);
    existing.phase = "ready";
    existing.stagedRelativePath = null;
    existing.verifiedAt = new Date().toISOString();
    state.updatedAt = existing.verifiedAt;
    await atomicWriteJson(context.statePath, state);
  }

  existing = state.documents[planned.sourceUrl];
  if (existing) {
    if (existing.phase !== "ready") {
      throw new DocumentPreparationError(`Unknown resume phase for ${planned.sourceUrl}`);
    }
    if (existing.localRelativePath !== planned.localRelativePath) {
      throw new DocumentPreparationError(`Resume path mismatch for ${planned.sourceUrl}`);
    }
    const file = await readFileAndHash(targetPath);
    if (file.sha256 !== existing.sha256 || file.byteSize !== existing.byteSize) {
      throw new DocumentPreparationError(`Resume hash/size mismatch for ${targetPath}`);
    }
    const inspection = await inspectPdf(targetPath, context);
    assertInspectionMatchesFile(inspection, file, planned.sourceUrl);
    return {
      ...planned,
      sha256: file.sha256,
      byteSize: file.byteSize,
      inspection,
      httpEvidence: existing.httpEvidence,
      downloadedAt: existing.downloadedAt,
      verifiedAt: new Date().toISOString(),
      reusedFromVerifiedState: true,
    };
  }

  try {
    await fs.stat(targetPath);
    throw new DocumentPreparationError(
      `Refusing to adopt an untracked file at deterministic target path: ${targetPath}`
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  try {
    await fs.stat(stagedPath);
    throw new DocumentPreparationError(
      `Refusing to adopt an untracked staged file at deterministic path: ${stagedPath}`
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  state.documents[planned.sourceUrl] = {
    phase: "downloading",
    sourceUrl: planned.sourceUrl,
    localRelativePath: planned.localRelativePath,
    stagedRelativePath,
    startedAt: new Date().toISOString(),
  };
  state.updatedAt = new Date().toISOString();
  await atomicWriteJson(context.statePath, state);

  const { bytes, httpEvidence } = await fetchExactSupplierPdf(planned.sourceUrl, context);
  const sha256 = sha256Buffer(bytes);
  const handle = await fs.open(stagedPath, "wx");
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }

  let inspection;
  try {
    const stagedFile = await readFileAndHash(stagedPath);
    if (stagedFile.sha256 !== sha256 || stagedFile.byteSize !== bytes.length) {
      throw new DocumentPreparationError(
        `Downloaded PDF hash/size changed while writing: ${planned.sourceUrl}`
      );
    }
    inspection = await inspectPdf(stagedPath, context);
    assertInspectionMatchesFile(inspection, stagedFile, planned.sourceUrl);
    const downloadedAt = new Date().toISOString();
    state.documents[planned.sourceUrl] = {
      phase: "staged",
      sourceUrl: planned.sourceUrl,
      localRelativePath: planned.localRelativePath,
      stagedRelativePath,
      sha256,
      byteSize: bytes.length,
      httpEvidence,
      downloadedAt,
    };
    state.updatedAt = downloadedAt;
    await atomicWriteJson(context.statePath, state);
    await fs.rename(stagedPath, targetPath);
    state.documents[planned.sourceUrl].phase = "ready";
    state.documents[planned.sourceUrl].stagedRelativePath = null;
    state.documents[planned.sourceUrl].verifiedAt = new Date().toISOString();
    state.updatedAt = state.documents[planned.sourceUrl].verifiedAt;
    await atomicWriteJson(context.statePath, state);
  } catch (error) {
    if (state.documents[planned.sourceUrl]?.phase === "downloading") {
      await fs.unlink(stagedPath).catch(() => {});
    }
    throw error;
  }

  const result = {
    ...planned,
    sha256,
    byteSize: bytes.length,
    inspection,
    httpEvidence,
    downloadedAt: state.documents[planned.sourceUrl].downloadedAt,
    verifiedAt: new Date().toISOString(),
    reusedFromVerifiedState: false,
  };
  return result;
}

export function buildReviewStatus({
  plan,
  preparedDocuments = [],
  errors = [],
  downloadRequested,
  extractionGate = null,
  sourceBindingsSha256 = null,
}) {
  const extractionReady = extractionGate?.eligibleForDownload === true;
  const preparedTemplates = preparedDocuments.filter((document) => document.role === "template");
  const templateLayerCount = preparedTemplates.reduce((total, document) => (
    total + (document.inspection?.optionalContentInspection?.optionalContent?.ocgCount || 0)
  ), 0);
  const spotColorDeclarationCount = preparedDocuments.reduce((total, document) => (
    total + (document.inspection?.optionalContentInspection?.spotColors?.declarationCount || 0)
  ), 0);
  const optionalContentInspectionsComplete = preparedDocuments.every((document) => (
    document.inspection?.optionalContentInspection?.inspectionPerformed === true
    && document.inspection.optionalContentInspection.pageCount === document.inspection.pageCount
    && (document.role !== "template"
      || typeof document.inspection.templateMultiPage === "boolean")
  ));
  const complete = downloadRequested
    && extractionReady
    && errors.length === 0
    && optionalContentInspectionsComplete
    && preparedDocuments.length === plan.uniqueDocumentCount;
  const downloadBlockedByExtraction = downloadRequested && !extractionReady;
  return {
    schemaVersion: 1,
    scriptVersion: SCRIPT_VERSION,
    state: errors.length > 0 || downloadBlockedByExtraction
      ? "blocked"
      : (complete
        ? "downloaded_and_structurally_inspected_review_required"
        : (extractionReady
          ? "download_plan_validated"
          : "download_plan_validated_with_extraction_blockers")),
    eligibleForImport: false,
    preparedAt: new Date().toISOString(),
    sourceBindingsSha256,
    extractionGate,
    counts: {
      selectionBindings: plan.bindingCount,
      uniqueDocuments: plan.uniqueDocumentCount,
      uniqueGuides: plan.uniqueGuideCount,
      uniqueTemplates: plan.uniqueTemplateCount,
      downloadedAndInspected: preparedDocuments.length,
      templateDocumentsInspected: preparedTemplates.length,
      templatesWithOptionalContent: preparedTemplates.filter((document) => (
        document.inspection?.optionalContentInspection?.optionalContent?.propertiesPresent === true
      )).length,
      optionalContentLayersAcrossTemplates: templateLayerCount,
      multiPageTemplates: preparedTemplates.filter((document) => (
        document.inspection?.templateMultiPage === true
      )).length,
      spotColorDeclarations: spotColorDeclarationCount,
      errors: errors.length,
    },
    gates: {
      exactGuideAndTemplateCoverage: "passed",
      exactSupplierHostUrls: "passed",
      completedFullExtractionReviewGate: extractionReady ? "passed" : "blocked",
      sourceEvidenceStableAtFinalization: sourceBindingsSha256 ? "passed" : "blocked",
      sourcePdfDownloads: complete
        ? "passed"
        : (errors.length > 0 || downloadBlockedByExtraction ? "blocked" : "pending"),
      sha256AndByteSize: complete ? "passed" : (errors.length > 0 ? "blocked" : "pending"),
      structuralPdfInspection: complete ? "passed" : (errors.length > 0 ? "blocked" : "pending"),
      completePageBoxInspection: complete ? "passed" : (errors.length > 0 ? "blocked" : "pending"),
      optionalContentLayerAndSpotColorInspection: complete
        ? "passed"
        : (errors.length > 0 ? "blocked" : "pending"),
      supplierBrandingAndMetadataRemoval: "pending",
      webprinterBlueGreyDanishTemplateReview: "pending",
      visualRenderedPageReview: "pending",
      lockedNonPrintingDesignerBinding: "pending",
      productionExportExclusionVerification: "pending",
      manualImportApproval: "pending",
    },
    prohibitedActionsPerformed: {
      sourcePdfModified: false,
      sourcePdfSanitized: false,
      sourcePdfUploaded: false,
      databaseWritten: false,
      productOrTemplateRecordWritten: false,
      published: false,
    },
    errors,
  };
}

function markdownReport(status, runDirectory) {
  const lines = [
    "# WMD sales-folder PDF preparation review",
    "",
    `- Run: \`${runDirectory}\``,
    `- State: **${status.state}**`,
    "- Import eligible: **No**",
    `- Source bindings SHA-256: \`${status.sourceBindingsSha256 || "not-finalized"}\``,
    `- Full extraction review gate: **${status.extractionGate?.eligibleForDownload ? "passed" : "blocked"}**`,
    `- Selection bindings: ${status.counts.selectionBindings}`,
    `- Unique supplier PDFs: ${status.counts.uniqueDocuments} (${status.counts.uniqueGuides} guides, ${status.counts.uniqueTemplates} templates)`,
    `- Downloaded and structurally inspected: ${status.counts.downloadedAndInspected}`,
    `- Templates with optional-content layers: ${status.counts.templatesWithOptionalContent}/${status.counts.templateDocumentsInspected}`,
    `- OCG layers across templates: ${status.counts.optionalContentLayersAcrossTemplates}`,
    `- Multi-page templates: ${status.counts.multiPageTemplates}`,
    `- Spot-color/separation declarations: ${status.counts.spotColorDeclarations}`,
    "",
    "## Gate status",
    "",
    "| Gate | Status |",
    "| --- | --- |",
    ...Object.entries(status.gates).map(([gate, value]) => `| ${gate} | ${value} |`),
    "",
    "A successful download is not import approval. Supplier branding/metadata removal, Webprinter blue/grey Danish guide creation, rendered-page review, exact Designer binding, non-printing export verification, and manual approval remain separate gates.",
    "",
    "No PDF was edited or sanitized by this preparation step. Nothing was uploaded, written to the database, attached to a product, or published.",
  ];
  if (status.extractionGate?.blockers?.length > 0) {
    lines.push("", "## Extraction blockers", "");
    for (const blocker of status.extractionGate.blockers) lines.push(`- ${blocker}`);
  }
  if (status.errors.length > 0) {
    lines.push("", "## Errors", "");
    for (const error of status.errors) lines.push(`- ${error}`);
  }
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const args = {
    runDirectory: null,
    download: false,
    pdfinfoBinary: process.env.PDFINFO_BINARY || "pdfinfo",
    pythonBinary: process.env.PYTHON_BINARY || DEFAULT_PYTHON_BINARY,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    processTimeoutMs: DEFAULT_PROCESS_TIMEOUT_MS,
    maxBytes: DEFAULT_MAX_BYTES,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--run") args.runDirectory = path.resolve(argv[++index]);
    else if (token === "--download") args.download = true;
    else if (token === "--pdfinfo") args.pdfinfoBinary = argv[++index];
    else if (token === "--python") args.pythonBinary = argv[++index];
    else if (token === "--timeout-ms") args.timeoutMs = Number(argv[++index]);
    else if (token === "--process-timeout-ms") args.processTimeoutMs = Number(argv[++index]);
    else if (token === "--max-bytes") args.maxBytes = Number(argv[++index]);
    else if (token === "--help") {
      console.log([
        "Usage: node scripts/product-import/prepare-wmd-sales-folder-documents.js --run DIR [--download]",
        "",
        "Without --download, validates bindings and reports any extraction blockers in a review-only plan.",
        "With --download, requires a completed full extraction review gate, then downloads/resumes exact WMD PDFs without modifying them.",
      ].join("\n"));
      process.exit(0);
    } else {
      throw new DocumentPreparationError(`Unknown argument: ${token}`);
    }
  }
  if (!args.runDirectory) throw new DocumentPreparationError("--run DIR is required");
  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 1_000 || args.timeoutMs > 300_000) {
    throw new DocumentPreparationError("--timeout-ms must be an integer from 1000 to 300000");
  }
  if (
    !Number.isInteger(args.processTimeoutMs)
    || args.processTimeoutMs < 1_000
    || args.processTimeoutMs > 300_000
  ) {
    throw new DocumentPreparationError(
      "--process-timeout-ms must be an integer from 1000 to 300000"
    );
  }
  if (!Number.isInteger(args.maxBytes) || args.maxBytes < 1_024 || args.maxBytes > 500 * 1024 * 1024) {
    throw new DocumentPreparationError("--max-bytes must be an integer from 1024 to 524288000");
  }
  return args;
}

async function writeFailureStatus(runDirectory, error) {
  if (!runDirectory) return;
  const outputDirectory = path.join(runDirectory, "documents");
  const status = {
    schemaVersion: 1,
    scriptVersion: SCRIPT_VERSION,
    state: "blocked",
    eligibleForImport: false,
    preparedAt: new Date().toISOString(),
    gates: {
      documentPreparation: "blocked",
      manualImportApproval: "pending",
    },
    error: error instanceof Error ? error.message : String(error),
    prohibitedActionsPerformed: {
      sourcePdfModified: false,
      sourcePdfUploaded: false,
      databaseWritten: false,
      productOrTemplateRecordWritten: false,
      published: false,
    },
  };
  await fs.mkdir(outputDirectory, { recursive: true });
  await atomicWriteJson(path.join(outputDirectory, "preparation-status.json"), status);
}

export async function prepareDocuments(args) {
  const runDirectory = path.resolve(args.runDirectory);
  const sharedRunLock = await acquireSharedRunLock(runDirectory);
  let preparationLock = null;
  try {
    await sharedRunLock.assertOwned("initial evidence read");
    const inputPath = path.join(runDirectory, "raw", "document-bindings.jsonl");
    const inputBytes = await fs.readFile(inputPath);
    const inputSha256 = sha256Buffer(inputBytes);
    const bindings = parseJsonl(inputBytes.toString("utf8"), inputPath);
    const plan = buildDocumentPlan(bindings);
    const extractionGate = await readExtractionSummaryGate(runDirectory, plan);
    const outputDirectory = path.join(runDirectory, "documents");
    const planPath = path.join(outputDirectory, "document-download-plan.json");
    const inventoryPath = path.join(outputDirectory, "document-files.jsonl");
    const statusPath = path.join(outputDirectory, "preparation-status.json");
    const reportPath = path.join(runDirectory, "review", "document-preparation-report.md");
    const statePath = path.join(outputDirectory, "preparation-state.json");
    const lockPath = path.join(outputDirectory, ".preparation.lock");
    await fs.mkdir(outputDirectory, { recursive: true });
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await sharedRunLock.assertOwned("internal preparation lock acquisition");
    preparationLock = await acquirePreparationLock(lockPath, inputSha256);
    await sharedRunLock.assertOwned("document preparation");
    await preparationLock.assertOwned("document preparation");
    const preparedDocuments = [];
    const errors = [];
    if (args.download) {
      if (!extractionGate.eligibleForDownload) {
        errors.push(...extractionGate.blockers.map((blocker) => `Full extraction gate: ${blocker}`));
      } else {
        const state = await ensureFreshState(statePath, inputSha256);
        await atomicWriteJson(statePath, state);
        for (const [index, planned] of plan.documents.entries()) {
          try {
            await sharedRunLock.assertOwned(`document ${index + 1} preparation`);
            await preparationLock.assertOwned(`document ${index + 1} preparation`);
            const prepared = await prepareOneDocument(planned, state, {
              runDirectory,
              statePath,
              pdfinfoBinary: args.pdfinfoBinary,
              pythonBinary: args.pythonBinary,
              documentRole: planned.role,
              timeoutMs: args.timeoutMs,
              processTimeoutMs: args.processTimeoutMs ?? DEFAULT_PROCESS_TIMEOUT_MS,
              maxBytes: args.maxBytes,
            });
            preparedDocuments.push(prepared);
            console.log(`OK ${index + 1}/${plan.documents.length} ${planned.role} ${planned.sourceUrl}`);
          } catch (error) {
            const message = `${planned.sourceUrl}: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(message);
            console.error(`FAILED ${index + 1}/${plan.documents.length} ${message}`);
            break;
          }
        }
      }
    }

    if (typeof args.beforeFinalEvidenceCheck === "function") {
      await args.beforeFinalEvidenceCheck({ inputPath, inputSha256 });
    }
    await sharedRunLock.assertOwned("final evidence verification");
    await preparationLock.assertOwned("final evidence verification");
    await assertFileSha256(inputPath, inputSha256);
    if (extractionGate.sha256) {
      await assertFileSha256(
        path.join(runDirectory, extractionGate.summaryPath),
        extractionGate.sha256
      );
    }
    const status = buildReviewStatus({
      plan,
      preparedDocuments,
      errors,
      downloadRequested: args.download,
      extractionGate,
      sourceBindingsSha256: inputSha256,
    });
    await atomicWriteJson(planPath, {
      ...plan,
      scriptVersion: SCRIPT_VERSION,
      sourceBindingsPath: "raw/document-bindings.jsonl",
      sourceBindingsSha256: inputSha256,
      extractionGate,
      downloadRequested: args.download,
      downloadRequired: preparedDocuments.length !== plan.uniqueDocumentCount,
      eligibleForImport: false,
    });
    if (args.download && extractionGate.eligibleForDownload) {
      await atomicWriteJsonl(inventoryPath, preparedDocuments);
    }
    await sharedRunLock.assertOwned("final status write");
    await preparationLock.assertOwned("final status write");
    await assertFileSha256(inputPath, inputSha256);
    if (extractionGate.sha256) {
      await assertFileSha256(
        path.join(runDirectory, extractionGate.summaryPath),
        extractionGate.sha256
      );
    }
    await atomicWriteJson(statusPath, status);
    await atomicWrite(reportPath, markdownReport(status, runDirectory));
    if (errors.length > 0) {
      throw new DocumentPreparationError(
        "Document preparation is blocked",
        { errors, statusWritten: true }
      );
    }
    return { plan, preparedDocuments, status, paths: { planPath, inventoryPath, statusPath, reportPath } };
  } finally {
    try {
      await preparationLock?.release();
    } finally {
      await sharedRunLock.release();
    }
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
    const result = await prepareDocuments(args);
    console.log(`State: ${result.status.state}`);
    console.log("Import eligible: no");
    console.log(`Review: ${result.paths.reportPath}`);
  } catch (error) {
    if (!error?.details?.statusWritten && !error?.details?.suppressFailureStatus) {
      await writeFailureStatus(args?.runDirectory, error).catch(() => {});
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
