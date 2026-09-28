import { useCallback, useEffect, useRef, useState } from 'react';
import { PRODUCT_PRICING_PREVIEW_UPDATE } from '@/lib/preview/productPricingPreview';

export function ProductCardLivePreview({ productId, tenantId, slug, pricingStructure, content }: {
  productId: string; tenantId: string; slug: string; pricingStructure: Record<string, unknown>; content: Record<string, unknown>;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [mobile, setMobile] = useState(false);
  const params = new URLSearchParams({ tenantId, page: `/produkt/${slug}`, productWorkspace: 'card', preview_mode: '1', editor: 'site-design-v2' });
  const send = useCallback(() => frame.current?.contentWindow?.postMessage({ type: PRODUCT_PRICING_PREVIEW_UPDATE,
    productId, isDirty: true, pricingStructure: { ...pricingStructure, workspaceContent: { ...content } },
  }, window.location.origin), [productId, pricingStructure, content]);
  useEffect(() => { send(); }, [send]);
  useEffect(() => {
    const ready = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === frame.current?.contentWindow && event.data?.type === 'PREVIEW_READY') send();
    };
    window.addEventListener('message', ready); return () => window.removeEventListener('message', ready);
  }, [send]);
  return <section className="pw-preview">
    <div className="pw-preview-toolbar"><strong className="text-sm">Produktkort · webshop</strong><button type="button" aria-pressed={mobile} onClick={() => setMobile(!mobile)}>{mobile ? 'Vis desktop' : 'Vis mobil'}</button></div>
    <div className={`pw-frame-shell ${mobile ? 'mobile' : ''}`}><iframe ref={frame} src={`/preview-shop?${params}`} title="Produktkortets rigtige forhåndsvisning" onLoad={send} /></div>
    <footer>Samme produktkort og Site Design som i shoppen. Ændringer vises før du gemmer.</footer>
  </section>;
}
