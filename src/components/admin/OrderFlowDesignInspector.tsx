import { useState } from 'react';
import { ORDER_FLOW_DESIGNS, resolveOrderFlowDesign, type OrderFlowPage } from '@/lib/branding/orderFlowDesigns';
import { OrderFlowDesignPicker } from '@/components/admin/OrderFlowDesignPicker';

export function OrderFlowDesignInspector({ branding, onChange, page: selectedPage, onPageChange }: {
  branding: { themeSettings?: Record<string, unknown> }; onChange: (page: OrderFlowPage, design: number) => void;
  page?: OrderFlowPage; onPageChange?: (page: OrderFlowPage) => void;
}) {
  const [localPage, setLocalPage] = useState<OrderFlowPage>('calculator');
  const page = selectedPage || localPage;
  const selectPage = (next: OrderFlowPage) => { setLocalPage(next); onPageChange?.(next); };
  return <div className="sd-flow-inspector">
    <p>Vælg layout til hvert trin. Alle seks valg gemmes med dit shopdesign og følger med, når du publicerer.</p>
    <label htmlFor="sd-order-step">Trin i bestillingen</label>
    <select id="sd-order-step" value={page} onChange={event => selectPage(event.target.value as OrderFlowPage)}>
      {ORDER_FLOW_DESIGNS.map(item => <option key={item.page} value={item.page}>{item.label}</option>)}
    </select>
    <OrderFlowDesignPicker page={page} branding={branding} onChange={onChange} />
    <div className="sd-flow-overview"><h3>Dine valgte layouts</h3>
      {ORDER_FLOW_DESIGNS.map(item => <button type="button" key={item.page} aria-pressed={item.page === page} onClick={() => selectPage(item.page)}><span>{item.label}</span><strong>{resolveOrderFlowDesign(item.page, branding)}</strong></button>)}
    </div>
  </div>;
}
