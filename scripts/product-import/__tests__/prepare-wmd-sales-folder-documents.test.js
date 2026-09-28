import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  DocumentPreparationError,
  assertExactSupplierPdfUrl,
  buildDocumentPlan,
  buildReviewStatus,
  fetchExactSupplierPdf,
  hasPdfMagic,
  parseOptionalContentInspectorOutput,
  parsePdfInfoOutput,
  parsePdfInfoPageCount,
  prepareDocuments,
  readExtractionSummaryGate,
  runProcess,
  validateOptionalContentInspection,
} from "../prepare-wmd-sales-folder-documents.js";

const GUIDE_URL = "https://www.wir-machen-druck.de/tpl/folder-a4-1mm-40_1.pdf";
const TEMPLATE_URL = "https://www.wir-machen-druck.de/tpl/folder-a4-1mm-40_2.pdf";

function binding(overrides = {}) {
  return {
    sourceUrl: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-40.html",
    sourceProductId: "19285",
    sourceSku: "19285",
    productSourceOrder: 0,
    materialId: "460565",
    materialSourceOrder: 0,
    materialLabel: "255g Chromokarton, 1 mm",
    classification: { formatKey: "a4", printMode: "4+0", finishKey: "none" },
    materialFacts: { paperKey: "chromo-mappekarton", spineDepthMm: 1 },
    documents: [
      { role: "guide", label: "Datenblatt", url: GUIDE_URL },
      { role: "template", label: "Druckvorlage", url: TEMPLATE_URL },
    ],
    ...overrides,
  };
}

function readableBody(chunks) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk));
      controller.close();
    },
  });
}

function fakeResponse({
  status = 200,
  url = "",
  headers = {},
  body = Buffer.from("%PDF-1.7\n%%EOF"),
  bodyStream = null,
} = {}) {
  const normalizedHeaders = new Headers(headers);
  return {
    status,
    url,
    headers: normalizedHeaders,
    body: bodyStream || readableBody([body]),
    async arrayBuffer() {
      return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
    },
  };
}

function completedExtractionSummary(overrides = {}) {
  return {
    state: "extracted",
    sourceCategoryUrl: "https://www.wir-machen-druck.de/praesentationsmappen,category,9418.html",
    partial: false,
    eligibleForReview: true,
    eligibleForImport: false,
    runScope: {
      partial: false,
      selectedProductCount: 420,
      fullDiscoveredProductCount: 420,
    },
    catalogProducts: 420,
    successfulProducts: 420,
    failedProducts: 0,
    unresolvedCurrentRunFailures: 0,
    documentBindings: 1,
    pdfLinksExtracted: true,
    ...overrides,
  };
}

async function writeSyntheticRun(runDirectory, { summary = null } = {}) {
  await fs.mkdir(path.join(runDirectory, "raw"), { recursive: true });
  await fs.writeFile(
    path.join(runDirectory, "raw", "document-bindings.jsonl"),
    `${JSON.stringify(binding())}\n`,
    "utf8"
  );
  if (summary) {
    await fs.mkdir(path.join(runDirectory, "review"), { recursive: true });
    await fs.writeFile(
      path.join(runDirectory, "review", "extraction-summary.json"),
      `${JSON.stringify(summary, null, 2)}\n`,
      "utf8"
    );
  }
}

