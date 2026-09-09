import assert from 'node:assert/strict';
import test from 'node:test';
import { computeProofPreviewGeometry, ProofRequestGate } from './proofPreviewGeometry.ts';

test('A4 proof retains Retina detail at 100 percent and crops the zoomed document to the viewport', () => {
    const base = { docWidth: 432, docHeight: 606, pasteboardOffset: 100, viewportWidth: 632, viewportHeight: 806, devicePixelRatio: 2 };
    const normal = computeProofPreviewGeometry({ ...base, viewportTransform: [1, 0, 0, 1, 0, 0] })!;
    assert.deepEqual(normal.bounds, { left: 100, top: 100, width: 432, height: 606 });
    assert.equal(normal.bitmapWidth, 864);
    assert.equal(normal.bitmapHeight, 1212);
    const zoomed = computeProofPreviewGeometry({ ...base, viewportTransform: [2, 0, 0, 2, -316, -403] })!;
    assert.deepEqual(zoomed.bounds, { left: 0, top: 0, width: 632, height: 806 });
    assert.equal(zoomed.bitmapWidth, 1264);
    assert.equal(zoomed.bitmapHeight, 1612);
    assert.equal(zoomed.resolutionLimited, false);
});

test('proof cropping never includes pasteboard and handles an offscreen document', () => {
    const base = { docWidth: 432, docHeight: 606, pasteboardOffset: 100, viewportWidth: 800, viewportHeight: 600, devicePixelRatio: 2 };
    const partial = computeProofPreviewGeometry({ ...base, viewportTransform: [1, 0, 0, 1, -200, -250] })!;
    assert.deepEqual(partial.bounds, { left: 0, top: 0, width: 332, height: 456 });
    assert.equal(computeProofPreviewGeometry({ ...base, viewportTransform: [1, 0, 0, 1, 900, 0] }), null);
});

test('extreme viewport sizes stay inside the memory and texture budgets', () => {
    const result = computeProofPreviewGeometry({ docWidth: 10000, docHeight: 10000, pasteboardOffset: 0, viewportTransform: [1, 0, 0, 1, 0, 0], viewportWidth: 10000, viewportHeight: 10000, devicePixelRatio: 3, maxPixels: 4_000_000 })!;
    assert.ok(result.bitmapWidth * result.bitmapHeight <= 4_000_000);
    assert.ok(result.bitmapWidth <= 8192 && result.bitmapHeight <= 8192);
    assert.equal(result.resolutionLimited, true);
});

test('a late frame cannot replace a newer profile, content revision, or interaction state', () => {
    const gate = new ProofRequestGate();
    gate.nextProfile();
    const initial = gate.nextPreview();
    assert.equal(gate.accepts(initial), true);
    gate.invalidatePreview(); // zoom, typing, or beginning a drag
    assert.equal(gate.accepts(initial), false);
    const moving = gate.nextPreview();
    gate.nextProfile();
    assert.equal(gate.accepts(moving), false);
    const older = gate.nextPreview();
    const newer = gate.nextPreview();
    assert.equal(gate.accepts(older), false);
    assert.equal(gate.accepts(newer), true);
});
