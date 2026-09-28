#!/usr/bin/env node

import "dotenv/config";

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
export const TARGET_SLUG = "julekalendere-med-eget-design";
export const TARGET_SOURCE_KEY = "wmd-advent-calendars-consolidated-2026";
export const DEFAULT_RUN_DIR = path.resolve(
  process.cwd(),
  "tmp/supplier-imports/wmd-advent-calendars-20260826T084700Z",
);

const EXPECTED = Object.freeze({
  models: 14,
  variants: 30,
  prices: 514,
  documents: 28,
  verifiedRuntimeProofs: 2,
  pendingRuntimeProofs: 26,
});

const GROUP_DEFINITIONS = Object.freeze([
  {
    key: "calendar_model",
    name: "Kalendermodel",
    kind: "material",
    uiMode: "buttons",
    sortOrder: 0,
  },
  {
    key: "variant",
    name: "Variant",
    kind: "format",
    uiMode: "dropdown",
    sortOrder: 1,
  },
  {
    key: "technical_product",
    name: "Teknisk produkt",
    kind: "other",
    uiMode: "buttons",
    sortOrder: 2,
  },
]);

const MODEL_SECTION_ID = "calendar-model-section";
const VARIANT_SECTION_ID = "calendar-variant-section";
const TECHNICAL_AXIS_ID = "calendar-technical-axis";
const IMPORTED_MODEL_IMAGE_PX = 176;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeForMatch(value) {
  return normalize(value).toLocaleLowerCase("da-DK");
}

