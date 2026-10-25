import type { SupabaseClient } from '@supabase/supabase-js';
import type { SiteCheckoutState } from './siteCheckoutSession';

export const CHECKOUT_MASTER_TENANT_ID = '00000000-0000-0000-0000-000000000000';
const productColumns = 'id, tenant_id, is_published, slug, name, description, image_url, category, pricing_type, technical_specs, banner_config, template_files, pricing_structure';

function internalProductPath(state: SiteCheckoutState): URL | null {
  const path = state.productReturnPath;
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')
    || [...path].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return null;
  try {
    const url = new URL(path, 'https://checkout.invalid');
    return url.origin === 'https://checkout.invalid' ? url : null;
  } catch { return null; }
}

/** Old drafts carry shop context in the product return URL; newer drafts bind it explicitly. */
export function checkoutTenantConflict(state: SiteCheckoutState, shop: { id: string; domain?: string | null }): boolean {
  if (state.checkoutTenantId && state.checkoutTenantId !== shop.id) return true;
  const params = internalProductPath(state)?.searchParams;
  const tenantIds = [params?.get('tenantId'), params?.get('tenant_id')].filter(Boolean);
  if (tenantIds.some(id => id !== shop.id)) return true;
  if (tenantIds.length) return false;
  const domain = params?.get('force_domain');
  if (!domain) return false;
  const normalize = (value: string) => value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  if (shop.id === CHECKOUT_MASTER_TENANT_ID && normalize(domain) === 'webprinter.dk') return false;
  const expected = shop.domain || (shop.id === CHECKOUT_MASTER_TENANT_ID ? 'webprinter.dk' : '');
  return Boolean(expected && normalize(domain) !== normalize(expected));
}

/** Return to the original shop without deleting or rewriting its saved checkout. */
export function checkoutProductReturnPath(state: SiteCheckoutState): string | null {
  const original = internalProductPath(state);
  const fallback = state.productSlug ? new URL(`/produkt/${encodeURIComponent(state.productSlug)}`, 'https://checkout.invalid') : null;
  const url = original || fallback;
  if (!url) return null;
  if (state.checkoutTenantId) {
    url.searchParams.delete('tenant_id');
    url.searchParams.set('tenantId', state.checkoutTenantId);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Match the storefront contract: published current-shop product, then published master product. */
export async function readCheckoutProduct(client: SupabaseClient, tenantId: string, state: SiteCheckoutState, options: { allowUnpublished?: boolean } = {}) {
  if (!tenantId || (!state.productId && !state.productSlug)) throw new Error('Gå tilbage til produktet og vælg din bestilling igen.');
  const scopes = tenantId === CHECKOUT_MASTER_TENANT_ID || options.allowUnpublished ? [tenantId] : [tenantId, CHECKOUT_MASTER_TENANT_ID];
  for (const scope of scopes) {
    let query = client.from('products').select(productColumns).eq('tenant_id', scope);
    if (!options.allowUnpublished) query = query.eq('is_published', true);
    query = state.productId ? query.eq('id', state.productId) : query.eq('slug', state.productSlug!);
    const { data, error } = await query.limit(1);
    if (error) throw error;
    const product = data?.[0];
    if (!product) continue;
    if (product.tenant_id !== scope || (!options.allowUnpublished && product.is_published !== true)
      || (state.productId ? product.id !== state.productId : product.slug !== state.productSlug)) {
      throw new Error('Produktet matcher ikke den valgte butik.');
    }
    return product;
  }
  throw new Error('Produktet er ikke tilgængeligt i denne butik. Din gemte bestilling er bevaret.');
}