function optionalContentFixture({
  propertiesPresent = true,
  layerNames = ["Beschnitt Seite", "Rillen", "Schneiden"],
  pageCount = 1,
  declarations = [{
    type: "Separation",
    colorantNames: ["Stanze"],
    alternateColorSpace: "DeviceCMYK",
    resourceNames: ["CS0"],
    pageNumbers: [1],
    locations: ["Page 1/Resources/ColorSpace/CS0"],
  }],
} = {}) {
  return {
    schemaVersion: 1,
    inspector: "pypdf",
    pypdfVersion: "6.10.0",
    inspectionPerformed: true,
    pageCount,
    multiPage: pageCount > 1,
    optionalContent: {
      propertiesPresent,
      ocgCount: layerNames.length,
      layerNames,
      layers: layerNames.map((name, index) => ({ index, name, type: "OCG" })),
      defaultConfiguration: null,
    },
    spotColors: {
      declarationCount: declarations.length,
      separationDeclarationCount: declarations.filter((item) => item.type === "Separation").length,
      deviceNDeclarationCount: declarations.filter((item) => item.type === "DeviceN").length,
      colorantNames: [...new Set(declarations.flatMap((item) => item.colorantNames))].sort(),
      declarations,
    },
  };
}

test("document plan requires exact guide/template coverage and deduplicates shared supplier PDFs", () => {
  const second = binding({
    materialId: "460567",
    materialLabel: "300g Naturkarton, 1 mm",
  });
  const plan = buildDocumentPlan([binding(), second]);
  assert.equal(plan.bindingCount, 2);
  assert.equal(plan.uniqueDocumentCount, 2);
  assert.equal(plan.uniqueGuideCount, 1);
  assert.equal(plan.uniqueTemplateCount, 1);
  assert.equal(plan.documents[0].selectionBindings.length, 2);
  assert.match(plan.documents[0].localRelativePath, /^documents\/source-pdfs\/[a-f0-9]{16}-/);
  assert.equal(plan.documents.every((document) => document.selectionBindings.every(
    (selection) => selection.sourceProductId === "19285"
  )), true);
});

test("document plan fails closed on missing role, duplicate selection or cross-host PDF", () => {
  assert.throws(
    () => buildDocumentPlan([binding({ documents: [{ role: "guide", url: GUIDE_URL }] })]),
    /exactly one guide and one template/
  );
  assert.throws(
    () => buildDocumentPlan([binding(), binding()]),
    /Duplicate selection binding/
  );
  assert.throws(
    () => buildDocumentPlan([binding({
      documents: [
        { role: "guide", url: "https://cdn.wir-machen-druck.de/folder.pdf" },
        { role: "template", url: TEMPLATE_URL },
      ],
    })]),
    /Only exact https:\/\/www\.wir-machen-druck\.de/
  );
  assert.throws(
    () => assertExactSupplierPdfUrl(`${GUIDE_URL}?download=1`),
    /without query parameters/
  );
});

test("PDF magic check accepts only a leading PDF header", () => {
  assert.equal(hasPdfMagic(Buffer.from("%PDF-1.7\n")), true);
  assert.equal(hasPdfMagic(Buffer.from(" \n%PDF-1.7\n")), false);
  assert.equal(hasPdfMagic(Buffer.from("<html>not a pdf</html>")), false);
});

test("pdfinfo parser records every page and all five page boxes in points and millimetres", () => {
  const output = [
    "Title: Synthetic folder template",
    "Creator: Synthetic test fixture",
    "Producer: Fixture PDF library",
    "Custom Metadata: yes",
    "Metadata Stream: yes",
    "Tagged: no",
    "Form: none",
    "JavaScript: no",
    "Pages: 2",
    "Encrypted: no",
    "Page    1 size: 720 x 360 pts",
    "Page    1 rot: 0",
    "Page    2 size: 360 x 720 pts",
    "Page    2 rot: 90",
    "Page    1 MediaBox: 0 0 720 360",
    "Page    1 CropBox: 0 0 720 360",
    "Page    1 BleedBox: 0 0 720 360",
    "Page    1 TrimBox: 9 9 711 351",
    "Page    1 ArtBox: 18 18 702 342",
    "Page    2 MediaBox: 0 0 360 720",
    "Page    2 CropBox: 0 0 360 720",
    "Page    2 BleedBox: 0 0 360 720",
    "Page    2 TrimBox: 9 9 351 711",
    "Page    2 ArtBox: 18 18 342 702",
    "File size: 2048 bytes",
    "Optimized: no",
    "PDF version: 1.7",
  ].join("\n");
  const inspection = parsePdfInfoOutput(output, "<x:xmpmeta>fixture</x:xmpmeta>\n");
  assert.equal(parsePdfInfoPageCount(output), 2);
  assert.equal(inspection.pageCount, 2);
  assert.equal(inspection.pages[0].boxes.MediaBox.widthMm, 254);
  assert.equal(inspection.pages[0].boxes.MediaBox.heightMm, 127);
  assert.equal(inspection.pages[1].rotation, 90);
  assert.equal(inspection.pages[1].boxes.TrimBox.widthPt, 342);
  assert.equal(inspection.metadata.title, "Synthetic folder template");
  assert.equal(inspection.metadata.xmp.present, true);
  assert.match(inspection.metadata.xmp.sha256, /^[a-f0-9]{64}$/);
});

