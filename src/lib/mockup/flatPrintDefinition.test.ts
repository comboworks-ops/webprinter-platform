import test from 'node:test';
import assert from 'node:assert/strict';
import { A7_FLYER_CANDIDATE as d, assertFlatPrintPdf, flatPrintUv } from './flatPrintDefinition.ts';

test('A7 artwork uses full bleed sheet, rejecting trim-only, rotated and multi-page PDFs', () => {
  assert.doesNotThrow(() => assertFlatPrintPdf(1,80,111,d));
  assert.doesNotThrow(() => assertFlatPrintPdf(1,79.999,111.001,d));
  for (const [pages,w,h] of [[2,80,111],[0,80,111],[1,74,105],[1,111,80],[1,NaN,111],[1,80,Infinity]]) {
    assert.throws(() => assertFlatPrintPdf(pages,w,h,d));
  }
});
test('finished front samples the exact trim region without bleed, mirroring or vertical inversion', () => {
  assert.deepEqual(flatPrintUv(0,0,d),[3/80,1-3/111]);
  assert.deepEqual(flatPrintUv(74,105,d),[77/80,1-108/111]);
  assert.deepEqual(flatPrintUv(37,52.5,d),[.5,.5]);
  assert.ok(flatPrintUv(74,0,d)[0]>flatPrintUv(0,0,d)[0]);
  assert.ok(flatPrintUv(0,0,d)[1]>flatPrintUv(0,105,d)[1]);
});
