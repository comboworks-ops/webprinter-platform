import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {rollLabelHash} from './shared/roll-label-catalogue.js';

// Local schema-2 review slices only. No database, uploader or publisher.
// Keep dimensional candidates separate from the existing fixed-document slices.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const base=path.join(root,'output/supplier-imports/roll-labels-catalogue-2026-10-06');
const out=path.join(base,'canonical-size-manifests');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const lines=file=>fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const hash=value=>createHash('sha256').update(value).digest('hex');
const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const sourcePricePath=path.join(base,'import-review/proposed-exact-prices.jsonl');
const sourcePriceSha256=hash(fs.readFileSync(sourcePricePath));
const candidateSummary=read(path.join(base,'dimension-documents/summary.json'));
assert(sourcePriceSha256===candidateSummary.sourceExactPriceArtifactSha256,'Stale size candidate price source');
const prices=lines(sourcePricePath),bySignature=new Map(prices.map(p=>[p.extraData.signature,p]));
assert(bySignature.size===prices.length,'Duplicate source quote signatures');
const candidateBytes=fs.readFileSync(path.join(base,'dimension-documents/exact-size-bindings.jsonl'));
assert(hash(candidateBytes)===candidateSummary.artifacts.bindings.sha256,'Changed size candidate artifact');
const candidates=lines(path.join(base,'dimension-documents/exact-size-bindings.jsonl'));
const sourceAudit=read(path.join(base,'source-size-geometry-contracts.json'));
const auditByKey=new Map(sourceAudit.profiles.map(p=>[p.profileKey,p]));
const sourceProfiles=lines(path.join(base,'normalized/article-material-profiles.jsonl'));
const sourceProfileByKey=new Map(sourceProfiles.map(p=>[p.key,p]));
const catalogue=read(path.join(base,'catalogue-plan.json'));
const original=read(path.join(root,'docs/roll-labels-2026-09-30/catalogue.normalized.json'));
const approvedDocumentation=new Set(['no_selective_mask_required_by_signals','mask_rules_documented']);
const registry=[];
const copyHashed=(relative,expected,dir)=>{
 assert(/^(guides|templates)\/[a-f0-9]{64}\.(da\.json|pdf)$/.test(relative),'Unsafe candidate path');
 const bytes=fs.readFileSync(path.join(base,'dimension-documents',relative));assert(hash(bytes)===expected,'Changed candidate bytes');
 const target='documents/'+path.basename(relative);fs.writeFileSync(path.join(dir,target),bytes);return target;
};
const artifact=(dir,name,rows)=>{
 const bytes=rows.map(r=>JSON.stringify(r)).join('\n')+'\n';fs.writeFileSync(path.join(dir,name),bytes);
 return {path:name,format:'jsonl',rowCount:rows.length,bytes:Buffer.byteLength(bytes),sha256:hash(bytes)};
};
fs.mkdirSync(out,{recursive:true});
for(const family of catalogue.families){
 const dir=path.join(out,family.sourceFamilyId);fs.mkdirSync(path.join(dir,'documents'),{recursive:true});
 const familyCandidates=candidates.filter(c=>c.familyId===family.sourceFamilyId);
 const eligible=[],excluded=[];
 for(const c of familyCandidates){
  const quote=bySignature.get(c.sourceQuoteSignature),audit=auditByKey.get(c.profileKey),profile=sourceProfileByKey.get(c.profileKey);
  assert(quote&&audit?.contract&&profile,'Missing exact quote/profile/rule source');
  assert(quote.sourceKey===c.profileKey&&profile.familyId===c.familyId,'Foreign quote/profile family');
  assert(quote.dimensions.widthMm===c.widthMm&&quote.dimensions.heightMm===c.heightMm,'Changed quote dimensions');
  assert(audit.contract.sha256===c.sourceGeometryContractSha256&&profile.sourceEvidenceSha256===audit.sourceEvidenceSha256,'Stale source rule');
  assert(!profile.blockers.length,'Quarantined profile cannot enter size slice');
  if(!approvedDocumentation.has(c.materialArtworkDocumentationStatus)){
   excluded.push({profileKey:c.profileKey,sourceQuoteSignature:c.sourceQuoteSignature,reason:'exact_material_artwork_instructions_pending'});continue;
  }
  eligible.push({c,quote,audit});
 }
 write(path.join(dir,'coverage.json'),{familyId:family.sourceFamilyId,fullFamilyComplete:false,
  eligibleProfileKeys:[...new Set(eligible.map(e=>e.c.profileKey))],excluded,dimensionCandidates:familyCandidates.length,
  pendingTinySizeBindings:lines(path.join(base,'dimension-documents/pending-size-bindings.jsonl')).filter(p=>sourceProfileByKey.get(p.profileKey)?.familyId===family.sourceFamilyId),
  ordinaryDesignerBindingVerified:false,savedCustomSizeVerified:false,retailReady:false});
 const entry={familyId:family.sourceFamilyId,name:family.name,eligibleProfiles:new Set(eligible.map(e=>e.c.profileKey)).size,
  priceRows:eligible.length,excludedPriceRows:excluded.length,documentBindings:0,status:'blocked_exact_dimensional_document_or_material_rules',
  canonicalManifestValidated:false,fullFamilyComplete:false,remoteWriteApproved:false,ordinaryDesignerBindingVerified:false};
 if(!eligible.length){registry.push(entry);continue;}
 const rows=eligible.map(({quote},sourceOrder)=>({...quote,sourceOrder}));
 const axes=Object.keys(rows[0].selections);
 assert(rows.every(row=>Object.keys(row.selections).join()===axes.join()),'Mixed selection axes');
 const unique=new Map(eligible.map(e=>[rollLabelHash(e.quote.selections),e]));
 const documents=[...unique.entries()].map(([signature,{c,quote,audit}],sourceOrder)=>{
  const templatePath=copyHashed(c.template.path,c.template.sha256,dir);
  const guidePath=copyHashed(c.guide.path,c.guide.sha256,dir);
  const guide=read(path.join(dir,guidePath));
  assert(guide.finishedWidthMm===c.widthMm&&guide.finishedHeightMm===c.heightMm,'Foreign guide dimensions');
  assert(guide.vectorGuide.articleId===c.articleId&&guide.vectorGuide.geometryContractSha256===audit.contract.sha256,'Foreign guide source');
  assert(guide.bleedMm===c.template.bleedMm&&guide.safeAreaMm===c.template.safeMm,'Foreign guide margins');
  const guideEvidence=audit.contract.evidence.filter(e=>e.role==='guide');
  const templateEvidence=audit.contract.evidence.filter(e=>e.role==='template');
  assert(guideEvidence.length===1&&templateEvidence.length===1,'Ambiguous source PDF evidence');
  return {sourceOrder,documentKey:`wmd-size-${signature}`,match:quote.selections,
   supplierIdentity:{articleId:c.articleId,materialId:c.materialId},
   guide:{sourceUrl:guideEvidence[0].sourceUrl,nativeGuideKey:`roll-size-${signature}-da`,nativeGuidePath:guidePath,
    nativeGuideSha256:c.guide.sha256,factsReviewed:true,materialArtworkDocumentationStatus:c.materialArtworkDocumentationStatus,maskExportVerified:false},
   template:{sourceUrl:templateEvidence[0].sourceUrl,sanitizedPdfPath:templatePath,sanitizedPdfSha256:c.template.sha256,
    widthMm:c.widthMm,heightMm:c.heightMm,bleedMm:c.template.bleedMm,safeMm:c.template.safeMm,pageCount:1,legend:c.template.legend,
    metadataRemoved:true,supplierBrandingRemoved:true,artworkMode:'professional_pdf_upload_only',onlineDesignerAllowed:false,
    designerLoadMode:'download_only',lockedInDesigner:false,nonPrintingOverlay:false,excludedFromExport:false,
    designerTemplateId:null,verificationStatus:'not_applicable',hostedBindingVerified:false,
    artworkModeReasonDa:'Skabelonen er forberedt til download. Den almindelige Designer og gemte design afventer præcis binding til egne mål.',
    derivation:{mode:c.template.geometryMode,sourcePagesAreExamples:true,sourceGeometryContractSha256:audit.contract.sha256,
     sourcePdfEvidence:audit.contract.evidence,sourceQuoteSignatures:eligible.filter(e=>rollLabelHash(e.quote.selections)===signature).map(e=>e.c.sourceQuoteSignature)}}};
 });
 const sourceFamily=original.families.find(f=>f.source_category_id===family.sourceFamilyId);
 const manifest={schemaVersion:2,runId:`wmd-roll-${family.sourceFamilyId}-size-document-slice-2026-10-06`,
  source:{supplierSlug:'wir-machen-druck',entryUrl:family.sourceUrl,scopeMode:'single_product_family',allowedHosts:['www.wir-machen-druck.de'],
   extractor:'saved guarded reader; explicit-source-rule regenerated dimensional document slice',capturedAt:rows[0].extractedAt},
  product:{sourceKey:`roll-label-family-${family.sourceFamilyId}-exact-size-document-slice`,family:'labels',nameOriginal:sourceFamily.name_de,
   nameDa:family.name,descriptionOriginal:family.articles.map(a=>a.titleOriginal).join('\n'),descriptionDa:family.description,
   sourceLanguage:'de',targetLanguage:'da',proposedProductId:family.productId},
  optionGroups:axes.map((key,sourceOrder)=>({key,labelOriginal:key,labelDa:key,sourceOrder,displayType:'dropdown',
   values:[...new Set(rows.map(r=>r.selections[key]))].map((value,i)=>({key:value,labelOriginal:value,labelDa:value,sourceOrder:i}))})),
  templateBindingAxes:axes,
  pricing:{supplierCurrency:'EUR',vatState:'excluded',conversionRuleKey:'wmd_roll_labels_threshold_fx_7_6',conversionApproval:'proposed_unapproved',
   recordsArtifact:artifact(dir,'pricing.proposed.jsonl',rows),interpolationAllowed:false,deliveryCountryVerified:false},
  documents:{recordsArtifact:artifact(dir,'documents.jsonl',documents)},
  target:{mode:'supplier_bank',state:'extracted',tenantId:null,writeBank:false,writeProduct:false,writeLivePricing:false,publishProduct:false},
  readiness:{fullFamilyComplete:false,approvedForBankWrite:false,approvedForProductWrite:false,approvedForLivePricing:false,approvedForPublication:false,
   materialSpecificArtworkRequirementsReviewed:false,blockers:['commercial_DKK_and_Denmark_delivery','fresh_tenant_and_bank_collision_readback',
    'authoritative_exact_quote_extension','ordinary_dimension_Designer_and_saved_design_binding','special_mask_export_and_hosted_acceptance','independent_write_approvals']},
  artifacts:{rawSnapshot:'raw-snapshot.json',normalizedPricing:'pricing.proposed.jsonl',reviewReport:'coverage.json'}};
 write(path.join(dir,'raw-snapshot.json'),{sourceExactPricesSha256:sourcePriceSha256,sourceCandidateBindingsSha256:hash(candidateBytes),
  sourceFamilyId:family.sourceFamilyId,sourceQuoteSignatures:eligible.map(e=>e.c.sourceQuoteSignature),
  sourceGeometryContracts:[...new Map(eligible.map(e=>[e.c.profileKey,e.audit])).values()]});
 write(path.join(dir,'import-manifest.json'),manifest);
 const result=spawnSync(process.execPath,[path.join(root,'.agents/skills/import-supplier-product/scripts/validate-import-manifest.mjs'),path.join(dir,'import-manifest.json')],{encoding:'utf8'});
 fs.writeFileSync(path.join(dir,'validation.log'),result.stdout+result.stderr);
 entry.canonicalManifestValidated=result.status===0;entry.status=result.status===0?'extracted_download_document_slice_valid':'blocked_validation';
 entry.documentBindings=documents.length;entry.manifestPath=`${family.sourceFamilyId}/import-manifest.json`;
 entry.manifestSha256=hash(fs.readFileSync(path.join(dir,'import-manifest.json')));registry.push(entry);
}
assert(hash(fs.readFileSync(sourcePricePath))===sourcePriceSha256,'Source price artifact changed during preparation');
const result={schemaVersion:1,databaseWrites:false,sourcePriceArtifactModified:false,sourceExactPricesSha256:sourcePriceSha256,
 fullCatalogueComplete:false,fullCanonicalPackages:false,dimensionSlicesOnly:true,ordinaryDesignerBindingVerified:false,
 families:registry,validSlices:registry.filter(e=>e.canonicalManifestValidated).length,
 validProfiles:registry.filter(e=>e.canonicalManifestValidated).reduce((s,e)=>s+e.eligibleProfiles,0),
 exactPriceRows:registry.reduce((s,e)=>s+e.priceRows,0),documentBindings:registry.reduce((s,e)=>s+e.documentBindings,0),
 excludedMaterialRulePriceRows:registry.reduce((s,e)=>s+e.excludedPriceRows,0)};
