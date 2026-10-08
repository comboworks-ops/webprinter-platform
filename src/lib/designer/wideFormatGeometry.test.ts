import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFDict, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { wideFormatShapes, proportionalSize, wideFormatTemplateLaunch, readWideFormatTemplate, resolveWideFormatShape, readWideFormatShapeBindings, readSavedWideFormatRules } from './wideFormatGeometry.ts';
import { generateWideFormatTemplate } from './generateWideFormatTemplate.ts';
import handler from '../../../api/wide-format-template.ts';

test('every preset preserves source proportions on either input axis; free sizes remain independent', () => {
  for (const shape of wideFormatShapes) {
    for (const [width, height] of [[10, 1000], [370, 610], [123.456, 98.765]]) {
      const w = proportionalSize(shape, width, height, 'width');
      const h = proportionalSize(shape, width, height, 'height');
      if (shape.ratio) { assert.ok(Math.abs(w.width / w.height - shape.ratio) < 1e-6); assert.ok(Math.abs(h.width / h.height - shape.ratio) < 1e-6); }
      else { assert.deepEqual(w, { width, height }); assert.deepEqual(h, { width, height }); }
    }
  }
  const circle = wideFormatShapes.find(s => s.id === 'round')!;
  assert.deepEqual(proportionalSize(circle, 20, 1000), { width: 20, height: 20 });
  assert.equal(wideFormatTemplateLaunch(circle, 20, 1000), null);
});
test('free form has no template; unsupported or invalid input cannot fall back to a rectangle', () => {
  assert.equal(wideFormatTemplateLaunch(wideFormatShapes.find(s => s.id === 'free-form')!, 370, 610), null);
  assert.equal(resolveWideFormatShape([{ id: 'unrecognised', name: 'Unknown die' }]), null);
  for (const url of ['/api/wide-format-template?v=1&shape=missing&widthMm=10&heightMm=10', '/api/wide-format-template?v=2&shape=rectangle&widthMm=10&heightMm=10', '/api/wide-format-template?v=1&shape=rectangle&widthMm=NaN&heightMm=10', '/api/wide-format-template?v=1&shape=rectangle&widthMm=5075&heightMm=10']) assert.equal(readWideFormatTemplate(url), null);
});
test('arbitrary sizes and all 32 preset shapes produce deterministic vector guides with 3 mm boxes and physical distance bands', async () => {
  for (const shape of wideFormatShapes.filter(s => s.kind !== 'freeform')) {
    const size = proportionalSize(shape, 370.123, 610.456);
    const launch = wideFormatTemplateLaunch(shape, size.width, size.height)!;
    assert.ok(launch);
    const bytes = await generateWideFormatTemplate(launch.pdfUrl);
    assert.deepEqual(bytes, await generateWideFormatTemplate(launch.pdfUrl));
    const pdf = await PDFDocument.load(bytes), page = pdf.getPage(0), pt = 72 / 25.4;
    assert.ok(Math.abs(page.getWidth() / pt - size.width - 6) < 1e-8);
    assert.ok(Math.abs(page.getHeight() / pt - size.height - 6) < 1e-8);
    assert.ok(Math.abs(page.getTrimBox().x / pt - 3) < 1e-8);
    assert.ok(Math.abs(page.getTrimBox().width / pt - size.width) < 1e-8);
    assert.ok(pdf.catalog.has(PDFName.of('OCProperties')));
    const contents = page.node.Contents()!;
    const streams = 'size' in contents ? Array.from({ length: contents.size() }, (_, i) => contents.lookup(i, PDFRawStream)) : [contents as PDFRawStream];
    const text = streams.map(stream => new TextDecoder().decode(decodePDFRawStream(stream).decode())).join('\n');
    assert.ok(text.includes('/OC /Guide BDC') && text.includes('EMC'));
    // 6mm stroke is specified in normalised coordinates, then scaled by width.
    assert.ok(text.includes(`${6 / size.width} w`));
    assert.equal(page.node.Resources()?.lookupMaybe(PDFName.of('XObject'), PDFDict)?.entries().length || 0, 0);
  }
});
test('stateless template endpoint rejects invalid input and mutations', async () => {
  assert.equal((await handler(new Request('https://example.test/api/wide-format-template?v=1&shape=free-form&widthMm=20&heightMm=30'))).status, 400);
  assert.equal((await handler(new Request('https://example.test/api/wide-format-template', { method: 'POST' }))).status, 405);
  const response = await handler(new Request('https://example.test/api/wide-format-template?v=1&shape=rectangle&widthMm=370&heightMm=610'));
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/pdf');
});

test('remapped tenant shape IDs require explicit supplier provenance; saved cutting rules survive without session state', () => {
  const bindings = [{ key: 'round', shapeId: 'copied-shape-id' }];
  assert.deepEqual(readWideFormatShapeBindings({ supplier_import_review: { runId: 'wmd-gulvfolie-2026-09-30', sourceBindings: bindings } }), bindings);
  assert.equal(readWideFormatShapeBindings({ supplier_import_review: { runId: 'other', sourceBindings: bindings } }).length, 0);
  assert.equal(resolveWideFormatShape([{ id: 'copied-shape-id', name: 'Renamed form' }], bindings)?.id, 'round');
  assert.equal(resolveWideFormatShape([{ id: 'other-id', name: 'Rund' }]), null);
  const rules = { version: 1 as const, requiresCutContour: true, templateUrl: null };
  assert.deepEqual(readSavedWideFormatRules({ wideFormatRules: rules }), rules);
  assert.equal(readSavedWideFormatRules({ wideFormatRules: { ...rules, templateUrl: '/untrusted.pdf' } }), null);
});
