import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AvailabilityTooltipText } from '@/lib/products/optionAvailability';

export function useProductAvailabilityTooltips(productId: string) {
  return useQuery({
    queryKey: ['product-availability-tooltips', productId],
    enabled: Boolean(productId),
    staleTime: 30_000,
    queryFn: async (): Promise<AvailabilityTooltipText[]> => {
      const { data, error } = await supabase.from('products').select('banner_config').eq('id', productId).maybeSingle();
      if (error) throw error;
      const config = data?.banner_config as { visual_tooltips?: unknown } | null;
      if (!Array.isArray(config?.visual_tooltips)) return [];
      return config.visual_tooltips.filter((item): item is AvailabilityTooltipText =>
        Boolean(item && typeof item.anchor === 'string' && typeof item.text === 'string'));
    },
  }).data || [];
}
