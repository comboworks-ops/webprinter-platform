/** Local review artifacts only. This is not an importer or publishing command. */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { buildRollLabelPricePreview } from './roll-label-price-preview';
import { buildRollLabelSystemProduct } from './roll-label-system-product';

const base = 'output/supplier-imports/roll-labels-catalogue-2026-10-06';
const output = 'output/qa/roll-labels-2026-10-06/system-integration-025';
const bytes = fs.readFileSync(base + '/import-review/proposed-exact-prices.jsonl');
const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
if (sourceSha256 !== '645dcab7924b3dbdb7a6db7429708a46756f7027751c63989f9819112efe5f0a') throw Error('Source ledger changed');
const rows = bytes.toString().trim().split('\n').map(line => JSON.parse(line));
const index = JSON.parse(fs.readFileSync(base + '/review/native-catalogue.json', 'utf8'));
const drafts = index.families.map((entry: { familyId: string; slug: string }) => {
  const family = JSON.parse(fs.readFileSync(base + '/review/families/' + entry.familyId + '.json', 'utf8'));
  return buildRollLabelSystemProduct(family, buildRollLabelPricePreview(family, rows, 'wmd_roll_labels_threshold_fx_7_6'), entry.slug);
});
fs.mkdirSync(output, { recursive: true });
// These filenames belong to this review checkpoint, not the supplier evidence.
fs.writeFileSync(output + '/product-drafts.jsonl', drafts.map(draft => JSON.stringify({
  familyId: draft.familyId, product: draft.product, sourceGroups: draft.sourceGroups,
})).join('\n') + '\n');
fs.writeFileSync(output + '/generic-price-rows.jsonl', drafts.flatMap(draft => draft.genericPriceRows).map(row => JSON.stringify(row)).join('\n') + '\n');
const summary = { scope: 'system-integration-dry-run', targetTenant: null, remoteWrites: false,
  importApproved: false, publicationApproved: false, ordersEnabled: false,
  localFixtureTenant: '00000000-0000-0000-0000-000000000000', sourceSha256,
  conversionRule: 'wmd_roll_labels_threshold_fx_7_6', conversionApprovedForLive: false,
  families: drafts.length, pricedFamilies: drafts.filter(draft => draft.genericPriceRows.length).length,
  exactPriceRows: drafts.reduce((sum, draft) => sum + draft.genericPriceRows.length, 0),
  contextValues: drafts.reduce((sum, draft) => sum + draft.sourceGroups.at(-1)!.values.length, 0),
  designerTemplates: 'Generate exact selected dimensions from reviewed source-bound geometry; no blanket template fallback.',
  remainingGates: ['Target shop and exact pricing policy', 'Full source-specific document and visual coverage',
    'Tenant-bound append-only import review and approval', 'VAT, delivery and commercial acceptance before publication'],
};
fs.writeFileSync(output + '/plan.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ ...summary, output }));
