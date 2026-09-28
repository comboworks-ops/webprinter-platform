import assert from "node:assert/strict";
import test from "node:test";

import {
  collectExactTemplateSelectionConstraints,
  inferTemplateConfiguration,
  inferTemplateFormat,
  isOnlineDesignerAvailableForLaunch,
  resolveSelectedDesignerTemplateLaunch,
  selectionUsesFoldedLayout,
  templateMatchesSelectedConfiguration,
  type ProductTemplateFile,
} from "./productTemplateLinks.ts";

const a4FiveMillimetreFolder: ProductTemplateFile = {
  name: "salgsmappe_A4_skabelon 5mm_ryg.pdf",
  url: "https://example.test/salgsmappe_A4_skabelon-5mm_ryg.pdf",
  designerTemplateId: "228c6131-7235-401e-b38a-78bffbdd2a14",
};

const m65SixPageRollFold: ProductTemplateFile = {
  name: "m65-3-floejet-6-sider-rullefals-skabelon.pdf",
  url: "https://example.test/m65-3-floejet-6-sider-rullefals-skabelon.pdf",
  format: "M65",
  configuration: "Rullefalset 6 sider Lodret",
  widthMm: 303,
  heightMm: 216,
  bleedMm: 3,
  safeMm: 3,
};

const m65SixPageZigzagFold: ProductTemplateFile = {
  name: "m65-3-floejet-6-sider-zigzagfalset-skabelon.pdf",
  url: "https://example.test/m65-3-floejet-6-sider-zigzagfalset-skabelon.pdf",
  format: "M65",
  configuration: "zigzag falset 6 sider Lodret",
  widthMm: 303,
  heightMm: 216,
  bleedMm: 3,
  safeMm: 3,
};

const exactFoldGeometry = {
  pages: [
    {
      page: 1,
      label: "Yderside",
      widthMm: 303,
      heightMm: 216,
      foldLines: [
        { axis: "vertical" as const, positionMm: 100 },
        { axis: "vertical" as const, positionMm: 200 },
      ],
    },
  ],
};

test("folder template constraints are inferred from the file name", () => {
  assert.equal(inferTemplateFormat(a4FiveMillimetreFolder), "A4");
  assert.equal(inferTemplateConfiguration(a4FiveMillimetreFolder), "5 mm ryg");
});

test("folder template only matches its exact format and spine", () => {
  assert.equal(
    templateMatchesSelectedConfiguration(
      a4FiveMillimetreFolder,
      "format-a4-id",
      "A4 salgsmappe",
      ["A4 salgsmappe", "5 mm ryg"],
    ),
    true,
  );
  assert.equal(
    templateMatchesSelectedConfiguration(
      a4FiveMillimetreFolder,
      "format-a5-id",
      "A5 salgsmappe",
      ["A5 salgsmappe", "5 mm ryg"],
    ),
    false,
  );
  assert.equal(
    templateMatchesSelectedConfiguration(
      a4FiveMillimetreFolder,
      "format-a4-id",
      "A4 salgsmappe",
      ["A4 salgsmappe", "1 mm ryg"],
    ),
    false,
  );
});

test("resolved launch carries the explicitly connected designer template", () => {
  assert.deepEqual(
    resolveSelectedDesignerTemplateLaunch({
      templates: [a4FiveMillimetreFolder],
      selectedFormatLabel: "A4 salgsmappe",
      selectedOptionLabels: ["A4 salgsmappe", "5 mm ryg"],
    }),
    {
      name: "salgsmappe_A4_skabelon 5mm_ryg.pdf",
      pdfUrl: "https://example.test/salgsmappe_A4_skabelon-5mm_ryg.pdf",
      templateId: "228c6131-7235-401e-b38a-78bffbdd2a14",
      widthMm: undefined,
      heightMm: undefined,
      bleedMm: undefined,
      safeMm: undefined,
    },
  );
});

test("a mismatched folder selection does not fall back to another dieline", () => {
  assert.equal(
    resolveSelectedDesignerTemplateLaunch({
      templates: [a4FiveMillimetreFolder],
      selectedFormatLabel: "A5 salgsmappe",
      selectedOptionLabels: ["A5 salgsmappe", "5 mm ryg"],
    }),
    null,
  );
});

