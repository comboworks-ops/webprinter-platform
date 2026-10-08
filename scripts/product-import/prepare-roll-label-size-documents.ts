import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {generateRollLabelSizeTemplate} from '../../src/lib/designer/generateRollLabelSizeTemplate';
import {readRollLabelSizeGeometry,rollLabelSizeGuide} from '../../src/lib/products/rollLabelSizeGeometry';
import type {RollLabelReviewFamily} from '../../src/lib/products/rollLabelReview';

// Local concrete size candidates only. No price conversion, publisher, storage
// client, manifest activation or database writer is present here.
const root=process.cwd();
const base=path.join(root,'output/supplier-imports/roll-labels-catalogue-2026-10-06');
const out=path.join(base,'dimension-documents');
fs.mkdirSync(path.join(out,'templates'),{recursive:true});fs.mkdirSync(path.join(out,'guides'),{recursive:true});
const hash=(bytes:Uint8Array|string)=>createHash('sha256').update(bytes).digest('hex');
const json=(file:string)=>JSON.parse(fs.readFileSync(file,'utf8'));
const files=fs.readdirSync(path.join(base,'review/families'));
const families:RollLabelReviewFamily[]=files.map(file=>json(path.join(base,'review/families',file)));
const byKey=new Map(families.flatMap(f=>f.profiles.map(p=>[p.key,{p,f}] as const)));
const sourcePriceBytes=fs.readFileSync(path.join(base,'import-review/proposed-exact-prices.jsonl'));
const rows=sourcePriceBytes.toString().trim().split('\n').map(JSON.parse);
const cache=new Map<string,Awaited<ReturnType<typeof generateRollLabelSizeTemplate>>|string>();
const bindings:unknown[]=[],pending:unknown[]=[];
const guideRows=new Map<string,unknown>();
for(const row of rows) {
 const pair=byKey.get(row.sourceKey);
 if(!pair || !readRollLabelSizeGeometry(pair.p))continue;
 const {p,f}=pair, w=row.dimensions.widthMm,h=row.dimensions.heightMm;
 const stateOptions=JSON.parse(row.selections.options);
 const state=p.optionStates?.states.find(s=>Object.keys(s.options).length===Object.keys(stateOptions).length
   && Object.entries(s.options).every(([key,value])=>stateOptions[key]===value));
 if(!state){pending.push({profileKey:p.key,signature:row.extraData.signature,reason:'exact_quote_option_state_unavailable'});continue;}
 const key=`${p.sizeGeometry!.shape}:${p.sizeGeometry!.bleedMm}:${p.sizeGeometry!.safeMm}:${p.sizeGeometry!.cornerRadiusMm}:${w}:${h}`;
 if(!cache.has(key))try{cache.set(key,await generateRollLabelSizeTemplate(p,w,h));}catch(e){cache.set(key,(e as Error).message);}
 const result=cache.get(key)!;
 const guide=rollLabelSizeGuide(p,w,h,state.id);
 if(!guide){pending.push({profileKey:p.key,signature:row.extraData.signature,reason:'size_outside_exact_source_contract'});continue;}
 const guideKey=hash(JSON.stringify({profile:p.key,w,h,state:state.id}));
 const guideFile=`guides/${guideKey}.da.json`;const guideBytes=JSON.stringify(guide,null,2)+'\n';
 fs.writeFileSync(path.join(out,guideFile),guideBytes);guideRows.set(guideKey,{profileKey:p.key,guideFile,guideSha256:hash(guideBytes)});
 if(typeof result==='string'){pending.push({profileKey:p.key,signature:row.extraData.signature,reason:result,guideFile});continue;}
 const pdfSha256=hash(result.bytes),pdfFile=`templates/${pdfSha256}.pdf`;
 fs.writeFileSync(path.join(out,pdfFile),result.bytes);
 const documentation=p.artworkInstructions?.documentationStatus || 'source_context_unverified';
 bindings.push({profileKey:p.key,familyId:f.familyId,sourceQuoteSignature:row.extraData.signature,
   articleId:p.articleId,materialId:p.sourceMaterialId,widthMm:w,heightMm:h,optionStateId:state.id,
   sourceGeometryContractSha256:p.sizeGeometry!.sha256,sourcePdfEvidence:p.sizeGeometry!.evidence,
   guide:{path:guideFile,sha256:hash(guideBytes)},template:{path:pdfFile,sha256:pdfSha256,pageCount:1,
     bleedMm:p.sizeGeometry!.bleedMm,safeMm:p.sizeGeometry!.safeMm,cornerRadiusMm:p.sizeGeometry!.cornerRadiusMm,
     legend:result.legend,geometryMode:p.sizeGeometry!.geometryMode},
   materialArtworkDocumentationStatus:documentation,maskExportVerified:false,
   state:'local_exact_size_candidate_only',visualReview:'pending',designerTemplateId:null,
   hostedBindingVerified:false,onlineDesignerAllowed:false,retailReady:false,canonicalManifestValidated:false});
}
const writeLines=(name:string,data:unknown[])=>{
 const bytes=data.map(r=>JSON.stringify(r)).join('\n')+(data.length?'\n':'');fs.writeFileSync(path.join(out,name),bytes);
 return {path:name,sha256:hash(bytes),bytes:Buffer.byteLength(bytes),rows:data.length};
};
const bindingArtifact=writeLines('exact-size-bindings.jsonl',bindings),pendingArtifact=writeLines('pending-size-bindings.jsonl',pending);
const summary={schemaVersion:1,state:'local_exact_size_candidates_only',databaseWrites:false,sourcePdfsModified:false,
   sourceExactPriceArtifactSha256:hash(sourcePriceBytes),sourceExactPriceArtifactModified:false,
   exactPrimitiveProfiles:families.flatMap(f=>f.profiles).filter(p=>readRollLabelSizeGeometry(p)).length,
   exactQuoteBindings:bindings.length,uniqueTemplatePdfs:new Set((bindings as {template:{sha256:string}}[]).map(r=>r.template.sha256)).size,
   exactGuideFiles:guideRows.size,pendingQuoteBindings:pending.length,artifacts:{bindings:bindingArtifact,pending:pendingArtifact},
   retainedUnboundGuideFiles:fs.readdirSync(path.join(out,'guides')).length-guideRows.size,
   directoryWideUploadAllowed:false,
   canonicalManifestValidated:false,hostedAcceptance:false,allConfigurationsDesignerVerified:false,
   specialMaskExportVerified:false,corePricingImplementationApproved:false,fullCatalogueComplete:false};
fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
