import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFName } from 'pdf-lib';
import type { fabric } from 'fabric';
import { validateProductionCutContour } from './validateProductionCutContour.ts';
import { cutContourGeometrySignature } from './cutContourValidation.ts';

const contour = { type: 'path', path: [['M', 0, 0], ['L', 20, 0], ['L', 10, 20], ['Z']], width: 20, height: 20, __isCutContour: true };
const canvas = (...objects: object[]) => ({ getObjects: () => objects }) as Pick<fabric.Canvas, 'getObjects'>;
async function pdfBackground(program: string) {
  const document = await PDFDocument.create(), page = document.addPage([100, 100]);
  page.node.Resources()!.set(PDFName.of('ColorSpace'), document.context.obj({ CC: ['Separation', 'CutContour', 'DeviceCMYK', { FunctionType: 2, C0: [0, 0, 0, 0], C1: [0, 1, 0, 0], Domain: [0, 1], N: 1 }] }));
  page.node.addContentStream(document.context.register(document.context.flateStream(program)));
  return { data: { kind: 'pdf_page_background', originalPdfBytes: (await document.save()).slice().buffer, pageIndex: 0 } };
}
const closedPdf = '/CC CS 1 SCN 0 0 m 50 0 l 20 50 l h S';

test('PDF background alone, an unused spot name and open PDF paths fail required cutting checks', async () => {
  for (const program of ['', '/CC CS 1 SCN', '/CC CS 1 SCN 0 0 m 50 0 l 20 50 l S']) {
    await assert.rejects(validateProductionCutContour(canvas(await pdfBackground(program))));
  }
});
test('one embedded path passes; a canvas path plus embedded path or two PDF paths fail', async () => {
  const background = await pdfBackground(closedPdf);
  await assert.doesNotReject(validateProductionCutContour(canvas(background)));
  await assert.doesNotReject(validateProductionCutContour(canvas(contour, await pdfBackground(''))));
  await assert.rejects(validateProductionCutContour(canvas(contour, background)));
  await assert.rejects(validateProductionCutContour(canvas(await pdfBackground(`${closedPdf} ${closedPdf}`))));
});
test('preset preflight requires its original geometry and selected template', async () => {
  const preset = { ...contour, data: { kind: 'preset_cut_contour', templateUrl: '/api/wide-format-template?shape=test', geometrySignature: cutContourGeometrySignature(contour) } };
  await assert.doesNotReject(validateProductionCutContour(canvas(preset), preset.data.templateUrl));
  await assert.rejects(validateProductionCutContour(canvas({ ...preset, scaleX: 2 }), preset.data.templateUrl));
  await assert.rejects(validateProductionCutContour(canvas(preset), '/api/wide-format-template?shape=other'));
  await assert.rejects(validateProductionCutContour(canvas(await pdfBackground(closedPdf)), preset.data.templateUrl));
});
test('a malformed or unsupported PDF cannot bypass contour checks even alongside a canvas contour', async () => {
  await assert.rejects(validateProductionCutContour(canvas(contour, { data: { kind: 'pdf_page_background', originalPdfBytes: new ArrayBuffer(4) } })));
  await assert.rejects(validateProductionCutContour(canvas(contour, await pdfBackground('BI /W 1 /H 1 ID x EI'))));
});
