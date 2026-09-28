import test from "node:test";
import assert from "node:assert/strict";

import {
  WMD_SALES_FOLDER_DANISH_LABELS,
  WMD_SALES_FOLDER_SOURCE_ORDER,
  buildWmdSalesFolderCoverageReport,
  buildWmdSalesFolderOptionCatalog,
  buildWmdSalesFolderSelectionKey,
  classifyWmdSalesFolderSource,
  normalizeWmdSalesFolderRow,
  normalizeWmdSalesFolderRows,
  parseWmdSalesFolderMaterial,
  parseWmdSalesFolderQuantityPrice,
  pruneWmdSalesFolderRetryFailures,
  sortWmdSalesFolderRows,
} from "../shared/wmd-sales-folders.js";

const BASE_SOURCE = {
  url: "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-2-laschen-40-farbig-aussenseite-bedruckt.html",
  title: "Mappe für DIN A4, 2teilig mit 2 Laschen, 4/0-farbig",
};

const BASE_MATERIAL =
  "0,40 mm starker Chromokarton 255g für 5mm Mappen-Füllhöhe (FSC-zertifiziert)";

const LIVE_NO_FINISH_MODELS = [
  ["Mappe für DIN A4", "a4", "2-part-standard", false, false],
  ["Mappe für DIN A4, 2-teilig mit 2 Laschen", "a4", "2-part-2-flaps", false, false],
  ["Mappe für DIN A4, 2-teilig mit 3 Laschen", "a4", "2-part-3-flaps", false, false],
  ["Mappe für DIN A4, 3-teilig mit Lasche", "a4", "3-part-1-flap", false, false],
  [
    "Mappe für DIN A4, mit Fensterstanzung",
    "a4",
    "2-part-standard-window",
    true,
    false,
  ],
  [
    "Mappe für DIN A4, mit Fensterstanzung, 2-teilig mit 2 Laschen",
    "a4",
    "2-part-2-flaps-window",
    true,
    false,
  ],
  [
    "Mappe für DIN A4, mit Fensterstanzung, 2-teilig mit 3 Laschen",
    "a4",
    "2-part-3-flaps-window",
    true,
    false,
  ],
  ["Mappe für DIN A5", "a5", "2-part-standard", false, false],
  ["Mappe für DIN A5, 2-teilig mit 2 Laschen", "a5", "2-part-2-flaps", false, false],
  ["Mappe für DIN A5, 2-teilig mit 3 Laschen", "a5", "2-part-3-flaps", false, false],
  ["Mappe für DIN A5, 3-teilig mit Lasche", "a5", "3-part-1-flap", false, false],
  ["Mappe für DIN A6, 2-teilig mit 2 Laschen", "a6", "2-part-2-flaps", false, false],
  ["Mappe für DIN A6, 2-teilig mit 3 Laschen", "a6", "2-part-3-flaps", false, false],
  ["Mappe für DIN A6, 2-teilig mit Verschluss", "a6", "2-part-closure", false, true],
  ["Mappe für DIN A6, 3-teilig mit Lasche", "a6", "3-part-1-flap", false, false],
  [
    "Mappe für DIN lang, 2-teilig mit 2 Laschen",
    "din-lang",
    "2-part-2-flaps",
    false,
    false,
  ],
  [
    "Mappe für DIN lang, 2-teilig mit 3 Laschen",
    "din-lang",
    "2-part-3-flaps",
    false,
    false,
  ],
  [
    "Mappe für DIN lang, 2-teilig mit Verschluss",
    "din-lang",
    "2-part-closure",
    false,
    true,
  ],
  [
    "Mappe für Quadrat 21 x 21 cm, 2-teilig mit 2 Laschen",
    "square-21x21",
    "2-part-2-flaps",
    false,
    false,
  ],
  [
    "Mappe für Quadrat 21 x 21 cm, 2-teilig mit 3 Laschen",
    "square-21x21",
    "2-part-3-flaps",
    false,
    false,
  ],
  [
    "Mappe für CD-Verpackung 13,5 x 13,5 cm, 2-teilig mit Verschluss",
    "cd-135x135",
    "2-part-closure",
    false,
    true,
  ],
];

function rawRow(overrides = {}) {
  return {
    ...BASE_SOURCE,
    materialLabel: BASE_MATERIAL,
    sourceOptionText: "1.000 Stück (1.234,56 Euro)",
    ...overrides,
  };
}

