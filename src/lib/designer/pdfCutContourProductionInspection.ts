import { PDFArray, PDFBool, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef, PDFString, decodePDFRawStream } from 'pdf-lib';
import { inspectPdfCutContours, pdfGraphicsTokens } from './pdfCutContourInspection.ts';
import { assertCutContourRequirements, type CutContourRequirements } from './cutContourRequirements.ts';

type Matrix = [number, number, number, number, number, number];
type Point = [number, number];
// A null clip means its containment cannot be proved (curves, holes, text).
// Clips belong to graphics state; the current path does not (PDF 1.7 §8.5.4).
type Clip = Point[] | null;
type State = { matrix: Matrix; width: number; spot: PDFArray | null; tint: number[]; overprint: boolean; dash: boolean;
  clips: Clip[]; lineJoin: number; lineCap: number; miterLimit: number; textMode: number };
export type PdfCutProductionInspection = { paths: number; valid: boolean; violations: string[] };
const name = (s: string) => PDFName.of(s);
const equal = (a: number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-7);
const array = (v: unknown) => v instanceof PDFArray ? v.asArray().map((_, i) => Number(v.lookup(i)?.toString())) : [];
const multiply = (a: Matrix, b: Matrix): Matrix => [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
const clone = (s: State): State => ({ ...s, matrix: [...s.matrix], tint: [...s.tint], clips: [...s.clips] });
const transform = (m: Matrix, x: number, y: number): Point => [m[0]*x+m[2]*y+m[4], m[1]*x+m[3]*y+m[5]];
const boxClip = (box: number[], m: Matrix): Clip => {
  if (box.length !== 4 || box.some(n => !Number.isFinite(n)) || box[2] <= box[0] || box[3] <= box[1]) return null;
  const p = [[box[0],box[1]],[box[2],box[1]],[box[2],box[3]],[box[0],box[3]]].map(([x,y]) => transform(m,x,y));
  return Math.abs(m[0]*m[3]-m[1]*m[2]) > 1e-12 ? p : null;
};
// Bezier curves lie inside their control-point hull. Containment of that hull
// plus a conservative cap/join pen envelope proves the ENTIRE stroked contour
// survives each convex clip; sampling or mere bounding-box overlap cannot.
const containsStroke = (clip: Clip, hull: Point[], radius: number): boolean => {
  if (!clip || !hull.length || !Number.isFinite(radius)) return false;
  const area = clip.reduce((sum, p, i) => { const q = clip[(i+1)%clip.length]; return sum+p[0]*q[1]-q[0]*p[1]; },0);
  if (!Number.isFinite(area) || Math.abs(area) < 1e-12) return false;
  return clip.every((p,i) => {
    const q = clip[(i+1)%clip.length], dx = q[0]-p[0], dy = q[1]-p[1], length = Math.hypot(dx,dy);
    return length > 0 && hull.every(v => Math.sign(area)*(dx*(v[1]-p[1])-dy*(v[0]-p[0]))/length >= radius-1e-7);
  });
};

/** Conservative production inspection; unsupported state fails closed. Geometry
 * remains the existing independent single-closed-path check. No source example
 * geometry or mask readiness is inferred here. */
export async function inspectPdfCutContourProduction(bytes: ArrayBuffer, pageIndex: number, requirements: CutContourRequirements): Promise<PdfCutProductionInspection> {
  assertCutContourRequirements(requirements);
  const geometry = await inspectPdfCutContours(bytes, pageIndex);
  const result: PdfCutProductionInspection = { paths: geometry.paths, valid: geometry.valid, violations: [] };
  const fail = (s: string) => { if (!result.violations.includes(s)) result.violations.push(s); result.valid = false; };
  if (!geometry.valid) fail('geometry');
  try {
    const pdf = await PDFDocument.load(bytes), page = pdf.getPages()[pageIndex];
    if (!page) throw new Error('page');
    const oc = pdf.catalog.lookupMaybe(name('OCProperties'), PDFDict);
    const registered = oc?.lookupMaybe(name('OCGs'), PDFArray)?.asArray() || [];
    const defaults = oc?.lookupMaybe(name('D'), PDFDict);
    const off = defaults?.lookupMaybe(name('OFF'), PDFArray)?.asArray() || [];
    const on = defaults?.lookupMaybe(name('ON'), PDFArray)?.asArray() || [];
    const isRef = (list: unknown[], ref: unknown) => list.some(r => r instanceof PDFRef && ref instanceof PDFRef && r.toString() === ref.toString());
    const layerValid = (ref: unknown) => {
      if (oc?.has(name('Configs')) || defaults?.has(name('AS'))) return false;
      if (!(ref instanceof PDFRef) || !isRef(registered, ref) || isRef(off, ref)
        || (defaults?.lookup(name('BaseState'))?.toString() === '/OFF' && !isRef(on, ref))) return false;
      const layer = pdf.context.lookup(ref);
      if (!(layer instanceof PDFDict) || layer.lookup(name('Type'))?.toString() !== '/OCG'
        || !(layer.lookup(name('Name')) instanceof PDFString)) return false;
      const usage = layer.lookupMaybe(name('Usage'), PDFDict);
      return ['View', 'Print', 'Export'].every(kind => usage?.lookupMaybe(name(kind), PDFDict)?.lookup(name(kind+'State'))?.toString() !== '/OFF');
    };
    let operations = 0, paintedContours = 0;
    const visit = (streams: PDFRawStream[], resources: PDFDict, initial: State, inheritedLayers: unknown[], ancestors: Set<PDFRawStream>) => {
      let state = clone(initial);
      const saved: State[] = [], marked: Array<unknown | null> = [...inheritedLayers];
      const inheritedDepth = marked.length;
      const operands: string[] = [];
      let hull: Point[] = [], rectangle: Clip = null, pathSegments = 0, pendingClip = false, textClipPending = false;
      // Readers disagree with construction-time hull placement when a CTM
      // changes inside an unfinished path. Until painted placement is proved,
      // reject that contour. Like the path, this flag is NOT graphics state:
      // q/Q must not erase a transform observed between construction and paint.
      let pathTransformChanged = false;
      const changeMatrix = (matrix: Matrix) => {
        if (pathSegments && matrix.some((value,i) => value !== state.matrix[i])) pathTransformChanged = true;
        state.matrix = matrix;
      };
      const finishPath = () => {
        // W/W* takes effect AFTER the terminating paint, so a path stroked
        // while establishing a new clip uses the previous clipping state.
        if (pendingClip) {
          if (state.clips.length >= 128) throw new Error('clip_complexity');
          state.clips.push(pathSegments === 1 && !pathTransformChanged ? rectangle : null);
        }
        hull = []; rectangle = null; pathSegments = 0; pendingClip = false; pathTransformChanged = false;
      };
      const numbers = (n: number) => { const v = operands.slice(-n).map(Number); if (v.length !== n || v.some(x => !Number.isFinite(x))) throw new Error('operands'); return v; };
      const activeLayer = () => marked.some(v => v !== null);
      const checkStroke = () => {
        const spot = state.spot;
        const exact = spot?.lookup(0)?.toString() === '/Separation' && spot.lookup(1)?.toString() === '/'+requirements.spotName;
        const cut = spot?.lookup(1)?.toString().toLowerCase();
        if (!['/cutkontur', '/cutcontour'].includes(cut || '')) { if (activeLayer()) fail('layer_contains_artwork'); return; }
        paintedContours++;
        if (pathTransformChanged) fail('contour_path_transform');
        if (!exact) fail('spot_name');
        if (!equal(state.tint, [requirements.tint])) fail('spot_tint');
        const fn = spot?.lookup(3);
        if (spot?.lookup(2)?.toString() !== '/DeviceCMYK' || !(fn instanceof PDFDict)
          || Number(fn.lookup(name('FunctionType'))?.toString()) !== 2 || Number(fn.lookup(name('N'))?.toString()) !== 1
          || !equal(array(fn.lookup(name('Domain'))), [0,1]) || !equal(array(fn.lookup(name('C0'))), [0,0,0,0])
          || (fn.has(name('Range')) && !equal(array(fn.lookup(name('Range'))), [0,1,0,1,0,1,0,1]))
          || !equal(array(fn.lookup(name('C1'))), requirements.alternateCmyk)) fail('alternate_color');
        const [a,b,c,d] = state.matrix, sx = Math.hypot(a,b), sy = Math.hypot(c,d);
        if (!Number.isFinite(sx) || Math.abs(sx-sy)>1e-7 || Math.abs(a*c+b*d)>1e-7
          || Math.abs(state.width*sx-requirements.lineWidthPt)>1e-5) fail('physical_width');
        if (!state.overprint) fail('stroke_overprint');
        if (state.dash) fail('dashed_contour');
        if (!activeLayer() || marked.filter(v => v !== null).some(v => !layerValid(v))) fail('separate_layer');
        const joinFactor = state.lineJoin === 0 ? state.miterLimit : 1;
        const capFactor = state.lineCap === 2 ? Math.SQRT2 : 1;
        const radius = Math.abs(state.width*sx)/2 * Math.max(joinFactor, capFactor);
        if (![0,1,2].includes(state.lineJoin) || ![0,1,2].includes(state.lineCap)
          || !Number.isFinite(state.miterLimit) || state.miterLimit < 1
          || !state.clips.every(clip => containsStroke(clip,hull,radius))) fail('contour_clipping');
      };
      // Concatenate decoded programs: PDF graphics state can span page streams.
      const program = streams.map(s => new TextDecoder('latin1').decode(decodePDFRawStream(s).decode())).join('\n');
      for (const token of pdfGraphicsTokens(program)) {
        if (++operations > 1000000) throw new Error('complexity');
        if (token.startsWith('/') || /^[-+.\d]/.test(token) || ['[',']','<','>','STRING'].includes(token)) { operands.push(token); continue; }
        if (token === 'BI') throw new Error('inline_image');
        if (token === 'q') saved.push(clone(state));
        else if (token === 'Q') {
          if (!saved.length) throw new Error('graphics_stack');
          const restored = saved.pop()!; changeMatrix(restored.matrix); state = restored;
        }
        else if (token === 'cm') changeMatrix(multiply(state.matrix, numbers(6) as Matrix));
        else if (token === 'w') state.width = numbers(1)[0];
        else if (token === 'j') state.lineJoin = numbers(1)[0];
        else if (token === 'J') state.lineCap = numbers(1)[0];
        else if (token === 'M') state.miterLimit = numbers(1)[0];
        else if (['m','l','c','v','y'].includes(token)) {
          const values = numbers(token === 'c' ? 6 : ['v','y'].includes(token) ? 4 : 2);
          for (let i=0; i<values.length; i+=2) hull.push(transform(state.matrix,values[i],values[i+1]));
          pathSegments++; rectangle = null;
        } else if (token === 're') {
          const [x,y,w,h] = numbers(4);
          const box = [Math.min(x,x+w),Math.min(y,y+h),Math.max(x,x+w),Math.max(y,y+h)];
          rectangle = boxClip(box,state.matrix); hull.push(...(rectangle || [])); pathSegments++;
        } else if (['W','W*'].includes(token)) pendingClip = true;
        else if (token === 'n') finishPath();
        else if (token === 'd') state.dash = !(operands[0] === '[' && operands[1] === ']');
        else if (token === 'CS') {
          let value = resources.lookupMaybe(name('ColorSpace'), PDFDict)?.lookup(name(operands.at(-1)!.slice(1)));
          if (value instanceof PDFName) value = resources.lookupMaybe(name('ColorSpace'), PDFDict)?.lookup(value);
          if (value instanceof PDFArray && value.lookup(0)?.toString() === '/DeviceN') throw new Error('unsupported_devicen');
          state.spot = value instanceof PDFArray ? value : null; state.tint = [];
        } else if (['K','RG','G'].includes(token)) { state.spot = null; state.tint = []; }
        else if (['SCN','SC'].includes(token)) state.tint = operands.map(Number);
        else if (token === 'gs') {
          const gs = resources.lookupMaybe(name('ExtGState'), PDFDict)?.lookup(name(operands.at(-1)!.slice(1)));
          if (!(gs instanceof PDFDict)) throw new Error('graphics_resource');
          if (gs.has(name('OP'))) state.overprint = gs.lookup(name('OP')) === PDFBool.True;
          if (gs.has(name('LW'))) state.width = Number(gs.lookup(name('LW'))?.toString());
          if (gs.has(name('LJ'))) state.lineJoin = Number(gs.lookup(name('LJ'))?.toString());
          if (gs.has(name('LC'))) state.lineCap = Number(gs.lookup(name('LC'))?.toString());
          if (gs.has(name('ML'))) state.miterLimit = Number(gs.lookup(name('ML'))?.toString());
          if (gs.has(name('D'))) { const dash = gs.lookup(name('D')); state.dash = !(dash instanceof PDFArray && array(dash.lookup(0)).length === 0); }
          // An invisible, clipped or transformed stroke is not the production
          // line documented by this exact source. Unsupported graphic effects
          // must be flattened/verified separately, never silently accepted.
          if ((gs.has(name('CA')) && Number(gs.lookup(name('CA'))?.toString()) !== 1)
            || (gs.has(name('SMask')) && gs.lookup(name('SMask'))?.toString() !== '/None')) throw new Error('unsupported_stroke_effect');
        } else if (token === 'BDC') {
          if (operands[0] === '/OC') {
            const ref = resources.lookupMaybe(name('Properties'), PDFDict)?.get(name((operands[1] || '').slice(1)));
            if (!ref) throw new Error('layer_resource'); marked.push(ref);
          } else marked.push(null);
        } else if (token === 'BMC') { if (operands[0] === '/OC') throw new Error('layer_resource'); marked.push(null); }
        else if (token === 'EMC') { if (marked.length <= inheritedDepth) throw new Error('layer_stack'); marked.pop(); }
        else if (['S','s','B','B*','b','b*'].includes(token)) { checkStroke(); if (activeLayer() && !['S','s'].includes(token)) fail('layer_contains_fill'); finishPath(); }
        else if (['f','F','f*'].includes(token)) { if (activeLayer()) fail('layer_contains_artwork'); finishPath(); }
        else if (token === 'sh' && activeLayer()) fail('layer_contains_artwork');
        else if (token === 'Tr') { state.textMode = numbers(1)[0]; if (activeLayer()) fail('layer_contains_artwork'); }
        else if (['Tj','TJ',"'",'"'].includes(token)) { if (activeLayer()) fail('layer_contains_artwork'); if (state.textMode >= 4) textClipPending = true; }
        else if (token === 'ET' && textClipPending) { state.clips.push(null); textClipPending = false; }
        else if (token === 'Do') {
          const x = resources.lookupMaybe(name('XObject'), PDFDict)?.lookup(name((operands.at(-1) || '').slice(1)));
          if (x instanceof PDFRawStream && x.dict.lookup(name('Subtype'))?.toString() === '/Form') {
            if (ancestors.has(x) || ancestors.size >= 32) throw new Error('form_cycle');
            const next = clone(state), m = array(x.dict.lookup(name('Matrix')));
            if (m.length) { if (m.length !== 6 || m.some(n => !Number.isFinite(n))) throw new Error('form_matrix'); next.matrix = multiply(next.matrix, m as Matrix); }
            next.clips.push(boxClip(array(x.dict.lookup(name('BBox'))), next.matrix));
            const ownLayer = x.dict.get(name('OC'));
            visit([x], x.dict.lookupMaybe(name('Resources'), PDFDict) || resources, next,
              ownLayer ? [...marked, ownLayer] : marked, new Set(ancestors).add(x));
          } else if (!x) throw new Error('xobject');
          else if (activeLayer()) fail('layer_contains_artwork');
        }
        operands.length = 0;
      }
      if (saved.length || marked.length !== inheritedDepth) throw new Error('unbalanced_program');
    };
    const contents = page.node.Contents(), resources = page.node.Resources();
    const refs = contents instanceof PDFArray ? contents.asArray() : contents ? [contents] : [];
    const streams = refs.map(r => pdf.context.lookup(r));
    if (!resources || streams.some(s => !(s instanceof PDFRawStream))) throw new Error('streams');
    const unit = Number(page.node.lookup(name('UserUnit'))?.toString() || 1);
    if (!Number.isFinite(unit) || unit <= 0) throw new Error('user_unit');
    const matrix: Matrix = [unit,0,0,unit,0,0];
    const pageClip = (box: { x:number; y:number; width:number; height:number }) => boxClip([box.x,box.y,box.x+box.width,box.y+box.height],matrix);
    visit(streams as PDFRawStream[], resources, { matrix, width:1, spot:null, tint:[], overprint:false, dash:false,
      clips:[pageClip(page.getMediaBox()),pageClip(page.getCropBox())], lineJoin:0, lineCap:0, miterLimit:10, textMode:0 }, [], new Set());
    if (paintedContours !== geometry.paths) fail('path_accounting');
  } catch { fail('unsupported_or_malformed_pdf'); }
  return result;
}

export async function assertPdfCutContourProduction(bytes: Uint8Array, requirements: CutContourRequirements): Promise<void> {
  const pdf = await PDFDocument.load(bytes);
  for (let i = 0; i < pdf.getPageCount(); i++) {
    const result = await inspectPdfCutContourProduction(bytes.slice().buffer as ArrayBuffer, i, requirements);
    if (!result.valid || result.paths !== 1) throw new Error('PDF-skærelinjen opfylder ikke produktets krav til spotfarve, stregbredde, separat lag og overprint.');
  }
}

/** Narrow exception to the established optional-layer import block. Only the
 * already inspected production cutting layer may survive this source contract.
 * Other OCGs, visibility configurations and automatic state changes still block. */
export function hasOnlySourceCutLayers(pdf: PDFDocument, requirements: CutContourRequirements): boolean {
  assertCutContourRequirements(requirements);
  const oc = pdf.catalog.lookupMaybe(name('OCProperties'), PDFDict);
  const groups = oc?.lookupMaybe(name('OCGs'), PDFArray);
  const defaults = oc?.lookupMaybe(name('D'), PDFDict);
  if (!groups?.size() || oc?.has(name('Configs')) || defaults?.has(name('AS'))
    || defaults?.lookup(name('BaseState'))?.toString() === '/OFF'
    || (defaults?.lookupMaybe(name('OFF'), PDFArray)?.size() || 0) > 0) return false;
  return groups.asArray().every(ref => {
    const group = pdf.context.lookup(ref);
    if (!(ref instanceof PDFRef) || !(group instanceof PDFDict) || group.lookup(name('Type'))?.toString() !== '/OCG') return false;
    const label = group.lookup(name('Name'));
    if (!(label instanceof PDFString) || label.decodeText() !== requirements.spotName) return false;
    const usage = group.lookupMaybe(name('Usage'), PDFDict);
    return ['View','Print','Export'].every(kind => usage?.lookupMaybe(name(kind), PDFDict)?.lookup(name(kind+'State'))?.toString() !== '/OFF');
  });
}

/** pdf-lib copies form resources but not the source catalogue's OCG registry.
 * Register only production cut OCGs already carried by those copied resources;
 * mixed/hidden/unverified layers still fail the final inspection. */
export function registerCopiedCutContourLayers(pdf: PDFDocument): void {
  const refs: PDFRef[] = [], visited = new Set<PDFDict>();
  const add = (ref: unknown) => { if (!(ref instanceof PDFRef)) return; const d = pdf.context.lookup(ref); if (d instanceof PDFDict && d.lookup(name('Type'))?.toString() === '/OCG' && !refs.some(r => r.toString() === ref.toString())) refs.push(ref); };
  const visit = (r: PDFDict) => {
    if (visited.has(r)) return; if (visited.size > 10000) throw new Error('PDF-ressourcegrafen er for kompleks.'); visited.add(r);
    const properties = r.lookupMaybe(name('Properties'), PDFDict); properties?.entries().forEach(([,ref]) => add(ref));
    r.lookupMaybe(name('XObject'), PDFDict)?.entries().forEach(([,ref]) => {
      const x = pdf.context.lookup(ref); if (x instanceof PDFRawStream && x.dict.lookup(name('Subtype'))?.toString() === '/Form') {
        add(x.dict.get(name('OC'))); const child = x.dict.lookupMaybe(name('Resources'), PDFDict); if (child) visit(child);
      }
    });
  };
  pdf.getPages().forEach(p => { const r = p.node.Resources(); if (r) visit(r); });
  if (!refs.length) return;
  let oc = pdf.catalog.lookupMaybe(name('OCProperties'), PDFDict);
  if (!oc) { oc = pdf.context.obj({ OCGs: [], D: { BaseState:'ON', Order:[] } }); pdf.catalog.set(name('OCProperties'), oc); }
  let groups = oc.lookupMaybe(name('OCGs'), PDFArray); if (!groups) { groups = pdf.context.obj([]); oc.set(name('OCGs'), groups); }
  refs.forEach(ref => { if (!groups!.asArray().some(r => r.toString() === ref.toString())) groups!.push(ref); });
}
