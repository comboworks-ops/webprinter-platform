import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHeaderMode, shouldUseCompactHeader } from './headerFit.ts';

const roomy = { viewportWidth: 1440, availableWidth: 1376, logoWidth: 240, navigationWidth: 410, actionsWidth: 450 };
test('tablet landscape uses a compact menu even if short labels happen to fit', () => {
  assert.equal(shouldUseCompactHeader({ ...roomy, viewportWidth: 1194 }), true);
  assert.equal(shouldUseCompactHeader(roomy), false);
});
test('long tenant labels and actions collapse before they overlap', () => {
  assert.equal(shouldUseCompactHeader({ ...roomy, navigationWidth: 700 }), true);
  assert.equal(shouldUseCompactHeader({ ...roomy, actionsWidth: 700 }), true);
});
test('centered navigation reserves the larger side on both sides', () => {
  assert.equal(shouldUseCompactHeader({ ...roomy, centered: true, availableWidth: 1300 }), true);
  assert.equal(shouldUseCompactHeader({ ...roomy, centered: false, availableWidth: 1300 }), false);
});
test('compact release includes a margin and unknown sizes fail closed', () => {
  assert.equal(shouldUseCompactHeader({ ...roomy, availableWidth: 1150 }), false);
  assert.equal(shouldUseCompactHeader({ ...roomy, availableWidth: 1150, wasCompact: true }), true);
  assert.equal(shouldUseCompactHeader({ ...roomy, availableWidth: Number.NaN }), true);
});

const storefront = { viewportWidth: 1024, availableWidth: 928, logoWidth: 176, navigationWidth: 400, actionsWidth: 224, minimumDesktopWidth: 640, allowStackedDesktop: true };
test('storefront keeps one desktop row below the old laptop breakpoint when it fits', () => {
  assert.equal(resolveHeaderMode(storefront), 'desktop');
  assert.equal(resolveHeaderMode({ ...storefront, viewportWidth: 768, availableWidth: 704 }), 'stacked');
});
test('stacked navigation stays visible above phone width when both rows fit', () => {
  assert.equal(resolveHeaderMode({ ...storefront, viewportWidth: 640, availableWidth: 592 }), 'stacked');
  assert.equal(resolveHeaderMode({ ...storefront, viewportWidth: 639, availableWidth: 591 }), 'compact');
  assert.equal(resolveHeaderMode({ ...storefront, viewportWidth: 390, availableWidth: 342 }), 'compact');
});
test('both stacked rows are measured and long labels never overflow', () => {
  const narrow = { ...storefront, viewportWidth: 768, availableWidth: 704 };
  assert.equal(resolveHeaderMode({ ...narrow, navigationWidth: 705 }), 'compact');
  assert.equal(resolveHeaderMode({ ...narrow, logoWidth: 500 }), 'compact');
  assert.equal(resolveHeaderMode({ ...narrow, actionsWidth: 530 }), 'compact');
  assert.equal(resolveHeaderMode({ ...narrow, navigationWidth: Number.NaN }), 'compact');
});
test('centered navigation retains side clearance in one row and may use its own second row', () => {
  assert.equal(resolveHeaderMode({ ...storefront, availableWidth: 875, centered: false }), 'desktop');
  assert.equal(resolveHeaderMode({ ...storefront, availableWidth: 875, centered: true }), 'stacked');
});
test('release margins prevent desktop and stacked mode oscillation at fractional widths', () => {
  assert.equal(resolveHeaderMode({ ...storefront, availableWidth: 850, previousMode: 'desktop' }), 'desktop');
  assert.equal(resolveHeaderMode({ ...storefront, availableWidth: 850, previousMode: 'stacked' }), 'stacked');
  assert.equal(resolveHeaderMode({ ...storefront, availableWidth: 860, previousMode: 'stacked' }), 'stacked');
  assert.equal(resolveHeaderMode({ ...storefront, availableWidth: 865, previousMode: 'stacked' }), 'desktop');
  assert.equal(resolveHeaderMode({ ...storefront, availableWidth: 430, previousMode: 'stacked' }), 'stacked');
  assert.equal(resolveHeaderMode({ ...storefront, availableWidth: 430, previousMode: 'compact' }), 'compact');
});
test('existing shared-header callers retain their opt-in policy and desktop floor', () => {
  assert.equal(resolveHeaderMode({ ...roomy, viewportWidth: 1024 }), 'compact');
  assert.equal(resolveHeaderMode({ ...roomy, navigationWidth: 700 }), 'compact');
  assert.equal(resolveHeaderMode(roomy), 'desktop');
});
