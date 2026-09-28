import {standardUpload} from '../storage/standardUpload.ts';
import type {SupabaseClient} from '@supabase/supabase-js';
import {hashCheckoutArtifact} from './checkoutArtifact.ts';
import {resumableUpload, type FileTransferProgress} from '../storage/resumableUpload.ts';

const PRIVATE_PATH = /^checkout-uploads\/([a-f0-9-]{36})\.[a-z0-9]+$/i;
const ACCESS_PREFIX = 'wp_private_upload:';
export const LARGE_CHECKOUT_UPLOAD_BYTES = 1024 * 1024 * 1024;
// Enable only with the matching backend migration/functions and verified global Storage limit.
export const MAX_CHECKOUT_UPLOAD_BYTES = import.meta.env?.VITE_STOREFRONT_LARGE_UPLOADS === 'true'
  ? LARGE_CHECKOUT_UPLOAD_BYTES : 50 * 1024 * 1024;
export const CHECKOUT_UPLOAD_LIMIT_LABEL = MAX_CHECKOUT_UPLOAD_BYTES === LARGE_CHECKOUT_UPLOAD_BYTES ? '1 GB' : '50 MB';
type UploadAccess = {id:string;access_token:string;tenant_id:string};
function signedUploadUrl(raw: unknown): string {
  if(typeof raw!=='string')throw new Error('Ugyldigt fillink.');
  const url=new URL(raw);
  if(url.origin!==new URL(import.meta.env.VITE_SUPABASE_URL).origin
    || !url.pathname.startsWith('/storage/v1/object/sign/order-files/'))throw new Error('Ugyldigt fillink.');
  return url.toString();
}
export function checkoutUploadAccess(path:string): UploadAccess | null {
  if(!PRIVATE_PATH.test(path))return null;
  try {
    const value=JSON.parse(sessionStorage.getItem(ACCESS_PREFIX+path)||'null');
    if(value?.id!==path.match(PRIVATE_PATH)?.[1]||!/^[a-f0-9]{64}$/.test(value?.access_token||''))throw new Error();
    return value;
  }catch{throw new Error('Adgangen til trykfilen er udløbet. Upload og godkend filen igen.');}
}
export async function readCheckoutUpload(client:SupabaseClient,path:string):Promise<Blob> {
  const access=checkoutUploadAccess(path);
  if(!access){const {data,error}=await client.storage.from('order-files').download(path);
    if(error||!data)throw new Error('Trykfilen kunne ikke hentes. Upload og godkend den igen.');return data;}
  const {data,error}=await client.functions.invoke('storefront-file-access',{body:{action:'read',...access}});
  if(error||!data?.url||data.path!==path)throw new Error('Trykfilen kunne ikke hentes. Upload og godkend den igen.');
  const response=await fetch(signedUploadUrl(data.url),{redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error('Trykfilen kunne ikke hentes. Prøv igen.');return response.blob();
}
export async function uploadCheckoutFile(client:SupabaseClient,tenantId:string,file:Blob,name:string,legacyPath:string,
  onProgress?: (progress: FileTransferProgress) => void) {
  if(!file.size||file.size>MAX_CHECKOUT_UPLOAD_BYTES)throw new Error(`Trykfilen skal være mellem 1 byte og ${CHECKOUT_UPLOAD_LIMIT_LABEL}.`);
  onProgress?.({phase:'preparing',loaded:0,total:file.size});
  const sha256=await hashCheckoutArtifact(file, loaded => onProgress?.({phase:'preparing',loaded,total:file.size}));
  // The production order-files bucket is private. Keep the legacy path only for
  // environments that explicitly opt into it; an absent flag must be safe.
  if(import.meta.env?.VITE_STOREFRONT_PRIVATE_FILES==='false'){
    const {error}=await client.storage.from('order-files').upload(legacyPath,file,{contentType:file.type||'application/octet-stream',upsert:false});
    if(error)throw new Error('Trykfilen kunne ikke uploades.');
    return {name,path:legacyPath,url:client.storage.from('order-files').getPublicUrl(legacyPath).data.publicUrl,sha256};
  }
  if(!tenantId)throw new Error('Shoppen kunne ikke findes. Genindlæs siden.');
  const access={id:crypto.randomUUID(),tenant_id:tenantId,
    access_token:Array.from(crypto.getRandomValues(new Uint8Array(32)),byte=>byte.toString(16).padStart(2,'0')).join('')};
  const {data,error}=await client.functions.invoke('storefront-file-access',{body:{action:'allocate',...access,file_name:name,file_size:file.size,sha256}});
  if(error||!data?.path||!data?.token||data.id!==access.id||data.path.match(PRIVATE_PATH)?.[1]!==access.id)throw new Error('Trykfilen kunne ikke klargøres. Prøv igen.');
  // Keep the unguessable guest capability in this tab, separate from saved order data.
  sessionStorage.setItem(ACCESS_PREFIX+data.path,JSON.stringify(access));
  // The currently deployed signed-token route is verified through standard uploads.
  // Resumable uploads remain behind the separately gated large-file rollout.
  if(file.size > 50 * 1024 * 1024) {
    await resumableUpload({supabaseUrl:import.meta.env.VITE_SUPABASE_URL,bucket:'order-files',path:data.path,file,
      headers:{'x-signature':data.token},onProgress});
  } else if (onProgress) {
    await standardUpload({supabaseUrl:import.meta.env.VITE_SUPABASE_URL,bucket:'order-files',path:data.path,file,token:data.token,
      headers:{apikey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY},onProgress});
  } else {
    const uploaded=await client.storage.from('order-files').uploadToSignedUrl(data.path,data.token,file,{contentType:file.type||'application/octet-stream'});
    if(uploaded.error)throw new Error('Trykfilen kunne ikke uploades. Prøv igen.');
  }
  onProgress?.({phase:'verifying',loaded:file.size,total:file.size});
  const signed=await client.functions.invoke('storefront-file-access',{body:{action:'read',...access}});
  if(signed.error||!signed.data?.url||signed.data.path!==data.path)throw new Error('Uploaden kunne ikke bekræftes. Prøv igen.');
  return {name,path:data.path,url:signedUploadUrl(signed.data.url),sha256};
}
