import type { HalfFoldArtwork, HalfFoldDefinition } from './halfFoldDefinition';
import { resolveApprovedPrintModel } from './approvedPrintModels';
import { preparePrintModelPdf } from './printModelArtwork';

/** The review and storefront use the same two-sided PDF validation/rendering. */
export async function prepareHalfFoldArtwork(file: File, definition: HalfFoldDefinition): Promise<HalfFoldArtwork> {
  const model = resolveApprovedPrintModel(definition.templateHash, definition.sheetWidthMm, definition.sheetHeightMm);
  if (!model) throw new Error('Denne skabelon er endnu ikke klar til 3D.');
  const artwork = await preparePrintModelPdf(file, model);
  if (!artwork.inside) throw new Error('PDF’en mangler indersiden.');
  return { outside: artwork.outside, inside: artwork.inside };
}
