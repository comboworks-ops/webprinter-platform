import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PDFDocument, setFillingCmykColor, rectangle, fill } from 'pdf-lib';
import pdfjs from 'pdfjs-dist/legacy/build/pdf.js';
import { PDF_COLOUR_REVIEW_NOTICE } from './pdfColourReview.ts';
import { getCheckoutProofAvailability } from './proofAvailability.ts';

test('CMYK source really produces RGB display operators: they cannot validate source colour', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([100, 100]).pushOperators(setFillingCmykColor(1, 0, 0, 0), rectangle(0, 0, 100, 100), fill());
  const pdf = await pdfjs.getDocument({ data: await doc.save(), isEvalSupported: false }).promise;
  try {
    const ops = await (await pdf.getPage(1)).getOperatorList();
    assert.ok(ops.fnArray.includes(pdfjs.OPS.setFillRGBColor));
  } finally { await pdf.destroy(); }
});

test('checkout no longer classifies source colours from normalized rendering operators', () => {
  const source = readFileSync(new URL('../../pages/FileUploadConfiguration.tsx', import.meta.url), 'utf8');
  const preflight = source.slice(source.indexOf('const runPreflight ='), source.indexOf('const runPlatformPreflight ='));
  assert.doesNotMatch(preflight, /getOperatorList|setFillRGBColor|Filen indeholder RGB-farver/);
  assert.match(preflight, /issues\.push\(PDF_COLOUR_REVIEW_NOTICE\)/);
});

test('unknown PDF colours keep manual review available without a print-ready claim', () => {
  assert.match(PDF_COLOUR_REVIEW_NOTICE, /ikke automatisk verificeret/);
  assert.deepEqual(getCheckoutProofAvailability({hasFile: true, hasPreview: true, processing: false,
    approved: false, hasLocalCheck: true, designerExport: false, hasIssues: true, needsExport: false}),
    {canReview: true, requiresModalReview: true, quickApproveAvailable: false});
});
