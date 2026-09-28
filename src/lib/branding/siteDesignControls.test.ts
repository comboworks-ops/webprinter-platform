import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDraftHistory, draftHistoryReducer } from './draftHistory.ts';
import { applyMainButtonSettings, dropdownBackground, resolvePrintHero, standardSiteDesign } from './siteDesignControls.ts';
import type { BrandingData } from '@/hooks/useBrandingDraft';

const fixture = () => ({
  themeId: 'print-familiar', themeSettings: { visualStyleId: 'print-familiar', orderFlowDesigns: { checkout: '4' } },
  fonts: {}, colors: { primary: '#087FC5' }, logo_url: '/shop.png',
  header: { logoText: 'Min shop', navItems: [{ href:'/kontakt', label:'Kontakt' }], scroll: {} },
  hero: { images: [{ id:'own', url:'/mine.jpg', sortOrder:0, headline:'Bevar teksten', buttons:[{id:'own-button',variant:'primary',label:'Køb',linkType:'PRODUCT',target:{ productSlug:'skilte' }}] }],
    videos:[], parallax:true, videoSettings:{parallaxEnabled:false}, overlay:{title:'Vores eget budskab',subtitle:'Min tekst',buttons:[{id:'action',variant:'primary',label:'Find dit produkt',linkType:'ALL_PRODUCTS',target:{}},{id:'contact',variant:'secondary',label:'Kontakt',linkType:'INTERNAL_PAGE',target:{path:'/kontakt'}}]} },
  forside:{ layout:{sectionOrder:['products','hero']}, productsSection:{ presentation:'precision-catalogue', button:{}, card:{}, featuredProductConfig:{enabled:true,productId:'mine',quantityPresets:[1,5,10],sidePanel:{enabled:false}}} },
  productPage:{ orderButtons:{primary:{},secondary:{bgColor:'#eee'},selected:{bgColor:'#080'},radiusPx:8,fontSizePx:16,paddingYPx:14}, pricingMarker:'untouched' },
} as unknown as BrandingData);

