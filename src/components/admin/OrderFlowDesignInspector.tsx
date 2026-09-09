import { useState } from 'react';
import { ORDER_FLOW_DESIGNS, resolveOrderFlowDesign, type OrderFlowPage } from '@/lib/branding/orderFlowDesigns';
import { OrderFlowDesignPicker } from '@/components/admin/OrderFlowDesignPicker';

export function OrderFlowDesignInspector({ branding, onChange }: {
  branding: { themeSettings?: Record<string, unknown> }; onChange: (page: OrderFlowPage, design: number) => void;
}) {
  const [page, setPage] = useState<OrderFlowPage>('calculator');
  return <div className="sd-flow-inspector">
    <p>Vælg layout til ét trin ad gangen. Hvert trin kan have sit eget design.</p>
    <label htmlFor="sd-order-step">Trin i bestillingen</label>
    <select id="sd-order-step" value={page} onChange={event => setPage(event.target.value as OrderFlowPage)}>
      {ORDER_FLOW_DESIGNS.map(item => <option key={item.page} value={item.page}>{item.label}</option>)}
    </select>
    <OrderFlowDesignPicker page={page} branding={branding} onChange={onChange} />
    <div className="sd-flow-overview"><h3>Dine valgte layouts</h3>
      {ORDER_FLOW_DESIGNS.map(item => <button type="button" key={item.page} aria-pressed={item.page === page} onClick={() => setPage(item.page)}><span>{item.label}</span><strong>{resolveOrderFlowDesign(item.page, branding)}</strong></button>)}
    </div>
  </div>;
}
