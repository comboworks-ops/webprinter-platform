export const PHOTOPEA_ORIGIN = "https://www.photopea.com";
export const PHOTOPEA_EXPORT_MARKER = "webprinter:photopea-export";
export const PHOTOPEA_MAX_INPUT_BYTES = 75 * 1024 * 1024;
export const PHOTOPEA_MAX_OUTPUT_BYTES = 100 * 1024 * 1024;
export const PHOTOPEA_MAX_OUTPUT_DIMENSION = 32_768;
export const PHOTOPEA_MAX_OUTPUT_PIXELS = 100_000_000;

const PHOTOPEA_ALLOWED_EXTENSIONS = new Set([
  "psd",
  "psb",
  "ai",
  "pdf",
  "svg",
  "eps",
  "indd",
  "xd",
  "fig",
  "xcf",
  "sketch",
  "afphoto",
  "kra",
  "clip",
  "sai",
  "pxd",
  "cdr",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "tif",
  "tiff",
  "bmp",
  "avif",
  "heic",
]);

const PHOTOPEA_ALLOWED_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "application/pdf",
  "application/postscript",
  "application/illustrator",
  "application/vnd.adobe.illustrator",
  "application/x-photoshop",
  "image/vnd.adobe.photoshop",
  "image/svg+xml",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/tiff",
  "image/bmp",
  "image/avif",
  "image/heic",
  "image/heif",
]);

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

export type PhotopeaSourceOrigin = "selected-asset" | "local-file";

export interface PhotopeaSource {
  bytes: ArrayBuffer;
  fileName: string;
  mimeType: string;
  origin: PhotopeaSourceOrigin;
}

export interface PhotopeaSourceDescriptor {
  byteLength: number;
  fileName: string;
  mimeType: string;
}

export type PhotopeaBridgePhase =
  | "waiting-for-photopea"
  | "loading-source"
  | "ready"
  | "exporting";

export interface PhotopeaBridgeState {
  phase: PhotopeaBridgePhase;
}

export type PhotopeaBridgeEvent =
  | { type: "photopea-done" }
  | { type: "photopea-export-marker" }
  | { type: "request-export" }
  | { type: "photopea-output" };

export type PhotopeaBridgeAction =
  | "none"
  | "send-source"
  | "send-export-command"
  | "accept-output";

export interface PhotopeaBridgeTransition {
  action: PhotopeaBridgeAction;
  state: PhotopeaBridgeState;
}

export function getPhotopeaFileExtension(fileName: string): string {
  const cleanName = fileName.trim().toLowerCase();
  const extensionIndex = cleanName.lastIndexOf(".");
  return extensionIndex >= 0 ? cleanName.slice(extensionIndex + 1) : "";
}

export function validatePhotopeaSource(
  source: PhotopeaSourceDescriptor,
): { ok: true } | { ok: false; message: string } {
  if (!Number.isFinite(source.byteLength) || source.byteLength <= 0) {
    return { ok: false, message: "Filen er tom eller kan ikke læses." };
  }

  if (source.byteLength > PHOTOPEA_MAX_INPUT_BYTES) {
    return { ok: false, message: "Filen må højst være 75 MB i denne pilot." };
  }

  const extension = getPhotopeaFileExtension(source.fileName);
  if (!PHOTOPEA_ALLOWED_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      message: "Filtypen understøttes ikke af den sikre Photopea-pilot.",
    };
  }

  const normalizedMimeType = source.mimeType.trim().toLowerCase();
  if (!PHOTOPEA_ALLOWED_MIME_TYPES.has(normalizedMimeType)) {
    return {
      ok: false,
      message: "Filens MIME-type matcher ikke en godkendt design- eller billedfil.",
    };
  }

  return { ok: true };
}

export function sanitizePhotopeaFileName(fileName: string): string {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[^\w. -]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");

  return normalized || "webprinter-asset.png";
}

