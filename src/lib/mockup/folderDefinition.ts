/** Coordinates are millimetres on the OUTSIDE print sheet, including bleed.
 * Bind reviewed constructions by template fingerprint, never by product title/A4 size.
 * Source: salgsmappe-a4-1mm-ryg-4plus0-yderside.pdf, 494 × 366 mm.
 */
export type FoldId = 'cover' | 'side' | 'bottom';
export type Point = readonly [number, number];
export interface FolderPanel {
  id: 'back' | FoldId;
  label: string;
  outline: readonly Point[];
  hinge: Point;
  axis: 'x' | 'y';
  closedAngle: number;
  layer: number;
  cuts?: readonly (readonly Point[])[];
}
export interface FolderDefinition {
  id: string;
  label: string;
  sheetWidthMm: number;
  sheetHeightMm: number;
  origin: Point;
  print: '4+0';
  panels: readonly FolderPanel[];
}

export const A4_FOLDER_OUTSIDE_HASH = '3b275741a4a7936f5b57924f22e0e03acebf5cfba9b6e6e850ede758597ac5a5';
export const A4_FOLDER = {
  id: 'a4-two-flaps-1mm-4plus0', label: 'A4 · to klapper · 1 mm ryg',
  sheetWidthMm: 494, sheetHeightMm: 366, origin: [166.5, 156], print: '4+0',
  panels: [
    { id: 'back', label: 'Bagside', outline: [[59, 5], [274, 5], [274, 307], [59, 307]], hinge: [59, 5], axis: 'y', closedAngle: 0, layer: 0 },
    { id: 'cover', label: 'Forside', outline: [[274, 5], [489, 5], [489, 306.98], [274, 306.98]], hinge: [274, 5], axis: 'y', closedAngle: Math.PI, layer: -2 },
    { id: 'side', label: 'Sideklap', outline: [[59, 5], [59, 306], [13.1, 297.1], [9, 295], [6, 291], [5, 287.29], [5, 24.78], [6, 21], [9, 17], [12.88, 15.01]], hinge: [59, 5], axis: 'y', closedAngle: -Math.PI, layer: -0.55,
      cuts: [[[47.36, 291.54], [42.35, 291.49], [17.59, 266.75], [17.68, 261.59]]] },
    { id: 'bottom', label: 'Bundklap', outline: [[59, 307], [273, 307], [263.57, 353.01], [262, 357], [258, 360], [253.77, 361], [113.03, 361], [101.79, 349.77], [96.32, 349.67], [99.69, 353.04], [94, 356], [88, 356.7], [83.53, 356.12], [76, 353], [70, 347], [66.79, 339.39], [66.2, 332], [68.44, 325.73], [69.87, 323.23], [73.24, 326.6], [73.14, 321.13]], hinge: [59, 307], axis: 'x', closedAngle: Math.PI, layer: -1.1,
      cuts: [[[253, 342], [250, 341], [248, 338], [248, 336], [250, 333], [253, 332]], [[208, 315], [207, 318], [204, 320], [202, 320], [199, 318], [198, 315]]] },
  ],
} as const satisfies FolderDefinition;

// The original two-page 4+0 PDF has a grey, NON-PRINTING inside reference page.
// Both fingerprints describe the same single printed surface.
const bindings = new Set([A4_FOLDER_OUTSIDE_HASH, '300a54250aea3b6e554a0e9723f2a2ef1e79e2f4ff3dd8649b9582bd7f45633e']);
export function resolveFolderDefinition(hash: string | null | undefined, widthMm: number, heightMm: number): FolderDefinition | null {
  return bindings.has(hash?.toLowerCase() ?? '') && Number.isFinite(widthMm) && Number.isFinite(heightMm)
    && Math.abs(widthMm - A4_FOLDER.sheetWidthMm) < 0.15 && Math.abs(heightMm - A4_FOLDER.sheetHeightMm) < 0.15
    ? A4_FOLDER : null;
}

export interface ArtworkPlacement {
  physicalWidthMm: number;
  physicalHeightMm: number;
  scale: number;
  offsetXPercent: number;
  offsetYPercent: number;
}
export function artworkRect(placement: ArtworkPlacement, sheetWidth: number, sheetHeight: number) {
  const values = [...Object.values(placement), sheetWidth, sheetHeight];
  if (!values.every(Number.isFinite) || placement.scale <= 0 || placement.physicalWidthMm <= 0 || placement.physicalHeightMm <= 0 || sheetWidth <= 0 || sheetHeight <= 0) {
    throw new Error('Filens mål eller placering kunne ikke læses.');
  }
  const width = placement.physicalWidthMm * placement.scale;
  const height = placement.physicalHeightMm * placement.scale;
  return { x: sheetWidth * (0.5 + placement.offsetXPercent / 100) - width / 2,
    y: sheetHeight * (0.5 + placement.offsetYPercent / 100) - height / 2, width, height };
}
export function sheetUv(point: Point, definition: FolderDefinition): Point {
  return [point[0] / definition.sheetWidthMm, 1 - point[1] / definition.sheetHeightMm];
}
export type FoldState = Record<FoldId, boolean>; // true = unfolded
export const CLOSED_FOLDS: FoldState = { cover: false, side: false, bottom: false };
export const OPEN_FOLDS: FoldState = { cover: true, side: true, bottom: true };
export function toggleFold(state: FoldState, id: FoldId): FoldState {
  const next = { ...state, [id]: !state[id] };
  if (id === 'cover' && !next.cover) return { ...CLOSED_FOLDS };
  // Open the cover to give the selected pocket room to unfold.
  if (id !== 'cover') next.cover = true;
  return next;
}
