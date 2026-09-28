import { artworkRect, type ArtworkPlacement, type FolderDefinition } from './folderDefinition';

export async function loadArtworkImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = url;
  await image.decode();
  return image;
}

/** Reuses the upload proof's physical size, scale and percentage offsets.
 * No template overlay, guide, badge or generated branding is included.
 */
export async function composeFolderArtwork(url: string, placement: ArtworkPlacement, definition: Pick<FolderDefinition, 'sheetWidthMm' | 'sheetHeightMm'>): Promise<string> {
  const rect = artworkRect(placement, definition.sheetWidthMm, definition.sheetHeightMm);
  const image = await loadArtworkImage(url);
  const canvas = document.createElement('canvas');
  const ratio = 2048 / definition.sheetWidthMm;
  canvas.width = 2048;
  canvas.height = Math.round(definition.sheetHeightMm * ratio);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Din browser kunne ikke oprette forhåndsvisningen.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  // Match object-contain in the upload proof (including a PDF's printable box).
  const fit = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
  const width = image.naturalWidth * fit;
  const height = image.naturalHeight * fit;
  context.drawImage(image, (rect.x + (rect.width - width) / 2) * ratio, (rect.y + (rect.height - height) / 2) * ratio, width * ratio, height * ratio);
  return canvas.toDataURL('image/png');
}
