import { webprinterShop } from './webprinter.mjs';

// Account pages belong to the shared Webprinter app, outside the design frame.
// A development origin must be explicitly configured; URL parameters never select it.
export function accountLinks(location, developmentOrigin = '') {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  let origin = location.origin;
  if (local) {
    if (!developmentOrigin) return null;
    const target = new URL(developmentOrigin);
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.protocol !== 'http:') return null;
    origin = target.origin;
  } else if (!['pvcbanner.dk', 'www.pvcbanner.dk'].includes(location.hostname)) {
    return null;
  }
  const link = (path, mode) => {
    const url = new URL(path, origin);
    if (local) url.searchParams.set('tenantId', webprinterShop.tenantId);
    if (mode) url.searchParams.set('mode', mode);
    return url.href;
  };
  return { login: link('/auth'), signup: link('/auth', 'signup'), admin: link('/admin/login') };
}
