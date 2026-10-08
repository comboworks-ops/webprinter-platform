import { useEffect, useState } from 'react';
import type { ProductAttributeGroup } from '@/hooks/useProductAttributes';
import { readRollLabelProductContract } from '@/lib/products/rollLabelConfiguration';
import { readRollLabelPriceMatrixContract } from '@/lib/products/rollLabelPriceMatrix';
import type { RollLabelGenericPriceRow } from '@/lib/products/rollLabelPriceMatrix';

export type RollLabelSystemPreview = {
  familyId: string; localOnly: true; remoteWrites: false; sourceGroups: ProductAttributeGroup[];
  genericPriceRows: RollLabelGenericPriceRow[];
  product: { id: string; slug: string; tenant_id: string; name: string; is_published: false;
    technical_specs: Record<string, unknown>; pricing_structure: { rollLabelConfiguration: unknown; rollLabelPricing: unknown } };
};

/** Only loopback DEV can supply a draft to the real product and Designer pages. */
export function useRollLabelSystemPreview(params: URLSearchParams) {
  const familyId = params.get('rollLabelPreview');
  const requested = import.meta.env.DEV && ['localhost', '127.0.0.1'].includes(window.location.hostname) && familyId !== null;
  const [state, setState] = useState<{ familyId: string; packet: RollLabelSystemPreview | null; error: string } | null>(null);
  useEffect(() => {
    if (!requested) return;
    if (!/^[0-9]+$/.test(familyId || '')) { setState({ familyId: familyId!, packet: null, error: 'Ukendt lokal produktprøve.' }); return; }
    const controller = new AbortController();
    fetch(`/roll-label-review/system-product/${familyId}.json`, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error('Den lokale produktprøve kunne ikke åbnes.');
      const packet = await response.json() as RollLabelSystemPreview;
      const contract = readRollLabelProductContract(packet.product?.pricing_structure?.rollLabelConfiguration, packet.product?.id);
      if (packet.familyId !== familyId || packet.localOnly !== true || packet.remoteWrites !== false
        || packet.product?.is_published !== false || !Array.isArray(packet.sourceGroups)
        || !contract || !readRollLabelPriceMatrixContract(packet.product.pricing_structure.rollLabelPricing, contract)) {
        throw Error('Den lokale produktprøves identitet kunne ikke kontrolleres.');
      }
      if (!controller.signal.aborted) setState({ familyId: familyId!, packet, error: '' });
    }).catch(error => { if (!controller.signal.aborted) setState({ familyId: familyId!, packet: null, error: error.message }); });
    return () => controller.abort();
  }, [requested, familyId]);
  const current = requested && state?.familyId === familyId ? state : null;
  return { requested, packet: current?.packet || null, error: current?.error || '', loading: requested && !current };
}

export function localRollLabelProduct(packet: RollLabelSystemPreview | null, productId: string | null | undefined, tenantId?: string | null) {
  return packet && packet.product.id === productId && (!tenantId || packet.product.tenant_id === tenantId) ? packet.product : null;
}
