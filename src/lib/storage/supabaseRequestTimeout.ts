const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;
const STORAGE_UPLOAD_TIMEOUT_MS = 120_000;

export const supabaseRequestTimeoutMs = (input: RequestInfo | URL, init?: RequestInit): number => {
  const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

  try {
    const pathname = new URL(rawUrl, 'https://placeholder.supabase.co').pathname;
    if (pathname === '/functions/v1/stripe-create-payment-intent' && method === 'POST') return 150_000;
    if (pathname.startsWith('/storage/v1/object/') && (method === 'POST' || method === 'PUT')) {
      return STORAGE_UPLOAD_TIMEOUT_MS;
    }
  } catch {
    // Keep the regular timeout when the request URL cannot be parsed.
  }

  return DEFAULT_REQUEST_TIMEOUT_MS;
};
