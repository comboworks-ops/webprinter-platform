import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RollLabelPricePreview } from '@/lib/products/rollLabelPricePreview';
import type { RollLabelSelection } from '@/lib/products/rollLabelConfiguration';
import { rollLabelPricesFromGenericRows, type RollLabelGenericPriceRow } from '@/lib/products/rollLabelPriceMatrix';

export function useRollLabelGenericPrices(packet: RollLabelPricePreview | null, selection: RollLabelSelection | null,
  localRows: RollLabelGenericPriceRow[] | undefined, tenantId: string | null | undefined) {
  const profileKey = selection?.profileKey, optionStateId = selection?.optionStateId;
  const widthMm = selection?.widthMm, heightMm = selection?.heightMm;
  // Quantity changes share the same fetched variants. Keep their reference stable
  // so choosing another price does not restart the request.
  const variants = useMemo(() => packet && profileKey ? [...new Set(packet.points.filter(point =>
    point.selection.profileKey === profileKey && point.selection.optionStateId === optionStateId
    && point.selection.widthMm === widthMm && point.selection.heightMm === heightMm)
    .flatMap(point => point.matrix ? [point.matrix.variantName] : []))].sort() : [], [packet, profileKey, optionStateId, widthMm, heightMm]);
  const key = JSON.stringify([tenantId, packet?.productId, packet?.ruleKey, variants]);
  const [loaded, setLoaded] = useState<{ key: string; packet: RollLabelPricePreview; source: RollLabelPricePreview } | null>(null);
  useEffect(() => {
    if (!packet || !tenantId || localRows !== undefined || !variants.length) return;
    let active = true;
    void (async () => {
      try {
        const rows: RollLabelGenericPriceRow[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await supabase.from('generic_product_prices')
            .select('tenant_id, product_id, variant_name, variant_value, quantity, price_dkk, extra_data')
            .eq('product_id', packet.productId).eq('tenant_id', tenantId).in('variant_name', variants).order('id').range(offset, offset + 499);
          if (error) throw error;
          if (!active) return;
          rows.push(...(data || []) as unknown as RollLabelGenericPriceRow[]);
          if ((data || []).length < 500) break;
        }
        if (active) setLoaded({ key, packet: rollLabelPricesFromGenericRows(packet, rows, tenantId), source: packet });
      } catch { if (active) setLoaded({ key, packet: { ...packet, points: [] }, source: packet }); }
    })();
    return () => { active = false; };
  }, [packet, localRows, key, variants, tenantId]);
  const local = useMemo(() => packet && tenantId && localRows !== undefined ? rollLabelPricesFromGenericRows(packet, localRows, tenantId) : null, [packet, localRows, tenantId]);
  return local || (loaded?.key === key && loaded.source === packet ? loaded.packet : null);
}