test("source classifier resolves formats, construction and 4+0 before 4+4", () => {
  const cases = [
    ["din-a3", "a3", 297, 420],
    ["din-a4", "a4", 210, 297],
    ["din-a5", "a5", 148, 210],
    ["din-a6", "a6", 105, 148],
    ["din-lang", "din-lang", 105, 210],
    ["quadrat-21-x-21-cm", "square-21x21", 210, 210],
  ];

  for (const [formatSlug, expectedKey, widthMm, heightMm] of cases) {
    const result = classifyWmdSalesFolderSource(
      `https://www.wir-machen-druck.de/mappe-fuer-${formatSlug}-2teilig-mit-2-laschen-40-farbig-aussenseite-bedruckt.html`
    );
    assert.equal(result.formatKey, expectedKey);
    assert.equal(result.widthMm, widthMm);
    assert.equal(result.heightMm, heightMm);
    assert.equal(result.constructionKey, "2-part-2-flaps");
    assert.equal(result.constructionLabelDa, "2-delt med 2 flapper");
    assert.equal(result.printMode, "4+0");
    assert.equal(result.finishKey, "none");
    assert.equal(result.classified, true);
  }

  const bothSides = classifyWmdSalesFolderSource(
    "Mappe für DIN A4, 2-teilig mit 3 Laschen, 4+4-farbig außen und innen bedruckt"
  );
  assert.equal(bothSides.constructionKey, "2-part-3-flaps");
  assert.equal(bothSides.printMode, "4+4");
  assert.deepEqual(WMD_SALES_FOLDER_SOURCE_ORDER.print, ["4+0", "4+4"]);
  assert.equal(WMD_SALES_FOLDER_DANISH_LABELS.print["4+0"], "4+0 – tryk på ydersiden");
});

test("source classifier recognizes every supported finish with overlap-safe precedence", () => {
  const base =
    "https://www.wir-machen-druck.de/mappe-fuer-din-a4-2teilig-mit-2-laschen-40-farbig-aussenseite-bedruckt";
  const cases = [
    [".html", "none"],
    ["-mit-hochglanzuvlack.html", "high-gloss-uv"],
    ["-mit-partieller-uvlackveredelung.html", "partial-uv"],
    ["-mit-mattfolie-kaschiert.html", "matt-lamination"],
    ["-mit-glanzfolie-kaschiert.html", "gloss-lamination"],
    ["-mit-softfeelfolie-kaschiert.html", "soft-touch-lamination"],
    [
      "-mit-softfeelfolie-und-partieller-uvlackveredelung.html",
      "soft-touch-partial-uv",
    ],
    ["-mit-heissfolienpraegung-gold.html", "hot-foil-gold"],
    ["-mit-heissfolienpraegung-silber.html", "hot-foil-silver"],
    ["-mit-blindpraegung.html", "blind-emboss"],
  ];

  for (const [suffix, finishKey] of cases) {
    const result = classifyWmdSalesFolderSource(`${base}${suffix}`);
    assert.equal(result.finishKey, finishKey, suffix);
    assert.equal(result.classified, true, suffix);
    assert.ok(result.finishLabelDa, suffix);
  }

  const unknownFinish = classifyWmdSalesFolderSource(`${base}-mit-metalliclack.html`);
  assert.equal(unknownFinish.finishKey, null);
  assert.deepEqual(unknownFinish.unclassifiedDimensions, ["finish"]);
});

test("source classifier supports deterministic custom dimensions without inventing options", () => {
  const result = classifyWmdSalesFolderSource(
    "Mappe für 17,5 x 24 cm, 2teilig mit 2 Laschen, 4/0-farbig"
  );
  assert.equal(result.formatKey, "custom-175x240-mm");
  assert.equal(result.formatLabelDa, "17,5 × 24 cm");
  assert.equal(result.widthMm, 175);
  assert.equal(result.heightMm, 240);
});

test("all 21 discovered no-finish models classify for both supplier print branches", () => {
  assert.equal(LIVE_NO_FINISH_MODELS.length, 21);
  const printBranches = [
    ["4/0 farbig (Außenseite bedruckt)", "4+0"],
    ["4/4 farbig (Außen- und Innenseite bedruckt)", "4+4"],
  ];

  for (const [stem, formatKey, constructionKey, windowPunch, closure] of LIVE_NO_FINISH_MODELS) {
    for (const [printText, printMode] of printBranches) {
      const title = `${stem}, ${printText}`;
      const result = classifyWmdSalesFolderSource(title);
      assert.equal(result.classified, true, title);
      assert.equal(result.formatKey, formatKey, title);
      assert.equal(result.constructionKey, constructionKey, title);
      assert.equal(result.printMode, printMode, title);
      assert.equal(result.finishKey, "none", title);
      assert.equal(result.windowPunch, windowPunch, title);
      assert.equal(result.closure, closure, title);
    }
  }
});

