import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AvailabilityTooltipText } from '@/lib/products/optionAvailability';
import type { TooltipConfig } from '@/components/ProductTooltipIcon';
import { useEffect, useState } from 'react';

export function useProductTooltipConfigs(productId: string) {
  const [preview, setPreview] = useState<{productId: string; tooltips: TooltipConfig[]} | null>(null);
  useEffect(() => {
    if (window.location.pathname !== '/preview-shop' || !new URLSearchParams(window.location.search).has('tooltipEditor')) return;
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== 'PRODUCT_TOOLTIP_PREVIEW_UPDATE' || event.data.productId !== productId || !Array.isArray(event.data.tooltips)) return;
      setPreview({productId, tooltips: event.data.tooltips.filter((item: TooltipConfig) => item && typeof item.anchor === 'string' && typeof item.text === 'string')});
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [productId]);
  const saved = useQuery({
    queryKey: ['product-availability-tooltips', productId],
    enabled: Boolean(productId),
    staleTime: 30_000,
    queryFn: async (): Promise<TooltipConfig[]> => {
      const { data, error } = await supabase.from('products').select('banner_config').eq('id', productId).maybeSingle();
      if (error) throw error;
      const config = data?.banner_config as { visual_tooltips?: unknown } | null;
      if (!Array.isArray(config?.visual_tooltips)) return [];
      return config.visual_tooltips.filter((item): item is TooltipConfig =>
        Boolean(item && typeof item.anchor === 'string' && typeof item.text === 'string'));
    },
  }).data || [];
  return preview?.productId === productId ? preview.tooltips : saved;
}
export function useProductAvailabilityTooltips(productId: string): AvailabilityTooltipText[] {
  return useProductTooltipConfigs(productId);
}
