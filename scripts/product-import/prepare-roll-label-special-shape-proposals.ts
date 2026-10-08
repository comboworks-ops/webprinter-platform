/** Consumes the settled025/026 native audit. Adds local review artifacts only;
 * never reparses PDFs, regenerates catalogue metadata or writes remote state. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {rollLabelSpecialShapeHash,rollLabelSpecialCurrentProfileHash,reviewCurrentRollLabelSpecialShapeProposal,
  type RollLabelSpecialShapeModel,type RollLabelSpecialShapeProposal} from '../../src/lib/products/rollLabelSpecialShapeProposal.ts';
import {sourceShapeMetrics,sourceShapeContinuity,sourceShapeSvgPath,reviewSourceShapeAtSize,type SourceShapeSegment} from '../../src/lib/designer/sourceShapeReviewGeometry.ts';
import {validateRollLabelConfiguration} from '../../src/lib/products/rollLabelConfiguration';
import type {RollLabelReviewFamily} from '../../src/lib/products/rollLabelReview';
const root=process.cwd(),base='output/qa/roll-labels-2026-10-06',catalogue='output/supplier-imports/roll-labels-catalogue-2026-10-06';
const target=path.join(root,base,'special-shapes-017');
if(fs.existsSync(target))throw Error('Review target exists; preserve previous receipt');
const sha=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const read=(name:string)=>fs.readFileSync(path.join(root,name));
const json=(name:string)=>JSON.parse(read(name).toString());
const inputs=new Map<string,string>();
const protect=(name:string,expected?:string)=>{
  const actual=sha(read(name));if(expected&&actual!==expected)throw Error('Changed protected input '+name);inputs.set(name,actual);return actual;
};
const auditName=base+'/predecessor006-special-source-geometry-audit-025.json',exceptionName=base+'/predecessor006-special-source-exceptions-026.json';
const audit=json(auditName),exceptions=json(exceptionName),auditSha=protect(auditName),exceptionSha=protect(exceptionName);
const previous=json(base+'/stock-format-016/verification-summary-016.json');
previous.protectedArtifacts.forEach((a:{path:string;sha256:string})=>protect(a.path,a.sha256));
for(const name of fs.readdirSync(path.join(root,catalogue,'review/families')))protect(catalogue+'/review/families/'+name);
protect(catalogue+'/import-review/product-draft-plans.json');
const familyName=catalogue+'/review/families/25143.json',family=json(familyName) as RollLabelReviewFamily;
const sourceFamily=json(catalogue+'/families/25143.json');
protect(catalogue+'/families/25143.json');
const cuts=json(catalogue+'/source-cut-contour-contracts.json');
if(audit.status!=='read_only_native_special_shape_evidence'||audit.records.length!==27||audit.summary.profiles!==459
  ||audit.summary.documents!==54||audit.summary.allGeometryAndProductionGatesClosed!==true||family.profiles.length!==459
  ||cuts.contracts.length!==459||exceptions.status!=='read_only_exception_comparison'
  ||exceptions.results.length!==3||new Set(exceptions.results.map(r=>r.articleId)).size!==3)throw Error('Incomplete native/source evidence');
const models:RollLabelSpecialShapeModel[]=[],proposals:RollLabelSpecialShapeProposal[]=[],checks:unknown[]=[];
const diagnostics=new Map<string,ReturnType<typeof reviewSourceShapeAtSize>>();
const native=(candidate:{nativeItems:SourceShapeSegment[];unsupportedOperators:string[]})=>{
  if(!candidate||candidate.unsupportedOperators.length)throw Error('Unsupported source operator');
  return candidate.nativeItems.map(s=>({operator:s.operator,pointsPt:s.pointsPt}));
};
for(const r of audit.records) {
  if([r.geometryAccepted,r.productionExportAccepted,r.onlineDesignerAccepted,r.orderReady,r.scalingAuthorityProved].some(x=>x!==false))throw Error('Native audit gate changed');
  const guide=r.documents.find(d=>d.role==='guide'),template=r.documents.find(d=>d.role==='template');
  if(!guide||!template||guide.pages!==1||template.pages!==1||!guide.placeholderDimensions||!template.placeholderDimensions||!template.explicitExampleWords
    ||template.magentaStrokeCandidates.length!==1)throw Error('Ambiguous source example');
  for(const doc of r.documents) {
    protect(doc.localPath,doc.sha256);
    if(doc.sourceExplicitMarginRules.bleedMm!==3||doc.sourceExplicitMarginRules.safeMm!==3)throw Error('Changed source margins');
  }
  const modelPayload:Omit<RollLabelSpecialShapeModel,'sha256'>={version:1,status:'native_example_model_unaccepted',articleId:r.articleId,
    sourceAuditSha256:auditSha,exceptionAuditSha256:exceptionSha,
    sourceDocuments:r.documents.map(d=>({role:d.role,sha256:d.sha256,pageCount:1,placeholderDimensions:true,explicitExample:d.explicitExampleWords})),
    templateNativePath:native(template.magentaStrokeCandidates[0]),templateSafePaths:template.blueSafeStrokeCandidates.map(native),
    guideNativePaths:guide.magentaStrokeCandidates.map(native),guideSafePaths:guide.blueSafeStrokeCandidates.map(native),
    guideTemplateCorrespondence:exceptions.results.some(e=>e.articleId===r.articleId)?'sampled_proximity_only':'operator_comparison_only',
    scalingAuthorityProved:false,offsetAuthorityProved:false,sourceGeometryAccepted:false};
  const model:RollLabelSpecialShapeModel={...modelPayload,sha256:await rollLabelSpecialShapeHash(modelPayload)};
  models.push(model);
  const profiles=family.profiles.filter(p=>p.articleId===r.articleId);
  if(profiles.length!==r.profileCount||profiles.some(p=>!r.profileKeys.includes(p.key)))throw Error('Changed native profile coverage');
  for(const p of profiles) {
    const original=sourceFamily.profiles.find(q=>q.key===p.key),cut=cuts.contracts.find(c=>c.profileKey===p.key);
    if(!original||!cut||cut.guideSha256!==guide.sha256||p.artworkInstructions?.sourceEvidenceSha256!==cut.sourceEvidenceSha256)throw Error('Foreign current/source binding');
    protect('docs/roll-labels-2026-09-30/'+original.sourceEvidencePath,cut.sourceEvidenceSha256);
    const payload:Omit<RollLabelSpecialShapeProposal,'sha256'>={version:1,status:'source_special_shape_proposed_unaccepted',model:'native_example_affine_diagnostics_only',
      productId:family.productId,familyId:'25143',profileKey:p.key,articleId:p.articleId,materialId:p.sourceMaterialId,
      currentProfileSha256:await rollLabelSpecialCurrentProfileHash(family.productId,family.familyId,family.sections,p),sourceEvidenceSha256:cut.sourceEvidenceSha256,
      sourceShapeSha256:model.sha256,cutContractSha256:await rollLabelSpecialShapeHash(cut),bleedMm:3,safeMm:3,
      scalingAuthorityProved:false,sourceGeometryAccepted:false,onlineDesignerVerified:false,orderReady:false};
    const proposal={...payload,sha256:await rollLabelSpecialShapeHash(payload)};proposals.push(proposal);
    const contract={version:1,productId:family.productId,familyId:family.familyId,sections:family.sections,profiles:family.profiles,orderReady:false};
    const w=p.sizeContract!.axes.find(a=>a.axis==='width')!,h=p.sizeContract!.axes.find(a=>a.axis==='height')!;
    const sizes=[[50,50],[w.minMm,h.minMm],[w.minMm,h.maxMm],[w.maxMm,h.minMm],[w.maxMm,h.maxMm]];
    for(const [widthMm,heightMm] of sizes) {
      const selection=validateRollLabelConfiguration(p,{dimensions:{width:String(widthMm),height:String(heightMm)},quantity:'1000',allocations:['1000'],optionStateId:p.optionStates!.initialStateId!},contract).selection;
      if(!selection)throw Error('Current source selection rejected '+p.key);
      // All459 profiles are current-bound through the resolver at representative
      // size. Shared article/dimension diagnostics at the other corners are
      // cached; no exhaustive option cross-product is claimed.
      const key=r.articleId+':'+widthMm+':'+heightMm;
      let geometry=diagnostics.get(key);
      let blockers:string[]=[];
      if(widthMm===50&&heightMm===50) {
        const checked=await reviewCurrentRollLabelSpecialShapeProposal(selection,family.productId,contract,proposal,model,cut);
        if(!checked||checked.designerAllowed||checked.orderReady||checked.sourceGeometryAccepted)throw Error('Current model gate failed '+p.key);
        geometry=checked.geometry;blockers=checked.blockers;diagnostics.set(key,geometry);
      }else if(!geometry) {geometry=reviewSourceShapeAtSize(model.templateNativePath,widthMm,heightMm,3,3);diagnostics.set(key,geometry);}
      checks.push({profileKey:p.key,widthMm,heightMm,currentSelectionValidated:true,currentResolverChecked:widthMm===50&&heightMm===50,
        diagnostics:geometry!.diagnostics,blockers,sourceGeometryAccepted:false,designerAllowed:false,orderReady:false});
    }
  }
}
if(models.length!==27||proposals.length!==459||new Set(proposals.map(p=>p.profileKey)).size!==459)throw Error('Incomplete proposal scope');
const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
// Safe marks are kept as separate native strokes, including open and disconnected
// pieces. Never invent a Z or merge identical strokes into production geometry.
const safeSvg=(paths:SourceShapeSegment[][])=>paths.map(p=>{
  let result='',last:number[]|readonly number[]|null=null;
  for(const s of p) {
    if(!last||last[0]!==s.pointsPt[0][0]||last[1]!==s.pointsPt[0][1])result+=`M ${s.pointsPt[0].join(' ')} `;
    result+=`${s.operator==='c'?'C':'L'} ${s.pointsPt.slice(1).map(q=>q.join(' ')).join(' ')} `;last=s.pointsPt.at(-1)!;
  }
  return `<path d="${esc(result)}" fill="none" stroke="#2F80ED" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
}).join('');
const cards=models.map(m=>{
  const metrics=sourceShapeMetrics(m.templateNativePath),b=metrics.bounds,pad=10;
  const g=diagnostics.get(m.articleId+':50:50')!;
  const safe=m.templateSafePaths.map(sourceShapeContinuity);
  return `<article data-article="${m.articleId}"><h2>Artikel ${m.articleId}</h2><div class="plots"><figure><svg role="img" aria-label="Oprindelig eksempelkurve ${m.articleId}" viewBox="${b[0]-pad} ${b[1]-pad} ${b[2]-b[0]+2*pad} ${b[3]-b[1]+2*pad}"><path d="${esc(sourceShapeSvgPath(m.templateNativePath))}" fill="none" stroke="#EC008C" stroke-width="1.5" vector-effect="non-scaling-stroke"/>${safeSvg(m.templateSafePaths)}</svg><figcaption>Kildens eksempel · ${m.templateSafePaths.length} blå stregforløb</figcaption></figure><figure><svg role="img" aria-label="Uaccepteret 50 gange 50 millimeter forslag ${m.articleId}" viewBox="-2 -2 60 60"><rect x="0" y="0" width="56" height="56" fill="none" stroke="#adb5bd" stroke-width=".2"/><path d="${esc(sourceShapeSvgPath(g.path))}" fill="none" stroke="#EC008C" stroke-width=".35"/>${g.normalSamples.map(p=>`<circle cx="${p.safe[0]}" cy="${p.safe[1]}" r=".13" fill="#2F80ED"/><circle cx="${p.bleed[0]}" cy="${p.bleed[1]}" r=".13" fill="#737373"/>`).join('')}</svg><figcaption>Hypotese: 50 × 50 mm · normalpunkter, ingen offsetkurve</figcaption></figure></div><p>${g.diagnostics.nonSmoothJoins} samlinger over 1° · ${g.diagnostics.inwardFocalRadiusExceededSamples} indvendige risikopunkter · ${g.diagnostics.outwardFocalRadiusExceededSamples} udvendige risikopunkter</p><p>${safe.filter(s=>s.closed&&s.gaps.every(g=>g===0)).length} lukkede blå forløb · ${m.guideNativePaths.length} stansforløb i guiden</p><p class="blocked">Geometri, Designer og ordre er blokeret.</p></article>`;
}).join('');
const html=`<!doctype html><html lang="da"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline'"><title>Specialformer · lokal geometrigennemgang</title><style>body{font:16px system-ui;margin:0;background:#f4f6f8;color:#17202b}main{max-width:1200px;margin:auto;padding:24px}h1{font-size:26px}h2{font-size:18px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:20px}article{background:white;border:1px solid #d8dee5;border-radius:12px;padding:16px;min-width:0}.plots{display:flex;gap:12px}figure{margin:0;flex:1;min-width:0}svg{width:100%;height:200px}figcaption{font-size:13px;line-height:1.4}p{line-height:1.45}.blocked{color:#8a3808;font-weight:600}@media(max-width:480px){main{padding:14px}svg{height:150px}.plots{gap:8px}}</style><main><h1>Specialformer · lokal geometrigennemgang</h1><p>27 artikler / 459 materialeprofiler. Kildens XXX-mål og eksempelmarkering er bevaret i evidensen. Affin tilpasning er en uaccepteret hypotese. Blå kildeforløb bevares hver for sig; prikker er kun normalberegninger.</p><p>Polylinjer har højst 0,01 mm approksimationsbudget. Kurvernes eksakte topologi, offset-samlinger og kildebestemt skalering er stadig uafklarede. Ingen produktionsskabelon eller pris er oprettet.</p><div class="grid">${cards}</div></main></html>`;
for(const [name,expected] of inputs)if(sha(read(name))!==expected)throw Error('Input changed during review '+name);
fs.mkdirSync(target,{recursive:true});
const packet={version:1,status:'local_special_shape_review_unaccepted',sourceAuditSha256:auditSha,exceptionAuditSha256:exceptionSha,models,proposals,checks,
  counts:{articles:models.length,profiles:proposals.length,selectionChecks:checks.length,currentResolverChecks:459,uniqueSizeDiagnostics:diagnostics.size},
  sourceGeometryAccepted:false,onlineDesignerVerified:false,orderReady:false,catalogueRegenerated:false,remoteWrites:false};
fs.writeFileSync(path.join(target,'special-shape-proposals.json'),JSON.stringify(packet,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(target,'review.html'),html,{flag:'wx'});
fs.writeFileSync(path.join(target,'input-integrity.json'),JSON.stringify({inputs:[...inputs].map(([path,sha256])=>({path,sha256})),allUnchanged:true},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({path:target,counts:packet.counts,packetSha256:sha(read(base+'/special-shapes-017/special-shape-proposals.json'))}));
