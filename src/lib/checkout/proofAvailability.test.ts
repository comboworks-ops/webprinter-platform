import assert from 'node:assert/strict';
import test from 'node:test';
import { getCheckoutProofAvailability } from './proofAvailability.ts';

const ready = {hasFile: true, hasPreview: true, processing: false, approved: false,
  hasLocalCheck: true, designerExport: false, hasIssues: false, needsExport: false};

test('empty checkout and removed files never offer review or approval', () => {
  for (const state of [
    {...ready, hasFile: false, hasPreview: false, hasLocalCheck: false},
    {...ready, hasFile: false}, // stale preview/check result after removal
    {...ready, hasPreview: false},
  ]) {
    const result = getCheckoutProofAvailability(state);
    assert.equal(result.canReview, false);
    assert.equal(result.quickApproveAvailable, false);
  }
});

test('uploading and preview-before-check-completion do not allow approval', () => {
  const result = getCheckoutProofAvailability({...ready, processing: true});
  assert.equal(result.canReview, false);
  assert.equal(result.quickApproveAvailable, false);
});

test('a checked, unchanged production file is eligible for quick approval', () => {
  assert.deepEqual(getCheckoutProofAvailability(ready), {
    canReview: true, requiresModalReview: false, quickApproveAvailable: true,
  });
  assert.equal(getCheckoutProofAvailability({...ready, approved: true}).quickApproveAvailable, false);
});

test('restored files without checks and files needing corrections require manual review', () => {
  for (const change of [{hasLocalCheck: false}, {hasIssues: true}, {needsExport: true}]) {
    const result = getCheckoutProofAvailability({...ready, ...change});
    assert.equal(result.canReview, true);
    assert.equal(result.requiresModalReview, true);
    assert.equal(result.quickApproveAvailable, false);
  }
});

test('a valid Designer return preserves its existing approval path', () => {
  assert.equal(getCheckoutProofAvailability({...ready, designerExport: true, hasLocalCheck: false}).quickApproveAvailable, true);
  assert.equal(getCheckoutProofAvailability({...ready, designerExport: true, hasLocalCheck: false, approved: true}).quickApproveAvailable, false);
});
