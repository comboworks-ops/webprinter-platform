/** Candidate 005: sampled from the verified magenta cut paths and cyan creases.
 * Millimetres in outside-PDF coordinates, including the 5 mm bleed.
 * Nominal 3 mm capacity; the cover crease pair is 3.51 mm apart in this template.
 * The blank/grey second PDF spread is a NON-PRINTING inside reference (4+0).
 * Only this exact no-finish fingerprint has been verified for this revision.
 */
import type { Point } from './folderDefinition.ts';
export type SpinePanelId = 'back' | 'spine' | 'cover' | 'side-spine' | 'side' | 'bottom-spine' | 'bottom';
export type SpineFoldId = 'cover' | 'side' | 'bottom';
export interface SpineFolderPanel {
  id: SpinePanelId; parent: SpinePanelId | null; hinge: Point; axis: 'x' | 'y';
  fold: SpineFoldId | null; outline: readonly Point[]; cuts?: readonly (readonly Point[])[];
}
export interface SpineFolderDefinition {
  id: string; templateHash: string; sheetWidthMm: number; sheetHeightMm: number; bleedMm: number;
  nominalSpineMm: number; spineMm: number; displayThicknessMm: number;
  centre: Point; panels: readonly SpineFolderPanel[];
}
export const A4_THREE_MM_FOLDER: SpineFolderDefinition = {
  id: 'a4-two-flap-3mm-4plus0-r1',
  templateHash: '125300eebdcbbccae662396dc3860b93bc36542e9be1411a28291f65dc1808ad',
  sheetWidthMm: 499.999, sheetHeightMm: 368.999, bleedMm: 5,
  nominalSpineMm: 3, spineMm: 3.51, displayThicknessMm: .3, centre: [169.01,156.005],
  panels: [
    {"id":"back","parent":null,"hinge":[61.49,5],"axis":"y","fold":null,"outline":[[61.49,5],[276.53,5],[276.53,307.01],[61.49,307.01]]},
    {"id":"spine","parent":"back","hinge":[276.53,5],"axis":"y","fold":"cover","outline":[[276.53,5],[280.04,5],[280.04,307.01],[276.53,307.01]]},
    {"id":"cover","parent":"spine","hinge":[280.04,5],"axis":"y","fold":"cover","outline":[[280.04,5],[495,5],[495,306.93],[280.04,306.93]]},
    {"id":"side-spine","parent":"back","hinge":[61.49,5],"axis":"y","fold":"side","outline":[[58.5,5],[61.49,5],[61.49,306.08],[58.5,306.08]]},
    {"id":"side","parent":"side-spine","hinge":[58.5,5],"axis":"y","fold":"side","outline":[[58.5,5],[58.5,306.0],[57.53,305.799],[13.139,297.143],[11.458,296.65],[9.911,295.889],[8.526,294.888],[7.331,293.679],[6.353,292.291],[5.62,290.754],[5.16,289.099],[5.0,287.356],[5.0,24.674],[5.185,22.969],[5.647,21.35],[6.366,19.844],[7.318,18.48],[8.483,17.284],[9.839,16.286],[11.364,15.512],[13.036,14.99],[58.471,4.998]],"cuts":[[[17.26,261.6],[17.23,263.19],[17.189,265.167],[17.157,266.754],[18.279,267.877],[20.05,269.647],[41.883,291.477],[44.093,291.477],[45.35,291.48],[46.93,291.48]]]},
    {"id":"bottom-spine","parent":"back","hinge":[61.49,307.01],"axis":"x","fold":"bottom","outline":[[61.49,307.01],[275.5,307.01],[275.5,310],[61.49,310]]},
    {"id":"bottom","parent":"bottom-spine","hinge":[61.49,310],"axis":"x","fold":"bottom","outline":[[61.49,310],[275.5,310],[275.346,311.038],[266.279,355.964],[265.904,357.334],[265.352,358.614],[264.64,359.79],[263.782,360.85],[262.793,361.779],[261.687,362.565],[260.479,363.193],[259.184,363.65],[257.94,363.906],[257.774,363.928],[257.608,363.946],[257.441,363.962],[257.273,363.975],[257.104,363.985],[256.935,363.993],[256.765,363.997],[256.594,363.998],[256.491,363.998],[254.904,363.998],[252.456,363.999],[115.548,363.999],[104.319,352.77],[101.669,352.72],[100.446,352.697],[98.859,352.667],[99.998,353.772],[101.193,354.93],[102.258,355.964],[102.361,355.964],[102.196,356.074],[102.029,356.183],[101.862,356.291],[101.694,356.396],[101.525,356.5],[101.355,356.603],[101.185,356.703],[101.013,356.802],[98.701,357.941],[97.729,358.319],[96.741,358.649],[95.74,358.928],[94.728,359.158],[93.708,359.337],[92.681,359.466],[91.65,359.543],[90.616,359.569],[90.041,359.559],[89.473,359.532],[88.91,359.487],[88.35,359.427],[87.789,359.353],[87.226,359.265],[86.658,359.165],[86.083,359.054],[83.042,358.206],[80.203,356.923],[77.602,355.244],[75.278,353.208],[73.268,350.853],[71.609,348.218],[70.339,345.342],[69.496,342.263],[69.385,341.751],[69.285,341.225],[69.197,340.686],[69.122,340.138],[69.062,339.586],[69.017,339.032],[68.99,338.481],[68.98,337.936],[69.014,336.75],[69.116,335.568],[69.286,334.393],[69.521,333.229],[69.824,332.081],[70.191,330.953],[70.624,329.847],[71.122,328.768],[71.733,327.634],[71.833,327.463],[71.936,327.293],[72.04,327.125],[72.146,326.957],[72.253,326.79],[72.363,326.624],[72.474,326.459],[72.587,326.296],[73.691,327.436],[74.676,328.452],[75.781,329.593],[75.751,328.005],[75.702,325.42],[75.677,324.133],[61.562,309.916]],"cuts":[[[255.564,332.064],[255.361,332.068],[255.16,332.081],[254.961,332.101],[254.765,332.129],[254.57,332.165],[254.378,332.208],[254.189,332.259],[254.002,332.317],[252.125,333.456],[251.795,333.807],[251.5,334.189],[251.242,334.6],[251.025,335.038],[250.851,335.5],[250.723,335.984],[250.645,336.488],[250.618,337.009],[250.662,337.657],[250.791,338.282],[250.999,338.878],[251.28,339.439],[251.627,339.96],[252.035,340.434],[252.497,340.854],[253.007,341.216],[254.005,341.691],[254.191,341.751],[254.38,341.804],[254.572,341.849],[254.766,341.886],[254.962,341.915],[255.161,341.937],[255.361,341.949],[255.564,341.954]],[[200.649,314.964],[200.649,314.931],[200.649,314.907],[200.649,314.892],[200.649,314.887],[200.649,314.892],[200.649,314.907],[200.649,314.931],[200.649,314.964],[200.653,315.148],[200.663,315.33],[200.679,315.51],[200.701,315.688],[200.73,315.865],[200.765,316.039],[200.805,316.211],[200.852,316.381],[201.968,318.373],[202.328,318.732],[202.721,319.054],[203.143,319.334],[203.593,319.57],[204.066,319.759],[204.56,319.897],[205.071,319.983],[205.595,320.012],[206.287,319.965],[206.946,319.826],[207.567,319.603],[208.145,319.302],[208.674,318.929],[209.149,318.491],[209.564,317.994],[209.913,317.444],[210.346,316.382],[210.391,316.212],[210.43,316.04],[210.463,315.865],[210.491,315.689],[210.512,315.51],[210.528,315.33],[210.537,315.148],[210.54,314.964],[210.54,314.931],[210.54,314.906],[210.54,314.892],[210.54,314.887],[210.54,314.892],[210.54,314.906],[210.54,314.931],[210.54,314.964]]]},
  ],
};
const unit = (n: number) => Math.max(0, Math.min(1, n));
/** Open cover first, then bottom pocket, then side pocket; reverse for closure. */
export function spineFolderPose(openPercent: number, d: SpineFolderDefinition = A4_THREE_MM_FOLDER) {
  const opening = Math.max(0, Math.min(100, openPercent));
  const bottom = (1 - unit((opening - 45) / 25)) * Math.PI / 2;
  const side = -(1 - unit((opening - 70) / 30)) * Math.PI / 2;
  const bottomDepth = d.panels.find(p => p.id === 'bottom')!.hinge[1]
    - d.panels.find(p => p.id === 'bottom-spine')!.hinge[1];
  // Allocate illustrative bend clearance within the measured cover depth.
  // Retains the approved 3/5 mm allowances; the tighter 10 mm crease pair
  // needs slightly more of the pocket separation on the side-pocket fold.
  const bottomAllowance = Math.min(d.displayThicknessMm * .55,
    Math.max(0, d.spineMm - bottomDepth - d.displayThicknessMm - .01));
  const sideAllowance = d.displayThicknessMm * 1.1 - bottomAllowance;
  return {
    cover: (1 - unit(opening / 45)) * Math.PI / 2,
    bottom, side,
    // Small bend allowance avoids coincident pocket faces when closed.
    sideLayer: sideAllowance * Math.abs(Math.sin(side)),
    bottomLayer: -bottomAllowance * Math.sin(bottom),
  };
}
export function assertSpineFolderPdf(pages: { widthMm: number; heightMm: number }[], d: SpineFolderDefinition) {
  if (pages.length !== 1) throw new Error('4+0 kræver én trykside: ydersiden. Den grå indersidereference skal ikke med i trykfilen.');
  const p = pages[0];
  if (![p.widthMm,p.heightMm].every(Number.isFinite) || Math.abs(p.widthMm-d.sheetWidthMm)>.15 || Math.abs(p.heightMm-d.sheetHeightMm)>.15)
    throw new Error(`PDF’en skal være ${Math.round(d.sheetWidthMm)} × ${Math.round(d.sheetHeightMm)} mm inklusive ${d.bleedMm} mm udfald.`);
}
