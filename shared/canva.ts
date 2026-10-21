/** Versioned, reviewed sources. Never use update_design on these IDs. */
export const CANVA_TEMPLATES = [
  { key: 'florist-a5-v1', name: 'Blomsterbutik', designId: 'DAHYo7VYqns', widthMm: 148, heightMm: 210, image: '/canva/florist.png' },
  { key: 'bicycle-a5-v1', name: 'Cykelværksted', designId: 'DAHYoy_4X5U', widthMm: 148, heightMm: 210, image: '/canva/bicycle.png' },
] as const;

export const CANVA_FIELDS = [
  { key: 'business_name', label: 'Virksomhedens navn', max: 26, lines: 1 },
  { key: 'headline', label: 'Overskrift', max: 38, lines: 2 },
  { key: 'supporting_text', label: 'Beskrivelse', max: 110, lines: 3 },
  { key: 'offer', label: 'Tilbud og pris', max: 32, lines: 2 },
  { key: 'address', label: 'Adresse', max: 40, lines: 1 },
  { key: 'call_to_action', label: 'Opfordring til kunden', max: 48, lines: 2 },
] as const;
export type CanvaTemplateKey = typeof CANVA_TEMPLATES[number]['key'];
export type CanvaText = Record<typeof CANVA_FIELDS[number]['key'], string>;
export const CANVA_PHOTO_LIMIT = 8 * 1024 * 1024;

export function validateCanvaText(input: unknown): CanvaText {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Udfyld alle tekstfelter.');
  const values = input as Record<string, unknown>;
  if (Object.keys(values).some(key => !CANVA_FIELDS.some(field => field.key === key))) throw new Error('Ukendt tekstfelt.');
  return Object.fromEntries(CANVA_FIELDS.map(field => {
    const value = values[field.key];
    if (typeof value !== 'string' || !value.trim() || Array.from(value).length > field.max
      || value.split(/\r?\n/).length > field.lines || Array.from(value).some(char => char.charCodeAt(0) < 32 && !['\n', '\r', '\t'].includes(char))) {
      throw new Error(`${field.label}: højst ${field.max} tegn og ${field.lines} linje(r).`);
    }
    return [field.key, value.trim()];
  })) as CanvaText;
}

export function assertCanvaDataset(dataset: Record<string, { type?: string }> | undefined) {
  const expected = { ...Object.fromEntries(CANVA_FIELDS.map(field => [field.key, 'text'])), hero_image: 'image' };
  if (!dataset || Object.keys(dataset).length !== Object.keys(expected).length
    || Object.entries(expected).some(([key, type]) => dataset[key]?.type !== type)) {
    throw new Error('Skabelonens felter er ændret. Kontakt shoppen.');
  }
}

export function validateCanvaPhoto(bytes: Uint8Array, mime: string) {
  if (!bytes.length || bytes.length > CANVA_PHOTO_LIMIT) throw new Error('Fotoet må højst fylde 8 MB.');
  const png = [137,80,78,71,13,10,26,10].every((v, i) => bytes[i] === v);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!(mime === 'image/png' && png) && !(mime === 'image/jpeg' && jpeg)) throw new Error('Vælg et JPG- eller PNG-foto.');
}

export function canvaUrl(raw: unknown, kind: 'edit' | 'download' | 'thumbnail'): string {
  if (typeof raw !== 'string') throw new Error('Canva returnerede ikke et gyldigt link.');
  const url = new URL(raw);
  const hosts = kind === 'edit' ? ['www.canva.com'] : kind === 'download'
    ? ['export-download.canva.com'] : ['www.canva.com', 'document-export.canva.com', 'export-download.canva.com', 'design.canva.ai'];
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.includes(url.hostname)) throw new Error('Ugyldigt Canva-link.');
  return url.href;
}

export function assertCustomerCopy(designId: string, sourceId: string) {
  if (!/^D[A-Za-z0-9_-]+$/.test(designId) || designId === sourceId
    || CANVA_TEMPLATES.some(template => template.designId === designId)) throw new Error('Canva oprettede ikke en separat kundekopi.');
}
