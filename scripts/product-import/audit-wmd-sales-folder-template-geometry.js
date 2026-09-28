#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_VERSION = 1;
const EXACT_SUPPLIER_HOST = "www.wir-machen-druck.de";
const DEFAULT_PYTHON_BINARY =
  "/Users/thomasprintmaker/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const DEFAULT_TEXT_TIMEOUT_MS = 120_000;
const DEFAULT_TEXT_BATCH_SIZE = 40;
const PDF_TEXT_HELPER = path.join(
  SCRIPT_DIRECTORY,
  "inspect_wmd_sales_folder_geometry.py"
);
const GEOMETRY_AXES = Object.freeze(["format", "construction", "print", "spine"]);
const SUPPORTED_FORMATS = new Set([
  "a4",
  "a5",
  "a6",
  "din-lang",
  "square-21x21",
  "cd-135x135",
]);
const SUPPORTED_CONSTRUCTIONS = new Set([
  "2-part-standard",
  "2-part-standard-window",
  "2-part-2-flaps",
  "2-part-2-flaps-window",
  "2-part-3-flaps",
  "2-part-3-flaps-window",
  "2-part-closure",
  "3-part-1-flap",
]);
const SUPPORTED_PRINTS = new Set(["4+0", "4+4"]);
const SUPPORTED_SPINES = new Set([1, 3, 5, 10]);
const REQUIRED_TEXT_AXES = Object.freeze(["format", "print", "spine"]);
const EXPECTED_PREPARATION_STATE = "downloaded_and_structurally_inspected_review_required";

export const PROHIBITED_ACTIONS_PERFORMED = Object.freeze({
  sourcePdfModified: false,
  sourcePdfSanitized: false,
  sourcePdfUploaded: false,
  databaseWritten: false,
  productOrTemplateRecordWritten: false,
  published: false,
});

export class TemplateGeometryAuditError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "TemplateGeometryAuditError";
    this.details = details;
  }
}

function sha256Buffer(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Text(value) {
  return sha256Buffer(Buffer.from(String(value), "utf8"));
}

function sortedUnique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))]
    .sort((left, right) => String(left).localeCompare(String(right), "en", { numeric: true }));
}

function parseJsonl(text, sourceName) {
  const rows = [];
  for (const [index, rawLine] of String(text).split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    try {
      rows.push(JSON.parse(line));
    } catch (error) {
      throw new TemplateGeometryAuditError(
        `${sourceName}:${index + 1} is not valid JSON: ${error.message}`
      );
    }
  }
  return rows;
}

function normalizeSourceUrl(value, { pdf = false } = {}) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new TemplateGeometryAuditError(`Invalid supplier URL: ${String(value || "(empty)")}`);
  }
  if (
    url.protocol !== "https:"
    || url.hostname !== EXACT_SUPPLIER_HOST
    || url.port !== ""
    || url.username !== ""
    || url.password !== ""
    || url.hash !== ""
  ) {
    throw new TemplateGeometryAuditError(
      `Only exact https://${EXACT_SUPPLIER_HOST} evidence URLs are allowed: ${url.href}`
    );
  }
  if (pdf && (!/\.pdf$/i.test(url.pathname) || url.search !== "")) {
    throw new TemplateGeometryAuditError(
      `Template evidence must be an exact supplier PDF URL without query parameters: ${url.href}`
    );
  }
  return url.href;
}

function templateBasename(sourceUrl) {
  const parsed = new URL(normalizeSourceUrl(sourceUrl, { pdf: true }));
  const basename = path.posix.basename(parsed.pathname);
  try {
    return decodeURIComponent(basename).toLowerCase();
  } catch {
    return basename.toLowerCase();
  }
}

function factResult(values, evidence = []) {
  return { values: sortedUnique(values), evidence: sortedUnique(evidence) };
}

function emptyFacts() {
  return Object.fromEntries(GEOMETRY_AXES.map((axis) => [axis, factResult([])]));
}

function addFact(facts, axis, value, evidence) {
  if (value === null || value === undefined) return;
  facts[axis].values.push(value);
  if (evidence) facts[axis].evidence.push(String(evidence).slice(0, 180));
}

function finalizeFacts(facts) {
  return Object.fromEntries(GEOMETRY_AXES.map((axis) => [
    axis,
    factResult(facts[axis].values, facts[axis].evidence),
  ]));
}

/**
 * Parse only facts explicitly encoded in the supplier filename. This never
 * synthesizes or probes a sibling URL.
 */
export function parseTemplateFactsFromUrl(sourceUrl) {
  const basename = templateBasename(sourceUrl);
  const facts = emptyFacts();

  if (/_din_a4_/.test(basename)) addFact(facts, "format", "a4", "din_a4");
  if (/_din_a5_/.test(basename)) addFact(facts, "format", "a5", "din_a5");
  if (/_din_a6_/.test(basename)) addFact(facts, "format", "a6", "din_a6");
  if (/_din_lang_/.test(basename)) addFact(facts, "format", "din-lang", "din_lang");
  if (/_21x21cm_/.test(basename)) {
    addFact(facts, "format", "square-21x21", "21x21cm");
  }
  if (/_cd_/.test(basename)) addFact(facts, "format", "cd-135x135", "cd");

  const hasWindow = /_fenster_/.test(basename);
  if (/_2teilig_ohnelasche_/.test(basename)) {
    addFact(
      facts,
      "construction",
      hasWindow ? "2-part-standard-window" : "2-part-standard",
      hasWindow ? "2teilig_ohnelasche + fenster" : "2teilig_ohnelasche"
    );
  }
  if (/_2teilig_2laschen_/.test(basename)) {
    addFact(
      facts,
      "construction",
      hasWindow ? "2-part-2-flaps-window" : "2-part-2-flaps",
      hasWindow ? "2teilig_2laschen + fenster" : "2teilig_2laschen"
    );
  }
  if (/_2teilig_3laschen_/.test(basename)) {
    addFact(
      facts,
      "construction",
      hasWindow ? "2-part-3-flaps-window" : "2-part-3-flaps",
      hasWindow ? "2teilig_3laschen + fenster" : "2teilig_3laschen"
    );
  }
  if (/_3teilig_1lasche_/.test(basename)) {
    addFact(facts, "construction", "3-part-1-flap", "3teilig_1lasche");
  }
  if (/_3laschen_verschluss_/.test(basename) || /_2teilig_verschluss_/.test(basename)) {
    addFact(
      facts,
      "construction",
      "2-part-closure",
      /_3laschen_verschluss_/.test(basename) ? "3laschen_verschluss" : "2teilig_verschluss"
    );
  }

  const spineMatches = [...basename.matchAll(/_(1|3|5|10)mm_/g)];
  for (const match of spineMatches) {
    addFact(facts, "spine", Number(match[1]), match[0]);
  }

  const printMatches = [...basename.matchAll(/_(40|44)(?:plus)?_2\.pdf$/g)];
  for (const match of printMatches) {
    addFact(facts, "print", match[1] === "40" ? "4+0" : "4+4", match[0]);
  }

  return {
    sourceUrl: normalizeSourceUrl(sourceUrl, { pdf: true }),
    basename,
    roleLooksLikeTemplate: /_2\.pdf$/i.test(basename),
    facts: finalizeFacts(facts),
  };
}

