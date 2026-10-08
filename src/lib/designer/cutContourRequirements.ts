/** Optional source contract. Absence retains the established generic export. */
export type CutContourRequirements = {
  version: 1;
  spotName: 'Cutkontur';
  lineWidthPt: 0.25;
  tint: 1;
  alternateCmyk: readonly [0, 1, 0, 0];
  separateLayer: true;
  strokeOverprint: true;
};
export const ROLL_LABEL_SPECIAL_CUT_REQUIREMENTS: CutContourRequirements = {
  version: 1, spotName: 'Cutkontur', lineWidthPt: 0.25, tint: 1,
  alternateCmyk: [0, 1, 0, 0], separateLayer: true, strokeOverprint: true,
};
export function assertCutContourRequirements(value: CutContourRequirements): void {
  if (value?.version !== 1 || value.spotName !== 'Cutkontur' || value.lineWidthPt !== 0.25
    || value.tint !== 1 || value.separateLayer !== true || value.strokeOverprint !== true
    || !Array.isArray(value.alternateCmyk) || value.alternateCmyk.length !== 4
    || value.alternateCmyk.some((n, i) => n !== [0, 1, 0, 0][i])) {
    throw new Error('Produktets krav til skærelinjen kunne ikke bekræftes.');
  }
}
