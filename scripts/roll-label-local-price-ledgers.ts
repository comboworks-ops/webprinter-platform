import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { buildRollLabelPricePreview, type SavedRollPrice } from './roll-label-price-preview';
import { rollLabelPriceSelectionKey } from '../src/lib/products/rollLabelPricePreview';
import type { RollLabelReviewFamily } from '../src/lib/products/rollLabelReview';

export const rollLabelBasePriceLedger = {
  path: 'output/supplier-imports/roll-labels-catalogue-2026-10-06/import-review/proposed-exact-prices.jsonl',
  sha256: '645dcab7924b3dbdb7a6db7429708a46756f7027751c63989f9819112efe5f0a',
};
// Explicitly reviewed local additions only; never discover arbitrary files.
type LocalPriceAdditionDescriptor = {path:string;sha256:string;familyId:string;profileKey:string|null;rows:number};
export const rollLabelLocalPriceAdditions: LocalPriceAdditionDescriptor[] = [{
  path: 'output/qa/roll-labels-2026-10-07/observer003-quantity-ladder-review-075/proposed-price-delta.jsonl',
  sha256: '7ab3e855f2d594423ff9e61993c17dd37ffe39df79b33ce8a94c00cba7f1280a',
  familyId: '20649', profileKey: '54008:1003759', rows: 20,
}, {
  path: 'output/qa/roll-labels-2026-10-07/quantity-integration-025/sealed-family-20649/proposed-price-delta.jsonl',
  sha256: '67747f07f45cbe530e7c16a628ff74d46e942290208389d0968f8f034d5259d0',
  familyId: '20649', profileKey: null, rows: 1881,
}];
export type RollLabelLocalPriceLedgers = {
  baseRows: SavedRollPrice[];
  additions: { familyId: string; profileKey: string|null; path?:string; rows: SavedRollPrice[] }[];
};
const descriptors = [rollLabelBasePriceLedger, ...rollLabelLocalPriceAdditions];
const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

export async function rollLabelLocalPriceVersion(root: string) {
  return JSON.stringify(await Promise.all(descriptors.map(async descriptor => {
    const stat = await fs.stat(path.join(root, descriptor.path));
    return [descriptor.sha256, stat.mtimeMs, stat.ctimeMs, stat.size];
  })));
}

export async function readRollLabelLocalPriceLedgers(root: string): Promise<RollLabelLocalPriceLedgers> {
  const sources = await Promise.all(descriptors.map(async descriptor => {
    const bytes = await fs.readFile(path.join(root, descriptor.path));
    if (digest(bytes) !== descriptor.sha256) throw Error('Local price evidence changed: ' + descriptor.path);
    return bytes.toString().trim().split('\n').map(line => JSON.parse(line) as SavedRollPrice);
  }));
  const signatures = new Set(sources[0].map(row => row.extraData.signature));
  const additions = rollLabelLocalPriceAdditions.map((descriptor, index) => {
    const rows = sources[index + 1];
    if (rows.length !== descriptor.rows) throw Error('Local addition count changed');
    for (const row of rows) {
      if (row.extraData.familyId !== descriptor.familyId || (descriptor.profileKey!==null && row.sourceKey !== descriptor.profileKey)
        || !row.extraData.signature || signatures.has(row.extraData.signature)) throw Error('Local addition is not append-only');
      signatures.add(row.extraData.signature);
    }
    return { familyId: descriptor.familyId, profileKey: descriptor.profileKey, path:descriptor.path, rows };
  });
  return { baseRows: sources[0], additions };
}

/** Reuse the native preview builder and refuse a delta that removes or changes
 * an old point. Source costs remain server-side and retail formulas unchanged. */
export function buildRollLabelLocalPricePreview(family: RollLabelReviewFamily, ledgers: RollLabelLocalPriceLedgers, ruleKey: string) {
  const original = buildRollLabelPricePreview(family, ledgers.baseRows, ruleKey);
  const additions = ledgers.additions.filter(item => item.familyId === family.familyId).flatMap(item => item.rows);
  if (!additions.length) return original;
  const fresh = buildRollLabelPricePreview(family, additions, ruleKey);
  const merged = buildRollLabelPricePreview(family, [...ledgers.baseRows, ...additions], ruleKey);
  const byIdentity = new Map(merged.points.map(point => [rollLabelPriceSelectionKey(point.selection), point]));
  if (fresh.excludedRows || fresh.points.length !== additions.length
    || merged.excludedRows !== original.excludedRows || merged.points.length !== original.points.length + additions.length
    || original.points.some(point => JSON.stringify(byIdentity.get(rollLabelPriceSelectionKey(point.selection))) !== JSON.stringify(point))) {
    throw Error('Local quantity addition failed exact preservation');
  }
  return merged;
}
