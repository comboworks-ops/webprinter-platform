import assert from "node:assert/strict";
import test from "node:test";

import {
  extractGuideFactsFromPages,
  extractTemplatePageOrder,
  validateNativeGuideFactsArtifact,
} from "../build-wmd-sales-folder-native-guide-facts.js";

const SHA = "a".repeat(64);
const OTHER_SHA = "b".repeat(64);

const guideText = `
Datenblatt
Datenformat: 500 x 410 mm
In diesem Format enthalten sind: 5 mm Beschnitt.
Endformat: 490 x 400 mm
Gefalztes Endformat: 215 x 302 mm
Sicherheitsabstand: 3 mm (auf allen Seiten)
Falzlinien Hier befinden sich die Falzpositionen in Ihrem Produkt.
Der Farbmodus Ihrer Druckdaten muss CMYK sein.
Die Auflösung von Bildgrafiken sollte mindestens 300 dpi betragen.
Speichern Sie Ihr Dokument im PDF-Format ab. Achten Sie darauf, Schriften einzubetten und
(soweit als möglich) Transparenzen zu reduzieren.
Hintergrundbilder, Farben, Verläufe und Grafiken sollten bis an den Rand des Datenformats angelegt werden.
Im letzten Schritt entfernen Sie die Druckvorlage wieder, damit diese nicht mitgedruckt wird.
`;

test("extracts only source-backed dimensions and delivery facts while omitting unlabeled panels", () => {
  const result = extractGuideFactsFromPages([{ pageNumber: 1, text: guideText }]);

  assert.deepEqual(result.facts.dataFormatMm.value, { widthMm: 500, heightMm: 410 });
  assert.deepEqual(result.facts.finalFormatMm.value, { widthMm: 490, heightMm: 400 });
  assert.deepEqual(result.facts.foldedFinalFormatMm.value, { widthMm: 215, heightMm: 302 });
  assert.equal(result.facts.bleedMm.value, 5);
  assert.equal(result.facts.safetyMm.value, 3);
  assert.equal(result.facts.colorMode.value, "CMYK");
  assert.equal(result.facts.minimumResolutionDpi.value, 300);
  assert.equal(result.facts.deliveryRules.status, "evidenced");
  assert.equal(result.facts.panelWidthsMm.status, "missing");
  assert.deepEqual(result.missingFacts, ["folds.count", "folds.positionsMm", "panelWidthsMm"]);
});

test("accepts panel widths only when the supplier text labels them explicitly", () => {
  const result = extractGuideFactsFromPages([{
    pageNumber: 1,
    text: `${guideText}\nPanelbreiten: 215 / 10 / 215 mm`,
  }]);

  assert.equal(result.facts.panelWidthsMm.status, "evidenced");
  assert.deepEqual(result.facts.panelWidthsMm.value, [215, 10, 215]);
  assert(!result.missingFacts.includes("panelWidthsMm"));
});

test("preserves exact template page order from page-local supplier labels", () => {
  const result = extractTemplatePageOrder([
    { pageNumber: 1, text: "TITELSEITERÜCKSEITE" },
    { pageNumber: 2, text: "INNENSEITE INNENSEITE" },
  ]);

  assert.equal(result.fact.status, "evidenced");
  assert.deepEqual(result.fact.value, [
    {
      pageNumber: 1,
      labels: [
        { supplier: "TITELSEITE", normalizedDa: "forside" },
        { supplier: "RÜCKSEITE", normalizedDa: "bagside" },
      ],
    },
    {
      pageNumber: 2,
      labels: [{ supplier: "INNENSEITE", normalizedDa: "inderside" }],
    },
  ]);
});

function evidenced(value) {
  return { status: "evidenced", value, displayDa: "dokumenteret", evidence: [] };
}

