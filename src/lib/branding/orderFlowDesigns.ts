import { wideFormatDesign } from './wideFormatDesigns.ts';
/** The displayed option numbers approved by Thomas on 8 September 2026. */
export const ORDER_FLOW_DESIGNS = [
  { page: 'calculator', label: 'Produkt & pris', default: 2, alternative: 1, names: ['Nordic Product Studio', 'Precise Matrix'] },
  { page: 'checkout', label: 'Checkout', default: 6, alternative: 4, names: ['Calm Guided Checkout', 'Precise Checkout'] },
  { page: 'proof', label: 'Filkorrektur', default: 7, alternative: 9, names: ['Precise Proof', 'Calm Approval Rail'] },
  { page: 'designer', label: 'Designer', default: 12, alternative: 11, names: ['Calm Studio Rail', 'Nordic Quiet Canvas'] },
  { page: 'payment', label: 'Betaling', default: 13, alternative: 15, names: ['Precise Payment', 'Calm Split Payment'] },
  { page: 'confirmation', label: 'Bekræftelse', default: 16, alternative: 18, names: ['Precise Order Receipt', 'Calm Confirmation Split'] },
] as const;

export type OrderFlowPage = typeof ORDER_FLOW_DESIGNS[number]['page'];
export type OrderFlowSettings = Partial<Record<OrderFlowPage, number>>;
export function getOrderFlowOptions(page: OrderFlowPage): { id: number; name: string }[] {
  const definition = ORDER_FLOW_DESIGNS.find(item => item.page === page)!;
  return 'options' in definition ? (definition as unknown as { options: { id: number; name: string }[] }).options
    : [definition.default, definition.alternative].map((id, index) => ({ id, name: definition.names[index] }));
}

type BrandingWithSettings = { themeSettings?: Record<string, unknown> } | null | undefined;

function wideFlowKey(branding: BrandingWithSettings) {
  const settings=branding?.themeSettings;
  return settings?.shopFamily !== 'webprinter' && (settings?.shopFamily === 'wide-format' || settings?.wideFormatDesign) ? wideFormatDesign(settings.wideFormatDesign).id : null;
}

export function resolveOrderFlowDesign(page: OrderFlowPage, branding?: BrandingWithSettings, preview?: string | null): number {
  const definition = ORDER_FLOW_DESIGNS.find(item => item.page === page)!;
  const key=wideFlowKey(branding);
  const bank=branding?.themeSettings?.wideFormatOrderFlows as Record<string,OrderFlowSettings> | undefined;
  const settings = key ? {...branding?.themeSettings?.orderFlowDesigns as OrderFlowSettings,...bank?.[key]} : branding?.themeSettings?.orderFlowDesigns as OrderFlowSettings | undefined;
  const valid = (value: unknown) => getOrderFlowOptions(page).some(option => option.id === value);
  const requested = preview ? Number(preview) : undefined;
  if (valid(requested)) return requested!;
  return valid(settings?.[page]) ? settings![page]! : definition.default;
}

/** Draft-only patch: retain other page choices and every unrelated theme setting. */
export function applyOrderFlowDesign(branding: BrandingWithSettings, page: OrderFlowPage, design: number): {
  themeSettings: Record<string, unknown> & { orderFlowDesigns: OrderFlowSettings };
} {
  const existing = branding?.themeSettings || {};
  const key=wideFlowKey(branding);
  if(key) {
    const bank=existing.wideFormatOrderFlows as Record<string,OrderFlowSettings> || {};
    return {themeSettings:{...existing,orderFlowDesigns:existing.orderFlowDesigns as OrderFlowSettings || {},wideFormatOrderFlows:{...bank,[key]:{...bank[key],[page]:resolveOrderFlowDesign(page,undefined,String(design))}}}};
  }
  return { themeSettings: { ...existing, orderFlowDesigns: {
    ...(existing.orderFlowDesigns as OrderFlowSettings || {}),
    [page]: resolveOrderFlowDesign(page, undefined, String(design)),
  } } };
}
