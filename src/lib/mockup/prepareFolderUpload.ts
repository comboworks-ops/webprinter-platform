import { openLocalPdf } from '@/lib/localPdf';
import { loadArtworkImage } from './artwork';
import type { FolderDefinition } from './folderDefinition';
import type { SiteCheckoutUpload } from '@/lib/checkout/siteCheckoutSession';

/** Previews a customer's file; production approval still happens in checkout. */
export async function prepareFolderUpload(file: File, definition: FolderDefinition): Promise<SiteCheckoutUpload> {
  const canvas = document.createElement('canvas');
  let widthPx: number, heightPx: number;
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    const pdf = await openLocalPdf(file);
    try {
      if (pdf.numPages !== 1) throw new Error('Vælg en PDF med én side til tryk på ydersiden (4+0).');
      const page = await pdf.getPage(1);
      const original = page.getViewport({ scale: 1 });
      if (Math.abs(original.width * 25.4 / 72 - definition.sheetWidthMm) > 0.2
        || Math.abs(original.height * 25.4 / 72 - definition.sheetHeightMm) > 0.2) {
        throw new Error(`PDF’en skal følge skabelonens fulde trykflade: ${definition.sheetWidthMm} × ${definition.sheetHeightMm} mm.`);
      }
      const viewport = page.getViewport({ scale: 1600 / Math.max(original.width, original.height) });
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Forhåndsvisningen kunne ikke oprettes.');
      await page.render({ canvasContext: context, viewport, background: '#ffffff' }).promise;
      widthPx = canvas.width; heightPx = canvas.height;
    } finally { await pdf.destroy(); }
  } else {
    if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('Vælg en PDF, PNG eller JPG.');
    const url = URL.createObjectURL(file);
    try {
      const image = await loadArtworkImage(url);
      widthPx = image.naturalWidth; heightPx = image.naturalHeight;
      const ratio = Math.min(1, 1600 / Math.max(widthPx, heightPx));
      canvas.width = Math.round(widthPx * ratio); canvas.height = Math.round(heightPx * ratio);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Forhåndsvisningen kunne ikke oprettes.');
      context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
    } finally { URL.revokeObjectURL(url); }
  }
  const dpi = isPdf ? null : Math.min(widthPx / definition.sheetWidthMm, heightPx / definition.sheetHeightMm) * 25.4;
  return {
    name: file.name, mimeType: isPdf ? 'application/pdf' : file.type,
    previewDataUrl: canvas.toDataURL('image/png'), widthPx, heightPx,
    physicalWidthMm: definition.sheetWidthMm, physicalHeightMm: definition.sheetHeightMm,
    sourceDpi: dpi, estimatedDpi: dpi,
    proofingScalePercent: 100, proofingOffsetXPercent: 0, proofingOffsetYPercent: 0,
  };
}
