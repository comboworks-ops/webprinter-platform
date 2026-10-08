/** Offline025 refinement of023 unresolved pairs. No source extraction, shape
 * replacement, application binding, supplier I/O or printing acceptance. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {refineSourceShapeBranchContacts, type ContactBranch} from '../../src/lib/designer/sourceShapeContactGeometry';
const base='output/qa/roll-labels-2026-10-06';
const target=base+'/contact-refinement-025';
const hash=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
const inputs:Record<string,string>={};
const read=(p:string,expected?:string)=>{
  const bytes=fs.readFileSync(p),actual=hash(bytes);
  if(expected&&actual!==expected)throw Error('Changed protected input '+p);
  inputs[p]=actual;return JSON.parse(bytes.toString());
};
const old=read(base+'/bounded-geometry-018/bounded-geometry.json','4308bf7c775f5649b854393603738c1c5fb0d06c5c950376bdbed6396a843b28');
const endpoint=read(base+'/endpoint-geometry-019/endpoint-geometry.json','9a0bde65d30381463fc8f599e80175fc38c46ab302cf11b7584dd9b4852877f6');
const previous=read(base+'/contact-geometry-023/contact-geometry.json','c2c91a2d16d4f335f04d598a43febfc6a1a10714a604264ea94960fe658fb525');
const catalogue='output/supplier-imports/roll-labels-catalogue-2026-10-06';
for(const [name,expected] of [
  ['import-review/proposed-exact-prices.jsonl','645dcab7924b3dbdb7a6db7429708a46756f7027751c63989f9819112efe5f0a'],
  ['dimension-documents/exact-size-bindings.jsonl','2692827bb169f0e25cb224a072c3a2228953e8b42196fd99a3c29fd1ef9310cb'],
  ['source-cut-contour-contracts.json','519e99ed8dc4a4aae1f6d0ff6f5526bdf4c09de325f0c976a01cea26aa6eb165'],
]){const p=catalogue+'/'+name,b=fs.readFileSync(p);if(hash(b)!==expected)throw Error('Changed protected ledger');inputs[p]=expected;}
for(const p of ['src/lib/designer/sourceShapeContactGeometry.ts','scripts/product-import/prepare-roll-label-contact-refinement.ts'])inputs[p]=hash(fs.readFileSync(p));
type Side={branches:ContactBranch[]};
type SourceCase={key:string;articleId:string;widthMm:number;heightMm:number;sourceShapeSha256:string;bleed:Side;safe:Side};
type PriorCase=Omit<SourceCase,'bleed'|'safe'>&{bleed:{pairs:{segments:[number,number];reason:string|null}[]};safe:{pairs:{segments:[number,number];reason:string|null}[]}};
const oldByKey=new Map<string,SourceCase>(old.cases.map((c:SourceCase)=>[c.key,c]));
const nextByKey=new Map<string,SourceCase>(endpoint.cases.map((c:SourceCase)=>[c.key,c]));
const counts={sizeCases:0,sideCases:0,candidatePairs:0,newlyDisjointPairs:0,stillUnresolvedPairs:0,budgetPairs:0,boxLeaves:0,tubeLeaves:0,treeComparisons:0,tubeTests:0,
  inheritedDisjointPairs:previous.counts.disjointPairs,inheritedUnconstructedPairs:previous.counts.unconstructedPairs,
  inheritedAllNativeBranchPairs:previous.counts.allNativeBranchPairs};
const cases=previous.cases.map((c:PriorCase)=>{
  const original=oldByKey.get(c.key),addition=nextByKey.get(c.key);
  if(!original||!addition||original.sourceShapeSha256!==c.sourceShapeSha256||addition.sourceShapeSha256!==c.sourceShapeSha256)throw Error('Foreign source case');
  for(const key of ['articleId','widthMm','heightMm'] as const)if(original[key]!==c[key]||addition[key]!==c[key])throw Error('Foreign source dimensions');
  counts.sizeCases++;
  const sides=(['bleed','safe'] as const).map(side=>{
    const branches=original[side].branches.map(b=>{
      const replacement=addition[side].branches.find(n=>n.segment===b.segment);
      if(replacement&&b.status!=='refused')throw Error('Invalid endpoint replacement');return replacement??b;
    });
    const candidates=c[side].pairs.filter(p=>p.reason==='envelopes_overlap_contact_unresolved').map(p=>p.segments);
    const refined=refineSourceShapeBranchContacts(branches,candidates);
    counts.sideCases++;counts.candidatePairs+=candidates.length;
    for(const p of refined.pairs){
      counts.treeComparisons+=p.work;counts.tubeTests+=p.tubeTests;
      if(p.status==='disjoint_inherited_curve_tubes')counts.newlyDisjointPairs++;
      else if(p.reason==='contact_work_budget')counts.budgetPairs++;
      else counts.stillUnresolvedPairs++;
      for(const leaf of p.separationLeaves)counts[leaf[0]==='box'?'boxLeaves':'tubeLeaves']++;
    }
    return [side,refined] as const;
  });
  return {key:c.key,articleId:c.articleId,widthMm:c.widthMm,heightMm:c.heightMm,sourceShapeSha256:c.sourceShapeSha256,...Object.fromEntries(sides)};
});
if(counts.sizeCases!==135||counts.candidatePairs!==4517||counts.inheritedDisjointPairs!==132555||counts.inheritedUnconstructedPairs!==62798)throw Error('Changed023 inventory');
const packet={version:1,status:'offline_conditional_chord_tube_refinement',counts,cases,inputHashes:inputs,
  sourceProfileBindingsSha256:hash(JSON.stringify(previous.inheritedProfileBindings)),
  actualContactsIsolated:false,joinsExamined:false,focalFragmentsExamined:false,retainedBoundaryAccepted:false,
  globalOffsetTopologyProved:false,scalingAuthorityProved:false,supplierJoinPolicyAccepted:false,sourceGeometryAccepted:false,
  designerAllowed:false,orderReady:false,fullCatalogueComplete:false,remoteWrites:false};
const bytes=JSON.stringify(packet)+'\n';
if(Buffer.byteLength(bytes)>20*1024*1024)throw Error('Refinement output exceeds bounded20MiB budget');
for(const [p,h] of Object.entries(inputs))if(hash(fs.readFileSync(p))!==h)throw Error('Input changed during refinement '+p);
const write=process.argv.includes('--write');
if(write){
  if(fs.existsSync(target))throw Error('Preserve existing025 refinement');
  fs.mkdirSync(target,{recursive:true});fs.writeFileSync(target+'/contact-refinement.json',bytes,{flag:'wx'});
}
console.log(JSON.stringify({write,target,counts,bytes:Buffer.byteLength(bytes),sha256:hash(bytes)}));
