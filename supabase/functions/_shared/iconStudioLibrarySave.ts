import { STUDIO_UUID } from './iconStudioRecipe.ts';
import { parseStudioPayload, type StudioPayload } from './iconStudioValidation.ts';
import { productLibraryConstruction, type LibraryReference } from './iconStudioProductLibrary.ts';

export class LibrarySaveError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export interface LibraryOutput {
  id:string; tenant_id:string; job_id:string; status:string; storage_path:string; mime_type:string; width_px:number; height_px:number;
}
export interface LibraryJob { id:string; tenant_id:string; status:string; provider_key:string; payload:unknown }
export interface SavedLibraryRow extends LibraryReference {
  name:string; style_key:string; variant_key:string; finish_key:null; usage_tags:string[]; priority:number;
  file_name:string; file_size_bytes:number; is_active:false; created_by:string;
}
export interface LibrarySaveStore {
  getOutput(id:string,tenant:string):Promise<LibraryOutput|null>;
  getJob(id:string,tenant:string):Promise<LibraryJob|null>;
  getReference(id:string,tenant:string):Promise<LibraryReference|null>;
  getSaved(id:string,tenant:string):Promise<LibraryReference|null>;
  download(path:string):Promise<Blob|null>;
  uploadNew(path:string,file:Blob):Promise<boolean>;
  insertNew(row:SavedLibraryRow):Promise<boolean>;
}

export function validateLibraryOutput(output:LibraryOutput,job:LibraryJob,tenantId:string):StudioPayload {
  if (output.tenant_id!==tenantId || job.tenant_id!==tenantId || output.job_id!==job.id
    || !STUDIO_UUID.test(output.id) || !STUDIO_UUID.test(job.id)
    || !['active','approved'].includes(output.status) || !['ready_for_review','approved'].includes(job.status)
    || !['openai-image-v1','gemini-image-v1'].includes(job.provider_key)
    || output.mime_type!=='image/png' || output.storage_path!==`tenant/${tenantId}/jobs/${job.id}/${output.id}.png`
    || ![512,1024,1536,2048].includes(output.width_px) || output.height_px!==output.width_px) {
    throw new LibrarySaveError('Vælg et færdigt AI-billede fra denne shop.');
  }
  return parseStudioPayload(job.payload,tenantId);
}

function sameSavedOrigin(asset:LibraryReference|null,output:LibraryOutput,job:LibraryJob,tenant:string) {
  if (!asset) return false;
  const origin=asset.metadata.generatedFrom as Record<string,unknown>|undefined;
  if (asset.id!==output.id || asset.tenant_id!==tenant || origin?.outputId!==output.id || origin?.jobId!==job.id) {
    throw new LibrarySaveError('Billedets biblioteksplads bruges allerede. Originalerne er bevaret.',409);
  }
  productLibraryConstruction(asset,tenant,asset.product_key);
  return true;
}

async function sha256(file:Blob) {
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()));
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}

/** Caller must first authorize the user for this tenant and the Icon Studio module. */
export async function saveStudioOutputToLibrary(store:LibrarySaveStore,tenantId:string,actorId:string,input:{outputId:unknown;name:unknown}) {
  if (!STUDIO_UUID.test(tenantId) || !STUDIO_UUID.test(actorId) || typeof input.outputId!=='string' || !STUDIO_UUID.test(input.outputId)
    || typeof input.name!=='string' || !input.name.trim() || input.name.trim().length>120 || Array.from(input.name).some(c=>c.charCodeAt(0)<32 || c.charCodeAt(0)===127)) {
    throw new LibrarySaveError('Giv billedet et navn på højst 120 tegn.');
  }
  const output=await store.getOutput(input.outputId,tenantId);
  if (!output) throw new LibrarySaveError('Billedet findes ikke i denne shop.',404);
  const job=await store.getJob(output.job_id,tenantId);
  if (!job) throw new LibrarySaveError('Billedopgaven findes ikke i denne shop.',404);
  const payload=validateLibraryOutput(output,job,tenantId);
  if (sameSavedOrigin(await store.getSaved(output.id,tenantId),output,job,tenantId)) return {assetId:output.id,alreadySaved:true};

  const sourceId=payload.recipe?.libraryReferenceId || null;
  const source=sourceId ? await store.getReference(sourceId,tenantId) : null;
  if (sourceId && !source) throw new LibrarySaveError('Kildereferencen mangler. Originalbilledet er bevaret.');
  if (source) productLibraryConstruction(source,tenantId,payload.productKey);
  const file=await store.download(output.storage_path);
  if (!file || file.size<33 || file.size>10*1024*1024) throw new LibrarySaveError('Billedfilen kunne ikke hentes.',502);
  const header=new Uint8Array(await file.slice(0,33).arrayBuffer());
  const view=new DataView(header.buffer);
  if (![137,80,78,71,13,10,26,10].every((value,index)=>header[index]===value)
    || view.getUint32(8)!==13 || String.fromCharCode(...header.slice(12,16))!=='IHDR'
    || view.getUint32(16)!==output.width_px || view.getUint32(20)!==output.height_px) throw new LibrarySaveError('Billedfilen matcher ikke det gemte PNG-resultat.');
  const hash=await sha256(file);
  const metadata:Record<string,unknown>={
    productImageLibrary:true,canvasWidth:output.width_px,canvasHeight:output.height_px,sha256:hash,
    generatedFrom:{version:1,outputId:output.id,jobId:job.id,referenceId:sourceId,
      rootReferenceId:(source?.metadata.generatedFrom as Record<string,unknown>|undefined)?.rootReferenceId || sourceId,
      styleId:payload.recipe?.styleId || null,viewId:payload.recipe?.viewId || null,palette:payload.recipe?.palette || null},
    referenceReview:{version:1,purpose:'construction',rights:'owned',reviewed:true,license:'',
      source:'Saved from Product Pictures by the shop administrator',construction:`Generated ${payload.productKey}`,styleId:null,viewId:null},
  };
  if (source?.metadata.formatKey) for (const key of ['formatKey','formatLabel','foldKey','orientationKey','widthMm','heightMm']) metadata[key]=source.metadata[key];
  const path=`tenant/${tenantId}/references/generated/${output.id}.png`;
  const row:SavedLibraryRow={id:output.id,tenant_id:tenantId,name:input.name.trim(),product_key:payload.productKey,
    style_key:payload.styleKey,variant_key:payload.variantKey,finish_key:null,usage_tags:['generated-library'],priority:0,
    storage_path:path,file_name:`${payload.productKey}-${output.id}.png`,mime_type:'image/png',file_size_bytes:file.size,
    is_active:false,metadata,created_by:actorId};
  // Validate the flattened construction snapshot before any write.
  productLibraryConstruction(row,tenantId,payload.productKey);
  if (!await store.uploadNew(path,file)) {
    const existing=await store.download(path);
    if (!existing || await sha256(existing)!==hash) throw new LibrarySaveError('Bibliotekskopien kunne ikke gemmes. Prøv igen; originalen er bevaret.',409);
  }
  if (!await store.insertNew(row)) {
    if (sameSavedOrigin(await store.getSaved(output.id,tenantId),output,job,tenantId)) return {assetId:output.id,alreadySaved:true};
    throw new LibrarySaveError('Billedet kunne ikke føjes til biblioteket. Prøv igen; originalen er bevaret.',502);
  }
  return {assetId:output.id,alreadySaved:false};
}

