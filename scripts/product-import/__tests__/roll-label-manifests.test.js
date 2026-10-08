import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
const root=new URL('../../../output/supplier-imports/roll-labels-catalogue-2026-10-06/canonical-manifests/',import.meta.url);
const json=url=>JSON.parse(fs.readFileSync(url));const lines=url=>fs.readFileSync(url,'utf8').trim().split('\n').map(JSON.parse);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('canonical document slices preserve full quote identity, actual PDF bytes and every write gate',()=>{
 const registry=json(new URL('registry.json',root));assert.equal(registry.families.length,42);assert.equal(registry.databaseWrites,false);
 const slices=registry.families.filter(f=>f.canonicalManifestValidated);assert.deepEqual(slices.map(f=>f.familyId).sort(),['23954','29554','30908']);
 assert.equal(slices.reduce((s,f)=>s+f.eligibleProfiles,0),500);
 for(const family of slices){
  const dir=new URL(family.familyId+'/',root),manifest=json(new URL('import-manifest.json',dir));
  assert.equal(manifest.source.supplierSlug,'wir-machen-druck');assert.equal(manifest.target.state,'extracted');assert.equal(manifest.target.tenantId,null);
  for(const key of ['writeBank','writeProduct','writeLivePricing','publishProduct'])assert.equal(manifest.target[key],false);
  assert.equal(manifest.readiness.fullFamilyComplete,false);assert.equal(manifest.pricing.conversionApproval,'proposed_unapproved');
  const documents=lines(new URL(manifest.documents.recordsArtifact.path,dir)),prices=lines(new URL(manifest.pricing.recordsArtifact.path,dir));
  for(const descriptor of [manifest.documents.recordsArtifact,manifest.pricing.recordsArtifact]){
   const bytes=fs.readFileSync(new URL(descriptor.path,dir));assert.equal(bytes.length,descriptor.bytes);assert.equal(sha(bytes),descriptor.sha256);
  }
  for(const row of prices){
   assert.ok(!['55058:1006957','55062:1007041','55070:1007209'].includes(row.sourceKey));
   assert.equal(documents.filter(d=>JSON.stringify(d.match)===JSON.stringify(row.selections)).length,1);
  }
  for(const document of documents){
   assert.equal(sha(fs.readFileSync(new URL(document.template.sanitizedPdfPath,dir))),document.template.sanitizedPdfSha256);
   assert.equal(document.template.designerTemplateId,null);assert.equal(document.template.verificationStatus,'pending');
   assert.ok(document.guide.nativeGuidePath.includes(document.supplierIdentity.materialId));
   assert.equal(document.guide.maskExportVerified,false);
   assert.notEqual(document.guide.materialArtworkDocumentationStatus,'source_instructions_pending');
   assert.ok(prices.some(r=>JSON.stringify(r.selections)===JSON.stringify(document.match)));
  }
 }
 assert.equal(registry.families.find(f=>f.familyId==='20649').canonicalManifestValidated,false);
 const wetCoverage=json(new URL('23954/coverage.json',root));
 assert.equal(wetCoverage.profiles.filter(p=>p.status==='quarantined').length,110);
 const wetDocuments=lines(new URL('23954/documents.jsonl',root));
 for(const document of wetDocuments) {
   assert.equal(document.template.bleedMm,2);assert.equal(document.template.safeMm,2);
   assert.ok(!wetCoverage.profiles.find(p=>p.profileKey===`${document.supplierIdentity.articleId}:${document.supplierIdentity.materialId}`).blockers.length);
 }
 const standardCoverage=json(new URL('29554/coverage.json',root));
 assert.equal(standardCoverage.profiles.filter(p=>p.status==='exact_mask_instructions_pending').length,100);
 assert.equal(registry.preservedFreeSizeProductId,'f4d530bd-d80a-4cd7-8745-8e5431a18fe4');
 assert.equal(registry.preservedPilotBankId,'01cb1547-2e63-40cf-9d8f-de50b2aa627d');
});
