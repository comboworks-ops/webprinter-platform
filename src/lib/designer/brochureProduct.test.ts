import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrochureDocument } from './brochureDocument.ts';
import { applyBrochureDocumentParams, assertBrochureCheckoutDocument, resolveBrochurePageCount } from './brochureProduct.ts';
import { getSiteCheckoutDesignSignature } from '../checkout/siteCheckoutSession.ts';
import { retainProductEditDraft } from '../checkout/retainProductEdit.ts';

test('brochure count comes from one selected typed source value, never a guessed label', () => {
  const values = { a: { brochurePageCount: 56 }, b: { brochurePageCount: 12 }, bad: { brochurePageCount: 55 } };
  assert.equal(resolveBrochurePageCount('brochure', { pages: 'a' }, values), 56);
  assert.equal(resolveBrochurePageCount('flat_print', { pages: 'a' }, values), null);
  assert.equal(resolveBrochurePageCount('brochure', { pages: 'a', other: 'b' }, values), null);
  assert.equal(resolveBrochurePageCount('brochure', { pages: 'bad' }, values), null);
});
test('missing brochure count blocks launch while existing products retain their document URL', () => {
  const params = new URLSearchParams({ widthMm: '210' });
  applyBrochureDocumentParams(params, 'flat_print', null);
  assert.equal(params.toString(), 'widthMm=210');
  assert.throws(() => applyBrochureDocumentParams(params, 'brochure', null), /sidetal/);
  applyBrochureDocumentParams(params, 'brochure', 56);
  assert.equal(params.get('brochurePages'), '56');
});
test('checkout rejects a brochure for another count, format or product', () => {
  const document = createBrochureDocument(8, 210, 297);
  const state = { productId: 'brochure', designerMode: 'brochure', brochurePageCount: 8, designWidthMm: 210, designHeightMm: 297, designBleedMm: 3 };
  assert.doesNotThrow(() => assertBrochureCheckoutDocument(state, 'brochure', document));
  for (const change of [{ brochurePageCount: 12 }, { designWidthMm: 148 }, { productId: 'other' }, { designerMode: 'flat_print' }]) {
    assert.throws(() => assertBrochureCheckoutDocument({ ...state, ...change }, 'brochure', document), /matcher ikke/);
  }
});
test('changing only the page count invalidates the existing production PDF and design signature', () => {
  const before = { productId: 'brochure', designerMode: 'brochure', brochurePageCount: 8, designWidthMm: 210, designHeightMm: 297, designBleedMm: 3, designerExport: { filePath: 'eight-pages.pdf' } };
  assert.notEqual(getSiteCheckoutDesignSignature(before), getSiteCheckoutDesignSignature({ ...before, brochurePageCount: 12 }));
  const retained = retainProductEditDraft(before, { productId: 'brochure', designerMode: 'brochure', brochurePageCount: 12, width: 210, height: 297, bleed: 3 }, true);
  assert.equal(retained.designerExport, null);
});
