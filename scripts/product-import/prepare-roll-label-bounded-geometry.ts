/** Additive offline continuation of017. No source extraction, catalogue
 * regeneration, product mutation, template export or remote access. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {boundSourceShapeTopology,boundSourceShapeOffset} from '../../src/lib/designer/sourceShapeBoundedGeometry.ts';
import {sourceShapeMetrics,transformSourceShape,sourceShapeSvgPath} from '../../src/lib/designer/sourceShapeReviewGeometry.ts';
import {reviewCurrentRollLabelSpecialShapeProposal,rollLabelSpecialShapeHash,type RollLabelSpecialShapeModel,type RollLabelSpecialShapeProposal} from '../../src/lib/products/rollLabelSpecialShapeProposal.ts';
import {validateRollLabelConfiguration} from '../../src/lib/products/rollLabelConfiguration';
import type {RollLabelReviewFamily} from '../../src/lib/products/rollLabelReview';
const base='output/qa/roll-labels-2026-10-06',prior=base+'/special-shapes-017',target=base+'/bounded-geometry-018';
if(fs.existsSync(target))throw Error('Preserve existing018 target');
const read=(name:string)=>fs.readFileSync(path.resolve(name));
const sha=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
const json=(name:string)=>JSON.parse(read(name).toString());
const inputs=new Map<string,string>();
const protect=(name:string,expected?:string)=>{
  const actual=sha(read(name));if(expected&&actual!==expected)throw Error('Changed protected input '+name);inputs.set(name,actual);return actual;
};
const summary=json(prior+'/verification-summary-017.json');
for(const entry of [...summary.files,...summary.outputs,...summary.protectedArtifacts])protect(entry.path,entry.sha256);
protect(prior+'/verification-summary-017.json');
for(const entry of json(prior+'/input-integrity.json').inputs)protect(entry.path,entry.sha256);
const previous=json(prior+'/special-shape-proposals.json') as {models:RollLabelSpecialShapeModel[];proposals:RollLabelSpecialShapeProposal[]};
if(previous.models.length!==27||previous.proposals.length!==459)throw Error('Incomplete017 packet');
const catalogue='output/supplier-imports/roll-labels-catalogue-2026-10-06';
const family=json(catalogue+'/review/families/25143.json') as RollLabelReviewFamily;
const cuts=json(catalogue+'/source-cut-contour-contracts.json').contracts;
const contract={version:1,productId:family.productId,familyId:family.familyId,sections:family.sections,profiles:family.profiles,orderReady:false};
const nativeTopology=previous.models.map(m=>({articleId:m.articleId,sourceShapeSha256:m.sha256,topology:boundSourceShapeTopology(m.templateNativePath)}));
const diagnostics=new Map<string,{articleId:string;widthMm:number;heightMm:number;sourceShapeSha256:string;path:ReturnType<typeof transformSourceShape>;
  topology:ReturnType<typeof boundSourceShapeTopology>;bleed:ReturnType<typeof boundSourceShapeOffset>;safe:ReturnType<typeof boundSourceShapeOffset>}>();
const currentBindings:unknown[]=[];
for(const proposal of previous.proposals) {
  const m=previous.models.find(m=>m.articleId===proposal.articleId)!,p=family.profiles.find(p=>p.key===proposal.profileKey)!,cut=cuts.find(c=>c.profileKey===p.key);
  const {sha256:expected,...payload}=m;if(await rollLabelSpecialShapeHash(payload)!==expected)throw Error('Changed source model');
  const w=p.sizeContract!.axes.find(a=>a.axis==='width')!,h=p.sizeContract!.axes.find(a=>a.axis==='height')!;
  const sizes=[[50,50],[w.minMm,h.minMm],[w.minMm,h.maxMm],[w.maxMm,h.minMm],[w.maxMm,h.maxMm]];
  const keys:string[]=[];
  for(const [widthMm,heightMm] of sizes) {
    const selection=validateRollLabelConfiguration(p,{dimensions:{width:String(widthMm),height:String(heightMm)},quantity:'1000',allocations:['1000'],optionStateId:p.optionStates!.initialStateId!},contract).selection;
    if(!selection)throw Error('Changed current selection domain');
    if(widthMm===50&&heightMm===50) {
      const checked=await reviewCurrentRollLabelSpecialShapeProposal(selection,family.productId,contract,proposal,m,cut);
      if(!checked||checked.sourceGeometryAccepted||checked.designerAllowed||checked.orderReady)throw Error('Changed current proposal binding/gate');
    }
    const key=m.articleId+':'+widthMm+':'+heightMm;keys.push(key);
    if(!diagnostics.has(key)) {
      const geometry=transformSourceShape(m.templateNativePath,sourceShapeMetrics(m.templateNativePath).bounds,widthMm,heightMm,3);
      diagnostics.set(key,{articleId:m.articleId,widthMm,heightMm,sourceShapeSha256:m.sha256,path:geometry,
        topology:boundSourceShapeTopology(geometry),bleed:boundSourceShapeOffset(geometry,3),safe:boundSourceShapeOffset(geometry,-3)});
    }
  }
  currentBindings.push({profileKey:p.key,articleId:p.articleId,currentProfileSha256:proposal.currentProfileSha256,sourceShapeSha256:m.sha256,
    proposalSha256:proposal.sha256,cutContractSha256:proposal.cutContractSha256,diagnosticKeys:keys,selectionCount:5,currentResolverChecks:1,
    sourceGeometryAccepted:false,designerAllowed:false,orderReady:false});
}
const cases=[...diagnostics].map(([key,value])=>({key,...value}));
const offsetCases=cases.flatMap(c=>[c.bleed,c.safe]);
const counts={articles:27,profiles:459,currentResolverChecks:459,currentSelectionValidations:2295,uniqueSizeCases:cases.length,nativeTopologyCases:27,
  nativeSimpleLoops:nativeTopology.filter(c=>c.topology.status==='binary_input_simple_loop_proved').length,
  nativeNotSimple:nativeTopology.filter(c=>c.topology.status==='binary_input_not_simple').length,
  hypotheticalSimpleLoops:cases.filter(c=>c.topology.status==='binary_input_simple_loop_proved').length,
  hypotheticalNotSimple:cases.filter(c=>c.topology.status==='binary_input_not_simple').length,
  offsetBranches:offsetCases.reduce((n,g)=>n+g.branches.length,0),boundedOffsetBranches:offsetCases.reduce((n,g)=>n+g.branches.filter(b=>b.status==='bounded_normal_branch').length,0),
  boundedChords:offsetCases.reduce((n,g)=>n+g.branches.reduce((n,b)=>n+b.chords.length,0),0),
  roundArcJoins:offsetCases.reduce((n,g)=>n+g.joins.filter(j=>j.kind==='analytic_round_arc').length,0),
  continuousJoins:offsetCases.reduce((n,g)=>n+g.joins.filter(j=>j.kind==='continuous_normal').length,0),
  refusedJoins:offsetCases.reduce((n,g)=>n+g.joins.filter(j=>j.kind==='refused').length,0),
  fullyBoundedUntrimmedOffsetCases:offsetCases.filter(g=>g.allBranchesBounded&&g.allJoinsConstructed).length};
if(currentBindings.length!==459||cases.length!==135)throw Error('Unexpected current coverage');
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const branches=(g:ReturnType<typeof boundSourceShapeOffset>,color:string)=>g.branches.filter(b=>b.status==='bounded_normal_branch').map(b=>
  `<path d="${b.chords.map(c=>'M '+c.start.join(' ')+' L '+c.end.join(' ')).join(' ')}" fill="none" stroke="${color}" stroke-width=".3"/>`).join('');
const arcs=(g:ReturnType<typeof boundSourceShapeOffset>,color:string)=>g.joins.filter(j=>j.kind==='analytic_round_arc').map(j=>
  `<path d="M ${j.start!.join(' ')} A ${j.radiusMm} ${j.radiusMm} 0 0 ${j.sweep} ${j.end!.join(' ')}" fill="none" stroke="${color}" stroke-dasharray=".5 .4" stroke-width=".3"/>`).join('');
const cards=previous.models.map(m=>{
  const c=diagnostics.get(m.articleId+':50:50')!,native=nativeTopology.find(n=>n.articleId===m.articleId)!;
  const text=(g:typeof c.bleed)=>`${g.branches.filter(b=>b.status==='bounded_normal_branch').length}/${g.branches.length} kurveforløb · ${g.joins.filter(j=>j.kind==='refused').length} uafklarede samlinger`;
  return `<article data-article="${m.articleId}"><h2>Artikel ${m.articleId}</h2><p>${native.topology.status==='binary_input_simple_loop_proved'?'Eksempelkurvens simple lukning bevist':'Eksempelkurvens overlap/kontakt blokerer'}</p><svg role="img" aria-label="Uaccepteret geometriforslag ${m.articleId}" viewBox="-2 -2 60 60"><path d="${esc(sourceShapeSvgPath(c.path))}" fill="none" stroke="#EC008C" stroke-width=".35"/>${branches(c.bleed,'#555')}${arcs(c.bleed,'#555')}${branches(c.safe,'#2F80ED')}${arcs(c.safe,'#2F80ED')}</svg><p>Udvendigt: ${text(c.bleed)}<br>Indvendigt: ${text(c.safe)}</p><p class="blocked">Geometri, Designer og ordre er blokeret.</p></article>`;
}).join('');
const html=`<!doctype html><html lang="da"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline'"><title>Specialformer · begrænset geometri</title><style>body{font:16px system-ui;margin:0;background:#f4f6f8;color:#17202b}main{max-width:1200px;margin:auto;padding:24px}h1{font-size:clamp(24px,3vw,32px)}h2{font-size:18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:20px}article{background:white;border:1px solid #d8dee5;border-radius:12px;padding:16px;min-width:0}svg{width:100%;height:260px}p{line-height:1.5;max-width:75ch}.blocked{color:#8a3808;font-weight:600}@media(max-width:480px){main{padding:14px}svg{height:230px}}</style><main><h1>Specialformer · begrænset geometri</h1><p>27 artikler / 459 materialeprofiler. Dette er en lokal matematisk gennemgang. Leverandørens eksempelmål giver stadig ingen godkendelse af skalering.</p><p>Hypotese: 50 × 50 mm. Magenta er stanskurven. Grå og blå linjer følger normale afstande på 3 mm med højst 0,01 mm fejl pr. vist kurveforløb. Stiplede buer er analytiske forslag til udvendige hjørner. Manglende forløb og samlinger er eksplicit afvist; diagrammet er ingen færdig skabelon.</p><div class="grid">${cards}</div></main></html>`;
for(const [name,expected] of inputs)if(sha(read(name))!==expected)throw Error('Input changed during018 '+name);
fs.mkdirSync(target,{recursive:true});
const write=(name:string,value:unknown)=>fs.writeFileSync(target+'/'+name,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n',{flag:'wx'});
write('bounded-geometry.json',{version:1,status:'local_bounded_geometry_unaccepted',sourcePacketSha256:inputs.get(prior+'/special-shape-proposals.json'),counts,nativeTopology,cases,currentBindings,
  scalingAuthorityProved:false,supplierJoinPolicyAccepted:false,globalOffsetTopologyProved:false,sourceGeometryAccepted:false,designerAllowed:false,orderReady:false,
  fullCatalogueComplete:false,catalogueRegenerated:false,remoteWrites:false});
write('input-integrity.json',{inputs:[...inputs].map(([path,sha256])=>({path,sha256})),allUnchanged:true});
write('review.html',html);
console.log(JSON.stringify({target,counts,packetSha256:sha(read(target+'/bounded-geometry.json'))}));
