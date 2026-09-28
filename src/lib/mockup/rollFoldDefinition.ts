/** Candidate 003: exact two-sided DIN Lang roll fold; not interchangeable with zigzag. */
export const DIN_LANG_ROLL_FOLD = {
  id: 'din-lang-roll-fold-r1',
  templateHash: '90e400cacc56ccbd1843992aedf94c26e63254d649d662613191f9aa94724e9a',
  sheetWidthMm: 303, sheetHeightMm: 216, bleedMm: 3,
  panelWidthsMm: [100, 100, 97] as const, heightMm: 210, displayThicknessMm: .15,
} as const;
export type RollFoldDefinition = typeof DIN_LANG_ROLL_FOLD;
export interface RollFoldArtwork { outside: string; inside: string }
export type RollSpreadSide = 'outside' | 'inside';

export function rollFoldUv(insideX: number, topY: number, side: RollSpreadSide, d: RollFoldDefinition) {
  const width = d.panelWidthsMm.reduce((a, b) => a + b, 0);
  const x = side === 'inside' ? insideX : width - insideX;
  return [(d.bleedMm + x) / d.sheetWidthMm, 1 - (d.bleedMm + topY) / d.sheetHeightMm] as const;
}

/** Opening: cover first, then tucked flap. Closing reverses the same path. */
export function rollFoldPose(openPercent: number, d: RollFoldDefinition) {
  const opening = Math.max(0, Math.min(100, openPercent));
  const coverAngle = (1 - Math.min(1, opening / 50)) * Math.PI;
  const flapAngle = -(1 - Math.max(0, (opening - 50) / 50)) * Math.PI;
  const flapHingeZ = (d.displayThicknessMm + .1) / 2;
  const coverHingeZ = flapHingeZ * 2;
  const [cover, centre, flap] = d.panelWidthsMm;
  const minX = Math.min(0, -cover * Math.cos(coverAngle));
  const maxX = Math.max(centre, centre + flap * Math.cos(flapAngle));
  return { coverAngle, flapAngle, coverHingeZ, flapHingeZ, centreX: (minX + maxX) / 2 };
}

export function assertRollFoldPdf(pages: { widthMm: number; heightMm: number }[], d: RollFoldDefinition) {
  if (pages.length !== 2) throw new Error('PDF’en skal have to opslag: side 1 = yderside, side 2 = inderside.');
  for (const [i, p] of pages.entries()) {
    if (![p.widthMm, p.heightMm].every(Number.isFinite) || Math.abs(p.widthMm - d.sheetWidthMm) > .15 || Math.abs(p.heightMm - d.sheetHeightMm) > .15) {
      throw new Error(`PDF-side ${i + 1} skal være 303 × 216 mm inklusive 3 mm udfald. Brug hele opslag, ikke seks enkeltsider.`);
    }
  }
}