test("structured folder constraints distinguish 4+0 from 4+4 independent of label order", () => {
  const sharedConstraints = {
    formatSection: "format-a4",
    spineSection: "spine-5mm",
  };
  const templates: ProductTemplateFile[] = [
    {
      name: "Salgsmappe A4 5 mm 4+0.pdf",
      url: "https://example.test/salgsmappe-a4-5mm-40.pdf",
      format: "A4",
      configuration: "5 mm ryg",
      selectionConstraints: {
        ...sharedConstraints,
        printSection: "print-4-0",
      },
    },
    {
      name: "Salgsmappe A4 5 mm 4+4.pdf",
      url: "https://example.test/salgsmappe-a4-5mm-44.pdf",
      format: "A4",
      configuration: "5 mm ryg",
      selection_constraints: {
        printSection: "print-4-4",
        spineSection: "spine-5mm",
        formatSection: "format-a4",
      },
    },
  ];

  assert.equal(resolveSelectedDesignerTemplateLaunch({
    templates,
    selectedFormatLabel: "A4 salgsmappe",
    selectedOptionLabels: ["4+0 udvendigt tryk", "A4", "5 mm ryg"],
    selectedSectionValues: {
      printSection: "print-4-0",
      formatSection: "format-a4",
      spineSection: "spine-5mm",
    },
  })?.pdfUrl, "https://example.test/salgsmappe-a4-5mm-40.pdf");

  assert.equal(resolveSelectedDesignerTemplateLaunch({
    templates,
    selectedFormatLabel: "A4 salgsmappe",
    selectedOptionLabels: ["5 mm ryg", "A4", "4+4 tryk på begge sider"],
    selectedSectionValues: {
      spineSection: "spine-5mm",
      printSection: "print-4-4",
      formatSection: "format-a4",
    },
  })?.pdfUrl, "https://example.test/salgsmappe-a4-5mm-44.pdf");

  assert.equal(resolveSelectedDesignerTemplateLaunch({
    templates,
    selectedFormatLabel: "A4 salgsmappe",
    selectedOptionLabels: ["A4", "5 mm ryg", "4+0"],
    selectedSectionValues: {
      formatSection: "format-a4",
      spineSection: "spine-5mm",
      printSection: "PRINT-4-0",
    },
  }), null);
});

test("structured folder templates fail closed when one required section is missing", () => {
  const template: ProductTemplateFile = {
    name: "Salgsmappe A4 5 mm 4+0.pdf",
    url: "https://example.test/salgsmappe-a4-5mm-40.pdf",
    format: "A4",
    configuration: "5 mm ryg",
    selectionConstraints: {
      formatSection: "format-a4",
      spineSection: "spine-5mm",
      printSection: "print-4-0",
    },
  };

  assert.equal(resolveSelectedDesignerTemplateLaunch({
    templates: [template],
    selectedFormatLabel: "A4 salgsmappe",
    selectedOptionLabels: ["A4", "5 mm ryg", "4+0"],
    selectedSectionValues: {
      formatSection: "format-a4",
      spineSection: "spine-5mm",
    },
  }), null);
});

test("sales-folder profile requires all five declared selection axes", () => {
  const template: ProductTemplateFile = {
    name: "Salgsmappe A4 5 mm 4+0.pdf",
    url: "https://example.test/salgsmappe-a4-5mm-40.pdf",
    selectionConstraintProfile: "sales_folder_v1",
    selectionConstraintSections: {
      folder_model: "modelSection",
      print: "printSection",
      spine: "spineSection",
      paper: "paperSection",
      finish: "finishSection",
    },
    selectionConstraints: {
      modelSection: "model-a4-two-flap",
    },
  };

  assert.equal(resolveSelectedDesignerTemplateLaunch({
    templates: [template],
    selectedOptionLabels: ["A4", "2 flapper", "4+0", "5 mm", "Mat folie"],
    selectedSectionValues: {
      modelSection: "model-a4-two-flap",
      printSection: "print-4-0",
      spineSection: "spine-5mm",
      paperSection: "paper-chromo",
      finishSection: "finish-matt",
    },
  }), null);
});

test("sales-folder profile resolves only with an exact five-axis section map", () => {
  const template: ProductTemplateFile = {
    name: "Salgsmappe A4 5 mm 4+0.pdf",
    url: "https://example.test/salgsmappe-a4-5mm-40.pdf",
    selectionConstraintProfile: "sales_folder_v1",
    selectionConstraintSections: {
      folder_model: "modelSection",
      print: "printSection",
      spine: "spineSection",
      paper: "paperSection",
      finish: "finishSection",
    },
    selectionConstraints: {
      modelSection: "model-a4-two-flap",
      printSection: "print-4-0",
      spineSection: "spine-5mm",
      paperSection: "paper-chromo",
      finishSection: "finish-matt",
    },
  };

  assert.equal(resolveSelectedDesignerTemplateLaunch({
    templates: [template],
    selectedOptionLabels: ["A4", "2 flapper", "4+0", "5 mm", "Mat folie"],
    selectedSectionValues: {
      modelSection: "model-a4-two-flap",
      printSection: "print-4-0",
      spineSection: "spine-5mm",
      paperSection: "paper-chromo",
      finishSection: "finish-matt",
    },
  })?.pdfUrl, template.url);
});

