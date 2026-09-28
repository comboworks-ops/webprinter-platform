import { useLocation, useSearchParams } from 'react-router-dom';
import { ORDER_FLOW_DESIGNS, type OrderFlowPage } from '@/lib/branding/orderFlowDesigns';

export function OrderDesignPreviewSwitch({ page, value }: { page: OrderFlowPage; value: number }) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  if (!import.meta.env.DEV || !params.has('orderDesign')) return null;
  const definition = ORDER_FLOW_DESIGNS.find(item => item.page === page)!;
  return <nav className="order-design-preview-switch" aria-label={`${definition.label}: lokal designvisning`}>
    <span>{definition.label}</span>
    {[definition.default, definition.alternative].map((id, index) => <button key={id} type="button" aria-pressed={id === value} onClick={() => {
      const next = new URLSearchParams(params); next.set('orderDesign', String(id)); setParams(next, { replace: true, state: location.state });
    }}>{index === 0 ? 'Standard' : 'Alternativ'} {id}</button>)}
  </nav>;
}
