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
  "tmp/supplier-imports/wmd-sales-folders-20260831-full"
);
const DEFAULT_OUTPUT_NAME = "template-resolution-plan.json";
const SEMANTIC_AXES = Object.freeze(["folder_model", "print", "spine", "paper", "finish"]);
const TITLE_ONLY_BLOCKERS = "CONSTRUCTION_SOURCE_CONFLICT|PDF_TEXT_CONSTRUCTION_MISMATCH";
const PURE_REUSE_BLOCKERS =
  "TEMPLATE_BYTES_REUSED_ACROSS_GEOMETRIES|TEMPLATE_URL_REUSED_ACROSS_GEOMETRIES";
const REUSED_SPINE_ALIAS_BLOCKERS =
  "PDF_TEXT_SPINE_MISMATCH|TEMPLATE_BYTES_REUSED_ACROSS_GEOMETRIES|" +
  "TEMPLATE_URL_REUSED_ACROSS_GEOMETRIES|URL_SPINE_MISMATCH";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export const CLASSIFICATIONS = Object.freeze([
  "base_verified",
  "pending_title_only",
  "exact_verified_rebind",
  "collateral_original_after_bad_alias_quarantine",
  "indirect_pending_title_rebind",
  "extended_exact_evidence",
]);

export const EXPECTED_CLASSIFICATION_COUNTS = Object.freeze({
  base_verified: 3170,
  pending_title_only: 306,
  exact_verified_rebind: 52,
  collateral_original_after_bad_alias_quarantine: 140,
  indirect_pending_title_rebind: 2,
  extended_exact_evidence: 74,
});

const EXTENDED_EVIDENCE_FILE_SPECS = Object.freeze([
  {
    familyKey: "a4_3flap_4plus0_print_title_conflict",
    role: "original_template",
    path: "documents/source-pdfs/6a4741cc0f6f900e-mappe_din_a4_2teilig_3laschen_5mm_40_2.pdf",
    sha256: "0a23d95b2c72b1c07ab8cb46b60cc0a78b4a62805d0d20c5af77892bf5b07a9b",
  },
  {
    familyKey: "a4_3flap_4plus0_print_title_conflict",
    role: "pixel_geometry_4plus0_witness",
    path: "documents/source-pdfs/04874283213b58e6-mappe_din_a4_2teilig_3laschen_5mm_40plus_2.pdf",
    sha256: "995842cee982506ec5fee46335e9c3ee502ce7c0060b6c6454edd1ffda20fcc5",
  },
  {
    familyKey: "a4_3flap_4plus0_print_title_conflict",
    role: "4plus4_contrast",
    path: "documents/source-pdfs/893e6d8440803bf1-mappe_din_a4_2teilig_3laschen_5mm_44_2.pdf",
    sha256: "ce928b5e5250c34b08dc4be05238b94c3661aff4868c434905c15e52af4f9300",
  },
  {
    familyKey: "a6_closure_4plus0_finish_agnostic_rebind",
    role: "bad_1mm_alias",
    path: "documents/source-pdfs/b6cb4eb2ae5f0e6a-mappe_din_a6_3laschen_verschluss_1mm_40plus_2.pdf",
    sha256: "61e15b205045770786f3f678fa3bc9afe5cda9febad1a4fe0e32e865e5fdb983",
  },
  {
    familyKey: "a6_closure_4plus0_finish_agnostic_rebind",
    role: "3mm_matte_witness",
    path: "documents/source-pdfs/86392eb161353b66-mappe_din_a6_3laschen_verschluss_3mm_40plus_2.pdf",
    sha256: "fc14e52072d14920388f3565255fe1a6bac54cbe02acf00b77d16deca7ddeca8",
  },
  {
    familyKey: "a6_closure_4plus0_finish_agnostic_rebind",
    role: "3mm_partial_uv_byte_identity_witness",
    path: "documents/source-pdfs/58d46e1da0683d8c-mappe_din_a6_3laschen_verschluss_3mm_40plus_2.pdf",
    sha256: "fc14e52072d14920388f3565255fe1a6bac54cbe02acf00b77d16deca7ddeca8",
  },
  {
    familyKey: "a6_closure_4plus0_finish_agnostic_rebind",
    role: "5mm_witness",
    path: "documents/source-pdfs/096e8b09c8871430-mappe_din_a6_3laschen_verschluss_5mm_40plus_2.pdf",
    sha256: "62a31ce0ddb2f7304a21ccec391d77d5c20c6d3b0b42a58848cd43135d9e5c72",
  },
  {
    familyKey: "a6_closure_4plus0_finish_agnostic_rebind",
    role: "10mm_witness",
    path: "documents/source-pdfs/03a16e9d18fe09a1-mappe_din_a6_3laschen_verschluss_10mm_40plus_2.pdf",
    sha256: "38c9f981f3275eb702442d8443f5a80d2cd8767e23ef6b046d84a2ead1934885",
  },
  {
    familyKey: "square_21x21_4plus0_hyphen_parser_miss",
    role: "1mm_original_template",
    path: "documents/source-pdfs/af826991ea7a9b87-mappe_21x21cm_2teilig_2laschen_1mm_40_2.pdf",
    sha256: "f5b8df63ef5f46a82771ad4efb7919e88429e7f76d8ce11cf5a0efeff28a3eb3",
  },
  {
    familyKey: "square_21x21_4plus0_hyphen_parser_miss",
    role: "10mm_original_template",
    path: "documents/source-pdfs/a73323b613771ae8-mappe_21x21cm_2teilig_2laschen_10mm_40_2.pdf",
    sha256: "cef5624df8b2d35adc4cb2227edf6a52fa25fc9401dac34979e3dddba74f39d0",
  },
  {
    familyKey: "cd_135x135_spine_from_guide",
    role: "4plus0_none_template",
    path: "documents/source-pdfs/be355fa6e770debd-mappe_cd_2teilig_verschluss_3mm_40_2.pdf",
    sha256: "a2b3dc7453e920f30aad7dd4f95df94aeaa0d7a1375c4b6acd21568ffb16602a",
  },
  {
    familyKey: "cd_135x135_spine_from_guide",
    role: "4plus0_finished_template",
    path: "documents/source-pdfs/3f9fb0c24661f9d4-mappe_cd_2teilig_verschluss_3mm_40plus_2.pdf",
    sha256: "0262466cb9743607b95fe1c2a6714ce04d02eeb2bb8566952f5f2e728b3354af",
  },
  {
    familyKey: "cd_135x135_spine_from_guide",
    role: "4plus4_none_template",
    path: "documents/source-pdfs/481d3e39ce15e4c3-mappe_cd_2teilig_verschluss_3mm_44_2.pdf",
    sha256: "dabcba5fc8b9a0e1b631ff16811517d4c3f6032cead593c3d0a3e7b93f2a0d2c",
  },
  {
    familyKey: "cd_135x135_spine_from_guide",
    role: "4plus4_finished_template",
    path: "documents/source-pdfs/8c8862cba7e47cc8-mappe_cd_2teilig_verschluss_3mm_44plus_2.pdf",
    sha256: "d3bf18bc8aa997621648994871cad4363fa834b74220cb164ad3f728427159d9",
  },
  {
    familyKey: "cd_135x135_spine_from_guide",
    role: "4plus0_none_guide",
    path: "documents/source-pdfs/e876c0afd55b8e9d-mappe_cd_2teilig_verschluss_3mm_40_1.pdf",
    sha256: "6ad3569058591799a83c412f02d366fc5f98ef826f6290a0498eb0029ea215c2",
  },
  {
    familyKey: "cd_135x135_spine_from_guide",
    role: "4plus0_finished_guide",
    path: "documents/source-pdfs/46861057da1ee70b-mappe_cd_2teilig_verschluss_3mm_40plus_1.pdf",
    sha256: "f7a12aae95fefff0b251587ae7ee444f155384583899a41cd42a7afdeb61d4c0",
  },
  {
    familyKey: "cd_135x135_spine_from_guide",
    role: "4plus4_none_guide",
    path: "documents/source-pdfs/bbbe1c11a1f9ff53-mappe_cd_2teilig_verschluss_3mm_44_1.pdf",
    sha256: "0116e2b8552359b8feea4ef73b83688408c42e047f11bf39b058a4cdd1b6bbd4",
  },
  {
    familyKey: "cd_135x135_spine_from_guide",
    role: "4plus4_finished_guide",
    path: "documents/source-pdfs/578e638e11d2d082-mappe_cd_2teilig_verschluss_3mm_44plus_1.pdf",
    sha256: "c2470ad96239b24f941f5ab1538f459034f2dfd194e3fad86200f3bd4a28704e",
  },
  {
    familyKey: "a6_closure_4plus4_3mm_bad_pdf_title",
    role: "3mm_4plus4_guide",
    path: "documents/source-pdfs/9599f2168bd00da6-mappe_din_a6_3laschen_verschluss_3mm_44_1.pdf",
    sha256: "94102c9b5411012c2e7c48e14e1a293d59927b75cec38b1d435d46deb05ec7b3",
  },
  {
    familyKey: "a6_closure_4plus4_3mm_bad_pdf_title",
    role: "original_template_with_bad_title",
    path: "documents/source-pdfs/a072985c3b985abb-mappe_din_a6_3laschen_verschluss_3mm_44_2.pdf",
    sha256: "393ce3dff40d1f449b9d8e9298ebab6d9058874d8eac03333e50697f364723b7",
  },
  {
    familyKey: "a6_closure_4plus4_3mm_bad_pdf_title",
    role: "verified_3mm_geometry_witness",
    path: "documents/source-pdfs/7b8ac24c694c74c5-mappe_din_a6_3laschen_verschluss_3mm_44plus_2.pdf",
    sha256: "80d6508a95a7865234d2b0a2dad6c5cf4600e327b03ebc30b8e4cf8338c19f21",
  },
]);