test("exact template constraints provide a deduplicated compatibility index", () => {
  const constraintSections = {
    folder_model: "modelSection",
    print: "printSection",
    spine: "spineSection",
    paper: "paperSection",
    finish: "finishSection",
  };
  const exactConstraints = {
    modelSection: "model-standard-a4",
    printSection: "print-4-0",
    spineSection: "spine-1mm",
    paperSection: "paper-chromo",
    finishSection: "finish-none",
  };
  const templates: ProductTemplateFile[] = [
    {
      name: "Standard A4.pdf",
      url: "https://example.test/standard-a4.pdf",
      selectionConstraintProfile: "sales_folder_v1",
      selectionConstraintSections: constraintSections,
      selectionConstraints: exactConstraints,
    },
    {
      name: "Duplicate binding.pdf",
      url: "https://example.test/duplicate.pdf",
      selection_constraint_profile: "sales_folder_v1",
      selection_constraint_sections: constraintSections,
      selection_constraints: { ...exactConstraints },
    },
    {
      name: "Malformed wider spine.pdf",
      url: "https://example.test/malformed.pdf",
      selectionConstraintProfile: "sales_folder_v1",
      selectionConstraintSections: constraintSections,
      selectionConstraints: {
        modelSection: "model-standard-a4",
        spineSection: "spine-3mm",
      },
    },
  ];

  assert.deepEqual(collectExactTemplateSelectionConstraints(templates), [exactConstraints]);
});

test("an exact five-axis sales-folder match does not depend on legacy display labels", () => {
  const template: ProductTemplateFile = {
    name: "Salgsmappe A4 1 mm 4+0 uden efterbehandling.pdf",
    url: "https://example.test/salgsmappe-a4-1mm-40-uden-efterbehandling.pdf",
    format: "A4 · 2-delt standardmappe",
    configuration:
      "4+0 – tryk på ydersiden · 1 mm ryg · 255g Chromo mappekarton · Ingen efterbehandling",
    selectionConstraintProfile: "sales_folder_v1",
    selectionConstraintSections: {
      folder_model: "modelSection",
      print: "printSection",
      spine: "spineSection",
      paper: "paperSection",
      finish: "finishSection",
    },
    selectionConstraints: {
      modelSection: "model-a4-standard",
      printSection: "print-4-0",
      spineSection: "spine-1mm",
      paperSection: "paper-chromo",
      finishSection: "finish-none",
    },
  };

  assert.equal(resolveSelectedDesignerTemplateLaunch({
    templates: [template],
    selectedFormatLabel: "A4 · 2-delt standardmappe",
    // The matrix summary describes the non-vertical selectors. Paper is the
    // vertical axis and is intentionally absent from these legacy labels.
    selectedOptionLabels: [
      "A4 · 2-delt standardmappe",
      "4+0 – tryk på ydersiden",
      "1 mm ryg",
      "Ingen efterbehandling",
    ],
    selectedSectionValues: {
      modelSection: "model-a4-standard",
      printSection: "print-4-0",
      spineSection: "spine-1mm",
      paperSection: "paper-chromo",
      finishSection: "finish-none",
    },
  })?.pdfUrl, template.url);
});

