import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
export interface PdfContourInspection { paths: number; valid: boolean }
const cutNames = new Set(['/cutcontour', '/cutkontur']);

/** Tokenise PDF operators without treating text strings/comments as graphics.
 * Inline images are deliberately unsupported for contour verification. */
function tokens(text: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < text.length;) {
    const c = text[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '%') { while (i < text.length && !/[\r\n]/.test(text[i])) i++; continue; }
    if (c === '(') {
      let depth = 1; i++;
      while (i < text.length && depth) { if (text[i] === '\\') i += 2; else { if (text[i] === '(') depth++; if (text[i] === ')') depth--; i++; } }
      if (depth) throw new Error('Ugyldig PDF-streng.');
      result.push('STRING'); continue;
    }
    if (c === '<' && text[i + 1] !== '<') { const end = text.indexOf('>', i); if (end < 0) throw new Error('Ugyldig PDF-streng.'); i = end + 1; result.push('STRING'); continue; }
    if ('[]<>{}'.includes(c)) { result.push(c); i++; continue; }
    const start = i++;
    while (i < text.length && !/[\s()[\]<>{}%/]/.test(text[i])) i++;
    result.push(text.slice(start, i));
  }
  return result;
}
const cache = new WeakMap<ArrayBuffer, Promise<PdfContourInspection[]>>();
export async function inspectPdfCutContours(bytes: ArrayBuffer, pageIndex: number): Promise<PdfContourInspection> {
  let cached = cache.get(bytes);
  if (!cached) {
    cached = inspectDocument(bytes);
    cache.set(bytes, cached);
  }
  return (await cached)[pageIndex] || { paths: 0, valid: false };
}
async function inspectDocument(bytes: ArrayBuffer): Promise<PdfContourInspection[]> {
  const document = await PDFDocument.load(bytes);
  const isNamedSpace = (value: unknown): boolean => {
    if (!(value instanceof PDFArray)) return false;
    const kind = value.lookup(0)?.toString();
    const names = kind === '/Separation' ? [value.lookup(1)] : kind === '/DeviceN' && value.lookup(1) instanceof PDFArray ? (value.lookup(1) as PDFArray).asArray().map(ref => document.context.lookup(ref)) : [];
    return names.some(name => cutNames.has(String(name).toLowerCase()));
  };
  return document.getPages().map(page => {
    const result: PdfContourInspection = { paths: 0, valid: true };
    let operations = 0;
    const visit = (stream: PDFRawStream, resources: PDFDict, inherited: boolean, ancestors: Set<PDFRawStream>) => {
      if (ancestors.has(stream) || ancestors.size > 32) throw new Error('Ugyldig PDF-ressourcegraf.');
      const nextAncestors = new Set(ancestors).add(stream);
      let namedStroke = inherited;
      const states: boolean[] = [], operands: string[] = [];
      let starts: number[][] = [], first: number[] | null = null, current: number[] | null = null, closed = false, drawn = 0, points: number[][] = [], closedEarly = false;
      const reset = () => { starts = []; first = current = null; closed = false; drawn = 0; points = []; closedEarly = false; };
      const numbers = (count: number) => { const values = operands.slice(-count).map(Number); if (values.length !== count || values.some(n => !Number.isFinite(n))) throw new Error('Ugyldig PDF-sti.'); return values; };
      for (const token of tokens(new TextDecoder('latin1').decode(decodePDFRawStream(stream).decode()))) {
        if (++operations > 1000000) throw new Error('PDF-stien er for kompleks.');
        if (token.startsWith('/') || /^[-+.\d]/.test(token) || ['[', ']', '<', '>', 'STRING'].includes(token)) { operands.push(token); continue; }
        if (token === 'BI') throw new Error('PDF med inline-billeder skal klargøres før konturkontrol.');
        if (token === 'q') states.push(namedStroke);
        else if (token === 'Q') { if (!states.length) throw new Error('Ugyldig PDF-grafiktilstand.'); namedStroke = states.pop()!; }
        else if (token === 'CS') {
          const name = operands[operands.length - 1]!;
          let color = resources.lookupMaybe(PDFName.of('ColorSpace'), PDFDict)?.lookup(PDFName.of(name.slice(1)));
          if (color instanceof PDFName) color = resources.lookupMaybe(PDFName.of('ColorSpace'), PDFDict)?.lookup(color);
          namedStroke = isNamedSpace(color);
        } else if (['RG', 'K', 'G'].includes(token)) namedStroke = false;
        else if (token === 'm') { current = numbers(2); first = current; starts.push(current); points.push(current); if (closed) closedEarly = true; closed = false; }
        else if (['l', 'c', 'v', 'y'].includes(token)) {
          if (!current || closed) closedEarly = true;
          const values = numbers(token === 'c' ? 6 : token === 'l' ? 2 : 4);
          for (let j = 0; j < values.length; j += 2) points.push(values.slice(j, j + 2));
          current = values.slice(-2); drawn++;
        } else if (token === 'h') { closed = true; current = first; }
        else if (token === 're') {
          const [x, y, w, h] = numbers(4); starts.push([x, y]); first = current = [x, y]; closed = true; drawn += 4;
          points.push([x, y], [x + w, y + h]);
        } else if (['S', 's', 'B', 'B*', 'b', 'b*', 'f', 'f*', 'n'].includes(token)) {
          if (namedStroke && ['S', 's', 'B', 'B*', 'b', 'b*'].includes(token)) {
            result.paths += starts.length;
            const closes = closed || ['s', 'b', 'b*'].includes(token) || Boolean(first && current && first.every((v, j) => Math.abs(v - current![j]) < 1e-7));
            const spans = points.length && [0, 1].every(j => Math.max(...points.map(p => p[j])) - Math.min(...points.map(p => p[j])) > 1e-7);
            if (starts.length !== 1 || !closes || !spans || !drawn || closedEarly) result.valid = false;
          }
          reset();
        } else if (token === 'Do') {
          const value = resources.lookupMaybe(PDFName.of('XObject'), PDFDict)?.lookup(PDFName.of((operands[operands.length - 1] || '').slice(1)));
          if (value instanceof PDFRawStream && value.dict.get(PDFName.of('Subtype'))?.toString() === '/Form') visit(value, value.dict.lookupMaybe(PDFName.of('Resources'), PDFDict) || resources, namedStroke, nextAncestors);
        }
        operands.length = 0;
      }
      if (states.length) throw new Error('Ugyldig PDF-grafiktilstand.');
    };
    try {
      const resources = page.node.Resources();
      const contents = page.node.Contents();
      if (resources && contents) {
        // A page's array of content streams is one graphics program; concatenate
        // before parsing so q/Q, colour state and paths survive stream boundaries.
        const streams = contents instanceof PDFArray ? contents.asArray().map(ref => document.context.lookup(ref)) : [contents];
        const decoded = streams.map(stream => { if (!(stream instanceof PDFRawStream)) throw new Error('Ugyldig PDF-stream.'); return decodePDFRawStream(stream).decode(); });
        const combined = new Uint8Array(decoded.reduce((n, b) => n + b.length + 1, 0));
        let offset = 0; for (const data of decoded) { combined.set(data, offset); offset += data.length; combined[offset++] = 10; }
        visit(document.context.flateStream(combined), resources, false, new Set());
      }
    } catch { result.valid = false; }
    return result;
  });
}