test("window, closure and three-part construction labels remain distinct and Danish", () => {
  assert.equal(
    WMD_SALES_FOLDER_DANISH_LABELS.construction["2-part-standard"],
    "2-delt standardmappe"
  );
  assert.equal(
    WMD_SALES_FOLDER_DANISH_LABELS.construction["2-part-standard-window"],
    "2-delt standardmappe med vinduesudstansning"
  );
  assert.equal(
    WMD_SALES_FOLDER_DANISH_LABELS.construction["2-part-2-flaps-window"],
    "2-delt med 2 flapper og vinduesudstansning"
  );
  assert.equal(
    WMD_SALES_FOLDER_DANISH_LABELS.construction["2-part-3-flaps-window"],
    "2-delt med 3 flapper og vinduesudstansning"
  );
  assert.equal(
    WMD_SALES_FOLDER_DANISH_LABELS.construction["3-part-1-flap"],
    "3-delt med 1 flap"
  );
  assert.equal(
    WMD_SALES_FOLDER_DANISH_LABELS.construction["2-part-closure"],
    "2-delt med lukning"
  );
  assert.ok(WMD_SALES_FOLDER_SOURCE_ORDER.construction.includes("2-part-standard-window"));
});

test("CD supplier slug 135 x 135 cm is interpreted as 135 mm, not 1,350 mm", () => {
  const result = classifyWmdSalesFolderSource({
    url: "https://www.wir-machen-druck.de/mappe-fuer-cdverpackung-135-x-135-cm-2teilig-mit-verschluss-40-farbig-aussenseite-bedruckt.html",
    title:
      "Mappe für CD-Verpackung 13,5 x 13,5 cm, 2-teilig mit Verschluss, 4/0 farbig (Außenseite bedruckt)",
  });
  assert.equal(result.formatKey, "cd-135x135");
  assert.equal(result.formatLabelDa, "CD-mappe 13,5 × 13,5 cm");
  assert.equal(result.widthMm, 135);
  assert.equal(result.heightMm, 135);
  assert.equal(result.constructionKey, "2-part-closure");
  assert.equal(result.closure, true);
  assert.equal(result.classified, true);
});

test("material parser separates Danish paper identity from 1/3/5/10 mm spine depth", () => {
  const cases = [
    [
      "0,40 mm starker Chromokarton 255g für 1mm Mappen-Füllhöhe",
      "chromo-mappekarton",
      "255g Chromo mappekarton",
      255,
      0.4,
      1,
    ],
    [
      "0,36 mm starker Bilderdruckkarton 350g matt für 3 mm Mappen-Füllhöhe (zertifiziert mit FSC-Siegel)",
      "matt-billedtrykskarton",
      "350g Mat billedtrykskarton",
      350,
      0.36,
      3,
    ],
    [
      "0,36 mm starker Naturkarton 300g hochweiß für 5mm",
      "hoejhvid-naturkarton",
      "300g Højhvid naturkarton",
      300,
      0.36,
      5,
    ],
    [
      "0,36 mm starker Recyclingkarton 300g weiß für 10 mm Mappen-Füllhöhe",
      "hvid-genbrugskarton",
      "300g Hvid genbrugskarton",
      300,
      0.36,
      10,
    ],
  ];

  for (const [label, paperKey, paperLabelDa, grammageGsm, caliperMm, spineDepthMm] of cases) {
    const result = parseWmdSalesFolderMaterial(label);
    assert.equal(result.paperKey, paperKey);
    assert.equal(result.paperLabelDa, paperLabelDa);
    assert.equal(result.grammageGsm, grammageGsm);
    assert.equal(result.caliperMm, caliperMm);
    assert.equal(result.spineDepthMm, spineDepthMm);
    assert.equal(result.sourceLabel, label);
    assert.equal(result.classified, true);
  }
});

