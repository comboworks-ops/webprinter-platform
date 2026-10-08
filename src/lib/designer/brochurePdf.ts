import { PDFArray, PDFDict, PDFDocument, PDFName, PDFObject, PDFObjectCopier, PDFRawStream, PDFRef, PDFStream } from 'pdf-lib';

/** Split original vector artwork, retaining catalog colour intent and the
 * production exporter's restrictions before catalog-level flags can be lost. */
export function validateBrochurePdfPage(source: PDFDocument, index: number): void {
  const page = source.getPage(index);
  if (source.catalog.has(PDFName.of('OCProperties')) || (page.node.get(PDFName.of('UserUnit')) && page.node.get(PDFName.of('UserUnit'))?.toString() !== '1')) {
    throw new Error('PDF med valgfrie lag eller særlig sideskalering skal klargøres før import.');
  }
  if (page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)?.size()) throw new Error('PDF med annotationer eller formularfelter skal klargøres før import.');
}
export async function copyBrochurePdfPage(source: PDFDocument, index: number): Promise<Uint8Array> {
  validateBrochurePdfPage(source, index);
  const target = await PDFDocument.create();
  const [copied] = await target.copyPages(source, [index]); target.addPage(copied);
  const intent = source.catalog.get(PDFName.of('OutputIntents'));
  if (intent) target.catalog.set(PDFName.of('OutputIntents'), PDFObjectCopier.for(source.context, target.context).copy(intent));
  return target.save();
}

/** Only byte-identical ICC streams with identical PDF stream semantics may be
 * shared. Never alter a profile, image, colour space or painting instruction. */
export async function deduplicateBrochureIccProfiles(pdf: PDFDocument, cache = new WeakMap<PDFRawStream, string>()): Promise<number> {
  const candidates = new Set<PDFRef>();
  const visited = new Set<PDFObject>();
  const collect = (object: PDFObject) => {
    if (visited.has(object)) return;
    visited.add(object);
    if (object instanceof PDFStream) { collect(object.dict); return; }
    if (object instanceof PDFArray) {
      if (object.get(0)?.toString() === '/ICCBased' && object.get(1) instanceof PDFRef) candidates.add(object.get(1) as PDFRef);
      for (let index = 0; index < object.size(); index++) collect(object.get(index));
    } else if (object instanceof PDFDict) {
      const profile = object.get(PDFName.of('DestOutputProfile'));
      if (profile instanceof PDFRef) candidates.add(profile);
      for (const [, value] of object.entries()) collect(value);
    }
  };
  for (const [, object] of pdf.context.enumerateIndirectObjects()) collect(object);
  const canonical = new Map<string, PDFRef>(), replacements = new Map<PDFRef, PDFRef>();
  for (const ref of candidates) {
    const stream = pdf.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) throw new Error('Brochurens ICC-kilde er ugyldig.');
    const semantics = stream.dict.entries().filter(([name]) => name.toString() !== '/Length')
      .map(([name,value]) => [name.toString(),value.toString()]).sort(([a],[b]) => a.localeCompare(b));
    let contentHash = cache.get(stream);
    if (!contentHash) {
      const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(stream.getContents()).buffer);
      contentHash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2,'0')).join('');
      cache.set(stream,contentHash);
    }
    const key = JSON.stringify(semantics) + ':' + contentHash;
    const first = canonical.get(key);
    if (first) replacements.set(ref,first); else canonical.set(key,ref);
  }
  if (!replacements.size) return 0;
  visited.clear();
  const rewrite = (object: PDFObject) => {
    if (visited.has(object)) return;
    visited.add(object);
    if (object instanceof PDFStream) { rewrite(object.dict); return; }
    if (object instanceof PDFArray) {
      for (let index = 0; index < object.size(); index++) {
        const value = object.get(index), replacement = value instanceof PDFRef && replacements.get(value);
        if (replacement) object.set(index,replacement); else rewrite(value);
      }
    } else if (object instanceof PDFDict) {
      for (const [name,value] of object.entries()) {
        const replacement = value instanceof PDFRef && replacements.get(value);
        if (replacement) object.set(name,replacement); else rewrite(value);
      }
    }
  };
  for (const [, object] of pdf.context.enumerateIndirectObjects()) rewrite(object);
  for (const duplicate of replacements.keys()) pdf.context.delete(duplicate);
  return replacements.size;
}
