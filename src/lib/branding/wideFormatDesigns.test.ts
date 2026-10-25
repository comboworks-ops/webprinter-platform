import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WIDE_FORMAT_DESIGNS,usesWideFormat,wideFormatDesign} from './wideFormatDesigns.ts';
import {signalSettings,withSignalSettings} from './pvcbannerSettings.ts';
import {APPROVED_DROPDOWN_PRESETS} from './dropdownPresets.ts';
test('exactly four approved additions and standard fallback',()=>{
 assert.deepEqual(WIDE_FORMAT_DESIGNS.map(d=>d.id),['signal','nordic-atelier','format-express','after-hours','fieldwork']);
 assert.equal(wideFormatDesign('unknown').id,'signal');
 assert.equal(signalSettings({themeSettings:{wideFormatDesign:'unknown'}}).designId,'signal');
});
test('family switch is explicit, preserves legacy PVC and never enables other tenants implicitly',()=>{
 const pvc='cd3c7d7b-2220-46b8-93cf-096de23e93d8';
 assert.equal(usesWideFormat({},pvc),true);assert.equal(usesWideFormat({},'other'),false);
 assert.equal(usesWideFormat({themeSettings:{shopFamily:'webprinter'}},pvc),false);
 assert.equal(usesWideFormat({themeSettings:{shopFamily:'wide-format'}},'other'),true);
});
test('per-design edits survive switching and reload without replacing standard or product data',()=>{
 const original={themeSettings:{pvcbannerSignal:{heroTitle:'Standard custom',brand:'My shop'},other:{retained:true}},productPage:{matrix:{id:'keep'}}};
 let draft={...original,themeSettings:{...original.themeSettings,wideFormatDesign:'nordic-atelier'}};
 draft=withSignalSettings(draft,{heroTitle:'Atelier custom',heroSize:70});
 const express={...draft,themeSettings:{...draft.themeSettings,wideFormatDesign:'format-express'}};
 assert.equal(signalSettings(express).configurationStyle,'buttons');
 assert.equal(signalSettings(draft).heroTitle,'Atelier custom');
 assert.equal(signalSettings({...draft,themeSettings:{...draft.themeSettings,wideFormatDesign:'signal'}}).heroTitle,'Standard custom');
 assert.equal(signalSettings(JSON.parse(JSON.stringify(draft))).brand,'My shop');
 assert.deepEqual(draft.productPage,original.productPage);assert.deepEqual(draft.themeSettings.other,original.themeSettings.other);
 assert.equal(signalSettings(original).heroTitle,'Standard custom');
});
test('every approved menu persists independently across all five designs',()=>{
 for(const menu of APPROVED_DROPDOWN_PRESETS){
 const draft=withSignalSettings({themeSettings:{wideFormatDesign:'nordic-atelier'}},{dropdownStyle:menu.id});
 for(const design of WIDE_FORMAT_DESIGNS) assert.equal(signalSettings({...draft,themeSettings:{...draft.themeSettings,wideFormatDesign:design.id}}).dropdownStyle,menu.id);
 }
});
test('all designs expose bounded editable configuration checkout and contact choices',()=>{
 for(const d of WIDE_FORMAT_DESIGNS){const b=signalSettings({themeSettings:{wideFormatDesign:d.id}});assert.equal(b.designId,d.id);assert.equal(b.configurationStyle,d.configuration);assert.equal(b.checkoutStyle,d.checkout);assert.match(b.heroImage,/^\//);}
 const b=signalSettings(withSignalSettings({themeSettings:{wideFormatDesign:'after-hours'}},{checkoutStyle:'bogus',configurationStyle:'bad',heroSize:999}));
 assert.equal(b.checkoutStyle,'standard');assert.equal(b.configurationStyle,'fields');assert.equal(b.heroSize,140);
});

test('global palette changes flow to untouched sections while preserving section overrides',()=>{
 let draft=withSignalSettings({themeSettings:{wideFormatDesign:'nordic-atelier'}},{primary:'#123456'});
 assert.equal(signalSettings(draft).buttonBackground,'#123456');
 draft=withSignalSettings(draft,{buttonBackground:'#654321',primary:'#112233'});
 assert.equal(signalSettings(draft).buttonBackground,'#654321');
 assert.equal(signalSettings(draft).ribbonBackground,'#112233');
});

test('explicit wide-format shops inherit their own identity and use a safe catalogue destination',()=>{
 const branding={shop_name:'My Wide Shop',logo_url:'/my-logo.png',themeSettings:{shopFamily:'wide-format',wideFormatDesign:'fieldwork'}};
 const b=signalSettings(branding);assert.equal(b.brand,'My Wide Shop');assert.equal(b.logo,'/my-logo.png');assert.equal(b.heroLink,'/produkter');
});