test("material parser does not mistake sheet caliper for spine depth", () => {
  const missingSpine = parseWmdSalesFolderMaterial(
    "0,40 mm starker Chromokarton 255g, hohe Steifigkeit"
  );
  assert.equal(missingSpine.caliperMm, 0.4);
  assert.equal(missingSpine.spineDepthMm, null);
  assert.deepEqual(missingSpine.unclassifiedDimensions, ["spineDepthMm"]);

  const unsupportedSpine = parseWmdSalesFolderMaterial(
    "0,40 mm starker Chromokarton 255g für 2mm Mappen-Füllhöhe"
  );
  assert.equal(unsupportedSpine.parsedSpineDepthMm, 2);
  assert.equal(unsupportedSpine.spineDepthMm, null);
  assert.equal(unsupportedSpine.classified, false);

  const unknownPaper = parseWmdSalesFolderMaterial("Spezialkarton 400g für 5mm");
  assert.equal(unknownPaper.paperKey, null);
  assert.deepEqual(unknownPaper.unclassifiedDimensions, ["paper"]);
});

test("material and price parsers preserve supplier strings byte-for-byte", () => {
  const materialLabel = "  0,40\u00a0mm starker Chromokarton 255g für 5mm  ";
  const quantityLabel = "  50\u00a0Stück (25,87 Euro)  ";
  assert.equal(parseWmdSalesFolderMaterial(materialLabel).sourceLabel, materialLabel);
  assert.equal(parseWmdSalesFolderQuantityPrice(quantityLabel).sourceLabel, quantityLabel);
});

test("quantity parser reads German thousands and total EUR while preserving supplier tokens", () => {
  assert.deepEqual(parseWmdSalesFolderQuantityPrice("1.000 Stück (1.234,56 Euro)"), {
    quantity: 1000,
    totalEur: 1234.56,
    currency: "EUR",
    sourceLabel: "1.000 Stück (1.234,56 Euro)",
    sourceQuantityToken: "1.000",
    sourceTotalEurToken: "1.234,56",
  });

  const explicitTotal = parseWmdSalesFolderQuantityPrice(
    "250 Stück – 0,79 Euro / Stück – Gesamtpreis: 197,50 EUR"
  );
  assert.equal(explicitTotal.quantity, 250);
  assert.equal(explicitTotal.totalEur, 197.5);

  const totalAndUnit = parseWmdSalesFolderQuantityPrice(
    "50 Stück (25,87 Euro / 0,52 Euro pro Stück)"
  );
  assert.equal(totalAndUnit.quantity, 50);
  assert.equal(totalAndUnit.totalEur, 25.87);

  assert.equal(parseWmdSalesFolderQuantityPrice("50 Stück (1,20 Euro / Stück)"), null);
  assert.equal(parseWmdSalesFolderQuantityPrice("keine Auflage"), null);
  assert.equal(parseWmdSalesFolderQuantityPrice("50 Stück (0,00 Euro)"), null);
});

test("normalizer accepts extractor aliases and preserves all raw supplier values", () => {
  const result = normalizeWmdSalesFolderRow(
    {
      detailUrl: BASE_SOURCE.url,
      sourceTitle: BASE_SOURCE.title,
      material: BASE_MATERIAL,
      priceLabel: "1.000 Stück (1.234,56 Euro)",
    },
    { sourceIndex: 7 }
  );

  assert.equal(result.classified, true);
  assert.equal(result.quantity, 1000);
  assert.equal(result.totalEur, 1234.56);
  assert.equal(result.currency, "EUR");
  assert.equal(result.source.index, 7);
  assert.equal(result.source.url, BASE_SOURCE.url);
  assert.equal(result.source.title, BASE_SOURCE.title);
  assert.equal(result.source.materialLabel, BASE_MATERIAL);
  assert.equal(result.source.quantityPriceLabel, "1.000 Stück (1.234,56 Euro)");
});

test("normalizer uses a validated raw spine fallback when the supplier material omits Füllhöhe", () => {
  const withoutFillHeight = "0,40 mm starker Chromokarton 255g, hohe Steifigkeit";
  const result = normalizeWmdSalesFolderRow(
    rawRow({ materialLabel: withoutFillHeight, spineDepthMm: 1 })
  );

  assert.equal(result.classified, true);
  assert.equal(result.spineDepthMm, 1);
  assert.equal(result.source.spineDepthMm, 1);
  assert.ok(!result.unclassifiedDimensions.includes("spineDepthMm"));

  const aliasResult = normalizeWmdSalesFolderRow(
    rawRow({ materialLabel: withoutFillHeight, spineMm: "3" })
  );
  assert.equal(aliasResult.classified, true);
  assert.equal(aliasResult.spineDepthMm, 3);
  assert.equal(aliasResult.source.spineDepthMm, "3");
});

