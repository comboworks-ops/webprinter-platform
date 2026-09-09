import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PDFDocument, PDFArray, PDFDict, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
function raw(pdf: PDFDocument, ref: any): PDFRawStream { const stream = pdf.context.lookup(ref); assert.ok(stream instanceof PDFRawStream); return stream; }

import { addProductionOutputIntent, embedProductionRaster, multiplyAffine, pdfPageToObjectMatrix, importedVisibleBox, preserveImportedOutputIntent, productionRasterScale, setProductionPageBoxes } from './productionPdfObjects.ts';

test('production output has real ICC bytes, correct finishing boxes and no PDF/X conformance assertion', async () => {
  const bytes = await readFile(new URL('../../../../public/icc/ISOcoated_v2_300_eci.icc', import.meta.url));
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([216 * 72 / 25.4, 303 * 72 / 25.4]);
  setProductionPageBoxes(page, 210, 297, 3);
  addProductionOutputIntent(pdf, { name: 'FOGRA39 test', bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
  const parsed = await PDFDocument.load(await pdf.save());
  const intent = parsed.catalog.lookup(PDFName.of('OutputIntents'), PDFArray).lookup(0, PDFDict);
  const icc = raw(parsed, intent.get(PDFName.of('DestOutputProfile')));
  assert.deepEqual(new Uint8Array(decodePDFRawStream(icc).decode()), new Uint8Array(bytes));
  assert.equal(icc.dict.get(PDFName.of('N'))?.toString(), '4');
  assert.equal(parsed.catalog.has(PDFName.of('GTS_PDFXVersion')), false);
  assert.ok(Math.abs(parsed.getPage(0).getTrimBox().width * 25.4 / 72 - 210) < 0.000001);
});

test('CMYK raster samples and independent alpha survive PDF serialization', async () => {
  const pdf = await PDFDocument.create(); pdf.addPage();
  const samples = new Uint8Array([0, 0, 0, 255, 20, 40, 60, 80]);
  const alpha = new Uint8Array([255, 96]);
  const ref = embedProductionRaster(pdf, 2, 1, samples, alpha, undefined, 4);
  const image = raw(pdf, ref);
  assert.equal(image.dict.get(PDFName.of('ColorSpace'))?.toString(), '/DeviceCMYK');
  assert.deepEqual(new Uint8Array(decodePDFRawStream(image).decode()), samples);
  const mask = raw(pdf, image.dict.get(PDFName.of('SMask')));
  assert.deepEqual(new Uint8Array(decodePDFRawStream(mask).decode()), alpha);
  assert.throws(() => embedProductionRaster(pdf, 1, 1, samples, alpha, undefined, 4), /sample count/);
});

test('source output profile remains local to imported PDF resource colors', async () => {
  const source = await PDFDocument.create(); const page = source.addPage();
  const original = new Uint8Array(132); original.set([67, 77, 89, 75], 16);
  addProductionOutputIntent(source, { name: 'Original stock', bytes: original.buffer });
  assert.ok(preserveImportedOutputIntent(source, page)?.includes('Original stock'));
  const spaces = page.node.normalizedEntries().Resources.lookup(PDFName.of('ColorSpace'), PDFDict);
  const defaultCmyk = spaces.lookup(PDFName.of('DefaultCMYK'), PDFArray);
  assert.equal(defaultCmyk.get(0).toString(), '/ICCBased');
  assert.deepEqual(new Uint8Array(decodePDFRawStream(raw(source, defaultCmyk.get(1))).decode()), original);
});

test('raster fallback obeys physical PPI and bounded memory', () => {
  assert.equal(productionRasterScale(100, 100, 2, 297).effectivePpi, 300);
  const wide = productionRasterScale(14000, 14000, 2, 4000);
  assert.ok(14000 * wide.multiplier <= 8192);
  assert.ok((14000 * wide.multiplier) ** 2 <= 32_000_001);
  assert.ok(wide.effectivePpi < wide.targetPpi);
  assert.throws(() => productionRasterScale(0, 4, 2, 100));
});

test('imported page transforms retain rotation, shear, scale and translation', () => {
  assert.deepEqual(multiplyAffine([2, 0, 0, -2, -200, 1000], [0, 1, -1, 0, 300, 400]).map(n => n || 0), [0, -2, -2, 0, 400, 200]);
});

test('rotated imported PDF corners match PDF.js thumbnail orientation', () => {
  const point = (m: number[], x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]].map(n => n || 0);
  const cases = [
    [0, [-60, 30], [60, -30]], [90, [-60, -30], [60, 30]],
    [180, [60, -30], [-60, 30]], [270, [60, 30], [-60, -30]],
  ] as const;
  for (const [rotation, bottomLeft, topRight] of cases) {
    const matrix = pdfPageToObjectMatrix(200, 100, 120, 60, rotation);
    assert.deepEqual(point(matrix, 0, 0), bottomLeft);
    assert.deepEqual(point(matrix, 200, 100), topRight);
  }
  assert.throws(() => pdfPageToObjectMatrix(200, 100, 120, 60, 45));
});

test('source CropBox is intersected with MediaBox before page embedding', async () => {
  const pdf = await PDFDocument.create(); const page = pdf.addPage([200, 100]);
  page.setCropBox(20, 15, 150, 60);
  assert.deepEqual(importedVisibleBox(page), { left: 20, bottom: 15, right: 170, top: 75 });
  page.setCropBox(-10, -10, 240, 130);
  assert.deepEqual(importedVisibleBox(page), { left: 0, bottom: 0, right: 200, top: 100 });
});
