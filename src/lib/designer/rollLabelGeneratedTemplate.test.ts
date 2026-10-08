import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { prepareRollLabelGeneratedTemplate, verifyRollLabelGeneratedTemplate, readRollLabelGeneratedDescriptor,
  currentRollLabelSelection } from './rollLabelGeneratedTemplate';
import { readSavedRollLabelContext, readVerifiedRollLabelContext, buildVerifiedRollLabelContext } from './rollLabelSavedContext';
import { validateRollLabelConfiguration } from '../products/rollLabelConfiguration';
import type { RollLabelReviewFamily } from '../products/rollLabelReview';

const family = JSON.parse(fs.readFileSync('output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families/20649.json', 'utf8')) as RollLabelReviewFamily;
const profile = family.profiles.find(p => p.key === '54008:1003759')!;
const contract = { version: 1 as const, productId: family.productId, familyId: family.familyId, sections: family.sections, profiles: family.profiles, orderReady: false as const };
const document = { productId: family.productId, tenantId: '00000000-0000-0000-0000-000000000000', widthMm: 37.125, heightMm: 61.25, bleedMm: 3, safeMm: 3 };
const selection = validateRollLabelConfiguration(profile, { dimensions: { width: '37.125', height: '61.25' }, quantity: '1000', allocations: [],
  optionStateId: profile.optionStates!.initialStateId! }, { productId: family.productId, familyId: family.familyId }).selection!;
async function fixture() {
  const generated = (await prepareRollLabelGeneratedTemplate(selection, document.productId, contract))!;
  const context = (await buildVerifiedRollLabelContext(selection, { url: generated.descriptor, sha256: generated.sha256, name: 'Etiket',
    widthMm: document.widthMm, heightMm: document.heightMm, bleedMm: 3, safeMm: 3, pageCount: 1 }, document, contract))!;
  assert.ok(context);
  return { generated, context };
}

test('generated saved context independently regenerates actual bytes and survives JSON without checkout state', async () => {
  const { generated, context } = await fixture();
  assert.equal(generated.sha256, createHash('sha256').update(generated.bytes).digest('hex'));
  assert.notEqual(generated.sha256, profile.sizeGeometry!.sha256);
  assert.deepEqual((await prepareRollLabelGeneratedTemplate(selection, document.productId, contract))!.bytes, generated.bytes);
  assert.equal(readSavedRollLabelContext({ rollLabelContext: context }, document, contract), null);
  assert.deepEqual(await readVerifiedRollLabelContext(JSON.parse(JSON.stringify({ rollLabelContext: context })), document, contract), context);
  assert.deepEqual(context.selection, selection);
});

test('saved PDF hash, descriptor/profile fingerprint and source instructions are all required', async () => {
  const { generated, context } = await fixture();
  for (const sha256 of ['0'.repeat(64), profile.sizeGeometry!.sha256, generated.profileSha256]) {
    const bad = structuredClone(context); bad.template.sha256 = sha256;
    assert.equal(await readVerifiedRollLabelContext({ rollLabelContext: bad }, document, contract), null);
  }
  for (const change of [p => { p.sizeGeometry!.bleedMm = 2; }, p => { p.sizeGeometry!.evidence[0].sha256 = '1'.repeat(64); },
    p => { p.sizeGeometry!.cornerRadiusMm = 1; }, p => { p.sizeContract!.axes[0].minMm = 20; },
    p => { p.optionStates!.states[0].options.fake = 'changed'; }, p => { p.artworkInstructions!.sourceEvidenceSha256 = '2'.repeat(64); } ] as Array<(p: typeof profile) => void>) {
    const stale = structuredClone(contract); change(stale.profiles.find(p => p.key === profile.key)!);
    assert.equal(await readVerifiedRollLabelContext({ rollLabelContext: context }, document, stale), null);
  }
});

test('generated metadata rejects foreign identity, duplicate/unknown queries, stale options and dimension overrides', async () => {
  const { context, generated } = await fixture();
  for (const suffix of ['&widthMm=37.125', '&extra=1', '#fragment']) assert.equal(readRollLabelGeneratedDescriptor(generated.descriptor + suffix), null);
  assert.equal(readRollLabelGeneratedDescriptor(generated.descriptor.replace(':v1?', ':v2?')), null);
  for (const patch of [{ productId: 'other' }, { familyId: 'other' }, { materialId: 'other' }, { widthMm: 38 },
    { motifAllocations: [999] }, { sourceOptions: { fake: '1' } }]) {
    const bad = structuredClone(context); Object.assign(bad.selection, patch);
    assert.equal(await readVerifiedRollLabelContext({ rollLabelContext: bad }, document, contract), null);
  }
  assert.equal(await readVerifiedRollLabelContext({ rollLabelContext: context }, { ...document, tenantId: 'other' }, contract), null);
  const duplicate = structuredClone(contract); duplicate.profiles.push(structuredClone(profile));
  assert.equal(currentRollLabelSelection(selection, document.productId, duplicate), null);
  assert.equal(await verifyRollLabelGeneratedTemplate(generated.descriptor.replace('37.125', '38'), generated.sha256, selection, document.productId, contract), null);
});

test('special masks and multiple motifs cannot gain online or saved single-page Designer support', async () => {
  const { context } = await fixture();
  const masked = structuredClone(contract); const p = masked.profiles.find(p => p.key === profile.key)!;
  p.artworkInstructions!.documentationStatus = 'mask_rules_documented';
  p.artworkInstructions!.requirements = [{ kind: 'white', condition: { type: 'material' }, documented: true, instructionsDa: ['Bevar særfarven.'] }];
  const generated = (await prepareRollLabelGeneratedTemplate(selection, document.productId, masked))!;
  assert.equal(generated.designerAllowed, false);
  const bad = structuredClone(context); bad.template.url = generated.descriptor; bad.template.sha256 = generated.sha256;
  assert.equal(await readVerifiedRollLabelContext({ rollLabelContext: bad }, document, masked), null);
  const multiple = structuredClone(contract); multiple.profiles.find(p => p.key === profile.key)!.format.motifCount = 2;
  const multiSelection = { ...selection, motifCount: 2, motifAllocations: [400, 600] };
  const multi = (await prepareRollLabelGeneratedTemplate(multiSelection, document.productId, multiple))!;
  assert.deepEqual(multi.selection.motifAllocations, [400, 600]); assert.equal(multi.designerAllowed, false);
});

test('missing or unverified material instructions block document preparation despite documented geometry', async () => {
  for (const change of [p => { p.artworkInstructions = null; }, p => { p.artworkInstructions!.documentationStatus = 'source_instructions_pending'; },
    p => { p.artworkInstructions!.sourceEvidenceSha256 = '3'.repeat(64); }] as Array<(p: typeof profile) => void>) {
    const unverified = structuredClone(contract); change(unverified.profiles.find(p => p.key === profile.key)!);
    assert.equal(await prepareRollLabelGeneratedTemplate(selection, document.productId, unverified), null);
  }
});
