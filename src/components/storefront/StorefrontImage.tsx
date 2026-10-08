import { useState, type ImgHTMLAttributes } from 'react';
import { getStorefrontImageSources, type StorefrontImageVariant } from '@/lib/storefront/storefrontImageSources';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> & {
  src: string;
  variant?: StorefrontImageVariant;
  /** Use the CSS slot width where the layout defines both image dimensions. */
  autoSize?: boolean;
};

/** Display copies only: keep tenant artwork, crop styling and original uploads. */
export function StorefrontImage({ src, variant = 'card', sizes, autoSize = false, onError, loading = 'lazy', decoding = 'async', ...props }: Props) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const optimized = failedSource !== src ? getStorefrontImageSources(src, variant) : {src};
  const imageSizes = sizes || (variant === 'thumbnail' ? '96px'
    : variant === 'feature' ? '(min-width: 1280px) 640px, (min-width: 768px) 50vw, 100vw'
      : '(min-width: 1280px) 360px, (min-width: 768px) 50vw, 100vw');

  const responsiveSizes = autoSize && loading === 'lazy' ? `auto, ${imageSizes}` : imageSizes;
  return <img {...props} src={optimized.src} srcSet={optimized.srcSet} sizes={optimized.srcSet ? responsiveSizes : undefined}
    loading={loading} decoding={decoding} onError={event => {
      if (optimized.srcSet) setFailedSource(src);
      else onError?.(event);
    }} />;
}