const EXTENDED_FAMILY_CONTRACTS = Object.freeze([
  {
    familyKey: "a4_3flap_4plus0_print_title_conflict",
    baseBlockerCodes: [
      "CONSTRUCTION_SOURCE_CONFLICT",
      "PDF_TEXT_CONSTRUCTION_MISMATCH",
      "PDF_TEXT_PRINT_MISMATCH",
      "PRINT_SOURCE_CONFLICT",
    ],
    bindingCount: 4,
    targetCount: 1,
    resolutionMode: "original",
    sanitizerVerdictAfterApproval: "extended_exact_evidence_original",
    requirements: [
      "original_page_two_is_full_nonprint_area",
      "original_4plus0_geometry_matches_4plus0_witness",
      "original_geometry_differs_from_4plus4_contrast",
      "embedded_title_text_is_not_used_as_print_geometry_truth",
    ],
  },
  {
    familyKey: "a6_closure_4plus0_finish_agnostic_rebind",
    baseBlockerCodes: REUSED_SPINE_ALIAS_BLOCKERS.split("|"),
    bindingCount: 6,
    targetCount: 6,
    resolutionMode: "rebind",
    sanitizerVerdictAfterApproval: "extended_exact_evidence_rebind",
    requirements: [
      "resolved_template_matches_exact_expected_geometry",
      "resolved_template_has_no_finish_layer_spot_paint_or_finish_feature",
      "3mm_matte_and_partial_uv_witnesses_are_byte_identical",
      "finish_key_does_not_change_the_resolved_template_bytes",
    ],
  },
  {
    familyKey: "square_21x21_4plus0_hyphen_parser_miss",
    baseBlockerCodes: ["PDF_TEXT_PRINT_MISSING"],
    bindingCount: 8,
    targetCount: 2,
    resolutionMode: "original",
    sanitizerVerdictAfterApproval: "extended_exact_evidence_original",
    requirements: [
      "source_text_explicitly_contains_4_slash_0_hyphen_farbig",
      "page_two_is_full_nonprint_area",
      "parser_miss_is_limited_to_hyphenated_print_text",
    ],
  },
  {
    familyKey: "cd_135x135_spine_from_guide",
    baseBlockerCodes: ["PDF_TEXT_SPINE_MISSING"],
    bindingCount: 52,
    targetCount: 20,
    resolutionMode: "original",
    sanitizerVerdictAfterApproval: "extended_exact_evidence_original",
    requirements: [
      "exact_matching_guide_proves_3mm_spine",
      "exact_matching_guide_proves_225x320mm_data_format",
      "exact_matching_guide_proves_215x310mm_final_format",
      "exact_matching_guide_proves_135x135mm_folded_format",
    ],
  },
  {
    familyKey: "a6_closure_4plus4_3mm_bad_pdf_title",
    baseBlockerCodes: ["PDF_TEXT_SPINE_MISMATCH", "SPINE_SOURCE_CONFLICT"],
    bindingCount: 4,
    targetCount: 1,
    resolutionMode: "original",
    sanitizerVerdictAfterApproval: "extended_exact_evidence_original",
    requirements: [
      "exact_guide_proves_3mm_and_4plus4",
      "original_page_boxes_cut_and_fold_match_verified_3mm_witness",
      "embedded_1mm_title_is_not_used_as_spine_geometry_truth",
    ],
  },
]);

const PROHIBITED_ACTIONS_PERFORMED = Object.freeze({
  supplierNetworkRequested: false,
  sourcePdfModified: false,
  sourcePdfSanitized: false,
  sourcePdfUploaded: false,
  databaseWritten: false,
  supplierBankWritten: false,
  productOrTemplateRecordWritten: false,
  pricingWritten: false,
  proposalMutated: false,
  published: false,
});

export class TemplateResolutionPlanError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "TemplateResolutionPlanError";
    this.details = details;
  }
}

function assert(condition, message, details = null) {
  if (!condition) throw new TemplateResolutionPlanError(message, details);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((key) => [key, stableValue(value[key])])
  );
}

export function canonicalJson(value) {
  return JSON.stringify(stableValue(value));
}

