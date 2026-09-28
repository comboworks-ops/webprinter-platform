import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUTTON_EFFECTS, buttonStyleVariables, canonicalButtonKey, legacyButtonStyle, legacyLocalButtonStyle, localOptionButtonStyle, normalizeButtonStyle, readSharedButtons, resolveSharedButton, sharedButtonsPatch } from './sharedButtons.ts';
import { createDraftHistory, draftHistoryReducer } from './draftHistory.ts';
import type { BrandingData } from '@/hooks/useBrandingDraft';

const fixture = () => ({ themeId: 'print-familiar', themeSettings: { orderFlowDesigns: { checkout: '4' } }, colors: { primary: '#087FC5' }, productPage: { orderButtons: { primary: { bgColor: '#C4084A', textColor: '#FFFFFF' }, secondary: {}, selected: {}, radiusPx: 0, fontSizePx: 16, paddingYPx: 14 }, matrix: { textButtons: { backgroundColor: '#FFFFFF', selectedBackgroundColor: '#087FC5', borderRadiusPx: 8 } } }, hero: { marker: 'preserved' }, forside: { marker: 'preserved' } } as unknown as BrandingData);
test('old designs retain local styling until that specific master role is edited', () => {
  const draft = fixture();
  assert.equal(resolveSharedButton(draft, 'cta'), undefined);
  assert.equal(resolveSharedButton(draft, 'selection'), undefined);
  assert.equal(legacyButtonStyle(draft, 'cta').bgColor, '#C4084A');
  assert.equal(legacyButtonStyle(draft, 'cta').radiusPx, 0);
  assert.equal(legacyButtonStyle(draft, 'selection').radiusPx, 8);
});
test('a master change is isolated from links, product choices, prices, other branding and the other role', () => {
  const draft = fixture(), before = structuredClone(draft), settings = readSharedButtons(draft);
  const style = { ...legacyButtonStyle(draft, 'cta'), bgColor: '#123456', effect: 'water' as const };
  const patch = sharedButtonsPatch(draft, { ...settings, cta: style });
  assert.deepEqual(Object.keys(patch), ['themeSettings']);
  assert.deepEqual(patch.themeSettings!.orderFlowDesigns, before.themeSettings.orderFlowDesigns);
  assert.equal(resolveSharedButton({ ...draft, ...patch }, 'cta')!.effect, 'water');
  assert.equal(resolveSharedButton({ ...draft, ...patch }, 'selection'), undefined);
  assert.deepEqual(draft, before);
});
test('locked local snapshots survive master edits, reset, serialization and bank changes', () => {
  const draft = fixture(), locked = legacyButtonStyle(draft, 'cta');
  const settings = { ...readSharedButtons(draft), cta: { ...locked, bgColor: '#111111' }, overrides: { hero: { role: 'cta' as const, style: { ...locked, effect: 'jelly' as const } } }, bank: [{ id: 'one', name: 'Min knap', role: 'cta' as const, style: { ...locked } }] };
  const next = JSON.parse(JSON.stringify({ ...draft, ...sharedButtonsPatch(draft, settings) }));
  assert.equal(resolveSharedButton(next, 'cta', 'hero:button-1')!.bgColor, '#C4084A');
  assert.equal(resolveSharedButton(next, 'cta', 'hero:button-1')!.effect, 'jelly');
  assert.equal(resolveSharedButton(next, 'cta', 'catalogue')!.bgColor, '#111111');
  assert.equal(readSharedButtons(next).bank[0].style.bgColor, '#C4084A');
  const unlocked = sharedButtonsPatch(next, { ...readSharedButtons(next), overrides: {} });
  assert.equal(resolveSharedButton({ ...next, ...unlocked }, 'cta', 'hero:button-1')!.bgColor, '#111111');
});
test('exact locks use stable option identity rather than a changing display label', () => {
  const draft = fixture(), style = legacyButtonStyle(draft, 'selection');
  const settings = readSharedButtons(draft);
  settings.overrides['product-option.p.s.v'] = { role: 'selection', style };
  const next = { ...draft, ...sharedButtonsPatch(draft, settings) };
  assert.equal(canonicalButtonKey('product-option.p.s.v.A4.with.periods'), 'product-option.p.s.v');
  assert.deepEqual(resolveSharedButton(next, 'selection', 'product-option.p.s.v.New name'), style);
  assert.equal(resolveSharedButton(next, 'cta', 'product-option.p.s.v.New name'), undefined);
});
test('bank operations and resets remain undoable draft actions', () => {
  const draft = fixture(), settings = readSharedButtons(draft), style = legacyButtonStyle(draft, 'cta');
  const saved = { ...draft, ...sharedButtonsPatch(draft, { ...settings, bank: [{ id:'bank-1',name:'Ocean',role:'cta',style }] }) };
  let history = draftHistoryReducer(createDraftHistory(draft), { type:'edit', value:saved });
  history = draftHistoryReducer(history, { type:'undo' });
  assert.deepEqual(history.present, draft);
  history = draftHistoryReducer(history, { type:'redo' });
  assert.equal(readSharedButtons(history.present).bank[0].name, 'Ocean');
});
test('untrusted or older stored settings cannot inject CSS, animation names, or unbounded geometry', () => {
  const fallback = legacyButtonStyle(fixture(), 'cta');
  const style = normalizeButtonStyle({ bgColor:'url(https://bad.test)', effect:'arbitrary', radiusPx: -10, fontSizePx: Infinity, paddingYPx: 500, textColor:'#ABCDEF' }, fallback);
  assert.equal(style.bgColor, fallback.bgColor);
  assert.equal(style.effect, 'none');
  assert.equal(style.radiusPx, 0);
  assert.equal(style.fontSizePx, 16);
  assert.equal(style.paddingYPx, 24);
  assert.equal(style.textColor, '#ABCDEF');
  assert.equal(buttonStyleVariables(style)['--sb-radius'], '0px');
});
test('ten distinct optional effects plus none are available and preserve six separate state colours', () => {
  assert.equal(new Set(BUTTON_EFFECTS.map(effect => effect.id)).size, 11);
  const style = normalizeButtonStyle({ hoverTextColor:'#111111',selectedBgColor:'#222222',selectedTextColor:'#333333' }, legacyButtonStyle(fixture(), 'cta'));
  assert.equal(buttonStyleVariables(style)['--sb-hover-text'], '#111111');
  assert.equal(buttonStyleVariables(style)['--sb-selected'], '#222222');
  assert.equal(buttonStyleVariables(style)['--sb-selected-text'], '#333333');
});

