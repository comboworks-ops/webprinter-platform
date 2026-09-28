import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  ASSET_VERSION,
  APPROVED_PNG_MODEL_DEFINITIONS,
  CONTACT_SHEET_FILE,
  CONTACT_SHEET_HEIGHT_PX,
  CONTACT_SHEET_WIDTH_PX,
  EXCLUDED_PNG_MODEL_KEYS,
  MODEL_DEFINITIONS,
  NEUTRAL_GREY,
  PNG_MASTER_SIZE_PX,
  PNG_RASTER_MANIFEST_FILE,
  PNG_STYLE_KEY,
  PNG_UI_SIZE_PX,
  SVG_SIZE_PX,
  WEBPRINTER_BLUE,
  assertSafeRasterSourceSvg,
  buildManifest,
  inspectTransparentPng,
  renderModelSvg,
  renderReviewContactSheet,
  writeAssets,
  writePngAssets,
} from "../generate-wmd-sales-folder-model-icons.js";

const EXPECTED_MODEL_KEYS = [
  "a4--2-part-standard",
  "a4--2-part-2-flaps",
  "a4--2-part-3-flaps",
  "a4--3-part-1-flap",
  "a4--2-part-standard-window",
  "a4--2-part-2-flaps-window",
  "a4--2-part-3-flaps-window",
  "a5--2-part-standard",
  "a5--2-part-2-flaps",
  "a5--2-part-3-flaps",
  "a5--3-part-1-flap",
  "a6--2-part-2-flaps",
  "a6--2-part-3-flaps",
  "a6--2-part-closure",
  "a6--3-part-1-flap",
  "din-lang--2-part-2-flaps",
  "din-lang--2-part-3-flaps",
  "din-lang--2-part-closure",
  "square-21x21--2-part-2-flaps",
  "square-21x21--2-part-3-flaps",
  "cd-135x135--2-part-closure",
];

test("the icon evidence set contains exactly the 21 observed folder models", () => {
  assert.deepEqual(
    MODEL_DEFINITIONS.map((model) => model.key),
    EXPECTED_MODEL_KEYS
  );
  assert.equal(new Set(EXPECTED_MODEL_KEYS).size, 21);
  assert.deepEqual(
    MODEL_DEFINITIONS.map((model) => model.sourceOrder),
    Array.from({ length: 21 }, (_, index) => index)
  );
});

test("the approved PNG derivative scope contains the 20 non-CD models in source order", () => {
  assert.deepEqual(EXCLUDED_PNG_MODEL_KEYS, ["cd-135x135--2-part-closure"]);
  assert.deepEqual(
    APPROVED_PNG_MODEL_DEFINITIONS.map((model) => model.key),
    EXPECTED_MODEL_KEYS.slice(0, 20)
  );
  assert.deepEqual(
    APPROVED_PNG_MODEL_DEFINITIONS.map((model) => model.sourceOrder),
    Array.from({ length: 20 }, (_, index) => index)
  );
});

