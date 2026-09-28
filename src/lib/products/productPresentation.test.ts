import test from 'node:test';
import assert from 'node:assert/strict';
import { safePresentationUrl, IMAGE_HOVER_EFFECTS, CARD_HOVER_EFFECTS } from './productPresentation.ts';

test('presentation URLs reject executable, protocol-relative and credential URLs', () => {
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,x', '//other.example/x', '/\\other.example/x', 'https://user:pass@example.com/image.png']) assert.equal(safePresentationUrl(url), undefined);
  assert.equal(safePresentationUrl('/images/badge.png'), '/images/badge.png');
  assert.equal(safePresentationUrl('https://example.com/image.png'), 'https://example.com/image.png');
});
test('image and card effects offer five independent choices plus none', () => {
  assert.equal(IMAGE_HOVER_EFFECTS.filter(([id])=>id!=='none').length,5);
  assert.equal(CARD_HOVER_EFFECTS.filter(([id])=>id!=='none').length,5);
});