test('locking an authored section captures its own local colours before the master is activated', () => {
  const draft=fixture();
  draft.hero={overlay:{buttons:[{id:'one',variant:'primary',bgColor:'#112233',bgHoverColor:'#223344',textColor:'#FFFFFF'}]},images:[]} as unknown as BrandingData['hero'];
  assert.equal(legacyLocalButtonStyle(draft,'cta','hero').bgColor,'#112233');
  assert.equal(legacyLocalButtonStyle(draft,'cta','hero:one').hoverBgColor,'#223344');
  assert.equal(legacyButtonStyle(draft,'cta').bgColor,'#C4084A');
});
test('a locked product option keeps normal, hover, selected and special effect settings independent of the master', () => {
  const local = localOptionButtonStyle({backgroundColor:'#123456',hoverBackgroundColor:'#234567',textColor:'#FFFFFF',selectedBackgroundColor:'#345678',selectedTextColor:'#FEDCBA',buttonEffect:'jelly',borderRadiusPx:0,paddingPx:8});
  assert.equal(local.bgColor,'#123456'); assert.equal(local.hoverBgColor,'#234567');
  assert.equal(local.selectedBgColor,'#345678'); assert.equal(local.selectedTextColor,'#FEDCBA');
  assert.equal(local.effect,'jelly'); assert.equal(local.radiusPx,0);
});
