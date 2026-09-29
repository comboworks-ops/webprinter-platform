import test from 'node:test';
import assert from 'node:assert/strict';
import { APPROVED_PRINT_MODELS, approvedTemplateCandidate, approvedPrintTemplateLaunch, isPrintModelEnabled, resolveApprovedPrintModel, verifyPrintTemplate, printModelTemplatePageCount } from './approvedPrintModels.ts';
import { DIN_LANG_ZIGZAG_FOLD } from './zigzagFoldDefinition.ts';

test('only approved fingerprints are enabled; equal-size zigzag and roll use distinct models', () => {
  assert.equal(APPROVED_PRINT_MODELS.length, 1424);
  for (const model of APPROVED_PRINT_MODELS) assert.equal(resolveApprovedPrintModel(model.definition.templateHash), model);
  assert.equal(resolveApprovedPrintModel(DIN_LANG_ZIGZAG_FOLD.templateHash, 303, 216)?.kind, 'zigzag');
  assert.equal(resolveApprovedPrintModel('f'.repeat(64), 303, 216), null);
  assert.notEqual(resolveApprovedPrintModel(DIN_LANG_ZIGZAG_FOLD.templateHash), APPROVED_PRINT_MODELS[2]);
  assert.equal(approvedTemplateCandidate({ pdfUrl: 'https://example.com/roll-fold.pdf' }), null);
});
test('a present unknown hash never borrows the construction from a recognized URL', () => {
  assert.equal(approvedTemplateCandidate({ pdfUrl: APPROVED_PRINT_MODELS[2].templateUrl, templatePdfSha256: 'f'.repeat(64) }), null);
});
test('document size guard rejects doubled bleed, rotation and nonfinite dimensions', () => {
  for (const m of APPROVED_PRINT_MODELS) {
    const { sheetWidthMm: w, sheetHeightMm: h, templateHash: hash } = m.definition;
    assert.equal(resolveApprovedPrintModel(hash, w, h), m);
    for (const [x, y] of [[w + 6, h + 6], [h, w], [NaN, h], [w, Infinity], [w, undefined]])
      assert.equal(resolveApprovedPrintModel(hash, x, y), null);
  }
});
test('explicit disabled or malformed product settings are respected', () => {
  const model = APPROVED_PRINT_MODELS[1];
  assert.equal(isPrintModelEnabled(model), true);
  for (const preview3d of [false, null, {}, { version: 1, variants: [] }, { version: 1, variants: [{ templateHash: model.definition.templateHash, conditions: [null] }] }])
    assert.equal(isPrintModelEnabled(model, { preview3d }), false);
});
test('shop-remapped option rules must match unambiguously', () => {
  const model = APPROVED_PRINT_MODELS[1];
  const variant: { templateHash: string; conditions: { sectionId: string; valueId: string }[] } = {
    templateHash: model.definition.templateHash, conditions: [{ sectionId: 'shop-fold', valueId: 'shop-half' }],
  };
  const config = { preview3d: { version: 1, variants: [variant] } };
  assert.equal(isPrintModelEnabled(model, config, { 'shop-fold': 'shop-half' }), true);
  assert.equal(isPrintModelEnabled(model, config, { 'shop-fold': 'shop-roll' }), false);
  config.preview3d.variants.push({ ...variant, templateHash: APPROVED_PRINT_MODELS[2].definition.templateHash });
  assert.equal(isPrintModelEnabled(model, config, { 'shop-fold': 'shop-half' }), false);
});
test('legacy URL eligibility fails closed when PDF bytes or network status change', async () => {
  const template = { pdfUrl: APPROVED_PRINT_MODELS[2].templateUrl };
  assert.equal(await verifyPrintTemplate(template, async () => new Response('replaced PDF')), null);
  assert.equal(await verifyPrintTemplate(template, async () => new Response('', { status: 404 })), null);
  await assert.rejects(verifyPrintTemplate(template, async () => { throw new Error('offline'); }));
});
test('verified designer fingerprint needs no extra template network read', async () => {
  const model = APPROVED_PRINT_MODELS[0];
  assert.equal(await verifyPrintTemplate({ templatePdfSha256: model.definition.templateHash }, async () => { throw new Error('unexpected network'); }), model);
});
test('approved leaflet handoff adds bleed exactly once; A7 trim and unknown templates stay intact', () => {
  for (const model of APPROVED_PRINT_MODELS) {
    const d = model.definition;
    const bleedMm = model.kind === 'flat' ? 3 : model.definition.bleedMm;
    const trimW = d.sheetWidthMm - 2 * bleedMm, trimH = d.sheetHeightMm - 2 * bleedMm;
    const launch = { name: model.label, pdfUrl: model.templateUrl, widthMm: model.kind === 'flat' ? trimW : d.sheetWidthMm,
      heightMm: model.kind === 'flat' ? trimH : d.sheetHeightMm, bleedMm };
    const result = approvedPrintTemplateLaunch(launch, model)!;
    assert.equal(result.widthMm, trimW); assert.equal(result.heightMm, trimH);
    assert.equal(result.templatePdfSha256, d.templateHash);
    assert.deepEqual(approvedPrintTemplateLaunch(result, model), result);
    assert.equal(approvedPrintTemplateLaunch(launch, null), launch);
    const unknown = { ...launch, pdfUrl: 'https://example.com/unknown.pdf' };
    assert.equal(approvedPrintTemplateLaunch(unknown, model), unknown);
  }
});

test('individually approved 3, 5 and 10 mm models retain one printed spread', () => {
  for (const model of APPROVED_PRINT_MODELS.filter(m => m.kind === 'spine')) {
    assert.equal(model.pages, 1);
    assert.equal(printModelTemplatePageCount(model), 2);
  }
  const five = resolveApprovedPrintModel('313a54c49ebc2803526ec4c647779bdb40989a25d40e0ba5ba14fcce1ec7a02c');
  assert.equal(five?.kind === 'spine' && five.definition.nominalSpineMm, 5);
  assert.equal(resolveApprovedPrintModel('7a660eaeacc2a35a7b3a2cedd65b3d2d580c5df07167a97c0b05d9cc42e4de88')?.kind, 'spine');
});

test('production artwork excludes reference spreads for every approved 4+0 folder', async () => {
  const { printModelArtworkPageIndices } = await import('./approvedPrintModels.ts');
  for (const model of APPROVED_PRINT_MODELS) {
    const indices = printModelArtworkPageIndices(model, printModelTemplatePageCount(model));
    assert.deepEqual(indices, model.pages === 1 ? [0] : [0, 1], model.label);
  }
  assert.deepEqual(printModelArtworkPageIndices(null, 3), [0, 1, 2]);
  assert.throws(() => printModelArtworkPageIndices(APPROVED_PRINT_MODELS.find(m => m.kind === 'spine')!, 1), /klar/);
});
