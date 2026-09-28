import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIN_LANG_HALF_FOLD as d, halfFoldUv, halfFoldPose, assertHalfFoldPdf } from './halfFoldDefinition.ts';

test('inside 2/3 and outside 4/1 share the physical paper without mirrored text or bleed', () => {
  const uv = (x: number, y: number, s: 'inside' | 'outside') => halfFoldUv(x, y, s, d);
  assert.deepEqual(uv(0, 0, 'inside'), [3 / 204, 1 - 3 / 216]);
  assert.deepEqual(uv(198, 210, 'inside'), [201 / 204, 1 - 213 / 216]);
  // Inside-left panel 2 carries the outside-right front cover 1 on its reverse.
  assert.deepEqual(uv(0, 0, 'outside'), [201 / 204, 1 - 3 / 216]);
  assert.deepEqual(uv(99, 210, 'outside'), [102 / 204, 1 - 213 / 216]);
  // Inside-right panel 3 carries the back cover 4.
  assert.deepEqual(uv(198, 0, 'outside'), [3 / 204, 1 - 3 / 216]);
});

test('cover closes onto inside with outward-facing front and non-intersecting paper bodies', () => {
  const closed = halfFoldPose(0, d), open = halfFoldPose(100, d);
  assert.equal(closed.angle, Math.PI); assert.equal(open.angle, 0);
  const closedX = -d.panelWidthMm * Math.cos(closed.angle);
  const closedZ = closed.hingeZ - closed.hingeZ * Math.cos(closed.angle);
  assert.equal(closedX, 99);
  assert.ok(closedZ - d.displayThicknessMm / 2 > d.displayThicknessMm / 2);
  assert.equal(-Math.cos(closed.angle), 1); // Outside normal points towards front camera.
  assert.equal(halfFoldPose(-4, d).angle, Math.PI);
  assert.equal(halfFoldPose(104, d).angle, 0);
});

test('both PDF spreads must match the verified full sheet', () => {
  const good = { widthMm: 204, heightMm: 216 };
  assert.doesNotThrow(() => assertHalfFoldPdf([good, good], d));
  assert.throws(() => assertHalfFoldPdf([good], d));
  assert.throws(() => assertHalfFoldPdf([good, good, good, good], d));
  for (const bad of [{ widthMm: 198, heightMm: 210 }, { widthMm: 216, heightMm: 204 }, { widthMm: NaN, heightMm: 216 }]) {
    assert.throws(() => assertHalfFoldPdf([good, bad], d));
    assert.throws(() => assertHalfFoldPdf([bad, good], d));
  }
});