test("optional-content inspection validates template layers, spot colors and multi-page state", () => {
  const layerNames = [
    "Beschnitt Seite",
    "Rillen",
    "Schneiden",
    "Abheftvorrichtung",
    "Gummiband_gross",
    "Magnetpunkte",
    "CD-Tasche",
    "Kombi Visitenkartentasche",
    "Visitenkartentasche",
    "Info Seite",
    "Logo",
  ];
  const parsed = parseOptionalContentInspectorOutput(JSON.stringify(
    optionalContentFixture({ layerNames, pageCount: 2 })
  ));
  const validated = validateOptionalContentInspection(parsed, {
    documentRole: "template",
    expectedPageCount: 2,
  });
  assert.equal(validated.optionalContent.propertiesPresent, true);
  assert.equal(validated.optionalContent.ocgCount, 11);
  assert.deepEqual(validated.optionalContent.layerNames, layerNames);
  assert.equal(validated.spotColors.separationDeclarationCount, 1);
  assert.deepEqual(validated.spotColors.colorantNames, ["Stanze"]);
  assert.equal(validated.multiPage, true);
  assert.equal(validated.templateMultiPage, true);
});

test("template inspection fails closed when OCG inspection was not performed", () => {
  assert.throws(
    () => validateOptionalContentInspection({ inspectionPerformed: false }, {
      documentRole: "template",
      expectedPageCount: 1,
    }),
    /not performed for template PDF/
  );
});

test("guide inspection may validly record no optional-content layers", () => {
  const validated = validateOptionalContentInspection(optionalContentFixture({
    propertiesPresent: false,
    layerNames: [],
    declarations: [],
  }), {
    documentRole: "guide",
    expectedPageCount: 1,
  });
  assert.equal(validated.optionalContent.propertiesPresent, false);
  assert.equal(validated.optionalContent.ocgCount, 0);
  assert.deepEqual(validated.optionalContent.layerNames, []);
  assert.equal(validated.templateMultiPage, null);
});

test("exact supplier fetch rejects off-host redirects and non-PDF response bytes", async () => {
  await assert.rejects(
    fetchExactSupplierPdf(GUIDE_URL, {
      fetchImpl: async () => fakeResponse({
        status: 302,
        headers: { location: "https://example.com/folder.pdf" },
      }),
    }),
    /Only exact https:\/\/www\.wir-machen-druck\.de/
  );

  await assert.rejects(
    fetchExactSupplierPdf(GUIDE_URL, {
      fetchImpl: async () => fakeResponse({ body: Buffer.from("not a pdf") }),
    }),
    /does not start with PDF magic/
  );
});

