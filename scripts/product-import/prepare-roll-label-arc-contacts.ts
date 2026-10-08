/** Native round-join contacts and known smooth endpoint incidences only.
 * No branch-interior isolation, trimming, printable loop or source approval. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {constructSourceShapeExactRoundArcs,intersectSourceShapeExactRoundArcs} from '../../src/lib/designer/sourceShapeArcContacts';
import type {OffsetJoin} from '../../src/lib/designer/sourceShapeBoundedGeometry';
import type {ContactBranch} from '../../src/lib/designer/sourceShapeContactGeometry';
import type {SourceShapeSegment} from '../../src/lib/designer/sourceShapeReviewGeometry';
const base='output/qa/roll-labels-2026-10-06',target=base+'/arc-contacts-025';
const sha=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const inputs:Record<string,string>={};
const read=(p:string,expected:string)=>{const bytes=fs.readFileSync(p);if(sha(bytes)!==expected)throw Error('Changed protected input '+p);inputs[p]=expected;return JSON.parse(bytes.toString());};
const old=read(base+'/bounded-geometry-018/bounded-geometry.json','4308bf7c775f5649b854393603738c1c5fb0d06c5c950376bdbed6396a843b28');
const endpoint=read(base+'/endpoint-geometry-019/endpoint-geometry.json','9a0bde65d30381463fc8f599e80175fc38c46ab302cf11b7584dd9b4852877f6');
const refinement=read(base+'/contact-refinement-025/contact-refinement.json','9ef8e44abeb1399588d92a3f442f9b67400d8fd41e1de4e05abc5ff8c7622a3c');
for(const [p,h] of Object.entries(refinement.inputHashes) as [string,string][]){
  // Original025 module and preparation hashes are still required unchanged.
  if(sha(fs.readFileSync(p))!==h)throw Error('Changed025 input '+p);inputs[p]=h;
}
for(const p of ['src/lib/designer/sourceShapeArcContacts.ts','scripts/product-import/prepare-roll-label-arc-contacts.ts'])inputs[p]=sha(fs.readFileSync(p));
type Side={branches:ContactBranch[];joins:OffsetJoin[]};
type SourceCase={key:string;articleId:string;widthMm:number;heightMm:number;sourceShapeSha256:string;path:SourceShapeSegment[];bleed:Side;safe:Side};
type PriorCase=Omit<SourceCase,'path'|'bleed'|'safe'>&{bleed:{pairs:{segments:[number,number];status:string}[]};safe:{pairs:{segments:[number,number];status:string}[]}};
const endpoints=new Map<string,SourceCase>(endpoint.cases.map((c:SourceCase)=>[c.key,c]));
const refined=new Map<string,PriorCase>(refinement.cases.map((c:PriorCase)=>[c.key,c]));
const counts={sizeCases:0,sideCases:0,nativeJoins:0,roundArcs:0,continuousJoins:0,refusedJoins:0,
  arcPairs:0,disjointArcPairs:0,isolatedArcContactPairs:0,isolatedArcContacts:0,tangentArcContacts:0,coincidentSectorUnresolvedPairs:0,
  supportRootsChecked:0,stationaryEndpointArcLimits:0,knownSmoothBranchEndpointContacts:0,remainingBoundedBranchPairs:4344};
const cases=(old.cases as SourceCase[]).map(c=>{
  const extra=endpoints.get(c.key),prior=refined.get(c.key);
  if(!extra||!prior)throw Error('Missing native source case');
  for(const key of ['articleId','widthMm','heightMm','sourceShapeSha256'] as const)if(c[key]!==extra[key]||c[key]!==prior[key])throw Error('Foreign native source binding');
  counts.sizeCases++;
  const sides=(['bleed','safe'] as const).map(side=>{
    const d=side==='bleed'?3:-3;
    const joins=c[side].joins.map(j=>extra[side].joins.find(n=>n.afterSegment===j.afterSegment)??j);
    const branches=c[side].branches.map(b=>extra[side].branches.find(n=>n.segment===b.segment)??b);
    const exact=constructSourceShapeExactRoundArcs(c.path,d,joins),pairs=[];
    counts.sideCases++;counts.nativeJoins+=joins.length;counts.roundArcs+=exact.arcs.length;
    counts.continuousJoins+=exact.continuousJoins.length;counts.refusedJoins+=exact.refusedJoins;
    counts.stationaryEndpointArcLimits+=exact.arcs.filter(a=>a.incomingLeadingOrder>1||a.outgoingLeadingOrder>1).length;
    for(let i=0;i<exact.arcs.length;i++)for(let j=i+1;j<exact.arcs.length;j++){
      const p=intersectSourceShapeExactRoundArcs(exact.arcs[i],exact.arcs[j]);pairs.push(p);counts.arcPairs++;
      counts.supportRootsChecked+=p.roots.length;
      if(p.status==='disjoint_exact_round_arcs')counts.disjointArcPairs++;
      else if(p.status==='coincident_sector_contact_unresolved')counts.coincidentSectorUnresolvedPairs++;
      else{
        counts.isolatedArcContactPairs++;counts.isolatedArcContacts+=p.contactCount!;
        if(p.relation==='tangent_circle_support')counts.tangentArcContacts+=p.contactCount!;
      }
    }
    const smoothEndpointContacts=prior[side].pairs.filter(p=>p.status==='unresolved').flatMap(p=>{
      const [a,b]=p.segments,n=c.path.length;
      const after=(a+1)%n===b?a:(b+1)%n===a?b:null;
      if(after===null)return [];
      const smooth=exact.continuousJoins.find(j=>j.afterSegment===after);if(!smooth)return [];
      const next=(after+1)%n,incoming=branches.find(b=>b.segment===after),outgoing=branches.find(b=>b.segment===next);
      if(!incoming||!outgoing||incoming.status==='refused'||outgoing.status==='refused')throw Error('Unconstructed smooth candidate');
      return [{...smooth,sourcePairSegments:p.segments,branches:[after,next],nativeParameters:[1,0],signedDistanceMm:d,
        exactEndpointContactProved:true,wholePairContactsIsolated:false,branchInteriorContactsExamined:false}];
    });
    counts.knownSmoothBranchEndpointContacts+=smoothEndpointContacts.length;
    return [side,{...exact,pairs,smoothEndpointContacts,branchInteriorContactsExamined:false,retainedBoundaryAccepted:false}] as const;
  });
  return {key:c.key,articleId:c.articleId,widthMm:c.widthMm,heightMm:c.heightMm,sourceShapeSha256:c.sourceShapeSha256,...Object.fromEntries(sides)};
});
if(counts.sizeCases!==135||counts.nativeJoins!==8170||counts.roundArcs!==3851||counts.continuousJoins!==468||counts.refusedJoins!==3851
  ||counts.arcPairs!==49326||counts.knownSmoothBranchEndpointContacts!==325)throw Error('Changed native join coverage');
const packet={version:1,status:'offline_exact_native_round_arc_contacts',counts,cases,inputHashes:inputs,
  inheritedSourceProfileBindingsSha256:refinement.sourceProfileBindingsSha256,
  branchInteriorContactsExamined:false,allContactsIsolated:false,focalFragmentsExamined:false,retainedBoundaryAccepted:false,
  globalOffsetTopologyProved:false,scalingAuthorityProved:false,supplierJoinPolicyAccepted:false,sourceGeometryAccepted:false,
  designerAllowed:false,orderReady:false,fullCatalogueComplete:false,remoteWrites:false};
const bytes=JSON.stringify(packet)+'\n';if(Buffer.byteLength(bytes)>30*1024*1024)throw Error('Bounded30MiB output budget exceeded');
for(const [p,h] of Object.entries(inputs))if(sha(fs.readFileSync(p))!==h)throw Error('Source changed during exact contacts '+p);
const write=process.argv.includes('--write');
if(write){if(fs.existsSync(target))throw Error('Preserve existing arc-contact output');fs.mkdirSync(target,{recursive:true});fs.writeFileSync(target+'/arc-contacts.json',bytes,{flag:'wx'});}
console.log(JSON.stringify({write,target,bytes:Buffer.byteLength(bytes),sha256:sha(bytes),counts}));
