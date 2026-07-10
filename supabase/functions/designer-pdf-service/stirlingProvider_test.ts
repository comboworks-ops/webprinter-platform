import {
  assertStirlingProviderReady,
  getStirlingOperationDefinition,
  readStirlingProviderConfig,
  runStirlingOperation,
} from "./stirlingProvider.ts";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

Deno.test("maps conservative print-safe operations to current Stirling endpoints", () => {
  const flatten = getStirlingOperationDefinition("flatten-forms");
  assert(
    flatten.endpoint === "/api/v1/misc/flatten",
    "flatten endpoint changed",
  );
  assert(
    flatten.fields.flattenOnlyForms === true,
    "forms-only flatten must preserve page vectors",
  );
  assert(flatten.rasterizes === false, "forms-only flatten must not rasterize");

  const compress = getStirlingOperationDefinition("compress");
  assert(
    compress.endpoint === "/api/v1/misc/compress-pdf",
    "compress endpoint changed",
  );
  assert(
    compress.fields.optimizeLevel === 2,
    "compression must default to a conservative level",
  );
  assert(
    compress.fields.grayscale === false,
    "compression must not silently remove colour",
  );

  const ocr = getStirlingOperationDefinition("ocr");
  assert(ocr.endpoint === "/api/v1/misc/ocr-pdf", "OCR endpoint changed");
  assert(
    Array.isArray(ocr.fields.languages),
    "OCR languages must be repeated multipart fields",
  );

  const pdfa = getStirlingOperationDefinition("pdfa");
  assert(
    pdfa.endpoint === "/api/v1/convert/pdf/pdfa",
    "PDF/A endpoint changed",
  );
  assert(pdfa.fields.outputFormat === "pdfa-2b", "PDF/A must default to 2b");
});

Deno.test("true redaction is explicit and always rasterizes", () => {
  const redaction = getStirlingOperationDefinition("redact", {
    redactTerms: ["personnummer", "fortroligt"],
    redactColor: "#112233",
  });
  assert(
    redaction.endpoint === "/api/v1/security/auto-redact",
    "redaction endpoint changed",
  );
  assert(
    redaction.fields.convertPDFToImage === true,
    "redaction must be finalized as pixels",
  );
  assert(
    redaction.fields.listOfText === "personnummer\nfortroligt",
    "redaction terms malformed",
  );
  assert(
    redaction.fields.redactColor === "112233",
    "redaction colour malformed",
  );
  assert(
    redaction.rasterizes === true && redaction.preservesVectors === false,
    "redaction risk flags missing",
  );
});

Deno.test("rejects unbounded redaction input and malformed OCR languages", () => {
  let redactionRejected = false;
  try {
    getStirlingOperationDefinition("redact", {
      redactTerms: Array.from({ length: 101 }, (_, index) => `term-${index}`),
    });
  } catch {
    redactionRejected = true;
  }
  assert(redactionRejected, "redaction input must be bounded");

  let languageRejected = false;
  try {
    getStirlingOperationDefinition("ocr", { languages: ["../../etc/passwd"] });
  } catch {
    languageRejected = true;
  }
  assert(languageRejected, "OCR language codes must be validated");
});

Deno.test("provider requires explicit enablement and license acknowledgement", () => {
  const config = readStirlingProviderConfig((name) =>
    ({
      STIRLING_PDF_BASE_URL: "http://stirling-pdf:8080/",
      STIRLING_PDF_API_KEY: "secret",
      STIRLING_PDF_ENABLED: "true",
      STIRLING_PDF_LICENSE_ACKNOWLEDGED: "false",
    })[name]
  );
  let rejected = false;
  try {
    assertStirlingProviderReady(config, "repair");
  } catch {
    rejected = true;
  }
  assert(rejected, "provider must reject use before license acknowledgement");
});

Deno.test("provider sends API key and multipart input without leaking configuration", async () => {
  let capturedUrl = "";
  let capturedKey = "";
  const capturedFileInput: { value: FormDataEntryValue | null } = {
    value: null,
  };
  const output = new TextEncoder().encode("%PDF-1.7\nmock");
  const result = await runStirlingOperation({
    config: {
      baseUrl: "http://stirling-pdf:8080",
      apiKey: "private-key",
      enabled: true,
      licenseAcknowledged: true,
      textEditorEnabled: false,
      timeoutMs: 5_000,
    },
    operation: "repair",
    inputBytes: new TextEncoder().encode("%PDF-1.7\ninput"),
    fileName: "input.pdf",
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      capturedKey = new Headers(init?.headers).get("X-API-Key") || "";
      capturedFileInput.value = (init?.body as FormData).get("fileInput");
      return new Response(output, {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    },
  });

  assert(capturedUrl.endsWith("/api/v1/misc/repair"), "wrong provider URL");
  assert(capturedKey === "private-key", "API key header missing");
  assert(
    capturedFileInput.value instanceof Blob,
    "multipart PDF input missing",
  );
  assert(
    new TextDecoder().decode(result.bytes).startsWith("%PDF-"),
    "provider PDF response rejected",
  );
});
