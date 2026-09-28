import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Plus, Replace, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { BankValueType } from '@/lib/products/workspaceBankValue';

import { workspaceBankChoices, type WorkspaceBankItem, type WorkspaceBankSelection } from '@/lib/products/workspaceBankSelection';
export type { WorkspaceBankItem } from '@/lib/products/workspaceBankSelection';
const labels: Record<BankValueType, string> = { format: 'Formatbank', material: 'Materialebank', finish: 'Efterbehandling', product: 'Produktvalg' };

/** A contextual, read-only view of the existing bank. The parent uses the same
 * product-attribute copy operation as the legacy bank when an item is chosen. */
export function WorkspaceValueBank({ type, allowTypeChange, hasSelection, adding, busy, selected, onTypeChange, onAddingChange, onPick }: {
  selected?: WorkspaceBankSelection; type: BankValueType; allowTypeChange: boolean; hasSelection: boolean; adding: boolean; busy: boolean;
  onTypeChange: (type: BankValueType) => void; onAddingChange: (adding: boolean) => void;
  onPick: (item: WorkspaceBankItem) => void;
}) {
  const [search, setSearch] = useState('');
  const bank = useQuery({ queryKey: ['workspace-value-bank', type], staleTime: 60_000, queryFn: async () => {
    const { data, error } = await supabase.from('designer_templates')
      .select('id,name,category,width_mm,height_mm,icon_name,bleed_mm,safe_area_mm,preview_image_url')
      .eq('is_active', true).eq('template_type', type).order('category').order('name');
    if (error) throw error;
    return (data || []).map(item => ({ ...item, image_url: item.preview_image_url })).filter(item => type !== 'format' || (item.width_mm && item.height_mm));
  } });
  const items = workspaceBankChoices(bank.data || [], selected).filter(({ item, current }) => current || `${item.name} ${item.category || ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <div className="pw-inline-bank" aria-label={labels[type]} aria-busy={busy}>
    <div className="pw-inline-bank-heading"><strong>{labels[type]}</strong>
      {hasSelection && <div role="group" aria-label="Brug bankens valg"><button type="button" aria-pressed={!adding} disabled={busy} onClick={() => onAddingChange(false)}><Replace size={13} />Erstat</button><button type="button" aria-pressed={adding} disabled={busy} onClick={() => onAddingChange(true)}><Plus size={13} />Tilføj</button></div>}
    </div>
    {allowTypeChange && <label>Type<select value={type} disabled={busy} onChange={event => onTypeChange(event.target.value as BankValueType)}>{Object.entries(labels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>}
    <label className="pw-bank-search"><Search size={14} /><input aria-label={`Søg i ${labels[type].toLocaleLowerCase()}`} placeholder="Søg efter et valg…" value={search} onChange={event => setSearch(event.target.value)} /></label>
    <small>{hasSelection && !adding ? 'Vælg for at erstatte det markerede valg.' : 'Vælg for at føje til denne sektion.'}</small>
    <div className="pw-bank-results">
      {items.map(({ item, current }) => <button key={item.id} type="button" disabled={busy} aria-pressed={current} aria-label={current ? `Aktuelt valg: ${item.name}` : `${adding || !hasSelection ? 'Tilføj' : 'Erstat med'} ${item.name}`} onClick={() => { if (!current) onPick(item); }}>
        {item.image_url && <img src={item.image_url} alt="" loading="lazy" />}
        <span>{item.name}<small>{current ? 'Valgt på produktet' : ''}{type === 'format' ? `${current ? ' · ' : ''}${item.width_mm} × ${item.height_mm} mm` : current ? '' : item.category}</small></span>{current ? <Check size={14} /> : <Plus size={14} />}
      </button>)}
      {bank.isLoading ? <p role="status">Henter valg…</p> : bank.isError ? <p role="alert">Banken kunne ikke hentes. <button type="button" onClick={() => bank.refetch()}>Prøv igen</button></p> : !items.some(item => !item.current) && <p>Ingen andre valg matcher din søgning.</p>}
    </div>
    <small>{busy ? 'Tilføjer valget…' : 'Nye valg skal have tilhørende priser under Priser.'}</small>
  </div>;
}