test("each icon is transparent, label-free, supplier-free and palette bounded", () => {
  for (const model of MODEL_DEFINITIONS) {
    const svg = renderModelSvg(model);
    assert.match(svg, /^<svg[^>]+viewBox="0 0 256 256"/);
    assert.match(svg, new RegExp(`width="${SVG_SIZE_PX}"`));
    assert.match(svg, new RegExp(WEBPRINTER_BLUE, "i"));
    assert.doesNotMatch(svg, /<text\b|<image\b|<foreignObject\b|<linearGradient\b|<radialGradient\b/i);
    assert.doesNotMatch(svg, /wir.?machen.?druck|webprinter|logo|background/i);

    const colors = [...svg.matchAll(/#[0-9a-f]{6}/gi)].map((match) => match[0].toUpperCase());
    assert.ok(colors.length > 0, model.key);
    assert.ok(
      colors.every((color) => [WEBPRINTER_BLUE, NEUTRAL_GREY].includes(color)),
      `${model.key}: unexpected color ${colors.join(", ")}`
    );
  }
});

test("the PNG rasterizer rejects labelled, external, branded, or off-palette SVG sources", () => {
  assert.throws(
    () => assertSafeRasterSourceSvg('<svg><text>Mappe</text></svg>', "labelled"),
    /labelled, external, or executable/
  );
  assert.throws(
    () => assertSafeRasterSourceSvg('<svg><image href="https:\/\/example.com\/icon.png"/></svg>', "external"),
    /labelled, external, or executable/
  );
  assert.throws(
    () => assertSafeRasterSourceSvg('<svg><path fill="#0EA5E9" data-name="WIRmachenDRUCK logo"/></svg>', "branded"),
    /supplier or branding/
  );
  assert.throws(
    () => assertSafeRasterSourceSvg('<svg><path fill="#FF0000"/></svg>', "palette"),
    /approved palette/
  );
});

test("format proportions and construction cues produce distinct vector output", () => {
  const byKey = new Map(MODEL_DEFINITIONS.map((model) => [model.key, model]));
  assert.notEqual(
    renderModelSvg(byKey.get("a4--2-part-2-flaps")),
    renderModelSvg(byKey.get("din-lang--2-part-2-flaps"))
  );
  assert.notEqual(
    renderModelSvg(byKey.get("a4--2-part-standard")),
    renderModelSvg(byKey.get("a4--2-part-3-flaps"))
  );
  assert.match(renderModelSvg(byKey.get("a4--2-part-standard-window")), /<rect[^>]+rx="6"/);
  assert.match(renderModelSvg(byKey.get("a6--2-part-closure")), /stroke-linecap="round"/);
  assert.equal((renderModelSvg(byKey.get("a4--3-part-1-flap")).match(/stroke-dasharray/g) || []).length, 2);
  assert.equal((renderModelSvg(byKey.get("a4--2-part-2-flaps")).match(/stroke-dasharray/g) || []).length, 1);
});

test("manifest maps every exact model key to a content-addressed SVG and backend fields", () => {
  const svgByKey = new Map(
    MODEL_DEFINITIONS.map((model) => [model.key, renderModelSvg(model)])
  );
  const manifest = buildManifest(svgByKey);
  assert.equal(manifest.assetVersion, ASSET_VERSION);
  assert.equal(manifest.optionAxis, "folder_model");
  assert.equal(manifest.modelCount, 21);
  assert.deepEqual(Object.keys(manifest.models), EXPECTED_MODEL_KEYS);
  assert.equal(manifest.backendProjection.imageField, "valueSettings[valueId].customImage");
  assert.equal(manifest.backendProjection.orderField, "section.valueIds");
  assert.equal(manifest.backendProjection.recommendedSizePx, 128);
  assert.equal(manifest.provenance.supplierAssetsCopied, false);
  assert.equal(manifest.provenance.prompt, null);
  assert.equal(manifest.reviewArtifacts.contactSheet.purpose, "review_only");
  assert.equal(manifest.reviewArtifacts.contactSheet.storefrontAsset, false);
  assert.equal(manifest.reviewArtifacts.contactSheet.backendOptionAsset, false);
  assert.equal(manifest.reviewArtifacts.contactSheet.widthPx, CONTACT_SHEET_WIDTH_PX);
  assert.equal(manifest.reviewArtifacts.contactSheet.heightPx, CONTACT_SHEET_HEIGHT_PX);
  assert.equal(manifest.reviewArtifacts.rasterDerivative.status, "not_generated");

  for (const [key, model] of Object.entries(manifest.models)) {
    const expectedSvg = svgByKey.get(key);
    const expectedHash = crypto.createHash("sha256").update(expectedSvg).digest("hex");
    assert.equal(model.modelKey, key);
    assert.equal(model.folderModelKey, key);
    assert.ok(model.formatKey);
    assert.ok(model.constructionKey);
    assert.ok(model.labelDa.includes(" · "));
    assert.equal(model.svg.sha256, expectedHash);
    assert.equal(model.svg.widthPx, SVG_SIZE_PX);
    assert.equal(model.svg.heightPx, SVG_SIZE_PX);
    assert.equal(
      model.svg.path,
      `src/assets/product-options/sales-folders/models/${ASSET_VERSION}/${key}.svg`
    );
  }
});

test("review contact sheet has a white background and Danish labels outside all 21 icons", () => {
  const svgByKey = new Map(
    MODEL_DEFINITIONS.map((model) => [model.key, renderModelSvg(model)])
  );
  const contactSheet = renderReviewContactSheet(svgByKey);
  assert.match(
    contactSheet,
    new RegExp(
      `^<svg[^>]+width="${CONTACT_SHEET_WIDTH_PX}"[^>]+height="${CONTACT_SHEET_HEIGHT_PX}"`
    )
  );
  assert.match(contactSheet, /Kun til review – ikke en storefront-asset/);
  assert.match(contactSheet, /<rect width="1216" height="1544" fill="#FFFFFF"\/>/);
  assert.doesNotMatch(contactSheet, /<image\b|wir.?machen.?druck|supplier/i);
  assert.equal((contactSheet.match(/data-model-key=/g) || []).length, 21);

  for (const model of MODEL_DEFINITIONS) {
    assert.match(contactSheet, new RegExp(`data-model-key="${model.key}"`));
    for (const word of model.labelDa.split(/\s+/)) {
      assert.ok(contactSheet.includes(word), `${model.key}: missing Danish label word ${word}`);
    }
  }
});

test("the generator writes and then checks one complete deterministic asset set", async (t) => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-folder-icons-"));
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }));

  const generated = await writeAssets({ outputDir: temporaryRoot });
  assert.equal(generated.files.length, 23);
  await writeAssets({ outputDir: temporaryRoot, check: true });

  const manifest = JSON.parse(await fs.readFile(path.join(temporaryRoot, "manifest.json"), "utf8"));
  assert.equal(manifest.modelCount, 21);
  assert.equal(
    manifest.reviewArtifacts.contactSheet.path,
    `src/assets/product-options/sales-folders/models/${ASSET_VERSION}/${CONTACT_SHEET_FILE}`
  );
  assert.equal(
    manifest.reviewArtifacts.contactSheet.sha256,
    crypto
      .createHash("sha256")
      .update(await fs.readFile(path.join(temporaryRoot, CONTACT_SHEET_FILE), "utf8"))
      .digest("hex")
  );

  const firstIconPath = path.join(temporaryRoot, `${EXPECTED_MODEL_KEYS[0]}.svg`);
  await fs.writeFile(firstIconPath, "stale", "utf8");
  await assert.rejects(
    () => writeAssets({ outputDir: temporaryRoot, check: true }),
    /missing or stale/
  );
});

