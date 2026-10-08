/**019 consumes protected018; no PDF extraction, metadata changes or remote I/O. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {boundSourceShapeEndpointNormals} from '../../src/lib/designer/sourceShapeEndpointGeometry.ts';
import {sourceShapeSvgPath} from '../../src/lib/designer/sourceShapeReviewGeometry.ts';
import {reviewCurrentRollLabelSpecialShapeProposal} from '../../src/lib/products/rollLabelSpecialShapeProposal.ts';
import {validateRollLabelConfiguration} from '../../src/lib/products/rollLabelConfiguration.ts';
const base='output/qa/roll-labels-2026-10-06',prior=base+'/bounded-geometry-018',target=base+'/endpoint-geometry-019';
if(fs.existsSync(target))throw Error('Preserve existing019 target');
const read=(p:string)=>fs.readFileSync(p),sha=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
const json=(p:string)=>JSON.parse(read(p).toString());
const inputs=new Map<string,string>();
function protect(p:string,expected?:string){const actual=sha(read(p));if(expected&&actual!==expected)throw Error('Changed protected input '+p);inputs.set(p,actual);}
const summary=json(prior+'/verification-summary-018.json');
for(const e of [...summary.files,...summary.outputs,...summary.protectedArtifacts])protect(e.path,e.sha256);
protect(prior+'/verification-summary-018.json');
for(const e of json(prior+'/input-integrity.json').inputs)protect(e.path,e.sha256);
const previous=json(prior+'/bounded-geometry.json');
const models=json(base+'/special-shapes-017/special-shape-proposals.json');
const catalogue='output/supplier-imports/roll-labels-catalogue-2026-10-06';
const family=json(catalogue+'/review/families/25143.json'),cuts=json(catalogue+'/source-cut-contour-contracts.json').contracts;
const contract={version:1,productId:family.productId,familyId:family.familyId,sections:family.sections,profiles:family.profiles,orderReady:false};
const currentBindings=[];
for(const p of previous.currentBindings) {
  const profile=family.profiles.find(c=>c.key===p.profileKey),model=models.models.find(m=>m.articleId===p.articleId),proposal=models.proposals.find(c=>c.profileKey===p.profileKey);
  const selection=validateRollLabelConfiguration(profile,{dimensions:{width:'50',height:'50'},quantity:'1000',allocations:['1000'],optionStateId:profile.optionStates.initialStateId},contract).selection;
  if(!selection)throw Error('Current selection refused');
  const checked=await reviewCurrentRollLabelSpecialShapeProposal(selection,family.productId,contract,proposal,model,cuts.find(c=>c.profileKey===p.profileKey));
  if(!checked||checked.sourceGeometryAccepted||checked.designerAllowed||checked.orderReady)throw Error('Current binding changed');
  currentBindings.push({...p,selectionCount:1,currentResolverChecks:1,inherited018SelectionCount:p.selectionCount});
}
const cases=previous.cases.map(c=>({key:c.key,articleId:c.articleId,widthMm:c.widthMm,heightMm:c.heightMm,sourceShapeSha256:c.sourceShapeSha256,
  bleed:boundSourceShapeEndpointNormals(c.path,3),safe:boundSourceShapeEndpointNormals(c.path,-3)}));
const supplements=cases.flatMap(c=>[c.bleed,c.safe]);
let replacedBranches=0,replacedJoins=0,boundedBranches=0,chordCount=0,arcs=0,continuous=0,refusedJoins=0,fullyBuilt=0;
const merge=(old,current)=>{
  const branches=old.branches.map(b=>{
    const next=current.branches.find(n=>n.segment===b.segment);if(!next)return b;
    if(b.status!=='refused'||b.reason!=='stationary_native_endpoint')throw Error('Unexpected018 stationary branch');replacedBranches++;return next;
  });
  const joins=old.joins.map(j=>{
    const next=current.joins.find(n=>n.afterSegment===j.afterSegment);if(!next)return j;
    if(j.kind!=='refused'||j.reason!=='stationary_join_tangent')throw Error('Unexpected018 stationary join');replacedJoins++;return next;
  });
  boundedBranches+=branches.filter(b=>b.status!=='refused').length;chordCount+=branches.reduce((n,b)=>n+b.chords.length,0);
  arcs+=joins.filter(j=>j.kind==='analytic_round_arc').length;continuous+=joins.filter(j=>j.kind==='continuous_normal').length;refusedJoins+=joins.filter(j=>j.kind==='refused').length;
  if(branches.every(b=>b.status!=='refused')&&joins.every(j=>j.kind!=='refused'))fullyBuilt++;
  return {branches,joins};
};
const combined=new Map();
for(const c of cases){const old=previous.cases.find(n=>n.key===c.key);combined.set(c.key,{bleed:merge(old.bleed,c.bleed),safe:merge(old.safe,c.safe)});}
if(cases.length!==135||currentBindings.length!==459||replacedBranches!==720||replacedJoins!==670)throw Error('Unexpected019 coverage');
const counts={articles:27,profiles:459,newCurrentResolverChecks:459,newCurrentSelectionValidations:459,inherited018SelectionValidations:2295,uniqueSizeCases:135,
  stationaryBranches:replacedBranches,boundedEndpointBranches:supplements.reduce((n,g)=>n+g.branches.filter(b=>b.status!=='refused').length,0),
  newEndpointChords:supplements.reduce((n,g)=>n+g.branches.reduce((n,b)=>n+b.chords.length,0),0),
  replacedStationaryJoins:replacedJoins,constructedLimitJoins:supplements.reduce((n,g)=>n+g.joins.filter(j=>j.kind!=='refused').length,0),
  combinedBoundedBranches:boundedBranches,combinedChords:chordCount,combinedRoundArcs:arcs,combinedContinuousJoins:continuous,combinedRefusedJoins:refusedJoins,fullyBuiltUntrimmedCases:fullyBuilt};
const draw=(g,color)=>g.branches.filter(b=>b.status!=='refused').map(b=>`<path d="${b.chords.map(c=>'M '+c.start.join(' ')+' L '+c.end.join(' ')).join(' ')}" fill="none" stroke="${color}" stroke-width=".3"/>`).join('')+
  g.joins.filter(j=>j.kind==='analytic_round_arc').map(j=>`<path d="M ${j.start.join(' ')} A ${j.radiusMm} ${j.radiusMm} 0 0 ${j.sweep} ${j.end.join(' ')}" fill="none" stroke="${color}" stroke-dasharray=".5 .4" stroke-width=".3"/>`).join('');
const cards=previous.cases.filter(c=>c.widthMm===50&&c.heightMm===50).map(c=>{
  const g=combined.get(c.key),next=cases.find(n=>n.key===c.key),newBranches=[...next.bleed.branches,...next.safe.branches].filter(b=>b.status!=='refused').length;
  return `<article data-article="${c.articleId}"><h2>Artikel ${c.articleId}</h2><svg role="img" aria-label="Uaccepteret endepunktsforslag ${c.articleId}" viewBox="-2 -2 60 60"><path d="${sourceShapeSvgPath(c.path)}" fill="none" stroke="#EC008C" stroke-width=".35"/>${draw(g.bleed,'#555')}${draw(g.safe,'#2F80ED')}</svg><p>${newBranches} nye begrænsede endepunktsforløb.<br>${[...g.bleed.branches,...g.safe.branches].filter(b=>b.status==='refused').length} afviste forløb · ${[...g.bleed.joins,...g.safe.joins].filter(j=>j.kind==='refused').length} uafklarede samlinger.</p><p class="blocked">Geometri, Designer og ordre er blokeret.</p></article>`;
}).join('');
const html=`<!doctype html><html lang="da"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline'"><title>Specialformer · endepunkter</title><style>body{font:16px system-ui;margin:0;background:#f4f6f8;color:#17202b}main{max-width:1200px;margin:auto;padding:24px}h1{font-size:clamp(24px,3vw,32px)}h2{font-size:18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:20px}article{background:white;border:1px solid #d8dee5;border-radius:12px;padding:16px;min-width:0}svg{width:100%;height:260px}p{line-height:1.5;max-width:75ch}.blocked{color:#8a3808;font-weight:600}@media(max-width:480px){main{padding:14px}svg{height:230px}}</style><main><h1>Specialformer · stationære endepunkter</h1><p>27 artikler / 459 materialeprofiler. Lokal matematisk gennemgang. Eksempelmål giver ingen godkendelse af skalering.</p><p>Hypotese: 50 × 50 mm. Magenta er den oprindelige stanskurve. Grå og blå følger normale afstande på 3 mm med højst 0,01 mm fejl pr. vist forløb. Stiplede buer er analytiske hjørneforslag. Endepunktsnormaler er udledt af den samme oprindelige kurve. Afviste forløb og samlinger står åbne; dette er ingen færdig skabelon.</p><div class="grid">${cards}</div></main></html>`;
for(const [p,h] of inputs)if(sha(read(p))!==h)throw Error('Input changed during019 '+p);
fs.mkdirSync(target,{recursive:true});const write=(name:string,v:unknown)=>fs.writeFileSync(target+'/'+name,typeof v==='string'?v:JSON.stringify(v,null,2)+'\n',{flag:'wx'});
write('endpoint-geometry.json',{version:1,status:'local_endpoint_normal_supplement_unaccepted',sourcePacketSha256:inputs.get(prior+'/bounded-geometry.json'),counts,cases,currentBindings,
  scalingAuthorityProved:false,supplierJoinPolicyAccepted:false,globalOffsetTopologyProved:false,sourceGeometryAccepted:false,designerAllowed:false,orderReady:false,fullCatalogueComplete:false,remoteWrites:false});
write('input-integrity.json',{inputs:[...inputs].map(([path,sha256])=>({path,sha256})),allUnchanged:true});write('review.html',html);
console.log(JSON.stringify({target,counts,packetSha256:sha(read(target+'/endpoint-geometry.json'))}));
