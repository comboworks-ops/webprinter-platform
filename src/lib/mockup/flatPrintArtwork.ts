import { openLocalPdf } from '../localPdf';
import { loadArtworkImage } from './artwork';
import { assertFlatPrintPdf, type FlatPrintDefinition } from './flatPrintDefinition';

/** Local review only. No authentication, storage, checkout, or product writes. */
export async function prepareFlatPrintArtwork(file: File, definition: FlatPrintDefinition): Promise<string> {
  if (file.size > 50 * 1024 * 1024) throw new Error('Vælg en fil under 50 MB til denne lokale prøve.');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Forhåndsvisningen kunne ikke oprettes.');
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const pdf = await openLocalPdf(file);
    try {
      const page = await pdf.getPage(1);
      const base = page.getViewport({ scale: 1 });
      assertFlatPrintPdf(pdf.numPages, base.width * 25.4 / 72, base.height * 25.4 / 72, definition);
      const viewport = page.getViewport({ scale: 1800 / Math.max(base.width, base.height) });
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      await page.render({ canvasContext: context, viewport, background: '#ffffff' }).promise;
    } finally { await pdf.destroy(); }
  } else {
    if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('Vælg en PDF, PNG eller JPG.');
    const url = URL.createObjectURL(file);
    try {
      const image = await loadArtworkImage(url);
      const ratio = 1800 / definition.sheetHeightMm;
      canvas.width = Math.round(definition.sheetWidthMm * ratio); canvas.height = 1800;
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      const fit = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
      const w = image.naturalWidth * fit, h = image.naturalHeight * fit;
      context.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    } finally { URL.revokeObjectURL(url); }
  }
  return canvas.toDataURL('image/png');
}
