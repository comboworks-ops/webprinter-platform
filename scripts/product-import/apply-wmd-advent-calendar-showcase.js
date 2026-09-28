#!/usr/bin/env node

import "dotenv/config";

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";
export const TARGET_PRODUCT_ID = "403c6103-d905-437e-a136-222d6d7e64ac";
export const TARGET_SLUG = "julekalendere-med-eget-design";
export const TARGET_SOURCE_KEY = "wmd-advent-calendars-consolidated-2026";
export const PRODUCT_IMAGES_BUCKET = "product-images";
export const MODEL_SECTION_ID = "calendar-model-section";
export const VARIANT_SECTION_ID = "calendar-variant-section";
export const MANAGED_BLOCK_PREFIX = "calendar-showcase-";
export const MAX_ASSET_BYTES = 5 * 1024 * 1024;
export const REQUIRED_DESIGNS = Object.freeze(["child", "dentist", "football"]);

export const DEFAULT_RUN_DIR = path.resolve(
  process.cwd(),
  "tmp/supplier-imports/wmd-advent-calendars-20260826T084700Z",
);
export const DEFAULT_OUTPUT_DIR = path.join(
  DEFAULT_RUN_DIR,
  "combined",
  TARGET_SLUG,
);
export const DEFAULT_ASSETS_DIR = path.join(DEFAULT_OUTPUT_DIR, "visual", "showcase");

/**
 * This is deliberately an exact, immutable contract. Groups with variant ids
 * represent physically different orientations/formats. Model-only groups have
 * the same visible exterior across their filling choices.
 */
