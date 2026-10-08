import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HeaderSettings } from '@/hooks/useBrandingDraft';
import { menuReviewLink, readMenuReviewQuery, readMenuReviewPalette } from './headerMenuReviewState.ts';

test('review links carry edited visual settings between Products and corner previews', () => {
  const header = { dropdownPreset:'visual-showroom', dropdownEntrance:'cascade', dropdownSearchPresentation:'categories', dropdownLanguagePresentation:'code', dropdownBgColor:'#F1F5F9', dropdownProductColor:'#123456', dropdownHoverColor:'#FFEEDD', dropdownAccentColor:'#BB2244' } as HeaderSettings;
  const link = menuReviewLink('/dropdown-menu-review.html', header, true);
  const search = new URL(link,'http://localhost').search;
  assert.deepEqual(readMenuReviewQuery(header,search),header);
  assert.equal(readMenuReviewPalette(false,search),true);
});
test('restoring automatic behaviours clears an earlier local saved override', () => {
  const stored = { dropdownPreset:'kinetic-type', dropdownEntrance:'bounce', dropdownSearchPresentation:'visual', dropdownLanguagePresentation:'cards', dropdownAccentColor:'#AABBCC' } as HeaderSettings;
  const reset = { ...stored, dropdownEntrance:undefined, dropdownSearchPresentation:undefined, dropdownLanguagePresentation:undefined, dropdownAccentColor:undefined };
  const search = new URL(menuReviewLink('/header-menu-review.html',reset,false),'http://localhost').search;
  assert.deepEqual(readMenuReviewQuery(stored,search),reset);
  assert.equal(readMenuReviewPalette(true,search),false);
});
test('review query accepts only supported settings and hex colours', () => {
  const header = { dropdownPreset:'search-and-discover', dropdownBgColor:'#FFFFFF' } as HeaderSettings;
  const parsed = readMenuReviewQuery(header,'?entrance=invalid&search=invalid&language=invalid&dropdownBgColor=url(unsafe)&palette=invalid');
  assert.equal(parsed.dropdownBgColor,'#FFFFFF');
  assert.equal(parsed.dropdownEntrance,undefined);
  assert.equal(readMenuReviewPalette(false,'?palette=invalid'),false);
});

test('icon family and optional icon motion survive public review links', () => {
  const header = { dropdownPreset: 'search-and-discover', dropdownIconMotion: 'playful' } as HeaderSettings;
  const url = new URL(menuReviewLink('/header-menu-review.html', header, false, 'phosphor'), 'http://localhost');
  assert.equal(url.searchParams.get('icons'), 'phosphor');
  assert.equal(readMenuReviewQuery(header, url.search).dropdownIconMotion, 'playful');
  assert.equal(readMenuReviewQuery(header, '?iconMotion=untrusted').dropdownIconMotion, undefined);
});
