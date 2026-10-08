import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateBrochureProductPlan, inspectBrochureDocumentResolution, resolveBrochureFreeRegistry } from '../shared/brochure-product-plan.js';

const tenantId = '00000000-0000-0000-0000-000000000000';
const option = (key, labelDa, meta = {}) => ({ key, labelOriginal: labelDa, labelDa, meta });
const manifest = () => ({ product: { sourceKey: 'wmd-saddle-stitched-brochures-9434', family: 'books' },
  source: { supplierSlug: 'wir-machen-druck' }, runId: 'test', pricing: { conversionRuleKey: 'wmd_tiered_fx_7_5' },
  optionGroups: [ ['orientation', [option('portrait', 'Lodret'), option('free', 'Fri størrelse')]],
    ['format', [option('210x297', 'A4', { widthMm: 210, heightMm: 297 }), option('free', 'Fri størrelse')]],
    ['pageCount', [option('8', '8 sider', { brochurePageCount: 8 }), option('12', '12 sider', { brochurePageCount: 12 })]],
    ['paperCover', [option('paper-8', 'Indhold 135 / omslag 250'), option('paper-12', 'Indhold 135 / omslag 250')]],
    ['cover', [option('matte', 'Mat')]], ['varnish', [option('none', 'Uden lak')]]
  ].map(([key, values]) => ({ key, labelDa: key, values })) });
const selection = (pageCount = '8') => ({ orientation: 'portrait', format: '210x297', pageCount,
  paperCover: `paper-${pageCount}`, cover: 'matte', varnish: 'none' });
const binding = (pageCount = '8') => ({ match: selection(pageCount), guide: { factsReviewed: true, sourceUrl: 'https://supplier/guide.pdf' },
  template: { sourceUrl: 'https://supplier/template.pdf', sanitizedPdfPath: 'documents/210x297.pdf',
    sanitizedPdfSha256: 'a'.repeat(64), widthMm: 210, heightMm: 297, bleedMm: 3, safeMm: 3, pageCount: 1,
    artworkMode: 'online_designer', lockedInDesigner: true, nonPrintingOverlay: true, excludedFromExport: true } });

test('resolved selector IDs use the existing matrix row contract and typed page count', () => {
  const plan = allocateBrochureProductPlan(manifest(), { tenantId });
  const row = plan.priceRow({ quantity: 100, finalPriceDkk: 120, supplierPrice: 10, convertedPriceDkk: 75, selections: selection() });
  const ids = plan.selectionIds(selection());
  assert.equal(row.variant_value, ids.paperCover);
  assert.equal(row.extra_data.brochurePageCount, 8);
  assert.deepEqual(row.variant_name.split('|'), [ids.orientation, ids.format, ids.pageCount, ids.cover, ids.varnish].sort());
  assert.deepEqual(row.extra_data.variantValueIds, [ids.orientation, ids.format, ids.pageCount, ids.cover, ids.varnish]);
  assert.throws(() => allocateBrochureProductPlan(manifest(), { tenantId, idFactory: () => tenantId }), /Duplicate/);
});
test('different exact configurations share one verified format template with separate compatibility selectors', async () => {
  const plan = allocateBrochureProductPlan(manifest(), { tenantId });
  const result = await inspectBrochureDocumentResolution(plan, [binding(), binding('12')], 2);
  assert.equal(result.templates.length, 1); assert.equal(result.templates[0].exactConfigurationCount, 2);
  assert.equal(result.uniqueSelectorCombinations, 2);
  assert.deepEqual(result.templates[0].selectionConstraints, { 'brochure-format': plan.selectionIds(selection()).format });
  assert.equal(plan.pricingStructure.brochureCompatibility.selections.length, 2);
  assert.equal(Object.keys(plan.pricingStructure.brochureCompatibility.selections[0]).length, 5);
});
test('conflicting source/hash/geometry and incomplete artifact counts fail closed', async () => {
  const second = binding('12'); second.template.sanitizedPdfSha256 = 'b'.repeat(64);
  await assert.rejects(() => inspectBrochureDocumentResolution(allocateBrochureProductPlan(manifest(), { tenantId }), [binding(), second], 2), /conflicting/);
  const malformed = binding(); malformed.template.widthMm = 297;
  await assert.rejects(() => inspectBrochureDocumentResolution(allocateBrochureProductPlan(manifest(), { tenantId }), [malformed], 1), /inconsistent/);
  await assert.rejects(() => inspectBrochureDocumentResolution(allocateBrochureProductPlan(manifest(), { tenantId }), [binding()], 2), /count/);
});
test('coalesced native paper identities cannot silently overwrite one matrix cell', async () => {
  const m = manifest(); m.optionGroups.find(group => group.key === 'paperCover').values.push(option('duplicate-native', 'Indhold 135 / omslag 250'));
  const duplicate = binding(); duplicate.match.paperCover = 'duplicate-native';
  await assert.rejects(() => inspectBrochureDocumentResolution(allocateBrochureProductPlan(m, { tenantId }), [binding(), duplicate], 2), /collapse/);
});
test('free source mappings retain exact native article/paper IDs without inventing fixed prices', () => {
  const plan = allocateBrochureProductPlan(manifest(), { tenantId });
  const registry = { 2009: { sourceUrl: 'https://www.wir-machen-druck.de/free.html', pageCount: 8, materials: ['paper-8'] } };
  const result = resolveBrochureFreeRegistry(plan, registry);
  assert.equal(result.articles[0].materials[0].nativePaperId, 'paper-8');
  assert.equal(result.articles[0].materials[0].materialValueId, plan.selectionIds(selection()).paperCover);
  assert.equal(result.requiresExactDimensionQuote, true); assert.equal(result.maxHeightMm, 297);
  assert.equal(result.separateVarnishSelector, false);
  assert.throws(() => resolveBrochureFreeRegistry(plan, { 2009: { ...registry[2009], materials: ['missing'] } }), /Unresolved/);
  assert.throws(() => resolveBrochureFreeRegistry(plan, { 2009: { ...registry[2009], materials: ['paper-8', 'paper-12'] } }), /collapse/);
  assert.throws(() => resolveBrochureFreeRegistry(plan, { 2009: { ...registry[2009], sourceUrl: 'https://other.example/free.html' } }), /Unexpected/);
});
