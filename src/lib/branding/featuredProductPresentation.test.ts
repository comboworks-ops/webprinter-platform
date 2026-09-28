import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FeaturedProductConfig } from '../../hooks/useBrandingDraft';
import { FIRST_FEATURED_SLIDE, getFeaturedSlides, hasFeaturedProducts, hiddenFeaturedProductIds, setFeaturedSlides, styleFeaturedButtons, updateFeaturedSlide } from './featuredProductPresentation.ts';

const fixture = (): FeaturedProductConfig => ({ enabled:true, productId:'flyers', showOptions:true, showPrice:true, overlapPx:0,
  customTitle:'Flyers', quantityPresets:[100,500], showInProductList:false, galleryImages:['/flyer-1.jpg','/flyer-2.jpg'],
  sidePanel:{enabled:true, mode:'banner', items:[{id:'side-one',mode:'product',productId:'cards'}]},
  slides:[{id:'banner-slide',config:{enabled:true,productId:'banners',showPrice:true,showOptions:false,overlapPx:0,quantityPresets:[1,2],customTitle:'Bannere',ctaColor:'#123456',showInProductList:false}}],
});

test('existing single-product data remains the first banner without a migration', () => {
  const config=fixture(); delete config.slides;
  const copy=structuredClone(config); const slides=getFeaturedSlides(config);
  assert.equal(slides.length,1); assert.equal(slides[0].id,FIRST_FEATURED_SLIDE);
  assert.deepEqual(slides[0].config,config); slides[0].config.sidePanel!.items![0].productId='edited';
  assert.deepEqual(config,copy);
});
test('editing a second banner changes only that banner, survives JSON storage and preserves its images and quantities', () => {
  const config=fixture(),before=structuredClone(config);
  const next=updateFeaturedSlide(config,'banner-slide',{customTitle:'Min kampagne',backgroundColor:'#ffeedd'});
  assert.deepEqual(config,before); assert.equal(next.customTitle,'Flyers');
  const reloaded=JSON.parse(JSON.stringify(next)) as FeaturedProductConfig;
  assert.equal(getFeaturedSlides(reloaded)[1].config.customTitle,'Min kampagne');
  assert.deepEqual(reloaded.galleryImages,before.galleryImages);
  assert.deepEqual(reloaded.slides![0].config.quantityPresets,[1,2]);
});
test('moving or removing the first banner retains every other product and the presentation settings', () => {
  const config={...fixture(),presentation:{mode:'carousel' as const,autoPlay:true,intervalMs:9000}};
  const slides=getFeaturedSlides(config); const reordered=setFeaturedSlides(config,[slides[1],slides[0]]);
  assert.equal(reordered.productId,'banners'); assert.equal(reordered.slides![0].config.productId,'flyers');
  assert.deepEqual(reordered.slides![0].config.galleryImages,config.galleryImages);
  assert.deepEqual(reordered.presentation,config.presentation);
  assert.equal(getFeaturedSlides(reordered).length,2);
  const removed=setFeaturedSlides(config,[slides[1]]); assert.equal(removed.productId,'banners'); assert.equal(removed.slides!.length,0);
  assert.equal(hasFeaturedProducts(setFeaturedSlides(config,[])),false);
});
test('a completed extra banner can display before a first product is chosen; disabled banners do not hide catalogue products', () => {
  const config=fixture(); delete config.productId;
  assert.equal(hasFeaturedProducts(config),true); assert.deepEqual(hiddenFeaturedProductIds(config),['banners']);
  config.enabled=false; assert.equal(hasFeaturedProducts(config),false); assert.deepEqual(hiddenFeaturedProductIds(config),[]);
});
test('changing the side-panel mode retains authored gallery items', () => {
  const config=fixture(); const side={...config.sidePanel!,contentMode:'banner' as const};
  const next=updateFeaturedSlide(config,FIRST_FEATURED_SLIDE,{sidePanel:side});
  assert.deepEqual(next.sidePanel!.items,config.sidePanel!.items);
});
test('explicit shared button styling reaches every slide while preserving products, quantities and destinations', () => {
  const config=fixture(); const next=styleFeaturedButtons(config,{ctaColor:'#112233',ctaHoverColor:'#223344',ctaTextColor:'#ffffff',ctaFontSizePx:22});
  for (const slide of getFeaturedSlides(next)) { assert.equal(slide.config.ctaColor,'#112233'); assert.equal(slide.config.ctaFontSizePx,22); }
  assert.equal(next.slides![0].config.productId,'banners'); assert.deepEqual(next.slides![0].config.quantityPresets,[1,2]);
  assert.deepEqual(next.sidePanel!.items,config.sidePanel!.items); assert.equal(config.slides![0].config.ctaColor,'#123456');
});