export function sha256Json(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sortStrings(values) {
  return [...values].sort((left, right) =>
    String(left).localeCompare(String(right), "en", { numeric: true })
  );
}

function sortedUnique(values) {
  return sortStrings(new Set(values));
}

function sameJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function blockerCodes(row) {
  return sortedUnique((row?.blockers || []).map((blocker) => String(blocker?.code || "")));
}

function blockerSignature(row) {
  return blockerCodes(row).join("|");
}

function geometryFromRow(row) {
  const geometry = row?.expectedGeometry || {};
  return {
    format: String(geometry.format || ""),
    construction: String(geometry.construction || ""),
    print: String(geometry.print || ""),
    spine: Number(geometry.spine),
  };
}

function geometryKey(geometry) {
  return `${geometry.format}|${geometry.construction}|${geometry.print}|${geometry.spine}mm`;
}

function exactResolutionKey(row) {
  return `${row.expectedGeometryKey}|${row.finishKey}`;
}

function templateIdentity(row) {
  return {
    sourceUrl: String(row?.templateSourceUrl || ""),
    localRelativePath: String(row?.templateLocalRelativePath || ""),
    sha256: String(row?.templateSha256 || ""),
  };
}

function supplementTemplateIdentity(entry) {
  return {
    sourceUrl: String(entry?.sourceTemplate?.sourceUrl || ""),
    localRelativePath: String(entry?.sourceTemplate?.localRelativePath || ""),
    sha256: String(entry?.sourceTemplate?.sha256 || ""),
  };
}

function templateIdentityKey(identity) {
  return `${identity.sourceUrl}|${identity.localRelativePath}|${identity.sha256}`;
}

function validateTemplateIdentity(identity, label) {
  assert(identity.sourceUrl.startsWith("https://"), `${label} sourceUrl must be HTTPS`);
  assert(identity.localRelativePath && !path.posix.isAbsolute(identity.localRelativePath), `${label} path must be relative`);
  assert(!identity.localRelativePath.split("/").includes(".."), `${label} path cannot escape the run directory`);
  assert(SHA256_PATTERN.test(identity.sha256), `${label} sha256 is invalid`);
}

function selectionFromAuditRow(row) {
  const geometry = geometryFromRow(row);
  return {
    folder_model: `${geometry.format}--${geometry.construction}`,
    print: geometry.print,
    spine: `${geometry.spine}mm`,
    paper: String(row.paperKey || ""),
    finish: String(row.finishKey || ""),
  };
}

export function selectionKey(selections) {
  return SEMANTIC_AXES.map((axis) => {
    const value = selections?.[axis];
    assert(value !== undefined && value !== null && String(value) !== "", `Selection is missing ${axis}`);
    return `${axis}=${encodeURIComponent(String(value))}`;
  }).join("|");
}

function bindingKeyFromStub(stub) {
  return `${stub?.sourceBinding?.sourceUrl || ""}|${stub?.sourceBinding?.materialId || ""}`;
}

function validateAudit(audit) {
  assert(audit?.schemaVersion === 1, "Base geometry audit schemaVersion must be 1");
  assert(Array.isArray(audit?.bindingAudits), "Base geometry audit has no bindingAudits array");
  assert(audit?.prohibitedActionsPerformed?.sourcePdfModified === false, "Base audit reports source PDF modification");
  assert(audit?.prohibitedActionsPerformed?.sourcePdfSanitized === false, "Base audit reports source PDF sanitation");
  assert(audit?.prohibitedActionsPerformed?.sourcePdfUploaded === false, "Base audit reports source PDF upload");

  const seenBindings = new Set();
  const seenSelections = new Set();
  for (const row of audit.bindingAudits) {
    assert(row?.bindingKey && !seenBindings.has(row.bindingKey), "Base audit bindingKey is missing or duplicated", row?.bindingKey);
    seenBindings.add(row.bindingKey);
    const geometry = geometryFromRow(row);
    assert(Number.isFinite(geometry.spine), "Base audit has an invalid spine", row.bindingKey);
    assert(row.expectedGeometryKey === geometryKey(geometry), "Base audit expectedGeometryKey drifted", row.bindingKey);
    assert(row.finishKey, "Base audit finishKey is missing", row.bindingKey);
    assert(typeof row.geometryVerified === "boolean", "Base audit geometryVerified must be boolean", row.bindingKey);
    assert(
      typeof row.templateReadyForSanitization === "boolean",
      "Base audit templateReadyForSanitization must be boolean",
      row.bindingKey
    );
    assert(
      typeof row.templateReadyForImport === "boolean",
      "Base audit templateReadyForImport must be boolean",
      row.bindingKey
    );
    validateTemplateIdentity(templateIdentity(row), `Base audit ${row.bindingKey}`);
    const key = selectionKey(selectionFromAuditRow(row));
    assert(!seenSelections.has(key), "Base audit contains duplicate semantic selections", key);
    seenSelections.add(key);
  }
}

function validateSupplement({ supplement, auditRowsByBinding, baseAuditSha256 }) {
  assert(supplement?.kind === "wmd_sales_folder_geometry_supplement", "Unexpected supplement kind");
  assert(supplement?.schemaVersion === 1, "Geometry supplement schemaVersion must be 1");
  assert(supplement?.reviewState === "pending_review", "Geometry supplement is not pending_review");
  assert(!Object.hasOwn(supplement, "reviewer") && !Object.hasOwn(supplement, "reviewedAt"), "Supplement invents review approval");
  assert(supplement.baseAuditSha256 === baseAuditSha256, "Supplement baseAuditSha256 does not match immutable audit bytes");
  assert(Array.isArray(supplement.entries), "Geometry supplement has no entries array");
  assert(Array.isArray(supplement.entryFingerprints), "Geometry supplement has no entryFingerprints array");

  for (const [action, value] of Object.entries(supplement.prohibitedActionsPerformed || {})) {
    assert(value === false, `Geometry supplement reports prohibited action: ${action}`);
  }

  const calculatedEntryHashes = supplement.entries.map((entry) => sha256Json(entry)).sort();
  const recordedEntryHashes = supplement.entryFingerprints.map((entry) => String(entry.entrySha256 || "")).sort();
  assert(sameJson(calculatedEntryHashes, recordedEntryHashes), "Geometry supplement entry fingerprints drifted");

  const coverage = new Map();
  const entriesByResolutionKey = new Map();
  for (const entry of supplement.entries) {
    const identity = supplementTemplateIdentity(entry);
    validateTemplateIdentity(identity, "Geometry supplement sourceTemplate");
    assert(entry.sourceTemplateSha256 === identity.sha256, "Supplement sourceTemplateSha256 differs from sourceTemplate.sha256");
    assert(entry.verdict === "title_only_construction_text_error", "Supplement entry has an unsupported verdict");
    assert(entry?.renderedReviewEvidence?.status === "pending_review", "Supplement rendered review is not pending");
    assert(Array.isArray(entry.coveredBindingKeys) && entry.coveredBindingKeys.length > 0, "Supplement entry has no coverage");
    assert(sameJson(entry.coveredBindingKeys, sortStrings(entry.coveredBindingKeys)), "Supplement coverage is not deterministic");
    const expectedGeometry = {
      format: String(entry?.expectedGeometry?.format || ""),
      construction: String(entry?.expectedGeometry?.construction || ""),
      print: String(entry?.expectedGeometry?.print || ""),
      spine: Number(entry?.expectedGeometry?.spine),
    };
    const resolutionKey = `${geometryKey(expectedGeometry)}|${entry.finishKey}`;
    if (!entriesByResolutionKey.has(resolutionKey)) entriesByResolutionKey.set(resolutionKey, []);
    const entrySha256 = sha256Json(entry);
    const indexedEntry = { entry, entrySha256, identity };
    entriesByResolutionKey.get(resolutionKey).push(indexedEntry);

    for (const bindingKey of entry.coveredBindingKeys) {
      assert(!coverage.has(bindingKey), "Supplement covers one binding more than once", bindingKey);
      const row = auditRowsByBinding.get(bindingKey);
      assert(row, "Supplement covers an unknown base-audit binding", bindingKey);
      assert(blockerSignature(row) === TITLE_ONLY_BLOCKERS, "Supplement covers a non-title-only blocker", bindingKey);
      assert(row.expectedGeometryKey === geometryKey(expectedGeometry), "Supplement geometry differs from covered binding", bindingKey);
      assert(row.finishKey === entry.finishKey, "Supplement finish differs from covered binding", bindingKey);
      assert(sameJson(templateIdentity(row), identity), "Supplement template identity differs from covered binding", bindingKey);
      coverage.set(bindingKey, indexedEntry);
    }
  }

  const titleOnlyKeys = sortStrings(
    [...auditRowsByBinding.values()]
      .filter((row) => blockerSignature(row) === TITLE_ONLY_BLOCKERS)
      .map((row) => row.bindingKey)
  );
  assert(sameJson(titleOnlyKeys, sortStrings(coverage.keys())), "Supplement is not exact coverage of title-only bindings", {
    expected: titleOnlyKeys.length,
    actual: coverage.size,
  });
  assert(supplement.counts?.coveredBindingKeys === coverage.size, "Supplement coveredBindingKeys count drifted");
  assert(supplement.counts?.acceptedEntries === supplement.entries.length, "Supplement acceptedEntries count drifted");
  return { coverage, entriesByResolutionKey };
}

function baseAuditState(row) {
  return {
    geometryVerified: row.geometryVerified,
    templateReadyForSanitization: row.templateReadyForSanitization,
    templateReadyForImport: row.templateReadyForImport,
    blockerCodes: blockerCodes(row),
  };
}

function extendedFamilyKeyForRow(row) {
  const signature = blockerSignature(row);
  const geometry = geometryFromRow(row);
  const sha256 = row.templateSha256;
  if (
    sha256 === "0a23d95b2c72b1c07ab8cb46b60cc0a78b4a62805d0d20c5af77892bf5b07a9b"
    && signature === "CONSTRUCTION_SOURCE_CONFLICT|PDF_TEXT_CONSTRUCTION_MISMATCH|PDF_TEXT_PRINT_MISMATCH|PRINT_SOURCE_CONFLICT"
    && row.expectedGeometryKey === "a4|2-part-3-flaps|4+0|5mm"
    && row.finishKey === "none"
  ) return "a4_3flap_4plus0_print_title_conflict";
  if (
    sha256 === "61e15b205045770786f3f678fa3bc9afe5cda9febad1a4fe0e32e865e5fdb983"
    && signature === REUSED_SPINE_ALIAS_BLOCKERS
    && geometry.format === "a6"
    && geometry.construction === "2-part-closure"
    && geometry.print === "4+0"
    && [3, 5, 10].includes(geometry.spine)
    && ["soft-touch-lamination", "soft-touch-partial-uv"].includes(row.finishKey)
  ) return "a6_closure_4plus0_finish_agnostic_rebind";
  if (
    [
      "f5b8df63ef5f46a82771ad4efb7919e88429e7f76d8ce11cf5a0efeff28a3eb3",
      "cef5624df8b2d35adc4cb2227edf6a52fa25fc9401dac34979e3dddba74f39d0",
    ].includes(sha256)
    && signature === "PDF_TEXT_PRINT_MISSING"
    && geometry.format === "square-21x21"
    && geometry.construction === "2-part-2-flaps"
    && geometry.print === "4+0"
    && row.finishKey === "none"
  ) return "square_21x21_4plus0_hyphen_parser_miss";
  if (
    [
      "a2b3dc7453e920f30aad7dd4f95df94aeaa0d7a1375c4b6acd21568ffb16602a",
      "0262466cb9743607b95fe1c2a6714ce04d02eeb2bb8566952f5f2e728b3354af",
      "dabcba5fc8b9a0e1b631ff16811517d4c3f6032cead593c3d0a3e7b93f2a0d2c",
      "d3bf18bc8aa997621648994871cad4363fa834b74220cb164ad3f728427159d9",
    ].includes(sha256)
    && signature === "PDF_TEXT_SPINE_MISSING"
    && geometry.format === "cd-135x135"
    && geometry.construction === "2-part-closure"
    && geometry.spine === 3
  ) return "cd_135x135_spine_from_guide";
  if (
    sha256 === "393ce3dff40d1f449b9d8e9298ebab6d9058874d8eac03333e50697f364723b7"
    && signature === "PDF_TEXT_SPINE_MISMATCH|SPINE_SOURCE_CONFLICT"
    && row.expectedGeometryKey === "a6|2-part-closure|4+4|3mm"
    && row.finishKey === "none"
  ) return "a6_closure_4plus4_3mm_bad_pdf_title";
  return null;
}

function evidenceFilesForFamily(evidenceFilesByPath, familyKey) {
  return EXTENDED_EVIDENCE_FILE_SPECS
    .filter((spec) => spec.familyKey === familyKey)
    .map((spec) => {
      const actual = evidenceFilesByPath.get(spec.path);
      assert(actual, "Extended evidence file was not loaded", spec.path);
      assert(actual.sha256 === spec.sha256, "Extended evidence file hash drifted", {
        path: spec.path,
        expected: spec.sha256,
        actual: actual.sha256,
      });
      return { role: spec.role, path: spec.path, sha256: actual.sha256, bytes: actual.bytes };
    })
    .sort((left, right) => left.role.localeCompare(right.role, "en"));
}

function exactRowsForLocalTemplate(auditRows, localRelativePath, expectedGeometryKey) {
  return auditRows
    .filter((row) => row.templateLocalRelativePath === localRelativePath)
    .filter((row) => row.expectedGeometryKey === expectedGeometryKey)
    .sort((left, right) => String(left.bindingKey).localeCompare(String(right.bindingKey), "en", { numeric: true }));
}

function extendedResolvedSource({ family, groupedRows, auditRows }) {
  const originalIdentityKeys = new Map();
  for (const row of groupedRows) {
    const identity = templateIdentity(row);
    originalIdentityKeys.set(templateIdentityKey(identity), identity);
  }
  assert(originalIdentityKeys.size === 1, "Extended evidence target has ambiguous original identities", {
    familyKey: family.familyKey,
    bindingKeys: groupedRows.map((row) => row.bindingKey),
  });
  const originalIdentity = [...originalIdentityKeys.values()][0];
  if (family.resolutionMode === "original") {
    return {
      originalIdentity,
      resolvedIdentity: originalIdentity,
      resolvedBindingKey: groupedRows[0].bindingKey,
      sourceEvidenceBindingKeys: sortStrings(groupedRows.map((row) => row.bindingKey)),
      ambiguityResult: {
        status: "passed_unique_original_identity",
        candidateTemplateIdentityCount: 1,
        candidateBindingKeys: sortStrings(groupedRows.map((row) => row.bindingKey)),
      },
      aliasQuarantineResult: {
        required: false,
        status: "not_applicable_original_retained",
        quarantinedBindingKeys: [],
      },
    };
  }
  const spine = geometryFromRow(groupedRows[0]).spine;
  const witnessRole = spine === 3 ? "3mm_matte_witness" : `${spine}mm_witness`;
  const witness = EXTENDED_EVIDENCE_FILE_SPECS.find(
    (spec) => spec.familyKey === family.familyKey && spec.role === witnessRole
  );
  assert(witness, "Extended rebind has no exact spine witness", { familyKey: family.familyKey, spine });
  const candidates = exactRowsForLocalTemplate(auditRows, witness.path, groupedRows[0].expectedGeometryKey);
  assert(candidates.length > 0, "Extended rebind witness does not map to an audited source binding", witness.path);
  const identities = new Map();
  for (const row of candidates) identities.set(templateIdentityKey(templateIdentity(row)), templateIdentity(row));
  assert(identities.size === 1, "Extended rebind witness maps to ambiguous audited identities", witness.path);
  const resolvedIdentity = [...identities.values()][0];
  assert(resolvedIdentity.sha256 === witness.sha256, "Extended rebind audited witness hash drifted", witness.path);
  assert(templateIdentityKey(resolvedIdentity) !== templateIdentityKey(originalIdentity), "Extended rebind retains the known bad alias", groupedRows[0].bindingKey);
  return {
    originalIdentity,
    resolvedIdentity,
    resolvedBindingKey: candidates[0].bindingKey,
    sourceEvidenceBindingKeys: sortStrings(candidates.map((row) => row.bindingKey)),
    ambiguityResult: {
      status: "passed_unique_hash_pinned_rebind_identity",
      candidateTemplateIdentityCount: 1,
      candidateBindingKeys: sortStrings(candidates.map((row) => row.bindingKey)),
    },
    aliasQuarantineResult: {
      required: true,
      status: "passed_bad_alias_replaced",
      quarantinedBindingKeys: sortStrings(groupedRows.map((row) => row.bindingKey)),
    },
  };
}

export function buildExtendedExactEvidence({
  audit,
  baseAuditSha256,
  titleSupplementSha256,
  evidenceFilesByPath,
}) {
  assert(evidenceFilesByPath instanceof Map, "Extended evidence files must be provided as a Map");
  const auditRows = [...audit.bindingAudits];
  const families = [];
  for (const family of EXTENDED_FAMILY_CONTRACTS) {
    const matchingRows = auditRows.filter((row) => extendedFamilyKeyForRow(row) === family.familyKey);
    assert(matchingRows.length === family.bindingCount, "Extended evidence family binding count drifted", {
      familyKey: family.familyKey,
      expected: family.bindingCount,
      actual: matchingRows.length,
    });
    const targetGroups = new Map();
    for (const row of matchingRows) {
      const targetKey = `${row.expectedGeometryKey}|${row.finishKey}|${row.templateSha256}`;
      if (!targetGroups.has(targetKey)) targetGroups.set(targetKey, []);
      targetGroups.get(targetKey).push(row);
    }
    assert(targetGroups.size === family.targetCount, "Extended evidence family target count drifted", {
      familyKey: family.familyKey,
      expected: family.targetCount,
      actual: targetGroups.size,
    });
    const familyFiles = evidenceFilesForFamily(evidenceFilesByPath, family.familyKey);
    const targetEntries = [];
    for (const [targetKey, unsortedRows] of targetGroups) {
      const groupedRows = [...unsortedRows].sort((left, right) =>
        String(left.bindingKey).localeCompare(String(right.bindingKey), "en", { numeric: true })
      );
      const first = groupedRows[0];
      assert(sameJson(blockerCodes(first), family.baseBlockerCodes), "Extended evidence blocker family drifted", targetKey);
      const resolution = extendedResolvedSource({ family, groupedRows, auditRows });
      targetEntries.push({
        targetKey,
        expectedGeometryKey: first.expectedGeometryKey,
        finishKey: first.finishKey,
        coveredBindingKeys: groupedRows.map((row) => row.bindingKey),
        originalTemplate: { bindingKey: first.bindingKey, ...resolution.originalIdentity },
        resolvedTemplate: { bindingKey: resolution.resolvedBindingKey, ...resolution.resolvedIdentity },
        sourceEvidenceBindingKeys: resolution.sourceEvidenceBindingKeys,
        evidenceFileSha256s: sortStrings(familyFiles.map((file) => file.sha256)),
        baseAuditState: baseAuditState(first),
        ambiguityResult: resolution.ambiguityResult,
        aliasQuarantineResult: resolution.aliasQuarantineResult,
        entryReviewState: "pending_review",
        verdict: family.sanitizerVerdictAfterApproval,
      });
    }
    targetEntries.sort((left, right) => left.targetKey.localeCompare(right.targetKey, "en", { numeric: true }));
    families.push({
      familyKey: family.familyKey,
      baseBlockerCodes: family.baseBlockerCodes,
      resolutionMode: family.resolutionMode,
      sanitizerVerdictAfterApproval: family.sanitizerVerdictAfterApproval,
      requirements: family.requirements,
      evidenceFiles: familyFiles,
      targetEntries,
    });
  }
  families.sort((left, right) => left.familyKey.localeCompare(right.familyKey, "en"));
  return {
    kind: "wmd_sales_folder_extended_exact_evidence",
    schemaVersion: 1,
    reviewState: "pending_review",
    baseAuditSha256,
    titleSupplementSha256,
    familyFingerprints: families.map((family) => ({
      familyKey: family.familyKey,
      familySha256: sha256Json(family),
    })),
    targetFingerprints: families
      .flatMap((family) => family.targetEntries.map((entry) => ({
        targetKey: entry.targetKey,
        entrySha256: sha256Json(entry),
      })))
      .sort((left, right) => left.targetKey.localeCompare(right.targetKey, "en", { numeric: true })),
    families,
    prohibitedActionsPerformed: PROHIBITED_ACTIONS_PERFORMED,
  };
}

function validateExtendedExactEvidence({
  extendedEvidence,
  auditRowsByBinding,
  baseAuditSha256,
  titleSupplementSha256,
}) {
  assert(extendedEvidence?.kind === "wmd_sales_folder_extended_exact_evidence", "Unexpected extended-evidence kind");
  assert(extendedEvidence?.schemaVersion === 1, "Extended evidence schemaVersion must be 1");
  assert(extendedEvidence?.reviewState === "pending_review", "Extended evidence must remain pending_review");
  assert(extendedEvidence.baseAuditSha256 === baseAuditSha256, "Extended evidence base-audit hash drifted");
  assert(extendedEvidence.titleSupplementSha256 === titleSupplementSha256, "Extended evidence title-supplement hash drifted");
  assert(Array.isArray(extendedEvidence.families), "Extended evidence families are missing");
  const calculatedFamilyFingerprints = extendedEvidence.families.map((family) => ({
    familyKey: family.familyKey,
    familySha256: sha256Json(family),
  }));
  assert(sameJson(calculatedFamilyFingerprints, extendedEvidence.familyFingerprints), "Extended evidence family fingerprints drifted");
  const calculatedTargetFingerprints = extendedEvidence.families
    .flatMap((family) => family.targetEntries.map((entry) => ({ targetKey: entry.targetKey, entrySha256: sha256Json(entry) })))
    .sort((left, right) => left.targetKey.localeCompare(right.targetKey, "en", { numeric: true }));
  assert(sameJson(calculatedTargetFingerprints, extendedEvidence.targetFingerprints), "Extended evidence target fingerprints drifted");

  const coverage = new Map();
  for (const family of extendedEvidence.families) {
    assert(["original", "rebind"].includes(family.resolutionMode), "Extended evidence has invalid resolutionMode", family.familyKey);
    assert(
      ["extended_exact_evidence_original", "extended_exact_evidence_rebind"].includes(family.sanitizerVerdictAfterApproval),
      "Extended evidence has invalid sanitizer verdict",
      family.familyKey
    );
    assert(Array.isArray(family.targetEntries) && family.targetEntries.length > 0, "Extended evidence family has no targets", family.familyKey);
    for (const entry of family.targetEntries) {
      assert(entry.entryReviewState === "pending_review", "Extended evidence target invents approval", entry.targetKey);
      assert(entry.verdict === family.sanitizerVerdictAfterApproval, "Extended evidence target verdict differs from family", entry.targetKey);
      assert(Array.isArray(entry.coveredBindingKeys) && entry.coveredBindingKeys.length > 0, "Extended evidence target has no bindings", entry.targetKey);
      validateTemplateIdentity(entry.originalTemplate, `Extended evidence original ${entry.targetKey}`);
      validateTemplateIdentity(entry.resolvedTemplate, `Extended evidence resolved ${entry.targetKey}`);
      if (family.resolutionMode === "original") {
        assert(templateIdentityKey(entry.originalTemplate) === templateIdentityKey(entry.resolvedTemplate), "Extended original changes template identity", entry.targetKey);
      } else {
        assert(templateIdentityKey(entry.originalTemplate) !== templateIdentityKey(entry.resolvedTemplate), "Extended rebind retains old template identity", entry.targetKey);
      }
      for (const bindingKey of entry.coveredBindingKeys) {
        assert(!coverage.has(bindingKey), "Extended evidence covers a binding twice", bindingKey);
        const row = auditRowsByBinding.get(bindingKey);
        assert(row, "Extended evidence covers an unknown binding", bindingKey);
        assert(extendedFamilyKeyForRow(row) === family.familyKey, "Extended evidence family does not match base blockers", bindingKey);
        assert(row.expectedGeometryKey === entry.expectedGeometryKey && row.finishKey === entry.finishKey, "Extended evidence target tuple drifted", bindingKey);
        assert(sameJson(templateIdentity(row), {
          sourceUrl: entry.originalTemplate.sourceUrl,
          localRelativePath: entry.originalTemplate.localRelativePath,
          sha256: entry.originalTemplate.sha256,
        }), "Extended evidence original identity differs from base audit", bindingKey);
        assert(sameJson(baseAuditState(row), entry.baseAuditState), "Extended evidence base audit state drifted", bindingKey);
        coverage.set(bindingKey, { family, entry, entrySha256: sha256Json(entry) });
      }
    }
  }
  return coverage;
}

function assertAllAxesVerified(row, label) {
  for (const axis of ["format", "construction", "print", "spine"]) {
    assert(row?.facts?.axes?.[axis]?.verified === true, `${label} has an unverified ${axis} axis`, row.bindingKey);
  }
}

function chooseUniqueVerifiedSource(candidates, targetRow) {
  const identities = new Map();
  for (const row of candidates) {
    const identity = templateIdentity(row);
    const key = templateIdentityKey(identity);
    if (!identities.has(key)) identities.set(key, { identity, rows: [] });
    identities.get(key).rows.push(row);
  }
  assert(identities.size <= 1, "AMBIGUOUS_EXACT_VERIFIED_REBIND_SOURCE", {
    bindingKey: targetRow.bindingKey,
    expectedGeometryKey: targetRow.expectedGeometryKey,
    finishKey: targetRow.finishKey,
    templateIdentities: sortStrings(identities.keys()),
  });
  if (identities.size === 0) return null;
  const group = [...identities.values()][0];
  group.rows.sort((left, right) => String(left.bindingKey).localeCompare(String(right.bindingKey), "en", { numeric: true }));
  return { ...group, canonicalRow: group.rows[0] };
}

function chooseUniqueSupplementSource(indexedEntries, targetRow) {
  const identities = new Map();
  for (const indexed of indexedEntries || []) {
    const key = templateIdentityKey(indexed.identity);
    if (!identities.has(key)) identities.set(key, []);
    identities.get(key).push(indexed);
  }
  assert(identities.size <= 1, "AMBIGUOUS_INDIRECT_SUPPLEMENT_REBIND_SOURCE", {
    bindingKey: targetRow.bindingKey,
    expectedGeometryKey: targetRow.expectedGeometryKey,
    finishKey: targetRow.finishKey,
    templateIdentities: sortStrings(identities.keys()),
  });
  if (identities.size === 0) return null;
  const group = [...identities.values()][0].sort((left, right) =>
    left.entrySha256.localeCompare(right.entrySha256, "en")
  );
  const coveredBindingKeys = sortStrings(group.flatMap((indexed) => indexed.entry.coveredBindingKeys));
  return {
    identity: group[0].identity,
    entries: group,
    coveredBindingKeys,
    canonicalBindingKey: coveredBindingKeys[0],
  };
}

function classificationRecord({
  row,
  classification,
  newIdentity,
  newBindingKey,
  reason,
  entryReviewState,
  sanitizerVerdictAfterApproval = null,
  ambiguityResult,
  aliasQuarantineResult,
  baseAuditSha256,
  titleSupplementReportSha256 = null,
  titleSupplementEntrySha256s = [],
  extendedEvidenceTargetSha256 = null,
  extendedEvidenceFamilySha256 = null,
  sourceEvidenceBindingKeys,
  resolutionFacts = {},
}) {
  const oldIdentity = templateIdentity(row);
  return {
    bindingKey: row.bindingKey,
    selectionKey: selectionKey(selectionFromAuditRow(row)),
    classification,
    expectedGeometryKey: row.expectedGeometryKey,
    finishKey: row.finishKey,
    oldTemplate: { bindingKey: row.bindingKey, ...oldIdentity },
    newTemplate: { bindingKey: newBindingKey, ...newIdentity },
    reason,
    entryReviewState,
    sanitizerVerdictAfterApproval,
    baseAuditState: baseAuditState(row),
    ambiguityResult,
    aliasQuarantineResult,
    evidence: {
      blockerCodes: blockerCodes(row),
      exactExpectedGeometryKey: row.expectedGeometryKey,
      exactFinishKey: row.finishKey,
      sourceEvidenceBindingKeys: sortStrings(sourceEvidenceBindingKeys),
      dependencies: {
        baseAuditSha256,
        titleSupplementReportSha256,
        titleSupplementEntrySha256s: sortStrings(titleSupplementEntrySha256s),
        extendedEvidenceTargetSha256,
        extendedEvidenceFamilySha256,
      },
      resolutionFacts: {
        geometryAxesVerified: resolutionFacts.geometryAxesVerified ?? null,
        sourceGeometryVerified: resolutionFacts.sourceGeometryVerified ?? null,
        supplementVerdict: resolutionFacts.supplementVerdict ?? null,
        supplementReviewState: resolutionFacts.supplementReviewState ?? null,
        renderedReviewStatus: resolutionFacts.renderedReviewStatus ?? null,
        extendedFamilyKey: resolutionFacts.extendedFamilyKey ?? null,
        extendedRequirements: sortStrings(resolutionFacts.extendedRequirements || []),
      },
    },
  };
}

function validateExpectedCounts(actual, expected) {
  assert(expected && typeof expected === "object", "Expected classification counts are required");
  for (const classification of CLASSIFICATIONS) {
    assert(Number.isInteger(expected[classification]), `Expected count is missing for ${classification}`);
    assert(actual[classification] === expected[classification], `Classification count drifted for ${classification}`, {
      expected: expected[classification],
      actual: actual[classification],
    });
  }
}

export function classifyTemplateBindings({
  audit,
  supplement,
  baseAuditSha256,
  titleSupplementSha256,
  extendedEvidence,
  expectedCounts = EXPECTED_CLASSIFICATION_COUNTS,
}) {
  validateAudit(audit);
  assert(SHA256_PATTERN.test(baseAuditSha256), "Immutable base audit SHA-256 is invalid");
  assert(SHA256_PATTERN.test(titleSupplementSha256), "Immutable title supplement SHA-256 is invalid");
  const rows = [...audit.bindingAudits].sort((left, right) =>
    String(left.bindingKey).localeCompare(String(right.bindingKey), "en", { numeric: true })
  );
  const auditRowsByBinding = new Map(rows.map((row) => [row.bindingKey, row]));
  const { coverage: supplementCoverage, entriesByResolutionKey } = validateSupplement({
    supplement,
    auditRowsByBinding,
    baseAuditSha256,
  });
  const extendedCoverage = validateExtendedExactEvidence({
    extendedEvidence,
    auditRowsByBinding,
    baseAuditSha256,
    titleSupplementSha256,
  });
  for (const bindingKey of extendedCoverage.keys()) {
    assert(!supplementCoverage.has(bindingKey), "Title and extended evidence overlap", bindingKey);
  }
  const extendedFamilyHashes = new Map(
    extendedEvidence.familyFingerprints.map((entry) => [entry.familyKey, entry.familySha256])
  );

  const verifiedByResolutionKey = new Map();
  for (const row of rows.filter((candidate) => candidate.geometryVerified === true)) {
    assert((row.blockers || []).length === 0, "A base-verified binding still has blockers", row.bindingKey);
    assert(row.templateReadyForSanitization === true, "A base-verified binding is not sanitation-ready", row.bindingKey);
    assertAllAxesVerified(row, "Base-verified binding");
    const key = exactResolutionKey(row);
    if (!verifiedByResolutionKey.has(key)) verifiedByResolutionKey.set(key, []);
    verifiedByResolutionKey.get(key).push(row);
  }

  const records = [];
  for (const row of rows) {
    const signature = blockerSignature(row);
    const oldIdentity = templateIdentity(row);
    if (row.geometryVerified === true) {
      records.push(classificationRecord({
        row,
        classification: "base_verified",
        newIdentity: oldIdentity,
        newBindingKey: row.bindingKey,
        reason: "strict_base_audit_verified_exact_geometry",
        entryReviewState: "base_audit_verified",
        ambiguityResult: {
          status: "not_applicable_base_verified",
          candidateTemplateIdentityCount: 1,
          candidateBindingKeys: [row.bindingKey],
        },
        aliasQuarantineResult: {
          required: false,
          status: "not_applicable_base_verified",
          quarantinedBindingKeys: [],
        },
        baseAuditSha256,
        sourceEvidenceBindingKeys: [row.bindingKey],
        resolutionFacts: { geometryAxesVerified: true, sourceGeometryVerified: true },
      }));
      continue;
    }

    if (supplementCoverage.has(row.bindingKey)) {
      const indexed = supplementCoverage.get(row.bindingKey);
      records.push(classificationRecord({
        row,
        classification: "pending_title_only",
        newIdentity: oldIdentity,
        newBindingKey: row.bindingKey,
        reason: "exact_pending_geometry_supplement_coverage",
        entryReviewState: "pending_review",
        ambiguityResult: {
          status: "passed_unique_pending_supplement_entry",
          candidateTemplateIdentityCount: 1,
          candidateBindingKeys: indexed.entry.coveredBindingKeys,
        },
        aliasQuarantineResult: {
          required: false,
          status: "not_applicable_original_retained",
          quarantinedBindingKeys: [],
        },
        baseAuditSha256,
        titleSupplementReportSha256: titleSupplementSha256,
        titleSupplementEntrySha256s: [indexed.entrySha256],
        sourceEvidenceBindingKeys: indexed.entry.coveredBindingKeys,
        resolutionFacts: {
          geometryAxesVerified: false,
          supplementVerdict: indexed.entry.verdict,
          supplementReviewState: supplement.reviewState,
          renderedReviewStatus: indexed.entry.renderedReviewEvidence.status,
        },
      }));
      continue;
    }

    if (signature === PURE_REUSE_BLOCKERS) {
      assertAllAxesVerified(row, "Collateral original binding");
      assert(row?.reuse?.verdict === "blocked_cross_geometry_reuse", "Collateral binding lacks blocked reuse evidence", row.bindingKey);
      records.push(classificationRecord({
        row,
        classification: "collateral_original_after_bad_alias_quarantine",
        newIdentity: oldIdentity,
        newBindingKey: row.bindingKey,
        reason: "own_pdf_facts_match_expected_geometry_but_cross_geometry_aliases_must_be_quarantined",
        entryReviewState: "pending_review",
        sanitizerVerdictAfterApproval: "collateral_original_after_bad_alias_quarantine",
        ambiguityResult: {
          status: "passed_unique_original_identity",
          candidateTemplateIdentityCount: 1,
          candidateBindingKeys: [row.bindingKey],
        },
        aliasQuarantineResult: {
          required: true,
          status: "passed_cross_geometry_aliases_rebound_or_withheld",
          quarantinedBindingKeys: [],
        },
        baseAuditSha256,
        sourceEvidenceBindingKeys: [row.bindingKey],
        resolutionFacts: { geometryAxesVerified: true, sourceGeometryVerified: true },
      }));
      continue;
    }

    if (signature === REUSED_SPINE_ALIAS_BLOCKERS) {
      const verifiedSource = chooseUniqueVerifiedSource(
        verifiedByResolutionKey.get(exactResolutionKey(row)) || [],
        row
      );
      if (verifiedSource) {
        assert(templateIdentityKey(verifiedSource.identity) !== templateIdentityKey(oldIdentity), "Exact rebind would retain the bad alias PDF", row.bindingKey);
        records.push(classificationRecord({
          row,
          classification: "exact_verified_rebind",
          newIdentity: verifiedSource.identity,
          newBindingKey: verifiedSource.canonicalRow.bindingKey,
          reason: "rebind_to_unique_base_verified_exact_geometry_and_finish_source",
          entryReviewState: "pending_review",
          sanitizerVerdictAfterApproval: "exact_verified_rebind",
          ambiguityResult: {
            status: "passed_unique_base_verified_identity",
            candidateTemplateIdentityCount: 1,
            candidateBindingKeys: sortStrings(verifiedSource.rows.map((source) => source.bindingKey)),
          },
          aliasQuarantineResult: {
            required: true,
            status: "passed_bad_alias_replaced",
            quarantinedBindingKeys: [row.bindingKey],
          },
          baseAuditSha256,
          sourceEvidenceBindingKeys: verifiedSource.rows.map((source) => source.bindingKey),
          resolutionFacts: { geometryAxesVerified: false, sourceGeometryVerified: true },
        }));
        continue;
      }

      const pendingSource = chooseUniqueSupplementSource(
        entriesByResolutionKey.get(exactResolutionKey(row)) || [],
        row
      );
      if (pendingSource) {
        assert(templateIdentityKey(pendingSource.identity) !== templateIdentityKey(oldIdentity), "Indirect rebind would retain the bad alias PDF", row.bindingKey);
        records.push(classificationRecord({
          row,
          classification: "indirect_pending_title_rebind",
          newIdentity: pendingSource.identity,
          newBindingKey: pendingSource.canonicalBindingKey,
          reason: "rebind_depends_only_on_exact_pending_supplement_covered_source",
          entryReviewState: "pending_review",
          sanitizerVerdictAfterApproval: "indirect_approved_title_rebind",
          ambiguityResult: {
            status: "passed_unique_pending_supplement_identity",
            candidateTemplateIdentityCount: 1,
            candidateBindingKeys: pendingSource.coveredBindingKeys,
          },
          aliasQuarantineResult: {
            required: true,
            status: "passed_bad_alias_replaced",
            quarantinedBindingKeys: [row.bindingKey],
          },
          baseAuditSha256,
          titleSupplementReportSha256: titleSupplementSha256,
          titleSupplementEntrySha256s: pendingSource.entries.map((entry) => entry.entrySha256),
          sourceEvidenceBindingKeys: pendingSource.coveredBindingKeys,
          resolutionFacts: {
            geometryAxesVerified: false,
            sourceGeometryVerified: false,
            supplementVerdict: "title_only_construction_text_error",
            supplementReviewState: supplement.reviewState,
            renderedReviewStatus: "pending_review",
          },
        }));
        continue;
      }
    }
    const extended = extendedCoverage.get(row.bindingKey);
    assert(extended, "NO_RESOLUTION_EVIDENCE_FOR_BLOCKED_BINDING", {
      bindingKey: row.bindingKey,
      blockerCodes: blockerCodes(row),
      expectedGeometryKey: row.expectedGeometryKey,
      finishKey: row.finishKey,
    });
    const resolvedIdentity = {
      sourceUrl: extended.entry.resolvedTemplate.sourceUrl,
      localRelativePath: extended.entry.resolvedTemplate.localRelativePath,
      sha256: extended.entry.resolvedTemplate.sha256,
    };
    records.push(classificationRecord({
      row,
      classification: "extended_exact_evidence",
      newIdentity: resolvedIdentity,
      newBindingKey: extended.entry.resolvedTemplate.bindingKey,
      reason: `pending_extended_exact_evidence:${extended.family.familyKey}`,
      entryReviewState: "pending_review",
      sanitizerVerdictAfterApproval: extended.entry.verdict,
      ambiguityResult: extended.entry.ambiguityResult,
      aliasQuarantineResult: extended.entry.aliasQuarantineResult,
      baseAuditSha256,
      extendedEvidenceTargetSha256: extended.entrySha256,
      extendedEvidenceFamilySha256: extendedFamilyHashes.get(extended.family.familyKey),
      sourceEvidenceBindingKeys: extended.entry.sourceEvidenceBindingKeys,
      resolutionFacts: {
        geometryAxesVerified: false,
        sourceGeometryVerified: extended.family.resolutionMode === "rebind" ? true : null,
        extendedFamilyKey: extended.family.familyKey,
        extendedRequirements: extended.family.requirements,
      },
    }));
  }

  const recordByBinding = new Map(records.map((record) => [record.bindingKey, record]));
  const rowsByTemplateIdentity = new Map();
  for (const row of rows) {
    const key = templateIdentityKey(templateIdentity(row));
    if (!rowsByTemplateIdentity.has(key)) rowsByTemplateIdentity.set(key, []);
    rowsByTemplateIdentity.get(key).push(row);
  }
  for (const record of records.filter(
    (candidate) => candidate.classification === "collateral_original_after_bad_alias_quarantine"
  )) {
    const peers = rowsByTemplateIdentity.get(templateIdentityKey(record.oldTemplate)) || [];
    const aliases = peers.filter((peer) => peer.expectedGeometryKey !== record.expectedGeometryKey);
    assert(aliases.length > 0, "Collateral original has no cross-geometry alias to quarantine", record.bindingKey);
    for (const alias of aliases) {
      const aliasRecord = recordByBinding.get(alias.bindingKey);
      assert(
        ["exact_verified_rebind", "indirect_pending_title_rebind", "extended_exact_evidence"].includes(aliasRecord?.classification),
        "Collateral alias was not rebound or withheld",
        { bindingKey: record.bindingKey, aliasBindingKey: alias.bindingKey, classification: aliasRecord?.classification }
      );
    }
    record.aliasQuarantineResult.quarantinedBindingKeys = sortStrings(aliases.map((alias) => alias.bindingKey));
  }

  const counts = Object.fromEntries(CLASSIFICATIONS.map((classification) => [classification, 0]));
  for (const record of records) counts[record.classification] += 1;
  validateExpectedCounts(counts, expectedCounts);
  assert(records.length === rows.length, "Not every base binding was classified exactly once");
  return { records, counts, auditRowsByBinding };
}

function validateProjectionStubs(stubs, classificationRecords, auditRowsByBinding) {
  assert(Array.isArray(stubs), "Template projection stubs must be an array");
  const recordsByBinding = new Map(classificationRecords.map((record) => [record.bindingKey, record]));
  const seenBindings = new Set();
  const seenKeys = new Set();
  for (const stub of stubs) {
    const bindingKey = bindingKeyFromStub(stub);
    assert(recordsByBinding.has(bindingKey), "Projection stub does not map to a base binding", bindingKey);
    assert(!seenBindings.has(bindingKey), "Projection stub binding is duplicated", bindingKey);
    assert(stub.key && !seenKeys.has(stub.key), "Projection stub key is missing or duplicated", stub.key);
    seenBindings.add(bindingKey);
    seenKeys.add(stub.key);
    const auditRow = auditRowsByBinding.get(bindingKey);
    assert(selectionKey(stub.match) === selectionKey(selectionFromAuditRow(auditRow)), "Projection stub semantic match drifted", bindingKey);
    assert(stub?.template?.sourceUrl === auditRow.templateSourceUrl, "Projection stub old template URL drifted", bindingKey);
    assert(String(stub?.sourceBinding?.sourceProductId) === String(auditRow.sourceProductId), "Projection stub sourceProductId drifted", bindingKey);
  }
  assert(seenBindings.size === classificationRecords.length, "Projection stub coverage is incomplete", {
    expected: classificationRecords.length,
    actual: seenBindings.size,
  });
}

function validateCompatibility(compatibility, classificationRecords) {
  assert(compatibility?.schemaVersion === 1, "Compatibility schemaVersion must be 1");
  assert(compatibility?.sparse === true, "Compatibility must remain sparse");
  assert(compatibility?.interpolationAllowed === false, "Compatibility must forbid interpolation");
  assert(Array.isArray(compatibility?.combinations), "Compatibility combinations are missing");
  const expectedKeys = new Set(classificationRecords.map((record) => record.selectionKey));
  const combinationsBySelection = new Map();
  for (const combination of compatibility.combinations) {
    const key = selectionKey(combination.selections);
    assert(combination.selectionKey === key, "Compatibility selectionKey drifted", combination.selectionKey);
    assert(expectedKeys.has(key), "Compatibility contains an unknown selection", key);
    assert(!combinationsBySelection.has(key), "Compatibility selection is duplicated", key);
    const quantities = [...(combination.quantities || [])].map(Number);
    assert(quantities.length > 0 && quantities.every((quantity) => Number.isInteger(quantity) && quantity > 0), "Compatibility has invalid quantities", key);
    assert(sameJson(quantities, [...new Set(quantities)].sort((a, b) => a - b)), "Compatibility quantities are duplicated or unsorted", key);
    combinationsBySelection.set(key, { ...combination, quantities });
  }
  assert(combinationsBySelection.size === expectedKeys.size, "Compatibility coverage is incomplete", {
    expected: expectedKeys.size,
    actual: combinationsBySelection.size,
  });
  return combinationsBySelection;
}

function emptyPriceSummary() {
  return { totalRows: 0, bySelection: new Map() };
}

function addPriceRowToSummary(summary, row) {
  const key = selectionKey(row.selections);
  const quantity = Number(row.quantity);
  assert(Number.isInteger(quantity) && quantity > 0, "Proposed price row has invalid quantity", row.proposedSelectionKey);
  const expectedRowKey = `${key}|quantity=${quantity}`;
  assert(row.proposedSelectionKey === expectedRowKey, "Proposed price row key drifted", row.proposedSelectionKey);
  if (!summary.bySelection.has(key)) summary.bySelection.set(key, { count: 0, quantities: new Set(), rowKeys: new Set() });
  const entry = summary.bySelection.get(key);
  assert(!entry.rowKeys.has(expectedRowKey), "Proposed price row is duplicated", expectedRowKey);
  entry.rowKeys.add(expectedRowKey);
  entry.quantities.add(quantity);
  entry.count += 1;
  summary.totalRows += 1;
}

export function summarizePriceRows(priceRows) {
  const summary = emptyPriceSummary();
  for (const row of priceRows) addPriceRowToSummary(summary, row);
  return summary;
}

function validatePriceSummary(priceSummary, combinationsBySelection) {
  assert(priceSummary && priceSummary.bySelection instanceof Map, "Proposed price summary is invalid");
  for (const [key, summary] of priceSummary.bySelection) {
    assert(combinationsBySelection.has(key), "Proposed price rows contain an unknown selection", key);
    assert(summary.count === summary.quantities.size, "Proposed price selection duplicates a quantity", key);
  }
  for (const [key, combination] of combinationsBySelection) {
    const summary = priceSummary.bySelection.get(key);
    assert(summary, "Compatibility selection has no proposed price rows", key);
    assert(
      sameJson([...summary.quantities].sort((a, b) => a - b), combination.quantities),
      "Compatibility quantities differ from proposed price rows",
      key
    );
  }
}

function validateInputEvidence(inputEvidence, supplement) {
  const required = [
    "baseAudit",
    "geometrySupplement",
    "templateProjectionStubs",
    "proposedCompatibility",
    "proposedPriceRows",
  ];
  for (const key of required) {
    const evidence = inputEvidence?.[key];
    assert(evidence?.path && SHA256_PATTERN.test(evidence.sha256), `Input evidence is invalid for ${key}`);
    assert(Number.isInteger(evidence.bytes) && evidence.bytes > 0, `Input byte count is invalid for ${key}`);
  }
  assert(Array.isArray(inputEvidence?.extendedEvidenceFiles), "Extended evidence input files are missing");
  assert(inputEvidence.extendedEvidenceFiles.length === EXTENDED_EVIDENCE_FILE_SPECS.length, "Extended evidence input file count drifted");
  const extendedByPath = new Map(inputEvidence.extendedEvidenceFiles.map((entry) => [entry.path, entry]));
  assert(extendedByPath.size === inputEvidence.extendedEvidenceFiles.length, "Extended evidence input paths are duplicated");
  for (const spec of EXTENDED_EVIDENCE_FILE_SPECS) {
    const evidence = extendedByPath.get(spec.path);
    assert(evidence?.role && evidence?.path && SHA256_PATTERN.test(evidence.sha256), "Extended evidence input identity is invalid");
    assert(Number.isInteger(evidence.bytes) && evidence.bytes > 0, "Extended evidence input byte count is invalid", evidence.path);
    assert(evidence.role === `${spec.familyKey}:${spec.role}`, "Extended evidence input role drifted", evidence.path);
    assert(evidence.sha256 === spec.sha256, "Extended evidence input hash differs from contract", evidence.path);
  }
  assert(inputEvidence.baseAudit.sha256 === supplement.baseAuditSha256, "Input audit hash differs from supplement baseAuditSha256");
}

function projectExtendedEvidenceToBindings(extendedEvidence, includedBindingKeys) {
  const families = extendedEvidence.families.filter((family) =>
    family.targetEntries.some((entry) =>
      entry.coveredBindingKeys.some((bindingKey) => includedBindingKeys.has(bindingKey))
    )
  );
  for (const family of families) {
    for (const entry of family.targetEntries) {
      assert(
        entry.coveredBindingKeys.every((bindingKey) => includedBindingKeys.has(bindingKey)),
        "A proposed-scope projection would split one extended-evidence target",
        { familyKey: family.familyKey, targetKey: entry.targetKey }
      );
    }
  }
  return {
    ...extendedEvidence,
    familyFingerprints: families.map((family) => ({
      familyKey: family.familyKey,
      familySha256: sha256Json(family),
    })),
    targetFingerprints: families
      .flatMap((family) => family.targetEntries.map((entry) => ({
        targetKey: entry.targetKey,
        entrySha256: sha256Json(entry),
      })))
      .sort((left, right) => left.targetKey.localeCompare(right.targetKey, "en", { numeric: true })),
    families,
  };
}

function projectClassificationsToStubs({ records, counts, stubs, extendedEvidence, inputEvidence }) {
  const includedBindingKeys = new Set(stubs.map(bindingKeyFromStub));
  assert(includedBindingKeys.size === stubs.length, "Proposed template stubs contain duplicate binding keys");
  const proposedRecords = records.filter((record) => includedBindingKeys.has(record.bindingKey));
  assert(proposedRecords.length === stubs.length, "Not every proposed template stub has one classified binding");
  const proposedCounts = Object.fromEntries(CLASSIFICATIONS.map((classification) => [classification, 0]));
  for (const record of proposedRecords) proposedCounts[record.classification] += 1;
  const proposedExtendedEvidence = projectExtendedEvidenceToBindings(extendedEvidence, includedBindingKeys);
  const includedExtendedFamilyKeys = new Set(
    proposedExtendedEvidence.families.map((family) => family.familyKey)
  );
  const proposedInputEvidence = {
    ...inputEvidence,
    extendedEvidenceFiles: inputEvidence.extendedEvidenceFiles.filter((entry) =>
      includedExtendedFamilyKeys.has(String(entry.role).split(":")[0])
    ),
  };
  return {
    records: proposedRecords,
    counts: proposedCounts,
    extendedEvidence: proposedExtendedEvidence,
    inputEvidence: proposedInputEvidence,
    evidence: {
      rawBindingCount: records.length,
      proposedBindingCount: proposedRecords.length,
      excludedBindingCount: records.length - proposedRecords.length,
      rawClassificationCounts: counts,
      proposedClassificationCounts: proposedCounts,
      rawExtendedEvidenceFamilies: extendedEvidence.families.length,
      proposedExtendedEvidenceFamilies: proposedExtendedEvidence.families.length,
      excludedExtendedEvidenceFamilies:
        extendedEvidence.families.length - proposedExtendedEvidence.families.length,
      rawSupplierEvidenceMutated: false,
    },
  };
}

export function buildTemplateResolutionPlan({
  audit,
  supplement,
  stubs,
  compatibility,
  priceSummary,
  inputEvidence,
  extendedEvidence,
  expectedCounts = EXPECTED_CLASSIFICATION_COUNTS,
}) {
  validateInputEvidence(inputEvidence, supplement);
  const fullClassification = classifyTemplateBindings({
    audit,
    supplement,
    baseAuditSha256: inputEvidence.baseAudit.sha256,
    titleSupplementSha256: inputEvidence.geometrySupplement.sha256,
    extendedEvidence,
    expectedCounts,
  });
  const scopedClassification = projectClassificationsToStubs({
    records: fullClassification.records,
    counts: fullClassification.counts,
    stubs,
    extendedEvidence,
    inputEvidence,
  });
  const { records, counts } = scopedClassification;
  const auditRowsByBinding = fullClassification.auditRowsByBinding;
  extendedEvidence = scopedClassification.extendedEvidence;
  inputEvidence = scopedClassification.inputEvidence;
  validateProjectionStubs(stubs, records, auditRowsByBinding);
  const combinationsBySelection = validateCompatibility(compatibility, records);
  validatePriceSummary(priceSummary, combinationsBySelection);

  const pending = records.filter((record) => record.entryReviewState === "pending_review");
  const countTotal = Object.values(counts).reduce((total, count) => total + count, 0);
  assert(countTotal === records.length, "Classification totals do not reconcile");
  assert(records.length === stubs.length, "Production resolution plan must cover every proposed binding");
  const bindingClassificationFingerprints = records.map((entry) => ({
    bindingKey: entry.bindingKey,
    entrySha256: sha256Json(entry),
  }));

  const plan = {
    kind: "wmd_sales_folder_template_resolution_plan",
    schemaVersion: 1,
    reviewState: "pending_review",
    approval: {
      approved: false,
      reviewer: null,
      reviewedAt: null,
    },
    approvalContract: {
      currentArtifactMayAuthorizeSanitization: false,
      requiredArtifactReviewState: "approved",
      requiredEntryReviewState: "approved",
      requireNonEmptyReviewer: true,
      requireIsoReviewedAt: true,
      approvedEntryHashesMustExactlyMatchFingerprints: true,
      inputHashesMustRemainEqual: true,
      pendingSupplementRequiresPlanRegenerationAfterApproval: true,
    },
    approvedEntryHashes: [],
    catalogScope: compatibility.catalogScope || null,
    sourceScopeProjection: scopedClassification.evidence,
    inputEvidence,
    resolutionPolicy: {
      exactRebindAxes: ["expectedGeometryKey", "finishKey"],
      baseVerifiedRequiresStrictAuditPass: true,
      pendingTitleOnlyRequiresExactSupplementCoverage: true,
      indirectPendingRebindMayUseOnlyExactSupplementCoveredSources: true,
      extendedEvidenceRequiresExactFamilyAndFileHashes: true,
      crossGeometryAliasReuseAllowed: false,
      unresolvedSelectionsWithheldFromStorefrontAndDesigner: true,
      pricesRecalculated: false,
      proposalMutated: false,
    },
    counts: {
      totalBindings: records.length,
      classifications: counts,
      baseVerifiedBindings: counts.base_verified,
      recoveredBindingsPendingReview: pending.length,
      extendedEvidenceFamilies: extendedEvidence.families.length,
      extendedEvidenceTargets: extendedEvidence.targetFingerprints.length,
      unresolvedBindings: 0,
    },
    filteredCandidates: {
      policy: "all_bindings_have_a_hash_pinned_candidate_but_non_base_recoveries_remain_pending_review",
      templateProjection: {
        inputBindings: stubs.length,
        candidateBindings: records.length,
        withheldBindings: 0,
      },
      compatibility: {
        inputSelections: combinationsBySelection.size,
        candidateSelections: records.length,
        withheldSelections: 0,
      },
      proposedPriceRows: {
        inputRows: priceSummary.totalRows,
        candidateRows: priceSummary.totalRows,
        withheldRows: 0,
      },
      pendingReviewBoundary: {
        candidateDoesNotMeanApproved: true,
        nonBaseRecoveryBindingsPendingReview: pending.length,
        titleOnlyBindingsPendingReview: counts.pending_title_only,
        indirectRebindBindingsPendingTitleOnlyDependency: counts.indirect_pending_title_rebind,
        extendedEvidenceBindingsPendingReview: counts.extended_exact_evidence,
      },
      candidateBindingKeys: records.map((record) => record.bindingKey),
    },
    extendedEvidence,
    bindingClassificationFingerprints,
    bindingClassifications: records,
    prohibitedActionsPerformed: PROHIBITED_ACTIONS_PERFORMED,
    nextGate: "human_review_and_hash_pinned_approval_of_every_non_base_recovery_before_any_template_sanitation_or_product_write",
  };
  return plan;
}

async function readFileWithEvidence(absolutePath, runDirectory, parse = JSON.parse) {
  const bytes = await fs.readFile(absolutePath);
  return {
    value: parse(bytes.toString("utf8")),
    evidence: {
      path: path.relative(runDirectory, absolutePath).replaceAll(path.sep, "/"),
      sha256: sha256Bytes(bytes),
      bytes: bytes.length,
    },
  };
}

function parseJsonLines(text) {
  return text
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== "")
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new TemplateResolutionPlanError(`Invalid JSONL at line ${index + 1}: ${error.message}`);
      }
    });
}

