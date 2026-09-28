import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIN_LANG_ZIGZAG_FOLD as d, zigzagFoldPose, zigzagFoldUv, assertZigzagFoldPdf } from './zigzagFoldDefinition.ts';
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('all zigzag panels are equal and both PDF spreads have folds at 102/201 mm', () => {
  assert.deepEqual(d.panelWidthsMm, [99, 99, 99]);
  [0, 99, 198, 297].forEach((x, i) => close(zigzagFoldUv(x, 0, 'inside', d)[0] * 303, [3, 102, 201, 300][i]));
  [297, 198, 99, 0].forEach((x, i) => close(zigzagFoldUv(x, 0, 'outside', d)[0] * 303, [3, 102, 201, 300][i]));
  // Physical pairs: 2/1, 3/5, 6/4. The back is on PDF spread 2, unlike a roll fold.
  close(zigzagFoldUv(49.5, 0, 'outside', d)[0], 250.5 / 303);
  close(zigzagFoldUv(148.5, 0, 'outside', d)[0], 151.5 / 303);
  close(zigzagFoldUv(247.5, 0, 'outside', d)[0], 52.5 / 303);
  close(zigzagFoldUv(297, 210, 'inside', d)[1], 1 - 213 / 216);
});

test('end panels fold to opposite sides of the centre throughout accordion motion', () => {
  for (let open = 0; open < 100; open++) {
    const p = zigzagFoldPose(open, d);
    const coverTipZ = p.coverHingeZ * (1 - Math.cos(p.coverAngle)) + 99 * Math.sin(p.coverAngle);
    const backTipZ = p.backHingeZ * (1 - Math.cos(p.backAngle)) - 99 * Math.sin(p.backAngle);
    assert.ok(coverTipZ > 0); assert.ok(backTipZ < 0);
    close(coverTipZ, -backTipZ);
    close(p.coverAngle, p.backAngle);
  }
  close(zigzagFoldPose(100, d).coverAngle, 0);
  close(zigzagFoldPose(-5, d).coverAngle, Math.PI);
  close(zigzagFoldPose(105, d).backAngle, 0);
});

test('closed Z stack has a 99 mm footprint and separate front, centre and back layers', () => {
  const p = zigzagFoldPose(0, d);
  close(-99 * Math.cos(p.coverAngle), 99);
  close(99 + 99 * Math.cos(p.backAngle), 0);
  assert.ok(2 * p.coverHingeZ - d.displayThicknessMm / 2 > d.displayThicknessMm / 2);
  assert.ok(2 * p.backHingeZ + d.displayThicknessMm / 2 < -d.displayThicknessMm / 2);
  close(-Math.cos(p.coverAngle), 1); // Front 1 outside face -> front camera.
  close(Math.cos(p.backAngle), -1); // Back 6 inside-spread face -> back camera.
});

test('require two full-size spreads; page size alone cannot identify roll versus zigzag content', () => {
  const good = { widthMm: 303, heightMm: 216 };
  assert.doesNotThrow(() => assertZigzagFoldPdf([good, good], d));
  for (const bad of [[], [good], Array(6).fill(good), [good, { widthMm: 297, heightMm: 210 }], [{ widthMm: 216, heightMm: 303 }, good], [good, { widthMm: NaN, heightMm: 216 }]]) assert.throws(() => assertZigzagFoldPdf(bad, d));
});
