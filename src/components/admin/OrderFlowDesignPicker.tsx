import { Check } from 'lucide-react';
import { ORDER_FLOW_DESIGNS, resolveOrderFlowDesign, type OrderFlowPage } from '@/lib/branding/orderFlowDesigns';

export function OrderFlowDesignPicker({ branding, onChange, page }: {
  page?: OrderFlowPage;
  branding?: { themeSettings?: Record<string, unknown> };
  onChange: (page: OrderFlowPage, design: number) => void;
}) {
  return <section aria-label="Bestillingsflowets design" className="space-y-4">
    {!page && <div><h4 className="text-sm font-semibold">Bestillingsflow</h4>
      <p className="mt-1 text-xs text-muted-foreground">Vælg layout til hver side. Produkter, priser og indhold følger med.</p></div>}
    {ORDER_FLOW_DESIGNS.filter(item => !page || item.page === page).map(item => <fieldset key={item.page} className="space-y-2">
      <legend className="mb-2 text-xs font-semibold">{item.label}</legend>
      <div className="grid grid-cols-2 gap-2">{[item.default, item.alternative].map((id, index) =>
        <button type="button" key={id} aria-pressed={resolveOrderFlowDesign(item.page, branding) === id}
          onClick={() => onChange(item.page, id)} className="overflow-hidden rounded-md border text-left transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary aria-pressed:border-primary aria-pressed:ring-1 aria-pressed:ring-primary">
          <img src={`/design-presets/order-flow/${id}.webp`} alt={`${item.label}: ${item.names[index]}`} loading="lazy" className="aspect-[1.406] w-full object-cover" />
          <span className="flex items-center justify-between gap-1 border-t bg-white p-2 text-[11px] font-medium">
            {id} · {index === 0 ? 'Standard' : 'Alternativ'}
            {resolveOrderFlowDesign(item.page, branding) === id && <Check className="h-3 w-3 text-primary" />}
          </span>
        </button>)}</div>
    </fieldset>)}
  </section>;
}