async function summarizePriceRowsFile(absolutePath, runDirectory) {
  const hash = createHash("sha256");
  let byteCount = 0;
  let lineNumber = 0;
  const summary = emptyPriceSummary();
  const input = createReadStream(absolutePath);
  input.on("data", (chunk) => {
    hash.update(chunk);
    byteCount += chunk.length;
  });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    lineNumber += 1;
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch (error) {
      throw new TemplateResolutionPlanError(`Invalid proposed price JSONL at line ${lineNumber}: ${error.message}`);
    }
    addPriceRowToSummary(summary, row);
  }
  return {
    summary,
    evidence: {
      path: path.relative(runDirectory, absolutePath).replaceAll(path.sep, "/"),
      sha256: hash.digest("hex"),
      bytes: byteCount,
    },
  };
}

async function assertEvidenceUnchanged(absolutePath, expectedEvidence) {
  const bytes = await fs.readFile(absolutePath);
  assert(bytes.length === expectedEvidence.bytes, "Input artifact byte count changed during generation", expectedEvidence.path);
  assert(sha256Bytes(bytes) === expectedEvidence.sha256, "Input artifact hash changed during generation", expectedEvidence.path);
}

async function loadExtendedEvidenceFiles(runDirectory) {
  const evidenceFilesByPath = new Map();
  const inputEvidence = [];
  const absolutePaths = new Map();
  for (const spec of EXTENDED_EVIDENCE_FILE_SPECS) {
    const absolutePath = path.resolve(runDirectory, spec.path);
    assert(absolutePath.startsWith(`${runDirectory}${path.sep}`), "Extended evidence path escapes run directory", spec.path);
    const stat = await fs.lstat(absolutePath);
    assert(stat.isFile() && !stat.isSymbolicLink(), "Extended evidence must be a regular non-symlink file", spec.path);
    const bytes = await fs.readFile(absolutePath);
    const sha256 = sha256Bytes(bytes);
    assert(sha256 === spec.sha256, "Extended evidence local bytes do not match the pinned SHA-256", {
      path: spec.path,
      expected: spec.sha256,
      actual: sha256,
    });
    const evidence = { sha256, bytes: bytes.length };
    evidenceFilesByPath.set(spec.path, evidence);
    inputEvidence.push({
      role: `${spec.familyKey}:${spec.role}`,
      path: spec.path,
      sha256,
      bytes: bytes.length,
    });
    absolutePaths.set(spec.path, absolutePath);
  }
  inputEvidence.sort((left, right) => left.path.localeCompare(right.path, "en"));
  return { evidenceFilesByPath, inputEvidence, absolutePaths };
}

