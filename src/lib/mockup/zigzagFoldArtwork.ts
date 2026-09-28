import type { ZigzagFoldArtwork, ZigzagFoldDefinition } from './zigzagFoldDefinition';
import { resolveApprovedPrintModel } from './approvedPrintModels';
import { preparePrintModelPdf } from './printModelArtwork';

/** The review and storefront use the same two-sided PDF validation/rendering. */
export async function prepareZigzagFoldArtwork(file: File, definition: ZigzagFoldDefinition): Promise<ZigzagFoldArtwork> {
  const model = resolveApprovedPrintModel(definition.templateHash, definition.sheetWidthMm, definition.sheetHeightMm);
  if (!model) throw new Error('Denne skabelon er endnu ikke klar til 3D.');
  const artwork = await preparePrintModelPdf(file, model);
  if (!artwork.inside) throw new Error('PDF’en mangler indersiden.');
  return { outside: artwork.outside, inside: artwork.inside };
}
