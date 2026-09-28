import { useState } from 'react';
import { matchProductGallery, usableGalleryUrl, type ProductGalleryImage } from '@/lib/products/productGallery';

export function ProductMediaGallery({ name, defaultImage, images, selections }: {
  name: string; defaultImage?: string; images: ProductGalleryImage[]; selections: Record<string, string | null | undefined>;
}) {
  const [manualId, setManualId] = useState<string | null>(null);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const available = images.filter(image => usableGalleryUrl(image.url) && !failedUrls.includes(image.url));
  const matched = matchProductGallery(available, selections);
  const main: ProductGalleryImage | undefined = defaultImage && usableGalleryUrl(defaultImage) && !failedUrls.includes(defaultImage)
    ? { id: 'product-main', url: defaultImage, alt: name, conditions: [] } : undefined;
  const general = available.filter(image => image.conditions.length === 0);
  const thumbnails = [main, matched, ...general].filter((image): image is ProductGalleryImage => !!image)
    .filter((image, index, all) => all.findIndex(item => item.url === image.url) === index);
  const active = thumbnails.find(image => image.id === manualId) || matched || main || general[0];
  if (!active) return <div className="workspace-product-media-empty">{failedUrls.length ? 'Billedet kunne ikke indlæses' : 'Tilføj et produktbillede'}</div>;
  return <section className="workspace-product-gallery" aria-label="Produktbilleder">
    <div className="workspace-product-media"><img key={active.url} src={active.url} alt={active.alt || name} onError={() => setFailedUrls(previous => [...previous, active.url])} /></div>
    {active.alt && active.alt !== name && <p className="workspace-product-caption">{active.alt}</p>}
    {thumbnails.length > 1 && <div className="workspace-product-thumbnails" aria-label="Billedgalleri">{thumbnails.map((image, index) => <button type="button" key={image.id} aria-label={`Vis ${image.alt || `produktbillede ${index + 1}`}`} aria-pressed={image.url === active.url} onClick={() => setManualId(image.id)}><img src={image.url} alt="" loading="lazy" /></button>)}</div>}
  </section>;
}