export async function generateTemplateResolutionPlan({
  runDirectory = DEFAULT_RUN_DIRECTORY,
  outputPath = null,
  expectedCounts = EXPECTED_CLASSIFICATION_COUNTS,
  writeOutput = true,
} = {}) {
  const absoluteRunDirectory = path.resolve(runDirectory);
  const reviewDirectory = path.join(absoluteRunDirectory, "review");
  const paths = {
    baseAudit: path.join(reviewDirectory, "template-geometry-audit.json"),
    geometrySupplement: path.join(reviewDirectory, "template-geometry-supplement.json"),
    templateProjectionStubs: path.join(reviewDirectory, "template-projection-stubs.jsonl"),
    proposedCompatibility: path.join(reviewDirectory, "proposed-compatibility.json"),
    proposedPriceRows: path.join(reviewDirectory, "proposed-price-rows.jsonl"),
  };
  const [auditFile, supplementFile, stubFile, compatibilityFile] = await Promise.all([
    readFileWithEvidence(paths.baseAudit, absoluteRunDirectory),
    readFileWithEvidence(paths.geometrySupplement, absoluteRunDirectory),
    readFileWithEvidence(paths.templateProjectionStubs, absoluteRunDirectory, parseJsonLines),
    readFileWithEvidence(paths.proposedCompatibility, absoluteRunDirectory),
  ]);
  const [priceFile, extendedFiles] = await Promise.all([
    summarizePriceRowsFile(paths.proposedPriceRows, absoluteRunDirectory),
    loadExtendedEvidenceFiles(absoluteRunDirectory),
  ]);
  const inputEvidence = {
    baseAudit: auditFile.evidence,
    geometrySupplement: supplementFile.evidence,
    templateProjectionStubs: stubFile.evidence,
    proposedCompatibility: compatibilityFile.evidence,
    proposedPriceRows: priceFile.evidence,
    extendedEvidenceFiles: extendedFiles.inputEvidence,
  };
  const extendedEvidence = buildExtendedExactEvidence({
    audit: auditFile.value,
    baseAuditSha256: auditFile.evidence.sha256,
    titleSupplementSha256: supplementFile.evidence.sha256,
    evidenceFilesByPath: extendedFiles.evidenceFilesByPath,
  });
  const plan = buildTemplateResolutionPlan({
    audit: auditFile.value,
    supplement: supplementFile.value,
    stubs: stubFile.value,
    compatibility: compatibilityFile.value,
    priceSummary: priceFile.summary,
    inputEvidence,
    extendedEvidence,
    expectedCounts,
  });

  await Promise.all(
    Object.entries(paths).map(([key, absolutePath]) => assertEvidenceUnchanged(absolutePath, inputEvidence[key]))
  );
  await Promise.all(
    inputEvidence.extendedEvidenceFiles.map((evidence) =>
      assertEvidenceUnchanged(extendedFiles.absolutePaths.get(evidence.path), evidence)
    )
  );

  const resolvedOutputPath = path.resolve(outputPath || path.join(reviewDirectory, DEFAULT_OUTPUT_NAME));
  assert(path.dirname(resolvedOutputPath) === reviewDirectory, "Resolution plan output must stay in the run review directory");
  const outputBytes = Buffer.from(`${JSON.stringify(plan, null, 2)}\n`, "utf8");
  const outputSha256 = sha256Bytes(outputBytes);
  const sidecarPath = `${resolvedOutputPath}.sha256`;
  const temporaryPath = `${resolvedOutputPath}.tmp-${process.pid}`;
  const temporarySidecarPath = `${sidecarPath}.tmp-${process.pid}`;
  if (writeOutput) {
    await fs.writeFile(temporaryPath, outputBytes, { mode: 0o600 });
    await fs.writeFile(temporarySidecarPath, `${outputSha256}  ${path.basename(resolvedOutputPath)}\n`, { mode: 0o600 });
    await fs.rename(temporaryPath, resolvedOutputPath);
    await fs.rename(temporarySidecarPath, sidecarPath);
  }
  return { plan, outputPath: resolvedOutputPath, outputSha256, sidecarPath };
}