export function normalizeExtractedPdfText(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\/hyphen\.cap/gi, "-")
    .replace(/\/f_/gi, "fi")
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\u00ad/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchedEvidence(text, regex) {
  const matches = [];
  for (const match of text.matchAll(regex)) {
    matches.push(match[0].trim().slice(0, 180));
  }
  return matches;
}

/** Parse only geometry statements present in extractable PDF text. */
export function parseTemplateFactsFromText(value) {
  const text = normalizeExtractedPdfText(value);
  const facts = emptyFacts();

  const formatPatterns = [
    ["a4", /\bdin\s*a\s*4\b/g],
    ["a5", /\bdin\s*a\s*5\b/g],
    ["a6", /\bdin\s*a\s*6\b/g],
    ["din-lang", /\bdin\s*lang\b/g],
    ["square-21x21", /(?:quadrat\s*)?21\s*[x×]\s*21\s*cm\b/g],
    ["cd-135x135", /\b(?:cd\s*-?\s*mappe|135\s*[x×]\s*135\s*mm)\b/g],
  ];
  for (const [format, regex] of formatPatterns) {
    for (const evidence of matchedEvidence(text, regex)) {
      addFact(facts, "format", format, evidence);
    }
  }

  const hasWindow = /\bfenster(?:stanzung)?\b/.test(text);
  const constructionPatterns = [
    ["2-part-closure", /\b2\s*-?\s*teilig\s+mit\s+verschluss\b/g],
    ["3-part-1-flap", /\b3\s*-?\s*teilig\s+mit\s+(?:(?:1|einer)\s+)?lasche\b/g],
    ["2-part-2-flaps", /\b2\s*-?\s*teilig\s+mit\s+2\s+laschen\b/g],
    ["2-part-3-flaps", /\b2\s*-?\s*teilig\s+mit\s+3\s+laschen\b/g],
  ];
  for (const [construction, regex] of constructionPatterns) {
    for (const evidence of matchedEvidence(text, regex)) {
      const withWindow = hasWindow && construction.endsWith("-flaps")
        ? `${construction}-window`
        : construction;
      addFact(facts, "construction", withWindow, evidence);
    }
  }
  if (
    hasWindow
    && facts.construction.values.length === 0
    && /\bmappe\s+f(?:ü|u)r\b/.test(text)
  ) {
    addFact(facts, "construction", "2-part-standard-window", "fensterstanzung");
  }

  for (const match of text.matchAll(/\b4\s*[\/+\-]\s*([04])\s+farbig\b/g)) {
    addFact(facts, "print", match[1] === "0" ? "4+0" : "4+4", match[0]);
  }

  const spinePatterns = [
    /\b(1|3|5|10)\s*mm\s+(?:mappen\s*-?\s*)?f(?:ü|u)llh(?:ö|o)he\b/g,
    /\bf(?:ü|u)llh(?:ö|o)he\s*(?::|von)?\s*(1|3|5|10)\s*mm\b/g,
  ];
  for (const regex of spinePatterns) {
    for (const match of text.matchAll(regex)) {
      addFact(facts, "spine", Number(match[1]), match[0]);
    }
  }

  return {
    characterCount: text.length,
    textSha256: sha256Text(text),
    facts: finalizeFacts(facts),
  };
}

function expectedGeometry(binding) {
  const format = String(binding?.classification?.formatKey || "");
  const construction = String(binding?.classification?.constructionKey || "");
  const print = String(binding?.classification?.printMode || "");
  const spine = Number(binding?.materialFacts?.spineDepthMm);
  const problems = [];
  if (!SUPPORTED_FORMATS.has(format)) problems.push(`unsupported format ${format || "(missing)"}`);
  if (!SUPPORTED_CONSTRUCTIONS.has(construction)) {
    problems.push(`unsupported construction ${construction || "(missing)"}`);
  }
  if (!SUPPORTED_PRINTS.has(print)) problems.push(`unsupported print ${print || "(missing)"}`);
  if (!SUPPORTED_SPINES.has(spine)) problems.push(`unsupported spine ${String(spine)}`);
  return { format, construction, print, spine, problems };
}

function geometryKey(geometry) {
  return `${geometry.format}|${geometry.construction}|${geometry.print}|${geometry.spine}mm`;
}

function bindingKey(binding) {
  return `${normalizeSourceUrl(binding?.sourceUrl)}|${String(binding?.materialId || "")}`;
}

