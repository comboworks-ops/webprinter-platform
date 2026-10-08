import test from 'node:test';
import assert from 'node:assert/strict';
import { brochureFacingPages, brochurePageObjects, brochureSpreadPreviewObjects, stripBrochurePreviewClip, pruneBrochurePdfAssets, createBrochureDocument, joinBrochureSpread, unlinkBrochureSpread, readBrochureDocument, validateBrochurePdfPageCount } from './brochureDocument.ts';
import { encodeDesignerSnapshot, decodeDesignerSnapshot } from './saveDesign.ts';

test('saddle stitching rejects 55 pages and preserves 56 numbered reading-order pages', () => {
  assert.throws(() => createBrochureDocument(55, 210, 297), /trin på fire/);
  const document = createBrochureDocument(56, 210, 297);
  assert.deepEqual(document.pages.map(p => p.number), Array.from({ length: 56 }, (_, i) => i + 1));
});
test('covers are individual pages and only actual facing pages form a spread', () => {
  assert.equal(brochureFacingPages(1, 8), null);
  assert.equal(brochureFacingPages(8, 8), null);
  assert.deepEqual(brochureFacingPages(3, 8), [2, 3]);
  assert.deepEqual(brochureFacingPages(4, 8), [4, 5]);
  assert.throws(() => joinBrochureSpread(createBrochureDocument(8, 148, 210), 3, 4, 2), /opslag/);
});
test('joining pages retains vector bytes and crossing artwork without changing the originals', () => {
  const document = createBrochureDocument(8, 210, 297);
  document.pages[1].objects.push({ left: 20, type: 'i-text', text: 'Venstre' });
  document.pages[2].objects.push({ left: 40, type: 'image', data: { originalPdfBytes: new Uint8Array([37, 80, 68, 70]).buffer } });
  const joined = joinBrochureSpread(document, 2, 3, 2);
  assert.equal(document.spreads.length, 0);
  assert.equal(joined.spreads[0].objects[1].left, 460);
  joined.spreads[0].objects.push({ left: 400, width: 100, type: 'rect' });
  const right = brochurePageObjects(joined, 3, 2);
  assert.equal(right[1].left, 40);
  assert.equal(right[2].left, -20);
  assert.deepEqual(new Uint8Array((right[1].data as { originalPdfBytes: ArrayBuffer }).originalPdfBytes), new Uint8Array([37, 80, 68, 70]));
  assert.equal(joinBrochureSpread(joined, 2, 3, 2), joined);
});
test('bulk PDF assignment refuses a missing page instead of inventing or truncating artwork', () => {
  assert.throws(() => validateBrochurePdfPageCount(7, 8), /7 sider/);
  assert.doesNotThrow(() => validateBrochurePdfPageCount(8, 8));
  assert.throws(() => validateBrochurePdfPageCount(2, 8, true), /én PDF-side/);
});
test('facing PDF bleed never paints the neighboring page, while new artwork crosses the seam', () => {
  const document = createBrochureDocument(8, 210, 297);
  const bytes = new Uint8Array([37, 80, 68, 70]).buffer;
  document.pages[1].objects = [{ left: 316, type: 'image', data: { kind: 'pdf_page_background', originalPdfBytes: bytes } }];
  document.pages[2].objects = [{ left: 316, type: 'image', data: { kind: 'pdf_page_background', originalPdfBytes: bytes } }];
  const joined = joinBrochureSpread(document, 2, 3, 2);
  joined.spreads[0].objects.push({ type: 'rect', left: 500, width: 100 });
  const preview = brochureSpreadPreviewObjects(joined, joined.spreads[0], 2, 100);
  assert.equal((preview[0].clipPath as { left: number; width: number }).left, 100);
  assert.equal((preview[0].clipPath as { width: number }).width, 426);
  assert.equal((preview[1].clipPath as { left: number }).left, 526);
  joined.spreads[0].objects = preview.map(stripBrochurePreviewClip);
  for (const number of [2, 3]) {
    const objects = brochurePageObjects(joined, number, 2);
    assert.equal(objects.length, 2);
    assert.equal(objects[0].clipPath, undefined);
    assert.equal((objects[0].data as { brochureBackgroundPage: number }).brochureBackgroundPage, number);
    assert.deepEqual(new Uint8Array((objects[0].data as { originalPdfBytes: ArrayBuffer }).originalPdfBytes), new Uint8Array(bytes));
    assert.equal(objects[1].left, number === 2 ? 500 : 80);
  }
  const unlinked = unlinkBrochureSpread(joined, 2, 2);
  assert.equal(unlinked.pages[1].objects.length, 2);
  assert.equal(unlinked.pages[2].objects.length, 2);
  assert.deepEqual(stripBrochurePreviewClip({ clipPath: { type: 'circle' } }).clipPath, { type: 'circle' });
});
test('reopened documents reject changed page order, duplicate spreads and invalid dimensions', () => {
  const document = joinBrochureSpread(createBrochureDocument(8, 148, 210), 2, 3, 2);
  assert.deepEqual(readBrochureDocument({ brochureDocument: document }), document);
  document.spreads.push(structuredClone(document.spreads[0]));
  assert.throws(() => readBrochureDocument({ brochureDocument: document }), /gentaget/);
  document.spreads.pop();
  document.pages[2].number = 4;
  assert.throws(() => readBrochureDocument({ brochureDocument: document }), /siderækkefølge/);
});
test('152-page saved document stores one exact original PDF and preserves page refs through JSON transport', () => {
  const document = createBrochureDocument(152,210,297);
  const bytes=Uint8Array.from({length:65536},(_,index)=>index%256).buffer;
  document.pdfAssets={source:{bytes,pageCount:152,fileName:'original.pdf'}};
  for(const page of document.pages)page.objects=[{type:'image',left:316,data:{kind:'pdf_page_background',brochureBackgroundPage:page.number,brochurePdfAssetId:'source',pageIndex:page.number-1,totalPages:152}}];
  const encoded=JSON.stringify(encodeDesignerSnapshot({brochureDocument:document}));
  assert.equal(encoded.match(/__webprinter_arraybuffer_v1/g)?.length,1);
  const restored=readBrochureDocument(decodeDesignerSnapshot(JSON.parse(encoded)))!;
  for(const number of [1,2,3,151,152]){
    const data=brochurePageObjects(restored,number,2)[0].data as {originalPdfBytes:ArrayBuffer,pageIndex:number};
    assert.equal(data.originalPdfBytes,restored.pdfAssets!.source.bytes);
    assert.deepEqual(new Uint8Array(data.originalPdfBytes),new Uint8Array(bytes));
    assert.equal(data.pageIndex,number-1);
  }
  const joined=joinBrochureSpread(restored,2,3,2);
  joined.spreads[0].objects=brochureSpreadPreviewObjects(joined,joined.spreads[0],2,100).map(stripBrochurePreviewClip);
  const unlinked=unlinkBrochureSpread(joined,2,2);
  assert.equal((unlinked.pages[1].objects[0].data as {originalPdfBytes?:ArrayBuffer}).originalPdfBytes,undefined);
  assert.equal((brochurePageObjects(unlinked,3,2)[0].data as {pageIndex:number}).pageIndex,2);
  assert.equal(JSON.stringify(encodeDesignerSnapshot({brochureDocument:unlinked})).match(/__webprinter_arraybuffer_v1/g)?.length,1);
});
test('missing or changed source/page identity fails closed; replaced unused assets can be pruned',()=>{
  const document=createBrochureDocument(8,210,297);
  document.pdfAssets={source:{bytes:new Uint8Array([1,2,3]).buffer,pageCount:8,fileName:'source.pdf'},unused:{bytes:new Uint8Array([4]).buffer,pageCount:1,fileName:'old.pdf'}};
  document.pages[0].objects=[{data:{kind:'pdf_page_background',brochurePdfAssetId:'source',pageIndex:0,totalPages:8}}];
  pruneBrochurePdfAssets(document);assert.deepEqual(Object.keys(document.pdfAssets),['source']);
  const invalid=structuredClone(document);(invalid.pages[0].objects[0].data as {pageIndex:number}).pageIndex=8;
  assert.throws(()=>readBrochureDocument({brochureDocument:invalid}),/PDF-kilde/);
  delete invalid.pdfAssets!.source;
  assert.throws(()=>brochurePageObjects(invalid,1,2),/PDF-kilde/);
});