function validArtifact() {
  const facts = {
    dataFormatMm: evidenced({ widthMm: 500, heightMm: 410 }),
    finalFormatMm: evidenced({ widthMm: 490, heightMm: 400 }),
    foldedFinalFormatMm: evidenced({ widthMm: 215, heightMm: 302 }),
    bleedMm: evidenced(5),
    safetyMm: evidenced(3),
    folds: evidenced({
      supplierFoldLinesPresent: true,
      count: null,
      positionsMm: null,
      templateFoldLayerPresent: true,
      sanitizedTemplateFoldLayerPreserved: true,
    }),
    panelWidthsMm: {
      status: "missing",
      value: null,
      displayDa: null,
      evidence: [],
      reasonDa: "ikke navngivet",
    },
    pageOrder: evidenced([{ pageNumber: 1, labels: [] }]),
    colorMode: evidenced("CMYK"),
    minimumResolutionDpi: evidenced(300),
    deliveryRules: evidenced({ fileFormat: "PDF" }),
  };
  const binding = {
    sourceOrder: 0,
    documentKey: "binding-1",
    match: {
      folder_model: "a4--2-part-standard",
      print: "4+0",
      spine: "1mm",
      paper: "paper",
      finish: "none",
    },
    geometry: { key: "a4|2-part-standard|4+0|1mm" },
    factsReviewed: true,
    facts,
    missingFacts: ["folds.count", "folds.positionsMm", "panelWidthsMm"],
    requiredFactGaps: [],
    optionalOmissions: ["folds.count", "folds.positionsMm", "panelWidthsMm"],
    conflicts: [],
    sourceDisagreements: [],
    sourceEvidence: {
      guideFactSetKey: `guide-sha256:${SHA}`,
      guideSha256: SHA,
      templatePageFactSetKey: `template-sha256:${OTHER_SHA}`,
      templateSha256: OTHER_SHA,
      contractSha256: SHA,
    },
  };
  return {
    schemaVersion: 1,
    kind: "wmd_sales_folder_native_guide_facts",
    state: "reviewed_source_facts_with_optional_omissions",
    reviewState: "source_evidence_reviewed_for_display",
    localOnly: true,
    factsReviewed: true,
    requiredFactKeys: [
      "dataFormatMm", "finalFormatMm", "foldedFinalFormatMm", "bleedMm", "safetyMm",
      "folds", "panelWidthsMm", "pageOrder", "colorMode", "minimumResolutionDpi",
      "deliveryRules",
    ],
    requiredDisplayFactKeys: [
      "dataFormatMm", "finalFormatMm", "foldedFinalFormatMm", "bleedMm", "safetyMm",
      "folds", "pageOrder", "colorMode", "minimumResolutionDpi", "deliveryRules",
    ],
    optionalOmissionKeys: ["folds.count", "folds.positionsMm", "panelWidthsMm"],
    inputEvidence: { machineExtraction: { path: "review/machine.json", sha256: SHA, bytes: 1 } },
    promotionEvidence: {
      machineExtraction: { path: "review/machine.json", sha256: SHA, bytes: 1 },
      productDraftApprovalDecision: {
        sha256: OTHER_SHA,
        state: "approved_for_supplier_bank_and_unpublished_product_draft",
      },
      manualPageByPageReviewClaimed: false,
    },
    guideFactSets: [{
      key: `guide-sha256:${SHA}`,
      sourcePdf: { sha256: SHA },
      extractedText: { normalizedTextSha256: SHA },
    }],
    templatePageFactSets: [{
      key: `template-sha256:${OTHER_SHA}`,
      sourcePdf: { sha256: OTHER_SHA },
      extractedText: { normalizedTextSha256: OTHER_SHA },
    }],
    geometries: [{ key: "a4|2-part-standard|4+0|1mm" }],
    bindings: [binding],
    coverage: {
      exactBindings: 1,
      displayedFactsReviewedBindings: 1,
      displayedFactsUnreviewedBindings: 0,
      sourceEvidenceCompleteBindings: 0,
      bindingsWithMissingFacts: 1,
      bindingsWithOptionalOmissions: 1,
      bindingsWithRequiredFactGaps: 0,
      bindingsWithConflicts: 0,
      bindingsWithSourceDisagreements: 0,
      factsReviewedBindings: 1,
      missingFactsByKey: {
        "folds.count": 1,
        "folds.positionsMm": 1,
        panelWidthsMm: 1,
      },
      exactGeometries: 1,
    },
    prohibitedActionsPerformed: {
      sourcePdfModified: false,
      databaseWritten: false,
      published: false,
    },
  };
}

test("review validator permits optional omissions but fails closed on a displayed-fact gap", () => {
  const artifact = validArtifact();
  const assessment = validateNativeGuideFactsArtifact(artifact);
  assert.equal(assessment.factsReviewed, true);
  assert.equal(assessment.bindingsWithRequiredFactGaps, 0);

  const invalid = structuredClone(artifact);
  invalid.bindings[0].factsReviewed = false;
  invalid.bindings[0].missingFacts.push("colorMode");
  invalid.bindings[0].missingFacts.sort();
  invalid.bindings[0].requiredFactGaps = ["colorMode"];
  assert.throws(
    () => validateNativeGuideFactsArtifact(invalid),
    /coverage|state|factsReviewed/u,
  );
});
