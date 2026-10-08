/** Resolve ONLY the616 remaining straight/straight native branch pairs. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {constructSourceShapeExactOffsetLines,intersectSourceShapeExactOffsetLines} from '../../src/lib/designer/sourceShapeLineContacts';
import type {SourceShapeSegment} from '../../src/lib/designer/sourceShapeReviewGeometry';
import type {ContactBranch} from '../../src/lib/designer/sourceShapeContactGeometry';
const base='output/qa/roll-labels-2026-10-06',target=base+'/line-contacts-025';
const sha=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const inputs:Record<string,string>={};
const read=(p:string,expected?:string)=>{const b=fs.readFileSync(p),h=sha(b);if(expected&&h!==expected)throw Error('Changed input '+p);inputs[p]=h;return JSON.parse(b.toString());};
const arc=read(base+'/arc-contacts-025/arc-contacts.json','049435460a73d6e1c2b0531e42d074999d9ecc0a0232bfb575d08b03af730010');
const verified=read(base+'/arc-contacts-025/independent-verification.json');
if(verified.packetSha256!==inputs[base+'/arc-contacts-025/arc-contacts.json']||!verified.nativeEndpointLimitsIndependentlyReconstructed
  ||!verified.allCircleSupportRootsVerified||!verified.fullArcPairInventoryVerified)throw Error('Missing independent native arc readback');
if(sha(fs.readFileSync('scripts/product-import/verify-roll-label-arc-contacts.py'))!==verified.checkerSha256)throw Error('Changed independent arc checker');
inputs['scripts/product-import/verify-roll-label-arc-contacts.py']=verified.checkerSha256;
for(const [p,h] of Object.entries(arc.inputHashes) as [string,string][]){if(sha(fs.readFileSync(p))!==h)throw Error('Changed native arc source');inputs[p]=h;}
const old=read(base+'/bounded-geometry-018/bounded-geometry.json'),endpoint=read(base+'/endpoint-geometry-019/endpoint-geometry.json');
const refinement=read(base+'/contact-refinement-025/contact-refinement.json');
for(const p of ['src/lib/designer/sourceShapeLineContacts.ts','scripts/product-import/prepare-roll-label-line-contacts.ts'])inputs[p]=sha(fs.readFileSync(p));
type SourceCase={key:string;articleId:string;widthMm:number;heightMm:number;sourceShapeSha256:string;path:SourceShapeSegment[];
  bleed:{branches:ContactBranch[]};safe:{branches:ContactBranch[]}};
const endpoints=new Map<string,SourceCase>(endpoint.cases.map((c:SourceCase)=>[c.key,c]));
const refined=new Map(refinement.cases.map(c=>[c.key,c])),arcCases=new Map(arc.cases.map(c=>[c.key,c]));
const counts={sizeCases:0,sideCases:0,exactNativeLines:0,straightPairsExamined:0,disjointPairs:0,isolatedContactPairs:0,
  coincidentOverlapPairs:0,interiorOnBothContactPairs:0,priorUnresolvedBoundedPairs:4344,remainingNonlinearPairs:0};
const cases=(old.cases as SourceCase[]).map(c=>{
  const extra=endpoints.get(c.key),prior=refined.get(c.key),native=arcCases.get(c.key);
  if(!extra||!prior||!native)throw Error('Missing exact native source case');
  for(const k of ['articleId','widthMm','heightMm','sourceShapeSha256'] as const)if(c[k]!==extra[k]||c[k]!==prior[k]||c[k]!==native[k])throw Error('Foreign source identity');
  counts.sizeCases++;
  const sides=(['bleed','safe'] as const).map(side=>{
    const lines=constructSourceShapeExactOffsetLines(c.path,side==='bleed'?3:-3,native[side].winding,native[side].scale2Exponent);
    const byId=new Map(lines.map(l=>[l.segment,l]));
    const branches=new Map(c[side].branches.map(b=>[b.segment,extra[side].branches.find(n=>n.segment===b.segment)??b]));
    const pairs=[];counts.sideCases++;counts.exactNativeLines+=lines.length;
    for(const p of prior[side].pairs){
      if(p.status!=='unresolved')continue;
      const [a,b]=p.segments;
      if(!byId.has(a)||!byId.has(b)){counts.remainingNonlinearPairs++;continue;}
      if(branches.get(a)?.status==='refused'||branches.get(b)?.status==='refused')throw Error('Unconstructed straight candidate');
      const result=intersectSourceShapeExactOffsetLines(byId.get(a)!,byId.get(b)!);pairs.push(result);counts.straightPairsExamined++;
      if(result.status==='disjoint_exact_line_branches')counts.disjointPairs++;
      else if(result.status==='exact_coincident_line_overlap')counts.coincidentOverlapPairs++;
      else{counts.isolatedContactPairs++;
        if(result.relation==='nonparallel_support_intersection'&&result.membership.onA.startSign>0&&result.membership.onA.endSign<0
          &&result.membership.onB.startSign>0&&result.membership.onB.endSign<0)counts.interiorOnBothContactPairs++;
      }
    }
    return [side,{signedDistanceMm:side==='bleed'?3:-3,winding:native[side].winding,scale2Exponent:native[side].scale2Exponent,lines,pairs,
      otherPolynomialBranchesExamined:false,retainedBoundaryAccepted:false,globalOffsetTopologyProved:false,sourceGeometryAccepted:false,
      designerAllowed:false,orderReady:false}] as const;
  });
  return {key:c.key,articleId:c.articleId,widthMm:c.widthMm,heightMm:c.heightMm,sourceShapeSha256:c.sourceShapeSha256,...Object.fromEntries(sides)};
});
if(counts.sizeCases!==135||counts.straightPairsExamined!==616||counts.remainingNonlinearPairs!==3728)throw Error('Changed remaining native pair inventory');
const packet={version:1,status:'offline_exact_native_straight_branch_contacts',counts,cases,inputHashes:inputs,
  arithmetic:'exact_two_radical_native_offset_parameters',inheritedSourceProfileBindingsSha256:arc.inheritedSourceProfileBindingsSha256,
  allContactsIsolated:false,focalFragmentsExamined:false,retainedBoundaryAccepted:false,globalOffsetTopologyProved:false,
  scalingAuthorityProved:false,supplierJoinPolicyAccepted:false,sourceGeometryAccepted:false,designerAllowed:false,orderReady:false,
  fullCatalogueComplete:false,remoteWrites:false};
const bytes=JSON.stringify(packet)+'\n';if(Buffer.byteLength(bytes)>5*1024*1024)throw Error('Bounded5MiB output budget exceeded');
for(const [p,h] of Object.entries(inputs))if(sha(fs.readFileSync(p))!==h)throw Error('Input changed during line contacts');
const write=process.argv.includes('--write');
if(write){if(fs.existsSync(target))throw Error('Preserve existing native line contacts');fs.mkdirSync(target,{recursive:true});fs.writeFileSync(target+'/line-contacts.json',bytes,{flag:'wx'});}
console.log(JSON.stringify({write,target,bytes:Buffer.byteLength(bytes),sha256:sha(bytes),counts}));
