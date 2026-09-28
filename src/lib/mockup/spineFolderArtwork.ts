import { openLocalPdf } from '../localPdf';
import { folderPreviewColor } from './productFolderPreview';
import { assertSpineFolderPdf, type SpineFolderDefinition } from './spineFolderDefinition';

/** Default illustration only; unprinted inner faces are rendered as white paper. */
export function createSpineFolderArtwork(d: SpineFolderDefinition, primary?: string) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(d.sheetWidthMm * 4); canvas.height = Math.round(d.sheetHeightMm * 4);
  const c = canvas.getContext('2d')!; c.scale(4, 4);
  c.fillStyle = folderPreviewColor(primary); c.fillRect(0, 0, d.sheetWidthMm, d.sheetHeightMm);
  c.fillStyle = '#ffffff'; c.textAlign = 'center';
  for (const panel of d.panels.filter(p => p.id === 'cover' || p.id === 'back')) {
    const xs = panel.outline.map(p => p[0]), ys = panel.outline.map(p => p[1]);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2, y = (Math.min(...ys) + Math.max(...ys)) / 2;
    c.font = '700 105px Arial, sans-serif'; c.fillText(panel.id === 'cover' ? '1' : '4', x, y + 20);
    c.font = '600 16px Arial, sans-serif'; c.fillText(panel.id === 'cover' ? 'Forside' : 'Bagside', x, y + 50);
  }
  // Pockets are parts of the same outside sheet, not additional reader pages.
  c.save(); c.translate(31, 156); c.rotate(Math.PI / 2); c.font = '600 7px Arial, sans-serif'; c.fillText('Sideklap', 0, 0); c.restore();
  c.save(); c.translate(170, 338); c.rotate(Math.PI); c.font = '600 7px Arial, sans-serif'; c.fillText('Bundklap', 0, 0); c.restore();
  return canvas.toDataURL('image/png');
}

export async function prepareSpineFolderArtwork(file: File, d: SpineFolderDefinition) {
  if (!file.size || file.size > 50 * 1024 * 1024) throw new Error('Vælg en tryk-PDF på højst 50 MB.');
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Vælg en PDF med ydersiden.');
  const pdf = await openLocalPdf(file);
  try {
    if (pdf.numPages !== 1) assertSpineFolderPdf([], d);
    const page = await pdf.getPage(1), base = page.getViewport({ scale: 1 });
    assertSpineFolderPdf([{ widthMm: base.width * 25.4 / 72, heightMm: base.height * 25.4 / 72 }], d);
    const viewport = page.getViewport({ scale: 2400 / base.width });
    const canvas = document.createElement('canvas'); canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
    const c = canvas.getContext('2d'); if (!c) throw new Error('Forhåndsvisningen kunne ikke oprettes.');
    await page.render({ canvasContext: c, viewport, background: '#ffffff' }).promise;
    return canvas.toDataURL('image/png');
  } finally { await pdf.destroy(); }
}