test("an exact spot-finish template remains downloadable but explicitly disables online design", () => {
  const template: ProductTemplateFile = {
    name: "Salgsmappe A4 5 mm med partiel UV.pdf",
    url: "https://example.test/salgsmappe-a4-5mm-partiel-uv.pdf",
    artworkMode: "professional_pdf_upload_only",
    artworkModeReasonDa: "Upload en professionel PDF med separat staffagefarve.",
    selectionConstraintProfile: "sales_folder_v1",
    selectionConstraintSections: {
      folder_model: "modelSection",
      print: "printSection",
      spine: "spineSection",
      paper: "paperSection",
      finish: "finishSection",
    },
    selectionConstraints: {
      modelSection: "model-a4-two-flap",
      printSection: "print-4-0",
      spineSection: "spine-5mm",
      paperSection: "paper-chromo",
      finishSection: "finish-partial-uv",
    },
  };

  const launch = resolveSelectedDesignerTemplateLaunch({
    templates: [template],
    selectedOptionLabels: ["A4", "2 flapper", "4+0", "5 mm", "Partiel UV"],
    selectedSectionValues: {
      modelSection: "model-a4-two-flap",
      printSection: "print-4-0",
      spineSection: "spine-5mm",
      paperSection: "paper-chromo",
      finishSection: "finish-partial-uv",
    },
  });

  assert.equal(launch?.pdfUrl, template.url);
  assert.equal(launch?.artworkMode, "professional_pdf_upload_only");
  assert.match(launch?.artworkModeReasonDa || "", /staffagefarve/i);
  assert.equal(isOnlineDesignerAvailableForLaunch(launch), false);
  assert.equal(isOnlineDesignerAvailableForLaunch(null), true);
});

test("a product with structured bindings never falls back to a legacy PDF for an unmatched selection", () => {
  const templates: ProductTemplateFile[] = [
    {
      name: "A4 5 mm 4+0 structured.pdf",
      url: "https://example.test/a4-5mm-40-structured.pdf",
      selectionConstraints: {
        formatSection: "format-a4",
        spineSection: "spine-5mm",
        printSection: "print-4-0",
      },
    },
    {
      name: "A4 5 mm legacy.pdf",
      url: "https://example.test/a4-5mm-legacy.pdf",
      format: "A4",
      configuration: "5 mm ryg",
    },
  ];

  assert.equal(resolveSelectedDesignerTemplateLaunch({
    templates,
    selectedFormatLabel: "A4 salgsmappe",
    selectedOptionLabels: ["A4", "5 mm ryg", "4+4"],
    selectedSectionValues: {
      formatSection: "format-a4",
      spineSection: "spine-5mm",
      printSection: "print-4-4",
    },
  }), null);
});

test("duplicate structured folder matches fail closed instead of choosing array order", () => {
  const selectionConstraints = {
    formatSection: "format-a4",
    spineSection: "spine-5mm",
    printSection: "print-4-0",
  };
  const templates: ProductTemplateFile[] = [
    {
      name: "First.pdf",
      url: "https://example.test/first.pdf",
      selectionConstraints,
    },
    {
      name: "Second.pdf",
      url: "https://example.test/second.pdf",
      selectionConstraints,
    },
  ];

  assert.equal(resolveSelectedDesignerTemplateLaunch({
    templates,
    selectedOptionLabels: ["A4", "5 mm ryg", "4+0"],
    selectedSectionValues: {
      printSection: "print-4-0",
      spineSection: "spine-5mm",
      formatSection: "format-a4",
    },
  }), null);
});

test("legacy format and multi-label configuration matching remains order independent", () => {
  assert.equal(resolveSelectedDesignerTemplateLaunch({
    templates: [m65SixPageRollFold],
    selectedFormatLabel: "M65",
    selectedOptionLabels: ["Lodret", "6 sider", "Matsilk", "Rullefalset", "M65"],
  })?.pdfUrl, m65SixPageRollFold.url);
});

test("sales folders, presentation folders, and spine selections use folded format guidance", () => {
  assert.equal(selectionUsesFoldedLayout("Standard salgsmappe"), true);
  assert.equal(selectionUsesFoldedLayout("Præsentationsmapper", "A4"), true);
  assert.equal(selectionUsesFoldedLayout("Tryksag", "5 mm ryg"), true);
  assert.equal(selectionUsesFoldedLayout("Flyer", "A4", "4+4"), false);
});

test("the dedicated M65 roll-fold product resolves its open-format template", () => {
  assert.deepEqual(
    resolveSelectedDesignerTemplateLaunch({
      templates: [m65SixPageRollFold],
      selectedFormatLabel: "M65",
      selectedOptionLabels: ["M65", "Matsilk", "Rullefalset", "6 sider", "Lodret", "135 g/m² bestrøget papir"],
    }),
    {
      name: "m65-3-floejet-6-sider-rullefals-skabelon.pdf",
      pdfUrl: "https://example.test/m65-3-floejet-6-sider-rullefals-skabelon.pdf",
      templateId: undefined,
      widthMm: 303,
      heightMm: 216,
      bleedMm: 3,
      safeMm: 3,
    },
  );

  assert.equal(
    resolveSelectedDesignerTemplateLaunch({
      templates: [m65SixPageRollFold],
      selectedFormatLabel: "A4",
      selectedOptionLabels: ["A4", "Matsilk", "Rullefalset", "6 sider", "Lodret"],
    }),
    null,
  );
});

