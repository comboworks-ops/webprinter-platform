import test from 'node:test';
import assert from 'node:assert/strict';
import { isSingleClosedContour, assertSingleCanvasContour } from './cutContourValidation.ts';
const closed = { type: 'path', path: [['M', 0, 0], ['L', 20, 0], ['L', 8, 30], ['L', 2, 20], ['Z']], width: 20, height: 30, __isCutContour: true };
test('one irregular closed outline is allowed', () => { assert.equal(isSingleClosedContour(closed), true); assert.doesNotThrow(() => assertSingleCanvasContour([closed])); });
test('multiple objects, groups, disconnected subpaths, open and degenerate paths are rejected', () => {
  const invalid = [
    { ...closed, path: closed.path.slice(0, -1) },
    { ...closed, path: [...closed.path, ...closed.path] },
    { type: 'group', getObjects: () => [closed, closed], __isCutContour: true },
    { ...closed, width: 0 }, { ...closed, scaleX: 0 },
    { type: 'line' }, { ...closed, path: [['M', 0, 0], ['L', NaN, 10], ['Z']] },
  ];
  for (const object of invalid) assert.equal(isSingleClosedContour(object), false);
  assert.throws(() => assertSingleCanvasContour([])); assert.throws(() => assertSingleCanvasContour([closed, closed]));
  assert.throws(() => assertSingleCanvasContour([{ ...closed, visible: false }]));
  assert.equal(isSingleClosedContour({ type: 'group', getObjects: () => [closed] }), true);
});
test('non-finite polygon points, collapsed outlines and malformed saved paths cannot become cutting lines', () => {
  const invalid = [
    { type: 'polygon', points: [{ x: 0, y: 0 }, { x: NaN, y: 20 }, { x: 20, y: 0 }], width: 20, height: 20 },
    { type: 'polyline', points: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], width: 20, height: 20 },
    { ...closed, path: [['M', 0, 0], ['L', 0, 0], ['Z']] },
    { ...closed, path: [['M', 0, 0], ['UNKNOWN', 20, 30], ['Z']] },
    { ...closed, path: [['M', 0, 0], ['L', 20], ['Z']] },
    { ...closed, width: Infinity },
  ];
  for (const object of invalid) assert.equal(isSingleClosedContour(object), false, JSON.stringify(object));
});
