import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveFeaturedLayout } from './featuredProductLayout.ts';

test('unchanged designs retain their existing placement', () => {
  assert.equal(resolveFeaturedLayout(undefined).marginTop, undefined);
  assert.equal(resolveFeaturedLayout({ widthPct: 75 }).marginTop, undefined);
});

test('explicit zero removes overlap and positive spacing moves down', () => {
  assert.equal(resolveFeaturedLayout({ offsetYPx: 0 }).marginTop, '0px');
  assert.equal(resolveFeaturedLayout({ offsetYPx: 48 }).marginTop, '48px');
  assert.equal(resolveFeaturedLayout({ offsetYPx: -48 }).marginTop, '-48px');
});

test('alignment and width leave safe room for edge spacing', () => {
  const right = resolveFeaturedLayout({ widthPct: 70, alignment: 'right', edgeInsetPx: 24 });
  assert.equal(right.width, '70%');
  assert.equal(right.marginLeft, 'auto');
  assert.equal(right.marginRight, 'min(24px, 10%)');
  assert.equal(right.maxWidth, 'calc(100% - 2 * min(24px, 10%))');
  assert.equal(resolveFeaturedLayout({ alignment: 'left' }).marginLeft, 'min(0px, 10%)');
  assert.equal(resolveFeaturedLayout().marginRight, 'auto');
});

test('invalid saved geometry is bounded without altering the source', () => {
  const input = { widthPct: 500, offsetYPx: -999, edgeInsetPx: -10, bottomGapPx: NaN };
  const result = resolveFeaturedLayout(input);
  assert.equal(result.width, '100%');
  assert.equal(result.marginTop, '-160px');
  assert.equal(result.marginBottom, '0px');
  assert.equal(input.widthPct, 500);
});