export function buildPhotopeaOutputFileName(fileName: string): string {
  const safeName = sanitizePhotopeaFileName(fileName);
  const extensionIndex = safeName.lastIndexOf(".");
  const baseName = extensionIndex > 0 ? safeName.slice(0, extensionIndex) : safeName;
  return `${baseName || "webprinter-asset"}-photopea.png`;
}

export function buildPhotopeaIframeUrl(): string {
  const exportScript = `app.echoToOE("${PHOTOPEA_EXPORT_MARKER}");app.activeDocument.saveToOE("png");`;
  const configuration = {
    environment: {
      customIO: {
        save: exportScript,
      },
      intro: false,
      lang: "da",
      localsave: false,
      theme: 0,
    },
  };

  return `${PHOTOPEA_ORIGIN}#${encodeURIComponent(JSON.stringify(configuration))}`;
}

export function buildPhotopeaExportCommand(): string {
  return `app.activeDocument.saveToOE("png");`;
}

export function isTrustedPhotopeaMessage(
  event: Pick<MessageEvent, "origin" | "source">,
  expectedSource: MessageEventSource | null,
): boolean {
  return event.origin === PHOTOPEA_ORIGIN
    && expectedSource !== null
    && event.source === expectedSource;
}

export function getPhotopeaOutputBuffer(data: unknown): ArrayBuffer | null {
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  }
  return null;
}

export function validatePhotopeaPngOutput(
  bytes: ArrayBuffer,
): { ok: true } | { ok: false; message: string } {
  if (bytes.byteLength <= 0) {
    return { ok: false, message: "Photopea returnerede en tom fil." };
  }
  if (bytes.byteLength > PHOTOPEA_MAX_OUTPUT_BYTES) {
    return { ok: false, message: "Photopea-outputtet er større end pilotens grænse på 100 MB." };
  }

  const header = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, PNG_SIGNATURE.length));
  const isPng = header.length === PNG_SIGNATURE.length
    && PNG_SIGNATURE.every((value, index) => header[index] === value);

  if (!isPng || bytes.byteLength < 24) {
    return { ok: false, message: "Photopea returnerede ikke en gyldig PNG-fil." };
  }

  const headerView = new DataView(bytes, 8, 16);
  const ihdrLength = headerView.getUint32(0);
  const ihdrType = String.fromCharCode(
    headerView.getUint8(4),
    headerView.getUint8(5),
    headerView.getUint8(6),
    headerView.getUint8(7),
  );
  const width = headerView.getUint32(8);
  const height = headerView.getUint32(12);
  const dimensionsAreSafe = ihdrLength === 13
    && ihdrType === "IHDR"
    && width > 0
    && height > 0
    && width <= PHOTOPEA_MAX_OUTPUT_DIMENSION
    && height <= PHOTOPEA_MAX_OUTPUT_DIMENSION
    && width * height <= PHOTOPEA_MAX_OUTPUT_PIXELS;

  return dimensionsAreSafe
    ? { ok: true }
    : { ok: false, message: "Photopea-outputtets billeddimensioner er ugyldige eller for store." };
}

export function reducePhotopeaBridge(
  state: PhotopeaBridgeState,
  event: PhotopeaBridgeEvent,
): PhotopeaBridgeTransition {
  if (state.phase === "waiting-for-photopea" && event.type === "photopea-done") {
    return { state: { phase: "loading-source" }, action: "send-source" };
  }

  if (state.phase === "loading-source" && event.type === "photopea-done") {
    return { state: { phase: "ready" }, action: "none" };
  }

  if (state.phase === "ready" && event.type === "request-export") {
    return { state: { phase: "exporting" }, action: "send-export-command" };
  }

  if (state.phase === "ready" && event.type === "photopea-export-marker") {
    return { state: { phase: "exporting" }, action: "none" };
  }

  if (state.phase === "exporting" && event.type === "photopea-output") {
    return { state: { phase: "ready" }, action: "accept-output" };
  }

  return { state, action: "none" };
}
