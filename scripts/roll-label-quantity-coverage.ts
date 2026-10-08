/** Plan exact read-only continuation quotes from currently accepted source
 * contexts. This command never writes products or prices to a database. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { buildRollLabelPricePreview } from './roll-label-price-preview';
import { readRollLabelLocalPriceLedgers, buildRollLabelLocalPricePreview } from './roll-label-local-price-ledgers';
import { rollLabelPriceSelectionKey } from '../src/lib/products/rollLabelPricePreview';
import { validateRollLabelConfiguration } from '../src/lib/products/rollLabelConfiguration';

export const requestedRollLabelQuantities = [50,100,200,250,500,750,1000,1500,2000,2500,3000,4000,5000,7500,10000,15000,20000,25000,50000,100000,200000,300000];
const base = 'output/supplier-imports/roll-labels-catalogue-2026-10-06/review';
const rulesPath = 'output/qa/roll-labels-2026-10-07/observer003-quantity-ladder-review-075/catalogue-quantity-rules.json';
const ledgers = await readRollLabelLocalPriceLedgers(process.cwd());
const rules = JSON.parse(fs.readFileSync(rulesPath,'utf8'));
const index = JSON.parse(fs.readFileSync(base + '/native-catalogue.json','utf8'));
const jobs = [], families = [];
for (const entry of index.families) {
  const family = JSON.parse(fs.readFileSync(base+'/families/'+entry.familyId+'.json','utf8'));
  if (!rules.families.some((item:{familyId:string;profiles:number}) => item.familyId === family.familyId && item.profiles === family.profiles.length)) throw Error('Quantity audit no longer matches catalogue');
  const packet = buildRollLabelLocalPricePreview(family, ledgers, 'wmd_roll_labels_threshold_fx_7_6');
  const captured = new Set(packet.points.map(point => rollLabelPriceSelectionKey(point.selection)));
  const rawRows = new Map();
  for (const row of ledgers.baseRows.filter(row => row.extraData.familyId === family.familyId)) {
    const point = buildRollLabelPricePreview(family,[row],packet.ruleKey).points[0];
    if (point) rawRows.set(point.id,row);
  }
  const contexts = new Map(packet.points.filter(point => rawRows.has(point.id)).map(point => [
    rollLabelPriceSelectionKey({...point.selection,quantity:1,motifAllocations:point.selection.motifCount===1?[1]:point.selection.motifAllocations}), point,
  ]));
  let alreadyCaptured = 0, outsideNativeRule = 0, allocationNeeded = 0, noSourceScale = 0, planned = 0;
  for (const point of contexts.values()) {
    const profile = family.profiles.find((item:{key:string}) => item.key === point.selection.profileKey);
    const range = profile.quantityInputs.find((input:{name:string}) => input.name === 'menge');
    const targets = profile.customerArtworkRequired ? requestedRollLabelQuantities : profile.sourceQuantities;
    for (const quantity of targets) {
      const checked = validateRollLabelConfiguration(profile, {dimensions:{width:String(point.selection.widthMm??''),height:String(point.selection.heightMm??'')},
        quantity:String(quantity),allocations:profile.format.motifCount===1?[String(quantity)]:point.selection.motifAllocations.map(String),
        optionStateId:point.selection.optionStateId}, {productId:family.productId,familyId:family.familyId});
      if (!checked.quantityValid) {outsideNativeRule++;continue;}
      if (!checked.allocationValid) {allocationNeeded++;continue;}
      if (!checked.selection) continue;
      if (captured.has(rollLabelPriceSelectionKey(checked.selection))) {alreadyCaptured++;continue;}
      const source = rawRows.get(point.id);
      const sourceUrl = (source as typeof source & {sourceUrl:string}).sourceUrl;
      if (typeof sourceUrl !== 'string' || new URL(sourceUrl).origin !== 'https://www.wir-machen-druck.de') throw Error('Missing exact public source URL');
      const request = {...source.rawPayload.sourceRequest,quantity:String(quantity)};
      if (range) delete request.priceScaleId;
      else {
        const scale = profile.sourceQuantityBindings?.find((item:{quantity:number}) => item.quantity === quantity)?.sourcePriceScaleId;
        if (!scale) {noSourceScale++;continue;}
        request.priceScaleId = scale;
      }
      jobs.push({familyId:family.familyId,profileKey:profile.key,sourceUrl,selection:checked.selection,
        mode:range?'range':'fixed',quantityRule:range||null,request,
        selections:{...source.selections,motif_allocation:JSON.stringify(request.enhancedSize||{})}});
      planned++;
    }
  }
  families.push({familyId:family.familyId,profiles:family.profiles.length,observedContexts:contexts.size,planned,
    alreadyCaptured,outsideNativeRule,allocationNeeded,noSourceScale,priceContextsAvailable:packet.points.length>0});
}
const summary = {families:42,profiles:2551,requestedQuantities:requestedRollLabelQuantities,plannedExactQuotes:jobs.length,
  contexts:families.reduce((sum,item)=>sum+item.observedContexts,0),motifAllocationDecisions:families.reduce((sum,item)=>sum+item.allocationNeeded,0),
  quantityUnitsPreserved:true,interpolation:false,sourceRuleAudit:rulesPath,remoteWrites:false,fullCatalogueComplete:false,familyCoverage:families};
export const rollLabelQuantityCoverageSummary = summary;
if (process.argv.includes('--write')) {
  const output='output/qa/roll-labels-2026-10-07/quantity-integration-025';fs.mkdirSync(output,{recursive:true});
  for (const [file,bytes] of [['coverage-plan.json',JSON.stringify(summary,null,2)+'\n'],
    ['quote-jobs.jsonl',jobs.map(job=>JSON.stringify(job)).join('\n')+'\n']]) {
    const target=output+'/'+file;
    if (fs.existsSync(target)) assert.equal(fs.readFileSync(target,'utf8'),bytes,'Preserve the existing continuation plan');
    else fs.writeFileSync(target,bytes);
  }
}
console.log(JSON.stringify({...summary,familyCoverage:families.filter(item=>item.familyId==='20649')}));
