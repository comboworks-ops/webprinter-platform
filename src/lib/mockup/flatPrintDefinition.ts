/** Geometry only; storefront eligibility is granted by approvedPrintModels. */
export interface FlatPrintDefinition {
  id: string;
  templateHash: string;
  sheetWidthMm: number;
  sheetHeightMm: number;
  trim: { x: number; y: number; width: number; height: number };
  print: '4+0';
  displayThicknessMm: number;
}

/** Exact downloaded PDF: Media/Crop/BleedBox 80 × 111; TrimBox [3,3,77,108].
 * 0.15 mm is an illustrative edge only, not a paper-stock specification.
 */
export const A7_FLYER_CANDIDATE: FlatPrintDefinition = {
  id: 'a7-flat-4plus0-r1',
  templateHash: '6c97a596edf0932a5387c96fbaa63633745427a0d4fb766d6a347260bf41cc56',
  sheetWidthMm: 80, sheetHeightMm: 111,
  trim: { x: 3, y: 3, width: 74, height: 105 },
  print: '4+0', displayThicknessMm: 0.15,
};

export function flatPrintUv(xMm: number, yMm: number, definition: FlatPrintDefinition): readonly [number, number] {
  return [(definition.trim.x + xMm) / definition.sheetWidthMm,
    1 - (definition.trim.y + yMm) / definition.sheetHeightMm];
}

export function assertFlatPrintPdf(pages: number, widthMm: number, heightMm: number, definition: FlatPrintDefinition) {
  if (pages !== 1) throw new Error('Denne 4+0-model kræver en PDF med præcis én side.');
  if (![widthMm, heightMm].every(Number.isFinite)
    || Math.abs(widthMm - definition.sheetWidthMm) > 0.15
    || Math.abs(heightMm - definition.sheetHeightMm) > 0.15) {
    throw new Error(`PDF’en skal være ${definition.sheetWidthMm} × ${definition.sheetHeightMm} mm inklusive udfald. Det færdige format er ${definition.trim.width} × ${definition.trim.height} mm.`);
  }
}