test("six-page fold templates do not leak across roll-fold and zigzag selections", () => {
  assert.equal(
    resolveSelectedDesignerTemplateLaunch({
      templates: [m65SixPageRollFold, m65SixPageZigzagFold],
      selectedFormatLabel: "M65",
      selectedOptionLabels: ["M65", "Matsilk", "zigzag falset", "6 sider", "Lodret"],
    })?.pdfUrl,
    m65SixPageZigzagFold.url,
  );

  assert.equal(
    resolveSelectedDesignerTemplateLaunch({
      templates: [m65SixPageRollFold, m65SixPageZigzagFold],
      selectedFormatLabel: "M65",
      selectedOptionLabels: ["M65", "Matsilk", "Rullefalset", "8 sider", "Lodret"],
    }),
    null,
  );

  assert.equal(
    resolveSelectedDesignerTemplateLaunch({
      templates: [m65SixPageRollFold, m65SixPageZigzagFold],
      selectedFormatLabel: "M65",
      selectedOptionLabels: ["M65", "Matsilk", "Rullefalset", "6 sider", "Vandret"],
    }),
    null,
  );
});

test("resolved launch preserves reviewed fold geometry", () => {
  const result = resolveSelectedDesignerTemplateLaunch({
    templates: [{ ...m65SixPageRollFold, guideGeometry: exactFoldGeometry }],
    selectedFormatLabel: "M65",
    selectedOptionLabels: ["M65", "Rullefalset", "6 sider", "Lodret"],
  });

  assert.deepEqual(result?.guideGeometry, exactFoldGeometry);
});

test("every branded calendar filling resolves only its exact Designer template", () => {
  const reviewedPdfSha256 = "a".repeat(64);
  const fillings = [
    ["Celebrations", "15b6e3fe-d2f0-47ef-a4ec-d9392f627fb0", "celebrations"],
    ["Kinder Mini Mix", "4aef7f9c-5e19-4bb7-b8db-5b43b365a934", "kinder-mini-mix"],
    ["Milka Favourites", "dbbe6d6f-1d6a-402f-b19c-bae667c61889", "milka-favourites"],
    ["Merci Petits", "77c6d2b5-cd30-495c-86bc-6ce2d45fefca", "merci-petits"],
    ["Toblerone Mix", "8e6531e6-d983-43d3-944d-9dbae82c0cab", "toblerone-mix"],
    ["Lindt HELLO Mini Sticks", "e925330b-33a2-4d11-8a6e-b62a163809e5", "lindt-hello-mini-sticks"],
    ["Lindt Lindor-kugler", "396c97a6-5541-4bcf-874d-08943f936d08", "lindt-lindor-balls"],
    ["Ritter Sport-chokoladeterninger", "add71944-ad59-4de7-89ae-7fbff825e26d", "ritter-sport-cubes"],
  ] as const;
  const templates: ProductTemplateFile[] = fillings.map(([label, templateId, key]) => ({
    name: `Julekalender Multi - ${label}`,
    url: `https://example.test/julekalender-multi-${key}-tryk-skabelon.pdf`,
    format: "412 × 307 mm",
    configuration: label,
    designerTemplateId: templateId,
    designerLoadMode: "locked_non_printing_guide_overlay",
    lockedInDesigner: true,
    nonPrintingOverlay: true,
    excludedFromExport: true,
    templatePdfSha256: reviewedPdfSha256,
    widthMm: 411.999,
    heightMm: 307,
    bleedMm: 0,
    safeMm: 2,
  }));

  fillings.forEach(([label, templateId, key]) => {
    const launch = resolveSelectedDesignerTemplateLaunch({
      templates,
      selectedFormatLabel: "412 × 307 mm",
      selectedOptionLabels: ["300 g/m² GC1-karton", label],
    });

    assert.equal(launch?.templateId, templateId);
    assert.equal(launch?.pdfUrl, `https://example.test/julekalender-multi-${key}-tryk-skabelon.pdf`);
    assert.equal(launch?.templatePdfSha256, reviewedPdfSha256);
  });

  assert.equal(resolveSelectedDesignerTemplateLaunch({
    templates,
    selectedFormatLabel: "412 × 307 mm",
    selectedOptionLabels: ["300 g/m² GC1-karton", "Ukendt fyld"],
  }), null);
});
