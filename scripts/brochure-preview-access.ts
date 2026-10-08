/** Development-only draft reads are limited to this loopback preview server. */
export function brochurePreviewAccess({host,remoteAddress,origin,method,fetchSite}: {
  host?: string; remoteAddress?: string; origin?: string; method?: string; fetchSite?: string;
}): 200 | 403 | 405 {
  if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host || '')
    || !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remoteAddress || '')
    || (origin && origin !== `http://${host}`) || fetchSite === 'cross-site') return 403;
  return ['GET','HEAD'].includes(method || '') ? 200 : 405;
}
