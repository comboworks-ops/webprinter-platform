#!/usr/bin/env node
import "dotenv/config";
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
const LEGACY_MULTI_PRODUCT_ID = "a447c6d6-2476-4b9c-9b9a-ba6f0115806e";
const LEGACY_MULTI_SLUG = "julekalender-mini-mix";
const LEGACY_MULTI_TEMPLATE_ID = "4aef7f9c-5e19-4bb7-b8db-5b43b365a934";
const DEFAULT_RUN_DIR = path.resolve(
  process.cwd(),
  "tmp/supplier-imports/wmd-advent-calendars-20260826T084700Z",
);
const EXPECTED_FAMILIES = 14;
const EXPECTED_PRICES = 514;
const EXPECTED_DOCUMENTS = 28;
const EXPECTED_OPTION_IMAGES = 22;

function parseArgs(argv) {
  const runDirIndex = argv.indexOf("--run-dir");
  return {
    runDir:
      runDirIndex >= 0 && argv[runDirIndex + 1]
        ? path.resolve(argv[runDirIndex + 1])
        : DEFAULT_RUN_DIR,
    writeProducts: argv.includes("--write-products"),
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }
  return { url, serviceRoleKey };
}

function normalize(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function templateBindingSignature(source, axes) {
  return JSON.stringify(axes.map((axis) => [axis, normalize(source?.[axis]).toLocaleLowerCase("da-DK")]));
}

function validateTemplateBindingCoverage(manifest) {
  const axes = Array.isArray(manifest.templateBindingAxes)
    ? manifest.templateBindingAxes.map((axis) => normalize(axis)).filter(Boolean)
    : [];
  if (axes.length === 0) {
    throw new Error(`${manifest.product.slugDa}: templateBindingAxes must identify the exact pricing choice`);
  }

  const documentsBySignature = new Map();
  for (const document of manifest.documents) {
    const matchKeys = Object.keys(document.match || {});
    if (
      matchKeys.length !== axes.length
      || axes.some((axis) => !matchKeys.includes(axis) || !normalize(document.match?.[axis]))
    ) {
      throw new Error(`${manifest.product.slugDa}/${document.key}: document match must contain exactly ${axes.join(", ")}`);
    }
    const signature = templateBindingSignature(document.match, axes);
    if (documentsBySignature.has(signature)) {
      throw new Error(`${manifest.product.slugDa}: duplicate Designer template match ${signature}`);
    }
    documentsBySignature.set(signature, document.key);
  }

  const pricedSignatures = new Set(
    manifest.pricing.records.map((record) => templateBindingSignature(record.selections, axes)),
  );
  for (const signature of pricedSignatures) {
    if (!documentsBySignature.has(signature)) {
      throw new Error(`${manifest.product.slugDa}: missing Designer template for priced choice ${signature}`);
    }
  }
  for (const [signature, documentKey] of documentsBySignature) {
    if (!pricedSignatures.has(signature)) {
      throw new Error(`${manifest.product.slugDa}/${documentKey}: template does not match a priced choice`);
    }
  }
}

function validateTemplateInspection(manifest, familyDir, document) {
  const inspectionPath = document.template.inspectionPath;
  if (!inspectionPath) {
    throw new Error(`${manifest.product.slugDa}/${document.key}: missing PDF inspection path`);
  }
  const absoluteInspectionPath = path.join(familyDir, inspectionPath);
  if (!fs.existsSync(absoluteInspectionPath)) {
    throw new Error(`${manifest.product.slugDa}/${document.key}: missing ${inspectionPath}`);
  }
  const inspection = readJson(absoluteInspectionPath);
  const layerNames = new Set((inspection.layers || []).map((layer) => layer.name));
  const helperLayersAreSafe = (inspection.layers || []).every(
    (layer) => layer.printState === "/OFF" && layer.exportState === "/OFF",
  );
  const valid =
    inspection.schemaVersion >= 2 &&
    inspection.vectorGeometryPreserved === true &&
    inspection.fullPageRasterization === false &&
    inspection.outputRasterImageCount === 0 &&
    inspection.webprinterPanelHex === "#0EA5E9" &&
    inspection.panelTextContained === true &&
    inspection.supplierMetadataRemoved === true &&
    inspection.supplierBrandingRemoved === true &&
    inspection.visualReviewPending === false &&
    layerNames.has("Skære-, fals- og sikkerhedslinjer - ikke til tryk") &&
    layerNames.has("Webprinter-information - ikke til tryk") &&
    helperLayersAreSafe;
  if (!valid) {
    throw new Error(
      `${manifest.product.slugDa}/${document.key}: PDF must be vector, Webprinter blue, text-contained, supplier-free, visually reviewed, and non-printing`,
    );
  }
}

function loadFamilies(runDir) {
  const familiesDir = path.join(runDir, "families");
  const families = fs
    .readdirSync(familiesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const familyDir = path.join(familiesDir, entry.name);
      const manifestPath = path.join(familyDir, "import-manifest.json");
      return { familyDir, manifestPath, manifest: readJson(manifestPath) };
    })
    .sort((a, b) => a.manifest.product.slugDa.localeCompare(b.manifest.product.slugDa, "da"));

  if (families.length !== EXPECTED_FAMILIES) {
    throw new Error(`Expected ${EXPECTED_FAMILIES} product families, found ${families.length}`);
  }

  let priceCount = 0;
  let documentCount = 0;
  let optionImageCount = 0;
  for (const family of families) {
    const { manifest, familyDir } = family;
    if (!["bank_draft", "product_draft"].includes(manifest.target?.state)) {
      throw new Error(`${manifest.product.slugDa}: expected a verified bank_draft manifest`);
    }
    if (manifest.target?.publishProduct !== false || manifest.target?.writeLivePricing !== false) {
      throw new Error(`${manifest.product.slugDa}: publishing safeguards are not locked`);
    }
    if (!manifest.artifacts?.supplierBank?.bankProductId) {
      throw new Error(`${manifest.product.slugDa}: missing Supplier Bank identifiers`);
    }
    validateTemplateBindingCoverage(manifest);
    const heroPath = path.join(familyDir, "visual", "hero.png");
    if (!fs.existsSync(heroPath)) throw new Error(`${manifest.product.slugDa}: missing hero.png`);

    priceCount += manifest.pricing.records.length;
    documentCount += manifest.documents.length;
    for (const document of manifest.documents) {
      const pdfPath = path.join(familyDir, document.template.sanitizedPdfPath);
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`${manifest.product.slugDa}: missing ${document.template.sanitizedPdfPath}`);
      }
      if (!document.template.supplierBrandingRemoved || !document.template.metadataRemoved) {
        throw new Error(`${manifest.product.slugDa}/${document.key}: PDF sanitation not verified`);
      }
      if (
        document.template.designerLoadMode !== "locked_non_printing_guide_overlay"
        || document.template.lockedInDesigner !== true
        || document.template.nonPrintingOverlay !== true
        || document.template.excludedFromExport !== true
        || !/^[a-f0-9]{64}$/i.test(String(document.template.sanitizedPdfSha256 || ""))
      ) {
        throw new Error(
          `${manifest.product.slugDa}/${document.key}: Designer template must be hash-bound, locked, non-printing, and excluded from export`,
        );
      }
      const actualPdfSha256 = createHash("sha256").update(fs.readFileSync(pdfPath)).digest("hex");
      if (actualPdfSha256 !== String(document.template.sanitizedPdfSha256).toLowerCase()) {
        throw new Error(
          `${manifest.product.slugDa}/${document.key}: sanitized PDF bytes do not match sanitizedPdfSha256`,
        );
      }
      validateTemplateInspection(manifest, familyDir, document);
    }
    for (const group of manifest.optionGroups) {
      for (const value of group.values) {
        if (!value.icon?.generatedAssetPath) continue;
        optionImageCount += 1;
        const imagePath = path.join(familyDir, value.icon.generatedAssetPath);
        if (!fs.existsSync(imagePath)) {
          throw new Error(`${manifest.product.slugDa}: missing ${value.icon.generatedAssetPath}`);
        }
      }
    }
  }

  if (priceCount !== EXPECTED_PRICES) throw new Error(`Expected ${EXPECTED_PRICES} prices, found ${priceCount}`);
  if (documentCount !== EXPECTED_DOCUMENTS) {
    throw new Error(`Expected ${EXPECTED_DOCUMENTS} documents, found ${documentCount}`);
  }
  if (optionImageCount !== EXPECTED_OPTION_IMAGES) {
    throw new Error(`Expected ${EXPECTED_OPTION_IMAGES} option images, found ${optionImageCount}`);
  }
  return families;
}

