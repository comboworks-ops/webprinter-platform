import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFString } from 'pdf-lib';
import { copyBrochurePdfPage, deduplicateBrochureIccProfiles } from './brochurePdf.ts';

test('split PDF retains its global output intent and only the requested page', async () => {
  const source = await PDFDocument.create(); source.addPage([100, 200]); source.addPage([300, 400]);
  const icc = source.context.register(source.context.flateStream(new Uint8Array([1, 2, 3]), { N: 4 }));
  source.catalog.set(PDFName.of('OutputIntents'), source.context.obj([{ Type: 'OutputIntent', OutputConditionIdentifier: PDFString.of('Original ICC'), DestOutputProfile: icc }]));
  const result = await PDFDocument.load(await copyBrochurePdfPage(source, 1));
  assert.equal(result.getPageCount(), 1); assert.equal(result.getPage(0).getWidth(), 300);
  const intent = result.catalog.lookup(PDFName.of('OutputIntents'), PDFArray).lookup(0, PDFDict);
  assert.equal(intent.lookup(PDFName.of('OutputConditionIdentifier'), PDFString).decodeText(), 'Original ICC');
  assert.ok(result.context.lookup(intent.get(PDFName.of('DestOutputProfile'))));
});
test('reject optional layers and annotation-bearing pages before splitting', async () => {
  const source = await PDFDocument.create(); const page = source.addPage();
  source.catalog.set(PDFName.of('OCProperties'), source.context.obj({}));
  await assert.rejects(copyBrochurePdfPage(source, 0), /valgfrie lag/);
  source.catalog.delete(PDFName.of('OCProperties')); page.node.set(PDFName.of('Annots'), source.context.obj([{}]));
  await assert.rejects(copyBrochurePdfPage(source, 0), /annotationer/);
});
test('many imported page profiles share one byte-identical stream without changing colours or artwork',async()=>{
  const source=await PDFDocument.create(),page=source.addPage([100,200]);page.drawText('Original vectors');
  const bytes=new Uint8Array([1,7,13,27,128,255]);
  const profile=source.context.register(source.context.stream(bytes,{N:4}));
  page.node.set(PDFName.of('Resources'),source.context.obj({ColorSpace:{DefaultCMYK:[PDFName.of('ICCBased'),profile]}}));
  const target=await PDFDocument.create(),cache=new WeakMap<PDFRawStream,string>();
  let removed=0;
  for(let index=0;index<152;index++){
    const [copied]=await target.copyPages(source,[0]);target.addPage(copied);
    removed+=await deduplicateBrochureIccProfiles(target,cache);
  }
  assert.equal(removed,151);
  const reopened=await PDFDocument.load(await target.save());assert.equal(reopened.getPageCount(),152);
  const refs=new Set(reopened.getPages().map(page=>{
    const spaces=page.node.lookup(PDFName.of('Resources'),PDFDict).lookup(PDFName.of('ColorSpace'),PDFDict);
    const ref=spaces.lookup(PDFName.of('DefaultCMYK'),PDFArray).get(1);
    const stream=reopened.context.lookup(ref);assert.ok(stream instanceof PDFRawStream);
    assert.deepEqual(stream.getContents(),bytes);
    return ref.toString();
  }));
  assert.equal(refs.size,1);
});
test('different profile bytes or stream semantics and unrelated streams are never deduplicated',async()=>{
  const pdf=await PDFDocument.create(),page=pdf.addPage();
  const a=pdf.context.register(pdf.context.stream(new Uint8Array([1,2,3]),{N:4}));
  const b=pdf.context.register(pdf.context.stream(new Uint8Array([1,2,4]),{N:4}));
  const c=pdf.context.register(pdf.context.stream(new Uint8Array([1,2,3]),{N:3}));
  const other=pdf.context.register(pdf.context.stream(new Uint8Array([1,2,3]),{N:4}));
  page.node.set(PDFName.of('Resources'),pdf.context.obj({ColorSpace:{StockA:[PDFName.of('ICCBased'),a],StockB:[PDFName.of('ICCBased'),b],StockC:[PDFName.of('ICCBased'),c]}}));
  assert.equal(await deduplicateBrochureIccProfiles(pdf),0);
  assert.ok(pdf.context.lookup(other));
});
test('cached profile bytes never override a changed colour-channel declaration',async()=>{
  const pdf=await PDFDocument.create(),page=pdf.addPage(),cache=new WeakMap<PDFRawStream,string>();
  const a=pdf.context.register(pdf.context.stream(new Uint8Array([1,2,3]),{N:4}));
  const spaces=pdf.context.obj({StockA:[PDFName.of('ICCBased'),a]});
  page.node.set(PDFName.of('Resources'),pdf.context.obj({ColorSpace:spaces}));
  assert.equal(await deduplicateBrochureIccProfiles(pdf,cache),0);
  const stream=pdf.context.lookup(a);assert.ok(stream instanceof PDFRawStream);stream.dict.set(PDFName.of('N'),PDFNumber.of(3));
  const b=pdf.context.register(pdf.context.stream(new Uint8Array([1,2,3]),{N:4}));
  spaces.set(PDFName.of('StockB'),pdf.context.obj([PDFName.of('ICCBased'),b]));
  assert.equal(await deduplicateBrochureIccProfiles(pdf,cache),0);
  assert.ok(pdf.context.lookup(b));
});
