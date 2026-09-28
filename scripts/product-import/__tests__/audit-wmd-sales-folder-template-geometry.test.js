import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  PROHIBITED_ACTIONS_PERFORMED,
  auditTemplateBindings,
  normalizeExtractedPdfText,
  parseTemplateFactsFromText,
  parseTemplateFactsFromUrl,
} from "../audit-wmd-sales-folder-template-geometry.js";

function sha(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function productUrl(id, print = "4+0", finish = "none") {
  return `https://www.wir-machen-druck.de/sales-folder-${id}-${print.replace("+", "")}-${finish}.html`;
}

function templateUrl(filename) {
  return `https://www.wir-machen-druck.de/tpl/manns-partner/media/ddb/druckdatenskizzen/0/${filename}`;
}

function guideUrl(filename) {
  return templateUrl(filename.replace(/_2\.pdf$/, "_1.pdf"));
}

function rawBinding({
  id = "19010",
  materialId = "material-1",
  format = "a6",
  construction = "2-part-closure",
  print = "4+0",
  spine = 1,
  paper = "chromo-mappekarton",
  finish = "none",
  template,
  sourceUrl = productUrl(id, print, finish),
} = {}) {
  return {
    sourceUrl,
    sourceProductId: id,
    sourceSku: id,
    productSourceOrder: 0,
    materialId,
    materialSourceOrder: 0,
    materialLabel: `${paper}, ${spine} mm`,
    classification: {
      formatKey: format,
      constructionKey: construction,
      printMode: print,
      finishKey: finish,
    },
    materialFacts: {
      paperKey: paper,
      spineDepthMm: spine,
    },
    documents: [
      { role: "guide", label: "Datenblatt", url: guideUrl(template) },
      { role: "template", label: "Druckvorlage", url: templateUrl(template) },
    ],
  };
}

function compactSelection(binding) {
  return {
    bindingKey: `${binding.sourceUrl}|${binding.materialId}`,
    sourceUrl: binding.sourceUrl,
    sourceProductId: binding.sourceProductId,
    sourceSku: binding.sourceSku,
    productSourceOrder: binding.productSourceOrder,
    materialId: String(binding.materialId),
    materialSourceOrder: binding.materialSourceOrder,
    materialLabel: binding.materialLabel,
    classification: { ...binding.classification },
    materialFacts: { ...binding.materialFacts },
    documentRole: "template",
  };
}

function inventoryFor(bindings, { shaByUrl = new Map() } = {}) {
  const groups = new Map();
  for (const binding of bindings) {
    const document = binding.documents.find((item) => item.role === "template");
    if (!groups.has(document.url)) groups.set(document.url, []);
    groups.get(document.url).push(binding);
  }
  return [...groups].map(([sourceUrl, groupedBindings], index) => ({
    sourceUrl,
    role: "template",
    labelOriginals: ["Druckvorlage"],
    localRelativePath: `documents/source-pdfs/template-${index}.pdf`,
    selectionBindings: groupedBindings.map(compactSelection),
    sha256: shaByUrl.get(sourceUrl) || sha(sourceUrl),
    byteSize: 1000 + index,
    inspection: { pageCount: 2 },
  }));
}

function germanText({ format, construction, print, spine, extra = "" }) {
  const formatLabel = {
    a4: "DIN A4",
    a5: "DIN A5",
    a6: "DIN A6",
    "din-lang": "DIN lang",
    "square-21x21": "Quadrat 21 x 21 cm",
    "cd-135x135": "CD-Mappe 135 x 135 mm",
  }[format];
  const constructionLabel = {
    "2-part-standard": "",
    "2-part-standard-window": "mit Fensterstanzung",
    "2-part-2-flaps": "2-teilig mit 2 Laschen",
    "2-part-2-flaps-window": "2-teilig mit 2 Laschen und Fensterstanzung",
    "2-part-3-flaps": "2-teilig mit 3 Laschen",
    "2-part-3-flaps-window": "2-teilig mit 3 Laschen und Fensterstanzung",
    "2-part-closure": "2-teilig mit Verschluss",
    "3-part-1-flap": "3-teilig mit 1 Lasche",
  }[construction];
  return `VORLAGE ZUR GESTALTUNG EINER MAPPE FÜR ${formatLabel}, ${constructionLabel} ${print.replace("+", "/")} farbig, ${spine} mm Füllhöhe. ${extra}`;
}

function textMapFor(bindings, overrideByUrl = new Map()) {
  const result = new Map();
  for (const binding of bindings) {
    const sourceUrl = binding.documents.find((item) => item.role === "template").url;
    if (result.has(sourceUrl)) continue;
    const text = overrideByUrl.has(sourceUrl)
      ? overrideByUrl.get(sourceUrl)
      : germanText({
        format: binding.classification.formatKey,
        construction: binding.classification.constructionKey,
        print: binding.classification.printMode,
        spine: binding.materialFacts.spineDepthMm,
      });
    result.set(sourceUrl, {
      text,
      textSha256: sha(text),
      pageCount: 2,
      error: null,
    });
  }
  return result;
}

function run(bindings, options = {}) {
  return auditTemplateBindings({
    bindings,
    inventory: options.inventory || inventoryFor(bindings, options),
    pdfTextBySourceUrl: options.textMap || textMapFor(bindings, options.overrideByUrl),
  });
}

test("supplier template URL parser covers every sales-folder format, construction, print branch and spine", () => {
  const fixtures = [
    ["mappe_din_a4_2teilig_ohnelasche_1mm_40plus_2.pdf", "a4", "2-part-standard", "4+0", 1],
    ["mappe_din_a4_2teilig_ohnelasche_1mm_fenster_44_2.pdf", "a4", "2-part-standard-window", "4+4", 1],
    ["mappe_din_a5_2teilig_2laschen_3mm_40_2.pdf", "a5", "2-part-2-flaps", "4+0", 3],
    ["mappe_din_a4_2teilig_2laschen_5mm_fenster_44plus_2.pdf", "a4", "2-part-2-flaps-window", "4+4", 5],
    ["mappe_din_a6_2teilig_3laschen_10mm_40plus_2.pdf", "a6", "2-part-3-flaps", "4+0", 10],
    ["mappe_din_a4_2teilig_3laschen_3mm_fenster_44_2.pdf", "a4", "2-part-3-flaps-window", "4+4", 3],
    ["mappe_din_a6_3laschen_verschluss_5mm_40_2.pdf", "a6", "2-part-closure", "4+0", 5],
    ["mappe_din_lang_3laschen_verschluss_10mm_44plus_2.pdf", "din-lang", "2-part-closure", "4+4", 10],
    ["mappe_din_a4_3teilig_1lasche_1mm_40_2.pdf", "a4", "3-part-1-flap", "4+0", 1],
    ["mappe_21x21cm_2teilig_2laschen_3mm_40plus_2.pdf", "square-21x21", "2-part-2-flaps", "4+0", 3],
    ["mappe_cd_2teilig_verschluss_3mm_40_2.pdf", "cd-135x135", "2-part-closure", "4+0", 3],
  ];
  for (const [filename, format, construction, print, spine] of fixtures) {
    const parsed = parseTemplateFactsFromUrl(templateUrl(filename));
    assert.deepEqual(parsed.facts.format.values, [format], filename);
    assert.deepEqual(parsed.facts.construction.values, [construction], filename);
    assert.deepEqual(parsed.facts.print.values, [print], filename);
    assert.deepEqual(parsed.facts.spine.values, [spine], filename);
    assert.equal(parsed.roleLooksLikeTemplate, true, filename);
  }
});

test("PDF text parser tolerates WMD extraction artifacts and keeps explicit facts", () => {
  const text = [
    "MAPPE FÜR DIN A6, 2/hyphen.capTEILIG MIT VERSCHLUSS",
    "4/0 farbig (Außenseite bedruckt), 1 mm Füllhöhe",
    "Sicherheitsabstand: 3 mm; Datenformat: 234 x 259 mm",
  ].join("\n");
  const parsed = parseTemplateFactsFromText(text);
  assert.deepEqual(parsed.facts.format.values, ["a6"]);
  assert.deepEqual(parsed.facts.construction.values, ["2-part-closure"]);
  assert.deepEqual(parsed.facts.print.values, ["4+0"]);
  assert.deepEqual(parsed.facts.spine.values, [1]);
  assert.doesNotMatch(normalizeExtractedPdfText(text), /hyphen\.cap/);
});

test("PDF text parser recognizes WMD three-part folders when the heading omits the numeral one", () => {
  const text = [
    "MAPPE FÜR DIN A4, 3/hyphen.capTEILIG MIT LASCHE",
    "4/0 farbig (Außenseite bedruckt), 1 mm Füllhöhe",
  ].join("\n");
  const parsed = parseTemplateFactsFromText(text);
  assert.deepEqual(parsed.facts.construction.values, ["3-part-1-flap"]);
});

test("known supplier products 19010, 19030, 19194 and 19322 block explicit 1 mm templates bound to higher spines", () => {
  const fixtures = [
    rawBinding({
      id: "19010",
      materialId: "1109927",
      format: "a6",
      construction: "2-part-closure",
      print: "4+0",
      spine: 3,
      template: "mappe_din_a6_3laschen_verschluss_1mm_40_2.pdf",
    }),
    rawBinding({
      id: "19030",
      materialId: "458472",
      format: "din-lang",
      construction: "2-part-2-flaps",
      print: "4+0",
      spine: 10,
      template: "mappe_din_lang_2teilig_2laschen_1mm_40_2.pdf",
    }),
    rawBinding({
      id: "19194",
      materialId: "459779",
      format: "a4",
      construction: "2-part-3-flaps-window",
      print: "4+0",
      spine: 5,
      template: "mappe_din_a4_2teilig_3laschen_1mm_fenster_40plus_2.pdf",
    }),
    rawBinding({
      id: "19322",
      materialId: "1109077",
      format: "a4",
      construction: "2-part-2-flaps",
      print: "4+4",
      spine: 10,
      template: "mappe_din_a4_2teilig_2laschen_1mm_44plus_2.pdf",
    }),
  ];
  const overrideByUrl = new Map(fixtures.map((binding) => {
    const url = binding.documents.find((item) => item.role === "template").url;
    return [url, germanText({
      format: binding.classification.formatKey,
      construction: binding.classification.constructionKey,
      print: binding.classification.printMode,
      spine: 1,
    })];
  }));
  const report = run(fixtures, { overrideByUrl });
  assert.equal(report.state, "blocked");
  assert.equal(report.counts.blockedBindings, 4);
  assert.deepEqual(report.sourceProductIdsWithBlockedBindings, ["19010", "19030", "19194", "19322"]);
  for (const audit of report.bindingAudits) {
    const codes = audit.blockers.map((item) => item.code);
    assert.ok(codes.includes("URL_SPINE_MISMATCH"), audit.sourceProductId);
    assert.ok(codes.includes("PDF_TEXT_SPINE_MISMATCH"), audit.sourceProductId);
    assert.equal(audit.geometryVerified, false);
    assert.equal(audit.templateReadyForSanitization, false);
    assert.equal(audit.templateReadyForImport, false);
  }
});

test("4+0 and 4+4 are verified only against their exact separately identified templates", () => {
  const outside = rawBinding({
    id: "print-40",
    materialId: "m40",
    format: "a4",
    construction: "2-part-2-flaps",
    print: "4+0",
    spine: 3,
    template: "mappe_din_a4_2teilig_2laschen_3mm_40_2.pdf",
  });
  const bothSides = rawBinding({
    id: "print-44",
    materialId: "m44",
    format: "a4",
    construction: "2-part-2-flaps",
    print: "4+4",
    spine: 3,
    template: "mappe_din_a4_2teilig_2laschen_3mm_44_2.pdf",
  });
  const passed = run([outside, bothSides]);
  assert.equal(passed.templateGeometryReady, true);
  assert.equal(passed.counts.verifiedBindings, 2);

  const wrong = rawBinding({
    id: "wrong-print",
    materialId: "wrong",
    format: "a4",
    construction: "2-part-2-flaps",
    print: "4+4",
    spine: 3,
    template: "mappe_din_a4_2teilig_2laschen_3mm_40_2.pdf",
  });
  const wrongUrl = wrong.documents.find((item) => item.role === "template").url;
  const failed = run([wrong], {
    overrideByUrl: new Map([[wrongUrl, germanText({
      format: "a4",
      construction: "2-part-2-flaps",
      print: "4+0",
      spine: 3,
    })]]),
  });
  const codes = failed.bindingAudits[0].blockers.map((item) => item.code);
  assert.ok(codes.includes("URL_PRINT_MISMATCH"));
  assert.ok(codes.includes("PDF_TEXT_PRINT_MISMATCH"));
});

test("one exact PDF may be reused across paper and finish only when production geometry is identical", () => {
  const filename = "mappe_din_a4_2teilig_2laschen_3mm_40plus_2.pdf";
  const bindings = [
    rawBinding({
      id: "reuse-a",
      materialId: "paper-a",
      format: "a4",
      construction: "2-part-2-flaps",
      print: "4+0",
      spine: 3,
      paper: "chromo-mappekarton",
      finish: "none",
      template: filename,
    }),
    rawBinding({
      id: "reuse-b",
      materialId: "paper-b",
      format: "a4",
      construction: "2-part-2-flaps",
      print: "4+0",
      spine: 3,
      paper: "matt-billedtrykskarton",
      finish: "matt-lamination",
      template: filename,
    }),
    rawBinding({
      id: "reuse-c",
      materialId: "paper-c",
      format: "a4",
      construction: "2-part-2-flaps",
      print: "4+0",
      spine: 3,
      paper: "hvid-genbrugskarton",
      finish: "high-gloss-uv",
      template: filename,
    }),
  ];
  const report = run(bindings);
  assert.equal(report.templateGeometryReady, true);
  assert.equal(report.counts.blockedBindings, 0);
  assert.equal(report.reuseGroups.length, 1);
  assert.equal(report.reuseGroups[0].verdict, "allowed_identical_geometry");
  assert.deepEqual(report.reuseGroups[0].permittedNonGeometryReuseAxes, ["paper", "quantity", "finish"]);
  assert.deepEqual(report.reuseGroups[0].paperKeys, [
    "chromo-mappekarton",
    "hvid-genbrugskarton",
    "matt-billedtrykskarton",
  ]);
});

test("one source URL reused across different spines blocks every binding in that reuse group", () => {
  const filename = "mappe_din_a6_3laschen_verschluss_1mm_40_2.pdf";
  const one = rawBinding({ id: "same-url-1", materialId: "one", spine: 1, template: filename });
  const three = rawBinding({ id: "same-url-3", materialId: "three", spine: 3, template: filename });
  const url = one.documents.find((item) => item.role === "template").url;
  const report = run([one, three], {
    overrideByUrl: new Map([[url, germanText({
      format: "a6",
      construction: "2-part-closure",
      print: "4+0",
      spine: 1,
    })]]),
  });
  assert.equal(report.counts.blockedUrlReuseGroups, 1);
  assert.equal(report.counts.blockedBindings, 2);
  for (const audit of report.bindingAudits) {
    assert.ok(audit.blockers.some((item) => item.code === "TEMPLATE_URL_REUSED_ACROSS_GEOMETRIES"));
  }
});

test("different filenames with identical bytes cannot stand for different spines", () => {
  const one = rawBinding({
    id: "same-bytes-1",
    materialId: "one",
    spine: 1,
    template: "mappe_din_a6_3laschen_verschluss_1mm_40_2.pdf",
  });
  const three = rawBinding({
    id: "same-bytes-3",
    materialId: "three",
    spine: 3,
    template: "mappe_din_a6_3laschen_verschluss_3mm_40_2.pdf",
  });
  const sharedSha = sha("identical-pdf-bytes");
  const shaByUrl = new Map([one, three].map((binding) => [
    binding.documents.find((item) => item.role === "template").url,
    sharedSha,
  ]));
  const report = run([one, three], { shaByUrl });
  assert.equal(report.counts.blockedByteReuseGroups, 1);
  assert.equal(report.counts.blockedBindings, 2);
  for (const audit of report.bindingAudits) {
    assert.ok(audit.blockers.some((item) => item.code === "TEMPLATE_BYTES_REUSED_ACROSS_GEOMETRIES"));
  }
});

test("ambiguous or missing filename/text facts fail closed", () => {
  const missing = rawBinding({
    id: "missing",
    materialId: "missing",
    format: "a4",
    construction: "2-part-2-flaps",
    print: "4+0",
    spine: 3,
    template: "folder_2.pdf",
  });
  const missingUrl = missing.documents.find((item) => item.role === "template").url;
  const missingReport = run([missing], {
    overrideByUrl: new Map([[missingUrl, ""]]),
  });
  const missingCodes = missingReport.bindingAudits[0].blockers.map((item) => item.code);
  assert.ok(missingCodes.includes("PDF_TEXT_EMPTY"));
  assert.ok(missingCodes.includes("URL_FORMAT_MISSING"));
  assert.ok(missingCodes.includes("URL_CONSTRUCTION_MISSING"));
  assert.ok(missingCodes.includes("URL_PRINT_MISSING"));
  assert.ok(missingCodes.includes("URL_SPINE_MISSING"));

  const ambiguous = rawBinding({
    id: "ambiguous",
    materialId: "ambiguous",
    format: "a4",
    construction: "2-part-2-flaps",
    print: "4+0",
    spine: 3,
    template: "mappe_din_a4_2teilig_2laschen_3mm_40_2.pdf",
  });
  const ambiguousUrl = ambiguous.documents.find((item) => item.role === "template").url;
  const ambiguousReport = run([ambiguous], {
    overrideByUrl: new Map([[ambiguousUrl, `${germanText({
      format: "a4",
      construction: "2-part-2-flaps",
      print: "4+0",
      spine: 3,
    })} Alternative: 1 mm Füllhöhe.`]]),
  });
  assert.ok(ambiguousReport.bindingAudits[0].blockers.some(
    (item) => item.code === "PDF_TEXT_SPINE_AMBIGUOUS"
  ));
});

test("inventory selection facts must match the immutable raw binding", () => {
  const binding = rawBinding({
    id: "inventory-mismatch",
    materialId: "material",
    format: "a4",
    construction: "2-part-2-flaps",
    print: "4+0",
    spine: 3,
    template: "mappe_din_a4_2teilig_2laschen_3mm_40_2.pdf",
  });
  const inventory = inventoryFor([binding]);
  inventory[0].selectionBindings[0].materialFacts.spineDepthMm = 5;
  const report = run([binding], { inventory });
  assert.ok(report.bindingAudits[0].blockers.some(
    (item) => item.code === "INVENTORY_BINDING_MISMATCH"
  ));
});

test("audit output can never claim import readiness or any mutation", () => {
  const binding = rawBinding({
    id: "safe",
    materialId: "safe",
    format: "a6",
    construction: "2-part-closure",
    print: "4+0",
    spine: 1,
    template: "mappe_din_a6_3laschen_verschluss_1mm_40_2.pdf",
  });
  const report = run([binding]);
  assert.equal(report.templateGeometryReady, true);
  assert.equal(report.eligibleForTemplateSanitization, true);
  assert.equal(report.eligibleForTemplateImport, false);
  assert.equal(report.eligibleForImport, false);
  assert.equal(report.bindingAudits[0].templateReadyForImport, false);
  assert.deepEqual(report.prohibitedActionsPerformed, PROHIBITED_ACTIONS_PERFORMED);
  assert.deepEqual(PROHIBITED_ACTIONS_PERFORMED, {
    sourcePdfModified: false,
    sourcePdfSanitized: false,
    sourcePdfUploaded: false,
    databaseWritten: false,
    productOrTemplateRecordWritten: false,
    published: false,
  });
});
