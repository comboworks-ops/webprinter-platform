export type StirlingPdfOperation =
  | "compress"
  | "ocr"
  | "repair"
  | "pdfa"
  | "redact"
  | "flatten-forms"
  | "text-edit-export"
  | "text-edit-import";

export type StirlingOperationOptions = {
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
};

export type StirlingProviderConfig = {
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  licenseAcknowledged: boolean;
  textEditorEnabled: boolean;
  timeoutMs: number;
};

export type StirlingOperationDefinition = {
  endpoint: string;
  fields: Record<string, string | number | boolean | string[] | undefined>;
  outputContentType: "application/pdf" | "application/json";
  outputExtension: "pdf" | "json";
  preservesVectors: boolean;
  rasterizes: boolean;
  alpha: boolean;
};

const clampInteger = (
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value!)));
};

const normalizeHexColor = (value?: string) => {
  const normalized = (value || "000000").replace(/^#/, "").toUpperCase();
  return /^[0-9A-F]{6}$/.test(normalized) ? normalized : "000000";
};

const normalizeBaseUrl = (rawUrl: string) => {
  const url = new URL(rawUrl);
  if (
    !["http:", "https:"].includes(url.protocol) || url.username || url.password
  ) {
    throw new Error(
      "STIRLING_PDF_BASE_URL must be an HTTP(S) URL without credentials",
    );
  }
  return url.toString().replace(/\/$/, "");
};

export function readStirlingProviderConfig(
  getEnv: (name: string) => string | undefined,
): StirlingProviderConfig {
  const rawBaseUrl = getEnv("STIRLING_PDF_BASE_URL") || "";
  const apiKey = getEnv("STIRLING_PDF_API_KEY") || "";
  const enabled = getEnv("STIRLING_PDF_ENABLED") === "true";
  const licenseAcknowledged =
    getEnv("STIRLING_PDF_LICENSE_ACKNOWLEDGED") === "true";
  const textEditorEnabled = getEnv("STIRLING_TEXT_EDITOR_ENABLED") === "true";
  const configuredTimeout = Number(getEnv("STIRLING_PDF_TIMEOUT_MS"));

  return {
    baseUrl: rawBaseUrl ? normalizeBaseUrl(rawBaseUrl) : "",
    apiKey,
    enabled,
    licenseAcknowledged,
    textEditorEnabled,
    timeoutMs: clampInteger(configuredTimeout, 90_000, 5_000, 180_000),
  };
}

export function assertStirlingProviderReady(
  config: StirlingProviderConfig,
  operation: StirlingPdfOperation,
) {
  if (!config.enabled || !config.baseUrl || !config.apiKey) {
    throw new Error("Stirling-PDF-provideren er ikke konfigureret");
  }
  if (!config.licenseAcknowledged) {
    throw new Error("Stirling-PDF-licensen skal godkendes før produktionsbrug");
  }
  if (
    (operation === "text-edit-export" || operation === "text-edit-import") &&
    !config.textEditorEnabled
  ) {
    throw new Error("Avanceret tekstredigering er ikke aktiveret");
  }
}

export function getStirlingOperationDefinition(
  operation: StirlingPdfOperation,
  options: StirlingOperationOptions = {},
): StirlingOperationDefinition {
  switch (operation) {
    case "flatten-forms":
      return {
        endpoint: "/api/v1/misc/flatten",
        fields: { flattenOnlyForms: true },
        outputContentType: "application/pdf",
        outputExtension: "pdf",
        preservesVectors: true,
        rasterizes: false,
        alpha: false,
      };
    case "repair":
      return {
        endpoint: "/api/v1/misc/repair",
        fields: {},
        outputContentType: "application/pdf",
        outputExtension: "pdf",
        preservesVectors: true,
        rasterizes: false,
        alpha: false,
      };
    case "compress":
      return {
        endpoint: "/api/v1/misc/compress-pdf",
        fields: {
          optimizeLevel: clampInteger(options.compressionLevel, 2, 1, 9),
          grayscale: false,
          lineArt: false,
          linearize: true,
          normalize: true,
        },
        outputContentType: "application/pdf",
        outputExtension: "pdf",
        preservesVectors: true,
        rasterizes: false,
        alpha: false,
      };
    case "ocr":
      if (
        options.languages?.some((language) =>
          !/^[a-z]{3}(?:_[A-Z]{3})?$/.test(language)
        )
      ) {
        throw new Error("OCR-sprog har et ugyldigt format");
      }
      return {
        endpoint: "/api/v1/misc/ocr-pdf",
        fields: {
          languages: options.languages?.length
            ? options.languages.slice(0, 4)
            : ["dan", "eng"],
          ocrType: options.ocrType || "skip-text",
          ocrRenderType: "sandwich",
          sidecar: false,
          deskew: true,
          clean: false,
          cleanFinal: false,
          removeImagesAfter: false,
        },
        outputContentType: "application/pdf",
        outputExtension: "pdf",
        preservesVectors: true,
        rasterizes: false,
        alpha: false,
      };
    case "pdfa":
      return {
        endpoint: "/api/v1/convert/pdf/pdfa",
        fields: {
          outputFormat: options.pdfaFormat || "pdfa-2b",
          strict: options.pdfaStrict ?? false,
        },
        outputContentType: "application/pdf",
        outputExtension: "pdf",
        preservesVectors: true,
        rasterizes: false,
        alpha: false,
      };
    case "redact": {
      const terms = (options.redactTerms || []).map((term) => term.trim())
        .filter(Boolean);
      if (terms.length === 0) {
        throw new Error("Angiv mindst ét ord eller udtryk, der skal fjernes");
      }
      if (
        terms.length > 100 || terms.some((term) => term.length > 200) ||
        terms.join("\n").length > 5_000
      ) {
        throw new Error("Listen til permanent fjernelse er for lang");
      }
      return {
        endpoint: "/api/v1/security/auto-redact",
        fields: {
          listOfText: terms.join("\n"),
          useRegex: options.redactUseRegex ?? false,
          wholeWordSearch: options.redactWholeWords ?? true,
          redactColor: normalizeHexColor(options.redactColor),
          customPadding: clampInteger(options.redactPadding, 0, 0, 50),
          convertPDFToImage: true,
        },
        outputContentType: "application/pdf",
        outputExtension: "pdf",
        preservesVectors: false,
        rasterizes: true,
        alpha: false,
      };
    }
    case "text-edit-export":
      return {
        endpoint: "/api/v1/convert/pdf/text-editor",
        fields: { lightweight: options.textEditorLightweight ?? true },
        outputContentType: "application/json",
        outputExtension: "json",
        preservesVectors: true,
        rasterizes: false,
        alpha: true,
      };
    case "text-edit-import":
      return {
        endpoint: "/api/v1/convert/text-editor/pdf",
        fields: {},
        outputContentType: "application/pdf",
        outputExtension: "pdf",
        preservesVectors: true,
        rasterizes: false,
        alpha: true,
      };
  }
}

const appendField = (formData: FormData, key: string, value: unknown) => {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item) => formData.append(key, String(item)));
    return;
  }
  formData.append(key, String(value));
};

