import test from 'node:test';
import assert from 'node:assert/strict';
import { A4_FOLDER, A4_FOLDER_OUTSIDE_HASH, resolveFolderDefinition, artworkRect, sheetUv, toggleFold, CLOSED_FOLDS, OPEN_FOLDS } from './folderDefinition.ts';

test('only reviewed template fingerprints and their full bleed size enable a model', () => {
  assert.equal(resolveFolderDefinition(A4_FOLDER_OUTSIDE_HASH, 493.998, 366), A4_FOLDER);
  assert.equal(resolveFolderDefinition(A4_FOLDER_OUTSIDE_HASH.toUpperCase(), 494, 366), A4_FOLDER);
  for (const hash of [undefined, '', 'another-a4-template']) assert.equal(resolveFolderDefinition(hash, 494, 366), null);
  for (const [w, h] of [[484, 356], [210, 297], [366, 494], [NaN, 366]]) assert.equal(resolveFolderDefinition(A4_FOLDER_OUTSIDE_HASH, w, h), null);
});
test('upload placement keeps bleed, independent scale and percentage offsets', () => {
  assert.deepEqual(artworkRect({ physicalWidthMm: 494, physicalHeightMm: 366, scale: 1, offsetXPercent: 0, offsetYPercent: 0 }, 494, 366), { x: 0, y: 0, width: 494, height: 366 });
  assert.deepEqual(artworkRect({ physicalWidthMm: 484, physicalHeightMm: 356, scale: 1, offsetXPercent: 0, offsetYPercent: 0 }, 494, 366), { x: 5, y: 5, width: 484, height: 356 });
  const scaled = artworkRect({ physicalWidthMm: 200, physicalHeightMm: 100, scale: 2, offsetXPercent: 10, offsetYPercent: -10 }, 500, 400);
  assert.deepEqual(scaled, { x: 100, y: 60, width: 400, height: 200 });
  assert.throws(() => artworkRect({ physicalWidthMm: 0, physicalHeightMm: 100, scale: 1, offsetXPercent: 0, offsetYPercent: 0 }, 494, 366));
});
test('all outside panels share continuous sheet UVs across each crease', () => {
  assert.deepEqual(sheetUv([0, 0], A4_FOLDER), [0, 1]);
  assert.deepEqual(sheetUv([494, 366], A4_FOLDER), [1, 0]);
  // The front is the right-hand panel in the supplier PDF; the side pocket is left.
  assert.ok(sheetUv([274, 5], A4_FOLDER)[0] > .5);
  assert.ok(sheetUv([59, 5], A4_FOLDER)[0] < .15);
  for (const panel of A4_FOLDER.panels) for (const point of panel.outline) {
    const [u, v] = sheetUv(point, A4_FOLDER);
    assert.ok(u >= 0 && u <= 1 && v >= 0 && v <= 1);
  }
});
test('pockets open the cover and closing the cover folds pockets in', () => {
  assert.deepEqual(toggleFold(CLOSED_FOLDS, 'side'), { cover: true, side: true, bottom: false });
  assert.deepEqual(toggleFold(OPEN_FOLDS, 'cover'), CLOSED_FOLDS);
  assert.deepEqual(toggleFold(OPEN_FOLDS, 'bottom'), { cover: true, side: true, bottom: false });
  assert.deepEqual(CLOSED_FOLDS, { cover: false, side: false, bottom: false });
});
