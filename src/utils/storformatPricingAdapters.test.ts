import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const adapters = [
  "src/components/product-price-page/StorformatConfigurator.tsx",
  "src/components/FeaturedProductConfigurator.tsx",
  "src/utils/productPriceDisplay.ts",
  "src/components/admin/StorformatManager.tsx",
  "src/components/sites/SitePackagePreview.tsx",
];

test("every database-backed storformat adapter uses shared config normalization", () => {
  for (const file of adapters) {
    const source = fs.readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.match(
      source,
      /normalizeStorformatPricingConfig\s*\(/,
      `${file} must preserve rounding_mode from its database row`,
    );
  }
});

test("the site-package storefront preserves and applies snapshot ceil rounding", () => {
  const preview = fs.readFileSync(
    new URL("../components/sites/SitePackagePreview.tsx", import.meta.url),
    "utf8",
  );
  const runtime = fs.readFileSync(
    new URL(
      "../../public/site-previews/banner-builder-pro/banner-visualizer-inject.mjs",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(preview, /roundingMode:\s*normalizedConfig\.rounding_mode/);
  assert.match(runtime, /configRaw\.roundingMode\s*===\s*["']ceil_v1["']/);
  assert.match(runtime, /config\.roundingMode\s*===\s*["']ceil_v1["']/);
  assert.match(runtime, /Math\.ceil\(scaledTotal\s*-\s*roundingTolerance\)/);
});

test("the manual editor discovers and blocks authoritative WMD snapshot drafts", () => {
  const source = fs.readFileSync(
    new URL("../components/admin/StorformatManager.tsx", import.meta.url),
    "utf8",
  );
  const saveHandler = source.slice(
    source.indexOf("const handleSave = async"),
    source.indexOf("const handleSaveTemplate"),
  );

  assert.match(source, /rpc\(\s*["']get_wmd_snapshot_draft_revision["']/);
  assert.match(saveHandler, /snapshotRevision\s*!==\s*null/);
  assert.ok(
    saveHandler.indexOf("snapshotRevision !== null") <
      saveHandler.indexOf('.from("storformat_configs"'),
    "the authoritative revision guard must run before the first editor write",
  );
});