test("the additive raster path writes and checks 1024/512 transparent PNGs for only 20 approved models", async (t) => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "wmd-folder-png-icons-"));
  t.after(() => fs.rm(temporaryRoot, { recursive: true, force: true }));

  const assetRoot = path.join(temporaryRoot, "assets");
  const reviewRoot = path.join(temporaryRoot, "review");
  const sourceProposalPath = path.join(reviewRoot, "consolidated-product-proposal.json");
  const canonicalArtifactPath = path.join(reviewRoot, "canonical-icon-grid-v1.json");
  await writeAssets({ outputDir: assetRoot });
  await fs.mkdir(reviewRoot, { recursive: true });
  const proposalBytes = Buffer.from('{"schemaVersion":1,"hashPinned":true}\n', "utf8");
  await fs.writeFile(sourceProposalPath, proposalBytes);

  const sourceManifestPath = path.join(assetRoot, "manifest.json");
  const sourceManifestBefore = await fs.readFile(sourceManifestPath);
  const proposalBefore = await fs.readFile(sourceProposalPath);
  const generated = await writePngAssets({
    outputDir: assetRoot,
    canonicalArtifactPath,
    sourceProposalPath,
  });

  assert.equal(generated.rasterManifest.approvedModelCount, 20);
  assert.equal(generated.rasterManifest.styleKey, PNG_STYLE_KEY);
  assert.equal(generated.files.length, 44);
  assert.deepEqual(generated.rasterManifest.modelOrder, EXPECTED_MODEL_KEYS.slice(0, 20));
  assert.deepEqual(
    generated.rasterManifest.excludedModels.map((entry) => entry.modelKey),
    ["cd-135x135--2-part-closure"]
  );
  assert.ok((await fs.readFile(sourceManifestPath)).equals(sourceManifestBefore));
  assert.ok((await fs.readFile(sourceProposalPath)).equals(proposalBefore));

  for (const modelKey of EXPECTED_MODEL_KEYS.slice(0, 20)) {
    const manifestModel = generated.rasterManifest.models[modelKey];
    for (const [variant, sizePx] of [
      ["master", PNG_MASTER_SIZE_PX],
      ["ui", PNG_UI_SIZE_PX],
    ]) {
      const pngPath = path.join(assetRoot, "png", variant, `${modelKey}.png`);
      const png = await fs.readFile(pngPath);
      const inspection = inspectTransparentPng(png, sizePx);
      assert.equal(inspection.hasAlpha, true);
      assert.equal(inspection.minimumAlpha, 0);
      assert.ok(inspection.maximumAlpha > 0);
      assert.ok(inspection.transparentPixelCount > 0);
      assert.ok(inspection.visiblePixelCount > 0);
      assert.equal(manifestModel[variant].sha256, crypto.createHash("sha256").update(png).digest("hex"));
      assert.equal(manifestModel[variant].byteSize, png.length);
    }
  }

  await assert.rejects(
    () => fs.access(path.join(assetRoot, "png", "master", `${EXPECTED_MODEL_KEYS[20]}.png`)),
    /ENOENT/
  );
  await assert.rejects(
    () => fs.access(path.join(assetRoot, "png", "ui", `${EXPECTED_MODEL_KEYS[20]}.png`)),
    /ENOENT/
  );

  const rasterManifestBytes = await fs.readFile(path.join(assetRoot, PNG_RASTER_MANIFEST_FILE));
  const canonical = JSON.parse(await fs.readFile(canonicalArtifactPath, "utf8"));
  assert.equal(canonical.artifactType, "canonical_sales_folder_icon_grid");
  assert.equal(canonical.modelCount, 20);
  assert.equal(canonical.sourceProposal.writePerformed, false);
  assert.equal(canonical.sourceProposal.sha256, crypto.createHash("sha256").update(proposalBytes).digest("hex"));
  assert.equal(
    canonical.rasterManifest.sha256,
    crypto.createHash("sha256").update(rasterManifestBytes).digest("hex")
  );
  assert.ok(canonical.values.every((value) => value.icon.styleKey === PNG_STYLE_KEY));
  assert.ok(canonical.values.every((value) => value.icon.generatedAssetPath.endsWith(".png")));
  assert.ok(canonical.values.every((value) => value.icon.transparent === true));
  assert.ok(canonical.values.every((value) => value.icon.supplierBrandingRemoved === true));
  assert.equal(canonical.mutationBoundary.uploadPerformed, false);

  await writePngAssets({
    outputDir: assetRoot,
    canonicalArtifactPath,
    sourceProposalPath,
    check: true,
  });
});