export const EXPECTED_SHOWCASE_GROUPS = Object.freeze([
  {
    key: "premium-wall-landscape",
    modelKey: "premium-vaegjulekalender",
    modelValueId: "70cdf3ab-3402-424a-a367-d370c5a7f1ce",
    variantKeys: [
      "premium-vaegjulekalender--wall-landscape--260-g-m-cs1-karton--without-carton",
      "premium-vaegjulekalender--wall-landscape--260-g-m-cs1-karton--with-carton",
    ],
    variantValueIds: [
      "0ee498fa-3fc2-4769-90b9-40f99215c528",
      "05f65b06-2e32-46ab-bbf7-db997ce3e083",
    ],
  },
  {
    key: "premium-wall-portrait",
    modelKey: "premium-vaegjulekalender",
    modelValueId: "70cdf3ab-3402-424a-a367-d370c5a7f1ce",
    variantKeys: [
      "premium-vaegjulekalender--wall-portrait--260-g-m-cs1-karton--without-carton",
      "premium-vaegjulekalender--wall-portrait--260-g-m-cs1-karton--with-carton",
    ],
    variantValueIds: [
      "b95efb0b-9e6e-4241-92d1-723759a99ee9",
      "dd95f66d-824a-40ec-b884-4f6f8d06ed29",
    ],
  },
  {
    key: "premium-table-landscape",
    modelKey: "premium-bordjulekalender",
    modelValueId: "0652a69e-3abb-4d16-b4fc-7618ced7ac11",
    variantKeys: [
      "premium-bordjulekalender--table-landscape--260-g-m-cs1-karton",
    ],
    variantValueIds: ["4487da65-3131-4b79-bb65-49cdd0ed4d30"],
  },
  {
    key: "premium-table-portrait",
    modelKey: "premium-bordjulekalender",
    modelValueId: "0652a69e-3abb-4d16-b4fc-7618ced7ac11",
    variantKeys: [
      "premium-bordjulekalender--table-portrait--260-g-m-cs1-karton",
    ],
    variantValueIds: ["d0e338c0-b2d5-4c3f-87cc-b4b0ff8ef7eb"],
  },
  {
    key: "self-fill-plastic-portrait",
    modelKey: "selvfyld-julekalender",
    modelValueId: "9eaa06ea-56b9-4f54-949f-79abf99f278a",
    variantKeys: [
      "selvfyld-julekalender--standard-portrait--cellulosekarton-med-plastindl-g",
    ],
    variantValueIds: ["52ef46f2-24a5-47fb-8311-8e30432f6803"],
  },
  {
    key: "self-fill-plastic-landscape",
    modelKey: "selvfyld-julekalender",
    modelValueId: "9eaa06ea-56b9-4f54-949f-79abf99f278a",
    variantKeys: [
      "selvfyld-julekalender--standard-landscape--cellulosekarton-med-plastindl-g",
    ],
    variantValueIds: ["857d68ea-f2c0-440c-90c0-f29eef2704e2"],
  },
  {
    key: "self-fill-paper-portrait",
    modelKey: "selvfyld-julekalender-papirbaseret",
    modelValueId: "c194e17c-cd47-425d-b73b-4dd27b5abc6a",
    variantKeys: [
      "selvfyld-julekalender-papirbaseret--sustainable-portrait--cellulosekarton-med-fiberst-bt-indl-g",
    ],
    variantValueIds: ["a13d4ba5-322f-4943-bb0c-6dba9ca73260"],
  },
  {
    key: "self-fill-paper-landscape",
    modelKey: "selvfyld-julekalender-papirbaseret",
    modelValueId: "c194e17c-cd47-425d-b73b-4dd27b5abc6a",
    variantKeys: [
      "selvfyld-julekalender-papirbaseret--sustainable-landscape--cellulosekarton-med-fiberst-bt-indl-g",
    ],
    variantValueIds: ["a141610e-f394-436b-9cd0-0df6393ca242"],
  },
  {
    key: "coupon-a4-landscape-2-page",
    modelKey: "kuponjulekalender",
    modelValueId: "188d07f3-8403-414d-8780-a4c416f9346a",
    variantKeys: [
      "kuponjulekalender--a4-landscape-2-page--300-g-m-mat-kvalitetstryk",
    ],
    variantValueIds: ["fee33034-c639-4971-b99e-ccb0ed85cb2d"],
  },
  {
    key: "coupon-a5-landscape-4-page",
    modelKey: "kuponjulekalender",
    modelValueId: "188d07f3-8403-414d-8780-a4c416f9346a",
    variantKeys: [
      "kuponjulekalender--a5-landscape-4-page--300-g-m-mat-kvalitetstryk",
    ],
    variantValueIds: ["230391eb-ad90-430a-9f77-850a48f6ad1b"],
  },
  {
    key: "multi-412x307-landscape",
    modelKey: "julekalender-multi",
    modelValueId: "4935c8a7-9b32-49a4-b6b9-4f5f706db4a1",
    variantKeys: [],
    variantValueIds: [],
  },
  {
    key: "folding-box-grid",
    modelKey: "julekalender-med-foldeaesker",
    modelValueId: "c435eb88-601d-4f76-b555-a166f630eac2",
    variantKeys: [],
    variantValueIds: [],
  },
  {
    key: "naps-tabletop-371x280",
    modelKey: "bordjulekalender-med-naps",
    modelValueId: "7f0594ac-4e87-4b1d-8da5-5ce39c6ba7f7",
    variantKeys: [],
    variantValueIds: [],
  },
  {
    key: "lindt-tabletop-434x362",
    modelKey: "lindt-lindor-bordjulekalender",
    modelValueId: "8b39ae53-c925-4e1c-8e97-2126173d525c",
    variantKeys: [],
    variantValueIds: [],
  },
  {
    key: "lindt-wall-228x167-portrait",
    modelKey: "lindt-lindor-vaegjulekalender",
    modelValueId: "4f318d15-f697-4d7f-821a-1fb57d6b836b",
    variantKeys: [],
    variantValueIds: [],
  },
  {
    key: "lindt-xmas-box-203x203",
    modelKey: "lindt-xmas-box",
    modelValueId: "72e7d70a-f3e0-449a-9091-1fda9ec8e060",
    variantKeys: [],
    variantValueIds: [],
  },
  {
    key: "lindt-book-609x261",
    modelKey: "lindt-julekalenderbog",
    modelValueId: "25da8b04-1bda-4eaa-9a5d-fe94d294bec2",
    variantKeys: [],
    variantValueIds: [],
  },
  {
    key: "beer-crate-591x494",
    modelKey: "oelkasse-julekalender",
    modelValueId: "654b7297-45d3-473d-ab43-6cc438e02c3e",
    variantKeys: [],
    variantValueIds: [],
  },
  {
    key: "ritter-landscape-565x502",
    modelKey: "ritter-sport-julekalender-klassisk",
    modelValueId: "191e601e-82c0-4c91-8db4-17475a9d66ba",
    variantKeys: [],
    variantValueIds: [],
  },
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isObjectRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function stableJson(value) {
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isObjectRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export function sha256Json(value) {
  return sha256Buffer(Buffer.from(stableJson(value)));
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || ""),
  );
}

function sortedUnique(values) {
  return Array.from(new Set(values.map(String))).sort();
}

function assertExactSet(actual, expected, label) {
  const actualSorted = sortedUnique(actual);
  const expectedSorted = sortedUnique(expected);
  assert(
    stableJson(actualSorted) === stableJson(expectedSorted),
    `${label} differs: expected ${expectedSorted.join(", ")}; received ${actualSorted.join(", ")}`,
  );
}

export function buildDefaultAssetManifest() {
  return {
    schemaVersion: 1,
    hero: "hero/presentation-b.png",
    groups: EXPECTED_SHOWCASE_GROUPS.map((group) => ({
      key: group.key,
      images: Object.fromEntries(
        REQUIRED_DESIGNS.map((design) => [design, `groups/${group.key}/${design}.png`]),
      ),
    })),
  };
}

export function validateAssetManifest(input) {
  assert(isObjectRecord(input), "Showcase asset manifest must be a JSON object");
  assert(input.schemaVersion === 1, "Showcase asset manifest schemaVersion must be 1");
  assert(typeof input.hero === "string" && input.hero.trim(), "Showcase hero path is required");
  assert(Array.isArray(input.groups), "Showcase asset manifest groups must be an array");
  assert(
    input.groups.length === EXPECTED_SHOWCASE_GROUPS.length,
    `Showcase asset manifest must contain exactly ${EXPECTED_SHOWCASE_GROUPS.length} groups`,
  );

  const expectedKeys = EXPECTED_SHOWCASE_GROUPS.map((group) => group.key);
  const receivedKeys = input.groups.map((group) => group?.key);
  assertExactSet(receivedKeys, expectedKeys, "Showcase group inventory");
  assert(receivedKeys.length === new Set(receivedKeys).size, "Showcase group keys must be unique");

  const groupsByKey = new Map();
  for (const group of input.groups) {
    assert(isObjectRecord(group), "Every showcase group must be an object");
    assert(typeof group.key === "string", "Every showcase group needs a key");
    assert(isObjectRecord(group.images), `${group.key}: images must be an object`);
    assertExactSet(Object.keys(group.images), REQUIRED_DESIGNS, `${group.key}: design inventory`);
    for (const design of REQUIRED_DESIGNS) {
      assert(
        typeof group.images[design] === "string" && group.images[design].trim(),
        `${group.key}/${design}: image path is required`,
      );
    }
    groupsByKey.set(group.key, {
      key: group.key,
      images: Object.fromEntries(
        REQUIRED_DESIGNS.map((design) => [design, group.images[design].trim()]),
      ),
    });
  }

  return {
    schemaVersion: 1,
    hero: input.hero.trim(),
    groups: EXPECTED_SHOWCASE_GROUPS.map((group) => groupsByKey.get(group.key)),
  };
}

function assertContainedPath(rootPath, candidatePath, label) {
  const relative = path.relative(rootPath, candidatePath);
  assert(
    relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative),
    `${label} must stay inside ${rootPath}`,
  );
}