function sameCompactBinding(inventoryBinding, rawBinding) {
  const expected = expectedGeometry(rawBinding);
  return (
    String(inventoryBinding?.sourceUrl || "") === normalizeSourceUrl(rawBinding.sourceUrl)
    && String(inventoryBinding?.sourceProductId || "") === String(rawBinding?.sourceProductId || "")
    && String(inventoryBinding?.sourceSku || "") === String(rawBinding?.sourceSku || "")
    && (inventoryBinding?.productSourceOrder ?? null) === (rawBinding?.productSourceOrder ?? null)
    && String(inventoryBinding?.materialId || "") === String(rawBinding.materialId || "")
    && (inventoryBinding?.materialSourceOrder ?? null) === (rawBinding?.materialSourceOrder ?? null)
    && (inventoryBinding?.materialLabel ?? null) === (rawBinding?.materialLabel ?? null)
    && inventoryBinding?.documentRole === "template"
    && inventoryBinding?.classification?.formatKey === expected.format
    && inventoryBinding?.classification?.constructionKey === expected.construction
    && inventoryBinding?.classification?.printMode === expected.print
    && inventoryBinding?.classification?.finishKey === rawBinding?.classification?.finishKey
    && Number(inventoryBinding?.materialFacts?.spineDepthMm) === expected.spine
    && inventoryBinding?.materialFacts?.paperKey === rawBinding?.materialFacts?.paperKey
  );
}

function blocker(code, message, evidence = null) {
  return { code, message, ...(evidence ? { evidence } : {}) };
}

function compareAxis({ axis, expected, urlFact, textFact, requireText }) {
  const blockers = [];
  if (urlFact.values.length === 0) {
    blockers.push(blocker(
      `URL_${axis.toUpperCase()}_MISSING`,
      `Template filename does not explicitly identify ${axis}`
    ));
  } else if (urlFact.values.length > 1) {
    blockers.push(blocker(
      `URL_${axis.toUpperCase()}_AMBIGUOUS`,
      `Template filename identifies multiple ${axis} values`,
      urlFact.values
    ));
  } else if (urlFact.values[0] !== expected) {
    blockers.push(blocker(
      `URL_${axis.toUpperCase()}_MISMATCH`,
      `Template filename identifies ${String(urlFact.values[0])}, expected ${String(expected)}`,
      urlFact.evidence
    ));
  }

  if (textFact.values.length > 1) {
    blockers.push(blocker(
      `PDF_TEXT_${axis.toUpperCase()}_AMBIGUOUS`,
      `PDF text identifies multiple ${axis} values`,
      textFact.values
    ));
  } else if (textFact.values.length === 1 && textFact.values[0] !== expected) {
    blockers.push(blocker(
      `PDF_TEXT_${axis.toUpperCase()}_MISMATCH`,
      `PDF text identifies ${String(textFact.values[0])}, expected ${String(expected)}`,
      textFact.evidence
    ));
  } else if (requireText && textFact.values.length === 0) {
    blockers.push(blocker(
      `PDF_TEXT_${axis.toUpperCase()}_MISSING`,
      `PDF text does not explicitly identify ${axis}`
    ));
  }

  if (
    urlFact.values.length === 1
    && textFact.values.length === 1
    && urlFact.values[0] !== textFact.values[0]
  ) {
    blockers.push(blocker(
      `${axis.toUpperCase()}_SOURCE_CONFLICT`,
      `Template URL and PDF text disagree about ${axis}`,
      { url: urlFact.values[0], pdfText: textFact.values[0] }
    ));
  }

  return {
    expected,
    url: urlFact,
    pdfText: textFact,
    verified: blockers.length === 0,
    blockers,
  };
}

function templateDocumentForBinding(binding) {
  const documents = Array.isArray(binding?.documents) ? binding.documents : [];
  const templates = documents.filter((document) => document?.role === "template");
  return templates.length === 1 && documents.filter((document) => document?.role === "guide").length === 1
    ? templates[0]
    : null;
}

function compactIdentity(binding, expected) {
  return {
    bindingKey: bindingKey(binding),
    sourceProductId: String(binding?.sourceProductId || ""),
    sourceSku: String(binding?.sourceSku || ""),
    sourceUrl: normalizeSourceUrl(binding?.sourceUrl),
    materialId: String(binding?.materialId || ""),
    materialLabel: binding?.materialLabel || null,
    paperKey: binding?.materialFacts?.paperKey || null,
    finishKey: binding?.classification?.finishKey || null,
    expectedGeometry: expected,
    expectedGeometryKey: geometryKey(expected),
  };
}

function addReuseBlockers(audits, group, { code, descriptor }) {
  const geometryKeys = sortedUnique(group.map((audit) => audit.expectedGeometryKey));
  if (geometryKeys.length <= 1) return null;
  const evidence = {
    descriptor,
    geometryKeys,
    sourceProductIds: sortedUnique(group.map((audit) => audit.sourceProductId)),
    materialIds: sortedUnique(group.map((audit) => audit.materialId)),
  };
  for (const audit of group) {
    audit.blockers.push(blocker(
      code,
      `One downloaded PDF is bound to different production geometries: ${geometryKeys.join("; ")}`,
      evidence
    ));
  }
  return evidence;
}

function groupBy(values, keyFn) {
  const groups = new Map();
  for (const value of values) {
    const key = keyFn(value);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(value);
  }
  return groups;
}

/**
 * Pure geometry audit. `pdfTextBySourceUrl` must contain read-only extraction
 * evidence for every inventory template URL.
 */
