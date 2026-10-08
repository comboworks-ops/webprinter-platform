import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MENU_ENTRANCES, resolveMenuEntrance, resolveSearchPresentation, resolveLanguagePresentation, menuColorsChanged, headerMenuStyle } from './headerMenuSettings.ts';
import { filterHeaderProducts } from '../storefront/headerSearch.ts';

test('all five motions resolve; absent and stale settings retain the preset motion', () => {
  assert.equal(MENU_ENTRANCES.length, 5);
  for (const option of MENU_ENTRANCES) assert.equal(resolveMenuEntrance(option.id), option.id);
  for (const invalid of [undefined, null, '', 'slide-old', {}, 4]) assert.equal(resolveMenuEntrance(invalid), undefined);
});
test('the first five sets have different search and language behaviours with explicit overrides', () => {
  const presets = ['tabbed-explorer','visual-showroom','kinetic-type','quick-list','search-and-discover'];
  assert.deepEqual(presets.map(id => resolveSearchPresentation(id)), ['categories','visual','command','compact','discover']);
  assert.deepEqual(presets.map(id => resolveLanguagePresentation(id)), ['label','cards','segmented','code','flag']);
  for (const preset of [...presets,'paper-fold','open-directory','product-filmstrip','focus-curtain','classic']) {
    assert.equal(resolveSearchPresentation(preset,'compact'),'compact');
    assert.equal(resolveLanguagePresentation(preset,'flag'),'flag');
    assert.equal(resolveSearchPresentation(preset,'invalid'),resolveSearchPresentation(preset));
    assert.equal(resolveLanguagePresentation(preset,{}),resolveLanguagePresentation(preset));
  }
});
test('behaviour changes preserve the dark palette; colour edits customize it', () => {
  const before = { dropdownBgColor:'#FFFFFF', dropdownProductColor:'#123456' };
  assert.equal(menuColorsChanged(before,{...before,dropdownEntrance:'bounce',dropdownSearchPresentation:'visual'}),false);
  assert.equal(menuColorsChanged(before,{...before,dropdownAccentColor:'#AABBCC'}),true);
  assert.equal(headerMenuStyle(before)['--menu-dark-bg' as never],undefined);
  const customized = headerMenuStyle(before, '#087fc5', true) as Record<string,unknown>;
  assert.equal(customized['--menu-dark-bg'],'rgba(255, 255, 255, 0.95)');
  assert.equal(customized['--menu-dark-text'],'#123456');
  assert.equal(customized['--menu-accent'],'#087fc5');
});
test('search matches every token across the complete catalogue and filters categories', () => {
  const products = Array.from({length:12},(_,i) => ({id:String(i),name:`Flyers ${i < 8 ? 'A5' : 'A3'}`,slug:`flyers-${i}`,category:i % 2 ? 'Tryksager' : 'Kampagne'}));
  const before = structuredClone(products);
  assert.equal(filterHeaderProducts(products,' FLYERS   a3 ').length,4);
  assert.equal(filterHeaderProducts(products,'flyers a5','Tryksager').length,4);
  assert.equal(filterHeaderProducts(products,'','Kampagne').length,6);
  assert.equal(filterHeaderProducts(products,'').length,12);
  assert.equal(filterHeaderProducts(products,'ukendt').length,0);
  assert.deepEqual(products,before);
});

test('menu icon motion remains optional and does not customize the palette', () => {
  const base = { dropdownBgColor: '#FFFFFF' };
  const playful = { ...base, dropdownIconMotion: 'playful' as const };
  assert.equal(menuColorsChanged(base, playful), false);
  assert.equal(headerMenuStyle(base)['--menu-icon-animation'], 'none');
  assert.equal(headerMenuStyle(playful)['--menu-icon-animation'], 'wp-menu-icon-bounce');
});
