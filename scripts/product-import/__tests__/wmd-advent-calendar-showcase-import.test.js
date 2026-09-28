import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  EXPECTED_SHOWCASE_GROUPS,
  MANAGED_BLOCK_PREFIX,
  MASTER_TENANT_ID,
  MAX_ASSET_BYTES,
  MODEL_SECTION_ID,
  REQUIRED_DESIGNS,
  TARGET_PRODUCT_ID,
  TARGET_SLUG,
  TARGET_SOURCE_KEY,
  VARIANT_SECTION_ID,
  assertProtectedStateUnchanged,
  buildAssetObjectPath,
  buildAssetPlan,
  buildDefaultAssetManifest,
  buildProductInfoV2,
  buildProductPatch,
  buildShowcaseAssetUrls,
  fingerprintProtectedState,
  inspectPngAsset,
  uploadImmutableAsset,
  validateAssetManifest,
  validateTargetState,
} from "../apply-wmd-advent-calendar-showcase.js";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function publicUrl(objectPath) {
  return `https://assets.example.test/storage/v1/object/public/product-images/${objectPath}`;
}

function createAssetFixture() {
  const assetsDir = fs.mkdtempSync(path.join(os.tmpdir(), "calendar-showcase-assets-"));
  const manifest = buildDefaultAssetManifest();
  const relativePaths = [
    manifest.hero,
    ...manifest.groups.flatMap((group) => REQUIRED_DESIGNS.map((design) => group.images[design])),
  ];
  for (const relativePath of relativePaths) {
    const absolutePath = path.join(assetsDir, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, ONE_PIXEL_PNG);
  }
  return { assetsDir, manifest };
}

function createTargetState() {
  const modelGroupId = "model-group";
  const variantGroupId = "variant-group";
  const modelValueIds = Array.from(new Set(
    EXPECTED_SHOWCASE_GROUPS.map((group) => group.modelValueId),
  ));
  const protectedVariantIds = EXPECTED_SHOWCASE_GROUPS.flatMap((group) => group.variantValueIds);
  const fillerVariantIds = Array.from(
    { length: 30 - protectedVariantIds.length },
    (_, index) => `unscoped-variant-${String(index + 1).padStart(2, "0")}`,
  );
  const pricingStructure = {
    mode: "matrix_layout_v1",
    version: 1,
    vertical_axis: {
      sectionId: "calendar-technical-axis",
      groupId: "technical-group",
      valueIds: ["technical-value"],
    },
    layout_rows: [
      {
        columns: [{
          id: MODEL_SECTION_ID,
          groupId: modelGroupId,
          valueIds: modelValueIds,
        }],
      },
      {
        columns: [{
          id: VARIANT_SECTION_ID,
          groupId: variantGroupId,
          valueIds: [...protectedVariantIds, ...fillerVariantIds],
        }],
      },
    ],
  };
  const attributeValues = [];
  const seenModels = new Set();
  for (const group of EXPECTED_SHOWCASE_GROUPS) {
    if (!seenModels.has(group.modelValueId)) {
      seenModels.add(group.modelValueId);
      attributeValues.push({
        id: group.modelValueId,
        tenant_id: MASTER_TENANT_ID,
        product_id: TARGET_PRODUCT_ID,
        group_id: modelGroupId,
        key: group.modelKey,
        enabled: true,
        meta: { sourceKey: group.modelKey },
      });
    }
    group.variantValueIds.forEach((id, index) => {
      attributeValues.push({
        id,
        tenant_id: MASTER_TENANT_ID,
        product_id: TARGET_PRODUCT_ID,
        group_id: variantGroupId,
        key: group.variantKeys[index],
        enabled: true,
        meta: { sourceKey: group.variantKeys[index] },
      });
    });
  }

  const product = {
    id: TARGET_PRODUCT_ID,
    tenant_id: MASTER_TENANT_ID,
    slug: TARGET_SLUG,
    name: "Julekalendere med eget design",
    description: "Produktbeskrivelse",
    category: "Julekalendere",
    pricing_type: "matrix",
    pricing_structure: pricingStructure,
    image_url: publicUrl("old-hero.png"),
    about_title: "Julekalendere med dit eget design",
    about_description: "Eksisterende tekst skal bevares i den nye sektion.",
    about_image_url: publicUrl("old-about.png"),
    template_files: Array.from({ length: 28 }, (_, index) => ({
      id: `template-${index + 1}`,
      templatePdfSha256: `hash-${index + 1}`,
      lockedInDesigner: true,
    })),
    technical_specs: {
      supplierProductKey: TARGET_SOURCE_KEY,
      priceRows: 514,
      unrelatedSetting: { preserve: true },
    },
    is_published: false,
    is_ready: false,
    is_available_to_tenants: true,
    updated_at: "2026-08-28T07:15:01.942193+00:00",
    updated_by: null,
  };
  const prices = Array.from({ length: 514 }, (_, index) => ({
    id: `price-${String(index + 1).padStart(3, "0")}`,
    tenant_id: MASTER_TENANT_ID,
    product_id: TARGET_PRODUCT_ID,
    variant_name: `variant-${Math.floor(index / 20)}`,
    variant_value: `format-${index % 4}`,
    quantity: index + 1,
    price_dkk: 100 + index,
    extra_data: { sourceOrder: index },
  }));
  return {
    product,
    prices,
    attributeGroups: [
      { id: modelGroupId, product_id: TARGET_PRODUCT_ID },
      { id: variantGroupId, product_id: TARGET_PRODUCT_ID },
    ],
    attributeValues,
  };
}

