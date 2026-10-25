// This shop was created in the existing Webprinter project on 11 October 2026.
// Binding is explicit: URL parameters must never switch this preview to another shop.
export const webprinterShop = Object.freeze({
  tenantId: 'cd3c7d7b-2220-46b8-93cf-096de23e93d8',
  apiOrigin: 'https://ziattmsmiirfweiuunfo.supabase.co',
  intendedDomain: 'pvcbanner.dk',
  dnsProvider: 'Simply.com',
});

export async function readWebprinterConnection({
  apiKey = import.meta.env?.VITE_WEBPRINTER_PUBLISHABLE_KEY,
  fetchImpl = globalThis.fetch,
  signal,
  timeoutMs = 10000,
} = {}) {
  if (!apiKey?.startsWith('sb_publishable_')) {
    throw new Error('Forbindelsen mangler sin offentlige Webprinter-nøgle.');
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, timeoutMs);
  async function read(endpoint) {
    const url = new URL(`/functions/v1/${endpoint}`, webprinterShop.apiOrigin);
    url.searchParams.set('tenantId', webprinterShop.tenantId);
    url.searchParams.set('hostname', webprinterShop.intendedDomain);
    const response = await fetchImpl(url.href, {
      method: 'GET',
      headers: { apikey: apiKey },
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Webprinter kunne ikke bekræfte forbindelsen. Prøv igen.');
    const data = await response.json();
    if (data.success !== true || data.tenant?.id !== webprinterShop.tenantId || data.source !== 'tenant_id') {
      throw new Error('Webprinter svarede ikke med den forventede PVCbanner-shop.');
    }
    return data;
  }
  try {
    const [context, catalogue] = await Promise.all([read('tenant-context-read'), read('catalog-read')]);
    if (!Array.isArray(catalogue.products) || catalogue.products.some(product =>
      !product || typeof product.id !== 'string' || typeof product.name !== 'string'
      || typeof product.slug !== 'string'
      || (product.tenant_id !== undefined && product.tenant_id !== webprinterShop.tenantId)
    )) throw new Error('Webprinter kunne ikke bekræfte shoppens produktliste.');
    return {
      tenant: { id: context.tenant.id, name: context.tenant.name, domain: context.tenant.domain },
      products: catalogue.products.map(({ id, name, slug }) => ({ id, name, slug })),
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('Forbindelsen blev afbrudt. Prøv igen.');
    if (error instanceof TypeError || error instanceof SyntaxError) {
      throw new Error('Webprinter kunne ikke kontaktes. Kontrollér forbindelsen og prøv igen.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    controller.abort();
  }
}