test('undo coalesces typing but separates fields, supports redo and clears the abandoned branch', () => {
  let state = createDraftHistory({ title:'A',subtitle:'B' });
  const edit = (value: typeof state.present, at:number) => { state = draftHistoryReducer(state, {type:'edit',value,at,group:'hero'}); };
  edit({title:'AA',subtitle:'B'},1000); edit({title:'AAA',subtitle:'B'},1100); edit({title:'AAA',subtitle:'BB'},1200);
  assert.equal(state.past.length,2);
  state=draftHistoryReducer(state,{type:'undo'}); assert.deepEqual(state.present,{title:'AAA',subtitle:'B'});
  state=draftHistoryReducer(state,{type:'undo'}); assert.deepEqual(state.present,{title:'A',subtitle:'B'});
  state=draftHistoryReducer(state,{type:'redo'}); assert.equal(state.present.title,'AAA');
  edit({title:'New',subtitle:'B'},1500); assert.equal(state.future.length,0);
});
test('history ignores no-ops, bounds memory and isolates a newly loaded shop', () => {
  let state=createDraftHistory(0);
  for(let i=1;i<=75;i++) state=draftHistoryReducer(state,{type:'edit',value:i});
  assert.equal(state.past.length,50);
  assert.equal(draftHistoryReducer(state,{type:'edit',value:75}),state);
  state=draftHistoryReducer(state,{type:'load',value:100});
  assert.deepEqual(state,createDraftHistory(100));
});
test('shared main buttons update destinations in one undo step without changing content, prices or identity', () => {
  const draft=fixture(), before=structuredClone(draft);
  const patch=applyMainButtonSettings(draft,{bgColor:'#004400',hoverBgColor:'#002200',textColor:'#ffffff',radiusPx:20,fontSizePx:18,paddingYPx:18});
  assert.equal(patch.hero!.overlay.buttons[0].bgColor,'#004400');
  assert.equal(patch.productPage!.orderButtons.primary.gradientStart,'#004400');
  assert.equal(patch.productPage!.orderButtons.primary.hoverGradientEnd,'#002200');
  assert.deepEqual(patch.hero!.overlay.buttons[0].target,draft.hero.overlay.buttons[0].target);
  assert.deepEqual(patch.hero!.overlay.buttons[1],draft.hero.overlay.buttons[1]);
  assert.equal(patch.hero!.images[0].headline,'Bevar teksten');
  assert.equal(patch.hero!.images[0].buttons![0].target.productSlug,'skilte');
  assert.equal(patch.forside!.productsSection.featuredProductConfig.productId,'mine');
  assert.equal(patch.forside!.productsSection.featuredProductConfig.ctaHoverColor,'#002200');
  assert.deepEqual(patch.forside!.productsSection.featuredProductConfig.quantityPresets,[1,5,10]);
  assert.deepEqual(patch.productPage!.orderButtons.selected,draft.productPage.orderButtons.selected);
  assert.deepEqual(draft,before);
});
test('shared print text is rendered while authored per-slide content remains available', () => {
  const draft=fixture();
  assert.equal(resolvePrintHero(draft).images[0].headline,undefined);
  assert.equal(draft.hero.images[0].headline,'Bevar teksten');
  draft.hero.textSource='slides';
  assert.equal(resolvePrintHero(draft).images[0].headline,'Bevar teksten');
  draft.hero.overlay.title='';
  assert.equal(resolvePrintHero(draft).overlay.title,'','explicitly empty text must remain empty');
});
test('standard reset is a pure draft transformation with retained shop and product content', () => {
  const draft=fixture(); draft.productPage.orderButtons.primary.bgColor='#006633'; draft.header.dropdownProductColor='#FFFFFF';
  const before=structuredClone(draft), standard=standardSiteDesign(draft);
  assert.equal(standard.productPage.orderButtons.primary.bgColor,'#087FC5');
  assert.equal(standard.themeId,'print-familiar');
  assert.equal(standard.header.dropdownProductColor,'#1F2937');
  assert.equal(standard.hero.parallax,false);
  assert.equal(standard.hero.overlay.title,draft.hero.overlay.title);
  assert.equal(standard.logo_url,draft.logo_url);
  assert.deepEqual(standard.header.navItems,draft.header.navItems);
  assert.equal(standard.forside.productsSection.featuredProductConfig.productId,'mine');
  let state=draftHistoryReducer(createDraftHistory(draft),{type:'edit',value:standard});
  state=draftHistoryReducer(state,{type:'undo'});assert.deepEqual(state.present,before);
  assert.deepEqual(draft,before);
});
test('dropdown colors retain zero-valued channels and bounded opacity', () => {
  assert.equal(dropdownBackground('#000000',1),'rgba(0, 0, 0, 1)');
  assert.equal(dropdownBackground('#008000',0.5),'rgba(0, 128, 0, 0.5)');
  assert.equal(dropdownBackground('#FF0000',2),'rgba(255, 0, 0, 1)');
});

test('primary action tokens retain gradients, square corners and distinct selection styling', async () => {
  const { primaryButtonStyle } = await import('./primaryButtonStyle.ts');
  const draft=fixture();
  draft.productPage.orderButtons.radiusPx=0;
  Object.assign(draft.productPage.orderButtons.primary,{bgColor:'#005533',textColor:'#ffffff',gradientStart:'#005533',gradientEnd:'#113322',hoverBgColor:'#002211'});
  const style=primaryButtonStyle(draft);
  assert.equal(style['--shop-action-radius'],'0px');
  assert.equal(style['--shop-action-bg'],'linear-gradient(135deg, #005533, #113322)');
  assert.equal(style['--shop-action-hover'],'#002211');
  assert.equal(draft.productPage.orderButtons.selected.bgColor,'#080');
  const patched=applyMainButtonSettings(draft,{bgColor:'#005533',hoverBgColor:'#002211',textColor:'#ffffff',radiusPx:0,fontSizePx:18,paddingYPx:18});
  assert.equal(patched.forside!.productsSection.featuredProductConfig.sidePanel!.ctaColor,'#005533');
});
