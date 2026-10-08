import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { generateRollLabelSizeTemplate } from './generateRollLabelSizeTemplate';
import { prepareRollLabelGeneratedTemplate, rollLabelPdfHash } from './rollLabelGeneratedTemplate';
import { buildVerifiedRollLabelContext, readVerifiedRollLabelContext } from './rollLabelSavedContext';
import { validateRollLabelConfiguration } from '../products/rollLabelConfiguration';
import type { RollLabelReviewFamily } from '../products/rollLabelReview';

const family = JSON.parse(fs.readFileSync('output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families/30968.json', 'utf8')) as RollLabelReviewFamily;
const rectangle = family.profiles.find(p => p.key === '61428:1210891')!;
const circle = family.profiles.find(p => p.key === '61430:1210895')!;
const contract = { version: 1 as const, productId: family.productId, familyId: family.familyId,
  sections: family.sections, profiles: family.profiles, orderReady: false as const };

test('rectangle, circle and compact guides serialize text layer names and retain nonprinting usage', async () => {
  const minWidth = rectangle.sizeContract!.axes.find(a => a.axis === 'width')!.minMm;
  const minHeight = rectangle.sizeContract!.axes.find(a => a.axis === 'height')!.minMm;
  for (const [profile, width, height] of [[rectangle, 50, 50], [circle, 50, 50], [rectangle, minWidth, minHeight]] as const) {
    const result = await generateRollLabelSizeTemplate(profile, width, height);
    if (width === minWidth && height === minHeight) assert.equal(result.legend.layout, 'bleed_bands');
    const pdf = await PDFDocument.load(result.bytes);
    const oc = pdf.catalog.lookup(PDFName.of('OCProperties'), PDFDict);
    const layers = oc.lookup(PDFName.of('OCGs'), PDFArray);
    assert.equal(layers.size(), 2);
    for (const [i, label] of ['Stans, udfald og sikkerhed - ikke til tryk', 'Dansk tegnforklaring - ikke til tryk'].entries()) {
      const layer = layers.lookup(i, PDFDict);
      assert.equal(layer.lookup(PDFName.of('Name'), PDFString).decodeText(), label);
      const usage = layer.lookup(PDFName.of('Usage'), PDFDict);
      for (const [event, expected] of [['View', 'ON'], ['Print', 'OFF'], ['Export', 'OFF']]) {
        assert.equal(usage.lookup(PDFName.of(event), PDFDict).lookup(PDFName.of(event + 'State'), PDFName).decodeText(), expected);
      }
    }
    const trim = pdf.getPage(0).getTrimBox();
    assert.ok(Math.abs(trim.width - width * 72 / 25.4) < 1e-9);
    assert.ok(Math.abs(trim.height - height * 72 / 25.4) < 1e-9);
    assert.equal(result.DesignerAcceptance, false);
  }
});

test('pre-repair PDF hashes refuse without silently rewriting saved template bindings', async () => {
  const selection = validateRollLabelConfiguration(rectangle, { dimensions: { width: '50', height: '50' }, quantity: '1000',
    allocations: [], optionStateId: rectangle.optionStates!.initialStateId! }, { productId: family.productId, familyId: family.familyId }).selection!;
  const generated = (await prepareRollLabelGeneratedTemplate(selection, family.productId, contract))!;
  const oldBytes = fs.readFileSync('output/qa/roll-labels-2026-10-06/predecessor006-ocg-name-fix-differential-050/61428-1210891-original.pdf');
  const oldHash = await rollLabelPdfHash(oldBytes);
  assert.notEqual(generated.sha256, oldHash);
  const document = { productId: family.productId, tenantId: '00000000-0000-0000-0000-000000000000', widthMm: 50, heightMm: 50, bleedMm: 3, safeMm: 3 };
  const template = { url: generated.descriptor, sha256: generated.sha256, name: 'Etiket', widthMm: 50, heightMm: 50, bleedMm: 3, safeMm: 3, pageCount: 1 as const };
  const fresh = (await buildVerifiedRollLabelContext(selection, template, document, contract))!;
  assert.ok(fresh);
  assert.equal(await buildVerifiedRollLabelContext(selection, { ...template, sha256: oldHash }, document, contract), null);
  const stale = structuredClone(fresh); stale.template.sha256 = oldHash;
  const before = JSON.stringify(stale);
  assert.equal(await readVerifiedRollLabelContext({ rollLabelContext: stale }, document, contract), null);
  assert.equal(JSON.stringify(stale), before);
  assert.deepEqual(await readVerifiedRollLabelContext({ rollLabelContext: fresh }, document, contract), fresh);
});
