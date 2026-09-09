import { customerShopTarget, readCustomerShop } from '../account/shop.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

const BINARY_TAG = '__webprinter_arraybuffer_v1';
function mapSnapshot(value: unknown, encode: boolean): unknown {
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (!encode) return bytes.slice().buffer;
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 32768) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
    }
    return { [BINARY_TAG]: btoa(binary) };
  }
  if (Array.isArray(value)) return value.map(entry => mapSnapshot(entry, encode));
  if (!value || typeof value !== 'object') return value;
  const fields = value as Record<string, unknown>;
  if (!encode && Object.keys(fields).length === 1 && typeof fields[BINARY_TAG] === 'string') {
    const binary = atob(fields[BINARY_TAG]);
    return Uint8Array.from(binary, character => character.charCodeAt(0)).buffer;
  }
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, mapSnapshot(entry, encode)]));
}

/** Fabric stores vector PDF source bytes in object data. Preserve them across
 * database JSON transport instead of silently turning ArrayBuffers into {}. */
export function encodeDesignerSnapshot(snapshot: object): object { return mapSnapshot(snapshot, true) as object; }
export function decodeDesignerSnapshot(snapshot: object): object { return mapSnapshot(snapshot, false) as object; }

export function assertDesignerDocumentSaveSupported(templatePageCount: number, apparelSideCount: number): void {
  if (templatePageCount > 1 || apparelSideCount > 1) {
    throw new Error('Gem som design understøtter endnu ikke dokumenter med flere sider. Behold fanen åben, og brug Tilbage til ordre for at gemme produktionsfilerne.');
  }
}

export interface DesignerSaveContext {
  embedded: boolean;
  queryTenantId: string | null;
  documentTenantId: string | null;
  productId?: string | null;
  hostname: string;
  search: string;
  rootDomain?: string;
}

/** Resolve the intended shop from the actual document/URL. Admin ownership and
 * fallback storefront branding must never silently choose a saved design's shop. */
export async function resolveDesignerSaveTenant(client: Pick<SupabaseClient, 'from'>, context: DesignerSaveContext): Promise<string> {
  if (context.embedded && !context.queryTenantId) throw new Error('Vælg en butik, før du gemmer designet.');
  const target = context.embedded
    ? { kind: 'id' as const, value: context.queryTenantId! }
    : customerShopTarget(context.hostname, context.search, context.rootDomain);
  const shop = await readCustomerShop(client as SupabaseClient, target);
  if (context.documentTenantId && context.documentTenantId !== shop.id) {
    throw new Error('Designet tilhører en anden butik. Behold fanen åben, og åbn designet fra den rigtige butik.');
  }
  if (context.productId) {
    const { data: product, error } = await client.from('products').select('id, tenant_id')
      .eq('id', context.productId).eq('tenant_id', shop.id).maybeSingle();
    if (error) throw error;
    if (product?.id !== context.productId || product?.tenant_id !== shop.id) {
      throw new Error('Produktet kunne ikke findes i denne butik. Behold fanen åben, og kontrollér butiksvalget.');
    }
  }
  return shop.id;
}

export async function updateOwnedDesign(client: Pick<SupabaseClient, 'from'>, id: string, userId: string, tenantId: string, data: Record<string, unknown>) {
  const { data: saved, error } = await client.from('designer_saved_designs').update(data)
    .eq('id', id).eq('user_id', userId).eq('tenant_id', tenantId).select('id').single();
  if (error) throw error;
  if (saved?.id !== id) throw new Error('Designet blev ikke gemt. Åbn designet igen og prøv igen.');
}
