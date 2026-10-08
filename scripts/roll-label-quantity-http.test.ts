/** Verify the live loopback fixture matches the sealed native local publisher. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readRollLabelLocalPriceLedgers,buildRollLabelLocalPricePreview} from './roll-label-local-price-ledgers';
import {buildRollLabelSystemProduct} from './roll-label-system-product';
import {rollLabelPriceForSelection} from '../src/lib/products/rollLabelPricePreview';
import {validateRollLabelConfiguration} from '../src/lib/products/rollLabelConfiguration';
const origin='http://127.0.0.1:8176',base='output/supplier-imports/roll-labels-catalogue-2026-10-06/review';
const ledgers=await readRollLabelLocalPriceLedgers(process.cwd());
const index=JSON.parse(fs.readFileSync(base+'/native-catalogue.json','utf8'));
let requests=0,total=0;
let displayed;
for (const entry of index.families) {
  const family=JSON.parse(fs.readFileSync(base+'/families/'+entry.familyId+'.json','utf8'));
  const expected=buildRollLabelSystemProduct(family,buildRollLabelLocalPricePreview(family,ledgers,'wmd_roll_labels_threshold_fx_7_6'),entry.slug);
  const response=await fetch(origin+'/roll-label-review/system-product/'+entry.familyId+'.json');requests++;
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const actual=await response.json();assert.deepEqual(actual,expected);
  assert.ok(!JSON.stringify(actual).includes('supplierPrice'));
  assert.equal(actual.product.is_published,false);assert.equal(actual.product.pricing_structure.rollLabelPricing.orderReady,false);
  total+=actual.genericPriceRows.length;
  if (entry.familyId==='20649') displayed={family,actual};
}
assert.ok(displayed);
const packet=displayed.actual.product.pricing_structure.rollLabelPricing;
for (const point of packet.points.filter((point:{selection:{profileKey:string}})=>point.selection.profileKey==='54008:1003759')) {
  const response=await fetch(origin+'/roll-label-review/price/20649.json?selection='+encodeURIComponent(JSON.stringify(point.selection)));requests++;
  const actual=await response.json();assert.equal(response.status,200);
  // The price endpoint returns the captured proposal before generic binding.
  assert.equal(actual.point.id,point.id);assert.equal(actual.point.priceDkk,point.priceDkk);
  assert.deepEqual(actual.point.selection,point.selection);assert.equal(actual.orderReady,false);
}
const profile=displayed.family.profiles.find((item:{key:string})=>item.key==='54008:1003759');
const draft={dimensions:{width:'50',height:'50'},quantity:'138',allocations:[],optionStateId:profile.optionStates.initialStateId};
const identity={productId:displayed.family.productId,familyId:'20649'};
const uncaptured=validateRollLabelConfiguration(profile,draft,identity).selection;
assert.ok(uncaptured);assert.equal(rollLabelPriceForSelection(packet,uncaptured),null);
const missingResponse=await fetch(origin+'/roll-label-review/price/20649.json?selection='+encodeURIComponent(JSON.stringify(uncaptured)));requests++;
assert.equal((await missingResponse.json()).status,'not_captured');
for (const quantity of ['0','300001','1.5']) {
  assert.equal(validateRollLabelConfiguration(profile,{...draft,quantity},identity).selection,null);
  const invalid={...uncaptured,quantity:Number(quantity),motifAllocations:[Number(quantity)]};
  const response=await fetch(origin+'/roll-label-review/price/20649.json?selection='+encodeURIComponent(JSON.stringify(invalid)));requests++;
  assert.equal(response.status,400);
}
const unexpected=await fetch(origin+'/roll-label-review/system-product/20649.json?other=1');requests++;
assert.equal(unexpected.status,404);
const summary={passed:true,requests,families:index.families.length,acceptedGenericRows:total,
  displayedFamilyRows:packet.points.length,uncapturedCustomQuantityUnavailable:true,invalidQuantitiesRejected:true,
  remoteWrites:false,commercialApproved:false,fullCatalogueComplete:false};
fs.writeFileSync('output/qa/roll-labels-2026-10-07/quantity-integration-025/http-verification.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
