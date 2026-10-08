import crypto from 'node:crypto';
import { brochureChecksum, assertBrochureBankReadback } from './brochure-bank-draft.js';

const assert = (ok, message) => { if (!ok) throw Error(message); };
export const BROCHURE_SLUG = 'brochurer-med-traadhaeftning';
export const BROCHURE_PRICE_BATCH = 200; // Keep persisted UUID readback URLs below proxy limits.
export const BROCHURE_PRICE_CONCURRENCY = 8;
export function brochurePriceId(productId, sourceOrder) {
  assert(Number.isSafeInteger(sourceOrder) && sourceOrder >= 0, 'Invalid brochure price order');
  const hex = crypto.createHash('sha256').update(`brochure-price-v1:${productId}:${sourceOrder}`).digest('hex').slice(0, 32);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20)}`;
}
export function assertBrochureProductPacket(manifest, plan, bank) {
  assert(manifest.product?.sourceKey === 'wmd-saddle-stitched-brochures-9434'
    && manifest.target?.publishProduct === false && manifest.target?.writeLivePricing === false
    && ['bank_draft','product_draft'].includes(manifest.target?.state), 'Verified unpublished brochure bank packet required');
  assert(bank?.status === 'verified_bank_draft' && bank.runId === manifest.runId
    && bank.packageChecksum === manifest.target.bankDraft?.packageChecksum
    && bank.ids?.bankProductId === manifest.target.bankDraft?.bankProductId
    && bank.ids?.priceSnapshotId === manifest.target.bankDraft?.priceSnapshotId, 'Verified bank receipt required');
  assert(plan.databaseWrites === false && plan.proposedIdsOnly === true && plan.runId === manifest.runId
    && plan.tenantId === '00000000-0000-0000-0000-000000000000'
    && plan.sourcePricingArtifact.sha256 === manifest.pricing.recordsArtifact.sha256
    && plan.documents.exactConfigurationCount === manifest.documents.recordsArtifact.rowCount
    && plan.productGroups.length === 6 && plan.documents.templates.length === 19
    && plan.freeSize?.articles.length === 29 && plan.pricingStructure.templateBinding?.profile === 'brochure_v1',
  'Product resolution plan does not match reviewed source packet');
  if(manifest.target.state==='bank_draft')assert(plan.sourceDocumentArtifact.sha256===manifest.documents.recordsArtifact.sha256,
    'Reviewed document packet changed before product insertion');
  const ids = [plan.proposedProductId, ...plan.productGroups.map(row=>row.id), ...plan.productValues.map(row=>row.id),
    ...plan.documents.templates.map(row=>row.proposedDesignerTemplateId)];
  assert(ids.every(id=>/^[a-f0-9-]{36}$/i.test(id)) && new Set(ids).size === ids.length, 'Invalid or duplicate allocated product identities');
  assert([...plan.productGroups,...plan.productValues].every(row=>row.tenant_id===plan.tenantId && row.product_id===plan.proposedProductId), 'Foreign catalogue target');
}
export function buildBrochureProductPayloads({manifest, plan, bank, assets, receipt}) {
  assertBrochureProductPacket(manifest,plan,bank);
  assert(assets.length===19 && receipt.productId===plan.proposedProductId, 'Verified assets and owned receipt required');
  const templateFiles = plan.documents.templates.map((template,index) => {
    const asset = assets[index], c = template.contract;
    assert(asset.sha256===c.templatePdfSha256 && asset.url && asset.objectPath, 'Unverified template asset');
    return {name:`Brochure ${c.widthMm} × ${c.heightMm} mm`,url:asset.url,pdfUrl:asset.url,path:asset.objectPath,
      selectionConstraints:template.selectionConstraints,selectionConstraintProfile:'brochure_v1',
      selectionConstraintSections:plan.pricingStructure.templateBinding.axisSections,
      designerTemplateId:template.proposedDesignerTemplateId,designerLoadMode:'locked_non_printing_guide_overlay',
      lockedInDesigner:true,nonPrintingOverlay:true,excludedFromExport:true,artworkMode:'online_designer',
      templatePdfSha256:c.templatePdfSha256,widthMm:c.widthMm,heightMm:c.heightMm,bleedMm:3,safeMm:3,pageCount:1,
      nativeGuideSourceUrl:c.nativeGuideSourceUrl,sourceUrl:c.sourceUrl,uploadedAt:receipt.createdAt};
  });
  const product = {id:plan.proposedProductId,tenant_id:plan.tenantId,slug:BROCHURE_SLUG,name:manifest.product.nameDa,
    description:manifest.product.descriptionDa,category:'tryksager',pricing_type:'matrix',pricing_structure:plan.pricingStructure,
    is_published:false,is_available_to_tenants:false,is_ready:false,preset_key:'custom',icon_text:manifest.product.nameDa,
    default_quantity:1,template_files:templateFiles,technical_specs:{source:'supplier-bank',supplierProductKey:manifest.product.sourceKey,
      supplierBankProductId:bank.ids.bankProductId,supplierBankPriceSnapshotId:bank.ids.priceSnapshotId,importRunId:manifest.runId,
      priceArtifactSha256:manifest.pricing.recordsArtifact.sha256,documentArtifactSha256:plan.sourceDocumentArtifact.sha256,
      importPlanChecksum:receipt.planChecksum,site_modes:{designer_mode:'brochure',pricing_model:'matrix'},
      brochure:{binding:'classic_wire',colour:'full_colour_duplex',bleedMm:3,safeMm:3,sourceRun:manifest.runId,freeSize:plan.freeSize},
      templateBindingProfile:'brochure_v1',sparseCompatibilityRequired:true,interpolationAllowed:false}};
  const templates = plan.documents.templates.map((template,index) => {const c=template.contract;return {
    id:template.proposedDesignerTemplateId,tenant_id:plan.tenantId,name:`Brochure ${c.widthMm} × ${c.heightMm} mm`,
    description:'Leverandørneutral trykskabelon med låste hjælpelinjer.',template_type:'format',category:'Brochurer',
    width_mm:c.widthMm,height_mm:c.heightMm,bleed_mm:3,safe_area_mm:3,dpi_default:300,
    template_pdf_url:assets[index].url,is_public:false,is_active:true,library_kind:'blank',source_kind:'native',
    tags:['brochure',BROCHURE_SLUG,c.templatePdfSha256],sort_order:index};});
  return {product,templates,templateFiles};
}
async function queryOne(client,table,id) {
  const {data,error}=await client.from(table).select('*').eq('id',id).maybeSingle();
  if(error)throw Error(`${table} read: ${error.message}`);return data;
}
/** All resumed rows must exactly match the recorded payload. This never
 * updates, deletes or upserts; response loss is resolved by persisted IDs. */
export async function ensureBrochureRows(client,table,rows) {
  assert(rows.length>0 && rows.length<=BROCHURE_PRICE_BATCH,'Invalid insert batch');
  const ids=rows.map(row=>row.id);assert(new Set(ids).size===ids.length,'Duplicate batch IDs');
  const read=async()=>{const result=await client.from(table).select('*').in('id',ids);if(result.error)throw Error(`${table} readback: ${result.error.message}`);return result.data||[];};
  const existing=await read(), expected=new Map(rows.map(row=>[row.id,row]));
  for(const actual of existing){assert(expected.has(actual.id),'Unexpected persisted identity');assertBrochureBankReadback(actual,expected.get(actual.id),table);}
  const present=new Set(existing.map(row=>row.id)),missing=rows.filter(row=>!present.has(row.id));
  if(missing.length){const result=await client.from(table).insert(missing);if(result.error)throw Error(`${table} insert: ${result.error.message}`);}
  const persisted=await read();assert(persisted.length===rows.length,`${table} persisted count mismatch`);
  for(const row of persisted)assertBrochureBankReadback(row,expected.get(row.id),table);
}
export async function brochureProductRemotePreflight(client,plan,bank,receipt=null) {
  const {data,error}=await client.from('products').select('*').eq('tenant_id',plan.tenantId).eq('slug',BROCHURE_SLUG);
  if(error)throw Error(`Brochure collision read: ${error.message}`);
  assert((data||[]).every(row=>receipt && row.id===receipt.productId),'Existing brochure slug collision; no overwrite permitted');
  const owned=await queryOne(client,'products',plan.proposedProductId);
  if(owned)assert(receipt && owned.tenant_id===plan.tenantId && owned.slug===BROCHURE_SLUG
    && owned.is_published===false && owned.is_ready===false && owned.is_available_to_tenants===false
    && owned.technical_specs?.importPlanChecksum===receipt.planChecksum,'Product is foreign, changed or already published');
  const supplier=await queryOne(client,'supplier_bank_products',bank.ids.bankProductId);
  const snapshot=await queryOne(client,'supplier_bank_price_snapshots',bank.ids.priceSnapshotId);
  assert(supplier?.status==='draft' && supplier.source_hash===bank.packageChecksum
    && supplier.supplier_product_key==='wmd-saddle-stitched-brochures-9434'
    && snapshot?.bank_product_id===supplier.id && snapshot.checksum===plan.sourcePricingArtifact.sha256,
  'Persisted Supplier Bank receipt changed');
  // Reserve the complete allocated identity set before any row or asset write.
  for(const [table,expected] of [['product_attribute_groups',plan.productGroups],['product_attribute_values',plan.productValues]]){
    for(let offset=0;offset<expected.length;offset+=BROCHURE_PRICE_BATCH){
      const rows=expected.slice(offset,offset+BROCHURE_PRICE_BATCH),byId=new Map(rows.map(row=>[row.id,row]));
      const result=await client.from(table).select('*').in('id',rows.map(row=>row.id));
      if(result.error)throw Error(`${table} identity preflight: ${result.error.message}`);
      for(const actual of result.data||[]){assert(receipt,'Allocated catalogue ID collision');assertBrochureBankReadback(actual,byId.get(actual.id),table);}
    }
  }
  const templateIds=plan.documents.templates.map(row=>row.proposedDesignerTemplateId);
  const templates=await client.from('designer_templates').select('*').in('id',templateIds);
  if(templates.error)throw Error(`Template identity preflight: ${templates.error.message}`);
  for(const row of templates.data||[]){
    const expected=plan.documents.templates.find(value=>value.proposedDesignerTemplateId===row.id);
    assert(receipt && row.tenant_id===plan.tenantId && row.is_public===false && row.is_active===true
      && row.width_mm===expected.contract.widthMm && row.height_mm===expected.contract.heightMm
      && row.tags?.includes(expected.contract.templatePdfSha256) && row.tags?.includes(BROCHURE_SLUG),'Allocated template ID collision');
  }
  return {collisionCount:(data||[]).length,ownedProductExists:Boolean(owned),bankVerified:true,databaseWrites:false};
}
export async function countBrochureOwned(client,table,plan,expected,managementCount) {
  const result=await client.from(table).select('id',{count:'exact',head:true}).eq('tenant_id',plan.tenantId).eq('product_id',plan.proposedProductId);
  let count=result.count;
  if(result.error||!Number.isSafeInteger(count)){
    if(!managementCount)throw Error(`${table} count: ${result.error?.message||`HTTP ${result.status||'unknown'}`}`);
    count=await managementCount(table,plan);
  }
  assert(count===expected,`${table} contains unexpected or missing owned rows`);
  return count;
}
/** Persist the entire window's intent before starting independent batches.
 * Wait for every request to settle before advancing or reporting failure:
 * an unknown commit can then be reconciled by the same deterministic IDs. */
export async function ensureBrochurePriceWindow({client,rows,startOrder,receipt,saveReceipt}) {
  assert(rows.length>0 && rows.length<=BROCHURE_PRICE_BATCH*BROCHURE_PRICE_CONCURRENCY,'Invalid price window');
  const endOrder=startOrder+rows.length;
  receipt.pendingStep=`prices:${startOrder}-${endOrder}`;
  receipt.pendingPriceBatches=[];
  const batches=[];
  for(let offset=0;offset<rows.length;offset+=BROCHURE_PRICE_BATCH){
    batches.push(rows.slice(offset,offset+BROCHURE_PRICE_BATCH));
    receipt.pendingPriceBatches.push({startOrder:startOrder+offset,endOrder:startOrder+Math.min(offset+BROCHURE_PRICE_BATCH,rows.length)});
  }
  await saveReceipt(receipt);
  const results=await Promise.allSettled(batches.map(batch=>ensureBrochureRows(client,'generic_product_prices',batch)));
  const failures=results.filter(result=>result.status==='rejected');
  if(failures.length)throw failures[0].reason;
  receipt.verifiedPriceRows=endOrder;receipt.pendingStep=null;receipt.pendingPriceBatches=[];
  await saveReceipt(receipt);
}
export async function applyBrochureProductDraft({client,manifest,plan,bank,receipt,saveReceipt,assets,priceRows,onProgress=()=>{},managementCount}) {
  assertBrochureProductPacket(manifest,plan,bank);
  assert(receipt.planChecksum===brochureChecksum(plan) && receipt.productId===plan.proposedProductId
    && receipt.bankProductId===bank.ids.bankProductId,'Product receipt belongs to another packet');
  await brochureProductRemotePreflight(client,plan,bank,receipt);
  const payloads=buildBrochureProductPayloads({manifest,plan,bank,assets,receipt});
  const persist=async(step,table,rows)=>{
    receipt.pendingStep=step;await saveReceipt(receipt);
    for(let offset=0;offset<rows.length;offset+=BROCHURE_PRICE_BATCH)await ensureBrochureRows(client,table,rows.slice(offset,offset+BROCHURE_PRICE_BATCH));
    receipt.pendingStep=null;receipt.completedSteps=[...new Set([...receipt.completedSteps,step])];await saveReceipt(receipt);
  };
  await persist('templates','designer_templates',payloads.templates);
  await persist('product','products',[payloads.product]);
  await persist('groups','product_attribute_groups',plan.productGroups);
  await persist('values','product_attribute_values',plan.productValues);
  let batch=[],order=0;
  const flush=async()=>{if(!batch.length)return;
    await ensureBrochurePriceWindow({client,rows:batch,startOrder:order-batch.length,receipt,saveReceipt});
    onProgress({verifiedPriceRows:order,totalPriceRows:plan.sourcePricingArtifact.rowCount});batch=[];};
  for await(const record of priceRows){
    assert(record.sourceOrder===order && record.product_id===plan.proposedProductId && record.tenant_id===plan.tenantId
      && record.quantity>=1 && record.quantity<=10000 && Number.isSafeInteger(record.price_dkk) && record.price_dkk>0,
    'Invalid or out-of-order source price stream');
    const {sourceOrder,...row}=record;
    assert(row.id===brochurePriceId(plan.proposedProductId,order),'Price identity does not match source order');
    batch.push(row);order++;if(batch.length===BROCHURE_PRICE_BATCH*BROCHURE_PRICE_CONCURRENCY)await flush();
  }
  await flush();assert(order===plan.sourcePricingArtifact.rowCount,'Source price count mismatch');
  await countBrochureOwned(client,'generic_product_prices',plan,order,managementCount);
  await countBrochureOwned(client,'product_attribute_groups',plan,plan.productGroups.length,managementCount);
  await countBrochureOwned(client,'product_attribute_values',plan,plan.productValues.length,managementCount);
  await ensureBrochureRows(client,'products',[payloads.product]);
  await persist('import-job','supplier_bank_import_jobs',[{id:receipt.importJobId,bank_product_id:bank.ids.bankProductId,
    target_tenant_id:plan.tenantId,target_product_id:plan.proposedProductId,import_mode:'matrix_layout_v1',status:'imported',
    import_summary:{runId:manifest.runId,unpublished:true,priceRows:order,documentBindings:plan.documents.exactConfigurationCount,
      templateCount:19,priceArtifactSha256:plan.sourcePricingArtifact.sha256,planChecksum:receipt.planChecksum},
    rollback_note:'Insert-only brochure draft. Preserve receipts; any separately approved cleanup may touch only these new recorded IDs and immutable objects. Never delete a reused bank supplier or another product.'}]);
  receipt.status='verified_product_draft';receipt.verifiedAt=new Date().toISOString();receipt.pendingStep=null;
  receipt.actualDesignerTemplateIds=Object.fromEntries(plan.documents.templates.map(row=>[row.contract.formatSourceKey,row.proposedDesignerTemplateId]));
  receipt.approvalBoundary={unpublishedProductWritten:true,existingProductChanged:false,existingPricesChanged:false,productPublished:false};
  await saveReceipt(receipt);return receipt;
}
