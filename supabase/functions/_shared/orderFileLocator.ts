/** Stable file identity; the URL stored on the order is not a download grant. */
export function orderFileStoragePath(raw: string, backendUrl: string): string | null {
  if (/(?:\/|%2f)(?:\.|%2e){1,2}(?:\/|%2f|$)/i.test(raw.split(/[?#]/,1)[0])) {
    throw new Error('Invalid order file path');
  }
  const url = new URL(raw);
  if (url.origin !== new URL(backendUrl).origin) return null;
  const prefix = '/storage/v1/object/public/order-files/';
  if (!url.pathname.startsWith(prefix)) return null;
  const path = decodeURIComponent(url.pathname.slice(prefix.length));
  if (!path || path.split('/').some(part => !part || part === '.' || part === '..')
    || /[\\\x00-\x1f\x7f]/.test(path)) throw new Error('Invalid order file path');
  return path;
}

/** Check the durable order binding before granting a supplier temporary access. */
export async function supplierOrderFileUrl(client: any, backendUrl: string, orderId: string, raw: string) {
  const path = orderFileStoragePath(raw, backendUrl);
  if (!path) throw new Error('Production file must be stored in the order file archive');
  const {data: bound, error: bindingError} = await client.rpc('storefront_order_file_is_bound', {
    p_order_id: orderId, p_path: path,
  });
  if (bindingError || bound !== true) throw new Error('Production file is not bound to this order');
  const {data, error} = await client.storage.from('order-files').createSignedUrl(path, 24 * 60 * 60);
  if (error || !data?.signedUrl) throw new Error('Production file is unavailable');
  const signed = new URL(data.signedUrl);
  if (signed.origin !== new URL(backendUrl).origin
    || !signed.pathname.startsWith('/storage/v1/object/sign/order-files/')) throw new Error('Invalid production file link');
  return data.signedUrl as string;
}
