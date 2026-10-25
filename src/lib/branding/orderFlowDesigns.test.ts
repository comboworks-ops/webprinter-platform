import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOrderFlowDesign, resolveOrderFlowDesign, ORDER_FLOW_DESIGNS } from './orderFlowDesigns.ts';

test('approved page defaults resolve independently and foreign page option numbers are rejected', () => {
  assert.deepEqual(ORDER_FLOW_DESIGNS.map(page => resolveOrderFlowDesign(page.page)), [2, 6, 7, 12, 13, 16]);
  for (const page of ORDER_FLOW_DESIGNS) {
    assert.equal(resolveOrderFlowDesign(page.page, undefined, String(page.alternative)), page.alternative);
    assert.equal(resolveOrderFlowDesign(page.page, undefined, '18oops'), page.default);
    const foreign = ORDER_FLOW_DESIGNS.find(other => other.page !== page.page)!;
    assert.equal(resolveOrderFlowDesign(page.page, undefined, String(foreign.default)), page.default);
  }
});

test('switching checkout retains the other page settings and unrelated draft data', () => {
  const branding = { themeSettings: { customSetting: { enabled: true }, orderFlowDesigns: { calculator: 1, proof: 9 } } };
  const before = structuredClone(branding);
  const patch = applyOrderFlowDesign(branding, 'checkout', 4);
  assert.deepEqual(branding, before);
  assert.deepEqual(patch.themeSettings.orderFlowDesigns, { calculator: 1, proof: 9, checkout: 4 });
  assert.equal(patch.themeSettings.customSetting, branding.themeSettings.customSetting);
  assert.deepEqual(Object.keys(patch), ['themeSettings']);
  assert.equal(resolveOrderFlowDesign('checkout', patch), 4);
  assert.equal(resolveOrderFlowDesign('payment', patch), 13);
});

test('local preview can override a saved choice without modifying it; invalid URLs retain saved choices', () => {
  const branding = applyOrderFlowDesign({}, 'designer', 11);
  assert.equal(resolveOrderFlowDesign('designer', branding, '12'), 12);
  assert.equal(resolveOrderFlowDesign('designer', branding), 11);
  assert.equal(resolveOrderFlowDesign('designer', branding, '6'), 11);
});

test('wide-format flow edits are isolated per shop design and retain the conventional layouts',()=>{
 const original={themeSettings:{shopFamily:'wide-format',wideFormatDesign:'nordic-atelier',orderFlowDesigns:{payment:13,checkout:6},wideFormatOverrides:{'nordic-atelier':{heroTitle:'Keep me'}},other:'keep'}};
 const changed=applyOrderFlowDesign(original,'payment',15);
 assert.equal(resolveOrderFlowDesign('payment',changed),15);
 assert.equal(resolveOrderFlowDesign('payment',{themeSettings:{...changed.themeSettings,wideFormatDesign:'fieldwork'}}),13);
 assert.equal(resolveOrderFlowDesign('payment',{themeSettings:{...changed.themeSettings,shopFamily:'webprinter'}}),13);
 const fieldwork=applyOrderFlowDesign({themeSettings:{...changed.themeSettings,wideFormatDesign:'fieldwork'}},'checkout',4);
 const restored={themeSettings:{...JSON.parse(JSON.stringify(fieldwork.themeSettings)),wideFormatDesign:'nordic-atelier'}};
 assert.equal(resolveOrderFlowDesign('payment',restored),15);
 assert.equal(resolveOrderFlowDesign('checkout',restored),6);
 assert.deepEqual(changed.themeSettings.wideFormatOverrides,original.themeSettings.wideFormatOverrides);
 assert.equal(original.themeSettings.orderFlowDesigns.payment,13);
});