async function uploadPublicFile(client, bucket, objectPath, localPath, contentType) {
  const { error } = await client.storage
    .from(bucket)
    .upload(objectPath, fs.readFileSync(localPath), {
      contentType,
      cacheControl: "3600",
      upsert: true,
    });
  if (error) throw new Error(`Upload failed for ${bucket}/${objectPath}: ${error.message}`);
  return client.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
}

function parseDimensions(label) {
  const match = String(label || "").match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)/i);
  if (!match) return { widthMm: null, heightMm: null };
  return {
    widthMm: Number(match[1].replace(",", ".")),
    heightMm: Number(match[2].replace(",", ".")),
  };
}

function groupKind(key) {
  if (key === "format") return "format";
  if (key === "material") return "material";
  return "other";
}

function sectionType(key) {
  if (key === "format") return "formats";
  if (key === "material") return "materials";
  return "other";
}

function configurationLabel(document, manifest) {
  for (const group of manifest.optionGroups) {
    const matched = document.match?.[group.key];
    if (matched) return matched;
  }
  return document.key;
}

function templateFileSelectionMetadata(manifest, document) {
  const bindingAxes = new Set(
    (Array.isArray(manifest.templateBindingAxes) ? manifest.templateBindingAxes : [])
      .map((axis) => normalize(axis)),
  );

  if (!bindingAxes.has("format")) return {};

  return { format: normalize(document.match?.format) };
}

