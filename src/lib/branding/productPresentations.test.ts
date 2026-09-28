import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyProductPresentation, PRODUCT_PRESENTATIONS, resolveProductPresentation } from './productPresentations.ts';

test('only the four selected pictures are available; existing shops keep their theme', () => {
  assert.deepEqual(PRODUCT_PRESENTATIONS.map(item => item.number), [1, 3, 4, 5]);
  for (const value of [undefined, null, 'print-journal', '2', 'unknown']) assert.equal(resolveProductPresentation(value), 'standard');
});

test('selection survives a stored draft round-trip and keeps other page, tenant and product settings', () => {
  const original = { tenantId: 'shop-a', themeId: 'tenant-selected-theme', themeSettings: { orderFlowDesigns: { calculator: 2 } }, header: { logo: 'tenant-logo.png' }, forside: { showBanner: true, layout: { templateId: 'minimal-gallery', sectionOrder: ['hero', 'banner2', 'products', 'seo'] }, productsSection: { enabled: true, columns: 4, presentationTitle: 'Mit eget udvalg', featuredProductConfig: { productId: 'keep-this', enabled: true }, button: { bgColor: '#123456' } } } };
  for (const item of PRODUCT_PRESENTATIONS) {
    const next = JSON.parse(JSON.stringify(applyProductPresentation(original, item.id)));
    assert.equal(next.forside.productsSection.presentation, item.id);
    assert.equal(next.forside.productsSection.presentationTitle, 'Mit eget udvalg');
    assert.deepEqual(next.header, original.header);
    assert.deepEqual(next.themeSettings, original.themeSettings);
    assert.deepEqual(next.forside.productsSection.featuredProductConfig, original.forside.productsSection.featuredProductConfig);
    assert.deepEqual(next.forside.productsSection.button, original.forside.productsSection.button);
    assert.deepEqual(next.forside.layout.sectionOrder, ['products', 'hero', 'banner2', 'seo']);
    assert.equal(next.forside.layout.templateId, 'minimal-gallery');
    assert.equal(next.tenantId, 'shop-a');
    assert.equal(next.themeId, 'tenant-selected-theme');
    assert.equal(next.forside.showBanner, true);
  }
  assert.deepEqual(original.forside.layout.sectionOrder, ['hero', 'banner2', 'products', 'seo']);
});

test('re-selecting layouts does not duplicate sections; the original renderer is reversible', () => {
  const original = { forside: { layout: { sectionOrder: ['hero', 'products'] }, productsSection: { presentationMotion: false } } };
  const next = applyProductPresentation(applyProductPresentation(original, 'focus-browser'), 'print-studio');
  assert.deepEqual(next.forside.layout.sectionOrder, ['products', 'hero']);
  assert.equal(applyProductPresentation(next, 'standard').forside.productsSection.presentation, 'standard');
  assert.equal(next.forside.productsSection.presentationMotion, false);
});
