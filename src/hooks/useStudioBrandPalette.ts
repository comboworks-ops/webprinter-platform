import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { mergeBrandingWithDefaults } from '@/hooks/useBrandingDraft';
import { extractDraftBranding, extractPublishedBranding } from '@/lib/branding/settings-persistence';
import { studioBrandPalette } from '@/lib/icon-studio/brandPalette';

/** Use the studio's already-authorized tenant, never an ambient storefront pin
 * or the administrator's own shop. This hook performs reads only. */
export function useStudioBrandPalette(tenantId: string) {
  const query = useQuery({
    queryKey: ['icon-studio-branding', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('name, settings').eq('id', tenantId).single();
      if (error) throw error;
      if (!data) throw new Error('Shoppens design kunne ikke hentes.');
      return data;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const data = useMemo(() => {
    if (!query.data) return null;
    const settings = query.data.settings as Record<string, unknown> | null;
    const published = extractPublishedBranding(settings);
    return {
      saved: studioBrandPalette(mergeBrandingWithDefaults(extractDraftBranding(settings)), tenantId),
      published: published ? studioBrandPalette(mergeBrandingWithDefaults(published), tenantId) : null,
    };
  }, [query.data, tenantId]);
  return { ...query, data };
}
