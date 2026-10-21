import { openLocalPdf } from '@/lib/localPdf';

/** Render the returned bytes for review; this never approves or alters the PDF. */
export async function createCanvaPdfPreview(file: Blob) {
  const pdf = await openLocalPdf(file);
  try {
    if (pdf.numPages !== 1) throw new Error('Flyerskabelonen skal have én side. Ret designet i Canva og hent det igen.');
    const page = await pdf.getPage(1);
    const physical = page.getViewport({ scale: 1 });
    if (![physical.width, physical.height].every(value => Number.isFinite(value) && value > 0)) {
      throw new Error('PDF-filens mål kunne ikke læses. Ret designet i Canva og hent det igen.');
    }
    const viewport = page.getViewport({ scale: Math.min(1400 / physical.width, 1400 / physical.height, 2.5) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('PDF-preview kunne ikke oprettes. Prøv at hente designet igen.');
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    return { previewDataUrl: canvas.toDataURL('image/png'), widthPx: canvas.width, heightPx: canvas.height,
      physicalWidthMm: physical.width * 25.4 / 72, physicalHeightMm: physical.height * 25.4 / 72 };
  } finally { await pdf.destroy(); }
}