write(path.join(out,'registry.json'),result);
console.log(JSON.stringify({...result,families:result.families.length}));
assert(registry.every(e=>!e.priceRows||e.canonicalManifestValidated),'One or more dimensional slices failed validation');

// A read-only union receipt makes all 42 families reviewable without changing
// either package registry or claiming whole-family/commercial readiness.
const fixedRegistry=read(path.join(base,'canonical-manifests/registry.json'));
const combinedProfiles=new Set(),combined=[];
let totalRows=0,totalBindings=0;
const counts={};
for(const family of catalogue.families){
 const fixed=fixedRegistry.families.find(f=>f.familyId===family.sourceFamilyId);
 const sized=registry.find(f=>f.familyId===family.sourceFamilyId);
 const coverage=read(path.join(base,'canonical-manifests',family.sourceFamilyId,'coverage.json'));
 const sizeCoverage=read(path.join(out,family.sourceFamilyId,'coverage.json'));
 const dimensionKeys=new Set(sized.canonicalManifestValidated?sizeCoverage.eligibleProfileKeys:[]);
 const fixedKeys=new Set(fixed?.canonicalManifestValidated?coverage.profiles.filter(p=>p.status==='exact_document_slice_only').map(p=>p.profileKey):[]);
 assert(![...dimensionKeys].some(key=>fixedKeys.has(key)),'Overlapping fixed and dimensional profiles');
 const profiles=coverage.profiles.map(profile=>({...profile,
  status:dimensionKeys.has(profile.profileKey)?'exact_dimension_document_slice_only':profile.status,
  ordinaryDimensionDesignerVerified:false,retailReady:false}));
 for(const profile of profiles){counts[profile.status]=(counts[profile.status]||0)+1;
  if(dimensionKeys.has(profile.profileKey)||fixedKeys.has(profile.profileKey)){
   assert(!combinedProfiles.has(profile.profileKey),'Duplicate family profile');combinedProfiles.add(profile.profileKey);
  }
 }
 const packages=[];
 if(fixed?.canonicalManifestValidated){
  const manifestPath=`canonical-manifests/${fixed.manifestPath}`;
  assert(hash(fs.readFileSync(path.join(base,manifestPath)))===fixed.manifestSha256,'Changed fixed manifest');
  packages.push({kind:'fixed_native_document_slice',manifestPath,manifestSha256:fixed.manifestSha256,
   profiles:fixed.eligibleProfiles,priceRows:fixed.priceRows,documentBindings:fixed.documentBindings});
 }
 if(sized.canonicalManifestValidated)packages.push({kind:'generated_size_download_document_slice',
  manifestPath:`canonical-size-manifests/${sized.manifestPath}`,manifestSha256:sized.manifestSha256,
  profiles:sized.eligibleProfiles,priceRows:sized.priceRows,documentBindings:sized.documentBindings});
 totalRows+=packages.reduce((s,p)=>s+p.priceRows,0);totalBindings+=packages.reduce((s,p)=>s+p.documentBindings,0);
 combined.push({familyId:family.sourceFamilyId,proposedProductId:family.productId,slug:family.slug,name:family.name,
  sourceGroupId:family.sourceGroupId,categoryId:family.categoryId,usageSectionId:family.usageSectionId,
  existingProductToPreserve:family.existingProductToPreserve,profiles,packages,fullFamilyComplete:false,tenantId:null,
  bankWriteApproved:false,productWriteApproved:false,livePricingApproved:false,publicationApproved:false});
}
assert(Object.values(counts).reduce((s,n)=>s+n,0)===2551,'Lost catalogue profiles');
write(path.join(base,'combined-document-review-008.json'),{schemaVersion:1,sourceExactPricesSha256:sourcePriceSha256,
 sourceCatalogueSha256:catalogue.sourceSha256,families:combined,totalFamilies:42,totalArticles:472,totalProfiles:2551,
 structuralDocumentSliceProfiles:combinedProfiles.size,exactPriceRowsInSlices:totalRows,documentBindingsInSlices:totalBindings,
 familiesWithDocumentSlices:combined.filter(f=>f.packages.length).length,coverage:counts,
 databaseWrites:false,fullCatalogueComplete:false,fullFamilyPackages:false,tenantResolved:false,
 preservedPilotBankId:fixedRegistry.preservedPilotBankId,preservedFreeSizeProductId:fixedRegistry.preservedFreeSizeProductId,
 directoryWideUploadAllowed:false,retailReady:false});
console.log(JSON.stringify({combinedStructuralProfiles:combinedProfiles.size,totalRows,totalBindings,
 familiesWithDocumentSlices:combined.filter(f=>f.packages.length).length,coverage:counts,fullCatalogueComplete:false}));