export async function runStirlingOperation(args: {
  config: StirlingProviderConfig;
  operation: StirlingPdfOperation;
  inputBytes: Uint8Array;
  fileName: string;
  inputContentType?: string;
  options?: StirlingOperationOptions;
  fetchImpl?: typeof fetch;
}): Promise<
  {
    bytes: Uint8Array;
    definition: StirlingOperationDefinition;
    responseContentType: string;
  }
> {
  const {
    config,
    operation,
    inputBytes,
    fileName,
    options = {},
    fetchImpl = fetch,
  } = args;
  assertStirlingProviderReady(config, operation);
  const definition = getStirlingOperationDefinition(operation, options);
  const formData = new FormData();
  Object.entries(definition.fields).forEach(([key, value]) =>
    appendField(formData, key, value)
  );
  formData.append(
    "fileInput",
    new Blob([Uint8Array.from(inputBytes).buffer], {
      type: args.inputContentType || "application/pdf",
    }),
    fileName,
  );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(
      `${config.baseUrl}${definition.endpoint}`,
      {
        method: "POST",
        headers: { "X-API-Key": config.apiKey },
        body: formData,
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500).replace(/\s+/g, " ")
        .trim();
      console.error("[designer-pdf-service] Stirling request failed", {
        endpoint: definition.endpoint,
        status: response.status,
        detail,
      });
      throw new Error(
        `Stirling-PDF kunne ikke behandle filen (${response.status})`,
      );
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) {
      throw new Error("Stirling-PDF returnerede en tom fil");
    }
    const responseContentType = response.headers.get("content-type") ||
      definition.outputContentType;
    if (definition.outputContentType === "application/pdf") {
      const header = new TextDecoder().decode(bytes.slice(0, 5));
      if (header !== "%PDF-") {
        throw new Error("Stirling-PDF returnerede ikke en gyldig PDF");
      }
    } else {
      JSON.parse(new TextDecoder().decode(bytes));
    }
    return { bytes, definition, responseContentType };
  } finally {
    clearTimeout(timeout);
  }
}