function resolveConfinedAssetPath(assetsDir, relativePath, label) {
  assert(!path.isAbsolute(relativePath), `${label} must be a relative path`);
  const absoluteRoot = path.resolve(assetsDir);
  const absolutePath = path.resolve(absoluteRoot, relativePath);
  assertContainedPath(absoluteRoot, absolutePath, label);
  assert(fs.existsSync(absolutePath), `${label} is missing: ${absolutePath}`);

  const stat = fs.lstatSync(absolutePath);
  assert(!stat.isSymbolicLink(), `${label} must not be a symbolic link`);
  assert(stat.isFile(), `${label} must be a regular file`);

  const realRoot = fs.realpathSync(absoluteRoot);
  const realPath = fs.realpathSync(absolutePath);
  assertContainedPath(realRoot, realPath, label);
  return realPath;
}

export function inspectPngAsset(filePath, label = filePath) {
  const bytes = fs.readFileSync(filePath);
  assert(bytes.length > 24, `${label} is not a complete PNG image`);
  assert(bytes.length <= MAX_ASSET_BYTES, `${label} exceeds the 5 MiB product-images limit`);
  assert(
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    `${label} must contain PNG bytes`,
  );
  assert(bytes.subarray(12, 16).toString("ascii") === "IHDR", `${label} has no PNG IHDR chunk`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  assert(width > 0 && height > 0, `${label} has invalid PNG dimensions`);

  return {
    bytes,
    byteLength: bytes.length,
    sha256: sha256Buffer(bytes),
    width,
    height,
    contentType: "image/png",
  };
}

export function buildAssetObjectPath({ role, groupKey = null, design = null, sha256 }) {
  assert(/^[a-f0-9]{64}$/i.test(String(sha256 || "")), "Asset SHA-256 must contain 64 hex characters");
  const base = `advent-calendars-2026/${TARGET_SLUG}/showcase/v1`;
  if (role === "hero") return `${base}/hero/presentation-b-${sha256}.png`;
  assert(role === "example", `Unsupported showcase asset role: ${role}`);
  assert(groupKey && design, "Example assets need a group key and design key");
  return `${base}/groups/${groupKey}/${design}-${sha256}.png`;
}

export function buildAssetPlan({ assetsDir, assetManifest }) {
  const manifest = validateAssetManifest(assetManifest);
  const entries = [];
  const usedLocalPaths = new Set();

  const addEntry = ({ role, relativePath, groupKey = null, design = null, expectedName }) => {
    assert(path.basename(relativePath) === expectedName, `${role}/${groupKey || "hero"}: expected ${expectedName}`);
    const localPath = resolveConfinedAssetPath(assetsDir, relativePath, `${role}/${groupKey || "hero"}`);
    assert(!usedLocalPaths.has(localPath), `Showcase asset path is reused: ${localPath}`);
    usedLocalPaths.add(localPath);
    const inspected = inspectPngAsset(localPath, `${role}/${groupKey || "hero"}/${design || "presentation-b"}`);
    entries.push({
      role,
      groupKey,
      design,
      relativePath,
      localPath,
      byteLength: inspected.byteLength,
      width: inspected.width,
      height: inspected.height,
      sha256: inspected.sha256,
      contentType: inspected.contentType,
      objectPath: buildAssetObjectPath({ role, groupKey, design, sha256: inspected.sha256 }),
    });
  };

  addEntry({
    role: "hero",
    relativePath: manifest.hero,
    expectedName: "presentation-b.png",
  });
  for (const group of manifest.groups) {
    for (const design of REQUIRED_DESIGNS) {
      addEntry({
        role: "example",
        groupKey: group.key,
        design,
        relativePath: group.images[design],
        expectedName: `${design}.png`,
      });
    }
  }

  const objectPaths = entries.map((entry) => entry.objectPath);
  assert(objectPaths.length === new Set(objectPaths).size, "Showcase storage object paths must be unique");
  assert(
    entries.length === 1 + (EXPECTED_SHOWCASE_GROUPS.length * REQUIRED_DESIGNS.length),
    "Showcase asset plan must contain one hero and three examples for every group",
  );
  return { manifest, entries };
}

function productInfoBaseBlock({ id, type, title = "" }) {
  return {
    id,
    type,
    title,
    text: "",
    imageUrl: "",
    caption: "",
    images: [],
    effect: "fade",
    intervalMs: 4500,
    format: "",
    configuration: "",
    placement: "left",
  };
}

function assertPublicProductImageUrl(url, label) {
  assert(
    typeof url === "string"
      && /^https:\/\//i.test(url)
      && url.includes("/storage/v1/object/public/product-images/"),
    `${label} must be a public product-images HTTPS URL`,
  );
}

export function buildShowcaseAssetUrls(entries, publicUrlForObjectPath) {
  const hero = entries.find((entry) => entry.role === "hero");
  assert(hero, "Showcase asset plan is missing its hero");
  const result = {
    hero: publicUrlForObjectPath(hero.objectPath),
    groups: {},
  };
  assertPublicProductImageUrl(result.hero, "Showcase hero URL");

  for (const group of EXPECTED_SHOWCASE_GROUPS) {
    result.groups[group.key] = {};
    for (const design of REQUIRED_DESIGNS) {
      const entry = entries.find((candidate) => (
        candidate.role === "example"
        && candidate.groupKey === group.key
        && candidate.design === design
      ));
      assert(entry, `${group.key}/${design}: asset plan entry is missing`);
      const publicUrl = publicUrlForObjectPath(entry.objectPath);
      assertPublicProductImageUrl(publicUrl, `${group.key}/${design}`);
      result.groups[group.key][design] = publicUrl;
    }
  }
  return result;
}

export function buildProductInfoV2({ product, assetUrls }) {
  assert(isObjectRecord(product), "Product is required to build product_page_info_v2");
  assertPublicProductImageUrl(assetUrls?.hero, "Showcase hero URL");
  assert(isObjectRecord(assetUrls?.groups), "Showcase group URLs are required");

  const technicalSpecs = product.technical_specs;
  assert(isObjectRecord(technicalSpecs), `${TARGET_SLUG}: technical_specs must be an object`);
  const existing = technicalSpecs.product_page_info_v2;
  assert(
    existing === undefined || existing === null || isObjectRecord(existing),
    `${TARGET_SLUG}: existing product_page_info_v2 is malformed`,
  );
  if (isObjectRecord(existing) && existing.blocks !== undefined) {
    assert(Array.isArray(existing.blocks), `${TARGET_SLUG}: existing product_page_info_v2.blocks is malformed`);
  }

  const unmanagedBlocks = (Array.isArray(existing?.blocks) ? existing.blocks : [])
    .filter((block) => {
      assert(isObjectRecord(block), `${TARGET_SLUG}: existing product info block is malformed`);
      assert(typeof block.id === "string" && block.id, `${TARGET_SLUG}: every existing product info block needs an id`);
      return !block.id.startsWith(MANAGED_BLOCK_PREFIX);
    })
    .map(clone);

  const intro = {
    ...productInfoBaseBlock({ id: `${MANAGED_BLOCK_PREFIX}intro`, type: "text" }),
    text: typeof product.about_description === "string" ? product.about_description : "",
  };
  const galleries = EXPECTED_SHOWCASE_GROUPS.map((group) => {
    const urls = assetUrls.groups[group.key];
    assert(isObjectRecord(urls), `${group.key}: showcase URLs are missing`);
    const images = REQUIRED_DESIGNS.map((design) => {
      const url = urls[design];
      assertPublicProductImageUrl(url, `${group.key}/${design}`);
      return url;
    });
    const showWhen = [{ sectionId: MODEL_SECTION_ID, valueIds: [group.modelValueId] }];
    if (group.variantValueIds.length > 0) {
      showWhen.push({
        sectionId: VARIANT_SECTION_ID,
        valueIds: [...group.variantValueIds],
      });
    }
    return {
      ...productInfoBaseBlock({
        id: `${MANAGED_BLOCK_PREFIX}${group.key}`,
        type: "gallery",
        title: "Tre designidéer til den valgte kalendermodel",
      }),
      images,
      galleryLayout: "grid",
      showWhen,
    };
  });

  return {
    useSections: true,
    imagePosition: existing?.imagePosition === "below" ? "below" : "above",
    blocks: [intro, ...galleries, ...unmanagedBlocks],
  };
}

export function buildProductPatch({ product, assetUrls }) {
  const productInfoV2 = buildProductInfoV2({ product, assetUrls });
  return {
    image_url: assetUrls.hero,
    technical_specs: {
      ...clone(product.technical_specs),
      product_page_info_v2: productInfoV2,
    },
  };
}

function productWithoutAllowedChanges(product) {
  return Object.fromEntries(
    Object.entries(product).filter(([key]) => ![
      "image_url",
      "technical_specs",
      "updated_at",
      "updated_by",
    ].includes(key)),
  );
}

function technicalSpecsWithoutProductInfo(technicalSpecs) {
  assert(isObjectRecord(technicalSpecs), `${TARGET_SLUG}: technical_specs must be an object`);
  const result = clone(technicalSpecs);
  delete result.product_page_info_v2;
  return result;
}

export function fingerprintProtectedState(state) {
  assert(isObjectRecord(state?.product), "Protected-state fingerprint needs a product row");
  assert(Array.isArray(state?.prices), "Protected-state fingerprint needs price rows");
  const { product, prices } = state;
  return {
    productUnrelatedSha256: sha256Json(productWithoutAllowedChanges(product)),
    pricingStructureSha256: sha256Json(product.pricing_structure),
    templateFilesSha256: sha256Json(product.template_files),
    technicalSpecsExceptProductInfoSha256: sha256Json(
      technicalSpecsWithoutProductInfo(product.technical_specs),
    ),
    priceRowsSha256: sha256Json(prices),
    priceRows: prices.length,
    templateFiles: Array.isArray(product.template_files) ? product.template_files.length : null,
    isPublished: product.is_published,
    isReady: product.is_ready,
    isAvailableToTenants: product.is_available_to_tenants,
  };
}

export function assertProtectedStateUnchanged(before, after) {
  const beforeFingerprint = fingerprintProtectedState(before);
  const afterFingerprint = fingerprintProtectedState(after);
  assert(
    stableJson(afterFingerprint) === stableJson(beforeFingerprint),
    `Protected product state changed: before=${stableJson(beforeFingerprint)} after=${stableJson(afterFingerprint)}`,
  );
  return { before: beforeFingerprint, after: afterFingerprint };
}

function findPricingSection(pricingStructure, sectionId) {
  const sections = [
    pricingStructure?.vertical_axis,
    ...(Array.isArray(pricingStructure?.layout_rows)
      ? pricingStructure.layout_rows.flatMap((row) => (Array.isArray(row?.columns) ? row.columns : []))
      : []),
  ].filter(isObjectRecord);
  return sections.find((section) => section.id === sectionId || section.sectionId === sectionId) || null;
}

function sourceKeyForAttributeValue(value) {
  if (typeof value?.meta?.sourceKey === "string" && value.meta.sourceKey) return value.meta.sourceKey;
  return typeof value?.key === "string" ? value.key : "";
}

export function validateTargetState(state) {
  const { product, prices, attributeValues } = state;
  assert(isObjectRecord(product), `${TARGET_SLUG}: target product is missing`);
  assert(product.id === TARGET_PRODUCT_ID, `${TARGET_SLUG}: target product id changed`);
  assert(product.tenant_id === MASTER_TENANT_ID, `${TARGET_SLUG}: target tenant changed`);
  assert(product.slug === TARGET_SLUG, `${TARGET_SLUG}: target slug changed`);
  assert(product.is_published === false, `${TARGET_SLUG}: refusing to change a published product`);
  assert(product.is_ready === false, `${TARGET_SLUG}: refusing to change a ready product`);
  assert(
    product.is_available_to_tenants === true,
    `${TARGET_SLUG}: tenant availability changed before showcase import`,
  );
  assert(
    product.technical_specs?.supplierProductKey === TARGET_SOURCE_KEY,
    `${TARGET_SLUG}: supplier product key changed`,
  );
  assert(Array.isArray(product.template_files), `${TARGET_SLUG}: template_files must be an array`);
  assert(product.template_files.length === 28, `${TARGET_SLUG}: expected 28 template files`);
  assert(Array.isArray(prices) && prices.length === 514, `${TARGET_SLUG}: expected 514 price rows`);
  assert(Array.isArray(attributeValues), `${TARGET_SLUG}: attribute values are missing`);
  assert(typeof product.updated_at === "string" && product.updated_at, `${TARGET_SLUG}: updated_at is missing`);

  const modelSection = findPricingSection(product.pricing_structure, MODEL_SECTION_ID);
  const variantSection = findPricingSection(product.pricing_structure, VARIANT_SECTION_ID);
  assert(modelSection, `${TARGET_SLUG}: ${MODEL_SECTION_ID} is missing`);
  assert(variantSection, `${TARGET_SLUG}: ${VARIANT_SECTION_ID} is missing`);
  assert(Array.isArray(modelSection.valueIds), `${MODEL_SECTION_ID}: valueIds are missing`);
  assert(Array.isArray(variantSection.valueIds), `${VARIANT_SECTION_ID}: valueIds are missing`);
  assert(modelSection.valueIds.length === 14, `${MODEL_SECTION_ID}: expected 14 model ids`);
  assert(variantSection.valueIds.length === 30, `${VARIANT_SECTION_ID}: expected 30 variant ids`);

  const expectedModelIds = sortedUnique(EXPECTED_SHOWCASE_GROUPS.map((group) => group.modelValueId));
  assertExactSet(modelSection.valueIds, expectedModelIds, `${MODEL_SECTION_ID}: canonical model ids`);
  const expectedConditionalVariantIds = sortedUnique(
    EXPECTED_SHOWCASE_GROUPS.flatMap((group) => group.variantValueIds),
  );
  for (const valueId of expectedConditionalVariantIds) {
    assert(variantSection.valueIds.includes(valueId), `${VARIANT_SECTION_ID}: missing ${valueId}`);
  }

  const valuesById = new Map(attributeValues.map((value) => [value.id, value]));
  for (const group of EXPECTED_SHOWCASE_GROUPS) {
    assert(isUuid(group.modelValueId), `${group.key}: model value id is not a UUID`);
    const modelValue = valuesById.get(group.modelValueId);
    assert(modelValue, `${group.key}: canonical model value is missing from the database`);
    assert(modelValue.product_id === TARGET_PRODUCT_ID, `${group.key}: model value belongs to another product`);
    assert(modelValue.group_id === modelSection.groupId, `${group.key}: model value belongs to another group`);
    assert(modelValue.enabled !== false, `${group.key}: model value is disabled`);
    assert(sourceKeyForAttributeValue(modelValue) === group.modelKey, `${group.key}: model source key changed`);

    assert(group.variantKeys.length === group.variantValueIds.length, `${group.key}: variant contract is malformed`);
    group.variantValueIds.forEach((variantValueId, index) => {
      assert(isUuid(variantValueId), `${group.key}: variant value id is not a UUID`);
      const variantValue = valuesById.get(variantValueId);
      assert(variantValue, `${group.key}: canonical variant value is missing from the database`);
      assert(variantValue.product_id === TARGET_PRODUCT_ID, `${group.key}: variant value belongs to another product`);
      assert(variantValue.group_id === variantSection.groupId, `${group.key}: variant value belongs to another group`);
      assert(variantValue.enabled !== false, `${group.key}: variant value is disabled`);
      assert(
        sourceKeyForAttributeValue(variantValue) === group.variantKeys[index],
        `${group.key}: variant source key changed for ${variantValueId}`,
      );
    });
  }

  return {
    models: modelSection.valueIds.length,
    variants: variantSection.valueIds.length,
    prices: prices.length,
    templates: product.template_files.length,
    showcaseGroups: EXPECTED_SHOWCASE_GROUPS.length,
  };
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

export async function loadTargetState(client) {
  const product = await requireQuery(
    client
      .from("products")
      .select("*")
      .eq("tenant_id", MASTER_TENANT_ID)
      .eq("id", TARGET_PRODUCT_ID)
      .eq("slug", TARGET_SLUG)
      .single(),
    "Read combined calendar product",
  );
  const [prices, attributeGroups, attributeValues] = await Promise.all([
    requireQuery(
      client
        .from("generic_product_prices")
        .select("*")
        .eq("tenant_id", MASTER_TENANT_ID)
        .eq("product_id", TARGET_PRODUCT_ID)
        .order("variant_name")
        .order("variant_value")
        .order("quantity")
        .order("id"),
      "Read combined calendar prices",
    ),
    requireQuery(
      client
        .from("product_attribute_groups")
        .select("*")
        .eq("tenant_id", MASTER_TENANT_ID)
        .eq("product_id", TARGET_PRODUCT_ID)
        .order("sort_order")
        .order("id"),
      "Read combined calendar attribute groups",
    ),
    requireQuery(
      client
        .from("product_attribute_values")
        .select("*")
        .eq("tenant_id", MASTER_TENANT_ID)
        .eq("product_id", TARGET_PRODUCT_ID)
        .order("group_id")
        .order("sort_order")
        .order("id"),
      "Read combined calendar attribute values",
    ),
  ]);
  return { product, prices, attributeGroups, attributeValues };
}

function storageObjectNotFound(error) {
  const message = String(error?.message || error?.error || "").toLowerCase();
  const status = Number(error?.statusCode || error?.status || 0);
  return status === 404 || message.includes("not found") || message.includes("object not found");
}

async function downloadStorageBytes(client, objectPath) {
  const { data, error } = await client.storage.from(PRODUCT_IMAGES_BUCKET).download(objectPath);
  if (error) return { data: null, error };
  return { data: Buffer.from(await data.arrayBuffer()), error: null };
}

export async function uploadImmutableAsset(client, entry) {
  const localBytes = fs.readFileSync(entry.localPath);
  assert(sha256Buffer(localBytes) === entry.sha256, `${entry.relativePath}: local bytes changed after validation`);

  const existing = await downloadStorageBytes(client, entry.objectPath);
  if (!existing.error) {
    assert(
      sha256Buffer(existing.data) === entry.sha256,
      `${entry.objectPath}: existing immutable object has different bytes`,
    );
    return { status: "reused", objectPath: entry.objectPath };
  }
  assert(storageObjectNotFound(existing.error), `Read ${entry.objectPath}: ${existing.error.message}`);

  const { error: uploadError } = await client.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(entry.objectPath, localBytes, {
      contentType: "image/png",
      cacheControl: "31536000",
      upsert: false,
    });
  if (uploadError) {
    const raced = await downloadStorageBytes(client, entry.objectPath);
    if (!raced.error && sha256Buffer(raced.data) === entry.sha256) {
      return { status: "reused-after-race", objectPath: entry.objectPath };
    }
    throw new Error(`Upload ${entry.objectPath}: ${uploadError.message}`);
  }

  const verified = await downloadStorageBytes(client, entry.objectPath);
  if (verified.error) throw new Error(`Verify ${entry.objectPath}: ${verified.error.message}`);
  assert(sha256Buffer(verified.data) === entry.sha256, `${entry.objectPath}: uploaded bytes failed SHA-256 verification`);
  return { status: "uploaded", objectPath: entry.objectPath };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function writeBeforeSnapshot({ outputDir, state, protectedFingerprint, assetPlan }) {
  const capturedAt = new Date().toISOString();
  const snapshot = {
    schemaVersion: 1,
    capturedAt,
    purpose: "Pre-write snapshot for the visual-only Christmas-calendar showcase import",
    rollbackNote:
      "If a manual rollback is required, restore only targetBefore.product.image_url and targetBefore.product.technical_specs after checking updated_at. Do not restore prices, templates, publication, readiness, tenant availability, attributes or source products from this file.",
    intendedDatabaseColumns: ["image_url", "technical_specs"],
    protectedFingerprint,
    assetPlan: assetPlan.entries.map((entry) => ({
      role: entry.role,
      groupKey: entry.groupKey,
      design: entry.design,
      relativePath: entry.relativePath,
      objectPath: entry.objectPath,
      sha256: entry.sha256,
      byteLength: entry.byteLength,
      width: entry.width,
      height: entry.height,
    })),
    targetBefore: state,
  };
  const snapshotPath = path.join(
    outputDir,
    "rollback",
    `showcase-before-${timestampForPath(new Date(capturedAt))}.json`,
  );
  writeJson(snapshotPath, snapshot);
  return { snapshotPath, snapshotSha256: sha256Buffer(fs.readFileSync(snapshotPath)) };
}

async function updateProductWithGuards(client, beforeProduct, patch) {
  const { data, error } = await client
    .from("products")
    .update(patch)
    .eq("tenant_id", MASTER_TENANT_ID)
    .eq("id", TARGET_PRODUCT_ID)
    .eq("slug", TARGET_SLUG)
    .eq("updated_at", beforeProduct.updated_at)
    .eq("is_published", false)
    .eq("is_ready", false)
    .eq("is_available_to_tenants", true)
    .contains("technical_specs", { supplierProductKey: TARGET_SOURCE_KEY })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(`Guarded showcase product update: ${error.message}`);
  assert(
    data,
    `${TARGET_SLUG}: guarded update matched no row; the product changed concurrently or a safety guard failed`,
  );
  return data;
}

function parseArgs(argv) {
  const args = {
    assetsDir: DEFAULT_ASSETS_DIR,
    assetManifestPath: null,
    outputDir: DEFAULT_OUTPUT_DIR,
    writeShowcase: false,
    help: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--assets-dir") {
      assert(argv[index + 1], "--assets-dir requires a path");
      args.assetsDir = path.resolve(argv[++index]);
    } else if (argument === "--asset-manifest") {
      assert(argv[index + 1], "--asset-manifest requires a path");
      args.assetManifestPath = path.resolve(argv[++index]);
    } else if (argument === "--output-dir") {
      assert(argv[index + 1], "--output-dir requires a path");
      args.outputDir = path.resolve(argv[++index]);
    } else if (argument === "--write-showcase") {
      args.writeShowcase = true;
    } else if (argument === "--help" || argument === "-h") {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/product-import/apply-wmd-advent-calendar-showcase.js [--assets-dir PATH] [--asset-manifest PATH]
  node scripts/product-import/apply-wmd-advent-calendar-showcase.js [--assets-dir PATH] [--asset-manifest PATH] --write-showcase

Default mode is read-only. It validates the exact 19-group/58-image asset inventory,
the current database target and all protected fingerprints, then prints the planned
public URLs and product fields. --write-showcase is the only flag that permits
immutable Storage uploads and the guarded two-column product update.`);
}

function loadAssetManifest(args) {
  if (!args.assetManifestPath) return buildDefaultAssetManifest();
  assert(fs.existsSync(args.assetManifestPath), `Asset manifest is missing: ${args.assetManifestPath}`);
  return JSON.parse(fs.readFileSync(args.assetManifestPath, "utf8"));
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const assetPlan = buildAssetPlan({
    assetsDir: args.assetsDir,
    assetManifest: loadAssetManifest(args),
  });
  const { url, serviceRoleKey } = getSupabaseEnv();
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const before = await loadTargetState(client);
  const validation = validateTargetState(before);
  const protectedBefore = fingerprintProtectedState(before);
  const publicUrlForObjectPath = (objectPath) => (
    client.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(objectPath).data.publicUrl
  );
  const plannedAssetUrls = buildShowcaseAssetUrls(assetPlan.entries, publicUrlForObjectPath);
  const plannedPatch = buildProductPatch({ product: before.product, assetUrls: plannedAssetUrls });
  assertExactSet(Object.keys(plannedPatch), ["image_url", "technical_specs"], "Product patch columns");

  const planSummary = {
    mode: args.writeShowcase ? "write-showcase" : "dry-run",
    targetProductId: TARGET_PRODUCT_ID,
    targetSlug: TARGET_SLUG,
    assetsDir: args.assetsDir,
    assetManifestPath: args.assetManifestPath,
    validation,
    assets: assetPlan.entries.length,
    heroAssets: assetPlan.entries.filter((entry) => entry.role === "hero").length,
    exampleAssets: assetPlan.entries.filter((entry) => entry.role === "example").length,
    showcaseGroups: EXPECTED_SHOWCASE_GROUPS.length,
    productPatchColumns: Object.keys(plannedPatch),
    protectedBefore,
    storageWrites: args.writeShowcase ? "explicitly enabled" : 0,
    productWrites: args.writeShowcase ? "explicitly enabled" : 0,
    pricingWrites: 0,
    templateWrites: 0,
    publicationWrites: 0,
    tenantAvailabilityWrites: 0,
  };
  console.log(JSON.stringify(planSummary, null, 2));
  if (!args.writeShowcase) return;

  const snapshot = writeBeforeSnapshot({
    outputDir: args.outputDir,
    state: before,
    protectedFingerprint: protectedBefore,
    assetPlan,
  });
  const uploadResults = [];
  for (const entry of assetPlan.entries) {
    uploadResults.push(await uploadImmutableAsset(client, entry));
  }

  await updateProductWithGuards(client, before.product, plannedPatch);
  const after = await loadTargetState(client);
  validateTargetState(after);
  const protectedProof = assertProtectedStateUnchanged(before, after);
  assert(after.product.image_url === plannedPatch.image_url, `${TARGET_SLUG}: hero URL was not stored`);
  assert(
    stableJson(after.product.technical_specs?.product_page_info_v2)
      === stableJson(plannedPatch.technical_specs.product_page_info_v2),
    `${TARGET_SLUG}: product_page_info_v2 differs after write`,
  );

  const completedAt = new Date().toISOString();
  const summary = {
    schemaVersion: 1,
    completedAt,
    mode: "write-complete",
    targetProductId: TARGET_PRODUCT_ID,
    targetSlug: TARGET_SLUG,
    changedDatabaseColumns: ["image_url", "technical_specs"],
    managedTechnicalSpecsKey: "product_page_info_v2",
    showcaseGroups: EXPECTED_SHOWCASE_GROUPS.length,
    assets: assetPlan.entries.length,
    uploadedAssets: uploadResults.filter((result) => result.status === "uploaded").length,
    reusedAssets: uploadResults.filter((result) => result.status !== "uploaded").length,
    protectedProof,
    snapshotPath: snapshot.snapshotPath,
    snapshotSha256: snapshot.snapshotSha256,
    pricingWrites: 0,
    templateWrites: 0,
    publicationWrites: 0,
    tenantAvailabilityWrites: 0,
  };
  const summaryPath = path.join(
    args.outputDir,
    "review",
    `showcase-write-${timestampForPath(new Date(completedAt))}.json`,
  );
  writeJson(summaryPath, summary);
  console.log(JSON.stringify({ ...summary, summaryPath }, null, 2));
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
