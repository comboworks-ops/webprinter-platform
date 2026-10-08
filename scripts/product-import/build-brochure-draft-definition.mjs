#!/usr/bin/env node
import fs from 'node:fs/promises';
import {brochureMatrixAdapter} from './shared/brochure-matrix.js';
const root='output/brochure-2026-10-06/review/complete';
const manifest=JSON.parse(await fs.readFile(`${root}/import-manifest.json`));
const adapter=brochureMatrixAdapter(manifest);
let preflight=null;
try {preflight=JSON.parse(await fs.readFile(`${root}/target-preflight.json`));}
catch(error){if(error.code!=='ENOENT')throw error;}
if(preflight&&(preflight.databaseWrites!==false||preflight.exactCollisions?.length!==0||!/^[a-f0-9-]{36}$/i.test(preflight.tenantId)))throw Error('Invalid read-only brochure target preflight');
const definition={version:1,target:{tenantId:null,productId:null,slug:'brochurer-med-traadhaeftning',state:'product_draft',productImportRequestedInChat:true,supplierBankWriteApprovalPending:true},productUpdate:{name:manifest.product.nameDa,description:manifest.product.descriptionDa,is_published:false,is_available_to_tenants:false,is_ready:false,technical_specs:{supplierProductKey:manifest.product.sourceKey,site_modes:{designer_mode:'brochure',pricing_model:'matrix'},brochure:{binding:'classic_wire',colour:'full_colour_duplex',bleedMm:3,safeMm:3,sourceRun:manifest.runId,freeSize:{quoteEndpoint:'/api/brochure-quote',minWidthMm:98,maxWidthMm:297,minHeightMm:98,maxHeightMm:297,stepMm:0.1}}}},matrixConfig:adapter.matrixConfig,pricingArtifact:manifest.pricing.recordsArtifact,documentBindingsArtifact:manifest.documents.recordsArtifact,existingPublisher:'scripts/product-import/shared/matrix-publisher.js',sourceAdapter:'scripts/product-import/shared/brochure-matrix.js',requirements:['Resolve tenant and check exact slug collisions before any write','Create a new unpublished product; never replace existing live prices','Resolve attribute IDs and write typed brochurePageCount metadata','Bind all document matches to the 19 source-verified format templates and record actual designerTemplateId values','Use an exact compatibility index and per-selection price queries for this large matrix','Deploy the verified native free-size quote server with publishing approval; keep exact dimension quotes separate from fixed rows','Verify account save/reopen and checkout return using the actual draft product','Validate the post-write manifest; retain price and template hashes']};
definition.resolutionPlanArtifact='product-resolution-plan.json';
definition.target.tenantId=preflight?.tenantId??null;
definition.target.preflightArtifact=preflight?'target-preflight.json':null;
definition.requirements[0]='Refresh tenant-scoped exact slug collisions immediately before any write';
await fs.writeFile(`${root}/product-draft-definition.json`,JSON.stringify(definition,null,2));
console.log({sourcePaperIds:manifest.optionGroups.find(g=>g.key==='paperCover').values.length,uniquePaperRows:adapter.matrixConfig.verticalAxis.valueSpecs.length,selectorGroups:adapter.matrixConfig.sections.length,databaseWrites:false});