export function auditTemplateBindings({ bindings, inventory, pdfTextBySourceUrl }) {
  if (!Array.isArray(bindings) || bindings.length === 0) {
    throw new TemplateGeometryAuditError("Raw document bindings are empty");
  }
  if (!Array.isArray(inventory) || inventory.length === 0) {
    throw new TemplateGeometryAuditError("Downloaded document inventory is empty");
  }
  const textMap = pdfTextBySourceUrl instanceof Map
    ? pdfTextBySourceUrl
    : new Map(Object.entries(pdfTextBySourceUrl || {}));
  const inventoryTemplates = inventory.filter((document) => document?.role === "template");
  const inventoryByUrl = groupBy(inventoryTemplates, (document) => String(document?.sourceUrl || ""));
  const audits = [];
  const seenBindingKeys = new Set();

  for (const [index, binding] of bindings.entries()) {
    let key;
    try {
      key = bindingKey(binding);
    } catch (error) {
      throw new TemplateGeometryAuditError(`Binding ${index + 1}: ${error.message}`);
    }
    if (seenBindingKeys.has(key)) {
      throw new TemplateGeometryAuditError(`Duplicate raw binding: ${key}`);
    }
    seenBindingKeys.add(key);

    const expected = expectedGeometry(binding);
    const identity = compactIdentity(binding, expected);
    const audit = {
      ...identity,
      templateSourceUrl: null,
      templateSha256: null,
      templateLocalRelativePath: null,
      facts: null,
      reuse: null,
      blockers: expected.problems.map((problem) => blocker(
        "RAW_EXPECTED_GEOMETRY_INVALID",
        `Raw binding has invalid expected geometry: ${problem}`
      )),
    };
    const templateDocument = templateDocumentForBinding(binding);
    if (!templateDocument) {
      audit.blockers.push(blocker(
        "RAW_TEMPLATE_BINDING_INVALID",
        "Raw binding must contain exactly one guide and one template"
      ));
      audits.push(audit);
      continue;
    }

    let templateSourceUrl;
    try {
      templateSourceUrl = normalizeSourceUrl(templateDocument.url, { pdf: true });
    } catch (error) {
      audit.blockers.push(blocker("RAW_TEMPLATE_URL_INVALID", error.message));
      audits.push(audit);
      continue;
    }
    audit.templateSourceUrl = templateSourceUrl;
    const candidates = inventoryByUrl.get(templateSourceUrl) || [];
    if (candidates.length !== 1) {
      audit.blockers.push(blocker(
        candidates.length === 0 ? "INVENTORY_TEMPLATE_MISSING" : "INVENTORY_TEMPLATE_DUPLICATE",
        `Downloaded inventory has ${candidates.length} template entries for this exact source URL`
      ));
      audits.push(audit);
      continue;
    }
    const inventoryTemplate = candidates[0];
    audit.templateSha256 = String(inventoryTemplate.sha256 || "") || null;
    audit.templateLocalRelativePath = inventoryTemplate.localRelativePath || null;
    if (!/^[a-f0-9]{64}$/.test(audit.templateSha256 || "")) {
      audit.blockers.push(blocker(
        "INVENTORY_TEMPLATE_HASH_INVALID",
        "Downloaded inventory is missing a valid template SHA-256"
      ));
    }
    const compactBindings = Array.isArray(inventoryTemplate.selectionBindings)
      ? inventoryTemplate.selectionBindings
      : [];
    const inventoryBindingMatches = compactBindings.filter(
      (selection) => selection?.bindingKey === key
    );
    if (inventoryBindingMatches.length !== 1) {
      audit.blockers.push(blocker(
        inventoryBindingMatches.length === 0
          ? "INVENTORY_BINDING_MISSING"
          : "INVENTORY_BINDING_DUPLICATE",
        `Template inventory contains ${inventoryBindingMatches.length} copies of this raw binding`
      ));
    } else if (!sameCompactBinding(inventoryBindingMatches[0], binding)) {
      audit.blockers.push(blocker(
        "INVENTORY_BINDING_MISMATCH",
        "Template inventory selection facts do not match immutable raw binding facts"
      ));
    }

    let urlInspection;
    try {
      urlInspection = parseTemplateFactsFromUrl(templateSourceUrl);
    } catch (error) {
      audit.blockers.push(blocker("TEMPLATE_URL_FACTS_INVALID", error.message));
      audits.push(audit);
      continue;
    }
    if (!urlInspection.roleLooksLikeTemplate) {
      audit.blockers.push(blocker(
        "TEMPLATE_FILENAME_ROLE_AMBIGUOUS",
        "Supplier filename does not explicitly look like the _2.pdf template role"
      ));
    }

    const textEvidence = textMap.get(templateSourceUrl);
    if (!textEvidence || textEvidence.error) {
      audit.blockers.push(blocker(
        "PDF_TEXT_EXTRACTION_FAILED",
        textEvidence?.error || "No read-only PDF text extraction evidence was supplied"
      ));
      audits.push(audit);
      continue;
    }
    const textInspection = parseTemplateFactsFromText(textEvidence.text);
    if (!Number.isInteger(textEvidence.pageCount) || textEvidence.pageCount < 1) {
      audit.blockers.push(blocker(
        "PDF_TEXT_PAGE_COUNT_INVALID",
        "Read-only PDF text evidence has no valid page count"
      ));
    } else if (
      Number.isInteger(inventoryTemplate?.inspection?.pageCount)
      && textEvidence.pageCount !== inventoryTemplate.inspection.pageCount
    ) {
      audit.blockers.push(blocker(
        "PDF_TEXT_PAGE_COUNT_MISMATCH",
        "PDF text extraction page count differs from structural inventory inspection",
        {
          textExtraction: textEvidence.pageCount,
          structuralInspection: inventoryTemplate.inspection.pageCount,
        }
      ));
    }
    if (textInspection.characterCount === 0) {
      audit.blockers.push(blocker(
        "PDF_TEXT_EMPTY",
        "Downloaded PDF contains no extractable text for geometry verification"
      ));
    }

    const axes = {};
    for (const axis of GEOMETRY_AXES) {
      const requireText = REQUIRED_TEXT_AXES.includes(axis)
        || (axis === "construction" && !expected.construction.startsWith("2-part-standard"));
      axes[axis] = compareAxis({
        axis,
        expected: expected[axis],
        urlFact: urlInspection.facts[axis],
        textFact: textInspection.facts[axis],
        requireText,
      });
      audit.blockers.push(...axes[axis].blockers);
    }
    audit.facts = {
      filename: urlInspection.basename,
      url: urlInspection.facts,
      pdfText: {
        characterCount: textInspection.characterCount,
        textSha256: textEvidence.textSha256 || textInspection.textSha256,
        pageCount: textEvidence.pageCount ?? null,
        facts: textInspection.facts,
      },
      axes,
    };
    audits.push(audit);
  }

  const rawTemplateUrls = new Set(audits.map((audit) => audit.templateSourceUrl).filter(Boolean));
  const globalBlockers = [];
  const rawByBindingKey = new Map(bindings.map((binding) => [bindingKey(binding), binding]));
  const inventorySelectionOccurrences = new Map();
  for (const document of inventoryTemplates) {
    if (!rawTemplateUrls.has(String(document.sourceUrl || ""))) {
      globalBlockers.push(blocker(
        "UNUSED_INVENTORY_TEMPLATE",
        "Downloaded template inventory contains a template absent from immutable raw bindings",
        { sourceUrl: document.sourceUrl }
      ));
    }
    for (const selection of Array.isArray(document.selectionBindings)
      ? document.selectionBindings
      : []) {
      const key = String(selection?.bindingKey || "");
      inventorySelectionOccurrences.set(
        key,
        (inventorySelectionOccurrences.get(key) || 0) + 1
      );
      const rawBinding = rawByBindingKey.get(key);
      if (!rawBinding) {
        globalBlockers.push(blocker(
          "UNUSED_INVENTORY_SELECTION_BINDING",
          "Template inventory contains a selection absent from immutable raw bindings",
          { bindingKey: key, templateSourceUrl: document.sourceUrl }
        ));
        continue;
      }
      const rawTemplate = templateDocumentForBinding(rawBinding);
      if (!rawTemplate || rawTemplate.url !== document.sourceUrl) {
        globalBlockers.push(blocker(
          "INVENTORY_SELECTION_WRONG_TEMPLATE",
          "Template inventory assigns an immutable selection to a different supplier PDF",
          { bindingKey: key, templateSourceUrl: document.sourceUrl }
        ));
      }
    }
  }
  for (const [key, count] of inventorySelectionOccurrences) {
    if (count !== 1) {
      globalBlockers.push(blocker(
        "INVENTORY_SELECTION_GLOBAL_DUPLICATE",
        `Template inventory contains ${count} template assignments for one immutable selection`,
        { bindingKey: key }
      ));
    }
  }

  const urlReuseConflicts = [];
  for (const [sourceUrl, group] of groupBy(
    audits.filter((audit) => audit.templateSourceUrl),
    (audit) => audit.templateSourceUrl
  )) {
    const conflict = addReuseBlockers(audits, group, {
      code: "TEMPLATE_URL_REUSED_ACROSS_GEOMETRIES",
      descriptor: sourceUrl,
    });
    if (conflict) urlReuseConflicts.push(conflict);
  }

  const hashReuseConflicts = [];
  for (const [sha256, group] of groupBy(
    audits.filter((audit) => audit.templateSha256),
    (audit) => audit.templateSha256
  )) {
    const conflict = addReuseBlockers(audits, group, {
      code: "TEMPLATE_BYTES_REUSED_ACROSS_GEOMETRIES",
      descriptor: sha256,
    });
    if (conflict) hashReuseConflicts.push(conflict);
  }

  const reuseGroups = [];
  for (const [sha256, group] of groupBy(
    audits.filter((audit) => audit.templateSha256),
    (audit) => audit.templateSha256
  )) {
    const geometryKeys = sortedUnique(group.map((audit) => audit.expectedGeometryKey));
    const valid = geometryKeys.length === 1;
    const entry = {
      templateSha256: sha256,
      sourceUrls: sortedUnique(group.map((audit) => audit.templateSourceUrl)),
      geometryKeys,
      bindingCount: group.length,
      sourceProductIds: sortedUnique(group.map((audit) => audit.sourceProductId)),
      paperKeys: sortedUnique(group.map((audit) => audit.paperKey)),
      finishKeys: sortedUnique(group.map((audit) => audit.finishKey)),
      verdict: valid ? "allowed_identical_geometry" : "blocked_cross_geometry_reuse",
      permittedNonGeometryReuseAxes: valid ? ["paper", "quantity", "finish"] : [],
    };
    reuseGroups.push(entry);
    for (const audit of group) audit.reuse = entry;
  }

  for (const audit of audits) {
    audit.blockers = audit.blockers.filter((item, index, all) => (
      all.findIndex((candidate) => (
        candidate.code === item.code
        && candidate.message === item.message
        && JSON.stringify(candidate.evidence || null) === JSON.stringify(item.evidence || null)
      )) === index
    ));
    audit.geometryVerified = audit.blockers.length === 0;
    audit.templateReadyForSanitization = audit.geometryVerified;
    audit.templateReadyForImport = false;
  }

  const blockedBindings = audits.filter((audit) => !audit.geometryVerified);
  const verifiedBindings = audits.filter((audit) => audit.geometryVerified);
  const sourceProductIdsWithBlockedBindings = sortedUnique(
    blockedBindings.map((audit) => audit.sourceProductId)
  );
  return {
    schemaVersion: 1,
    scriptVersion: SCRIPT_VERSION,
    state: blockedBindings.length > 0 || globalBlockers.length > 0
      ? "blocked"
      : "geometry_verified_review_required",
    templateGeometryReady: blockedBindings.length === 0 && globalBlockers.length === 0,
    eligibleForTemplateSanitization: blockedBindings.length === 0 && globalBlockers.length === 0,
    eligibleForTemplateImport: false,
    eligibleForImport: false,
    counts: {
      rawBindings: bindings.length,
      inventoryTemplates: inventoryTemplates.length,
      auditedBindings: audits.length,
      verifiedBindings: verifiedBindings.length,
      blockedBindings: blockedBindings.length,
      sourceProductsWithBlockedBindings: sourceProductIdsWithBlockedBindings.length,
      allowedIdenticalGeometryReuseGroups: reuseGroups.filter(
        (group) => group.verdict === "allowed_identical_geometry" && group.bindingCount > 1
      ).length,
      blockedUrlReuseGroups: urlReuseConflicts.length,
      blockedByteReuseGroups: hashReuseConflicts.length,
      globalBlockers: globalBlockers.length,
    },
    sourceProductIdsWithBlockedBindings,
    globalBlockers,
    reuseGroups,
    bindingAudits: audits,
    prohibitedActionsPerformed: { ...PROHIBITED_ACTIONS_PERFORMED },
    nextGate: blockedBindings.length > 0 || globalBlockers.length > 0
      ? "Quarantine blocked bindings; obtain an exact supplier template or separately engineer and verify geometry"
      : "Sanitize source templates, render-review every page, and verify locked non-printing Designer export exclusion",
  };
}

