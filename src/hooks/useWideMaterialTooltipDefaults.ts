import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TooltipConfig } from '@/components/ProductTooltipIcon';
import { materialTooltipDefaults } from '@/lib/products/materialPresentation';

type HelpSection = {
  id?: string;
  sectionType?: string;
  valueIds?: string[];
  valueSettings?: Record<string, { displayName?: string }>;
};
const emptyDefaults: TooltipConfig[] = [];

/** Read only the material names and layout needed by the existing tooltip editor. */
export function useWideMaterialTooltipDefaults(productId: string, tenantId: string) {
  return useQuery({
    queryKey: ['wide-material-tooltip-defaults', tenantId, productId],
    enabled: Boolean(productId && tenantId),
    staleTime: 30_000,
    queryFn: async () => {
      const [bank, config] = await Promise.all([
        supabase.from('storformat_materials').select('id,name').eq('tenant_id', tenantId).eq('product_id', productId).order('sort_order'),
        supabase.from('storformat_configs').select('vertical_axis,layout_rows').eq('tenant_id', tenantId).eq('product_id', productId).maybeSingle(),
      ]);
      if (bank.error) throw bank.error;
      if (config.error) throw config.error;
      const materials = bank.data || [];
      const axis = config.data?.vertical_axis as HelpSection | null;
      const rows = config.data?.layout_rows as { sections?: HelpSection[] }[] | null;
      const sections = [
        { ...axis, id: axis?.id || 'vertical-axis', sectionType: axis?.sectionType || 'materials' },
        ...(rows || []).flatMap(row => row.sections || []),
      ].filter(section => section.sectionType === 'materials');
      return sections.flatMap(section => {
        // Match the storefront's fallback when stored IDs no longer resolve.
        const selected = materials.filter(value => section.valueIds?.includes(value.id));
        const values = selected.length ? selected : materials;
        return values.flatMap(value => materialTooltipDefaults({
          name: section.valueSettings?.[value.id]?.displayName || value.name,
          sourceName: value.name,
        }, section.id || 'vertical-axis', value.id));
      });
    },
  }).data || emptyDefaults;
}