test("exact supplier fetch accepts PDF bytes and records same-host redirect evidence", async () => {
  const redirected = "https://www.wir-machen-druck.de/tpl/current-folder.pdf";
  const responses = new Map([
    [GUIDE_URL, fakeResponse({ status: 302, headers: { location: redirected } })],
    [redirected, fakeResponse({
      status: 200,
      url: redirected,
      headers: { "content-type": "application/pdf", etag: "fixture-etag" },
      body: Buffer.from("%PDF-1.7\nfixture\n%%EOF"),
    })],
  ]);
  const result = await fetchExactSupplierPdf(GUIDE_URL, {
    fetchImpl: async (url) => responses.get(url),
  });
  assert.equal(hasPdfMagic(result.bytes), true);
  assert.equal(result.httpEvidence.finalUrl, redirected);
  assert.equal(result.httpEvidence.redirects.length, 1);
  assert.equal(result.httpEvidence.etag, "fixture-etag");
  assert.equal(result.httpEvidence.contentLength, null);
});

test("exact supplier fetch rejects an oversized chunked body before final buffer allocation", async () => {
  const firstChunk = Buffer.from("%PDF-");
  const secondChunk = Buffer.from("123456");
  await assert.rejects(
    fetchExactSupplierPdf(GUIDE_URL, {
      fetchImpl: async () => fakeResponse({
        bodyStream: readableBody([firstChunk, secondChunk]),
      }),
      maxBytes: 10,
    }),
    /exceeds the 10-byte safety limit while streaming: 11/
  );
});

test("exact supplier fetch applies the request deadline to a stalled response body", async () => {
  let bodyCancelled = false;
  const stalledBody = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(Buffer.from("%PDF-")));
    },
    cancel() {
      bodyCancelled = true;
    },
  });
  const startedAt = Date.now();
  await assert.rejects(
    fetchExactSupplierPdf(GUIDE_URL, {
      fetchImpl: async () => fakeResponse({ bodyStream: stalledBody }),
      timeoutMs: 40,
    }),
    /timed out after 40 ms/
  );
  assert.ok(Date.now() - startedAt < 1_000);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(bodyCancelled, true);
});

test("PDF inspection subprocess runner terminates a process that exceeds its wall-clock limit", async () => {
  const startedAt = Date.now();
  await assert.rejects(
    runProcess(process.execPath, [
      "-e",
      "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)",
    ], {
      timeoutMs: 50,
      terminationGraceMs: 25,
    }),
    /timed out after 50 ms/
  );
  assert.ok(Date.now() - startedAt < 2_000);
});

test("review status can never become import-ready from successful downloads alone", () => {
  const plan = buildDocumentPlan([binding()]);
  const preparedDocuments = plan.documents.map((document) => ({
    ...document,
    sha256: "a".repeat(64),
    byteSize: 2048,
    inspection: {
      pageCount: 1,
      templateMultiPage: document.role === "template" ? false : null,
      optionalContentInspection: validateOptionalContentInspection(
        optionalContentFixture(document.role === "guide" ? {
          propertiesPresent: false,
          layerNames: [],
          declarations: [],
        } : {}),
        { documentRole: document.role, expectedPageCount: 1 }
      ),
    },
  }));
  const status = buildReviewStatus({
    plan,
    preparedDocuments,
    errors: [],
    downloadRequested: true,
    extractionGate: { eligibleForDownload: true, blockers: [] },
    sourceBindingsSha256: "b".repeat(64),
  });
  assert.equal(status.state, "downloaded_and_structurally_inspected_review_required");
  assert.equal(status.eligibleForImport, false);
  assert.equal(status.gates.structuralPdfInspection, "passed");
  assert.equal(status.gates.optionalContentLayerAndSpotColorInspection, "passed");
  assert.equal(status.counts.templatesWithOptionalContent, 1);
  assert.equal(status.counts.optionalContentLayersAcrossTemplates, 3);
  assert.equal(status.counts.multiPageTemplates, 0);
  assert.equal(status.counts.spotColorDeclarations, 1);
  assert.equal(status.gates.supplierBrandingAndMetadataRemoval, "pending");
  assert.equal(status.gates.lockedNonPrintingDesignerBinding, "pending");
  assert.deepEqual(status.prohibitedActionsPerformed, {
    sourcePdfModified: false,
    sourcePdfSanitized: false,
    sourcePdfUploaded: false,
    databaseWritten: false,
    productOrTemplateRecordWritten: false,
    published: false,
  });
});