function safeRelativePath(runDirectory, relativePath) {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new TemplateGeometryAuditError(`Inventory path must be relative: ${String(relativePath)}`);
  }
  const resolvedRun = path.resolve(runDirectory);
  const resolved = path.resolve(resolvedRun, relativePath);
  if (!resolved.startsWith(`${resolvedRun}${path.sep}`)) {
    throw new TemplateGeometryAuditError(`Inventory path escapes run directory: ${relativePath}`);
  }
  return resolved;
}

async function verifyTemplateFiles(runDirectory, inventory) {
  const verified = [];
  for (const [index, document] of inventory.entries()) {
    if (document?.role !== "template") continue;
    const sourceUrl = normalizeSourceUrl(document.sourceUrl, { pdf: true });
    const filePath = safeRelativePath(runDirectory, document.localRelativePath);
    const stat = await fs.lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new TemplateGeometryAuditError(`Template inventory path is not a regular file: ${filePath}`);
    }
    const realRun = await fs.realpath(runDirectory);
    const realFile = await fs.realpath(filePath);
    if (!realFile.startsWith(`${realRun}${path.sep}`)) {
      throw new TemplateGeometryAuditError(`Template file resolves outside run directory: ${filePath}`);
    }
    const bytes = await fs.readFile(filePath);
    const observedSha256 = sha256Buffer(bytes);
    if (observedSha256 !== document.sha256) {
      throw new TemplateGeometryAuditError(
        `Template ${index + 1} SHA-256 differs from downloaded inventory: ${sourceUrl}`
      );
    }
    if (bytes.length !== Number(document.byteSize)) {
      throw new TemplateGeometryAuditError(
        `Template ${index + 1} byte size differs from downloaded inventory: ${sourceUrl}`
      );
    }
    if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new TemplateGeometryAuditError(`Template file does not start with PDF magic: ${sourceUrl}`);
    }
    verified.push({
      key: sourceUrl,
      path: filePath,
      sourceUrl,
      sha256: observedSha256,
      byteSize: bytes.length,
    });
  }
  return verified;
}

