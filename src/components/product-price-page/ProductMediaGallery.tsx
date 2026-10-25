import { useState } from 'react';
import { galleryImageSelectionKey, matchProductGallery, usableGalleryUrl, type ProductGalleryImage } from '@/lib/products/productGallery';

export function ProductMediaGallery({ name, defaultImage, images, selections }: {
  name: string; defaultImage?: string; images: ProductGalleryImage[]; selections: Record<string, string | null | undefined>;
}) {
  const [manual, setManual] = useState<{ id: string; selectionKey: string } | null>(null);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const available = images.filter(image => usableGalleryUrl(image.url) && !failedUrls.includes(image.url));
  const matched = matchProductGallery(available, selections);
  const selectionKey = galleryImageSelectionKey(images, selections);
  const hasVariants = images.some(image => image.conditions.length > 0);
  const main: ProductGalleryImage | undefined = defaultImage && usableGalleryUrl(defaultImage) && !failedUrls.includes(defaultImage)
    ? { id: 'product-main', url: defaultImage, alt: name, conditions: [] } : undefined;
  const general = available.filter(image => image.conditions.length === 0 || (image.previewOnly
    && image.conditions.every(condition => selections[condition.sectionId] === condition.valueId)));
  const thumbnails = [main, matched, ...general].filter((image): image is ProductGalleryImage => !!image)
    .filter((image, index, all) => all.findIndex(item => item.url === image.url) === index);
  const active = (manual?.selectionKey === selectionKey && thumbnails.find(image => image.id === manual.id)) || matched || main || general[0];
  const caption = active?.alt && active.alt !== name ? active.alt : '';
  return <section className="workspace-product-gallery" data-variant-gallery={hasVariants || undefined} aria-label="Produktbilleder">
    <div className="workspace-product-media">{active ? <img key={active.url} src={active.url} alt={active.alt || name} width={2080} height={2048} onError={() => setFailedUrls(previous => [...previous, active.url])} /> : <div className="workspace-product-media-empty">{failedUrls.length ? 'Billedet kunne ikke indlæses' : 'Tilføj et produktbillede'}</div>}</div>
    {(hasVariants || caption) && <p className="workspace-product-caption" title={caption}>{caption || '\u00a0'}</p>}
    {(hasVariants || thumbnails.length > 1) && <div className="workspace-product-thumbnails" aria-label="Billedgalleri">{thumbnails.map((image, index) => <button type="button" key={image.id} aria-label={`Vis ${image.alt || `produktbillede ${index + 1}`}`} aria-pressed={image.url === active?.url} onClick={() => setManual({ id: image.id, selectionKey })}><img src={image.url} alt="" loading="lazy" /></button>)}</div>}
  </section>;
}