test("plan-only preparation writes review artifacts, releases its lock and never creates a PDF inventory", async () => {
  const runDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-folder-doc-test-"));
  try {
    await writeSyntheticRun(runDirectory);
    const result = await prepareDocuments({ runDirectory, download: false });
    assert.equal(result.status.state, "download_plan_validated_with_extraction_blockers");
    assert.equal(result.status.eligibleForImport, false);
    assert.equal(result.status.extractionGate.eligibleForDownload, false);
    assert.deepEqual(result.status.extractionGate.blockers, ["Completed extraction summary is missing"]);
    const writtenPlan = JSON.parse(await fs.readFile(result.paths.planPath, "utf8"));
    assert.equal(writtenPlan.downloadRequired, true);
    assert.equal(writtenPlan.uniqueDocumentCount, 2);
    await assert.rejects(fs.access(result.paths.inventoryPath), { code: "ENOENT" });
    await assert.rejects(
      fs.access(path.join(runDirectory, "documents", ".preparation.lock")),
      { code: "ENOENT" }
    );
    await assert.rejects(
      fs.access(path.join(runDirectory, ".extractor.lock")),
      { code: "ENOENT" }
    );
  } finally {
    await fs.rm(runDirectory, { recursive: true, force: true });
  }
});

test("completed full extraction summary opens only the PDF download gate, never the import gate", async () => {
  const runDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-folder-doc-summary-test-"));
  try {
    await writeSyntheticRun(runDirectory, { summary: completedExtractionSummary() });
    const plan = buildDocumentPlan([binding()]);
    const gate = await readExtractionSummaryGate(runDirectory, plan);
    assert.equal(gate.eligibleForDownload, true);
    assert.deepEqual(gate.blockers, []);
    assert.match(gate.sha256, /^[a-f0-9]{64}$/);

    const result = await prepareDocuments({ runDirectory, download: false });
    assert.equal(result.status.state, "download_plan_validated");
    assert.equal(result.status.gates.completedFullExtractionReviewGate, "passed");
    assert.equal(result.status.eligibleForImport, false);
  } finally {
    await fs.rm(runDirectory, { recursive: true, force: true });
  }
});

test("download mode refuses a partial extraction summary before any PDF request", async () => {
  const runDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-folder-doc-partial-test-"));
  try {
    await writeSyntheticRun(runDirectory, {
      summary: completedExtractionSummary({
        partial: true,
        eligibleForReview: false,
        runScope: {
          partial: true,
          selectedProductCount: 1,
          fullDiscoveredProductCount: 420,
        },
        catalogProducts: 1,
        successfulProducts: 1,
      }),
    });
    await assert.rejects(
      prepareDocuments({ runDirectory, download: true }),
      /Document preparation is blocked/
    );
    const status = JSON.parse(await fs.readFile(
      path.join(runDirectory, "documents", "preparation-status.json"),
      "utf8"
    ));
    assert.equal(status.state, "blocked");
    assert.equal(status.eligibleForImport, false);
    assert.equal(status.counts.downloadedAndInspected, 0);
    assert.equal(status.gates.completedFullExtractionReviewGate, "blocked");
    await assert.rejects(
      fs.access(path.join(runDirectory, "documents", "document-files.jsonl")),
      { code: "ENOENT" }
    );
  } finally {
    await fs.rm(runDirectory, { recursive: true, force: true });
  }
});

test("preparation refuses to overlap an active extractor lock", async () => {
  const runDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-folder-doc-lock-test-"));
  try {
    await writeSyntheticRun(runDirectory, { summary: completedExtractionSummary() });
    await fs.writeFile(path.join(runDirectory, ".extractor.lock"), "synthetic lock\n", "utf8");
    await assert.rejects(
      prepareDocuments({ runDirectory, download: false }),
      /extractor lock exists/
    );
    await assert.rejects(
      fs.access(path.join(runDirectory, "documents", "preparation-status.json")),
      { code: "ENOENT" }
    );
  } finally {
    await fs.rm(runDirectory, { recursive: true, force: true });
  }
});