function runPythonTextHelper(files, {
  pythonBinary = DEFAULT_PYTHON_BINARY,
  helperPath = PDF_TEXT_HELPER,
  timeoutMs = DEFAULT_TEXT_TIMEOUT_MS,
} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBinary, [helperPath], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PYTHONNOUSERSITE: "1" },
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    const maxOutputBytes = 20 * 1024 * 1024;
    let settled = false;
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      if (!settled) {
        settled = true;
        reject(new TemplateGeometryAuditError(
          `PDF text helper exceeded ${timeoutMs} ms wall timeout`
        ));
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > maxOutputBytes) {
        child.kill("SIGKILL");
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(new TemplateGeometryAuditError("PDF text helper exceeded output limit"));
        }
        return;
      }
      stdout.push(chunk);
    });
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new TemplateGeometryAuditError(`Could not run PDF text helper: ${error.message}`));
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new TemplateGeometryAuditError(
          `PDF text helper failed (${signal || code}): ${Buffer.concat(stderr).toString("utf8").trim()}`
        ));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(stdout).toString("utf8")));
      } catch (error) {
        reject(new TemplateGeometryAuditError(
          `PDF text helper returned invalid JSON: ${error.message}`
        ));
      }
    });
    child.stdin.end(`${JSON.stringify({ schemaVersion: 1, files })}\n`);
  });
}

async function extractPdfText(files, options = {}) {
  const results = new Map();
  const expectedByKey = new Map(files.map((file) => [file.key, file]));
  const batchSize = options.batchSize || DEFAULT_TEXT_BATCH_SIZE;
  for (let index = 0; index < files.length; index += batchSize) {
    const batch = files.slice(index, index + batchSize);
    const response = await runPythonTextHelper(
      batch.map((file) => ({ key: file.key, path: file.path })),
      options
    );
    if (response?.schemaVersion !== 1 || !Array.isArray(response.results)) {
      throw new TemplateGeometryAuditError("PDF text helper response has an invalid schema");
    }
    for (const result of response.results) {
      if (!batch.some((file) => file.key === result.key)) {
        throw new TemplateGeometryAuditError(
          `PDF text helper returned an unexpected key: ${String(result.key)}`
        );
      }
      if (results.has(result.key)) {
        throw new TemplateGeometryAuditError(
          `PDF text helper returned a duplicate key: ${String(result.key)}`
        );
      }
      const expected = expectedByKey.get(result.key);
      if (!result.error && (
        result.fileSha256 !== expected.sha256
        || Number(result.byteSize) !== expected.byteSize
      )) {
        throw new TemplateGeometryAuditError(
          `PDF bytes changed before text extraction: ${expected.sourceUrl}`
        );
      }
      results.set(result.key, result);
    }
    for (const file of batch) {
      if (!results.has(file.key)) {
        throw new TemplateGeometryAuditError(
          `PDF text helper omitted a template: ${file.sourceUrl}`
        );
      }
    }
  }
  return results;
}

async function assertVerifiedTemplateFiles(files) {
  for (const file of files) {
    const bytes = await fs.readFile(file.path);
    if (bytes.length !== file.byteSize || sha256Buffer(bytes) !== file.sha256) {
      throw new TemplateGeometryAuditError(
        `Downloaded template changed during geometry audit: ${file.sourceUrl}`
      );
    }
  }
}

async function readJson(pathname) {
  const bytes = await fs.readFile(pathname);
  try {
    return { bytes, value: JSON.parse(bytes.toString("utf8")) };
  } catch (error) {
    throw new TemplateGeometryAuditError(`${pathname} is not valid JSON: ${error.message}`);
  }
}

