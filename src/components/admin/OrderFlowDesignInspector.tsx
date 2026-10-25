import { WideFormatLayoutPicker } from './WideFormatLayoutPicker';
import { signalSettings, SIGNAL_CHOICES, type SignalSettings } from '@/lib/branding/pvcbannerSettings';
import { useState } from 'react';
import { ORDER_FLOW_DESIGNS, resolveOrderFlowDesign, type OrderFlowPage } from '@/lib/branding/orderFlowDesigns';
import { OrderFlowDesignPicker } from '@/components/admin/OrderFlowDesignPicker';

export function OrderFlowDesignInspector({ branding, onChange, page: selectedPage, onPageChange, wideFormat = false, onWideChange }: {
  branding: { themeSettings?: Record<string, unknown> }; onChange: (page: OrderFlowPage, design: number) => void;
  wideFormat?: boolean; onWideChange?: (patch:Partial<SignalSettings>)=>void;
  page?: OrderFlowPage; onPageChange?: (page: OrderFlowPage) => void;
}) {
  const [localPage, setLocalPage] = useState<OrderFlowPage>('calculator');
  const page = selectedPage || localPage;
  const wide=wideFormat?signalSettings(branding):null;
  const custom=wide && page==='checkout' && wide.checkoutStyle!=='standard';
  const selectPage = (next: OrderFlowPage) => { setLocalPage(next); onPageChange?.(next); };
  return <div className="sd-flow-inspector">
    <p>Vælg layout til hvert trin. Alle seks valg gemmes med dit shopdesign og følger med, når du publicerer.</p>
    <label htmlFor="sd-order-step">Trin i bestillingen</label>
    <select id="sd-order-step" value={page} onChange={event => selectPage(event.target.value as OrderFlowPage)}>
      {ORDER_FLOW_DESIGNS.map(item => <option key={item.page} value={item.page}>{item.label}</option>)}
    </select>
    {wide && onWideChange && ['calculator','checkout'].includes(page) && <WideFormatLayoutPicker branding={branding} field={page==='calculator'?'configurationStyle':'checkoutStyle'} onChange={onWideChange}/>}
    {wide && <h3>Fælles Webprinter-layouts</h3>}
    <OrderFlowDesignPicker page={page} branding={branding} onChange={onChange} showSelection={!custom}/>

    <div className="sd-flow-overview"><h3>Dine valgte layouts</h3>
      {ORDER_FLOW_DESIGNS.map(item => <button type="button" key={item.page} aria-pressed={item.page === page} onClick={() => selectPage(item.page)}><span>{item.label}</span><strong>{wide && item.page==='checkout' && wide.checkoutStyle!=='standard' ? SIGNAL_CHOICES.checkoutStyle?.find(([id])=>id===wide.checkoutStyle)?.[1] : resolveOrderFlowDesign(item.page, branding)}</strong></button>)}
    </div>
  </div>;
}
