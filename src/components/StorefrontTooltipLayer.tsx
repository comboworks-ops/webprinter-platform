import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useShopSettings } from '@/hooks/useShopSettings';
import { ProductTooltipIcon, type TooltipConfig } from './ProductTooltipIcon';
import { findTooltipTarget } from '@/lib/products/tooltipPlacement';

export const TOOLTIP_PREVIEW_UPDATE = 'PRODUCT_TOOLTIP_PREVIEW_UPDATE';
export function StorefrontTooltipLayer() {
  const location = useLocation();
  const allowed = /^\/(?:$|shop(?:\/|$)|produkter(?:\/|$)|produkt\/|preview-shop$|kontakt$|om-os$|grafisk-vejledning$)/.test(location.pathname);
  return allowed ? <TooltipLayer /> : null;
}
function TooltipLayer() {
  const location = useLocation();
  const { data: settings } = useShopSettings();
  const [page, setPage] = useState(() => document.querySelector('[data-tooltip-page]')?.getAttribute('data-tooltip-page') || location.pathname);
  useEffect(() => {
    const change = (event: Event) => setPage(String((event as CustomEvent).detail || location.pathname));
    setPage(document.querySelector('[data-tooltip-page]')?.getAttribute('data-tooltip-page') || location.pathname);
    window.addEventListener('STOREFRONT_TOOLTIP_PAGE', change);
    return () => window.removeEventListener('STOREFRONT_TOOLTIP_PAGE', change);
  }, [location.pathname]);
  const [preview, setPreview] = useState<Record<string, TooltipConfig[]>>({});
  const { data = [] } = useQuery({
    queryKey: ['storefront-placed-tooltips', settings?.id], enabled: Boolean(settings?.id), staleTime: 30_000,
    queryFn: async () => {
      const {data, error} = await supabase.from('products').select('id,banner_config').eq('tenant_id', settings!.id).eq('is_published', true);
      if (error) throw error;
      return (data || []).map(product => ({id: product.id, tooltips: readPlacedTooltips(product.banner_config)}));
    },
  });
  useEffect(() => {
    if (location.pathname !== '/preview-shop' || !new URLSearchParams(location.search).has('tooltipEditor')) return;
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== TOOLTIP_PREVIEW_UPDATE) return;
      if (typeof event.data.productId !== 'string') return;
      setPreview(previous => ({...previous, [event.data.productId]: readPlacedTooltips({visual_tooltips: event.data.tooltips})}));
    };
    window.addEventListener('message', receive); return () => window.removeEventListener('message', receive);
  }, [location.pathname, location.search]);
  const products = {...Object.fromEntries(data.map(product => [product.id, product.tooltips])), ...preview};
  return <>{Object.entries(products).flatMap(([id, tooltips]) => tooltips.filter(config => config.target?.page === page.split('?')[0]).map(config => <PlacedTooltip key={`${id}:${config.anchor}`} config={config} />))}</>;
}
function readPlacedTooltips(config: unknown): TooltipConfig[] {
  const values = (config as {visual_tooltips?: unknown} | null)?.visual_tooltips;
  return Array.isArray(values) ? values.filter(item => item && typeof item.anchor === 'string' && typeof item.text === 'string' && item.target && typeof item.target.page === 'string') : [];
}
function PlacedTooltip({config}: {config: TooltipConfig}) {
  const [point, setPoint] = useState<{left: number; top: number} | null>(null);
  useEffect(() => {
    let frame = 0;
    let observed: Element | null = null;
    const resize = new ResizeObserver(() => schedule());
    const measure = () => {
      frame = 0;
      const page = document.querySelector('[data-tooltip-page]')?.getAttribute('data-tooltip-page') || window.location.pathname;
      const el = config.target && page.split('?')[0] === config.target.page ? findTooltipTarget(document, config.target) : null;
      if (el !== observed) { resize.disconnect(); resize.observe(document.documentElement); if (el) resize.observe(el); observed = el; }
      const rect = el?.getBoundingClientRect();
      const next = rect && rect.bottom >= 0 && rect.top <= window.innerHeight ? {
        left: Math.min(window.innerWidth - 28, Math.max(0, rect.left + rect.width * Math.min(100,Math.max(0, config.target?.x ?? 100)) / 100 - 10)),
        top: rect.top + rect.height * Math.min(100,Math.max(0, config.target?.y ?? 0)) / 100 - 10,
      } : null;
      setPoint(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const mutation = new MutationObserver(records => {
      if (records.some(record => !(record.target as Element).closest?.('[data-tooltip-overlay]'))) schedule();
    });
    mutation.observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['class','style','data-tooltip-page']});
    window.addEventListener('scroll', schedule, true); window.addEventListener('resize', schedule);
    window.addEventListener('load', schedule, true); window.addEventListener('transitionend', schedule, true); schedule();
    return () => { cancelAnimationFrame(frame); resize.disconnect(); mutation.disconnect(); window.removeEventListener('scroll',schedule,true);window.removeEventListener('resize',schedule);window.removeEventListener('load',schedule,true);window.removeEventListener('transitionend',schedule,true); };
  }, [config]);
  return point ? createPortal(<div data-tooltip-overlay style={{position:'fixed',...point,zIndex:60}}><ProductTooltipIcon config={config}/></div>, document.body) : null;
}
