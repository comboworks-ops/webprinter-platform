// Forward only deployment access credentials to this request's own origin.
// Customer cookies and Supabase Authorization headers are not needed by assets.
export function fetchSameOriginAsset(request: Request, path: string, init: RequestInit = {}) {
  const origin = new URL(request.url).origin;
  const target = new URL(path, origin);
  if (target.origin !== origin || target.username || target.password) {
    throw new Error('Asset request must stay on the incoming origin');
  }
  const headers = new Headers(init.headers);
  const cookie = (request.headers.get('cookie') || '').split(';')
    .map(value => value.trim()).find(value => value.startsWith('_vercel_jwt='));
  if (cookie) headers.set('cookie', cookie);
  const bypass = request.headers.get('x-vercel-protection-bypass');
  if (bypass) headers.set('x-vercel-protection-bypass', bypass);
  // A redirect must never carry the deployment credential to another host.
  // Vercel Edge supports manual redirects, but not Fetch's "error" mode.
  return fetch(target, {...init, headers, redirect: 'manual'}).then(response => {
    if (response.status >= 300 && response.status < 400) {
      throw new Error('Unexpected asset redirect');
    }
    return response;
  });
}
