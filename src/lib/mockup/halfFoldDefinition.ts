/** Exact candidate 002. Coordinates are millimetres from the inside spread's top left. */
export const DIN_LANG_HALF_FOLD = {
  id: 'din-lang-half-fold-r1',
  templateHash: '6817dc73acd7b0e944ec293e2ada1de8865b62deaa994dc82066bed657bfd3dc',
  sheetWidthMm: 204, sheetHeightMm: 216, bleedMm: 3,
  panelWidthMm: 99, heightMm: 210, displayThicknessMm: .15,
} as const;

export type HalfFoldDefinition = typeof DIN_LANG_HALF_FOLD;
export type SpreadSide = 'outside' | 'inside';
export interface HalfFoldArtwork { outside: string; inside: string }

/** Reverse the sheet's physical X coordinate on the outside, never the text. */
export function halfFoldUv(insideX: number, topY: number, side: SpreadSide, d: HalfFoldDefinition) {
  const x = side === 'inside' ? insideX : 2 * d.panelWidthMm - insideX;
  return [(d.bleedMm + x) / d.sheetWidthMm, 1 - (d.bleedMm + topY) / d.sheetHeightMm] as const;
}

/** A small hinge radius keeps the two paper bodies separate when closed. */
export function halfFoldPose(openPercent: number, d: HalfFoldDefinition) {
  const angle = (1 - Math.max(0, Math.min(100, openPercent)) / 100) * Math.PI;
  const hingeZ = (d.displayThicknessMm + .1) / 2;
  return { angle, hingeZ };
}

export function assertHalfFoldPdf(pages: { widthMm: number; heightMm: number }[], d: HalfFoldDefinition) {
  if (pages.length !== 2) throw new Error('PDF’en skal have to opslag: side 1 = yderside, side 2 = inderside.');
  for (const [i, p] of pages.entries()) {
    if (![p.widthMm, p.heightMm].every(Number.isFinite) || Math.abs(p.widthMm - d.sheetWidthMm) > .15 || Math.abs(p.heightMm - d.sheetHeightMm) > .15) {
      throw new Error(`PDF-side ${i + 1} skal være 204 × 216 mm inklusive 3 mm udfald. Enkeltsider og roterede opslag passer ikke til denne skabelon.`);
    }
  }
}
