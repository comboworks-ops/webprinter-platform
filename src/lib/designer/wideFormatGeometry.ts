import { gulvfolieShapes } from './gulvfolieShapes.js';
import type { DesignerTemplateLaunch } from './productTemplateLinks.ts';

export type WideFormatShape = { id: string; label: string; kind: 'rectangle' | 'freeform' | 'preset'; ratio?: number; path?: string; sourceSha256?: string };
export const rectangleShape: WideFormatShape = { id: 'rectangle', label: 'Rektangel', kind: 'rectangle' };
export const wideFormatShapes: readonly WideFormatShape[] = [rectangleShape, ...gulvfolieShapes];
const shapeById = new Map(wideFormatShapes.map(shape => [shape.id, shape]));
const sourceShapeByValue = new Map(gulvfolieShapes.map(shape => [shape.valueId as string, shape as WideFormatShape]));

/** Source-owned IDs and explicit remapped source bindings; names alone never select a supplier die. */
export type WideFormatShapeBinding = { key: string; shapeId: string };
export function readWideFormatShapeBindings(specifications: unknown): WideFormatShapeBinding[] {
  if (!specifications || typeof specifications !== 'object') return [];
  const review = (specifications as { supplier_import_review?: { runId?: string; sourceBindings?: WideFormatShapeBinding[] } }).supplier_import_review;
  return review?.runId === 'wmd-gulvfolie-2026-09-30' && Array.isArray(review.sourceBindings) ? review.sourceBindings.filter(binding => binding && typeof binding.key === 'string' && typeof binding.shapeId === 'string' && shapeById.has(binding.key)) : [];
}
export function resolveWideFormatShape(values: readonly { id?: string; name: string; group_label?: string | null }[], bindings: readonly WideFormatShapeBinding[] = []): WideFormatShape | null {
  const candidates = values.flatMap(value => {
    const shape = sourceShapeByValue.get(value.id || '') || shapeById.get(bindings.find(binding => binding.shapeId === value.id)?.key || '');
    return shape ? [shape] : [];
  });
  return candidates.length === 1 ? candidates[0] : values.length === 0 ? rectangleShape : null;
}
export function proportionalSize(shape: WideFormatShape | null, width: number, height: number, edited: 'width' | 'height' = 'width') {
  if (!shape?.ratio) return { width, height };
  const round = (n: number) => Math.round(n * 1000000) / 1000000;
  return edited === 'width' ? { width, height: round(width / shape.ratio) } : { width: round(height * shape.ratio), height };
}
export function isProportionalSize(shape: WideFormatShape, width: number, height: number) {
  return !shape.ratio || Math.abs(width / shape.ratio - height) < 0.0001;
}
// Existing production PDF export permits 5080 mm including the two 3 mm bleeds.
export function wideFormatTemplateUrl(shape: WideFormatShape, widthMm: number, heightMm: number) {
  if (shape.kind === 'freeform' || ![widthMm, heightMm].every(n => Number.isFinite(n) && n >= 1 && n <= 5074) || !isProportionalSize(shape, widthMm, heightMm)) return null;
  return `/api/wide-format-template?v=1&shape=${encodeURIComponent(shape.id)}&widthMm=${widthMm}&heightMm=${heightMm}`;
}
export function readWideFormatTemplate(url: string | null): { shape: WideFormatShape; widthMm: number; heightMm: number } | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, 'https://template.local');
    if (parsed.pathname !== '/api/wide-format-template' || parsed.searchParams.get('v') !== '1') return null;
    const shape = shapeById.get(parsed.searchParams.get('shape') || '');
    const widthMm = Number(parsed.searchParams.get('widthMm')), heightMm = Number(parsed.searchParams.get('heightMm'));
    return shape && wideFormatTemplateUrl(shape, widthMm, heightMm) ? { shape, widthMm, heightMm } : null;
  } catch { return null; }
}
export function wideFormatTemplateLaunch(shape: WideFormatShape | null, widthMm: number, heightMm: number): DesignerTemplateLaunch | null {
  if (!shape) return null;
  const pdfUrl = wideFormatTemplateUrl(shape, widthMm, heightMm);
  return pdfUrl ? { name: `${shape.label} ${widthMm} x ${heightMm} mm.pdf`, pdfUrl, widthMm, heightMm, bleedMm: 3, safeMm: 3 } : null;
}
export function wideFormatCutSvg(shape: WideFormatShape, widthMm: number, heightMm: number) {
  if (shape.kind !== 'preset' || !shape.path || !isProportionalSize(shape, widthMm, heightMm)) return null;
  // Normalised paths use width=1; height follows the source outline ratio.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 1 ${1 / shape.ratio!}"><path d="${shape.path}" fill="none" stroke="#ff00ff" stroke-width="0.0001"/></svg>`;
}

export type SavedWideFormatRules = { version: 1; requiresCutContour: boolean; templateUrl: string | null };
export function readSavedWideFormatRules(snapshot: unknown): SavedWideFormatRules | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const rules = (snapshot as { wideFormatRules?: SavedWideFormatRules }).wideFormatRules;
  if (rules?.version !== 1 || typeof rules.requiresCutContour !== 'boolean') return null;
  if (rules.templateUrl !== null && !readWideFormatTemplate(rules.templateUrl)) return null;
  return rules;
}