export function buildProductTemplateFile({
  manifest,
  document,
  template,
  pdfUrl,
  objectPath,
  uploadedAt,
}) {
  return {
    name: `${manifest.product.nameDa} – ${configurationLabel(document, manifest)}`,
    url: pdfUrl,
    pdfUrl,
    path: objectPath,
    ...templateFileSelectionMetadata(manifest, document),
    configuration: configurationLabel(document, manifest),
    designerTemplateId: template.id,
    designerLoadMode: document.template.designerLoadMode,
    lockedInDesigner: document.template.lockedInDesigner,
    nonPrintingOverlay: document.template.nonPrintingOverlay,
    excludedFromExport: document.template.excludedFromExport,
    templatePdfSha256: document.template.sanitizedPdfSha256,
    widthMm: Number(document.template.widthMm),
    heightMm: Number(document.template.heightMm),
    bleedMm: Number(document.template.bleedMm),
    safeMm: Number(document.template.safeMm),
    uploadedAt,
  };
}

async function snapshotLegacyMulti(client, runDir) {
  const outputPath = path.join(runDir, "rollback", "julekalender-mini-mix-before.json");
  if (fs.existsSync(outputPath)) return outputPath;

  const { data: product, error: productError } = await client
    .from("products")
    .select("*")
    .eq("id", LEGACY_MULTI_PRODUCT_ID)
    .maybeSingle();
  if (productError) throw productError;
  if (!product) throw new Error(`Legacy product ${LEGACY_MULTI_PRODUCT_ID} was not found`);
  if (product.is_published) throw new Error("Legacy Kinder calendar is published; refusing to regroup it automatically");

  const [{ data: groups, error: groupsError }, { data: prices, error: pricesError }] = await Promise.all([
    client
      .from("product_attribute_groups")
      .select("*,values:product_attribute_values(*)")
      .eq("product_id", product.id)
      .order("sort_order"),
    client.from("generic_product_prices").select("*").eq("product_id", product.id).order("quantity"),
  ]);
  if (groupsError) throw groupsError;
  if (pricesError) throw pricesError;

  const referencedTemplateIds = Array.from(
    new Set(
      (Array.isArray(product.template_files) ? product.template_files : [])
        .map((item) => item?.designerTemplateId || item?.designer_template_id)
        .filter(Boolean),
    ),
  );
  let templates = [];
  if (referencedTemplateIds.length) {
    const { data, error } = await client
      .from("designer_templates")
      .select("*")
      .in("id", referencedTemplateIds);
    if (error) throw error;
    templates = data || [];
  }
  writeJson(outputPath, {
    capturedAt: new Date().toISOString(),
    rollbackNote:
      "Restore the product row, attribute groups/values, generic price rows and referenced designer templates from this snapshot if the unpublished regrouping must be reversed.",
    product,
    groups,
    prices,
    templates,
  });
  return outputPath;
}

