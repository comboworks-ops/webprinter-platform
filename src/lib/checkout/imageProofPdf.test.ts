import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { createImageProofPdf } from './imageProofPdf.ts';
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=', 'base64'));
const placement = {targetWidthMm:216,targetHeightMm:303,physicalWidthMm:100,physicalHeightMm:150,scale:120,offsetX:10,offsetY:-5,bleedMm:3};
test('image approval produces full-size PDF with trim/bleed and exact preview placement', async () => {
  const bytes = await createImageProofPdf(png, placement);
  const doc = await PDFDocument.load(bytes);
  const page = doc.getPage(0), pt = 72/25.4;
  assert.equal(doc.getPageCount(), 1);
  assert.ok(Math.abs(page.getWidth() - 216*pt) < .0001);
  assert.ok(Math.abs(page.getTrimBox().width - 210*pt) < .0001);
  assert.ok(Math.abs(page.getTrimBox().height - 297*pt) < .0001);
  const streams = doc.context.enumerateIndirectObjects().filter(([,v]) => v instanceof PDFRawStream)
    .map(([,v]) => {try {return new TextDecoder().decode(decodePDFRawStream(v as PDFRawStream).decode());} catch {return '';}}).join('\n');
  assert.match(streams, /\/Image-\d+ Do/);
  // Positive CSS offsets go down; PDF Y goes up.
  const expectedX = 216*pt*.6 - 120*pt/2;
  const expectedY = 303*pt*.55 - 180*pt/2;
  const translation = [...streams.matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) cm/g)][0];
  assert.ok(translation);
  assert.ok(Math.abs(Number(translation[1]) - expectedX) < .0001);
  assert.ok(Math.abs(Number(translation[2]) - expectedY) < .0001);
});
test('invalid geometry and non-image bytes cannot create an approved artifact', async () => {
  await assert.rejects(createImageProofPdf(png, {...placement, scale: NaN}));
  await assert.rejects(createImageProofPdf(png, {...placement, targetWidthMm: 0}));
  await assert.rejects(createImageProofPdf(new Uint8Array([1,2]), placement));
});
