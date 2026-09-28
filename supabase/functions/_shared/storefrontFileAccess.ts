import {CheckoutError, UUID, sha256} from './storefrontCheckout.ts';

export const PRIVATE_UPLOAD_PATH = /^checkout-uploads\/([a-f0-9-]{36})\.(pdf|png|jpe?g|tiff?|ai|eps)$/i;
export const MAX_CHECKOUT_UPLOAD_BYTES = 1024 * 1024 * 1024;
export const FILE_READ_TTL_SECONDS = 15 * 60;
export function validateFileCapability(id: unknown, token: unknown) {
  if (!UUID.test(String(id || '')) || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    throw new CheckoutError('file_access_denied',403);
  }
}
export function validateUploadAllocation(input: any) {
  validateFileCapability(input?.id,input?.access_token);
  const extension = typeof input.file_name === 'string' ? input.file_name.split('.').pop()?.toLowerCase() : null;
  if (!UUID.test(String(input.tenant_id || '')) || !extension || !/^(pdf|png|jpe?g|tiff?|ai|eps)$/.test(extension)
    || input.file_name.length > 255 || /[\x00-\x1f\x7f]/.test(input.file_name)
    || !Number.isSafeInteger(input.file_size) || input.file_size < 1 || input.file_size > MAX_CHECKOUT_UPLOAD_BYTES
    || !/^[a-f0-9]{64}$/.test(String(input.sha256 || ''))) throw new CheckoutError('file_upload_invalid');
  return {id:input.id,tenant_id:input.tenant_id,storage_path:`checkout-uploads/${input.id}.${extension}`,
    file_name:input.file_name,file_size:input.file_size,sha256:input.sha256};
}
export async function requireUploadCapability(client: any, input: {
  id: string; access_token: string; tenant_id: string; user_id: string | null;
}) {
  validateFileCapability(input.id,input.access_token);
  const {data:claim,error} = await client.from('storefront_file_uploads').select('*').eq('id',input.id).maybeSingle();
  if (error) throw new CheckoutError('file_access_unavailable',503);
  if (!claim || claim.tenant_id !== input.tenant_id || claim.access_token_hash !== await sha256(input.access_token)
    || (claim.user_id && claim.user_id !== input.user_id)
    || !Number.isFinite(Date.parse(claim.expires_at)) || Date.parse(claim.expires_at) <= Date.now()) {
    throw new CheckoutError('file_access_denied',403);
  }
  return claim;
}
export async function signPrivateUpload(client: any, claim: any) {
  const {data,error} = await client.storage.from('order-files').createSignedUrl(claim.storage_path,FILE_READ_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new CheckoutError('file_upload_not_ready',409);
  return data.signedUrl as string;
}