test("normalizer rejects unsupported raw spine fallback and prefers valid label evidence", () => {
  const unsupported = normalizeWmdSalesFolderRow(
    rawRow({
      materialLabel: "0,40 mm starker Chromokarton 255g, hohe Steifigkeit",
      spineDepthMm: 2,
    })
  );
  assert.equal(unsupported.classified, false);
  assert.equal(unsupported.spineDepthMm, null);
  assert.ok(unsupported.unclassifiedDimensions.includes("spineDepthMm"));

  const labelWins = normalizeWmdSalesFolderRow(rawRow({ spineDepthMm: 1 }));
  assert.equal(labelWins.classified, true);
  assert.equal(labelWins.spineDepthMm, 5);
});

test("authoritative numeric supplier total wins and conflicting label evidence is quarantined", () => {
  const conflictingRawRow = rawRow({
    sourceOptionText: "50 Stück (99,90 Euro)",
    quantity: 50,
    totalEur: 97.45,
  });
  const result = normalizeWmdSalesFolderRow(conflictingRawRow);

  assert.equal(result.totalEur, 97.45);
  assert.equal(result.source.totalEur, 97.45);
  assert.equal(result.source.labelTotalEur, 99.9);
  assert.deepEqual(result.priceEvidenceMismatch, {
    authoritativeTotalEur: 97.45,
    labelTotalEur: 99.9,
    differenceEur: 2.45,
    toleranceEur: 0.01,
  });
  assert.equal(result.classified, false);
  assert.ok(result.unclassifiedDimensions.includes("priceEvidenceMismatch"));
  assert.ok(result.selectionKey?.endsWith("quantity=50"));

  const batch = normalizeWmdSalesFolderRows([conflictingRawRow]);
  assert.equal(batch.rows.length, 0);
  assert.equal(batch.unclassifiedRows.length, 1);
  assert.equal(batch.coverage.priceEvidenceMismatchRows, 1);
  assert.equal(batch.coverage.priceEvidenceMismatches[0].authoritativeTotalEur, 97.45);
  assert.equal(batch.coverage.unclassified[0].priceEvidenceMismatch.differenceEur, 2.45);
});

test("numeric API aliases are authoritative within exact-currency tolerance", () => {
  const withinTolerance = normalizeWmdSalesFolderRow(
    rawRow({
      sourceOptionText: "50 Stück (99,90 Euro)",
      quantity: 50,
      supplierPrice: 99.909,
    })
  );
  assert.equal(withinTolerance.totalEur, 99.909);
  assert.equal(withinTolerance.source.labelTotalEur, 99.9);
  assert.equal(withinTolerance.priceEvidenceMismatch, null);
  assert.equal(withinTolerance.classified, true);

  const responseAlias = normalizeWmdSalesFolderRow(
    rawRow({
      sourceOptionText: "50 Stück (88,00 Euro)",
      quantity: 50,
      supplierNetPriceEur: 88,
    })
  );
  assert.equal(responseAlias.totalEur, 88);
  assert.equal(responseAlias.source.totalEur, 88);
  assert.equal(responseAlias.priceEvidenceMismatch, null);
  assert.equal(responseAlias.classified, true);
});

test("canonical key contains every selection dimension and quantity", () => {
  const normalized = normalizeWmdSalesFolderRow(rawRow());
  assert.equal(
    normalized.selectionKey,
    "format=a4|construction=2-part-2-flaps|print=4%2B0|finish=none|paper=chromo-mappekarton|spine_mm=5|quantity=1000"
  );
  assert.equal(
    buildWmdSalesFolderSelectionKey(normalized, { includeQuantity: false }),
    "format=a4|construction=2-part-2-flaps|print=4%2B0|finish=none|paper=chromo-mappekarton|spine_mm=5"
  );
  assert.throws(
    () => buildWmdSalesFolderSelectionKey({ ...normalized, paperKey: null }),
    /Missing paper/
  );
});

