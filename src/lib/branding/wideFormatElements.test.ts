import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BrandingData } from '@/hooks/useBrandingDraft';
import { WIDE_FORMAT_DESIGNS } from './wideFormatDesigns';
import { WIDE_ELEMENTS, cleanWideElementStyle, wideElementCss, wideElementStyles, withWideElementStyle } from './wideFormatElements';
import { wideFormatEditorPatch } from './wideFormatEditor';
const initial = () => ({themeSettings:{shopFamily:'wide-format'},hero:{overlay:{}},header:{},colors:{},fonts:{},forside:{lowerInfo:{}},seoContent:{},footer:{},productPage:{protectedPrice:123}}) as unknown as BrandingData;
for (const design of WIDE_FORMAT_DESIGNS) test(`${design.id}: independent elements, recipes and saved snapshots`,()=>{
  let draft=initial();draft.themeSettings.wideFormatDesign=design.id;
  const update=(id:string,patch:Parameters<typeof withWideElementStyle>[2])=>{draft={...draft,...wideFormatEditorPatch(draft,withWideElementStyle(draft,id,patch))};};
  update('banner.title',{color:'#112233',fontFamily:'Lora',fontSize:72,mobileFontSize:34});
  update('content.title',{color:'#445566'});
  const version=JSON.parse(JSON.stringify(draft));
  update('banner.title',{color:'#778899'});
  assert.equal(wideElementStyles(version)['banner.title'].color,'#112233');
  assert.equal(wideElementStyles(draft)['banner.title'].color,'#778899');
  assert.equal(wideElementStyles(draft)['content.title'].color,'#445566');
  const other={...draft,themeSettings:{...draft.themeSettings,wideFormatDesign:design.id==='signal'?'fieldwork':'signal'}};
  assert.deepEqual(wideElementStyles(other),{});
  update('banner.title',null);
  assert.equal(wideElementStyles(draft)['banner.title'],undefined);
  assert.equal(wideElementStyles(draft)['content.title'].color,'#445566');
  assert.deepEqual(draft.productPage,{protectedPrice:123});
  assert.match(wideElementCss(version),/font-family:"Lora"!important/);
  assert.match(wideElementCss(version),/@media\(max-width:640px\)/);
  assert.ok(wideElementCss(version).includes(`data-wide-format="${design.id}"`));
});
test('stored styles cannot introduce selectors, CSS, URLs or invalid numeric values',()=>{
  assert.deepEqual(cleanWideElementStyle({color:'red;}body{display:none',fontFamily:'x";background:url(https://evil.test)',fontSize:Infinity,paddingBlock:-999,backgroundImage:'url(x)',textAlign:'evil',mobileFontSize:500}),{paddingBlock:0,mobileFontSize:100});
  const draft=initial();assert.deepEqual(withWideElementStyle(draft,'body, *',{color:'#112233'}),{});
});
test('all authored sections have controls and section styles precede individual overrides',()=>{
  assert.equal(new Set(WIDE_ELEMENTS.map(item=>item.id)).size,WIDE_ELEMENTS.length);
  for(const section of ['header','logo','banner','showcase','products','content','usp-strip','footer','main-buttons']) assert.ok(WIDE_ELEMENTS.some(item=>item.section===section));
  let draft=initial();draft={...draft,...withWideElementStyle(draft,'banner',{color:'#112233'})};draft={...draft,...withWideElementStyle(draft,'banner.title',{color:'#445566'})};
  const css=wideElementCss(draft);assert.ok(css.indexOf('#112233')<css.indexOf('#445566'));
});
