/** Candidate 004: equal-width accordion, with the back on PDF spread 2. */
export const DIN_LANG_ZIGZAG_FOLD = {
  id: 'din-lang-zigzag-fold-r1',
  templateHash: 'dd83c95a4916f8076054c7bf835858c223968557d23844e830b1dba72e1985ce',
  sheetWidthMm: 303, sheetHeightMm: 216, bleedMm: 3,
  panelWidthsMm: [99, 99, 99] as const, heightMm: 210, displayThicknessMm: .15,
} as const;
export type ZigzagFoldDefinition = typeof DIN_LANG_ZIGZAG_FOLD;
export interface ZigzagFoldArtwork { outside: string; inside: string }
export type ZigzagSpreadSide = 'outside' | 'inside';

export function zigzagFoldUv(insideX: number, topY: number, side: ZigzagSpreadSide, d: ZigzagFoldDefinition) {
  const width = d.panelWidthsMm.reduce((a, b) => a + b, 0);
  const x = side === 'inside' ? insideX : width - insideX;
  return [(d.bleedMm + x) / d.sheetWidthMm, 1 - (d.bleedMm + topY) / d.sheetHeightMm] as const;
}

/** Both end panels rotate by +angle in world Y: left travels forward, right backward.
 * Along the sheet the two relative crease turns are -angle and +angle (valley/mountain).
 */
export function zigzagFoldPose(openPercent: number, d: ZigzagFoldDefinition) {
  const opening = Math.max(0, Math.min(100, openPercent));
  const angle = (1 - opening / 100) * Math.PI;
  const radius = (d.displayThicknessMm + .1) / 2;
  return { coverAngle: angle, backAngle: angle, coverHingeZ: radius, backHingeZ: -radius, centreX: d.panelWidthsMm[1] / 2 };
}

export function assertZigzagFoldPdf(pages: { widthMm: number; heightMm: number }[], d: ZigzagFoldDefinition) {
  if (pages.length !== 2) throw new Error('PDF’en skal have to opslag: side 1 = 4–5–1, side 2 = 2–3–6.');
  for (const [i, p] of pages.entries()) {
    if (![p.widthMm, p.heightMm].every(Number.isFinite) || Math.abs(p.widthMm - d.sheetWidthMm) > .15 || Math.abs(p.heightMm - d.sheetHeightMm) > .15) {
      throw new Error(`PDF-side ${i + 1} skal være 303 × 216 mm inklusive 3 mm udfald. Brug hele opslag, ikke seks enkeltsider.`);
    }
  }
}
