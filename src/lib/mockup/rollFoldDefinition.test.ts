import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIN_LANG_ROLL_FOLD as d, rollFoldPose, rollFoldUv, assertRollFoldPdf } from './rollFoldDefinition.ts';
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('roll-fold crease positions match both PDF pages including reverse-sheet offset', () => {
  assert.deepEqual(d.panelWidthsMm, [100, 100, 97]);
  const inside = [0, 100, 200, 297].map(x => rollFoldUv(x, 0, 'inside', d)[0] * 303);
  const outside = [297, 200, 100, 0].map(x => rollFoldUv(x, 0, 'outside', d)[0] * 303);
  inside.forEach((v, i) => close(v, [3, 103, 203, 300][i]));
  outside.forEach((v, i) => close(v, [3, 100, 200, 300][i]));
  // The reverse of inside-left 2 is outside-right 1; centre 3 reverses to 6.
  close(rollFoldUv(50, 0, 'outside', d)[0], 250 / 303);
  close(rollFoldUv(150, 210, 'outside', d)[0], 150 / 303);
  close(rollFoldUv(250, 0, 'outside', d)[0], 50 / 303);
  close(rollFoldUv(0, 210, 'inside', d)[1], 1 - 213 / 216);
});

test('closing tucks the narrow right panel first and only then closes the cover', () => {
  for (let open = 0; open <= 100; open++) {
    const p = rollFoldPose(open, d);
    if (open <= 50) close(p.flapAngle, -Math.PI);
    if (open >= 50) close(p.coverAngle, 0);
    assert.ok(p.coverAngle >= 0 && p.flapAngle <= 0);
  }
  close(rollFoldPose(100, d).flapAngle, 0);
  close(rollFoldPose(0, d).coverAngle, Math.PI);
  close(rollFoldPose(-10, d).coverAngle, Math.PI);
  close(rollFoldPose(110, d).flapAngle, 0);
});

test('closed stack has a 3 mm tuck allowance and three separate paper layers', () => {
  const p = rollFoldPose(0, d);
  const flapFreeEdge = 100 + 97 * Math.cos(p.flapAngle);
  close(flapFreeEdge, 3);
  const flapZ = 2 * p.flapHingeZ, frontZ = 2 * p.coverHingeZ;
  assert.ok(flapZ - d.displayThicknessMm / 2 > d.displayThicknessMm / 2);
  assert.ok(frontZ - d.displayThicknessMm / 2 > flapZ + d.displayThicknessMm / 2);
  close(-Math.cos(p.coverAngle), 1); // Cover's outside face points to front camera.
});

test('only a complete pair of the correct full-size spreads is accepted', () => {
  const good = { widthMm: 303, heightMm: 216 };
  assert.doesNotThrow(() => assertRollFoldPdf([good, good], d));
  for (const bad of [[], [good], Array(6).fill(good), [good, { widthMm: 297, heightMm: 210 }], [{ widthMm: 216, heightMm: 303 }, good], [good, { widthMm: NaN, heightMm: 216 }]]) {
    assert.throws(() => assertRollFoldPdf(bad, d));
  }
});
