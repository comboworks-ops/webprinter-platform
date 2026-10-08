/** All native straight-branch/round-join pairs; offline, no trim acceptance. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {intersectSourceShapeExactLineArc} from '../../src/lib/designer/sourceShapeLineArcContacts';
import type {ExactRoundArc} from '../../src/lib/designer/sourceShapeArcContacts';
import type {ExactOffsetLine} from '../../src/lib/designer/sourceShapeLineContacts';
const base='output/qa/roll-labels-2026-10-06',target=base+'/line-arc-contacts-025';
const sha=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const inputs:Record<string,string>={};
const read=(p:string,h:string)=>{const b=fs.readFileSync(p);if(sha(b)!==h)throw Error('Changed line/arc input '+p);inputs[p]=h;return JSON.parse(b.toString());};
const arc=read(base+'/arc-contacts-025/arc-contacts.json','049435460a73d6e1c2b0531e42d074999d9ecc0a0232bfb575d08b03af730010');
const line=read(base+'/line-contacts-025/line-contacts.json','9877b48dce88491759917bb590d4bbdc9a97948fbb9c3e45fbfca1e1ad7800c6');
const report=read(base+'/line-contacts-025/independent-verification.json','1624d10e86f2a1f429d873c1a3d2666ef0ed1aa481ca75a8fd2b856d2794d909');
if(report.packetSha256!==inputs[base+'/line-contacts-025/line-contacts.json']||!report.nativeLinesIndependentlyReconstructed
  ||!report.bothOriginalLineEquationsVerified||!report.fullStraightPairInventoryVerified)throw Error('Missing independent line readback');
if(sha(fs.readFileSync('scripts/product-import/verify-roll-label-line-contacts.py'))!==report.checkerSha256)throw Error('Changed independent line checker');
inputs['scripts/product-import/verify-roll-label-line-contacts.py']=report.checkerSha256;
for(const [p,h] of Object.entries(line.inputHashes) as [string,string][]){if(sha(fs.readFileSync(p))!==h)throw Error('Changed native source');inputs[p]=h;}
for(const p of ['src/lib/designer/sourceShapeLineArcContacts.ts','scripts/product-import/prepare-roll-label-line-arc-contacts.ts'])inputs[p]=sha(fs.readFileSync(p));
type ArcCase={key:string;articleId:string;widthMm:number;heightMm:number;sourceShapeSha256:string;bleed:{arcs:ExactRoundArc[];scale2Exponent:number};safe:{arcs:ExactRoundArc[];scale2Exponent:number}};
type LineCase=Omit<ArcCase,'bleed'|'safe'>&{bleed:{lines:ExactOffsetLine[];scale2Exponent:number};safe:{lines:ExactOffsetLine[];scale2Exponent:number}};
const arcCases=new Map<string,ArcCase>(arc.cases.map((c:ArcCase)=>[c.key,c]));
const counts={sizeCases:0,sideCases:0,lineArcPairs:0,disjointPairs:0,isolatedContactPairs:0,isolatedContacts:0,
  tangentSupportPairs:0,tangentContacts:0,supportRootsChecked:0,closedLineEndpointContacts:0};
const cases=(line.cases as LineCase[]).map(c=>{
  const a=arcCases.get(c.key);if(!a)throw Error('Missing native arcs');
  for(const k of ['articleId','widthMm','heightMm','sourceShapeSha256'] as const)if(c[k]!==a[k])throw Error('Foreign source binding');
  counts.sizeCases++;
  const sides=(['bleed','safe'] as const).map(side=>{
    if(c[side].scale2Exponent!==a[side].scale2Exponent)throw Error('Foreign native scale');
    counts.sideCases++;const pairs=[];
    for(const l of c[side].lines)for(const j of a[side].arcs){
      const p=intersectSourceShapeExactLineArc(l,j);pairs.push(p);counts.lineArcPairs++;counts.supportRootsChecked+=p.roots.length;
      if(p.status==='disjoint_exact_line_arc')counts.disjointPairs++;
      else{counts.isolatedContactPairs++;counts.isolatedContacts+=p.contactCount;}
      if(p.relation==='tangent_line_circle_support'){counts.tangentSupportPairs++;counts.tangentContacts+=p.contactCount;}
      counts.closedLineEndpointContacts+=p.roots.filter(r=>r.contact&&(r.onLine.startSign===0||r.onLine.endSign===0)).length;
    }
    return [side,{scale2Exponent:c[side].scale2Exponent,pairs,cubicBranchContactsExamined:false,retainedBoundaryAccepted:false,
      globalOffsetTopologyProved:false,sourceGeometryAccepted:false,designerAllowed:false,orderReady:false}] as const;
  });
  return {key:c.key,articleId:c.articleId,widthMm:c.widthMm,heightMm:c.heightMm,sourceShapeSha256:c.sourceShapeSha256,...Object.fromEntries(sides)};
});
if(counts.sizeCases!==135||counts.sideCases!==270||counts.lineArcPairs!==85227)throw Error('Changed full native line/arc inventory');
const packet={version:1,status:'offline_exact_native_line_arc_contacts',counts,cases,inputHashes:inputs,
  inheritedSourceProfileBindingsSha256:line.inheritedSourceProfileBindingsSha256,allContactsIsolated:false,cubicBranchContactsExamined:false,
  focalFragmentsExamined:false,retainedBoundaryAccepted:false,globalOffsetTopologyProved:false,sourceGeometryAccepted:false,
  scalingAuthorityProved:false,supplierJoinPolicyAccepted:false,designerAllowed:false,orderReady:false,fullCatalogueComplete:false,remoteWrites:false};
const bytes=JSON.stringify(packet)+'\n';if(Buffer.byteLength(bytes)>64*1024*1024)throw Error('Bounded64MiB output budget exceeded');
for(const [p,h] of Object.entries(inputs))if(sha(fs.readFileSync(p))!==h)throw Error('Input changed during line/arc contacts');
const write=process.argv.includes('--write');
if(write){if(fs.existsSync(target))throw Error('Preserve existing line/arc contacts');fs.mkdirSync(target,{recursive:true});fs.writeFileSync(target+'/line-arc-contacts.json',bytes,{flag:'wx'});}
console.log(JSON.stringify({write,target,bytes:Buffer.byteLength(bytes),sha256:sha(bytes),counts}));
