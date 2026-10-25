import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendedPrintDpi, placedImageDpi, resolutionWarning, printWarningAcceptanceKey, printWarningOrderNote, PRINT_QUALITY_RESPONSIBILITY } from './printQualityPolicy.ts';

test('small print stays at 300 DPI, independently of dimensions', () => {
  for (const category of ['flyers', 'visitkort', 'tryksager', null]) {
    assert.equal(recommendedPrintDpi({ category, widthMm: 85, heightMm: 55 }), 300);
    assert.equal(recommendedPrintDpi({ category, widthMm: 3000, heightMm: 3000 }), 300);
  }
});
test('wide format uses 150 DPI below 6 m² and 100 DPI from 6 m² per item', () => {
  for (const tag of [{designerMode:'storformat'}, {designerMode:'signage'}, {pricingType:'STORFORMAT'}, {category:'storformat'}, {pricingModel:'storformat'}]) {
    assert.equal(recommendedPrintDpi({...tag, widthMm:1000, heightMm:1000}), 150);
    assert.equal(recommendedPrintDpi({...tag, widthMm:2000, heightMm:2999}), 150);
    assert.equal(recommendedPrintDpi({...tag, widthMm:2000, heightMm:3000}), 100);
    assert.equal(recommendedPrintDpi({...tag, widthMm:NaN, heightMm:3000}), 150);
  }
});
test('actual placed pixels determine resolution, including enlargement and unequal axes', () => {
  const input={widthPx:1200,heightPx:1800,widthMm:101.6,heightMm:152.4,scalePercent:100};
  assert.equal(placedImageDpi(input),300);
  assert.equal(placedImageDpi({...input,scalePercent:200}),150);
  assert.equal(placedImageDpi({...input,scalePercent:400}),75);
  assert.equal(placedImageDpi({...input,heightMm:304.8}),150);
  assert.equal(placedImageDpi({...input,widthPx:0}),null);
  assert.equal(placedImageDpi({...input,scalePercent:NaN}),null);
});
test('warnings use the relevant product threshold and remain overridable even at very low DPI', () => {
  assert.equal(resolutionWarning(300,300),null);
  assert.match(resolutionWarning(299,300)!,/300 DPI/);
  assert.equal(resolutionWarning(150,150),null);
  assert.equal(resolutionWarning(100,100),null);
  assert.match(resolutionWarning(20,100)!,/eget ansvar/);
  assert.equal(resolutionWarning(null,300),null);
});
test('acceptance resets on file, placement, warning or recommendation changes', () => {
  const key=printWarningAcceptanceKey('file-a@x=0',['low DPI'],300);
  for (const args of [['file-b@x=0',['low DPI'],300],['file-a@x=1',['low DPI'],300],['file-a@x=0',['cropping'],300],['file-a@x=0',['low DPI'],150]] as const) {
    assert.notEqual(printWarningAcceptanceKey(args[0],[...args[1]],args[2]),key);
  }
});
test('order responsibility evidence is bound to the approved output hash', () => {
  const approval={version:1 as const,fileSha256:'a'.repeat(64),approvedAt:'2026-10-25T10:00:00Z',warnings:['Lav opløsning: 75 DPI'],acknowledgement:PRINT_QUALITY_RESPONSIBILITY,recommendedDpi:300,effectiveDpi:75};
  assert.match(printWarningOrderNote(approval,'a'.repeat(64))!,/75 DPI/);
  assert.match(printWarningOrderNote(approval,'a'.repeat(64))!,/eget ansvar/);
  assert.equal(printWarningOrderNote(approval,'b'.repeat(64)),null);
  assert.equal(printWarningOrderNote(null,'a'.repeat(64)),null);
});