async function ensureProduct(client, manifest) {
  const targetSlug = manifest.product.slugDa;
  const { data: targetProduct, error: targetError } = await client
    .from("products")
    .select("*")
    .eq("tenant_id", MASTER_TENANT_ID)
    .eq("slug", targetSlug)
    .maybeSingle();
  if (targetError) throw targetError;
  if (targetProduct) {
    const sourceKey = targetProduct.technical_specs?.supplierProductKey;
    if (sourceKey && sourceKey !== manifest.product.sourceKey) {
      throw new Error(`${targetSlug}: existing product belongs to another source key`);
    }
    if (targetProduct.is_published) throw new Error(`${targetSlug}: existing product is published`);
    return { product: targetProduct, created: false, regroupedLegacy: false };
  }

  if (targetSlug === "julekalender-multi") {
    const { data: legacy, error: legacyError } = await client
      .from("products")
      .select("*")
      .eq("id", LEGACY_MULTI_PRODUCT_ID)
      .eq("tenant_id", MASTER_TENANT_ID)
      .eq("slug", LEGACY_MULTI_SLUG)
      .maybeSingle();
    if (legacyError) throw legacyError;
    if (!legacy) throw new Error("The existing Kinder Mini Mix draft could not be located for regrouping");
    if (legacy.is_published) throw new Error("The existing Kinder Mini Mix product is published");
    return { product: legacy, created: false, regroupedLegacy: true };
  }

  const { data: created, error: createError } = await client
    .from("products")
    .insert({
      tenant_id: MASTER_TENANT_ID,
      name: manifest.product.nameDa,
      slug: targetSlug,
      description: manifest.product.descriptionDa,
      category: manifest.storefront.category,
      pricing_type: "matrix",
      is_published: false,
      is_available_to_tenants: true,
      is_ready: false,
      preset_key: "custom",
      icon_text: manifest.product.nameDa,
      technical_specs: {
        source: "supplier-bank",
        supplierProductKey: manifest.product.sourceKey,
      },
    })
    .select("*")
    .single();
  if (createError) throw createError;
  return { product: created, created: true, regroupedLegacy: false };
}

