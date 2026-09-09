import type { SupabaseClient } from '@supabase/supabase-js';

export const MAX_CUSTOMER_FILE_SIZE = 100 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'ai', 'eps']);
export interface CustomerReplacementRequest {
  orderId: string; tenantId: string; userId: string; file: File; expectedCurrentFileIds: string[];
}

export function validateCustomerReplacement(request: CustomerReplacementRequest) {
  if (!request.orderId || !request.tenantId || !request.userId || !Array.isArray(request.expectedCurrentFileIds)) throw new Error('Genindlæs ordren, før du vælger en ny fil.');
  const extension = request.file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error('Vælg en PDF, JPG, PNG, AI eller EPS-fil.');
  if (!request.file.size || request.file.size > MAX_CUSTOMER_FILE_SIZE) throw new Error('Filen skal være mellem 1 byte og 100 MB.');
  if (request.file.name.length > 255 || [...request.file.name].some(character => character.charCodeAt(0) < 32)) throw new Error('Filnavnet er for langt eller indeholder ugyldige tegn.');
  return extension;
}

/** Immutable upload plus a single atomic finalization. Never replace existing
 * objects, retry an uncertain write, or clear the request from the browser. */
export async function uploadCustomerReplacementFile(client: SupabaseClient, request: CustomerReplacementRequest): Promise<string> {
  const extension = validateCustomerReplacement(request);
  const params = {
    p_order_id: request.orderId, p_tenant_id: request.tenantId,
    p_file_name: request.file.name, p_file_size: request.file.size,
    p_expected_current_file_ids: request.expectedCurrentFileIds,
    p_storage_path: null as string | null, p_validate_only: true,
  };
  const ready = await client.rpc('customer_finalize_order_file', params);
  if (ready.error || ready.data !== request.orderId) throw new Error('Filudskiftning er ikke tilgængelig for denne ordre lige nu. Genindlæs ordren, eller kontakt trykkeriet. Din nuværende fil er bevaret.');
  const path = `${request.orderId}/${request.userId}/${crypto.randomUUID()}.${extension}`;
  const uploaded = await client.storage.from('order-files').upload(path, request.file, { upsert: false });
  if (uploaded.error) throw new Error('Filen kunne ikke uploades. Din nuværende fil er bevaret. Prøv igen.');
  let finalized: { data: unknown; error: unknown };
  try { finalized = await client.rpc('customer_finalize_order_file', { ...params, p_storage_path: path, p_validate_only: false }); }
  catch { throw new Error('Vi kunne ikke bekræfte, om den nye fil blev registreret. Genindlæs ordren, og kontrollér den aktuelle fil, før du prøver igen.'); }
  if (finalized.error || typeof finalized.data !== 'string' || !finalized.data) {
    // A timeout can follow a committed transaction. Keep the uploaded object;
    // deleting it here could destroy the newly current file. No automatic retry.
    throw new Error('Vi kunne ikke bekræfte, om den nye fil blev registreret. Genindlæs ordren, og kontrollér den aktuelle fil, før du prøver igen.');
  }
  return finalized.data;
}