function slugify(value) {
  return normalize(value)
    .toLocaleLowerCase("da-DK")
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "valg";
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256Json(value) {
  return sha256Buffer(Buffer.from(stableJson(value)));
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sourceSelectionSignature(selections) {
  return stableJson(
    Object.fromEntries(
      Object.entries(selections || {})
        .map(([key, value]) => [normalize(key), normalize(value)])
        .sort(([left], [right]) => left.localeCompare(right, "da")),
    ),
  );
}

function matchesDocument(selections, document) {
  const entries = Object.entries(document.match || {});
  return entries.length > 0 && entries.every(
    ([key, value]) => normalizeForMatch(selections?.[key]) === normalizeForMatch(value),
  );
}

function findValueForSelection(group, selectedLabel, familySlug) {
  const selected = normalizeForMatch(selectedLabel);
  const matches = (group.values || []).filter((value) => (
    normalizeForMatch(value.labelDa) === selected
    || normalizeForMatch(value.labelOriginal) === selected
  ));
  assert(
    matches.length === 1,
    `${familySlug}: expected one ${group.key} value for '${selectedLabel}', found ${matches.length}`,
  );
  return matches[0];
}

function buildVariantLabel(manifest, selections) {
  const varyingGroups = manifest.optionGroups.filter((group) => group.values.length > 1);
  const displayGroups = varyingGroups.length > 0
    ? varyingGroups
    : [manifest.optionGroups.find((group) => group.key === "filling")
      || manifest.optionGroups.find((group) => group.key === "format")
      || manifest.optionGroups[0]];

  return displayGroups
    .filter(Boolean)
    .map((group) => normalize(selections[group.key]))
    .filter(Boolean)
    .join(" · ");
}

function buildVariantOriginalLabel(manifest, selections) {
  const varyingGroups = manifest.optionGroups.filter((group) => group.values.length > 1);
  const displayGroups = varyingGroups.length > 0
    ? varyingGroups
    : [manifest.optionGroups.find((group) => group.key === "filling")
      || manifest.optionGroups.find((group) => group.key === "format")
      || manifest.optionGroups[0]];

  return displayGroups
    .filter(Boolean)
    .map((group) => {
      const value = findValueForSelection(group, selections[group.key], manifest.product.slugDa);
      return normalize(value.labelOriginal || value.labelDa);
    })
    .filter(Boolean)
    .join(" · ");
}

function buildVariantKey(manifest, selections) {
  const parts = manifest.optionGroups.map((group) => (
    findValueForSelection(group, selections[group.key], manifest.product.slugDa).key
  ));
  return `${manifest.product.slugDa}--${parts.map(slugify).join("--")}`;
}

function uniqueOptionLabels(manifest, groupKey) {
  const group = manifest.optionGroups.find((item) => item.key === groupKey);
  return Array.from(new Set(
    (group?.values || [])
      .map((value) => normalize(value.labelDa || value.labelOriginal))
      .filter(Boolean),
  ));
}

function buildModelDetails(manifest) {
  const originalCopy = normalize(manifest.product?.descriptionOriginal);
  return {
    descriptionDa: normalize(manifest.product?.descriptionDa),
    formatLabels: uniqueOptionLabels(manifest, "format"),
    materialLabels: uniqueOptionLabels(manifest, "material"),
    fillingLabels: uniqueOptionLabels(manifest, "filling"),
    packagingLabels: uniqueOptionLabels(manifest, "packaging"),
    printLabelDa: /4\s*\/\s*0(?:-farbig|\s+farbig)/i.test(originalCopy)
      ? "4/0-farvet tryk"
      : null,
  };
}

function variantPresentationKind(sourceValueKeys) {
  if (sourceValueKeys?.filling) return "filling";
  if (sourceValueKeys?.format) return "format";
  return "variant";
}

export function loadCalendarFamilies(runDir = DEFAULT_RUN_DIR) {
  const familiesDir = path.join(runDir, "families");
  const indexPath = path.join(familiesDir, "index.json");
  assert(fs.existsSync(indexPath), `Missing calendar family index: ${indexPath}`);
  const index = readJson(indexPath);
  const indexedProducts = Array.isArray(index.products) ? index.products : [];
  assert(
    indexedProducts.length === EXPECTED.models,
    `Expected ${EXPECTED.models} indexed calendar families, found ${indexedProducts.length}`,
  );

  const seenSlugs = new Set();
  const families = indexedProducts.map((entry, sourceOrder) => {
    const slug = normalize(entry.slug);
    assert(slug && !seenSlugs.has(slug), `Duplicate or empty indexed calendar slug '${slug}'`);
    seenSlugs.add(slug);

    const familyDir = path.join(familiesDir, slug);
    const manifestPath = path.join(familyDir, "import-manifest.json");
    assert(fs.existsSync(manifestPath), `Missing family manifest: ${manifestPath}`);
    const manifest = readJson(manifestPath);
    assert(manifest.product?.slugDa === slug, `${slug}: manifest slug does not match index`);
    assert(
      manifest.target?.publishProduct === false && manifest.target?.writeLivePricing === false,
      `${slug}: source manifest mutation safeguards are not locked`,
    );
    assert(
      isUuid(manifest.artifacts?.webprinterDraft?.productId),
      `${slug}: missing existing Webprinter source product id`,
    );

    const heroPath = path.join(familyDir, "visual", "hero.png");
    assert(fs.existsSync(heroPath), `${slug}: missing family hero visual`);
    for (const document of manifest.documents || []) {
      assert(
        isUuid(document.template?.designerTemplateId),
        `${slug}/${document.key}: missing existing Designer template id`,
      );
      const pdfPath = path.join(familyDir, document.template.sanitizedPdfPath || "");
      assert(fs.existsSync(pdfPath), `${slug}/${document.key}: missing sanitized PDF`);
      const expectedHash = normalizeForMatch(document.template.sanitizedPdfSha256);
      assert(/^[a-f0-9]{64}$/.test(expectedHash), `${slug}/${document.key}: invalid PDF SHA-256`);
      assert(sha256File(pdfPath) === expectedHash, `${slug}/${document.key}: PDF SHA-256 mismatch`);
    }

    return {
      sourceOrder,
      familyDir,
      manifestPath,
      manifest,
      heroPath,
    };
  });

  assert(
    families.reduce((sum, family) => sum + family.manifest.pricing.records.length, 0) === EXPECTED.prices,
    `Source family price count must be ${EXPECTED.prices}`,
  );
  assert(
    families.reduce((sum, family) => sum + family.manifest.documents.length, 0) === EXPECTED.documents,
    `Source family document count must be ${EXPECTED.documents}`,
  );

  return { index, indexPath, families };
}

export function buildCombinedCalendarModel({ index, families, generatedAt = new Date().toISOString() }) {
  const modelValues = [];
  const variantValues = [];
  const combinedRecords = [];
  const combinedDocuments = [];
  const sourceManifests = [];
  const sourceRuntimeProofAudit = { verified: 0, pending: 0, total: 0 };
  let globalPriceOrder = 0;
  let globalVariantOrder = 0;

  for (const family of families) {
    const { manifest, sourceOrder: modelOrder } = family;
    const modelKey = manifest.product.slugDa;
    const sourceProductId = manifest.artifacts.webprinterDraft.productId;
    const modelVisualPath = `visual/models/${modelKey}.png`;
    const uniqueSelections = new Map();

    for (const record of manifest.pricing.records) {
      const signature = sourceSelectionSignature(record.selections);
      if (!uniqueSelections.has(signature)) uniqueSelections.set(signature, clone(record.selections));
    }

    const familyVariants = [];
    for (const selections of uniqueSelections.values()) {
      const matchingDocuments = manifest.documents.filter((document) => matchesDocument(selections, document));
      assert(
        matchingDocuments.length === 1,
        `${modelKey}: expected one template for ${sourceSelectionSignature(selections)}, found ${matchingDocuments.length}`,
      );
      const document = matchingDocuments[0];
      const variantKey = buildVariantKey(manifest, selections);
      const technicalTemplateVariant = `${modelKey}--${document.key}`;
      const valueKeys = Object.fromEntries(manifest.optionGroups.map((group) => [
        group.key,
        findValueForSelection(group, selections[group.key], modelKey).key,
      ]));
      const variant = {
        key: variantKey,
        labelOriginal: buildVariantOriginalLabel(manifest, selections),
        labelDa: buildVariantLabel(manifest, selections),
        sourceOrder: globalVariantOrder++,
        modelKey,
        technicalTemplateVariant,
      linkedTemplateId: document.template.designerTemplateId,
      sourceSelections: clone(selections),
      sourceValueKeys: valueKeys,
      presentationKind: variantPresentationKind(valueKeys),
      };
      variantValues.push(variant);
      familyVariants.push(variant);
    }

    modelValues.push({
      key: modelKey,
      labelOriginal: manifest.product.nameOriginal,
      labelDa: manifest.product.nameDa,
      sourceOrder: modelOrder,
      sourceProductId,
      sourceProductSlug: modelKey,
      compatibleVariantKeys: familyVariants.map((variant) => variant.key),
      details: buildModelDetails(manifest),
      visual: {
        referenceUrl: manifest.source.entryUrl,
        assetPath: modelVisualPath,
        styleKey: "print_material_realistic",
        transparent: false,
        status: "clean_white_background_draft",
        supplierBrandingRemoved: true,
      },
    });

    const variantBySourceSignature = new Map(
      familyVariants.map((variant) => [sourceSelectionSignature(variant.sourceSelections), variant]),
    );
    for (const sourceRecord of manifest.pricing.records) {
      const variant = variantBySourceSignature.get(sourceSelectionSignature(sourceRecord.selections));
      assert(variant, `${modelKey}: missing combined variant for source row ${sourceRecord.sourceOrder}`);
      combinedRecords.push({
        sourceOrder: globalPriceOrder++,
        quantity: sourceRecord.quantity,
        supplierPrice: sourceRecord.supplierPrice,
        convertedPriceDkk: sourceRecord.convertedPriceDkk,
        finalPriceDkk: sourceRecord.finalPriceDkk,
        sourceUrl: sourceRecord.sourceUrl,
        selections: {
          calendar_model: modelKey,
          variant: variant.key,
          technical_product: "julekalender",
          technical_template_variant: variant.technicalTemplateVariant,
        },
        sourceFamilySlug: modelKey,
        sourceProductId,
        sourceRecord: clone(sourceRecord),
      });
    }

    for (const document of manifest.documents) {
      const auditedRuntimeStatus = document.template?.designerVerification?.status === "verified"
        ? "verified"
        : "pending";
      sourceRuntimeProofAudit[auditedRuntimeStatus] += 1;
      sourceRuntimeProofAudit.total += 1;
      const technicalTemplateVariant = `${modelKey}--${document.key}`;
      const applicableVariants = familyVariants.filter(
        (variant) => variant.technicalTemplateVariant === technicalTemplateVariant,
      );
      assert(applicableVariants.length > 0, `${modelKey}/${document.key}: template has no compatible variant`);
      const copiedPdfPath = `documents/${modelKey}--${path.basename(document.template.sanitizedPdfPath)}`;
      const inspectionFile = document.template.inspectionPath
        ? `${modelKey}--${path.basename(document.template.inspectionPath)}`
        : null;
      combinedDocuments.push({
        key: technicalTemplateVariant,
        match: {
          calendar_model: modelKey,
          technical_template_variant: technicalTemplateVariant,
        },
        applicableVariantKeys: applicableVariants.map((variant) => variant.key),
        guide: clone(document.guide),
        template: {
          ...clone(document.template),
          sanitizedPdfPath: copiedPdfPath,
          ...(inspectionFile ? { inspectionPath: `documents/inspections/${inspectionFile}` } : {}),
          designerVerification: {
            status: "pending",
            evidencePath: null,
          },
        },
        source: {
          familySlug: modelKey,
          documentKey: document.key,
          sourceMatch: clone(document.match),
          sourcePdfPath: document.template.sanitizedPdfPath,
          sourceInspectionPath: document.template.inspectionPath || null,
          designerVerificationAudit: clone(document.template.designerVerification || {
            status: "pending",
            evidencePath: null,
          }),
        },
      });
    }

    sourceManifests.push({
      familySlug: modelKey,
      sourceProductId,
      sourceKey: manifest.product.sourceKey,
      runId: manifest.runId,
      manifestPath: path.relative(path.dirname(family.manifestPath), family.manifestPath),
      priceRows: manifest.pricing.records.length,
      documents: manifest.documents.length,
      manifestSha256: sha256File(family.manifestPath),
    });
  }

  const supplierCurrency = families[0].manifest.pricing.supplierCurrency;
  const vatState = families[0].manifest.pricing.vatState;
  const conversionRuleKey = families[0].manifest.pricing.conversionRuleKey;
  for (const family of families) {
    assert(family.manifest.pricing.supplierCurrency === supplierCurrency, "Source currencies differ");
    assert(family.manifest.pricing.vatState === vatState, "Source VAT states differ");
    assert(
      family.manifest.pricing.conversionRuleKey === conversionRuleKey,
      "Source conversion rules differ",
    );
  }

  const manifest = {
    schemaVersion: 2,
    runId: `${families[0].manifest.runId}-consolidated-v1`,
    generatedAt,
    source: {
      supplierSlug: "wir-machen-druck",
      entryUrl: index.sourceCategoryUrl || families[0].manifest.source.entryUrl,
      scopeMode: "single_product_family",
      allowedHosts: clone(families[0].manifest.source.allowedHosts),
      extractor: "verified_run_local_manifest_consolidation",
      capturedAt: index.capturedAt || families[0].manifest.source.capturedAt,
      sourceManifests,
    },
    product: {
      sourceKey: TARGET_SOURCE_KEY,
      family: "packaging",
      slugDa: TARGET_SLUG,
      nameOriginal: "Individuelle Adventskalender",
      nameDa: "Julekalendere med eget design",
      descriptionOriginal:
        "Individuell bedruckte Adventskalender in mehreren Modellen mit kompatibler Füllung oder Ausführung.",
      descriptionDa:
        "Vælg først den julekalendermodel, du ønsker, og vælg derefter kun blandt de chokolader, fyld eller varianter, der passer til modellen. Alle modeller kan tilpasses med eget design.",
      sourceLanguage: "de",
      targetLanguage: "da",
    },
    optionGroups: [
      {
        key: "calendar_model",
        labelOriginal: "Kalendermodell",
        labelDa: "Kalendermodel",
        displayType: "buttons",
        sourceOrder: 0,
        values: modelValues,
      },
      {
        key: "variant",
        labelOriginal: "Füllung oder Ausführung",
        labelDa: "Chokolade, fyld eller variant",
        displayType: "dropdown",
        sourceOrder: 1,
        dependentOn: "calendar_model",
        hideUnavailableValues: true,
        values: variantValues,
      },
      {
        key: "technical_product",
        labelOriginal: "Technisches Produkt",
        labelDa: "Teknisk produkt",
        displayType: "buttons",
        sourceOrder: 2,
        hiddenFromCustomerChoice: true,
        values: [
          {
            key: "julekalender",
            labelOriginal: "Adventskalender",
            labelDa: "Julekalender",
            sourceOrder: 0,
          },
        ],
      },
    ],
    pricing: {
      supplierCurrency,
      vatState,
      conversionRuleKey,
      sourcePriceFingerprint: sha256Json(
        families.flatMap((family) => family.manifest.pricing.records.map((record) => ({
          family: family.manifest.product.slugDa,
          record,
        }))),
      ),
      records: combinedRecords,
    },
    documents: combinedDocuments,
    templateBindingAxes: ["calendar_model", "technical_template_variant"],
    storefront: {
      category: "Julekalendere",
      pricingType: "matrix",
      isPublished: false,
      isAvailableToTenants: true,
      layout: {
        verticalAxis: "technical_product",
        primaryChoice: "calendar_model",
        primaryChoiceUiMode: "xl",
        dependentChoice: "variant",
        dependentChoiceUiMode: "dropdown",
        hideUnavailableValues: true,
        hideUnavailableQuantities: true,
      },
    },
    verification: {
      status: "verification_draft",
      structuralPdfTemplates: "verified",
      designerRuntimeProofs: {
        verified: 0,
        pending: combinedDocuments.length,
        total: combinedDocuments.length,
        evidencePolicy: "schema_v2_evidence_must_be_recaptured_for_the_combined_product",
      },
      sourceDesignerRuntimeProofAudit: sourceRuntimeProofAudit,
      modelVisuals: {
        transparent: false,
        status: "clean_white_background_draft",
        publishReplacementRequired: true,
      },
    },
    target: {
      mode: "supplier_bank",
      state: "extracted",
      publishProduct: false,
      writeLivePricing: false,
      writeRequiresFlag: "--write-unpublished-product",
      sourceProductsProtected: true,
    },
    artifacts: {
      rawSnapshot: "raw/source-manifests.json",
      normalizedPricing: "normalized/pricing.jsonl",
      compatibilityMatrix: "review/compatibility.json",
      reviewReport: "review/report.md",
    },
  };

  return { manifest, families };
}

export function validateCombinedCalendarModel({ manifest, families }) {
  const modelGroup = manifest.optionGroups.find((group) => group.key === "calendar_model");
  const variantGroup = manifest.optionGroups.find((group) => group.key === "variant");
  const technicalGroup = manifest.optionGroups.find((group) => group.key === "technical_product");
  assert(manifest.schemaVersion === 2, "Combined manifest schemaVersion must be 2");
  assert(modelGroup?.values.length === EXPECTED.models, `Expected ${EXPECTED.models} model choices`);
  assert(variantGroup?.values.length === EXPECTED.variants, `Expected ${EXPECTED.variants} variants`);
  assert(technicalGroup?.values.length === 1, "Expected one technical vertical-axis value");
  assert(manifest.pricing.records.length === EXPECTED.prices, `Expected ${EXPECTED.prices} prices`);
  assert(manifest.documents.length === EXPECTED.documents, `Expected ${EXPECTED.documents} templates`);
  assert(
    manifest.verification.sourceDesignerRuntimeProofAudit.verified === EXPECTED.verifiedRuntimeProofs,
    `Expected ${EXPECTED.verifiedRuntimeProofs} verified Designer runtime proofs`,
  );
  assert(
    manifest.verification.sourceDesignerRuntimeProofAudit.pending === EXPECTED.pendingRuntimeProofs,
    `Expected ${EXPECTED.pendingRuntimeProofs} pending Designer runtime proofs`,
  );

  [modelGroup.values, variantGroup.values, manifest.pricing.records].forEach((items, collectionIndex) => {
    items.forEach((item, index) => {
      assert(
        item.sourceOrder === index,
        `Collection ${collectionIndex} sourceOrder must be contiguous; expected ${index}, got ${item.sourceOrder}`,
      );
    });
  });

  const modelsByKey = new Map(modelGroup.values.map((value) => [value.key, value]));
  const variantsByKey = new Map(variantGroup.values.map((value) => [value.key, value]));
  assert(modelsByKey.size === EXPECTED.models, "Model keys must be unique");
  assert(variantsByKey.size === EXPECTED.variants, "Variant keys must be unique");

  const axes = manifest.templateBindingAxes;
  assert(
    stableJson(axes) === stableJson(["calendar_model", "technical_template_variant"]),
    "Template axes must be calendar_model + technical_template_variant",
  );
  const documentsBySignature = new Map();
  const templateIds = new Set();
  for (const document of manifest.documents) {
    assert(
      document.template.designerVerification?.status === "pending"
      && document.template.designerVerification?.evidencePath === null,
      `${document.key}: schema-v2 Designer verification must be pending with no inherited evidence`,
    );
    assert(
      stableJson(Object.keys(document.match).sort()) === stableJson([...axes].sort()),
      `${document.key}: document match must contain exactly both template axes`,
    );
    const signature = stableJson(axes.map((axis) => [axis, document.match[axis]]));
    assert(!documentsBySignature.has(signature), `${document.key}: duplicate template binding`);
    documentsBySignature.set(signature, document);
    assert(isUuid(document.template.designerTemplateId), `${document.key}: invalid Designer template id`);
    assert(!templateIds.has(document.template.designerTemplateId), `${document.key}: duplicate template id`);
    templateIds.add(document.template.designerTemplateId);
    assert(
      /^[a-f0-9]{64}$/i.test(document.template.sanitizedPdfSha256),
      `${document.key}: missing PDF hash`,
    );
  }

  const rowSignatures = new Set();
  const usedDocumentKeys = new Set();
  for (const record of manifest.pricing.records) {
    const { calendar_model: modelKey, variant: variantKey, technical_template_variant: technicalKey } = record.selections;
    const model = modelsByKey.get(modelKey);
    const variant = variantsByKey.get(variantKey);
    assert(model, `Price row ${record.sourceOrder}: unknown model '${modelKey}'`);
    assert(variant, `Price row ${record.sourceOrder}: unknown variant '${variantKey}'`);
    assert(variant.modelKey === modelKey, `Price row ${record.sourceOrder}: incompatible model/variant`);
    assert(
      variant.technicalTemplateVariant === technicalKey,
      `Price row ${record.sourceOrder}: wrong technical template variant`,
    );
    const documentSignature = stableJson(axes.map((axis) => [axis, record.selections[axis]]));
    const document = documentsBySignature.get(documentSignature);
    assert(document, `Price row ${record.sourceOrder}: missing exact template binding`);
    assert(
      document.applicableVariantKeys.includes(variantKey),
      `Price row ${record.sourceOrder}: template is not compatible with variant`,
    );
    assert(
      variant.linkedTemplateId === document.template.designerTemplateId,
      `Price row ${record.sourceOrder}: linked Designer template differs`,
    );
    usedDocumentKeys.add(document.key);

    const rowSignature = stableJson([modelKey, variantKey, Number(record.quantity)]);
    assert(!rowSignatures.has(rowSignature), `Duplicate price identity at row ${record.sourceOrder}`);
    rowSignatures.add(rowSignature);

    for (const priceKey of ["quantity", "supplierPrice", "convertedPriceDkk", "finalPriceDkk", "sourceUrl"]) {
      assert(
        stableJson(record[priceKey]) === stableJson(record.sourceRecord[priceKey]),
        `Price row ${record.sourceOrder}: ${priceKey} differs from source evidence`,
      );
    }
    assert(
      stableJson(record.sourceRecord.selections) === stableJson(
        families.find((family) => family.manifest.product.slugDa === record.sourceFamilySlug)
          ?.manifest.pricing.records.find((source) => (
            source.sourceOrder === record.sourceRecord.sourceOrder
            && sourceSelectionSignature(source.selections) === sourceSelectionSignature(record.sourceRecord.selections)
          ))?.selections,
      ),
      `Price row ${record.sourceOrder}: original selections were not preserved`,
    );
  }
  assert(usedDocumentKeys.size === EXPECTED.documents, "Every template must cover at least one price row");

  for (const variant of variantGroup.values) {
    const model = modelsByKey.get(variant.modelKey);
    assert(model?.compatibleVariantKeys.includes(variant.key), `${variant.key}: model compatibility is missing`);
    const matchingDocuments = manifest.documents.filter((document) => (
      document.match.calendar_model === variant.modelKey
      && document.match.technical_template_variant === variant.technicalTemplateVariant
    ));
    assert(matchingDocuments.length === 1, `${variant.key}: expected exactly one Designer template`);
  }

  const premiumWallVariants = variantGroup.values.filter(
    (variant) => variant.modelKey === "premium-vaegjulekalender",
  );
  assert(premiumWallVariants.length === 4, "Premium wall calendar must expose four customer variants");
  assert(
    new Set(premiumWallVariants.map((variant) => variant.technicalTemplateVariant)).size === 2,
    "Premium wall packaging variants must share the two orientation templates",
  );

  return {
    models: modelGroup.values.length,
    variants: variantGroup.values.length,
    prices: manifest.pricing.records.length,
    documents: manifest.documents.length,
    uniquePriceRows: rowSignatures.size,
    uniqueTemplateIds: templateIds.size,
    auditedVerifiedRuntimeProofs: manifest.verification.sourceDesignerRuntimeProofAudit.verified,
    auditedPendingRuntimeProofs: manifest.verification.sourceDesignerRuntimeProofAudit.pending,
    canonicalPendingRuntimeProofs: manifest.verification.designerRuntimeProofs.pending,
  };
}

function copyVerified(sourcePath, targetPath, expectedSha256 = null) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  const sourceHash = sha256File(sourcePath);
  const targetHash = sha256File(targetPath);
  assert(sourceHash === targetHash, `Copy verification failed for ${targetPath}`);
  if (expectedSha256) {
    assert(targetHash === normalizeForMatch(expectedSha256), `Expected hash differs for ${targetPath}`);
  }
  return targetHash;
}

function buildCompatibilityReview(manifest) {
  const models = manifest.optionGroups.find((group) => group.key === "calendar_model").values;
  const variants = manifest.optionGroups.find((group) => group.key === "variant").values;
  return {
    schemaVersion: 1,
    generatedAt: manifest.generatedAt,
    productSlug: manifest.product.slugDa,
    models: models.map((model) => ({
      key: model.key,
      nameDa: model.labelDa,
      sourceProductId: model.sourceProductId,
      variants: model.compatibleVariantKeys.map((variantKey) => {
        const variant = variants.find((item) => item.key === variantKey);
        return {
          key: variant.key,
          labelDa: variant.labelDa,
          technicalTemplateVariant: variant.technicalTemplateVariant,
          designerTemplateId: variant.linkedTemplateId,
          quantityCount: new Set(
            manifest.pricing.records
              .filter((record) => record.selections.variant === variant.key)
              .map((record) => record.quantity),
          ).size,
          priceRows: manifest.pricing.records.filter(
            (record) => record.selections.variant === variant.key,
          ).length,
        };
      }),
    })),
  };
}

function buildReviewReport(manifest, validation) {
  const compatibility = buildCompatibilityReview(manifest);
  const lines = [
    "# Samlet julekalenderprodukt – importkontrol",
    "",
    `- Produkt: ${manifest.product.nameDa} (\`${manifest.product.slugDa}\`)`,
    `- Kalendermodeller: ${validation.models}`,
    `- Kompatible kundevarianter: ${validation.variants}`,
    `- Prisrækker bevaret 1:1: ${validation.prices}`,
    `- Eksakte PDF-/Designer-bindinger: ${validation.documents}`,
    `- Tidligere kilde-audit med Designer-runtime bekræftet: ${validation.auditedVerifiedRuntimeProofs}`,
    `- Tidligere kilde-audit med Designer-runtime afventende: ${validation.auditedPendingRuntimeProofs}`,
    `- Schema-v2 beviser, der skal genoptages for det samlede produkt: ${validation.canonicalPendingRuntimeProofs}`,
    "- Modelbilleder: rene billeder på hvid baggrund; ægte transparente erstatninger kræves før publicering",
    "- Publicering: nej",
    "- Eksisterende produkter ændres eller udfases: nej",
    "",
    "## Valgstruktur",
    "",
    "Kalendermodel vises som det store billedvalg. Derefter vises kun modellens kompatible chokolade, fyld eller udførelse i dropdown-menuen. Antal uden gyldig pris skjules.",
    "",
    "## Modeller",
    "",
  ];
  for (const model of compatibility.models) {
    lines.push(`- ${model.nameDa}: ${model.variants.length} variant(er), ${model.variants.reduce((sum, item) => sum + item.priceRows, 0)} prisrækker`);
  }
  lines.push(
    "",
    "## Sikkerhed",
    "",
    "Pakken er i `extracted`-tilstand. En eventuel databaseskrivning kræver det eksplicitte flag `--write-unpublished-product`, opretter kun et upubliceret verifikationsudkast og genbruger eksisterende billeder, Designer-skabeloner og PDF-URL'er. De 14 kildeprodukter ændres ikke.",
    "",
  );
  return lines.join("\n");
}

export function materializeCombinedCalendarPackage({ manifest, families, outputDir }) {
  const validation = validateCombinedCalendarModel({ manifest, families });
  fs.mkdirSync(outputDir, { recursive: true });

  const familyBySlug = new Map(families.map((family) => [family.manifest.product.slugDa, family]));
  for (const model of manifest.optionGroups.find((group) => group.key === "calendar_model").values) {
    const family = familyBySlug.get(model.key);
    copyVerified(family.heroPath, path.join(outputDir, model.visual.assetPath));
  }
  for (const document of manifest.documents) {
    const family = familyBySlug.get(document.source.familySlug);
    const sourcePdfPath = path.join(family.familyDir, document.source.sourcePdfPath);
    copyVerified(
      sourcePdfPath,
      path.join(outputDir, document.template.sanitizedPdfPath),
      document.template.sanitizedPdfSha256,
    );
    if (document.source.sourceInspectionPath) {
      const sourceInspectionPath = path.join(family.familyDir, document.source.sourceInspectionPath);
      assert(fs.existsSync(sourceInspectionPath), `${document.key}: missing source PDF inspection`);
      copyVerified(sourceInspectionPath, path.join(outputDir, document.template.inspectionPath));
    }
  }

  writeJson(
    path.join(outputDir, manifest.artifacts.rawSnapshot),
    {
      schemaVersion: 1,
      generatedAt: manifest.generatedAt,
      sourceManifests: families.map((family) => ({
        familySlug: family.manifest.product.slugDa,
        manifestPath: family.manifestPath,
        manifestSha256: sha256File(family.manifestPath),
        manifest: family.manifest,
      })),
    },
  );
  const pricingPath = path.join(outputDir, manifest.artifacts.normalizedPricing);
  fs.mkdirSync(path.dirname(pricingPath), { recursive: true });
  fs.writeFileSync(
    pricingPath,
    `${manifest.pricing.records.map((record) => JSON.stringify(record)).join("\n")}\n`,
  );
  writeJson(path.join(outputDir, manifest.artifacts.compatibilityMatrix), buildCompatibilityReview(manifest));
  const reportPath = path.join(outputDir, manifest.artifacts.reviewReport);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${buildReviewReport(manifest, validation)}\n`);
  writeJson(path.join(outputDir, "import-manifest.json"), manifest);

  return {
    outputDir,
    manifestPath: path.join(outputDir, "import-manifest.json"),
    reportPath,
    ...validation,
  };
}

export function buildCombinedCalendarPackage({
  runDir = DEFAULT_RUN_DIR,
  outputDir = path.join(runDir, "combined", TARGET_SLUG),
  materialize = true,
  generatedAt,
} = {}) {
  const loaded = loadCalendarFamilies(runDir);
  const model = buildCombinedCalendarModel({ ...loaded, generatedAt });
  const validation = validateCombinedCalendarModel(model);
  if (!materialize) return { ...model, validation, outputDir };
  const artifacts = materializeCombinedCalendarPackage({ ...model, outputDir });
  return { ...model, validation, outputDir, artifacts };
}

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(url && serviceRoleKey, "SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required");
  return { url, serviceRoleKey };
}

async function requireQuery(query, label) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

function chunk(values, size = 250) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
  return chunks;
}

function templateFileDesignerId(templateFile) {
  return normalize(
    templateFile?.designerTemplateId
    || templateFile?.designer_template_id
    || templateFile?.templateId
    || templateFile?.template_id,
  );
}

function templateFilePdfUrl(templateFile, templateRow) {
  return normalize(
    templateFile?.pdfUrl
    || templateFile?.url
    || templateFile?.fileUrl
    || templateFile?.downloadUrl
    || templateRow?.template_pdf_url,
  );
}

async function captureDatabaseState(client, { manifest, outputDir }) {
  const modelValues = manifest.optionGroups.find((group) => group.key === "calendar_model").values;
  const sourceProductIds = modelValues.map((model) => model.sourceProductId);
  const templateIds = manifest.documents.map((document) => document.template.designerTemplateId);

  const [sourceProducts, sourceGroups, sourceValues, sourcePrices, templates, targetProduct] = await Promise.all([
    requireQuery(
      client.from("products").select("*").eq("tenant_id", MASTER_TENANT_ID).in("id", sourceProductIds),
      "Read source products",
    ),
    requireQuery(
      client.from("product_attribute_groups").select("*").eq("tenant_id", MASTER_TENANT_ID).in("product_id", sourceProductIds),
      "Read source product groups",
    ),
    requireQuery(
      client.from("product_attribute_values").select("*").eq("tenant_id", MASTER_TENANT_ID).in("product_id", sourceProductIds),
      "Read source product values",
    ),
    requireQuery(
      client.from("generic_product_prices").select("*").eq("tenant_id", MASTER_TENANT_ID).in("product_id", sourceProductIds),
      "Read source product prices",
    ),
    requireQuery(
      client.from("designer_templates").select("*").in("id", templateIds),
      "Read existing Designer templates",
    ),
    requireQuery(
      client.from("products").select("*").eq("tenant_id", MASTER_TENANT_ID).eq("slug", TARGET_SLUG).maybeSingle(),
      "Read combined target product",
    ),
  ]);

  let targetGroups = [];
  let targetValues = [];
  let targetPrices = [];
  if (targetProduct) {
    [targetGroups, targetValues, targetPrices] = await Promise.all([
      requireQuery(
        client.from("product_attribute_groups").select("*").eq("tenant_id", MASTER_TENANT_ID).eq("product_id", targetProduct.id),
        "Read target groups",
      ),
      requireQuery(
        client.from("product_attribute_values").select("*").eq("tenant_id", MASTER_TENANT_ID).eq("product_id", targetProduct.id),
        "Read target values",
      ),
      requireQuery(
        client.from("generic_product_prices").select("*").eq("tenant_id", MASTER_TENANT_ID).eq("product_id", targetProduct.id),
        "Read target prices",
      ),
    ]);
  }

  const capturedAt = new Date().toISOString();
  const snapshot = {
    schemaVersion: 1,
    capturedAt,
    purpose: "Pre-write snapshot for the additive unpublished combined Christmas-calendar draft",
    rollbackNote:
      "The 14 source products are read-only evidence. If the combined unpublished draft must be reversed, restore or delete only the target product identified under targetBefore; never alter the sourceProducts collection.",
    sourceProductIds,
    sourceTemplateIds: templateIds,
    sourceProducts,
    sourceProductAttributeGroups: sourceGroups,
    sourceProductAttributeValues: sourceValues,
    sourceProductPrices: sourcePrices,
    sourceDesignerTemplates: templates,
    targetBefore: {
      product: targetProduct || null,
      groups: targetGroups,
      values: targetValues,
      prices: targetPrices,
    },
  };
  const timestamp = capturedAt.replace(/[:.]/g, "-");
  const snapshotPath = path.join(outputDir, "rollback", `source-products-before-${timestamp}.json`);
  writeJson(snapshotPath, snapshot);

  return {
    ...snapshot,
    snapshotPath,
    snapshotSha256: sha256File(snapshotPath),
  };
}

function collectPricingValueSettings(pricingStructure) {
  const settings = new Map();
  const sections = [
    pricingStructure?.vertical_axis,
    ...(pricingStructure?.layout_rows || []).flatMap((row) => row?.columns || []),
  ].filter(Boolean);
  for (const section of sections) {
    for (const [valueId, valueSettings] of Object.entries(section.valueSettings || {})) {
      settings.set(String(valueId), valueSettings || {});
    }
  }
  return settings;
}

export function buildVariantImageUrlMap({ manifest, sourceProducts, sourceProductAttributeValues }) {
  const models = manifest.optionGroups.find((group) => group.key === "calendar_model")?.values || [];
  const variants = manifest.optionGroups.find((group) => group.key === "variant")?.values || [];
  const productById = new Map((sourceProducts || []).map((product) => [product.id, product]));
  const sourceProductIdByModelKey = new Map(models.map((model) => [model.key, model.sourceProductId]));
  const valuesByProductId = new Map();
  for (const value of sourceProductAttributeValues || []) {
    if (!valuesByProductId.has(value.product_id)) valuesByProductId.set(value.product_id, []);
    valuesByProductId.get(value.product_id).push(value);
  }

  const result = new Map();
  for (const variant of variants) {
    const productId = sourceProductIdByModelKey.get(variant.modelKey);
    const sourceProduct = productById.get(productId);
    if (!sourceProduct) continue;
    const valueSettings = collectPricingValueSettings(sourceProduct.pricing_structure);
    const sourceValues = valuesByProductId.get(productId) || [];
    const orderedGroupKeys = [
      "filling",
      "format",
      "packaging",
      "material",
      ...Object.keys(variant.sourceValueKeys || {}).filter(
        (key) => !["filling", "format", "packaging", "material"].includes(key),
      ),
    ];

    for (const groupKey of orderedGroupKeys) {
      const sourceValueKey = normalize(variant.sourceValueKeys?.[groupKey]);
      if (!sourceValueKey) continue;
      const matchingValues = sourceValues.filter((value) => (
        normalize(value.key) === sourceValueKey
        || normalize(value.meta?.sourceKey) === sourceValueKey
      ));
      assert(
        matchingValues.length <= 1,
        `${variant.key}: source option '${sourceValueKey}' is ambiguous`,
      );
      const sourceValue = matchingValues[0];
      if (!sourceValue) continue;
      const candidate = normalize(
        valueSettings.get(String(sourceValue.id))?.customImage
        || sourceValue.meta?.image,
      );
      if (/^https:\/\//i.test(candidate)) {
        result.set(variant.key, candidate);
        break;
      }
    }
  }
  return result;
}

function validateCapturedDatabaseState({ manifest, databaseState }) {
  const models = manifest.optionGroups.find((group) => group.key === "calendar_model").values;
  const sourceProductsById = new Map(databaseState.sourceProducts.map((product) => [product.id, product]));
  const templatesById = new Map(databaseState.sourceDesignerTemplates.map((template) => [template.id, template]));
  assert(sourceProductsById.size === EXPECTED.models, `Expected ${EXPECTED.models} source products in snapshot`);
  assert(templatesById.size === EXPECTED.documents, `Expected ${EXPECTED.documents} Designer templates in snapshot`);

  const modelImageUrlByKey = new Map();
  const sourceProductByModelKey = new Map();
  for (const model of models) {
    const sourceProduct = sourceProductsById.get(model.sourceProductId);
    assert(sourceProduct, `${model.key}: source Webprinter product is missing`);
    assert(sourceProduct.tenant_id === MASTER_TENANT_ID, `${model.key}: source product is not master-tenant owned`);
    assert(
      sourceProduct.technical_specs?.supplierProductKey === manifest.source.sourceManifests.find(
        (item) => item.familySlug === model.key,
      )?.sourceKey,
      `${model.key}: source Webprinter product key has drifted`,
    );
    assert(normalize(sourceProduct.image_url), `${model.key}: source product has no reusable image URL`);
    modelImageUrlByKey.set(model.key, sourceProduct.image_url);
    sourceProductByModelKey.set(model.key, sourceProduct);
  }

  const sourceTemplateFileByDocumentKey = new Map();
  const pdfUrlByDocumentKey = new Map();
  for (const document of manifest.documents) {
    const templateId = document.template.designerTemplateId;
    const templateRow = templatesById.get(templateId);
    assert(templateRow, `${document.key}: existing Designer template ${templateId} is missing`);
    const sourceProduct = sourceProductByModelKey.get(document.match.calendar_model);
    const matchingFiles = (Array.isArray(sourceProduct.template_files) ? sourceProduct.template_files : [])
      .filter((item) => templateFileDesignerId(item) === templateId);
    assert(
      matchingFiles.length === 1,
      `${document.key}: expected one reusable source product template file, found ${matchingFiles.length}`,
    );
    const pdfUrl = templateFilePdfUrl(matchingFiles[0], templateRow);
    assert(/^https:\/\//i.test(pdfUrl), `${document.key}: existing PDF URL is missing or is not HTTPS`);
    const existingHash = normalizeForMatch(
      matchingFiles[0].templatePdfSha256
      || matchingFiles[0].template_pdf_sha256
      || document.template.sanitizedPdfSha256,
    );
    assert(
      existingHash === normalizeForMatch(document.template.sanitizedPdfSha256),
      `${document.key}: existing product template hash differs from the verified PDF`,
    );
    sourceTemplateFileByDocumentKey.set(document.key, clone(matchingFiles[0]));
    pdfUrlByDocumentKey.set(document.key, pdfUrl);
  }

  const target = databaseState.targetBefore.product;
  if (target) {
    assert(target.is_published === false, `${TARGET_SLUG}: refusing to change a published combined product`);
    assert(
      target.technical_specs?.supplierProductKey === TARGET_SOURCE_KEY,
      `${TARGET_SLUG}: existing target belongs to another source key`,
    );
  }

  const variantImageUrlByKey = buildVariantImageUrlMap({
    manifest,
    sourceProducts: databaseState.sourceProducts,
    sourceProductAttributeValues: databaseState.sourceProductAttributeValues,
  });

  return {
    modelImageUrlByKey,
    variantImageUrlByKey,
    sourceProductByModelKey,
    sourceTemplateFileByDocumentKey,
    pdfUrlByDocumentKey,
    templatesById,
  };
}

async function ensureTargetProduct(client, databaseState, sourceAssets) {
  if (databaseState.targetBefore.product) return { product: databaseState.targetBefore.product, created: false };
  const firstImageUrl = sourceAssets.modelImageUrlByKey.values().next().value;
  const { data, error } = await client
    .from("products")
    .insert({
      tenant_id: MASTER_TENANT_ID,
      name: "Julekalendere med eget design",
      slug: TARGET_SLUG,
      description: "Vælg kalendermodel og derefter en kompatibel chokolade, fyld eller variant.",
      category: "Julekalendere",
      pricing_type: "matrix",
      pricing_structure: { mode: "matrix_layout_v1", version: 1 },
      image_url: firstImageUrl,
      preset_key: "custom",
      icon_text: "Julekalendere",
      is_available_to_tenants: true,
      is_ready: false,
      is_published: false,
      technical_specs: {
        source: "supplier-bank-consolidation",
        supplier: "WIRmachenDRUCK",
        supplierProductKey: TARGET_SOURCE_KEY,
        verificationDraft: true,
      },
    })
    .select("*")
    .single();
  if (error) throw new Error(`Create unpublished combined product: ${error.message}`);
  return { product: data, created: true };
}

async function loadTargetAttributeState(client, productId) {
  const [groups, values] = await Promise.all([
    requireQuery(
      client.from("product_attribute_groups").select("*").eq("tenant_id", MASTER_TENANT_ID).eq("product_id", productId),
      "Read target attribute groups",
    ),
    requireQuery(
      client.from("product_attribute_values").select("*").eq("tenant_id", MASTER_TENANT_ID).eq("product_id", productId),
      "Read target attribute values",
    ),
  ]);
  return { groups, values };
}

async function ensureTargetGroup(client, productId, state, definition) {
  const matches = state.groups.filter((group) => normalizeForMatch(group.name) === normalizeForMatch(definition.name));
  assert(matches.length <= 1, `${TARGET_SLUG}: duplicate target group '${definition.name}'`);
  const payload = {
    tenant_id: MASTER_TENANT_ID,
    product_id: productId,
    name: definition.name,
    kind: definition.kind,
    ui_mode: definition.uiMode,
    source: "product",
    sort_order: definition.sortOrder,
    enabled: true,
  };
  if (matches[0]) {
    const { data, error } = await client
      .from("product_attribute_groups")
      .update(payload)
      .eq("id", matches[0].id)
      .eq("tenant_id", MASTER_TENANT_ID)
      .eq("product_id", productId)
      .select("*")
      .single();
    if (error) throw new Error(`Update target group ${definition.name}: ${error.message}`);
    return data;
  }
  const { data, error } = await client.from("product_attribute_groups").insert(payload).select("*").single();
  if (error) throw new Error(`Create target group ${definition.name}: ${error.message}`);
  state.groups.push(data);
  return data;
}

async function ensureTargetValue(client, productId, state, group, definition) {
  const matches = state.values.filter(
    (value) => value.group_id === group.id && normalize(value.key) === normalize(definition.key),
  );
  assert(matches.length <= 1, `${TARGET_SLUG}: duplicate value '${definition.key}' in ${group.name}`);
  const current = matches[0] || null;
  const payload = {
    tenant_id: MASTER_TENANT_ID,
    product_id: productId,
    group_id: group.id,
    name: definition.name,
    key: definition.key,
    sort_order: definition.sortOrder,
    enabled: true,
    width_mm: null,
    height_mm: null,
    meta: {
      ...(current?.meta || {}),
      ...definition.meta,
      sourceKey: definition.key,
      combinedCalendarRole: definition.role,
    },
  };
  if (current) {
    const { data, error } = await client
      .from("product_attribute_values")
      .update(payload)
      .eq("id", current.id)
      .eq("tenant_id", MASTER_TENANT_ID)
      .eq("product_id", productId)
      .select("*")
      .single();
    if (error) throw new Error(`Update target value ${definition.key}: ${error.message}`);
    state.values = state.values.map((value) => (value.id === data.id ? data : value));
    return data;
  }
  const { data, error } = await client.from("product_attribute_values").insert(payload).select("*").single();
  if (error) throw new Error(`Create target value ${definition.key}: ${error.message}`);
  state.values.push(data);
  return data;
}

async function ensureTargetAttributeModel(client, productId, manifest, sourceAssets) {
  const state = await loadTargetAttributeState(client, productId);
  const resolved = new Map();
  for (const definition of GROUP_DEFINITIONS) {
    const group = await ensureTargetGroup(client, productId, state, definition);
    const manifestGroup = manifest.optionGroups.find((item) => item.key === definition.key);
    const valueByKey = new Map();
    for (const value of manifestGroup.values) {
      const meta = definition.key === "calendar_model"
        ? {
            sourceProductId: value.sourceProductId,
            sourceProductSlug: value.sourceProductSlug,
            image: sourceAssets.modelImageUrlByKey.get(value.key),
            descriptionDa: value.details?.descriptionDa || null,
            formatLabels: value.details?.formatLabels || [],
            materialLabels: value.details?.materialLabels || [],
            fillingLabels: value.details?.fillingLabels || [],
            packagingLabels: value.details?.packagingLabels || [],
            printLabelDa: value.details?.printLabelDa || null,
          }
        : definition.key === "variant"
          ? {
              compatibleModelKey: value.modelKey,
              technicalTemplateVariant: value.technicalTemplateVariant,
              linkedTemplateId: value.linkedTemplateId,
              sourceSelections: value.sourceSelections,
              presentationKind: value.presentationKind,
              image: sourceAssets.variantImageUrlByKey?.get(value.key) || null,
            }
          : { technical: true };
      const row = await ensureTargetValue(client, productId, state, group, {
        key: value.key,
        name: value.labelDa,
        sortOrder: value.sourceOrder,
        role: definition.key,
        meta,
      });
      valueByKey.set(value.key, row);
    }
    resolved.set(definition.key, { group, valueByKey });
  }
  return resolved;
}

function findMatrixSection(structure, sectionId) {
  if (!structure || structure.mode !== "matrix_layout_v1") return null;
  if (structure.vertical_axis?.sectionId === sectionId) return structure.vertical_axis;
  for (const row of structure.layout_rows || []) {
    const section = (row.columns || []).find((column) => column.id === sectionId);
    if (section) return section;
  }
  return null;
}

function preserveDesiredValueOrder(desiredIds, existingIds) {
  const desired = new Set(desiredIds.map(String));
  return [
    ...(existingIds || []).map(String).filter((id) => desired.has(id)),
    ...desiredIds.map(String).filter((id) => !(existingIds || []).map(String).includes(id)),
  ];
}

export function buildCombinedPricingStructure({ manifest, resolvedGroups, sourceAssets, existingStructure = null }) {
  const modelGroup = manifest.optionGroups.find((group) => group.key === "calendar_model");
  const variantGroup = manifest.optionGroups.find((group) => group.key === "variant");
  const technicalGroup = manifest.optionGroups.find((group) => group.key === "technical_product");
  const modelResolved = resolvedGroups.get("calendar_model");
  const variantResolved = resolvedGroups.get("variant");
  const technicalResolved = resolvedGroups.get("technical_product");
  const oldModelSection = findMatrixSection(existingStructure, MODEL_SECTION_ID);
  const oldVariantSection = findMatrixSection(existingStructure, VARIANT_SECTION_ID);
  const oldTechnicalAxis = findMatrixSection(existingStructure, TECHNICAL_AXIS_ID);

  const desiredModelIds = modelGroup.values.map((value) => modelResolved.valueByKey.get(value.key).id);
  const desiredVariantIds = variantGroup.values.map((value) => variantResolved.valueByKey.get(value.key).id);
  const desiredTechnicalIds = technicalGroup.values.map((value) => technicalResolved.valueByKey.get(value.key).id);
  const modelIds = preserveDesiredValueOrder(desiredModelIds, oldModelSection?.valueIds);
  const variantIds = preserveDesiredValueOrder(desiredVariantIds, oldVariantSection?.valueIds);

  const modelValueSettings = {};
  for (const value of modelGroup.values) {
    const valueId = modelResolved.valueByKey.get(value.key).id;
    const previous = oldModelSection?.valueSettings?.[valueId] || {};
    modelValueSettings[valueId] = {
      showThumbnail: true,
      customImage: sourceAssets.modelImageUrlByKey.get(value.key),
      displayName: value.labelDa,
      ...previous,
    };
  }

  const variantValueSettings = {};
  for (const value of variantGroup.values) {
    const valueId = variantResolved.valueByKey.get(value.key).id;
    const previous = oldVariantSection?.valueSettings?.[valueId] || {};
    const importedImage = sourceAssets.variantImageUrlByKey?.get(value.key);
    variantValueSettings[valueId] = {
      showThumbnail: Boolean(importedImage),
      ...(importedImage ? {
        customImage: importedImage,
        preferCustomImage: true,
      } : {}),
      displayName: value.labelDa,
      ...previous,
      linkedTemplateId: value.linkedTemplateId,
    };
  }

  const technicalValueSettings = {};
  for (const value of technicalGroup.values) {
    const valueId = technicalResolved.valueByKey.get(value.key).id;
    technicalValueSettings[valueId] = {
      ...(oldTechnicalAxis?.valueSettings?.[valueId] || {}),
      displayName: value.labelDa,
    };
  }

  const quantities = Array.from(new Set(manifest.pricing.records.map((record) => Number(record.quantity))))
    .sort((left, right) => left - right);
  const modelSection = {
    id: MODEL_SECTION_ID,
    sectionType: "materials",
    groupId: modelResolved.group.id,
    valueIds: modelIds,
    ui_mode: oldModelSection?.ui_mode || "xl",
    thumbnail_size: oldModelSection?.thumbnail_size || "xl",
    thumbnail_custom_px: oldModelSection?.thumbnail_custom_px || IMPORTED_MODEL_IMAGE_PX,
    selection_mode: "required",
    valueSettings: modelValueSettings,
    title: "Vælg kalendermodel",
    description: "Vælg først den kalenderkonstruktion, du ønsker.",
    focusSelectedValue: true,
    focus_selected_value: true,
    neutralWhiteSurface: true,
    neutral_white_surface: true,
    sourceOrder: 0,
  };
  const variantSection = {
    id: VARIANT_SECTION_ID,
    sectionType: "formats",
    groupId: variantResolved.group.id,
    valueIds: variantIds,
    ui_mode: oldVariantSection?.ui_mode || "dropdown",
    thumbnail_size: oldVariantSection?.thumbnail_size || "medium",
    selection_mode: "required",
    valueSettings: variantValueSettings,
    title: "Vælg chokolade, fyld eller variant",
    description: "Du ser kun de muligheder, der passer til den valgte kalendermodel.",
    adaptiveImageSelector: true,
    adaptive_image_selector: true,
    hideSingleAvailableValue: true,
    hide_single_available_value: true,
    neutralWhiteSurface: true,
    neutral_white_surface: true,
    hideUnavailableValues: true,
    hide_unavailable_values: true,
    sourceOrder: 1,
  };
  const verticalAxis = {
    sectionId: TECHNICAL_AXIS_ID,
    sectionType: "products",
    groupId: technicalResolved.group.id,
    valueIds: desiredTechnicalIds,
    ui_mode: "buttons",
    thumbnail_size: "small",
    valueSettings: technicalValueSettings,
    title: "Julekalender",
    description: "",
  };

  return {
    mode: "matrix_layout_v1",
    version: 1,
    vertical_axis: verticalAxis,
    layout_rows: [
      { id: "calendar-model-row", title: "", description: "", columns: [modelSection] },
      { id: "calendar-variant-row", title: "", description: "", columns: [variantSection] },
    ],
    quantities,
    hideUnavailableQuantities: true,
    hide_unavailable_quantities: true,
  };
}

export function buildCombinedPriceRows({ manifest, productId, resolvedGroups, pricingStructure }) {
  const modelResolved = resolvedGroups.get("calendar_model");
  const variantResolved = resolvedGroups.get("variant");
  const technicalResolved = resolvedGroups.get("technical_product");
  const technicalValueId = technicalResolved.valueByKey.get("julekalender").id;
  const variantsByKey = new Map(
    manifest.optionGroups.find((group) => group.key === "variant").values.map((value) => [value.key, value]),
  );
  const rows = manifest.pricing.records.map((record) => {
    const modelKey = record.selections.calendar_model;
    const variantKey = record.selections.variant;
    const modelValueId = modelResolved.valueByKey.get(modelKey)?.id;
    const variantValueId = variantResolved.valueByKey.get(variantKey)?.id;
    const variant = variantsByKey.get(variantKey);
    assert(modelValueId && variantValueId && variant, `Cannot map combined price row ${record.sourceOrder}`);
    const variantName = [modelValueId, variantValueId].sort().join("|");
    return {
      tenant_id: MASTER_TENANT_ID,
      product_id: productId,
      variant_name: variantName,
      variant_value: technicalValueId,
      quantity: Number(record.quantity),
      price_dkk: Number(record.finalPriceDkk),
      extra_data: {
        verticalAxisGroupId: pricingStructure.vertical_axis.groupId,
        verticalAxisValueId: technicalValueId,
        selectionMap: {
          material: modelValueId,
          format: variantValueId,
          variantValueIds: [],
        },
        variantValueIds: [],
        materialId: modelValueId,
        formatId: variantValueId,
        calendarModelKey: modelKey,
        combinedVariantKey: variantKey,
        technicalTemplateVariant: record.selections.technical_template_variant,
        linkedTemplateId: variant.linkedTemplateId,
        supplierPriceEur: record.supplierPrice,
        convertedPriceDkk: record.convertedPriceDkk,
        conversionRuleKey: manifest.pricing.conversionRuleKey,
        sourceUrl: record.sourceUrl,
        sourceFamilySlug: record.sourceFamilySlug,
        sourceProductId: record.sourceProductId,
        sourceRecordOrder: record.sourceRecord.sourceOrder,
        sourceSelections: clone(record.sourceRecord.selections),
        sourceEvidence: clone(record.sourceRecord.evidence || null),
        combinedImportSourceKey: TARGET_SOURCE_KEY,
        verificationDraft: true,
      },
    };
  });

  const signatures = new Set(rows.map((row) => stableJson([
    row.product_id,
    row.variant_name,
    row.variant_value,
    row.quantity,
  ])));
  assert(rows.length === EXPECTED.prices && signatures.size === EXPECTED.prices, "Prepared database prices are not 514 unique rows");
  return rows;
}

export function buildCombinedTemplateFiles({ manifest, sourceAssets }) {
  const modelsByKey = new Map(
    manifest.optionGroups.find((group) => group.key === "calendar_model").values.map((value) => [value.key, value]),
  );
  return manifest.documents.map((document) => {
    const sourceFile = sourceAssets.sourceTemplateFileByDocumentKey.get(document.key);
    const sourceFormat = normalize(sourceFile?.format) || null;
    const sourceFileWithoutFormat = clone(sourceFile);
    delete sourceFileWithoutFormat.format;
    const pdfUrl = sourceAssets.pdfUrlByDocumentKey.get(document.key);
    const model = modelsByKey.get(document.match.calendar_model);
    const sourceMatchLabel = Object.values(document.source.sourceMatch || {}).map(normalize).filter(Boolean).join(" · ");
    const configuration = [model.labelDa, sourceMatchLabel].filter(Boolean).join(" · ");
    const bleedMm = document.template.bleedMm == null
      ? null
      : Number(document.template.bleedMm);
    const safeMm = document.template.safeMm == null
      ? null
      : Number(document.template.safeMm);
    return {
      ...sourceFileWithoutFormat,
      name: `${model.labelDa} – ${sourceMatchLabel || "tryksskabelon"}`,
      url: pdfUrl,
      pdfUrl,
      // The combined Matrix uses its customer variant as the "formats" group.
      // Retaining the source product's physical format would make template
      // matching require an invisible extra choice (for example both
      // "412 × 307 mm" and "Celebrations"). Preserve that source fact only for
      // audit and route by the exact configuration + linkedTemplateId instead.
      format: null,
      sourceFormat,
      configuration,
      calendarModel: model.labelDa,
      calendarModelKey: model.key,
      technicalTemplateVariant: document.key,
      compatibleVariantKeys: clone(document.applicableVariantKeys),
      designerTemplateId: document.template.designerTemplateId,
      designerLoadMode: document.template.designerLoadMode,
      lockedInDesigner: document.template.lockedInDesigner,
      nonPrintingOverlay: document.template.nonPrintingOverlay,
      excludedFromExport: document.template.excludedFromExport,
      templatePdfSha256: document.template.sanitizedPdfSha256,
      widthMm: Number(document.template.widthMm),
      heightMm: Number(document.template.heightMm),
      ...(Number.isFinite(bleedMm) ? { bleedMm } : {}),
      ...(Number.isFinite(safeMm) ? { safeMm } : {}),
      designerVerification: clone(document.template.designerVerification),
    };
  });
}

function priceRowSignature(row) {
  return stableJson([row.variant_name, row.variant_value, Number(row.quantity)]);
}

export function mergeExistingCalendarPriceRows({ desiredRows, existingRows }) {
  const existingBySignature = new Map(
    (existingRows || []).map((row) => [priceRowSignature(row), row]),
  );
  let preservedExistingPrices = 0;
  const rows = desiredRows.map((desired) => {
    const existing = existingBySignature.get(priceRowSignature(desired));
    if (!existing) return desired;
    preservedExistingPrices += 1;
    return {
      ...desired,
      price_dkk: Number(existing.price_dkk),
      extra_data: {
        ...(desired.extra_data || {}),
        ...(existing.extra_data || {}),
        verticalAxisGroupId: desired.extra_data?.verticalAxisGroupId,
        verticalAxisValueId: desired.extra_data?.verticalAxisValueId,
        selectionMap: clone(desired.extra_data?.selectionMap || {}),
        variantValueIds: clone(desired.extra_data?.variantValueIds || []),
        materialId: desired.extra_data?.materialId,
        formatId: desired.extra_data?.formatId,
        calendarModelKey: desired.extra_data?.calendarModelKey,
        combinedVariantKey: desired.extra_data?.combinedVariantKey,
        technicalTemplateVariant: desired.extra_data?.technicalTemplateVariant,
        linkedTemplateId: desired.extra_data?.linkedTemplateId,
      },
    };
  });
  return { rows, preservedExistingPrices };
}

export function validateExistingCalendarPriceCoverage({ desiredRows, existingRows }) {
  assert(
    existingRows.length === desiredRows.length,
    `${TARGET_SLUG}: existing price count ${existingRows.length} differs from protected package count ${desiredRows.length}`,
  );
  const desiredSignatures = new Set(desiredRows.map(priceRowSignature));
  const existingSignatures = new Set(existingRows.map(priceRowSignature));
  assert(
    existingSignatures.size === desiredSignatures.size,
    `${TARGET_SLUG}: existing price signatures are not unique`,
  );
  for (const signature of desiredSignatures) {
    assert(
      existingSignatures.has(signature),
      `${TARGET_SLUG}: existing prices do not cover protected row ${signature}`,
    );
  }
  return {
    before: existingRows.length,
    after: existingRows.length,
    staleRemoved: 0,
    preservedExistingPrices: existingRows.length,
    writeSkipped: true,
  };
}

async function upsertPricesBeforeRemovingStale(client, productId, desiredRows) {
  const existingRows = await requireQuery(
    client.from("generic_product_prices").select("*").eq("tenant_id", MASTER_TENANT_ID).eq("product_id", productId),
    "Read existing combined prices",
  );
  const merged = mergeExistingCalendarPriceRows({ desiredRows, existingRows });
  const effectiveRows = merged.rows;
  const desiredSignatures = new Set(effectiveRows.map(priceRowSignature));
  for (const rows of chunk(effectiveRows, 250)) {
    const { error } = await client.from("generic_product_prices").upsert(rows, {
      onConflict: "product_id,variant_name,variant_value,quantity",
      ignoreDuplicates: false,
    });
    if (error) throw new Error(`Upsert combined price rows: ${error.message}`);
  }

  const staleIds = existingRows
    .filter((row) => !desiredSignatures.has(priceRowSignature(row)))
    .map((row) => row.id);
  for (const ids of chunk(staleIds, 250)) {
    const { error } = await client
      .from("generic_product_prices")
      .delete()
      .eq("tenant_id", MASTER_TENANT_ID)
      .eq("product_id", productId)
      .in("id", ids);
    if (error) throw new Error(`Remove stale combined price rows: ${error.message}`);
  }

  const finalRows = await requireQuery(
    client.from("generic_product_prices").select("*").eq("tenant_id", MASTER_TENANT_ID).eq("product_id", productId),
    "Verify combined prices",
  );
  assert(finalRows.length === EXPECTED.prices, `Combined draft has ${finalRows.length}, not ${EXPECTED.prices}, prices`);
  const finalBySignature = new Map(finalRows.map((row) => [priceRowSignature(row), row]));
  for (const desired of effectiveRows) {
    const actual = finalBySignature.get(priceRowSignature(desired));
    assert(actual, `Missing combined database price ${priceRowSignature(desired)}`);
    assert(Number(actual.price_dkk) === Number(desired.price_dkk), "Combined database price differs from package");
  }
  return {
    before: existingRows.length,
    after: finalRows.length,
    staleRemoved: staleIds.length,
    preservedExistingPrices: merged.preservedExistingPrices,
  };
}

async function assertTargetStillUnpublished(client, productId, stage) {
  const product = await requireQuery(
    client.from("products").select("id,is_published,technical_specs").eq("tenant_id", MASTER_TENANT_ID).eq("id", productId).single(),
    `Verify target before ${stage}`,
  );
  assert(product.is_published === false, `${TARGET_SLUG}: target became published before ${stage}`);
  assert(product.technical_specs?.supplierProductKey === TARGET_SOURCE_KEY, `${TARGET_SLUG}: source key changed before ${stage}`);
}

export async function writeUnpublishedCombinedCalendarProduct({ bundle, client }) {
  const { manifest, outputDir } = bundle;
  const databaseState = await captureDatabaseState(client, { manifest, outputDir });
  const sourceAssets = validateCapturedDatabaseState({ manifest, databaseState });
  const ensured = await ensureTargetProduct(client, databaseState, sourceAssets);
  const targetProduct = ensured.product;
  assert(targetProduct.id && targetProduct.id !== manifest.source.sourceManifests[0].sourceProductId, "Target product id is unsafe");
  await assertTargetStillUnpublished(client, targetProduct.id, "attribute preparation");

  const resolvedGroups = await ensureTargetAttributeModel(
    client,
    targetProduct.id,
    manifest,
    sourceAssets,
  );
  const pricingStructure = buildCombinedPricingStructure({
    manifest,
    resolvedGroups,
    sourceAssets,
    existingStructure: targetProduct.pricing_structure,
  });
  const priceRows = buildCombinedPriceRows({
    manifest,
    productId: targetProduct.id,
    resolvedGroups,
    pricingStructure,
  });
  const templateFiles = buildCombinedTemplateFiles({ manifest, sourceAssets });
  assert(templateFiles.length === EXPECTED.documents, "Combined target must reuse 28 template files");

  await assertTargetStillUnpublished(client, targetProduct.id, "price upsert");
  const priceResult = ensured.created
    ? await upsertPricesBeforeRemovingStale(client, targetProduct.id, priceRows)
    : validateExistingCalendarPriceCoverage({
        desiredRows: priceRows,
        existingRows: databaseState.targetBefore.prices,
      });
  await assertTargetStillUnpublished(client, targetProduct.id, "product finalization");

  const updatedAt = new Date().toISOString();
  const existingSpecs = targetProduct.technical_specs || {};
  const firstImageUrl = targetProduct.image_url || sourceAssets.modelImageUrlByKey.values().next().value;
  const productPayload = {
    name: manifest.product.nameDa,
    slug: TARGET_SLUG,
    description: manifest.product.descriptionDa,
    category: "Julekalendere",
    pricing_type: "matrix",
    pricing_structure: pricingStructure,
    image_url: firstImageUrl,
    about_title: "Julekalendere med dit eget design",
    about_description:
      "Vælg først den kalender, der passer til opgaven. Derefter viser systemet kun kompatibel chokolade, fyld eller udførelse og forbinder automatisk den eksakte trykskabelon.",
    about_image_url: firstImageUrl,
    template_files: templateFiles,
    technical_specs: {
      ...existingSpecs,
      source: "supplier-bank-consolidation",
      supplier: "WIRmachenDRUCK",
      supplierProductKey: TARGET_SOURCE_KEY,
      sourceProductIds: manifest.source.sourceManifests.map((item) => item.sourceProductId),
      sourceManifestFingerprint: manifest.pricing.sourcePriceFingerprint,
      calendarModels: EXPECTED.models,
      compatibleVariants: EXPECTED.variants,
      priceRows: EXPECTED.prices,
      designerTemplates: EXPECTED.documents,
      verificationDraft: true,
      pdfTemplatesStructurallyVerified: true,
      pdfTemplatesRuntimeVerified: false,
      designerRuntimeProofs: clone(manifest.verification.designerRuntimeProofs),
      sourceDesignerRuntimeProofAudit: clone(manifest.verification.sourceDesignerRuntimeProofAudit),
      modelVisuals: clone(manifest.verification.modelVisuals),
      sourceProductsProtected: true,
      originalsRetired: false,
      customizable: true,
      min_dpi: 300,
      color_mode: "CMYK",
      site_modes: {
        ...(existingSpecs.site_modes || {}),
        designer_mode: "pdf_template",
        pricing_model: "template_product",
        updatedAt,
      },
    },
    preset_key: "custom",
    icon_text: "Julekalendere",
    is_available_to_tenants: true,
    is_ready: false,
    is_published: false,
  };
  const { data: updatedProduct, error: updateError } = await client
    .from("products")
    .update(productPayload)
    .eq("tenant_id", MASTER_TENANT_ID)
    .eq("id", targetProduct.id)
    .eq("is_published", false)
    .select("id,slug,name,is_published,is_ready,category,pricing_structure,technical_specs")
    .maybeSingle();
  if (updateError) throw new Error(`Finalize unpublished combined product: ${updateError.message}`);
  assert(updatedProduct, `${TARGET_SLUG}: product was not finalized (it may have been published concurrently)`);
  assert(updatedProduct.is_published === false && updatedProduct.is_ready === false, "Combined target must remain an unpublished verification draft");

  const writeSummary = {
    schemaVersion: 1,
    writtenAt: updatedAt,
    productId: targetProduct.id,
    productSlug: TARGET_SLUG,
    created: ensured.created,
    category: updatedProduct.category,
    isPublished: updatedProduct.is_published,
    isReady: updatedProduct.is_ready,
    verificationStatus: "verification_draft",
    models: EXPECTED.models,
    variants: EXPECTED.variants,
    prices: EXPECTED.prices,
    templatesReused: EXPECTED.documents,
    imagesReused: EXPECTED.models,
    priceResult,
    sourceProductsChanged: false,
    sourceProductsRetired: false,
    storageWrites: 0,
    designerTemplateWrites: 0,
    manifestState: manifest.target.state,
    snapshotPath: databaseState.snapshotPath,
    snapshotSha256: databaseState.snapshotSha256,
  };
  const summaryPath = path.join(
    outputDir,
    "review",
    `unpublished-draft-write-${updatedAt.replace(/[:.]/g, "-")}.json`,
  );
  writeJson(summaryPath, writeSummary);
  return { ...writeSummary, summaryPath };
}

function parseArgs(argv) {
  const args = {
    runDir: DEFAULT_RUN_DIR,
    outputDir: null,
    writeUnpublishedProduct: false,
    help: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--run-dir") {
      assert(argv[index + 1], "--run-dir requires a path");
      args.runDir = path.resolve(argv[++index]);
    } else if (argument === "--output-dir") {
      assert(argv[index + 1], "--output-dir requires a path");
      args.outputDir = path.resolve(argv[++index]);
    } else if (argument === "--write-unpublished-product") {
      args.writeUnpublishedProduct = true;
    } else if (argument === "--help" || argument === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  args.outputDir ||= path.join(args.runDir, "combined", TARGET_SLUG);
  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/product-import/build-wmd-advent-calendar-consolidated-product.js [--run-dir PATH] [--output-dir PATH]
  node scripts/product-import/build-wmd-advent-calendar-consolidated-product.js [--run-dir PATH] [--output-dir PATH] --write-unpublished-product

Default mode only builds and validates the schemaVersion 2 extracted package.
The explicit write flag creates or refreshes only the NEW unpublished master-tenant verification draft '${TARGET_SLUG}'.
It never uploads files, updates Designer templates, changes the 14 source products, retires originals, or publishes the target.`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }
  const bundle = buildCombinedCalendarPackage({
    runDir: args.runDir,
    outputDir: args.outputDir,
    materialize: true,
  });
  const dryRunSummary = {
    mode: args.writeUnpublishedProduct ? "write-unpublished-product" : "dry-run",
    outputDir: bundle.outputDir,
    manifestPath: bundle.artifacts.manifestPath,
    reportPath: bundle.artifacts.reportPath,
    schemaVersion: bundle.manifest.schemaVersion,
    targetState: bundle.manifest.target.state,
    ...bundle.validation,
    productWrites: args.writeUnpublishedProduct ? "explicitly enabled" : 0,
    sourceProductWrites: 0,
    storageWrites: 0,
    designerTemplateWrites: 0,
    publishProduct: false,
    retireOriginalProducts: false,
  };
  console.log(JSON.stringify(dryRunSummary, null, 2));
  if (!args.writeUnpublishedProduct) return;

  const { url, serviceRoleKey } = getSupabaseEnv();
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await writeUnpublishedCombinedCalendarProduct({ bundle, client });
  console.log(JSON.stringify({ mode: "write-complete", ...result }, null, 2));
}

const isDirectExecution = Boolean(
  process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url)),
);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
