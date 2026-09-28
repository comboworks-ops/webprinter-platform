import type { Point } from './folderDefinition.ts';

export interface SalesFolderPanel {
  id: string;
  parent: string | null;
  hinge: Point;
  hingeEnd: Point;
  angle: number;
  layer: number;
  outline: readonly Point[];
  holes: readonly (readonly Point[])[];
  cuts: readonly (readonly Point[])[];
  area: number;
  phase: readonly [number, number];
  pageOutside?: number;
  outsideRotation?: number;
  pageInside?: number;
}
export interface SalesFolderDefinition {
  id: string;
  templateHash: string;
  sheetWidthMm: number;
  sheetHeightMm: number;
  bleedMm: number;
  nominalSpineMm: number;
  displayThicknessMm: number;
  centre: Point;
  panels: readonly SalesFolderPanel[];
  insideTransform: 'mirror-x' | 'mirror-y' | 'identity' | 'rotate-180';
  readerPages: number;
}
export interface SalesFolderModel {
  kind: 'sales-folder';
  definition: SalesFolderDefinition;
  label: string;
  pages: 1 | 2;
  templateUrl: string;
  ticket: string;
  artworkMode: string;
  variantLabel: string;
  templatePageCount: number;
}
export function salesFolderPanelAngle(panel: SalesFolderPanel, opening: number): number {
  const [start, end] = panel.phase;
  const remaining = 1 - Math.max(0, Math.min(1, (opening - start) / (end - start)));
  return remaining === 0 ? 0 : panel.angle * remaining;
}
/** The inner PDF is read as viewed from its printed face. Transform UVs, never
 * the uploaded bitmap itself or the outside artwork. */
export function salesFolderInsideUv(d: SalesFolderDefinition, u: number, v: number): Point {
  return [d.insideTransform === 'mirror-x' || d.insideTransform === 'rotate-180' ? 1 - u : u,
    d.insideTransform === 'mirror-y' || d.insideTransform === 'rotate-180' ? 1 - v : v];
}
