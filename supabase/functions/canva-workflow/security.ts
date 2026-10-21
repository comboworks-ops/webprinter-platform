export const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const randomSecret = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export const sha256 = async (value: string) => base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));

/** AEAD binds credentials to both customer and shop; database access alone is insufficient. */
export async function tokenVault(secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(secret)) throw new Error('Canva er ikke konfigureret.');
  const key = await crypto.subtle.importKey('raw', Uint8Array.from(secret.match(/../g)!, byte => parseInt(byte, 16)), 'AES-GCM', false, ['encrypt', 'decrypt']);
  return {
    async seal(value: unknown, scope: string) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(scope) }, key, new TextEncoder().encode(JSON.stringify(value)));
      return `${base64url(iv)}.${base64url(new Uint8Array(cipher))}`;
    },
    async open(value: string, scope: string) {
      const decode = (part: string) => Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      const [iv, cipher] = value.split('.');
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv), additionalData: new TextEncoder().encode(scope) }, key, decode(cipher));
      return JSON.parse(new TextDecoder().decode(plain));
    },
  };
}

export async function boundedBytes(response: Response | Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  if (Number(response.headers.get('content-length')) > limit) throw new Error('Filen er for stor.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Tom forespørgsel.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) throw new Error('Filen er for stor.');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

export function callbackUri(origin: string, allowedOrigins: string[]) {
  if (!allowedOrigins.includes(origin)) throw new Error('Denne shop har ikke en Canva-forbindelse.');
  const url = new URL(origin);
  if (url.origin !== origin || (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))) throw new Error('Ugyldig returadresse.');
  return `${origin}/canva-designs`;
}
