/** Reader order, never printer imposition. Supplier saddle stitching uses 4-page increments. */
export interface BrochureArtworkObject {
  left?: number;
  top?: number;
  [key: string]: unknown;
}
export interface BrochurePage {
  number: number;
  objects: BrochureArtworkObject[];
  thumbnail?: string;
}
export interface BrochureSpread {
  left: number;
  right: number;
  objects: BrochureArtworkObject[];
}
export interface BrochureDocument {
  version: 1;
  pageCount: number;
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  pages: BrochurePage[];
  spreads: BrochureSpread[];
  /** One immutable original PDF per upload, shared by all of its page refs. */
  pdfAssets?: Record<string, { bytes: ArrayBuffer; pageCount: number; fileName: string }>;
}

function pdfBackgroundPage(object: BrochureArtworkObject): number | undefined {
  const data = object.data as { kind?: string; brochureBackgroundPage?: number } | undefined;
  return data?.kind === 'pdf_page_background' ? data.brochureBackgroundPage : undefined;
}
function ownPdfBackground(object: BrochureArtworkObject, number: number): BrochureArtworkObject {
  const data = object.data as { kind?: string } | undefined;
  return data?.kind === 'pdf_page_background' ? { ...object, data: { ...data, brochureBackgroundPage: number } } : object;
}
/** Preview clipping never becomes a crop on the original vector PDF. */
export function stripBrochurePreviewClip(object: BrochureArtworkObject): BrochureArtworkObject {
  const sourceData = object.data as Record<string, unknown> | undefined;
  const source = sourceData?.brochurePdfAssetId ? { ...object, data: { ...sourceData } } : object;
  // Canvas/export receives bytes resolved from the asset pool. Never duplicate
  // those bytes into every persisted page or spread object.
  if (sourceData?.brochurePdfAssetId) delete (source.data as Record<string, unknown>).originalPdfBytes;
  const next = structuredClone(source);
  const data = next.data as Record<string, unknown> | undefined;
  if (data?.brochurePreviewClip) { delete next.clipPath; delete data.brochurePreviewClip; }
  return next;
}
function resolveBrochurePdfAsset(document: BrochureDocument, object: BrochureArtworkObject): BrochureArtworkObject {
  const data = object.data as Record<string, unknown> | undefined;
  if (!data?.brochurePdfAssetId) return object; // Existing split-page drafts remain supported.
  const asset = document.pdfAssets?.[String(data.brochurePdfAssetId)];
  if (!asset || data.kind !== 'pdf_page_background' || !(asset.bytes instanceof ArrayBuffer) || !asset.bytes.byteLength
      || !Number.isInteger(data.pageIndex) || Number(data.pageIndex) < 0 || Number(data.pageIndex) >= asset.pageCount
      || data.totalPages !== asset.pageCount) throw new Error('Brochurens originale PDF-kilde mangler eller matcher ikke siden.');
  return { ...object, data: { ...data, originalPdfBytes: asset.bytes, originalFileName: asset.fileName } };
}
export function pruneBrochurePdfAssets(document: BrochureDocument): void {
  if (!document.pdfAssets) return;
  const used = new Set([...document.pages, ...document.spreads].flatMap(page => page.objects)
    .map(object => (object.data as { brochurePdfAssetId?: string } | undefined)?.brochurePdfAssetId).filter(Boolean));
  for (const id of Object.keys(document.pdfAssets)) if (!used.has(id)) delete document.pdfAssets[id];
}
export function brochureSpreadPreviewObjects(document: BrochureDocument, spread: BrochureSpread, mmToPx: number, padding: number): BrochureArtworkObject[] {
  const seam = padding + (document.bleedMm + document.widthMm) * mmToPx;
  return spread.objects.map(source => {
    const object = stripBrochurePreviewClip(source);
    const owner = pdfBackgroundPage(object);
    if (owner === undefined) return resolveBrochurePdfAsset(document, object);
    return resolveBrochurePdfAsset(document, { ...object, data: { ...(object.data as object), brochurePreviewClip: true }, clipPath: {
      type: 'rect', originX: 'left', originY: 'top', left: owner === spread.left ? padding : seam, top: padding,
      width: (document.widthMm + document.bleedMm) * mmToPx, height: (document.heightMm + 2 * document.bleedMm) * mmToPx,
      absolutePositioned: true, fill: '#000000', strokeWidth: 0,
    } });
  });
}