test("showcase contract contains exactly 19 physical groups and three required designs", () => {
  assert.equal(EXPECTED_SHOWCASE_GROUPS.length, 19);
  assert.deepEqual(REQUIRED_DESIGNS, ["child", "dentist", "football"]);
  assert.equal(new Set(EXPECTED_SHOWCASE_GROUPS.map((group) => group.key)).size, 19);
  assert.equal(new Set(EXPECTED_SHOWCASE_GROUPS.map((group) => group.modelValueId)).size, 14);
  assert.equal(EXPECTED_SHOWCASE_GROUPS.filter((group) => group.variantValueIds.length > 0).length, 10);
  assert.equal(EXPECTED_SHOWCASE_GROUPS.filter((group) => group.variantValueIds.length === 0).length, 9);
});

test("asset manifest rejects missing, extra and misspelled showcase groups", () => {
  const valid = buildDefaultAssetManifest();
  assert.equal(validateAssetManifest(valid).groups.length, 19);

  assert.throws(
    () => validateAssetManifest({ ...valid, groups: valid.groups.slice(1) }),
    /exactly 19 groups/,
  );
  assert.throws(
    () => validateAssetManifest({
      ...valid,
      groups: valid.groups.map((group, index) => (
        index === 0 ? { ...group, key: "wrong-group" } : group
      )),
    }),
    /Showcase group inventory differs/,
  );
  assert.throws(
    () => validateAssetManifest({
      ...valid,
      groups: valid.groups.map((group, index) => (
        index === 0
          ? { ...group, images: { ...group.images, extra: "extra.png" } }
          : group
      )),
    }),
    /design inventory differs/,
  );
});

