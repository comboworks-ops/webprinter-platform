#!/usr/bin/env node
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { allocateBrochureProductPlan, inspectBrochureDocumentResolution, resolveBrochureFreeRegistry } from './shared/brochure-product-plan.js';

const root = path.resolve('output/brochure-2026-10-06/review/complete');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'import-manifest.json')));
const target = JSON.parse(await fs.readFile(path.join(root, 'target-preflight.json')));
if (target.databaseWrites !== false || target.exactCollisions?.length !== 0) throw Error('Read-only, collision-free draft target required');
const output = path.join(root, 'product-resolution-plan.json');
try { await fs.access(path.join(root, 'product-draft-receipt.json')); throw Error('A product write receipt exists; preserve its allocated plan'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
let previous;
try { previous = JSON.parse(await fs.readFile(output)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
let remainingIds;
if (previous) {
  if (previous.databaseWrites !== false || previous.proposedIdsOnly !== true || previous.runId !== manifest.runId
    || previous.tenantId !== target.tenantId || previous.sourcePricingArtifact.sha256 !== manifest.pricing.recordsArtifact.sha256
    || previous.sourceDocumentArtifact.sha256 !== manifest.documents.recordsArtifact.sha256) throw Error('Previous resolution plan belongs to another packet; preserve it');
  remainingIds = previous.productGroups.flatMap(group => [group.id, ...previous.productValues.filter(value => value.group_id === group.id).map(value => value.id)]);
  remainingIds.push(...previous.documents.templates.map(template => template.proposedDesignerTemplateId));
}
const plan = allocateBrochureProductPlan(manifest, { tenantId: target.tenantId,
  ...(previous ? { productId: previous.proposedProductId, idFactory: () => remainingIds.shift() } : {}) });
// The shared renderer starts from configured native quantities and then hides
// unavailable cells. An empty list would make every fixed matrix disappear.
const priceArtifact=manifest.pricing.recordsArtifact,priceInput=createReadStream(path.resolve(root,priceArtifact.path));
const priceHash=crypto.createHash('sha256'),quantities=new Set();let priceBytes=0,priceCount=0;
priceInput.on('data',chunk=>{priceBytes+=chunk.length;priceHash.update(chunk);});
for await(const line of readline.createInterface({input:priceInput,crlfDelay:Infinity})){
  const row=JSON.parse(line);
  if(row.sourceOrder!==priceCount++ || !Number.isSafeInteger(row.quantity) || row.quantity<1 || row.quantity>10000)throw Error('Invalid native quantity/source order');
  quantities.add(row.quantity);
}
if(priceBytes!==priceArtifact.bytes || priceCount!==priceArtifact.rowCount || priceHash.digest('hex')!==priceArtifact.sha256)throw Error('Reviewed quantity artifact changed');
plan.pricingStructure.quantities=[...quantities].sort((a,b)=>a-b);
const artifact = manifest.documents.recordsArtifact;
const filename = path.resolve(root, artifact.path);
if (!filename.startsWith(root + path.sep)) throw Error('Document artifact escapes packet');
const input = createReadStream(filename), hash = crypto.createHash('sha256');
let bytes = 0;
input.on('data', chunk => { bytes += chunk.length; hash.update(chunk); });
async function* bindings() {
  for await (const line of readline.createInterface({ input, crlfDelay: Infinity })) {
    if (!line.trim()) throw Error('Blank document binding');
    yield JSON.parse(line);
  }
}
const documents = await inspectBrochureDocumentResolution(plan, bindings(), artifact.rowCount);
if (bytes !== artifact.bytes || hash.digest('hex') !== artifact.sha256) throw Error('Reviewed document artifact changed');
const registry = JSON.parse(await fs.readFile('api/_data/brochure-free-articles.json'));
const freeSize = resolveBrochureFreeRegistry(plan, registry);
plan.pricingStructure.brochureFreeSize = freeSize;
for (const row of plan.pricingStructure.layout_rows) {
  for (const column of row.columns) column.hideUnavailableValues = true;
}
plan.pricingStructure.brochureCompatibility.selections.push(...freeSize.articles.map(article => ({
  [plan.axisSections.orientation]: freeSize.orientationValueId,
  [plan.axisSections.format]: freeSize.formatValueId,
  [plan.axisSections.pageCount]: article.pageCountValueId,
  [plan.axisSections.cover]: freeSize.neutralSelectionIds.cover,
  [plan.axisSections.varnish]: freeSize.neutralSelectionIds.varnish,
})));
if (remainingIds?.length) throw Error('Previous resolution IDs no longer match; preserve the existing plan');
const catalogs = [...plan.catalogs.values()];
const report = { version: 1, runId: manifest.runId, state: 'local_resolution_plan', databaseWrites: false,
  proposedIdsOnly: true, tenantId: plan.tenantId, proposedProductId: plan.productId,
  sourcePricingArtifact: manifest.pricing.recordsArtifact, sourceDocumentArtifact: artifact,
  productGroups: catalogs.map(value => value.group), productValues: catalogs.flatMap(value => value.values),
  pricingStructure: plan.pricingStructure, documents, freeSize,
  remainingApplyRequirements: [
    'Human Supplier Bank draft write approval and verified bank receipt',
    'Verify native free-size UI/server on the persisted draft product; edge deployment requires publishing approval',
    'Refresh exact target collisions, then insert only the new unpublished product and its allocated definitions',
    'Upload immutable verified templates; proposed template IDs become created only after persisted readback',
    'Apply the tested insert-only brochure product/template writer; never call destructive price replacement',
    'Record actual template IDs against all exact manifest bindings and validate the post-write manifest',
    'Verify actual product storefront/editor/account save/checkout return'
  ] };
await fs.writeFile(output + '.tmp', JSON.stringify(report, null, 2) + '\n');
await fs.rename(output + '.tmp', output);
console.log(JSON.stringify({ databaseWrites: false, proposedIdsOnly: true, groups: report.productGroups.length,
  values: report.productValues.length, exactConfigurations: documents.exactConfigurationCount,
  selectorCombinations: documents.uniqueSelectorCombinations, fixedTemplates: documents.templates.length,
  freeArticles: freeSize.articles.length, freePaperMappings: freeSize.articles.reduce((sum, article) => sum + article.materials.length, 0) }, null, 2));