test("preparation owns the shared extractor lock for the complete evidence window", async () => {
  const runDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-folder-doc-shared-lock-test-"));
  try {
    await writeSyntheticRun(runDirectory, { summary: completedExtractionSummary() });
    let observedLock = null;
    await prepareDocuments({
      runDirectory,
      download: false,
      beforeFinalEvidenceCheck: async () => {
        const lockPath = path.join(runDirectory, ".extractor.lock");
        observedLock = JSON.parse(await fs.readFile(lockPath, "utf8"));
        await assert.rejects(fs.open(lockPath, "wx"), { code: "EEXIST" });
      },
    });
    assert.equal(observedLock.role, "sales_folder_pdf_preparation");
    assert.match(observedLock.token, /^[0-9a-f-]{36}$/);
    await assert.rejects(fs.access(path.join(runDirectory, ".extractor.lock")), { code: "ENOENT" });
  } finally {
    await fs.rm(runDirectory, { recursive: true, force: true });
  }
});

test("preparation never removes a shared lock path that no longer belongs to it", async () => {
  const runDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-folder-doc-lock-swap-test-"));
  const lockPath = path.join(runDirectory, ".extractor.lock");
  try {
    await writeSyntheticRun(runDirectory, { summary: completedExtractionSummary() });
    await assert.rejects(
      prepareDocuments({
        runDirectory,
        download: false,
        beforeFinalEvidenceCheck: async () => {
          await fs.unlink(lockPath);
          await fs.writeFile(lockPath, `${JSON.stringify({
            role: "foreign_process",
            token: "foreign-token",
          })}\n`, { flag: "wx" });
        },
      }),
      /no longer owns its sales_folder_pdf_preparation lock/
    );
    const foreignLock = JSON.parse(await fs.readFile(lockPath, "utf8"));
    assert.equal(foreignLock.role, "foreign_process");
    assert.equal(foreignLock.token, "foreign-token");
  } finally {
    await fs.rm(runDirectory, { recursive: true, force: true });
  }
});

test("source binding mutation blocks final plan and status writes", async () => {
  const runDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-folder-doc-mutation-test-"));
  try {
    await writeSyntheticRun(runDirectory, { summary: completedExtractionSummary() });
    await assert.rejects(
      prepareDocuments({
        runDirectory,
        download: false,
        beforeFinalEvidenceCheck: async ({ inputPath }) => {
          await fs.appendFile(inputPath, "\n", "utf8");
        },
      }),
      /Source evidence changed during PDF preparation/
    );
    await assert.rejects(
      fs.access(path.join(runDirectory, "documents", "document-download-plan.json")),
      { code: "ENOENT" }
    );
    await assert.rejects(
      fs.access(path.join(runDirectory, "documents", "preparation-status.json")),
      { code: "ENOENT" }
    );
    await assert.rejects(
      fs.access(path.join(runDirectory, "documents", ".preparation.lock")),
      { code: "ENOENT" }
    );
  } finally {
    await fs.rm(runDirectory, { recursive: true, force: true });
  }
});

test("inspection parser fails closed when a page box is missing", () => {
  const incomplete = [
    "Pages: 1",
    "Encrypted: no",
    "Page 1 size: 100 x 100 pts",
    "Page 1 MediaBox: 0 0 100 100",
    "Page 1 CropBox: 0 0 100 100",
    "Page 1 BleedBox: 0 0 100 100",
    "Page 1 TrimBox: 0 0 100 100",
    "PDF version: 1.7",
  ].join("\n");
  assert.throws(
    () => parsePdfInfoOutput(incomplete),
    (error) => error instanceof DocumentPreparationError && /ArtBox/.test(error.message)
  );
});
