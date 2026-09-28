import type { FlatPrintDefinition } from './flatPrintDefinition';
import type { HalfFoldDefinition } from './halfFoldDefinition';
import type { RollFoldDefinition } from './rollFoldDefinition';
import type { ZigzagFoldDefinition } from './zigzagFoldDefinition';
import { folderPreviewColor } from './productFolderPreview';

type NumberedPrintModel =
  | { kind: 'flat'; definition: FlatPrintDefinition }
  | { kind: 'half'; definition: HalfFoldDefinition }
  | { kind: 'roll'; definition: RollFoldDefinition }
  | { kind: 'zigzag'; definition: ZigzagFoldDefinition };

// Reader page order, mapped onto the supplier's two print spreads.
// A zigzag's last page is on spread 2; a roll fold's is on spread 1.
const PAGE_ORDER = {
  flat: { outside: [1], inside: [] },
  half: { outside: [4, 1], inside: [2, 3] },
  roll: { outside: [5, 6, 1], inside: [2, 3, 4] },
  zigzag: { outside: [4, 5, 1], inside: [2, 3, 6] },
} as const;

/** Shared illustration standard: shop colour, large white numbers, front/back.
 * Only used without customer artwork. Does not grant product eligibility. */
export function createNumberedPrintSpread(model: NumberedPrintModel, side: 'outside' | 'inside', primary?: string): string {
  const d = model.definition;
  const pages = PAGE_ORDER[model.kind][side];
  const totalPages = model.kind === 'flat' ? 1 : model.kind === 'half' ? 4 : 6;
  const widths = model.kind === 'flat' ? [model.definition.trim.width]
    : model.kind === 'half' ? [model.definition.panelWidthMm, model.definition.panelWidthMm]
    : side === 'inside' ? [...model.definition.panelWidthsMm] : [...model.definition.panelWidthsMm].reverse();
  const height = model.kind === 'flat' ? model.definition.trim.height : model.definition.heightMm;
  const top = model.kind === 'flat' ? model.definition.trim.y : model.definition.bleedMm;
  let left = model.kind === 'flat' ? model.definition.trim.x : model.definition.bleedMm;
  const scale = 6;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(d.sheetWidthMm * scale);
  canvas.height = Math.round(d.sheetHeightMm * scale);
  const c = canvas.getContext('2d');
  if (!c) throw new Error('Forhåndsvisningen kunne ikke oprettes.');
  c.scale(scale, scale);
  c.fillStyle = folderPreviewColor(primary);
  c.fillRect(0, 0, d.sheetWidthMm, d.sheetHeightMm);
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  for (const [i, page] of pages.entries()) {
    const width = widths[i], centreX = left + width / 2;
    const numberSize = Math.min(width * .68, height * .48);
    // Centre the visible glyph and its caption together, independent of font ascenders.
    const number = String(page);
    c.font = `700 ${numberSize}px Arial, sans-serif`;
    const metrics = c.measureText(number);
    const labelSize = Math.min(width * .105, height * .075);
    const label = page === 1 ? 'Forside' : page === totalPages ? 'Bagside' : '';
    const glyphHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    // Reserve the caption row on every page so the numbers share a baseline.
    const gap = labelSize * .9;
    const blockHeight = glyphHeight + gap + labelSize;
    const numberTop = top + (height - blockHeight) / 2;
    c.fillText(number, centreX, numberTop + metrics.actualBoundingBoxAscent);
    if (label) {
      c.font = `600 ${labelSize}px Arial, sans-serif`;
      c.fillText(label, centreX, numberTop + glyphHeight + gap + labelSize);
    }
    left += width;
  }
  return canvas.toDataURL('image/png');
}
