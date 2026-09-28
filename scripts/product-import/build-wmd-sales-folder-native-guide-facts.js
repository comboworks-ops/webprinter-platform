#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "../..");
const DEFAULT_RUN_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "tmp/supplier-imports/wmd-sales-folders-20260831-full",
);

const INPUT_PATHS = Object.freeze({
  templateStubs: "review/template-projection-stubs.jsonl",
  documentInventory: "documents/document-files.jsonl",
  sanitizationPlan: "review/template-sanitization-plan.json",
  sanitizationBatch: "documents/sanitization-batch/manifest.json",
  sanitizationContractManifest: "documents/sanitization-contracts/manifest.json",
  renderReview: "review/sanitized-pdf-render-review/render-review-manifest.json",
  geometryAudit: "review/template-geometry-audit.json",
  geometrySupplement: "review/template-geometry-supplement.json",
  approvedGeometrySupplement:
    "review/approved-template-package/template-geometry-supplement.json",
  productDraftApprovalDecision: "review/product-draft-approval-decision.json",
});

const DEFAULT_OUTPUT_PATH = "review/native-guide-facts.json";
const DEFAULT_MACHINE_OUTPUT_PATH = "review/native-guide-facts.machine.json";
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const TEMPLATE_BINDING_AXES = Object.freeze([
  "folder_model",
  "print",
  "spine",
  "paper",
  "finish",
]);
const REQUIRED_BINDING_FACT_KEYS = Object.freeze([
  "dataFormatMm",
  "finalFormatMm",
  "foldedFinalFormatMm",
  "bleedMm",
  "safetyMm",
  "folds",
  "panelWidthsMm",
  "pageOrder",
  "colorMode",
  "minimumResolutionDpi",
  "deliveryRules",
]);
const REQUIRED_DISPLAY_FACT_KEYS = Object.freeze([
  "dataFormatMm",
  "finalFormatMm",
  "foldedFinalFormatMm",
  "bleedMm",
  "safetyMm",
  "folds",
  "pageOrder",
  "colorMode",
  "minimumResolutionDpi",
  "deliveryRules",
]);
const OPTIONAL_OMISSION_KEYS = new Set([
  "panelWidthsMm",
  "folds.count",
  "folds.positionsMm",
]);
const PROHIBITED_ACTIONS_PERFORMED = Object.freeze({
  supplierNetworkRequested: false,
  sourcePdfModified: false,
  sanitizedPdfModified: false,
  pdfUploaded: false,
  storageWritten: false,
  databaseWritten: false,
  supplierBankWritten: false,
  productOrTemplateRecordWritten: false,
  pricingWritten: false,
  published: false,
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256Text(value) {
  return sha256Bytes(Buffer.from(String(value), "utf8"));
}

function validSha256(value, label) {
  const normalized = String(value || "");
  assert(SHA256_PATTERN.test(normalized), `${label} is not a lowercase SHA-256`);
  return normalized;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, "en", { numeric: true }))
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function sameJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function round(value, digits = 3) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseLocaleNumber(value) {
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function safeRelativePath(value, label, suffix = null) {
  const normalized = String(value || "").replaceAll("\\", "/");
  assert(normalized.length > 0, `${label} is missing`);
  assert(!path.posix.isAbsolute(normalized), `${label} must be run-relative`);
  assert(path.posix.normalize(normalized) === normalized, `${label} is not normalized`);
  assert(!normalized.split("/").includes(".."), `${label} escapes the run directory`);
  if (suffix) {
    assert(normalized.toLowerCase().endsWith(suffix), `${label} must end in ${suffix}`);
  }
  return normalized;
}

function safeRunPath(runDirectory, relativePath, label, suffix = null) {
  const safe = safeRelativePath(relativePath, label, suffix);
  const resolved = path.resolve(runDirectory, safe);
  assert(
    resolved.startsWith(`${path.resolve(runDirectory)}${path.sep}`),
    `${label} resolves outside the run directory`,
  );
  return resolved;
}

async function readArtifact(runDirectory, relativePath, label) {
  const absolutePath = safeRunPath(runDirectory, relativePath, label);
  const bytes = await fs.readFile(absolutePath);
  return {
    relativePath,
    absolutePath,
    bytes,
    byteSize: bytes.length,
    sha256: sha256Bytes(bytes),
  };
}

async function readJsonArtifact(runDirectory, relativePath, label) {
  const artifact = await readArtifact(runDirectory, relativePath, label);
  try {
    artifact.value = JSON.parse(artifact.bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
  return artifact;
}

async function readJsonlArtifact(runDirectory, relativePath, label, onRow) {
  const absolutePath = safeRunPath(runDirectory, relativePath, label, ".jsonl");
  const hash = createHash("sha256");
  let byteSize = 0;
  let rowCount = 0;
  const input = createReadStream(absolutePath);
  input.on("data", (chunk) => {
    byteSize += chunk.length;
    hash.update(chunk);
  });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch (error) {
      throw new Error(`${label} row ${rowCount + 1} is not valid JSON: ${error.message}`);
    }
    await onRow(row, rowCount);
    rowCount += 1;
  }
  return {
    relativePath,
    absolutePath,
    byteSize,
    sha256: hash.digest("hex"),
    rowCount,
  };
}

function artifactEvidence(artifact, rows = null) {
  return {
    path: artifact.relativePath,
    sha256: artifact.sha256,
    bytes: artifact.byteSize,
    ...(rows === null ? {} : { rows }),
  };
}

function assertPinnedArtifact(pin, artifact, label) {
  assert(pin?.path === artifact.relativePath, `${label} path drifted`);
  assert(pin?.sha256 === artifact.sha256, `${label} SHA-256 drifted`);
  assert(Number(pin?.bytes) === artifact.byteSize, `${label} byte size drifted`);
}

function assertAllFalse(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} is missing`);
  const performed = Object.entries(value).filter(([, state]) => state !== false);
  assert(
    performed.length === 0,
    `${label} reports performed actions: ${performed.map(([key]) => key).join(", ")}`,
  );
}

function normalizeExtractedText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replaceAll("/hyphen.cap", "-")
    .replaceAll("/f_", "f")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizePages(pages) {
  assert(Array.isArray(pages) && pages.length > 0, "PDF text extraction returned no pages");
  return pages.map((page, index) => ({
    pageNumber: Number(page?.pageNumber || index + 1),
    text: normalizeExtractedText(page?.text),
  }));
}

function firstPageMatch(pages, pattern) {
  for (const page of pages) {
    const flags = pattern.flags.replaceAll("g", "");
    const match = new RegExp(pattern.source, flags).exec(page.text);
    if (!match) continue;
    const sourceText = normalizeExtractedText(match[0]);
    return {
      match,
      evidence: {
        pageNumber: page.pageNumber,
        sourceText,
        sourceTextSha256: sha256Text(sourceText),
      },
    };
  }
  return null;
}

function missingFact(reasonDa) {
  return {
    status: "missing",
    value: null,
    displayDa: null,
    evidence: [],
    reasonDa,
  };
}

function measurementFact(pages, pattern, labelDa) {
  const found = firstPageMatch(pages, pattern);
  if (!found) return missingFact(`${labelDa} kunne ikke dokumenteres i kildens PDF-tekst.`);
  const widthMm = parseLocaleNumber(found.match[1]);
  const heightMm = parseLocaleNumber(found.match[2]);
  if (widthMm === null || heightMm === null) {
    return missingFact(`${labelDa} indeholdt ikke to entydige millimetermål.`);
  }
  return {
    status: "evidenced",
    value: { widthMm, heightMm },
    displayDa: `${labelDa}: ${widthMm} × ${heightMm} mm`,
    evidence: [found.evidence],
  };
}

function scalarFact(pages, pattern, labelDa, suffix, valueGroup = 1) {
  const found = firstPageMatch(pages, pattern);
  if (!found) return missingFact(`${labelDa} kunne ikke dokumenteres i kildens PDF-tekst.`);
  const value = parseLocaleNumber(found.match[valueGroup]);
  if (value === null) return missingFact(`${labelDa} havde ikke en entydig talværdi.`);
  return {
    status: "evidenced",
    value,
    displayDa: `${labelDa}: ${value} ${suffix}`,
    evidence: [found.evidence],
  };
}

function statementFact(pages, pattern, value, displayDa, missingReasonDa) {
  const found = firstPageMatch(pages, pattern);
  if (!found) return missingFact(missingReasonDa);
  return {
    status: "evidenced",
    value,
    displayDa,
    evidence: [found.evidence],
  };
}

function explicitPanelWidthsFact(pages) {
  const found = firstPageMatch(
    pages,
    /(?:Panelbreiten|Flächenbreiten|Seitenbreiten)\s*:?\s*((?:\d+(?:[.,]\d+)?\s*(?:mm)?\s*(?:[/,;|+]\s*|\s+)){1,}\d+(?:[.,]\d+)?\s*(?:mm)?)/iu,
  );
  if (!found) {
    return missingFact(
      "Panelbredderne er kun vist som løse diagrammål; kilden navngiver dem ikke semantisk, så de må ikke gættes.",
    );
  }
  const values = found.match[1]
    .match(/\d+(?:[.,]\d+)?/gu)
    ?.map(parseLocaleNumber)
    .filter((value) => value !== null) || [];
  if (values.length < 2) {
    return missingFact("Den eksplicitte panelbreddeangivelse kunne ikke fortolkes entydigt.");
  }
  return {
    status: "evidenced",
    value: values,
    displayDa: `Panelbredder: ${values.join(" / ")} mm`,
    evidence: [found.evidence],
  };
}

function explicitFoldDetails(pages) {
  const positions = firstPageMatch(
    pages,
    /Falzposition(?:en)?\s*:?\s*((?:\d+(?:[.,]\d+)?\s*(?:mm)?\s*(?:[/,;|+]\s*|\s+)){1,}\d+(?:[.,]\d+)?\s*(?:mm)?)/iu,
  );
  const count = firstPageMatch(
    pages,
    /(?:Anzahl\s+der\s+Falzlinien|Falzanzahl)\s*:?\s*(\d+)/iu,
  );
  return {
    positionsMm: positions
      ? positions.match[1].match(/\d+(?:[.,]\d+)?/gu)?.map(parseLocaleNumber) || []
      : null,
    count: count ? Number(count.match[1]) : null,
    evidence: [positions?.evidence, count?.evidence].filter(Boolean),
  };
}

function deliveryRulesFact(pages) {
  const rules = [
    {
      key: "fileFormat",
      pattern: /Speichern\s+Sie\s+Ihr\s+Dokument\s+im\s+PDF-Format\s+ab/iu,
      value: "PDF",
      displayDa: "Dokumentet skal gemmes som PDF.",
    },
    {
      key: "embedFonts",
      pattern: /Achten\s+Sie\s+darauf,\s+Schriften\s+einzubetten/iu,
      value: true,
      displayDa: "Skrifttyper skal indlejres.",
    },
    {
      key: "reduceTransparencyWhenPossible",
      pattern: /soweit\s+als\s+möglich\)?\s+Transparenzen\s+zu\s+reduzieren/iu,
      value: true,
      displayDa: "Transparens bør så vidt muligt reduceres.",
    },
    {
      key: "removeTemplateBeforePrint",
      pattern: /Im\s+letzten\s+Schritt\s+entfernen\s+Sie\s+die\s+Druckvorlage\s+wieder[^.]*nicht\s+mitgedruckt\s+wird/iu,
      value: true,
      displayDa: "Leverandørskabelonen skal fjernes, så den ikke trykkes med.",
    },
    {
      key: "extendBackgroundToDataFormat",
      pattern: /Hintergrundbilder,\s+Farben,\s+Verläufe\s+und\s+Grafiken[^.]*bis\s+an\s+den\s+Rand\s+des\s+Datenformats/iu,
      value: true,
      displayDa: "Baggrunde og grafik til kant skal føres helt ud til dataformatets kant.",
    },
  ].map((rule) => {
    const found = firstPageMatch(pages, rule.pattern);
    return {
      key: rule.key,
      status: found ? "evidenced" : "missing",
      value: found ? rule.value : null,
      displayDa: found ? rule.displayDa : null,
      evidence: found ? [found.evidence] : [],
    };
  });
  const missing = rules.filter((rule) => rule.status === "missing").map((rule) => rule.key);
  return {
    status: missing.length === 0 ? "evidenced" : "partial",
    value: Object.fromEntries(rules.map((rule) => [rule.key, rule.value])),
    displayDa: rules.filter((rule) => rule.displayDa).map((rule) => rule.displayDa),
    rules,
    missingRuleKeys: missing,
  };
}

export function extractGuideFactsFromPages(rawPages) {
  const pages = normalizePages(rawPages);
  const dataFormatMm = measurementFact(
    pages,
    /Datenformat\s*:\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*mm/iu,
    "Dataformat",
  );
  const finalFormatMm = measurementFact(
    pages,
    /(?:^|\s)Endformat\s*:\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*mm/iu,
    "Slutformat",
  );
  const foldedFinalFormatMm = measurementFact(
    pages,
    /Gefalztes\s+Endformat\s*:\s*(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*mm/iu,
    "Foldet slutformat",
  );
  const bleedMm = scalarFact(
    pages,
    /(\d+(?:[.,]\d+)?)\s*mm\s+Beschnitt/iu,
    "Beskæring",
    "mm",
  );
  const safetyMm = scalarFact(
    pages,
    /Sicherheitsabstand\s*:\s*(\d+(?:[.,]\d+)?)\s*mm/iu,
    "Sikkerhedsafstand",
    "mm",
  );
  const colorMode = statementFact(
    pages,
    /Der\s+Farbmodus\s+Ihrer\s+Druckdaten\s+muss\s+CMYK\s+sein/iu,
    "CMYK",
    "Farvetilstand: CMYK",
    "Kravet til farvetilstand kunne ikke dokumenteres i kildens PDF-tekst.",
  );
  const minimumResolutionDpi = scalarFact(
    pages,
    /Die\s+Auflösung\s+von\s+Bildgrafiken\s+sollte\s+mindestens\s+(\d+)\s*dpi\s+betragen/iu,
    "Minimumsopløsning",
    "dpi",
  );
  const foldStatement = statementFact(
    pages,
    /Falzlinien\s+Hier\s+befinden\s+sich\s+die\s+Falzpositionen\s+in\s+Ihrem\s+Produkt/iu,
    true,
    "Leverandørens foldelinjer markerer foldpositionerne i produktet.",
    "Leverandørens forklaring af foldelinjer kunne ikke dokumenteres.",
  );
  const foldDetails = explicitFoldDetails(pages);
  const folds = {
    status: foldStatement.status === "evidenced"
      ? (foldDetails.count !== null && foldDetails.positionsMm ? "evidenced" : "partial")
      : "missing",
    value: {
      supplierFoldLinesPresent: foldStatement.status === "evidenced" ? true : null,
      count: foldDetails.count,
      positionsMm: foldDetails.positionsMm,
    },
    displayDa: foldStatement.displayDa,
    evidence: [...foldStatement.evidence, ...foldDetails.evidence],
  };
  const panelWidthsMm = explicitPanelWidthsFact(pages);
  const deliveryRules = deliveryRulesFact(pages);
  const facts = {
    dataFormatMm,
    finalFormatMm,
    foldedFinalFormatMm,
    bleedMm,
    safetyMm,
    folds,
    panelWidthsMm,
    colorMode,
    minimumResolutionDpi,
    deliveryRules,
  };
  const missingFacts = [];
  for (const [key, fact] of Object.entries(facts)) {
    if (fact.status === "missing") missingFacts.push(key);
  }
  if (folds.value.count === null) missingFacts.push("folds.count");
  if (folds.value.positionsMm === null) missingFacts.push("folds.positionsMm");
  for (const key of deliveryRules.missingRuleKeys) missingFacts.push(`deliveryRules.${key}`);
  return {
    facts,
    missingFacts: [...new Set(missingFacts)].sort(),
    extractedText: {
      pageCount: pages.length,
      normalizedTextSha256: sha256Text(pages.map((page) => page.text).join("\f")),
      pages: pages.map((page) => ({
        pageNumber: page.pageNumber,
        normalizedTextSha256: sha256Text(page.text),
      })),
    },
  };
}

const PAGE_LABELS = Object.freeze([
  { supplier: "TITELSEITE", normalizedDa: "forside" },
  { supplier: "RÜCKSEITE", normalizedDa: "bagside" },
  { supplier: "INNENSEITE", normalizedDa: "inderside" },
]);

export function extractTemplatePageOrder(rawPages) {
  const pages = normalizePages(rawPages);
  const value = pages.map((page) => {
    const upper = page.text.toLocaleUpperCase("de-DE");
    const occurrences = PAGE_LABELS.flatMap((label) => {
      const index = upper.indexOf(label.supplier);
      return index === -1 ? [] : [{ ...label, index }];
    })
      .sort((left, right) => left.index - right.index)
      .map(({ supplier, normalizedDa }) => ({ supplier, normalizedDa }));
    return {
      pageNumber: page.pageNumber,
      labels: occurrences,
      normalizedTextSha256: sha256Text(page.text),
    };
  });
  const unlabelledPages = value
    .filter((page) => page.labels.length === 0)
    .map((page) => page.pageNumber);
  const complete = unlabelledPages.length === 0;
  return {
    fact: {
      status: complete ? "evidenced" : "missing",
      value: complete ? value.map(({ pageNumber, labels }) => ({ pageNumber, labels })) : null,
      displayDa: complete
        ? value.map((page) => `Side ${page.pageNumber}: ${page.labels.map((label) => label.normalizedDa).join(" + ")}`)
        : null,
      evidence: value.map((page) => ({
        pageNumber: page.pageNumber,
        sourceLabels: page.labels.map((label) => label.supplier),
        normalizedTextSha256: page.normalizedTextSha256,
      })),
      ...(complete ? {} : { reasonDa: `Ingen entydige sideetiketter på side ${unlabelledPages.join(", ")}.` }),
    },
    missingFacts: complete ? [] : ["pageOrder"],
    extractedText: {
      pageCount: pages.length,
      normalizedTextSha256: sha256Text(pages.map((page) => page.text).join("\f")),
      pages: value.map(({ pageNumber, normalizedTextSha256 }) => ({
        pageNumber,
        normalizedTextSha256,
      })),
    },
  };
}

async function extractPdfPages(absolutePath) {
  const [{ getDocument }, bytes] = await Promise.all([
    import("pdfjs-dist/build/pdf.js"),
    fs.readFile(absolutePath),
  ]);
  const document = await getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;
  try {
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const lines = [];
      let currentLine = [];
      for (const item of textContent.items) {
        if (typeof item?.str === "string" && item.str.length > 0) currentLine.push(item.str);
        if (item?.hasEOL) {
          if (currentLine.length > 0) lines.push(currentLine.join(""));
          currentLine = [];
        }
      }
      if (currentLine.length > 0) lines.push(currentLine.join(""));
      pages.push({ pageNumber, text: lines.join("\n") });
    }
    return pages;
  } finally {
    await document.destroy();
  }
}

async function mapLimit(values, concurrency, mapper) {
  const output = new Array(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      output[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return output;
}

function selectionsSignature(value) {
  assert(value && typeof value === "object" && !Array.isArray(value), "Binding selections are missing");
  assert(
    sameJson(Object.keys(value).sort(), [...TEMPLATE_BINDING_AXES].sort()),
    `Binding selections must contain exactly ${TEMPLATE_BINDING_AXES.join(", ")}`,
  );
  return canonicalJson(TEMPLATE_BINDING_AXES.map((axis) => [axis, String(value[axis] || "")]));
}

function compactInventoryRow(row, rowIndex) {
  assert(["guide", "template"].includes(row?.role), `Document inventory row ${rowIndex + 1} has an invalid role`);
  assert(row?.inspection?.structurallyReadable === true, `Document inventory row ${rowIndex + 1} is not structurally readable`);
  return {
    sourceUrl: String(row.sourceUrl || ""),
    role: row.role,
    localRelativePath: safeRelativePath(
      row.localRelativePath,
      `Document inventory row ${rowIndex + 1} path`,
      ".pdf",
    ),
    sha256: validSha256(row.sha256, `Document inventory row ${rowIndex + 1} SHA-256`),
    byteSize: Number(row.byteSize),
    inspection: {
      documentRole: row.inspection.documentRole,
      structurallyReadable: row.inspection.structurallyReadable,
      pageCount: Number(row.inspection.pageCount),
      pages: row.inspection.pages,
      layerNames: row.inspection.optionalContentInspection?.optionalContent?.layerNames || [],
    },
  };
}

async function buildSourceFactSets({
  runDirectory,
  documents,
  role,
  pdfTextExtractor,
}) {
  const groupsBySha = new Map();
  for (const document of documents) {
    assert(document.role === role, `${document.sourceUrl} has the wrong document role`);
    const group = groupsBySha.get(document.sha256) || [];
    group.push(document);
    groupsBySha.set(document.sha256, group);
  }
  const groups = [...groupsBySha.entries()]
    .map(([sha256, aliases]) => ({
      sha256,
      aliases: [...aliases].sort((left, right) => left.sourceUrl.localeCompare(right.sourceUrl)),
    }))
    .sort((left, right) => left.sha256.localeCompare(right.sha256));

  return mapLimit(groups, 4, async (group) => {
    for (const alias of group.aliases) {
      const absolutePath = safeRunPath(
        runDirectory,
        alias.localRelativePath,
        `${role} source PDF`,
        ".pdf",
      );
      const bytes = await fs.readFile(absolutePath);
      assert(bytes.length === alias.byteSize, `${alias.localRelativePath} byte size drifted`);
      assert(sha256Bytes(bytes) === group.sha256, `${alias.localRelativePath} SHA-256 drifted`);
      assert(alias.inspection.documentRole === role, `${alias.localRelativePath} inspection role drifted`);
    }
    const canonical = group.aliases[0];
    const pages = await pdfTextExtractor(
      safeRunPath(runDirectory, canonical.localRelativePath, `${role} source PDF`, ".pdf"),
    );
    assert(
      pages.length === canonical.inspection.pageCount,
      `${canonical.localRelativePath} extracted page count drifted from document inspection`,
    );
    let extracted;
    if (role === "guide") {
      extracted = extractGuideFactsFromPages(pages);
    } else {
      const productionExtraction = extractGuideFactsFromPages(pages);
      extracted = {
        ...extractTemplatePageOrder(pages),
        productionFacts: productionExtraction.facts,
        productionMissingFacts: productionExtraction.missingFacts,
      };
    }
    return {
      key: `${role}-sha256:${group.sha256}`,
      sourcePdf: {
        sha256: group.sha256,
        bytes: canonical.byteSize,
        canonicalPath: canonical.localRelativePath,
        canonicalSourceUrl: canonical.sourceUrl,
        aliases: group.aliases.map((alias) => ({
          sourceUrl: alias.sourceUrl,
          path: alias.localRelativePath,
          sha256: alias.sha256,
          bytes: alias.byteSize,
          inspectionPageCount: alias.inspection.pageCount,
        })),
      },
      ...extracted,
    };
  });
}

function pageGeometryFromContract(contract, label) {
  const pageBoxes = contract?.sourceEvidence?.pageBoxes;
  if (!Array.isArray(pageBoxes) || pageBoxes.length === 0) return null;
  const pages = pageBoxes.map((entry, index) => {
    const mediaBox = entry?.mediabox;
    assert(Array.isArray(mediaBox) && mediaBox.length === 4, `${label} page ${index + 1} has no MediaBox`);
    const [x0, y0, x1, y1] = mediaBox.map(Number);
    assert([x0, y0, x1, y1].every(Number.isFinite), `${label} page ${index + 1} MediaBox is invalid`);
    return {
      pageNumber: index + 1,
      widthMm: round((x1 - x0) * 25.4 / 72),
      heightMm: round((y1 - y0) * 25.4 / 72),
    };
  });
  return { pageCount: pages.length, pages };
}

function measurementConflict(fact, actual, toleranceMm = 0.05) {
  if (fact?.status !== "evidenced" || !actual) return false;
  return Math.abs(fact.value.widthMm - actual.widthMm) > toleranceMm
    || Math.abs(fact.value.heightMm - actual.heightMm) > toleranceMm;
}

function scalarConflict(fact, actual, toleranceMm = 0.01) {
  if (fact?.status !== "evidenced" || !Number.isFinite(actual)) return false;
  return Math.abs(Number(fact.value) - actual) > toleranceMm;
}

function bindingFacts({ guideSet, templateSet, evidenceRecord }) {
  const { contractRecord, inspectionRecord } = evidenceRecord;
  const contract = contractRecord.value;
  const inspection = inspectionRecord.value;
  const geometry = pageGeometryFromContract(contract, contractRecord.path);
  const guideFacts = guideSet.facts;
  const templateFacts = templateSet.productionFacts;
  const foldLayer = contract?.sourceEvidence?.geometryFingerprints?.Rillen || null;
  const contractBleedMm = Number(contract?.productionMeasurements?.bleedMm);
  const contractSafetyMm = Number(contract?.productionMeasurements?.safetyMm);
  const conflicts = [];
  const sourceDisagreements = [];
  const firstContractPage = geometry?.pages?.[0] || null;
  if (measurementConflict(templateFacts.dataFormatMm, firstContractPage)) {
    conflicts.push("dataFormatMm.contractMediaBox");
  }
  if (scalarConflict(templateFacts.bleedMm, contractBleedMm)) conflicts.push("bleedMm.contract");
  if (scalarConflict(templateFacts.safetyMm, contractSafetyMm)) conflicts.push("safetyMm.contract");
  if (geometry && geometry.pageCount !== templateSet.extractedText.pageCount) {
    conflicts.push("pageOrder.contractPageCount");
  }
  const foldGeometryEvidenced = Boolean(
    foldLayer
      && SHA256_PATTERN.test(String(foldLayer.sha256 || ""))
      && Number(foldLayer.pathOperatorCount) > 0,
  );
  const preservedFoldLayer = inspection?.validation?.geometryFingerprintsPreserved?.Rillen || null;
  const foldGeometryPreserved = Boolean(
    foldGeometryEvidenced
      && preservedFoldLayer
      && preservedFoldLayer.sha256 === foldLayer.sha256
      && Number(preservedFoldLayer.pathOperatorCount) === Number(foldLayer.pathOperatorCount)
      && Number(preservedFoldLayer.strokePaintCount) === Number(foldLayer.strokePaintCount),
  );
  const folds = {
    ...templateFacts.folds,
    status: templateFacts.folds.status === "missing" || !foldGeometryEvidenced || !foldGeometryPreserved
      ? "missing"
      : "evidenced",
    value: {
      ...templateFacts.folds.value,
      templateFoldLayerPresent: foldGeometryEvidenced ? true : null,
      templateFoldLayerSha256: foldGeometryEvidenced ? foldLayer.sha256 : null,
      sanitizedTemplateFoldLayerPreserved: foldGeometryPreserved ? true : null,
    },
    evidence: [
      ...templateFacts.folds.evidence,
      ...(foldGeometryEvidenced
        ? [{
            contractPath: contractRecord.path,
            contractSha256: contractRecord.sha256,
            sourceTemplateSha256: contract.sourceEvidence.sha256,
            geometryLayer: "Rillen",
            geometryLayerSha256: foldLayer.sha256,
          }]
        : []),
      ...(foldGeometryPreserved
        ? [{
            inspectionPath: inspectionRecord.path,
            inspectionSha256: inspectionRecord.sha256,
            sanitizedTemplateSha256: inspection.outputSha256,
            preservedGeometryLayer: "Falselinjer",
            preservedGeometryLayerSha256: preservedFoldLayer.sha256,
          }]
        : []),
    ],
  };
  const facts = {
    dataFormatMm: templateFacts.dataFormatMm,
    finalFormatMm: templateFacts.finalFormatMm,
    foldedFinalFormatMm: templateFacts.foldedFinalFormatMm,
    bleedMm: {
      ...templateFacts.bleedMm,
      contractValue: Number.isFinite(contractBleedMm) ? contractBleedMm : null,
    },
    safetyMm: {
      ...templateFacts.safetyMm,
      contractValue: Number.isFinite(contractSafetyMm) ? contractSafetyMm : null,
    },
    folds,
    panelWidthsMm: templateFacts.panelWidthsMm,
    pageOrder: templateSet.fact,
    colorMode: guideFacts.colorMode,
    minimumResolutionDpi: guideFacts.minimumResolutionDpi,
    deliveryRules: guideFacts.deliveryRules,
  };
  const missingFacts = [];
  for (const key of [
    "dataFormatMm",
    "finalFormatMm",
    "foldedFinalFormatMm",
    "bleedMm",
    "safetyMm",
    "folds",
    "panelWidthsMm",
  ]) {
    if (facts[key].status === "missing") missingFacts.push(key);
  }
  if (folds.value.count === null) missingFacts.push("folds.count");
  if (folds.value.positionsMm === null) missingFacts.push("folds.positionsMm");
  if (templateSet.fact.status === "missing") missingFacts.push("pageOrder");
  for (const key of ["colorMode", "minimumResolutionDpi", "deliveryRules"]) {
    if (facts[key].status === "missing") missingFacts.push(key);
  }
  for (const key of guideFacts.deliveryRules.missingRuleKeys) {
    missingFacts.push(`deliveryRules.${key}`);
  }
  if (!foldGeometryEvidenced) missingFacts.push("folds.geometryLayer");
  if (!foldGeometryPreserved) missingFacts.push("folds.sanitizedGeometryPreservation");
  if (!geometry) missingFacts.push("dataFormatMm.contractMediaBox");
  if (!Number.isFinite(contractBleedMm)) missingFacts.push("bleedMm.contract");
  if (!Number.isFinite(contractSafetyMm)) missingFacts.push("safetyMm.contract");
  for (const key of ["dataFormatMm", "finalFormatMm", "foldedFinalFormatMm"]) {
    if (
      guideFacts[key]?.status === "evidenced"
      && templateFacts[key]?.status === "evidenced"
      && measurementConflict(guideFacts[key], templateFacts[key].value)
    ) {
      sourceDisagreements.push(`nativeGuide.${key}.differsFromApprovedTemplate`);
    }
  }
  for (const key of ["bleedMm", "safetyMm"]) {
    if (
      guideFacts[key]?.status === "evidenced"
      && templateFacts[key]?.status === "evidenced"
      && scalarConflict(guideFacts[key], templateFacts[key].value)
    ) {
      sourceDisagreements.push(`nativeGuide.${key}.differsFromApprovedTemplate`);
    }
  }
  return {
    facts,
    missingFacts: [...new Set(missingFacts)].sort(),
    conflicts: [...new Set(conflicts)].sort(),
    sourceDisagreements: [...new Set(sourceDisagreements)].sort(),
    contractAgreement: {
      toleranceMm: 0.05,
      templateMediaBox: geometry,
      bleedMm: Number.isFinite(contractBleedMm) ? contractBleedMm : null,
      safetyMm: Number.isFinite(contractSafetyMm) ? contractSafetyMm : null,
    },
  };
}

function classifyMissingFacts(missingFacts) {
  const optionalOmissions = missingFacts.filter((key) => OPTIONAL_OMISSION_KEYS.has(key));
  const requiredFactGaps = missingFacts.filter((key) => !OPTIONAL_OMISSION_KEYS.has(key));
  return {
    optionalOmissions: [...new Set(optionalOmissions)].sort(),
    requiredFactGaps: [...new Set(requiredFactGaps)].sort(),
  };
}

function summarizeBindings(bindings) {
  const missingFactsByKey = {};
  for (const binding of bindings) {
    for (const key of binding.missingFacts) {
      missingFactsByKey[key] = (missingFactsByKey[key] || 0) + 1;
    }
  }
  return {
    exactBindings: bindings.length,
    displayedFactsReviewedBindings: bindings.filter((binding) => binding.factsReviewed === true).length,
    displayedFactsUnreviewedBindings: bindings.filter((binding) => binding.factsReviewed !== true).length,
    sourceEvidenceCompleteBindings: bindings.filter(
      (binding) => binding.missingFacts.length === 0 && binding.conflicts.length === 0,
    ).length,
    bindingsWithMissingFacts: bindings.filter((binding) => binding.missingFacts.length > 0).length,
    bindingsWithOptionalOmissions: bindings.filter((binding) => binding.optionalOmissions.length > 0).length,
    bindingsWithRequiredFactGaps: bindings.filter((binding) => binding.requiredFactGaps.length > 0).length,
    bindingsWithConflicts: bindings.filter((binding) => binding.conflicts.length > 0).length,
    bindingsWithSourceDisagreements: bindings.filter(
      (binding) => binding.sourceDisagreements.length > 0,
    ).length,
    factsReviewedBindings: bindings.filter((binding) => binding.factsReviewed === true).length,
    missingFactsByKey: Object.fromEntries(
      Object.entries(missingFactsByKey).sort(([left], [right]) => left.localeCompare(right)),
    ),
  };
}

function geometryRecords(bindings) {
  const groups = new Map();
  for (const binding of bindings) {
    const group = groups.get(binding.geometry.key) || [];
    group.push(binding);
    groups.set(binding.geometry.key, group);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, rows]) => {
      const variantsFor = (factKey) => {
        const counts = new Map();
        for (const row of rows) {
          const fact = row.facts[factKey];
          const signature = canonicalJson({ status: fact.status, value: fact.value });
          const existing = counts.get(signature) || {
            status: fact.status,
            value: fact.value,
            bindingCount: 0,
          };
          existing.bindingCount += 1;
          counts.set(signature, existing);
        }
        return [...counts.values()].sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
      };
      const missingFacts = [...new Set(rows.flatMap((row) => row.missingFacts))].sort();
      const requiredFactGaps = [...new Set(rows.flatMap((row) => row.requiredFactGaps))].sort();
      const optionalOmissions = [...new Set(rows.flatMap((row) => row.optionalOmissions))].sort();
      const conflicts = [...new Set(rows.flatMap((row) => row.conflicts))].sort();
      const sourceDisagreements = [...new Set(rows.flatMap((row) => row.sourceDisagreements))].sort();
      return {
        key,
        axes: rows[0].geometry.axes,
        bindingCount: rows.length,
        uniqueGuideFactSetKeys: [...new Set(rows.map((row) => row.sourceEvidence.guideFactSetKey))].sort(),
        uniqueTemplatePageFactSetKeys: [...new Set(rows.map((row) => row.sourceEvidence.templatePageFactSetKey))].sort(),
        factVariants: Object.fromEntries(
          REQUIRED_BINDING_FACT_KEYS.map((factKey) => [factKey, variantsFor(factKey)]),
        ),
        missingFacts,
        requiredFactGaps,
        optionalOmissions,
        conflicts,
        sourceDisagreements,
        state: requiredFactGaps.length > 0 || conflicts.length > 0
          ? "blocked_missing_or_conflicting_source_facts"
          : "display_facts_reviewed_optional_omissions_retained",
      };
    });
}

async function atomicWrite(destination, bytes) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  await fs.writeFile(temporary, bytes, { flag: "wx" });
  await fs.rename(temporary, destination);
}

async function loadPinnedContract(runDirectory, record, label) {
  const artifact = await readJsonArtifact(
    runDirectory,
    safeRelativePath(record.path, `${label}.path`, ".json"),
    label,
  );
  assert(artifact.byteSize === Number(record.bytes), `${label} byte size drifted`);
  assert(artifact.sha256 === validSha256(record.sha256, `${label}.sha256`), `${label} SHA-256 drifted`);
  return {
    path: artifact.relativePath,
    sha256: artifact.sha256,
    bytes: artifact.byteSize,
    value: artifact.value,
  };
}

function validateProductDraftApprovalDecision(decision, { bindingCount, sanitizedPdfCount }) {
  assert(decision?.schemaVersion === 1, "Product-draft approval schemaVersion must be 1");
  assert(
    decision?.kind === "wmd_sales_folder_product_draft_approval_decision",
    "Product-draft approval kind drifted",
  );
  assert(
    decision?.state === "approved_for_supplier_bank_and_unpublished_product_draft",
    "Product-draft approval state is not sufficient for an unpublished guide projection",
  );
  assert(typeof decision?.reviewer === "string" && decision.reviewer.trim().length > 0, "Product-draft approval reviewer is missing");
  assert(!Number.isNaN(Date.parse(decision?.reviewedAt)), "Product-draft approval reviewedAt is invalid");
  assert(
    Number(decision?.approvedCounts?.exactSparseCombinations) === bindingCount,
    "Product-draft approval binding count drifted",
  );
  assert(
    Number(decision?.approvedCounts?.sanitizedPdfs) === sanitizedPdfCount,
    "Product-draft approval sanitized-PDF count drifted",
  );
  assert(decision?.target?.isPublished === false, "Product-draft approval must remain unpublished");
  assert(
    decision?.userAuthorization?.interpretedScope?.includes("create_one_new_webprinter_product_draft"),
    "Product-draft approval does not authorize the unpublished product draft",
  );
  assert(
    decision?.explicitlyNotAuthorized?.includes("publish_product"),
    "Product-draft approval must explicitly exclude publication",
  );
}

export async function buildNativeGuideFacts({
  runDirectory = DEFAULT_RUN_DIRECTORY,
  outputPath = DEFAULT_OUTPUT_PATH,
  machineOutputPath = DEFAULT_MACHINE_OUTPUT_PATH,
  writeOutput = true,
  pdfTextExtractor = extractPdfPages,
} = {}) {
  const resolvedRunDirectory = path.resolve(runDirectory);
  const [
    planArtifact,
    batchArtifact,
    contractManifestArtifact,
    renderReviewArtifact,
    auditArtifact,
    supplementArtifact,
    approvedSupplementArtifact,
    productDraftApprovalArtifact,
  ] = await Promise.all([
    readJsonArtifact(resolvedRunDirectory, INPUT_PATHS.sanitizationPlan, "sanitization plan"),
    readJsonArtifact(resolvedRunDirectory, INPUT_PATHS.sanitizationBatch, "sanitization batch"),
    readJsonArtifact(resolvedRunDirectory, INPUT_PATHS.sanitizationContractManifest, "sanitization contract manifest"),
    readJsonArtifact(resolvedRunDirectory, INPUT_PATHS.renderReview, "sanitized PDF render review"),
    readJsonArtifact(resolvedRunDirectory, INPUT_PATHS.geometryAudit, "geometry audit"),
    readJsonArtifact(resolvedRunDirectory, INPUT_PATHS.geometrySupplement, "geometry supplement"),
    readJsonArtifact(resolvedRunDirectory, INPUT_PATHS.approvedGeometrySupplement, "approved geometry supplement"),
    readJsonArtifact(resolvedRunDirectory, INPUT_PATHS.productDraftApprovalDecision, "product-draft approval decision"),
  ]);
  const plan = planArtifact.value;
  const batch = batchArtifact.value;
  const contractManifest = contractManifestArtifact.value;
  const renderReview = renderReviewArtifact.value;
  const audit = auditArtifact.value;
  const approvedSupplement = approvedSupplementArtifact.value;
  const productDraftApproval = productDraftApprovalArtifact.value;

  assert(plan?.schemaVersion === 1 && Array.isArray(plan.jobs), "Sanitization plan schema drifted");
  assert(batch?.schemaVersion === 1 && Array.isArray(batch.jobs), "Sanitization batch schema drifted");
  assert(contractManifest?.reviewState === "approved_for_sanitization", "Sanitization contract manifest is not approved");
  assert(audit?.schemaVersion === 1 && Array.isArray(audit.bindingAudits), "Geometry audit schema drifted");
  assert(approvedSupplement?.reviewState === "approved_title_only_construction_text_error", "Approved geometry supplement review state drifted");
  assert(approvedSupplement.baseAuditSha256 === auditArtifact.sha256, "Approved geometry supplement points to another base audit");
  assertPinnedArtifact(plan.inputEvidence.geometryAudit, auditArtifact, "Sanitization plan geometry audit");
  assertPinnedArtifact(plan.inputEvidence.geometrySupplement, supplementArtifact, "Sanitization plan geometry supplement");
  assertPinnedArtifact(batch.inputEvidence.sanitizationProposalPlan, planArtifact, "Sanitization batch plan");
  assertPinnedArtifact(batch.inputEvidence.approvedContractManifest, contractManifestArtifact, "Sanitization batch contract manifest");
  assertPinnedArtifact(renderReview.inputEvidence.batchManifest, batchArtifact, "Render review batch manifest");
  assert(renderReview?.automatedReview?.passed === true, "Sanitized PDF render review has automated failures");
  assert(renderReview?.counts?.jobs === plan.jobs.length, "Sanitized PDF render-review job count drifted");
  validateProductDraftApprovalDecision(productDraftApproval, {
    bindingCount: Number(plan.counts.bindings),
    sanitizedPdfCount: Number(plan.counts.outputJobs),
  });
  assertAllFalse(batch.prohibitedActionsPerformed, "Sanitization batch prohibited actions");
  assertAllFalse(renderReview.prohibitedActionsPerformed, "Render-review prohibited actions");

  const stubs = [];
  const stubsArtifact = await readJsonlArtifact(
    resolvedRunDirectory,
    INPUT_PATHS.templateStubs,
    "template projection stubs",
    (row, index) => {
      assert(row?.sourceOrder === index, `Template stub sourceOrder drifted at ${index}`);
      selectionsSignature(row.match);
      assert(typeof row?.guide?.sourceUrl === "string", `${row?.key || index} guide URL is missing`);
      stubs.push(row);
    },
  );
  assert(plan.counts.bindings === stubs.length, "Template stub count drifted from sanitization plan");
  assertPinnedArtifact(plan.inputEvidence.templateProjectionStubs, stubsArtifact, "Sanitization plan template stubs");

  const usedGuideUrls = new Set(stubs.map((stub) => stub.guide.sourceUrl));
  const usedTemplateUrls = new Set(plan.jobs.map((job) => job.source?.executionIdentity?.sourceUrl));
  assert(!usedTemplateUrls.has(undefined), "Sanitization plan contains a job without an execution source URL");
  const documentsByUrl = new Map();
  const documentCounts = { all: 0, guide: 0, template: 0 };
  const inventoryArtifact = await readJsonlArtifact(
    resolvedRunDirectory,
    INPUT_PATHS.documentInventory,
    "document inventory",
    (row, index) => {
      documentCounts.all += 1;
      if (row?.role === "guide") documentCounts.guide += 1;
      if (row?.role === "template") documentCounts.template += 1;
      if (!usedGuideUrls.has(row?.sourceUrl) && !usedTemplateUrls.has(row?.sourceUrl)) return;
      assert(!documentsByUrl.has(row.sourceUrl), `Document inventory repeats ${row.sourceUrl}`);
      documentsByUrl.set(row.sourceUrl, compactInventoryRow(row, index));
    },
  );
  assertPinnedArtifact(plan.inputEvidence.documentInventory, inventoryArtifact, "Sanitization plan document inventory");

  const usedGuideDocuments = [...usedGuideUrls]
    .map((sourceUrl) => {
      const document = documentsByUrl.get(sourceUrl);
      assert(document?.role === "guide", `Guide inventory record is missing for ${sourceUrl}`);
      return document;
    });
  const usedTemplateDocuments = [...usedTemplateUrls]
    .map((sourceUrl) => {
      const document = documentsByUrl.get(sourceUrl);
      assert(document?.role === "template", `Template inventory record is missing for ${sourceUrl}`);
      return document;
    });

  const [guideFactSets, templatePageFactSets] = await Promise.all([
    buildSourceFactSets({
      runDirectory: resolvedRunDirectory,
      documents: usedGuideDocuments,
      role: "guide",
      pdfTextExtractor,
    }),
    buildSourceFactSets({
      runDirectory: resolvedRunDirectory,
      documents: usedTemplateDocuments,
      role: "template",
      pdfTextExtractor,
    }),
  ]);
  const guideSetBySha = new Map(guideFactSets.map((entry) => [entry.sourcePdf.sha256, entry]));
  const templateSetBySha = new Map(templatePageFactSets.map((entry) => [entry.sourcePdf.sha256, entry]));

  const batchByJobId = new Map(batch.jobs.map((job) => [job.jobId, job]));
  const renderByJobId = new Map(renderReview.jobs.map((job) => [job.jobId, job]));
  const manifestContractByJobId = new Map(
    contractManifest.contractFiles.map((entry) => [entry.jobId, entry]),
  );
  assert(batchByJobId.size === batch.jobs.length, "Sanitization batch contains duplicate job IDs");
  assert(renderByJobId.size === renderReview.jobs.length, "Render review contains duplicate job IDs");
  assert(manifestContractByJobId.size === contractManifest.contractFiles.length, "Contract manifest contains duplicate job IDs");
  const contractRecords = await mapLimit(plan.jobs, 12, async (planJob) => {
    const batchJob = batchByJobId.get(planJob.jobId);
    assert(batchJob, `Sanitization batch omits ${planJob.jobId}`);
    const manifestRecord = manifestContractByJobId.get(planJob.jobId);
    assert(manifestRecord, `Contract manifest omits ${planJob.jobId}`);
    assert(sameJson(batchJob.contract, {
      path: manifestRecord.path,
      sha256: manifestRecord.sha256,
      bytes: manifestRecord.bytes,
    }), `${planJob.jobId} contract pins drifted between manifests`);
    const [contractRecord, inspectionRecord] = await Promise.all([
      loadPinnedContract(
        resolvedRunDirectory,
        batchJob.contract,
        `${planJob.jobId} contract`,
      ),
      loadPinnedContract(
        resolvedRunDirectory,
        batchJob.inspection,
        `${planJob.jobId} sanitization inspection`,
      ),
    ]);
    const contract = contractRecord.value;
    const inspection = inspectionRecord.value;
    const renderJob = renderByJobId.get(planJob.jobId);
    assert(contract?.kind === "wmd_sales_folder_sanitization_contract", `${planJob.jobId} contract kind drifted`);
    assert(contract?.reviewState === "approved_for_sanitization", `${planJob.jobId} contract is not approved`);
    assert(contract?.eligibleForTemplateImport === false, `${planJob.jobId} contract overstates template-import approval`);
    assert(contract?.sourceEvidence?.sha256 === planJob.source.executionIdentity.sha256, `${planJob.jobId} source hash drifted`);
    assert(sameJson(contract.geometry, {
      format: planJob.geometry.format,
      construction: planJob.geometry.construction,
      print: planJob.geometry.print,
      spineMm: planJob.geometry.spineMm,
    }), `${planJob.jobId} contract geometry drifted`);
    assertAllFalse(contract.prohibitedActionsPerformed, `${planJob.jobId} contract prohibited actions`);
    assert(inspection?.sourceSha256 === contract.sourceEvidence.sha256, `${planJob.jobId} inspection source hash drifted`);
    assert(inspection?.contractSha256 === contractRecord.sha256, `${planJob.jobId} inspection contract hash drifted`);
    assert(inspection?.outputSha256 === batchJob.sanitizedPdf.sha256, `${planJob.jobId} inspection output hash drifted`);
    assert(inspection?.validation?.pageBoxesPreserved === true, `${planJob.jobId} page boxes were not preserved`);
    assert(inspection?.fullPageRasterization === false, `${planJob.jobId} sanitized PDF was flattened`);
    assertAllFalse(inspection.prohibitedActionsPerformed, `${planJob.jobId} inspection prohibited actions`);
    assert(renderJob?.automatedChecks?.passed === true, `${planJob.jobId} has no passing rendered-PDF evidence`);
    assert(renderJob?.sanitizedPdf?.sha256 === batchJob.sanitizedPdf.sha256, `${planJob.jobId} render source hash drifted`);
    return [planJob.jobId, { contractRecord, inspectionRecord, batchJob, renderJob }];
  });
  const evidenceByJobId = new Map(contractRecords);

  const planBindingByStubKey = new Map();
  for (const planJob of plan.jobs) {
    for (const covered of planJob.coveredBindings) {
      assert(!planBindingByStubKey.has(covered.stubKey), `${covered.stubKey} is covered by multiple sanitization jobs`);
      planBindingByStubKey.set(covered.stubKey, { planJob, covered });
    }
  }
  assert(planBindingByStubKey.size === stubs.length, "Sanitization plan does not cover every template stub exactly once");

  const bindings = stubs.map((stub) => {
    const mapped = planBindingByStubKey.get(stub.key);
    assert(mapped, `Sanitization plan omits ${stub.key}`);
    const { planJob, covered } = mapped;
    assert(sameJson(stub.match, covered.selections), `${stub.key} selections drifted from sanitization plan`);
    const guideDocument = documentsByUrl.get(stub.guide.sourceUrl);
    const templateDocument = documentsByUrl.get(planJob.source.executionIdentity.sourceUrl);
    assert(guideDocument?.role === "guide", `${stub.key} guide document is missing`);
    assert(templateDocument?.role === "template", `${stub.key} template document is missing`);
    assert(templateDocument.sha256 === planJob.source.executionIdentity.sha256, `${stub.key} template source hash drifted`);
    const guideSet = guideSetBySha.get(guideDocument.sha256);
    const templateSet = templateSetBySha.get(templateDocument.sha256);
    assert(guideSet && templateSet, `${stub.key} source fact set is missing`);
    const evidenceRecord = evidenceByJobId.get(planJob.jobId);
    const { contractRecord, inspectionRecord, batchJob, renderJob } = evidenceRecord;
    const reviewed = bindingFacts({ guideSet, templateSet, evidenceRecord });
    const missingFacts = reviewed.missingFacts;
    const conflicts = reviewed.conflicts;
    const { optionalOmissions, requiredFactGaps } = classifyMissingFacts(missingFacts);
    const factsReviewed = requiredFactGaps.length === 0 && conflicts.length === 0;
    return {
      sourceOrder: stub.sourceOrder,
      documentKey: stub.key,
      nativeGuideKey: stub.guide.nativeGuideKey,
      match: Object.fromEntries(TEMPLATE_BINDING_AXES.map((axis) => [axis, stub.match[axis]])),
      geometry: {
        key: planJob.geometry.expectedGeometryKey,
        axes: {
          format: planJob.geometry.format,
          construction: planJob.geometry.construction,
          print: planJob.geometry.print,
          spineMm: planJob.geometry.spineMm,
        },
      },
      factsReviewed,
      state: !factsReviewed
        ? "blocked_missing_or_conflicting_source_facts"
        : "display_facts_reviewed_optional_omissions_retained",
      facts: reviewed.facts,
      missingFacts,
      requiredFactGaps,
      optionalOmissions,
      conflicts,
      sourceDisagreements: reviewed.sourceDisagreements,
      sourceEvidence: {
        guideFactSetKey: guideSet.key,
        guideSourceUrl: guideDocument.sourceUrl,
        guidePath: guideDocument.localRelativePath,
        guideSha256: guideDocument.sha256,
        templatePageFactSetKey: templateSet.key,
        templateSourceUrl: templateDocument.sourceUrl,
        templatePath: templateDocument.localRelativePath,
        templateSha256: templateDocument.sha256,
        sanitizationJobId: planJob.jobId,
        contractPath: contractRecord.path,
        contractSha256: contractRecord.sha256,
        contractBytes: contractRecord.bytes,
        contractSourceTextSha256: contractRecord.value.sourceEvidence.textSha256,
        contractPageBoxesSha256: contractRecord.value.sourceEvidence.pageBoxesSha256,
        sanitizationInspectionPath: inspectionRecord.path,
        sanitizationInspectionSha256: inspectionRecord.sha256,
        sanitizedPdfPath: batchJob.sanitizedPdf.path,
        sanitizedPdfSha256: batchJob.sanitizedPdf.sha256,
        renderReviewManifestPath: renderReviewArtifact.relativePath,
        renderReviewManifestSha256: renderReviewArtifact.sha256,
        renderDocumentGroupSha256: renderJob.documentRenderGroupSha256,
      },
      contractAgreement: reviewed.contractAgreement,
    };
  });
  bindings.sort((left, right) => left.sourceOrder - right.sourceOrder);
  bindings.forEach((binding, index) => assert(binding.sourceOrder === index, `Binding sourceOrder drifted at ${index}`));

  const summary = summarizeBindings(bindings);
  const geometries = geometryRecords(bindings);
  const sharedArtifactFields = {
    schemaVersion: 1,
    localOnly: true,
    extractionPolicy: {
      sourceOfTruth: "exact downloaded supplier guide and template PDFs plus approved sanitization contracts",
      pdfTextExtractor: "pdfjs-dist/build/pdf.js",
      sourceLanguage: "de",
      normalizedLanguage: "da",
      translationsLimitedToFixedLabelsAndDirectTechnicalRules: true,
      unlabeledDiagramMeasurementsAreNotPanelWidths: true,
      foldPathOperatorCountsAreNotFoldCounts: true,
      missingFactsRemainNullAndClassified: true,
      requiredDisplayFactGapsAreBlocking: true,
      optionalOmissionsAreNotDisplayedAndDoNotBlockExactPdfImport: true,
      factsReviewedMeaning: "every fact exposed for native-guide display is source-backed and conflict-free",
      manualPageByPageReviewClaimed: false,
    },
    requiredFactKeys: [...REQUIRED_BINDING_FACT_KEYS],
    requiredDisplayFactKeys: [...REQUIRED_DISPLAY_FACT_KEYS],
    optionalOmissionKeys: [...OPTIONAL_OMISSION_KEYS].sort(),
    inputEvidence: {
      templateProjectionStubs: artifactEvidence(stubsArtifact, stubsArtifact.rowCount),
      documentInventory: artifactEvidence(inventoryArtifact, inventoryArtifact.rowCount),
      sanitizationPlan: artifactEvidence(planArtifact),
      sanitizationBatch: artifactEvidence(batchArtifact),
      sanitizationContractManifest: artifactEvidence(contractManifestArtifact),
      renderReview: artifactEvidence(renderReviewArtifact),
      geometryAudit: artifactEvidence(auditArtifact),
      geometrySupplement: artifactEvidence(supplementArtifact),
      approvedGeometrySupplement: artifactEvidence(approvedSupplementArtifact),
      productDraftApprovalDecision: artifactEvidence(productDraftApprovalArtifact),
    },
    coverage: {
      ...summary,
      exactGeometries: geometries.length,
      usedGuideUrls: usedGuideUrls.size,
      usedGuidePayloads: guideFactSets.length,
      usedTemplateUrls: usedTemplateUrls.size,
      usedTemplatePayloads: templatePageFactSets.length,
      sanitizationContracts: evidenceByJobId.size,
      inventoryDocuments: documentCounts,
    },
    guideFactSets,
    templatePageFactSets,
    geometries,
  };
  const machineBindings = bindings.map((binding) => ({
    ...binding,
    displayedFactsEligibleForPromotion: binding.factsReviewed,
    factsReviewed: false,
    state: binding.factsReviewed
      ? "machine_extracted_display_facts_eligible_for_promotion"
      : "blocked_missing_or_conflicting_source_facts",
  }));
  const machineSummary = summarizeBindings(machineBindings);
  const machineArtifact = {
    ...sharedArtifactFields,
    kind: "wmd_sales_folder_native_guide_facts_machine_extraction",
    state: machineBindings.every((binding) => binding.displayedFactsEligibleForPromotion)
      ? "machine_extracted_display_facts_eligible_for_promotion"
      : "blocked_missing_source_facts",
    reviewState: "product_draft_approval_projection_pending",
    factsReviewed: false,
    coverage: {
      ...sharedArtifactFields.coverage,
      ...machineSummary,
    },
    geometries: geometries.map((geometry) => ({
      ...geometry,
      state: geometry.requiredFactGaps.length === 0 && geometry.conflicts.length === 0
        ? "machine_extracted_display_facts_eligible_for_promotion"
        : "blocked_missing_or_conflicting_source_facts",
    })),
    bindings: machineBindings,
    promotionRequired: {
      decisionKind: "wmd_sales_folder_product_draft_approval_decision",
      decisionPath: productDraftApprovalArtifact.relativePath,
      sourceBackedDisplayedSubsetOnly: true,
      optionalFactsMustRemainUndisplayed: true,
    },
    authorizationBoundary: {
      authorized: [
        "read_local_source_pdfs",
        "extract_source_text",
        "write_local_machine_evidence",
      ],
      explicitlyNotAuthorized: [
        "mark_displayed_facts_reviewed_without_the_pinned_approval_projection",
        "modify_source_or_sanitized_pdfs",
        "storage_upload",
        "database_or_supplier_bank_write",
        "product_or_price_write",
        "publication",
      ],
    },
    prohibitedActionsPerformed: PROHIBITED_ACTIONS_PERFORMED,
  };
  const machineRelativePath = safeRelativePath(
    machineOutputPath,
    "machine native guide facts output",
    ".json",
  );
  const machineBytes = Buffer.from(`${JSON.stringify(machineArtifact, null, 2)}\n`, "utf8");
  const machineEvidence = {
    path: machineRelativePath,
    sha256: sha256Bytes(machineBytes),
    bytes: machineBytes.length,
  };
  const artifact = {
    ...sharedArtifactFields,
    kind: "wmd_sales_folder_native_guide_facts",
    state: summary.displayedFactsUnreviewedBindings > 0 || summary.bindingsWithConflicts > 0
      ? "blocked_missing_source_facts"
      : "reviewed_source_facts_with_optional_omissions",
    reviewState: summary.displayedFactsUnreviewedBindings > 0
      ? "source_evidence_review_incomplete"
      : "source_evidence_reviewed_for_display",
    factsReviewed: summary.displayedFactsUnreviewedBindings === 0,
    inputEvidence: {
      ...sharedArtifactFields.inputEvidence,
      machineExtraction: machineEvidence,
    },
    coverage: sharedArtifactFields.coverage,
    bindings,
    promotionEvidence: {
      machineExtraction: machineEvidence,
      productDraftApprovalDecision: {
        ...artifactEvidence(productDraftApprovalArtifact),
        state: productDraftApproval.state,
        reviewer: productDraftApproval.reviewer,
        reviewedAt: productDraftApproval.reviewedAt,
      },
      appliedScope: "source-backed conflict-free facts selected for display in the approved unpublished product draft",
      optionalFactsOmittedFromDisplay: [...OPTIONAL_OMISSION_KEYS].sort(),
      manualPageByPageReviewClaimed: false,
    },
    authorizationBoundary: {
      authorized: [
        "read_local_source_pdfs",
        "extract_source_text",
        "write_local_review_evidence",
        "promote_only_source_backed_display_facts_for_the_approved_unpublished_draft",
      ],
      explicitlyNotAuthorized: [
        "modify_source_or_sanitized_pdfs",
        "approve_human_review",
        "storage_upload",
        "database_or_supplier_bank_write",
        "product_or_price_write",
        "publication",
      ],
    },
    prohibitedActionsPerformed: PROHIBITED_ACTIONS_PERFORMED,
  };
  validateNativeGuideFactsArtifact(artifact, {
    expectedBindings: stubs.map((stub) => ({
      sourceOrder: stub.sourceOrder,
      documentKey: stub.key,
      match: stub.match,
      guide: { sourceUrl: stub.guide.sourceUrl },
    })),
    expectedInputEvidence: {
      templateProjectionStubs: artifactEvidence(stubsArtifact, stubsArtifact.rowCount),
      sanitizationPlan: artifactEvidence(planArtifact),
      sanitizationBatch: artifactEvidence(batchArtifact),
    },
  });

  if (!writeOutput) return { machineArtifact, machineOutput: machineEvidence, artifact, output: null };
  const outputRelativePath = safeRelativePath(outputPath, "native guide facts output", ".json");
  const outputAbsolutePath = safeRunPath(
    resolvedRunDirectory,
    outputRelativePath,
    "native guide facts output",
    ".json",
  );
  const bytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`, "utf8");
  const machineAbsolutePath = safeRunPath(
    resolvedRunDirectory,
    machineRelativePath,
    "machine native guide facts output",
    ".json",
  );
  await atomicWrite(machineAbsolutePath, machineBytes);
  await atomicWrite(
    `${machineAbsolutePath}.sha256`,
    Buffer.from(`${machineEvidence.sha256}  ${path.basename(machineAbsolutePath)}\n`, "utf8"),
  );
  await atomicWrite(outputAbsolutePath, bytes);
  const sha256 = sha256Bytes(bytes);
  await atomicWrite(
    `${outputAbsolutePath}.sha256`,
    Buffer.from(`${sha256}  ${path.basename(outputAbsolutePath)}\n`, "utf8"),
  );
  return {
    machineArtifact,
    machineOutput: machineEvidence,
    artifact,
    output: {
      path: outputRelativePath,
      sha256,
      bytes: bytes.length,
    },
  };
}

function validateFact(fact, key, bindingKey) {
  assert(fact && typeof fact === "object" && !Array.isArray(fact), `${bindingKey} ${key} fact is missing`);
  assert(["evidenced", "partial", "missing"].includes(fact.status), `${bindingKey} ${key} status is invalid`);
  if (fact.status === "missing") assert(fact.value === null, `${bindingKey} ${key} invents a missing value`);
}

export function validateNativeGuideFactsArtifact(artifact, {
  expectedBindings = null,
  expectedInputEvidence = null,
} = {}) {
  assert(artifact?.schemaVersion === 1, "Native guide facts schemaVersion must be 1");
  assert(artifact?.kind === "wmd_sales_folder_native_guide_facts", "Native guide facts kind drifted");
  assert(artifact?.localOnly === true, "Native guide facts must remain local only");
  assert(typeof artifact?.factsReviewed === "boolean", "Native guide facts review state is missing");
  assert(
    ["source_evidence_reviewed_for_display", "source_evidence_review_incomplete"].includes(artifact?.reviewState),
    "Native guide facts review boundary drifted",
  );
  assertAllFalse(artifact.prohibitedActionsPerformed, "Native guide facts prohibited actions");
  assert(sameJson(artifact.requiredFactKeys, REQUIRED_BINDING_FACT_KEYS), "Native guide facts required keys drifted");
  assert(sameJson(artifact.requiredDisplayFactKeys, REQUIRED_DISPLAY_FACT_KEYS), "Native displayed fact keys drifted");
  assert(sameJson(artifact.optionalOmissionKeys, [...OPTIONAL_OMISSION_KEYS].sort()), "Native optional omission keys drifted");
  assert(Array.isArray(artifact.guideFactSets), "Native guide fact sets are missing");
  assert(Array.isArray(artifact.templatePageFactSets), "Native template page fact sets are missing");
  assert(Array.isArray(artifact.geometries), "Native geometry facts are missing");
  assert(Array.isArray(artifact.bindings), "Native binding facts are missing");

  const guideSets = new Map();
  for (const factSet of artifact.guideFactSets) {
    assert(!guideSets.has(factSet.key), `Duplicate guide fact-set key ${factSet.key}`);
    validSha256(factSet?.sourcePdf?.sha256, `${factSet.key} source SHA-256`);
    validSha256(factSet?.extractedText?.normalizedTextSha256, `${factSet.key} text SHA-256`);
    guideSets.set(factSet.key, factSet);
  }
  const templateSets = new Map();
  for (const factSet of artifact.templatePageFactSets) {
    assert(!templateSets.has(factSet.key), `Duplicate template fact-set key ${factSet.key}`);
    validSha256(factSet?.sourcePdf?.sha256, `${factSet.key} source SHA-256`);
    validSha256(factSet?.extractedText?.normalizedTextSha256, `${factSet.key} text SHA-256`);
    templateSets.set(factSet.key, factSet);
  }

  const bindingsByKey = new Map();
  for (const [index, binding] of artifact.bindings.entries()) {
    assert(binding?.sourceOrder === index, `Native guide binding sourceOrder drifted at ${index}`);
    assert(typeof binding?.documentKey === "string" && binding.documentKey.length > 0, `Native guide binding ${index} has no documentKey`);
    assert(!bindingsByKey.has(binding.documentKey), `Duplicate native guide binding ${binding.documentKey}`);
    selectionsSignature(binding.match);
    for (const key of REQUIRED_BINDING_FACT_KEYS) validateFact(binding.facts?.[key], key, binding.documentKey);
    assert(Array.isArray(binding.missingFacts), `${binding.documentKey} missingFacts is invalid`);
    assert(Array.isArray(binding.requiredFactGaps), `${binding.documentKey} requiredFactGaps is invalid`);
    assert(Array.isArray(binding.optionalOmissions), `${binding.documentKey} optionalOmissions is invalid`);
    assert(Array.isArray(binding.conflicts), `${binding.documentKey} conflicts is invalid`);
    assert(Array.isArray(binding.sourceDisagreements), `${binding.documentKey} sourceDisagreements is invalid`);
    assert(sameJson(binding.missingFacts, [...new Set(binding.missingFacts)].sort()), `${binding.documentKey} missingFacts is not canonical`);
    const classifiedMissing = classifyMissingFacts(binding.missingFacts);
    assert(sameJson(binding.requiredFactGaps, classifiedMissing.requiredFactGaps), `${binding.documentKey} requiredFactGaps drifted`);
    assert(sameJson(binding.optionalOmissions, classifiedMissing.optionalOmissions), `${binding.documentKey} optionalOmissions drifted`);
    assert(sameJson(binding.conflicts, [...new Set(binding.conflicts)].sort()), `${binding.documentKey} conflicts is not canonical`);
    assert(
      sameJson(binding.sourceDisagreements, [...new Set(binding.sourceDisagreements)].sort()),
      `${binding.documentKey} sourceDisagreements is not canonical`,
    );
    assert(
      binding.factsReviewed === (binding.requiredFactGaps.length === 0 && binding.conflicts.length === 0),
      `${binding.documentKey} factsReviewed disagrees with displayed facts`,
    );
    const guideSet = guideSets.get(binding.sourceEvidence?.guideFactSetKey);
    const templateSet = templateSets.get(binding.sourceEvidence?.templatePageFactSetKey);
    assert(guideSet, `${binding.documentKey} references a missing guide fact set`);
    assert(templateSet, `${binding.documentKey} references a missing template page fact set`);
    assert(guideSet.sourcePdf.sha256 === binding.sourceEvidence.guideSha256, `${binding.documentKey} guide hash drifted`);
    assert(templateSet.sourcePdf.sha256 === binding.sourceEvidence.templateSha256, `${binding.documentKey} template hash drifted`);
    validSha256(binding.sourceEvidence.contractSha256, `${binding.documentKey} contract SHA-256`);
    bindingsByKey.set(binding.documentKey, binding);
  }

  if (expectedBindings) {
    assert(artifact.bindings.length === expectedBindings.length, "Native guide binding count drifted");
    for (const expected of expectedBindings) {
      const binding = bindingsByKey.get(expected.documentKey);
      assert(binding, `Native guide facts omit ${expected.documentKey}`);
      assert(binding.sourceOrder === expected.sourceOrder, `${expected.documentKey} sourceOrder drifted`);
      assert(sameJson(binding.match, expected.match), `${expected.documentKey} selections drifted`);
      assert(binding.sourceEvidence.guideSourceUrl === expected.guide.sourceUrl, `${expected.documentKey} guide URL drifted`);
    }
  }
  if (expectedInputEvidence) {
    for (const [key, expected] of Object.entries(expectedInputEvidence)) {
      assert(sameJson(artifact.inputEvidence?.[key], expected), `Native guide facts ${key} evidence drifted`);
    }
  }

  const summary = summarizeBindings(artifact.bindings);
  for (const [key, value] of Object.entries(summary)) {
    assert(sameJson(artifact.coverage?.[key], value), `Native guide facts coverage.${key} drifted`);
  }
  const geometryKeys = new Set(artifact.bindings.map((binding) => binding.geometry?.key));
  assert(artifact.geometries.length === geometryKeys.size, "Native guide geometry count drifted");
  assert(artifact.coverage.exactGeometries === geometryKeys.size, "Native guide coverage.exactGeometries drifted");
  const expectedState = summary.displayedFactsUnreviewedBindings > 0 || summary.bindingsWithConflicts > 0
    ? "blocked_missing_source_facts"
    : "reviewed_source_facts_with_optional_omissions";
  assert(artifact.state === expectedState, "Native guide facts state disagrees with binding evidence");
  assert(artifact.factsReviewed === (summary.displayedFactsUnreviewedBindings === 0), "Native guide facts top-level review state drifted");
  assert(
    artifact.reviewState === (artifact.factsReviewed
      ? "source_evidence_reviewed_for_display"
      : "source_evidence_review_incomplete"),
    "Native guide facts reviewState disagrees with binding evidence",
  );
  assert(
    sameJson(artifact.inputEvidence?.machineExtraction, artifact.promotionEvidence?.machineExtraction),
    "Native guide facts machine-extraction promotion pin drifted",
  );
  validSha256(
    artifact.promotionEvidence?.machineExtraction?.sha256,
    "Native guide facts machine-extraction SHA-256",
  );
  validSha256(
    artifact.promotionEvidence?.productDraftApprovalDecision?.sha256,
    "Native guide facts product-draft approval SHA-256",
  );
  assert(
    artifact.promotionEvidence?.productDraftApprovalDecision?.state
      === "approved_for_supplier_bank_and_unpublished_product_draft",
    "Native guide facts promotion lacks the unpublished product-draft approval",
  );
  assert(
    artifact.promotionEvidence?.manualPageByPageReviewClaimed === false,
    "Native guide facts overstate manual page-by-page review",
  );
  return {
    ...summary,
    exactGeometries: geometryKeys.size,
    state: artifact.state,
    reviewState: artifact.reviewState,
    factsReviewed: artifact.factsReviewed,
  };
}

function parseCli(argv) {
  const options = {
    runDirectory: DEFAULT_RUN_DIRECTORY,
    outputPath: DEFAULT_OUTPUT_PATH,
    machineOutputPath: DEFAULT_MACHINE_OUTPUT_PATH,
    writeOutput: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--run-dir") options.runDirectory = path.resolve(argv[++index]);
    else if (argument === "--output") options.outputPath = argv[++index];
    else if (argument === "--machine-output") options.machineOutputPath = argv[++index];
    else if (argument === "--no-write") options.writeOutput = false;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

async function main() {
  const result = await buildNativeGuideFacts(parseCli(process.argv.slice(2)));
  console.log(`Exact geometries: ${result.artifact.coverage.exactGeometries}`);
  console.log(`Exact bindings: ${result.artifact.coverage.exactBindings}`);
  console.log(`Guide payloads: ${result.artifact.coverage.usedGuidePayloads}`);
  console.log(`Template payloads: ${result.artifact.coverage.usedTemplatePayloads}`);
  console.log(`Bindings with missing facts: ${result.artifact.coverage.bindingsWithMissingFacts}`);
  console.log(`Bindings with conflicts: ${result.artifact.coverage.bindingsWithConflicts}`);
  console.log(`Displayed fact bindings reviewed: ${result.artifact.coverage.factsReviewedBindings}`);
  if (result.machineOutput) {
    console.log(`Machine evidence: ${result.machineOutput.path} (${result.machineOutput.sha256})`);
  }
  if (result.output) console.log(`Output: ${result.output.path} (${result.output.sha256})`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}
