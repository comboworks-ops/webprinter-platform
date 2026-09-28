import { openLocalPdf } from '../localPdf';
import { composeFolderArtwork } from './artwork';
import type { ApprovedPrintModel, PrintArtwork } from './approvedPrintModels';
import type { ArtworkPlacement } from './folderDefinition';
import type { SiteCheckoutUpload } from '../checkout/siteCheckoutSession';
import { createNumberedPrintSpread } from './numberedPrintArtwork';
import { createSalesFolderArtwork } from './salesFolderArtwork';
import { createSpineFolderArtwork } from './spineFolderArtwork';

/** Whole print spreads only. A six-page reader PDF must never be silently mapped
 * to a three-panel construction. Both sides are validated before rendering. */
export async function preparePrintModelPdf(file: File, model: ApprovedPrintModel): Promise<PrintArtwork> {
  if (!file.size || file.size > 50 * 1024 * 1024) throw new Error('Vælg en tryk-PDF på højst 50 MB.');
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Vælg en tryk-PDF, der følger skabelonen.');
  const pdf = await openLocalPdf(file);
  try {
    if (pdf.numPages !== model.pages) throw new Error(model.pages === 1
      ? 'Denne enkeltsidede variant kræver en PDF med én side.' : 'PDF’en skal have to hele opslag: yderside først, inderside bagefter.');
    const pages = await Promise.all(Array.from({ length: model.pages }, (_, i) => pdf.getPage(i + 1)));
    const d = model.definition;
    for (const [i, page] of pages.entries()) {
      const v = page.getViewport({ scale: 1 });
      if (Math.abs(v.width * 25.4 / 72 - d.sheetWidthMm) > .15 || Math.abs(v.height * 25.4 / 72 - d.sheetHeightMm) > .15)
        throw new Error(`PDF-side ${i + 1} skal være ${d.sheetWidthMm} × ${d.sheetHeightMm} mm inklusive udfald.`);
    }
    const images: string[] = [];
    for (const page of pages) {
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 1800 / Math.max(base.width, base.height) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Forhåndsvisningen kunne ikke oprettes.');
      await page.render({ canvasContext: context, viewport, background: '#fff' }).promise;
      images.push(canvas.toDataURL('image/png'));
    }
    return { outside: images[0], inside: images[1] };
  } finally { await pdf.destroy(); }
}

export function printModelUploadMetadata(file: File, model: ApprovedPrintModel, artwork: PrintArtwork): SiteCheckoutUpload {
  const d = model.definition;
  const ratio = 1800 / Math.max(d.sheetWidthMm, d.sheetHeightMm);
  return { name: file.name, mimeType: 'application/pdf', previewDataUrl: artwork.outside,
    widthPx: Math.round(d.sheetWidthMm * ratio), heightPx: Math.round(d.sheetHeightMm * ratio),
    physicalWidthMm: d.sheetWidthMm, physicalHeightMm: d.sheetHeightMm,
    sourceDpi: null, estimatedDpi: null, proofingScalePercent: 100, proofingOffsetXPercent: 0, proofingOffsetYPercent: 0 };
}

export async function placePrintArtwork(artwork: PrintArtwork, placement: ArtworkPlacement, model: ApprovedPrintModel): Promise<PrintArtwork> {
  return { outside: await composeFolderArtwork(artwork.outside, placement, model.definition),
    inside: artwork.inside ? await composeFolderArtwork(artwork.inside, placement, model.definition) : undefined };
}

/** Numbered product illustration uses the active shop colour. Customer textures
 * bypass this function and keep their original artwork. */
export function createBrandedPrintArtwork(model: ApprovedPrintModel, primary?: string): PrintArtwork {
  if (model.kind === 'sales-folder') return { outside: createSalesFolderArtwork(model.definition, 'outside', primary),
    inside: model.pages === 2 ? createSalesFolderArtwork(model.definition, 'inside', primary) : undefined };
  if (model.kind === 'spine') return { outside: createSpineFolderArtwork(model.definition, primary) };
  return {
    outside: createNumberedPrintSpread(model, 'outside', primary),
    inside: model.kind === 'flat' ? undefined : createNumberedPrintSpread(model, 'inside', primary),
  };
}
