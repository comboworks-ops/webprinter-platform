import assert from 'node:assert/strict';
import test from 'node:test';
import { computeExportRasterScale } from './exportRasterScale.ts';

test('A4 exports at 300 ppi regardless of editor display scale', () => {
  for (const pixelsPerMm of [0.5, 2, 96 / 25.4]) {
    const scale = computeExportRasterScale(216 * pixelsPerMm, 303 * pixelsPerMm, pixelsPerMm, 297);
    assert.ok(Math.abs(scale.multiplier * pixelsPerMm * 25.4 - 300) < 1e-8);
  }
});
test('large format uses physical millimetres for its 150 and 100 ppi tiers', () => {
  assert.equal(computeExportRasterScale(2412, 1212, 2, 1200).targetPpi, 150);
  assert.equal(computeExportRasterScale(5006, 1006, 1, 5000).targetPpi, 100);
});
test('a square metre uses the 10000 pixel safety cap consistently across display scales', () => {
  for (const pixelsPerMm of [0.5, 2]) {
    const scale = computeExportRasterScale(1006 * pixelsPerMm, 1006 * pixelsPerMm, pixelsPerMm, 1000);
    assert.equal(scale.targetPpi, 300);
    assert.ok(Math.abs(scale.multiplier * pixelsPerMm * 1006 - 10000) < 1e-6);
    assert.ok(scale.effectivePpi > 252 && scale.effectivePpi < 253);
  }
});
test('portrait and landscape use the same resolution and both obey the cap', () => {
  assert.deepEqual(computeExportRasterScale(2412, 1212, 2, 1200), computeExportRasterScale(1212, 2412, 2, 1200));
});