async function ensureTemplate(client, manifest, document, pdfUrl) {
  const configuration = configurationLabel(document, manifest);
  const name = `${manifest.product.nameDa} – ${configuration} – trykskabelon`;
  let existing = null;
  if (manifest.product.slugDa === "julekalender-multi" && document.key === "kinder-mini-mix") {
    const { data, error } = await client
      .from("designer_templates")
      .select("*")
      .eq("id", LEGACY_MULTI_TEMPLATE_ID)
      .maybeSingle();
    if (error) throw error;
    existing = data;
  }
  if (!existing) {
    const { data, error } = await client
      .from("designer_templates")
      .select("*")
      .eq("tenant_id", MASTER_TENANT_ID)
      .eq("name", name)
      .maybeSingle();
    if (error) throw error;
    existing = data;
  }

  const payload = {
    tenant_id: MASTER_TENANT_ID,
    name,
    description: `Eksakt, leverandørneutral trykskabelon til ${manifest.product.nameDa} – ${configuration}.`,
    template_type: "format",
    category: "Julekalendere",
    width_mm: document.template.widthMm,
    height_mm: document.template.heightMm,
    bleed_mm: document.template.bleedMm,
    safe_area_mm: document.template.safeMm,
    dpi_default: 300,
    dpi_min_required: 150,
    color_profile: "FOGRA39",
    template_pdf_url: pdfUrl,
    is_public: false,
    is_active: true,
    library_kind: "blank",
    source_kind: "native",
    tags: ["julekalender", "leverandoerskabelon", manifest.product.slugDa, document.key],
  };
  if (existing) {
    const { data, error } = await client
      .from("designer_templates")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await client
    .from("designer_templates")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function loadProductGroups(client, productId) {
  const { data, error } = await client
    .from("product_attribute_groups")
    .select("*,values:product_attribute_values(*)")
    .eq("tenant_id", MASTER_TENANT_ID)
    .eq("product_id", productId)
    .order("sort_order");
  if (error) throw error;
  return data || [];
}

async function ensureGroup(client, groups, productId, definition, index) {
  const kind = groupKind(definition.key);
  let group = groups.find((item) => normalize(item.name).toLowerCase() === normalize(definition.labelDa).toLowerCase());
  if (!group && definition.values.length === 1) {
    group = groups.find((item) => item.kind === kind && item.source === "product");
  }
  const payload = {
    tenant_id: MASTER_TENANT_ID,
    product_id: productId,
    name: definition.labelDa,
    kind,
    ui_mode: "buttons",
    source: "product",
    sort_order: index,
    enabled: true,
  };
  if (group) {
    const { data, error } = await client
      .from("product_attribute_groups")
      .update(payload)
      .eq("id", group.id)
      .select("*")
      .single();
    if (error) throw error;
    return { ...data, values: group.values || [] };
  }
  const { data, error } = await client
    .from("product_attribute_groups")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  const created = { ...data, values: [] };
  groups.push(created);
  return created;
}

async function ensureValue(client, group, productId, definition, value, index, iconUrl) {
  let row = (group.values || []).find((item) => item.key === value.key);
  if (!row) {
    row = (group.values || []).find(
      (item) => normalize(item.name).toLowerCase() === normalize(value.labelDa).toLowerCase(),
    );
  }
  if (!row && definition.values.length === 1 && (group.values || []).length === 1) {
    row = group.values[0];
  }
  const dimensions = definition.key === "format" ? parseDimensions(value.labelDa) : { widthMm: null, heightMm: null };
  const meta = {
    sourceKey: value.key,
    ...(iconUrl ? { image: iconUrl, generatedSupplierNeutral: true } : {}),
  };
  const payload = {
    tenant_id: MASTER_TENANT_ID,
    product_id: productId,
    group_id: group.id,
    name: value.labelDa,
    key: value.key,
    sort_order: index,
    enabled: true,
    width_mm: dimensions.widthMm,
    height_mm: dimensions.heightMm,
    meta,
  };
  if (row) {
    const { data, error } = await client
      .from("product_attribute_values")
      .update(payload)
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) throw error;
    group.values = (group.values || []).map((item) => (item.id === data.id ? data : item));
    return data;
  }
  const { data, error } = await client
    .from("product_attribute_values")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  group.values = [...(group.values || []), data];
  return data;
}

function resolveTemplateForValue(manifest, group, value, templatesByDocumentKey) {
  for (const document of manifest.documents) {
    if (normalize(document.match?.[group.key]).toLowerCase() !== normalize(value.labelDa).toLowerCase()) continue;
    return templatesByDocumentKey.get(document.key) || null;
  }
  if (manifest.documents.length === 1 && group.key === "format") {
    return templatesByDocumentKey.get(manifest.documents[0].key) || null;
  }
  return null;
}

const IMPORTED_OPTION_THUMBNAIL_PX = 160;

export function buildImportedOptionVisualSettings(optionImageUrl) {
  return {
    showThumbnail: Boolean(optionImageUrl),
    ...(optionImageUrl ? { customImage: optionImageUrl } : {}),
  };
}

export function buildImportedSectionVisualSettings(definition) {
  if (definition.displayType === "icon_grid") {
    return {
      ui_mode: "xl",
      thumbnail_size: "xl",
      thumbnail_custom_px: IMPORTED_OPTION_THUMBNAIL_PX,
    };
  }

  return {
    ui_mode: "buttons",
    thumbnail_size: "medium",
  };
}

function buildPricingStructure(manifest, resolvedGroups, quantities, templatesByDocumentKey) {
  const verticalDefinition = manifest.optionGroups.find((group) => group.key === "format") || manifest.optionGroups[0];
  const vertical = resolvedGroups.get(verticalDefinition.key);
  const makeValueSettings = (definition, resolved) => {
    const settings = {};
    for (const value of definition.values) {
      const row = resolved.valueByKey.get(value.key);
      const template = resolveTemplateForValue(manifest, definition, value, templatesByDocumentKey);
      const optionImageUrl = resolved.iconByKey.get(value.key) || null;
      settings[row.id] = {
        displayName: value.labelDa,
        ...buildImportedOptionVisualSettings(optionImageUrl),
        ...(template ? { linkedTemplateId: template.id } : {}),
      };
    }
    return settings;
  };

  const verticalAxis = {
    sectionId: `${verticalDefinition.key}-axis`,
    sectionType: sectionType(verticalDefinition.key),
    groupId: vertical.group.id,
    valueIds: verticalDefinition.values.map((value) => vertical.valueByKey.get(value.key).id),
    ...buildImportedSectionVisualSettings(verticalDefinition),
    valueSettings: makeValueSettings(verticalDefinition, vertical),
    title: verticalDefinition.labelDa,
    description: "",
  };

  const sections = manifest.optionGroups
    .filter((group) => group.key !== verticalDefinition.key)
    .map((definition, index) => {
      const resolved = resolvedGroups.get(definition.key);
      return {
        id: `${definition.key}-section`,
        sectionType: sectionType(definition.key),
        groupId: resolved.group.id,
        valueIds: definition.values.map((value) => resolved.valueByKey.get(value.key).id),
        ...buildImportedSectionVisualSettings(definition),
        selection_mode: "required",
        valueSettings: makeValueSettings(definition, resolved),
        title: definition.labelDa,
        description:
          definition.key === "filling" ? "Vælg den chokolade, kalenderen skal fyldes med." : "",
        sourceOrder: index,
      };
    });

  return {
    mode: "matrix_layout_v1",
    version: 1,
    vertical_axis: verticalAxis,
    layout_rows: sections.map((section) => ({
      id: `row-${section.id}`,
      title: "",
      description: "",
      columns: [section],
    })),
    quantities,
  };
}

function buildPriceRows(manifest, productId, resolvedGroups, pricingStructure) {
  const verticalKey = pricingStructure.vertical_axis.sectionId.replace(/-axis$/, "");
  const rows = [];
  for (const record of manifest.pricing.records) {
    const selectionMap = {};
    const selected = [];
    for (const definition of manifest.optionGroups) {
      const selectedLabel = record.selections?.[definition.key];
      const value = definition.values.find(
        (item) => normalize(item.labelDa).toLowerCase() === normalize(selectedLabel).toLowerCase(),
      );
      if (!value) {
        throw new Error(
          `${manifest.product.slugDa}: cannot map ${definition.key}='${selectedLabel}' at source row ${record.sourceOrder}`,
        );
      }
      const resolvedValue = resolvedGroups.get(definition.key).valueByKey.get(value.key);
      selectionMap[definition.key] = resolvedValue.id;
      selected.push({ key: definition.key, id: resolvedValue.id });
    }
    const verticalValue = selected.find((item) => item.key === verticalKey);
    const sectionValues = selected.filter((item) => item.key !== verticalKey);
    const variantValueIds = sectionValues
      .filter((item) => !["format", "material"].includes(item.key))
      .map((item) => item.id);
    selectionMap.variantValueIds = variantValueIds;
    rows.push({
      tenant_id: MASTER_TENANT_ID,
      product_id: productId,
      variant_name: sectionValues.map((item) => item.id).sort().join("|") || "none",
      variant_value: verticalValue.id,
      quantity: Number(record.quantity),
      price_dkk: Number(record.finalPriceDkk),
      extra_data: {
        verticalAxisGroupId: pricingStructure.vertical_axis.groupId,
        verticalAxisValueId: verticalValue.id,
        selectionMap,
        variantValueIds,
        formatId: selectionMap.format || null,
        materialId: selectionMap.material || null,
        supplierBankProductId: manifest.artifacts.supplierBank.bankProductId,
        supplierBankPriceSnapshotId: manifest.artifacts.supplierBank.priceSnapshotId,
        supplierPriceEur: record.supplierPrice,
        convertedPriceDkk: record.convertedPriceDkk,
        conversionRuleKey: manifest.pricing.conversionRuleKey,
        sourceUrl: record.sourceUrl,
        sourceOrder: record.sourceOrder,
      },
    });
  }
  return rows;
}

async function replacePrices(client, productId, rows) {
  const { error: deleteError } = await client
    .from("generic_product_prices")
    .delete()
    .eq("tenant_id", MASTER_TENANT_ID)
    .eq("product_id", productId);
  if (deleteError) throw deleteError;
  for (let index = 0; index < rows.length; index += 500) {
    const { error } = await client.from("generic_product_prices").insert(rows.slice(index, index + 500));
    if (error) throw error;
  }
}

async function importFamily(client, family, runDir) {
  const { manifest, familyDir, manifestPath } = family;
  const slug = manifest.product.slugDa;
  const uploadedAt = new Date().toISOString();

  const heroUrl = await uploadPublicFile(
    client,
    "product-images",
    `advent-calendars-2026/${slug}/hero.png`,
    path.join(familyDir, "visual", "hero.png"),
    "image/png",
  );
  const optionImageUrls = new Map();
  for (const group of manifest.optionGroups) {
    for (const value of group.values) {
      if (!value.icon?.generatedAssetPath) continue;
      const fileName = path.basename(value.icon.generatedAssetPath);
      const url = await uploadPublicFile(
        client,
        "product-images",
        `advent-calendars-2026/${slug}/options/${fileName}`,
        path.join(familyDir, value.icon.generatedAssetPath),
        "image/png",
      );
      optionImageUrls.set(`${group.key}:${value.key}`, url);
    }
  }

  const templatesByDocumentKey = new Map();
  const templateFiles = [];
  for (const document of manifest.documents) {
    const pdfName = path.basename(document.template.sanitizedPdfPath);
    const objectPath = `template-pdfs/advent-calendars-2026/${slug}/${pdfName}`;
    const pdfUrl = await uploadPublicFile(
      client,
      "design-library",
      objectPath,
      path.join(familyDir, document.template.sanitizedPdfPath),
      "application/pdf",
    );
    const template = await ensureTemplate(client, manifest, document, pdfUrl);
    templatesByDocumentKey.set(document.key, template);
    document.template.designerTemplateId = template.id;
    templateFiles.push(buildProductTemplateFile({
      manifest,
      document,
      template,
      pdfUrl,
      objectPath,
      uploadedAt,
    }));
  }

  const ensured = await ensureProduct(client, manifest);
  const productId = ensured.product.id;
  let groups = await loadProductGroups(client, productId);
  const resolvedGroups = new Map();
  for (let groupIndex = 0; groupIndex < manifest.optionGroups.length; groupIndex += 1) {
    const definition = manifest.optionGroups[groupIndex];
    const group = await ensureGroup(client, groups, productId, definition, groupIndex);
    const valueByKey = new Map();
    const iconByKey = new Map();
    for (let valueIndex = 0; valueIndex < definition.values.length; valueIndex += 1) {
      const value = definition.values[valueIndex];
      const iconUrl = optionImageUrls.get(`${definition.key}:${value.key}`) || null;
      const row = await ensureValue(client, group, productId, definition, value, valueIndex, iconUrl);
      valueByKey.set(value.key, row);
      if (iconUrl) iconByKey.set(value.key, iconUrl);
    }
    resolvedGroups.set(definition.key, { group, valueByKey, iconByKey });
  }

  const quantities = Array.from(
    new Set(manifest.pricing.records.map((record) => Number(record.quantity))),
  ).sort((a, b) => a - b);
  const pricingStructure = buildPricingStructure(
    manifest,
    resolvedGroups,
    quantities,
    templatesByDocumentKey,
  );
  const priceRows = buildPriceRows(manifest, productId, resolvedGroups, pricingStructure);
  if (priceRows.length !== manifest.pricing.records.length) {
    throw new Error(`${slug}: prepared price row count mismatch`);
  }

  const technicalSpecs = {
    ...(ensured.product.technical_specs || {}),
    site_modes: {
      ...(ensured.product.technical_specs?.site_modes || {}),
      designer_mode: "pdf_template",
      pricing_model: "template_product",
      updatedAt: uploadedAt,
    },
    source: "supplier-bank",
    supplier: "WIRmachenDRUCK",
    supplierProductKey: manifest.product.sourceKey,
    supplierBankProductId: manifest.artifacts.supplierBank.bankProductId,
    supplierBankPriceSnapshotId: manifest.artifacts.supplierBank.priceSnapshotId,
    conversionRuleKey: manifest.pricing.conversionRuleKey,
    customizable: true,
    min_dpi: 300,
    color_mode: "CMYK",
    pdfTemplatesVerified: true,
    supplierBrandingRemoved: true,
    product_page_info_v2: {
      useSections: true,
      imagePosition: "above",
      blocks: [
        {
          id: "calendar-customization",
          type: "text",
          title: "Din julekalender – dit design",
          text: "Kalenderens trykflade kan tilpasses med virksomhedens eget motiv, farver og budskab. Når du vælger format eller chokolade, følger den korrekte pris og trykskabelon automatisk med.",
          imageUrl: "",
          caption: "",
          images: [],
          effect: "fade",
          intervalMs: 4500,
          format: "",
          configuration: "",
          placement: "left",
        },
      ],
    },
  };
  const productPayload = {
    name: manifest.product.nameDa,
    slug,
    description: manifest.product.descriptionDa,
    category: manifest.storefront.category,
    pricing_type: "matrix",
    pricing_structure: pricingStructure,
    image_url: heroUrl,
    about_title: "Julekalender med dit eget design",
    about_description:
      `${manifest.product.descriptionDa} Kalenderen leveres med en kontrolleret trykskabelon, så kunden kan se og designe den valgte konstruktion korrekt.`,
    about_image_url: heroUrl,
    template_files: templateFiles,
    technical_specs: technicalSpecs,
    preset_key: "custom",
    icon_text: manifest.product.nameDa,
    is_available_to_tenants: true,
    is_ready: true,
    is_published: false,
  };
  const { data: updatedProduct, error: updateError } = await client
    .from("products")
    .update(productPayload)
    .eq("id", productId)
    .eq("tenant_id", MASTER_TENANT_ID)
    .select("id,slug,name,is_published,is_ready,image_url")
    .single();
  if (updateError) throw updateError;

  await replacePrices(client, productId, priceRows);
  const { data: importJob, error: importJobError } = await client
    .from("supplier_bank_import_jobs")
    .insert({
      bank_product_id: manifest.artifacts.supplierBank.bankProductId,
      target_tenant_id: MASTER_TENANT_ID,
      target_product_id: productId,
      import_mode: "matrix_layout_v1",
      status: "imported",
      import_summary: {
        importRunId: manifest.runId,
        supplierProductKey: manifest.product.sourceKey,
        productSlug: slug,
        groupedProduct: manifest.documents.length > 1,
        rowsInserted: priceRows.length,
        attributeGroups: manifest.optionGroups.length,
        optionImages: optionImageUrls.size,
        designerTemplates: templatesByDocumentKey.size,
        publishProduct: false,
      },
      rollback_note: ensured.regroupedLegacy
        ? `Restore ${path.relative(process.cwd(), path.join(runDir, "rollback", "julekalender-mini-mix-before.json"))}.`
        : "Delete this unpublished product and its product-specific attribute groups, values and prices if rollback is needed.",
    })
    .select("id")
    .single();
  if (importJobError) throw importJobError;

  const { data: bankProduct, error: bankReadError } = await client
    .from("supplier_bank_products")
    .select("metadata")
    .eq("id", manifest.artifacts.supplierBank.bankProductId)
    .single();
  if (bankReadError) throw bankReadError;
  const { error: bankUpdateError } = await client
    .from("supplier_bank_products")
    .update({
      metadata: {
        ...(bankProduct.metadata || {}),
        webprinterProductId: productId,
        webprinterProductSlug: slug,
        importedAt: uploadedAt,
        importJobId: importJob.id,
        isPublished: false,
      },
    })
    .eq("id", manifest.artifacts.supplierBank.bankProductId);
  if (bankUpdateError) throw bankUpdateError;

  manifest.target.state = "product_draft";
  manifest.artifacts = {
    ...manifest.artifacts,
    webprinterDraft: {
      productId,
      productSlug: slug,
      importJobId: importJob.id,
      priceRows: priceRows.length,
      templateIds: Array.from(templatesByDocumentKey.values()).map((template) => template.id),
      importedAt: uploadedAt,
      isPublished: false,
    },
  };
  writeJson(manifestPath, manifest);
  return {
    slug,
    productId,
    created: ensured.created,
    regroupedLegacy: ensured.regroupedLegacy,
    prices: priceRows.length,
    optionImages: optionImageUrls.size,
    templates: templatesByDocumentKey.size,
    isPublished: updatedProduct.is_published,
    isReady: updatedProduct.is_ready,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const families = loadFamilies(args.runDir);
  const dryRun = {
    mode: args.writeProducts ? "write-products" : "dry-run",
    runDir: args.runDir,
    existingKinderDraftWillBeRegrouped: true,
    targetProductCount: families.length,
    targetPriceRows: families.reduce((sum, family) => sum + family.manifest.pricing.records.length, 0),
    targetDocuments: families.reduce((sum, family) => sum + family.manifest.documents.length, 0),
    targetOptionImages: families.reduce(
      (sum, family) =>
        sum +
        family.manifest.optionGroups.reduce(
          (groupSum, group) => groupSum + group.values.filter((value) => value.icon).length,
          0,
        ),
      0,
    ),
    safeguards: {
      publishProduct: false,
      existingPublishedProductsMayBeChanged: false,
      rollbackSnapshotRequiredForKinderDraft: true,
    },
    products: families.map((family) => ({
      slug: family.manifest.product.slugDa,
      name: family.manifest.product.nameDa,
      prices: family.manifest.pricing.records.length,
      groups: family.manifest.optionGroups.map((group) => `${group.labelDa}: ${group.values.length}`),
      documents: family.manifest.documents.length,
      templateBindings: family.manifest.documents.map((document) => ({
        selection: document.match,
        pdf: document.template.sanitizedPdfPath,
        designerTemplateId: document.template.designerTemplateId || null,
        designerLoadMode: document.template.designerLoadMode,
        lockedInDesigner: document.template.lockedInDesigner === true,
        excludedFromExport: document.template.excludedFromExport === true,
      })),
    })),
  };
  if (!args.writeProducts) {
    console.log(JSON.stringify(dryRun, null, 2));
    return;
  }

  const { url, serviceRoleKey } = getSupabaseEnv();
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const rollbackSnapshot = await snapshotLegacyMulti(client, args.runDir);
  console.log(`rollback snapshot: ${rollbackSnapshot}`);

  const results = [];
  for (const family of families) {
    const result = await importFamily(client, family, args.runDir);
    results.push(result);
    console.log(
      `product draft: ${result.slug} (${result.prices} prices, ${result.templates} templates, ${result.optionImages} option images)`,
    );
  }
  const summary = {
    importedAt: new Date().toISOString(),
    rollbackSnapshot,
    publishProduct: false,
    results,
    totals: {
      products: results.length,
      prices: results.reduce((sum, result) => sum + result.prices, 0),
      templates: results.reduce((sum, result) => sum + result.templates, 0),
      optionImages: results.reduce((sum, result) => sum + result.optionImages, 0),
    },
  };
  const outputPath = path.join(args.runDir, "product-draft-import-summary.json");
  writeJson(outputPath, summary);
  console.log(JSON.stringify({ outputPath, ...summary.totals }, null, 2));
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