test("row ordering follows supplier format order and always puts 4+0 before 4+4", () => {
  const rows = [
    normalizeWmdSalesFolderRow(
      rawRow({
        url: BASE_SOURCE.url.replace("din-a4", "din-a5").replace("40-farbig", "44-farbig"),
        title: "",
      })
    ),
    normalizeWmdSalesFolderRow(
      rawRow({ url: BASE_SOURCE.url.replace("40-farbig", "44-farbig"), title: "" })
    ),
    normalizeWmdSalesFolderRow(rawRow({ title: "" })),
  ];
  const sorted = sortWmdSalesFolderRows(rows);
  assert.deepEqual(
    sorted.map((row) => [row.formatKey, row.printMode]),
    [
      ["a4", "4+0"],
      ["a4", "4+4"],
      ["a5", "4+4"],
    ]
  );
});

test("normalization reports unclassified evidence instead of dropping it silently", () => {
  const valid = normalizeWmdSalesFolderRow(rawRow(), { sourceIndex: 0 });
  const invalid = normalizeWmdSalesFolderRow(
    rawRow({
      url: "https://www.wir-machen-druck.de/unbekannte-mappe.html",
      title: "Unbekannte Mappe",
      materialLabel: "Spezialkarton 400g",
      sourceOptionText: "Preis auf Anfrage",
    }),
    { sourceIndex: 1 }
  );
  const report = buildWmdSalesFolderCoverageReport([valid, invalid]);
  assert.equal(report.totalSourceRows, 2);
  assert.equal(report.classifiedRows, 1);
  assert.equal(report.unclassifiedRows, 1);
  assert.equal(report.coveragePct, 50);
  assert.deepEqual(report.unclassified[0].dimensions, [
    "format",
    "construction",
    "print",
    "paper",
    "spineDepthMm",
    "quantity",
    "totalEur",
  ]);
  assert.equal(report.unclassified[0].sourceIndex, 1);
});

test("batch normalization keeps only observed sparse combinations and never interpolates", () => {
  const sourceRows = [
    rawRow(),
    rawRow({
      url: BASE_SOURCE.url
        .replace("din-a4", "din-a5")
        .replace("40-farbig", "44-farbig")
        .replace("bedruckt.html", "bedruckt-mit-mattfolie-kaschiert.html"),
      title: "",
      materialLabel: "0,36 mm starker Bilderdruckkarton 350g matt für 3mm Mappen-Füllhöhe",
      sourceOptionText: "50 Stück (99,90 Euro)",
    }),
    rawRow({
      url: "https://www.wir-machen-druck.de/unbekannt.html",
      title: "",
    }),
  ];
  const result = normalizeWmdSalesFolderRows(sourceRows);
  assert.equal(result.rows.length, 2);
  assert.equal(result.unclassifiedRows.length, 1);
  assert.equal(result.coverage.totalSourceRows, 3);
  assert.equal(result.coverage.classifiedRows, 2);

  const catalog = buildWmdSalesFolderOptionCatalog(result.rows);
  assert.equal(catalog.combinations.length, 2);
  assert.equal(catalog.availableSelectionKeys.length, 2);
  assert.deepEqual(catalog.prints.map((option) => option.key), ["4+0", "4+4"]);
  assert.deepEqual(catalog.formats.map((option) => option.key), ["a4", "a5"]);
  assert.deepEqual(catalog.spineDepths.map((option) => option.spineDepthMm), [3, 5]);
  assert.ok(catalog.combinations.every((combination) => combination.quantities.length === 1));
});

test("coverage exposes duplicate exact selection+quantity keys without merging prices", () => {
  const normalized = normalizeWmdSalesFolderRow(rawRow());
  const report = buildWmdSalesFolderCoverageReport([normalized, { ...normalized }]);
  assert.equal(report.uniqueSelectionQuantities, 1);
  assert.deepEqual(report.duplicateSelectionQuantityKeys, [
    { key: normalized.selectionKey, count: 2 },
  ]);
});

test("a successful resume removes only the resolved URL from historical retry failures", () => {
  const failures = [
    { sourceUrl: "https://www.wir-machen-druck.de/a.html", error: "timeout" },
    { sourceUrl: "https://www.wir-machen-druck.de/b.html", error: "blocked" },
    { error: "malformed historical evidence" },
  ];

  assert.deepEqual(
    pruneWmdSalesFolderRetryFailures(failures, ["https://www.wir-machen-druck.de/a.html"]),
    [
      { sourceUrl: "https://www.wir-machen-druck.de/b.html", error: "blocked" },
      { error: "malformed historical evidence" },
    ],
  );
});
