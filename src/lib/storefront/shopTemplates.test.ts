import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_SHOP_TEMPLATE,
  SHOP_NAVIGATION_OPTIONS,
  SHOP_TEMPLATES,
  STOREFRONT_SECTION_IDS,
  normalizeStorefrontSectionOrder,
  resolveShopComponentRecipe,
  resolveStorefrontLayout,
} from "./shopTemplates.ts";

test("the curated shop catalog contains ten unique templates", () => {
  assert.equal(SHOP_TEMPLATES.length, 10);
  assert.equal(new Set(SHOP_TEMPLATES.map((template) => template.id)).size, 10);
});

test("every shop template renders every storefront section exactly once", () => {
  for (const template of SHOP_TEMPLATES) {
    assert.deepEqual(
      [...template.layout.sectionOrder].sort(),
      [...STOREFRONT_SECTION_IDS].sort(),
      template.name,
    );
  }
});

test("the ten templates have distinct structural signatures", () => {
  const signatures = SHOP_TEMPLATES.map((template) => JSON.stringify({
    order: template.layout.sectionOrder,
    hero: template.layout.heroTreatment,
    heroHeight: template.layout.heroHeight,
    width: template.layout.contentWidth,
    spacing: template.layout.sectionSpacing,
    rhythm: template.layout.surfaceRhythm,
    columns: template.productDefaults.columns,
    products: template.productDefaults.layoutStyle,
    navigation: template.recipe.navigation,
    card: template.recipe.productCard,
    productPage: template.recipe.productPage,
    checkout: template.recipe.checkout,
  }));

  assert.equal(new Set(signatures).size, SHOP_TEMPLATES.length);
});

test("every shop template has a complete Open Design component recipe", () => {
  const menuPresetIds = new Set(SHOP_NAVIGATION_OPTIONS.map((option) => option.id));

  for (const template of SHOP_TEMPLATES) {
    assert.ok(template.recipe.openDesignSystem, template.name);
    assert.ok(menuPresetIds.has(template.recipe.navigation), template.name);
    assert.ok(template.recipe.header.variant, template.name);
    assert.ok(template.recipe.categoryNavigation, template.name);
    assert.ok(template.recipe.productCollection, template.name);
    assert.ok(template.recipe.productCard, template.name);
    assert.ok(template.recipe.productPage, template.name);
    assert.ok(template.recipe.checkout, template.name);
    assert.ok(template.recipe.footer, template.name);
  }
});

test("component recipes resolve from the saved template id", () => {
  const recipe = resolveShopComponentRecipe({ templateId: "editorial-studio" });

  assert.equal(recipe.openDesignSystem, "warm-editorial");
  assert.equal(recipe.navigation, "split-preview");
  assert.equal(recipe.productCard, "editorial");
  assert.equal(recipe.checkout, "editorial");
});

test("section order normalization removes invalid duplicates and restores missing sections", () => {
  assert.deepEqual(
    normalizeStorefrontSectionOrder(["products", "products", "invalid", "hero"]),
    ["products", "hero", "usp", "banner2", "content", "seo"],
  );
});

test("unknown or incomplete saved layouts fall back safely", () => {
  const resolved = resolveStorefrontLayout({
    templateId: "not-a-template" as never,
    sectionOrder: ["products"],
  });

  assert.equal(resolved.templateId, DEFAULT_SHOP_TEMPLATE.id);
  assert.deepEqual(resolved.sectionOrder, [
    "products",
    "hero",
    "usp",
    "banner2",
    "content",
    "seo",
  ]);
});