export function validBrochurePageCount(count: number): boolean {
  return Number.isInteger(count) && count >= 8 && count <= 152 && count % 4 === 0;
}
export function createBrochureDocument(pageCount: number, widthMm: number, heightMm: number, bleedMm = 3): BrochureDocument {
  if (!validBrochurePageCount(pageCount)) throw new Error('Vælg et sidetal fra 8 til 152 i trin på fire.');
  if (![widthMm, heightMm].every(n => Number.isFinite(n) && n > 0) || !Number.isFinite(bleedMm) || bleedMm < 0) {
    throw new Error('Brochurens sidestørrelse er ugyldig.');
  }
  return { version: 1, pageCount, widthMm, heightMm, bleedMm,
    pages: Array.from({ length: pageCount }, (_, index) => ({ number: index + 1, objects: [] })), spreads: [] };
}
export function brochurePageLabel(number: number, pageCount: number): string {
  return number === 1 ? 'Forside' : number === pageCount ? 'Bagside' : `Side ${number}`;
}
export function brochureFacingPages(number: number, pageCount: number): [number, number] | null {
  if (!Number.isInteger(number) || number <= 1 || number >= pageCount) return null;
  const left = number % 2 === 0 ? number : number - 1;
  return [left, left + 1];
}
export function assertBrochureSpread(left: number, right: number, pageCount: number): void {
  const pair = brochureFacingPages(left, pageCount);
  if (!pair || pair[0] !== left || pair[1] !== right) throw new Error('Kun opslag 2–3, 4–5 osv. kan forbindes.');
}
export function brochurePageObjects(document: BrochureDocument, number: number, displayMmToPx: number): BrochureArtworkObject[] {
  const page = document.pages[number - 1];
  if (!page || page.number !== number) throw new Error('Brochuresiden findes ikke.');
  const spread = document.spreads.find(s => s.left === number || s.right === number);
  if (!spread) return page.objects.map(object => resolveBrochurePdfAsset(document, stripBrochurePreviewClip(object)));
  const offset = spread.right === number ? document.widthMm * displayMmToPx : 0;
  // Retain crossing objects and original PDF bytes. The page export viewport
  // crops the shared spread; never flatten or destructively cut the artwork.
  return spread.objects.filter(object => pdfBackgroundPage(object) === undefined || pdfBackgroundPage(object) === number)
    .map(object => resolveBrochurePdfAsset(document, { ...stripBrochurePreviewClip(object), left: Number(object.left || 0) - offset }));
}
export function joinBrochureSpread(document: BrochureDocument, left: number, right: number, displayMmToPx: number): BrochureDocument {
  assertBrochureSpread(left, right, document.pageCount);
  if (!Number.isFinite(displayMmToPx) || displayMmToPx <= 0) throw new Error('Ugyldig designsideskala.');
  if (document.spreads.some(s => s.left === left)) return document;
  const next = structuredClone(document);
  next.spreads.push({ left, right, objects: [
    ...next.pages[left - 1].objects.map(object => ownPdfBackground(object, left)),
    ...next.pages[right - 1].objects.map(object => ({ ...ownPdfBackground(object, right), left: Number(object.left || 0) + next.widthMm * displayMmToPx })),
  ] });
  return next;
}
export function validateBrochurePdfPageCount(actual: number, expected: number, singlePage = false): void {
  if (singlePage ? actual !== 1 : actual !== expected) {
    throw new Error(singlePage ? 'Upload én PDF-side til den valgte side.' : `PDF-filen har ${actual} sider. Den valgte brochure kræver ${expected} sider inklusive omslag.`);
  }
}
export function unlinkBrochureSpread(document: BrochureDocument, left: number, displayMmToPx: number): BrochureDocument {
  const spread = document.spreads.find(s => s.left === left);
  if (!spread) return document;
  const next = structuredClone(document);
  next.pages[spread.left - 1].objects = brochurePageObjects(document, spread.left, displayMmToPx).map(stripBrochurePreviewClip);
  next.pages[spread.right - 1].objects = brochurePageObjects(document, spread.right, displayMmToPx).map(stripBrochurePreviewClip);
  next.spreads = next.spreads.filter(s => s.left !== left);
  return next;
}
export function readBrochureDocument(snapshot: unknown): BrochureDocument | null {
  if (!snapshot || typeof snapshot !== 'object' || !('brochureDocument' in snapshot)) return null;
  const document = (snapshot as { brochureDocument: BrochureDocument }).brochureDocument;
  if (!document || document.version !== 1 || !validBrochurePageCount(document.pageCount)
      || document.pages?.length !== document.pageCount || !Array.isArray(document.spreads)) {
    throw new Error('Det gemte brochuredokument er ugyldigt.');
  }
  createBrochureDocument(document.pageCount, document.widthMm, document.heightMm, document.bleedMm);
  for (const [index, page] of document.pages.entries()) {
    if (page.number !== index + 1 || !Array.isArray(page.objects)) throw new Error('Brochurens siderækkefølge er ugyldig.');
    for (const object of page.objects) resolveBrochurePdfAsset(document, object);
  }
  const seen = new Set<number>();
  for (const spread of document.spreads) {
    assertBrochureSpread(spread.left, spread.right, document.pageCount);
    if (seen.has(spread.left) || !Array.isArray(spread.objects)) throw new Error('Brochuren har et gentaget eller ugyldigt opslag.');
    seen.add(spread.left);
    for (const object of spread.objects) resolveBrochurePdfAsset(document, object);
  }
  for (const asset of Object.values(document.pdfAssets || {})) {
    if (!(asset.bytes instanceof ArrayBuffer) || !asset.bytes.byteLength || !Number.isInteger(asset.pageCount) || asset.pageCount < 1 || asset.pageCount > 152 || typeof asset.fileName !== 'string') throw new Error('Brochurens gemte PDF-kilde er ugyldig.');
  }
  return document;
}
