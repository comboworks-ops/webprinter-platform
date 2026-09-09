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
type BrandingWithSettings = { themeSettings?: Record<string, unknown> } | null | undefined;

export function resolveOrderFlowDesign(page: OrderFlowPage, branding?: BrandingWithSettings, preview?: string | null): number {
  const definition = ORDER_FLOW_DESIGNS.find(item => item.page === page)!;
  const settings = branding?.themeSettings?.orderFlowDesigns as OrderFlowSettings | undefined;
  const valid = (value: unknown) => value === definition.default || value === definition.alternative;
  const requested = preview ? Number(preview) : undefined;
  if (valid(requested)) return requested!;
  return valid(settings?.[page]) ? settings![page]! : definition.default;
}

/** Draft-only patch: retain other page choices and every unrelated theme setting. */
export function applyOrderFlowDesign(branding: BrandingWithSettings, page: OrderFlowPage, design: number): {
  themeSettings: Record<string, unknown> & { orderFlowDesigns: OrderFlowSettings };
} {
  const existing = branding?.themeSettings || {};
  return { themeSettings: { ...existing, orderFlowDesigns: {
    ...(existing.orderFlowDesigns as OrderFlowSettings || {}),
    [page]: resolveOrderFlowDesign(page, undefined, String(design)),
  } } };
}
