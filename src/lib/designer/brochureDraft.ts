import { readBrochureDocument, type BrochureDocument } from './brochureDocument.ts';

export interface BrochureDraftScope {
  tenantId: string | null;
  productId: string | null;
  pageCount: number;
  widthMm: number;
  heightMm: number;
  bleedMm: number;
}
export interface BrochureDraft {
  version: 1;
  scope: BrochureDraftScope;
  document: BrochureDocument;
  profileId: string;
  name: string;
  updatedAt: string;
}
const DATABASE = 'webprinter-brochure-drafts-v1';
const STORE = 'documents';
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Den lokale kladde kunne ikke åbnes.'));
    request.onblocked = () => reject(new Error('Luk andre faner med sidedesigneren, og prøv igen.'));
  });
}
export function matchingBrochureDraft(draft: BrochureDraft, scope: BrochureDraftScope): boolean {
  return draft?.version === 1 && Object.keys(scope).every(key => draft.scope?.[key as keyof BrochureDraftScope] === scope[key as keyof BrochureDraftScope]);
}
export async function readBrochureDraft(id: string, scope: BrochureDraftScope): Promise<BrochureDraft | null> {
  const db = await database();
  try {
    const value = await new Promise<BrochureDraft | undefined>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Den lokale kladde kunne ikke læses.'));
    });
    if (!value) return null;
    if (!matchingBrochureDraft(value, scope)) throw new Error('Denne kladde tilhører et andet format eller produkt.');
    readBrochureDocument({ brochureDocument: value.document });
    return value;
  } finally { db.close(); }
}
/** IndexedDB retains binary PDF pages without JSON expansion or sessionStorage's
 * small quota. Resolve only after the transaction is durably committed. */
export async function writeBrochureDraft(id: string, draft: BrochureDraft): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      transaction.objectStore(STORE).put(draft, id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(new Error('Der er ikke plads til at gemme kladden lokalt. Behold fanen åben og hent din tryk-PDF.'));
    });
  } finally { db.close(); }
}