function validatePreparationEvidence({ rawSha256, bindings, inventory, plan, status }) {
  const blockers = [];
  if (plan?.sourceBindingsSha256 !== rawSha256) {
    blockers.push(blocker(
      "PREPARATION_PLAN_RAW_HASH_MISMATCH",
      "Document download plan is not bound to the immutable raw binding bytes"
    ));
  }
  if (status?.sourceBindingsSha256 !== rawSha256) {
    blockers.push(blocker(
      "PREPARATION_STATUS_RAW_HASH_MISMATCH",
      "Document preparation status is not bound to the immutable raw binding bytes"
    ));
  }
  if (plan?.bindingCount !== bindings.length) {
    blockers.push(blocker(
      "PREPARATION_BINDING_COUNT_MISMATCH",
      `Download plan has ${String(plan?.bindingCount)} bindings; raw evidence has ${bindings.length}`
    ));
  }
  if (status?.state !== EXPECTED_PREPARATION_STATE) {
    blockers.push(blocker(
      "PREPARATION_NOT_COMPLETE",
      `Preparation state is ${String(status?.state)}, expected ${EXPECTED_PREPARATION_STATE}`
    ));
  }
  if (status?.eligibleForImport !== false) {
    blockers.push(blocker(
      "PREPARATION_IMPORT_GATE_INVALID",
      "Preparation status must preserve eligibleForImport:false"
    ));
  }
  if (status?.counts?.downloadedAndInspected !== inventory.length) {
    blockers.push(blocker(
      "PREPARATION_INVENTORY_COUNT_MISMATCH",
      "Preparation status downloaded count does not match document inventory"
    ));
  }
  if (status?.counts?.errors !== 0) {
    blockers.push(blocker(
      "PREPARATION_HAS_ERRORS",
      "Document preparation status contains errors"
    ));
  }
  return blockers;
}

