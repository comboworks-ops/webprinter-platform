import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {auditRollLabelPricingContract} from '../shared/roll-label-pricing-contract.js';
const base=new URL('../../../output/supplier-imports/roll-labels-catalogue-2026-10-06/',import.meta.url);
const rows=name=>fs.readFileSync(new URL(name,base),'utf8').trim().split('\n').map(JSON.parse);
const profiles=rows('normalized/article-material-profiles.jsonl'),prices=rows('import-review/proposed-exact-prices.jsonl');
test('matrix audit proves dimension/options collapse without altering prices or source rows',()=>{
 const before=JSON.stringify(prices),result=auditRollLabelPricingContract(profiles,prices);
 assert.ok(result.counts.collapsedRows>0);assert.ok(result.counts.collisionsWithDifferentSupplierTotals>0);
 assert.equal(result.counts.exactRows,7789);assert.equal(JSON.stringify(prices),before);
 assert.equal(result.retailReady,false);assert.equal(result.databaseWrites,false);assert.equal(result.pricingEngineChanged,false);
 assert.ok(result.collisions.some(c=>c.differingAxes.includes('width_mm')));
 assert.ok(result.collisions.some(c=>c.differingAxes.includes('options')));
 assert.ok(result.fullIdentityAxes.includes('motif_allocation'));
 assert.throws(()=>auditRollLabelPricingContract(profiles,[{...prices[0],sourceKey:'foreign'}]),/Foreign/);
});
