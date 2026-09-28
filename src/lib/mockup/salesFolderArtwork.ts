import { folderPreviewColor } from './productFolderPreview';
import type { SalesFolderDefinition } from './salesFolderDefinition';

export function createSalesFolderArtwork(d: SalesFolderDefinition, side: 'outside' | 'inside', primary?: string): string {
  const scale = Math.min(4, 2200 / Math.max(d.sheetWidthMm, d.sheetHeightMm));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(d.sheetWidthMm * scale); canvas.height = Math.round(d.sheetHeightMm * scale);
  const c = canvas.getContext('2d')!; c.scale(scale, scale);
  c.fillStyle = folderPreviewColor(primary); c.fillRect(0, 0, d.sheetWidthMm, d.sheetHeightMm);
  c.fillStyle = '#fff'; c.textAlign = 'center';
  for (const panel of d.panels) {
    const page = side === 'outside' ? panel.pageOutside : panel.pageInside;
    if (!page) continue;
    const xs = panel.outline.map(p => p[0]), ys = panel.outline.map(p => p[1]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    let x = (Math.min(...xs) + Math.max(...xs)) / 2, y = (Math.min(...ys) + Math.max(...ys)) / 2;
    if (side === 'inside') {
      if (d.insideTransform === 'mirror-x' || d.insideTransform === 'rotate-180') x = d.sheetWidthMm - x;
      if (d.insideTransform === 'mirror-y' || d.insideTransform === 'rotate-180') y = d.sheetHeightMm - y;
    }
    c.save(); c.translate(x, y); if (side === 'outside' && panel.outsideRotation) c.rotate(panel.outsideRotation * Math.PI / 180); x = 0; y = 0;
    const size = Math.min(w * .45, h * .38);
    c.font = `700 ${size}px Arial, sans-serif`; c.fillText(String(page), x, y + size * .2);
    if (page === 1 || page === d.readerPages) {
      c.font = `600 ${Math.min(16, size * .18)}px Arial, sans-serif`;
      c.fillText(page === 1 ? 'Forside' : 'Bagside', x, y + size * .5);
    }
    c.restore();
  }
  return canvas.toDataURL('image/png');
}
