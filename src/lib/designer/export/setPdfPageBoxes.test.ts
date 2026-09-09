import assert from 'node:assert/strict';
import test from 'node:test';
import { jsPDF } from 'jspdf';
import { PDFDocument, PDFName } from 'pdf-lib';
import { setPdfPageBoxes } from './setPdfPageBoxes.ts';

for (const [width, height, bleed] of [[1000, 1000, 3], [1200, 600, 3], [600, 1200, 3], [1000, 1000, 0]]) {
  test(`serialized page boxes match ${width} x ${height} mm with ${bleed} mm bleed`, async () => {
    const pdf = new jsPDF({ unit: 'mm', format: [width + 2 * bleed, height + 2 * bleed], orientation: width > height ? 'landscape' : 'portrait' });
    setPdfPageBoxes(pdf, width, height, bleed);
    const parsed = await PDFDocument.load(pdf.output('arraybuffer'));
    const page = parsed.getPage(0);
    assert.ok(page.node.has(PDFName.of('TrimBox')));
    assert.ok(page.node.has(PDFName.of('BleedBox')));
    const mm = (value: number) => Math.round(value * 25.4 / 72 * 1000) / 1000;
    const trim = page.getTrimBox();
    assert.deepEqual([trim.x, trim.y, trim.width, trim.height].map(mm), [bleed, bleed, width, height]);
    assert.deepEqual(page.getBleedBox(), page.getMediaBox());
  });
}

test('each page of a checkout template receives its own page boxes', async () => {
  const pdf = new jsPDF({ unit: 'mm', format: [216, 303] });
  setPdfPageBoxes(pdf, 210, 297, 3);
  pdf.addPage([303, 216], 'landscape');
  setPdfPageBoxes(pdf, 297, 210, 3);
  const parsed = await PDFDocument.load(pdf.output('arraybuffer'));
  for (const page of parsed.getPages()) assert.ok(page.node.has(PDFName.of('TrimBox')));
});