function parseArguments(argv) {
  const result = { runDirectory: DEFAULT_RUN_DIRECTORY, outputPath: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--run-dir") result.runDirectory = argv[++index];
    else if (argument === "--output") result.outputPath = argv[++index];
    else throw new TemplateResolutionPlanError(`Unknown argument: ${argument}`);
  }
  assert(result.runDirectory, "--run-dir requires a value");
  return result;
}

async function main() {
  const result = await generateTemplateResolutionPlan(parseArguments(process.argv.slice(2)));
  const counts = result.plan.counts.classifications;
  const filtered = result.plan.filteredCandidates;
  process.stdout.write(`${JSON.stringify({
    kind: result.plan.kind,
    reviewState: result.plan.reviewState,
    outputPath: result.outputPath,
    outputSha256: result.outputSha256,
    classifications: counts,
    filteredCandidateCounts: {
      templateProjection: filtered.templateProjection,
      compatibility: filtered.compatibility,
      proposedPriceRows: filtered.proposedPriceRows,
      pendingReviewBoundary: filtered.pendingReviewBoundary,
    },
    prohibitedActionsPerformed: result.plan.prohibitedActionsPerformed,
  }, null, 2)}\n`);
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    const payload = {
      error: error?.name || "Error",
      message: error?.message || String(error),
      details: error?.details || null,
    };
    process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exitCode = 1;
  });
}