function reportMarkdown(report, runDirectory) {
  const lines = [
    "# WMD sales-folder template geometry audit",
    "",
    `- Run: \`${runDirectory}\``,
    `- State: **${report.state}**`,
    `- Geometry-ready bindings: ${report.counts.verifiedBindings}/${report.counts.auditedBindings}`,
    `- Blocked bindings: ${report.counts.blockedBindings}`,
    `- Affected supplier products: ${report.counts.sourceProductsWithBlockedBindings}`,
    `- Template geometry ready: **${report.templateGeometryReady ? "yes" : "no"}**`,
    "- Template import ready: **no**",
    "- Product import ready: **no**",
    "",
    "This is a read-only geometry gate. It does not sanitize, upload, bind, import, or publish a PDF.",
    "",
  ];
  if (report.globalBlockers.length) {
    lines.push("## Global blockers", "");
    for (const item of report.globalBlockers) {
      lines.push(`- **${item.code}** — ${item.message}`);
    }
    lines.push("");
  }
  const blocked = report.bindingAudits.filter((audit) => !audit.geometryVerified);
  lines.push("## Blocked bindings", "");
  if (!blocked.length) {
    lines.push("No geometry binding blockers were found.", "");
  } else {
    lines.push("| Product | Material | Expected geometry | Supplier template | Blockers |", "|---|---|---|---|---|");
    const limit = 500;
    for (const audit of blocked.slice(0, limit)) {
      const filename = audit.facts?.filename
        || (audit.templateSourceUrl ? templateBasename(audit.templateSourceUrl) : "missing");
      const codes = sortedUnique(audit.blockers.map((item) => item.code)).join(", ");
      lines.push(
        `| ${audit.sourceProductId || "—"} | ${audit.materialId || "—"} | \`${audit.expectedGeometryKey}\` | \`${filename}\` | ${codes} |`
      );
    }
    if (blocked.length > limit) {
      lines.push("", `Only the first ${limit} blocked rows are shown here; the JSON report contains all ${blocked.length}.`);
    }
    lines.push("");
  }
  const allowed = report.reuseGroups.filter(
    (group) => group.verdict === "allowed_identical_geometry" && group.bindingCount > 1
  );
  const rejected = report.reuseGroups.filter(
    (group) => group.verdict === "blocked_cross_geometry_reuse"
  );
  lines.push(
    "## PDF reuse review",
    "",
    `- Allowed identical-geometry reuse groups: ${allowed.length}`,
    `- Blocked cross-geometry reuse groups: ${rejected.length}`,
    "- Reuse is permitted only when format, construction, print mode, and spine are identical. Paper, quantity, and finish may then share the same geometry.",
    ""
  );
  if (rejected.length) {
    lines.push("| SHA-256 | Geometry keys | Binding count |", "|---|---|---|");
    for (const group of rejected.slice(0, 100)) {
      lines.push(
        `| \`${group.templateSha256}\` | ${group.geometryKeys.map((key) => `\`${key}\``).join("<br>")} | ${group.bindingCount} |`
      );
    }
    lines.push("");
  }
  lines.push(
    "## Next gate",
    "",
    report.nextGate,
    "",
    "Even a geometry-verified source template remains ineligible for import until supplier identity is removed without damaging vectors/layers, all pages are rendered and reviewed, the exact sanitized hash is bound to Designer, and export exclusion is proven.",
    ""
  );
  return `${lines.join("\n")}\n`;
}

async function atomicWrite(filePath, bytes) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, bytes, { flag: "wx" });
  await fs.rename(temporary, filePath);
}

async function assertNoConcurrentWriter(runDirectory) {
  const locks = [
    path.join(runDirectory, ".extractor.lock"),
    path.join(runDirectory, "documents", ".preparation.lock"),
  ];
  for (const lock of locks) {
    try {
      await fs.access(lock);
      throw new TemplateGeometryAuditError(
        `Refusing geometry audit while another run writer lock exists: ${lock}`
      );
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
}

async function acquireAuditLock(runDirectory, rawSha256) {
  const lockPath = path.join(runDirectory, "documents", ".template-geometry-audit.lock");
  let handle;
  try {
    handle = await fs.open(lockPath, "wx");
    await handle.writeFile(`${JSON.stringify({
      schemaVersion: 1,
      pid: process.pid,
      rawSha256,
      startedAt: new Date().toISOString(),
    }, null, 2)}\n`);
  } catch (error) {
    await handle?.close().catch(() => {});
    if (error?.code === "EEXIST") {
      throw new TemplateGeometryAuditError(`Geometry audit lock already exists: ${lockPath}`);
    }
    throw error;
  }
  return async () => {
    await handle.close();
    await fs.unlink(lockPath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  };
}

async function assertFingerprint(pathname, expectedSha256) {
  const bytes = await fs.readFile(pathname);
  if (sha256Buffer(bytes) !== expectedSha256) {
    throw new TemplateGeometryAuditError(`Input evidence changed during audit: ${pathname}`);
  }
}

export async function auditRun({
  runDirectory,
  pythonBinary = DEFAULT_PYTHON_BINARY,
  helperPath = PDF_TEXT_HELPER,
  timeoutMs = DEFAULT_TEXT_TIMEOUT_MS,
  textBatchSize = DEFAULT_TEXT_BATCH_SIZE,
  beforeFinalEvidenceCheck = null,
}) {
  const resolvedRun = path.resolve(runDirectory);
  await assertNoConcurrentWriter(resolvedRun);
  const rawPath = path.join(resolvedRun, "raw", "document-bindings.jsonl");
  const inventoryPath = path.join(resolvedRun, "documents", "document-files.jsonl");
  const planPath = path.join(resolvedRun, "documents", "document-download-plan.json");
  const preparationStatusPath = path.join(resolvedRun, "documents", "preparation-status.json");
  const rawBytes = await fs.readFile(rawPath);
  const inventoryBytes = await fs.readFile(inventoryPath);
  const planRead = await readJson(planPath);
  const statusRead = await readJson(preparationStatusPath);
  const rawSha256 = sha256Buffer(rawBytes);
  const inventorySha256 = sha256Buffer(inventoryBytes);
  const planSha256 = sha256Buffer(planRead.bytes);
  const statusSha256 = sha256Buffer(statusRead.bytes);
  const bindings = parseJsonl(rawBytes.toString("utf8"), rawPath);
  const inventory = parseJsonl(inventoryBytes.toString("utf8"), inventoryPath);
  const preparationBlockers = validatePreparationEvidence({
    rawSha256,
    bindings,
    inventory,
    plan: planRead.value,
    status: statusRead.value,
  });
  const releaseLock = await acquireAuditLock(resolvedRun, rawSha256);
  try {
    await assertNoConcurrentWriter(resolvedRun);
    const verifiedFiles = await verifyTemplateFiles(resolvedRun, inventory);
    const pdfTextBySourceUrl = await extractPdfText(verifiedFiles, {
      pythonBinary,
      helperPath,
      timeoutMs,
      batchSize: textBatchSize,
    });
    const report = auditTemplateBindings({ bindings, inventory, pdfTextBySourceUrl });
    report.auditedAt = new Date().toISOString();
    report.runDirectory = resolvedRun;
    report.inputEvidence = {
      rawBindings: { path: "raw/document-bindings.jsonl", sha256: rawSha256, rows: bindings.length },
      documentInventory: {
        path: "documents/document-files.jsonl",
        sha256: inventorySha256,
        rows: inventory.length,
      },
      downloadPlan: { path: "documents/document-download-plan.json", sha256: planSha256 },
      preparationStatus: { path: "documents/preparation-status.json", sha256: statusSha256 },
      verifiedTemplateFiles: verifiedFiles.map(({ sourceUrl, sha256, byteSize }) => ({
        sourceUrl,
        sha256,
        byteSize,
      })),
    };
    report.globalBlockers.unshift(...preparationBlockers);
    if (report.globalBlockers.length > 0) {
      report.state = "blocked";
      report.templateGeometryReady = false;
      report.eligibleForTemplateSanitization = false;
      report.counts.globalBlockers = report.globalBlockers.length;
    }
    if (typeof beforeFinalEvidenceCheck === "function") {
      await beforeFinalEvidenceCheck({ rawPath, inventoryPath, planPath, preparationStatusPath });
    }
    await assertNoConcurrentWriter(resolvedRun);
    await assertVerifiedTemplateFiles(verifiedFiles);
    await Promise.all([
      assertFingerprint(rawPath, rawSha256),
      assertFingerprint(inventoryPath, inventorySha256),
      assertFingerprint(planPath, planSha256),
      assertFingerprint(preparationStatusPath, statusSha256),
    ]);
    const jsonPath = path.join(resolvedRun, "review", "template-geometry-audit.json");
    const markdownPath = path.join(resolvedRun, "review", "template-geometry-audit.md");
    await atomicWrite(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
    await atomicWrite(markdownPath, reportMarkdown(report, resolvedRun));
    return { report, paths: { jsonPath, markdownPath } };
  } finally {
    await releaseLock();
  }
}

function parseArgs(argv) {
  const args = {
    runDirectory: null,
    pythonBinary: DEFAULT_PYTHON_BINARY,
    helperPath: PDF_TEXT_HELPER,
    timeoutMs: DEFAULT_TEXT_TIMEOUT_MS,
    textBatchSize: DEFAULT_TEXT_BATCH_SIZE,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (!argv[index]) throw new TemplateGeometryAuditError(`${arg} requires a value`);
      return argv[index];
    };
    if (arg === "--run") args.runDirectory = next();
    else if (arg === "--python") args.pythonBinary = next();
    else if (arg === "--helper") args.helperPath = next();
    else if (arg === "--timeout-ms") args.timeoutMs = Number(next());
    else if (arg === "--text-batch-size") args.textBatchSize = Number(next());
    else if (arg === "--help" || arg === "-h") {
      console.log([
        "Usage: node scripts/product-import/audit-wmd-sales-folder-template-geometry.js --run <run-directory>",
        "",
        "Read-only post-download audit. Reads source PDFs and writes only review JSON/Markdown.",
        "It never guesses/downloads URLs, edits PDFs, uploads assets, writes a database, or publishes.",
      ].join("\n"));
      return null;
    } else {
      throw new TemplateGeometryAuditError(`Unknown argument: ${arg}`);
    }
  }
  if (!args.runDirectory) throw new TemplateGeometryAuditError("--run is required");
  if (!Number.isInteger(args.timeoutMs) || args.timeoutMs < 1_000) {
    throw new TemplateGeometryAuditError("--timeout-ms must be an integer of at least 1000");
  }
  if (!Number.isInteger(args.textBatchSize) || args.textBatchSize < 1 || args.textBatchSize > 100) {
    throw new TemplateGeometryAuditError("--text-batch-size must be an integer from 1 to 100");
  }
  return args;
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args) return;
    const result = await auditRun(args);
    console.log(`State: ${result.report.state}`);
    console.log(
      `Verified bindings: ${result.report.counts.verifiedBindings}/${result.report.counts.auditedBindings}`
    );
    console.log(`Blocked bindings: ${result.report.counts.blockedBindings}`);
    console.log("Template import eligible: no");
    console.log(`Review: ${result.paths.markdownPath}`);
    if (result.report.state === "blocked") process.exitCode = 2;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