test("asset plan requires one PNG hero and 57 group-specific PNG examples", () => {
  const fixture = createAssetFixture();
  try {
    const plan = buildAssetPlan({
      assetsDir: fixture.assetsDir,
      assetManifest: fixture.manifest,
    });
    assert.equal(plan.entries.length, 58);
    assert.equal(plan.entries.filter((entry) => entry.role === "hero").length, 1);
    assert.equal(plan.entries.filter((entry) => entry.role === "example").length, 57);
    assert.equal(new Set(plan.entries.map((entry) => entry.localPath)).size, 58);
    assert.ok(plan.entries.every((entry) => entry.byteLength <= MAX_ASSET_BYTES));
    assert.ok(plan.entries.every((entry) => entry.objectPath.includes(entry.sha256)));
    assert.equal(
      plan.entries.find((entry) => entry.role === "hero").objectPath,
      buildAssetObjectPath({
        role: "hero",
        sha256: plan.entries.find((entry) => entry.role === "hero").sha256,
      }),
    );
  } finally {
    fs.rmSync(fixture.assetsDir, { recursive: true, force: true });
  }
});

test("PNG inspection refuses assets larger than the product-images bucket limit", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "calendar-showcase-large-"));
  const oversizedPath = path.join(tempDir, "oversized.png");
  try {
    fs.writeFileSync(
      oversizedPath,
      Buffer.concat([ONE_PIXEL_PNG, Buffer.alloc(MAX_ASSET_BYTES + 1)]),
    );
    assert.throws(() => inspectPngAsset(oversizedPath), /exceeds the 5 MiB/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("product info contains one intro and 19 UUID-scoped three-image galleries", () => {
  const fixture = createAssetFixture();
  try {
    const plan = buildAssetPlan({ assetsDir: fixture.assetsDir, assetManifest: fixture.manifest });
    const assetUrls = buildShowcaseAssetUrls(plan.entries, publicUrl);
    const state = createTargetState();
    const info = buildProductInfoV2({ product: state.product, assetUrls });

    assert.equal(info.useSections, true);
    assert.equal(info.blocks.length, 20);
    assert.equal(info.blocks[0].id, `${MANAGED_BLOCK_PREFIX}intro`);
    assert.equal(info.blocks[0].text, state.product.about_description);

    const galleries = info.blocks.filter((block) => block.type === "gallery");
    assert.equal(galleries.length, 19);
    assert.ok(galleries.every((block) => block.galleryLayout === "grid"));
    assert.ok(galleries.every((block) => block.images.length === 3));

    const conditional = galleries.find((block) => (
      block.id === `${MANAGED_BLOCK_PREFIX}premium-wall-landscape`
    ));
    assert.deepEqual(conditional.showWhen, [
      {
        sectionId: MODEL_SECTION_ID,
        valueIds: ["70cdf3ab-3402-424a-a367-d370c5a7f1ce"],
      },
      {
        sectionId: VARIANT_SECTION_ID,
        valueIds: [
          "0ee498fa-3fc2-4769-90b9-40f99215c528",
          "05f65b06-2e32-46ab-bbf7-db997ce3e083",
        ],
      },
    ]);

    const modelOnly = galleries.find((block) => (
      block.id === `${MANAGED_BLOCK_PREFIX}multi-412x307-landscape`
    ));
    assert.deepEqual(modelOnly.showWhen, [{
      sectionId: MODEL_SECTION_ID,
      valueIds: ["4935c8a7-9b32-49a4-b6b9-4f5f706db4a1"],
    }]);
  } finally {
    fs.rmSync(fixture.assetsDir, { recursive: true, force: true });
  }
});

test("visual patch contains only image_url and merged technical_specs", () => {
  const fixture = createAssetFixture();
  try {
    const state = createTargetState();
    const plan = buildAssetPlan({ assetsDir: fixture.assetsDir, assetManifest: fixture.manifest });
    const assetUrls = buildShowcaseAssetUrls(plan.entries, publicUrl);
    const patch = buildProductPatch({ product: state.product, assetUrls });

    assert.deepEqual(Object.keys(patch).sort(), ["image_url", "technical_specs"]);
    assert.equal(patch.image_url, assetUrls.hero);
    assert.deepEqual(
      patch.technical_specs.unrelatedSetting,
      state.product.technical_specs.unrelatedSetting,
    );
    assert.equal(patch.technical_specs.product_page_info_v2.blocks.length, 20);
  } finally {
    fs.rmSync(fixture.assetsDir, { recursive: true, force: true });
  }
});

test("target guard validates canonical UUIDs, prices, templates and draft state", () => {
  const state = createTargetState();
  assert.deepEqual(validateTargetState(state), {
    models: 14,
    variants: 30,
    prices: 514,
    templates: 28,
    showcaseGroups: 19,
  });

  assert.throws(
    () => validateTargetState({
      ...state,
      product: { ...state.product, is_published: true },
    }),
    /refusing to change a published product/,
  );
  assert.throws(
    () => validateTargetState({
      ...state,
      product: {
        ...state.product,
        technical_specs: { ...state.product.technical_specs, supplierProductKey: "other" },
      },
    }),
    /supplier product key changed/,
  );
});

test("protected fingerprints permit only hero and product info changes", () => {
  const fixture = createAssetFixture();
  try {
    const before = createTargetState();
    const plan = buildAssetPlan({ assetsDir: fixture.assetsDir, assetManifest: fixture.manifest });
    const assetUrls = buildShowcaseAssetUrls(plan.entries, publicUrl);
    const patch = buildProductPatch({ product: before.product, assetUrls });
    const after = {
      ...before,
      product: {
        ...before.product,
        ...patch,
        updated_at: "2026-08-28T08:00:00.000000+00:00",
        updated_by: "admin-user",
      },
    };

    const proof = assertProtectedStateUnchanged(before, after);
    assert.deepEqual(proof.before, proof.after);
    assert.equal(fingerprintProtectedState(before).priceRows, 514);

    assert.throws(
      () => assertProtectedStateUnchanged(before, {
        ...after,
        product: {
          ...after.product,
          template_files: after.product.template_files.slice(1),
        },
      }),
      /Protected product state changed/,
    );
    assert.throws(
      () => assertProtectedStateUnchanged(before, {
        ...after,
        prices: after.prices.map((row, index) => (
          index === 0 ? { ...row, price_dkk: row.price_dkk + 1 } : row
        )),
      }),
      /Protected product state changed/,
    );
    assert.throws(
      () => assertProtectedStateUnchanged(before, {
        ...after,
        product: { ...after.product, is_available_to_tenants: false },
      }),
      /Protected product state changed/,
    );
  } finally {
    fs.rmSync(fixture.assetsDir, { recursive: true, force: true });
  }
});

test("immutable upload uses upsert false and reuses only byte-identical objects", async () => {
  const fixture = createAssetFixture();
  try {
    const plan = buildAssetPlan({ assetsDir: fixture.assetsDir, assetManifest: fixture.manifest });
    const entry = plan.entries[0];
    let stored = null;
    let uploadOptions = null;
    const bucket = {
      async download(objectPath) {
        assert.equal(objectPath, entry.objectPath);
        if (!stored) return { data: null, error: { statusCode: 404, message: "Object not found" } };
        return { data: new Blob([stored]), error: null };
      },
      async upload(objectPath, bytes, options) {
        assert.equal(objectPath, entry.objectPath);
        stored = Buffer.from(bytes);
        uploadOptions = options;
        return { data: { path: objectPath }, error: null };
      },
    };
    const client = {
      storage: {
        from(name) {
          assert.equal(name, "product-images");
          return bucket;
        },
      },
    };

    assert.deepEqual(await uploadImmutableAsset(client, entry), {
      status: "uploaded",
      objectPath: entry.objectPath,
    });
    assert.deepEqual(uploadOptions, {
      contentType: "image/png",
      cacheControl: "31536000",
      upsert: false,
    });
    assert.deepEqual(await uploadImmutableAsset(client, entry), {
      status: "reused",
      objectPath: entry.objectPath,
    });
  } finally {
    fs.rmSync(fixture.assetsDir, { recursive: true, force: true });
  }
});
