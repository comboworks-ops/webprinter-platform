import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { WorkspaceImageInput } from './WorkspaceImageInput';
import { ProductTooltipIcon, type TooltipConfig } from '@/components/ProductTooltipIcon';
import { safePresentationUrl } from '@/lib/products/productPresentation';
import type { TooltipTarget } from '@/lib/products/tooltipPlacement';

export function TooltipEditor({selectedAnchor, existingTooltip, target, tenantId, productId, onSave, onDelete, onCancel, onPreview}: {
  selectedAnchor: string | null; existingTooltip?: TooltipConfig | null; target?: TooltipTarget;
  tenantId?: string; productId?: string;
  onSave: (tooltip: TooltipConfig) => void | Promise<void>; onDelete: (id: string) => void | Promise<void>;
  onCancel: () => void; onPreview?: (tooltip: TooltipConfig) => void;
}) {
  const [draft, setDraft] = useState<TooltipConfig>(() => ({anchor:selectedAnchor || '',icon:'info',color:'#0EA5E9',animation:'fade',text:'',...existingTooltip,target:target || existingTooltip?.target}));
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const update = (patch: Partial<TooltipConfig>) => setDraft(current => ({...current,...patch}));
  useEffect(() => { if(selectedAnchor) onPreview?.(draft); },[draft,selectedAnchor,onPreview]);
  if (!selectedAnchor) return <p className="p-4 text-sm text-muted-foreground">Vælg “Placér tooltip”, og klik på en tekst, knap, et billede eller en sektion i den rigtige webshop.</p>;
  const save = async () => {
    if ([draft.link,draft.imageUrl,draft.iconUrl].some(value => value && !safePresentationUrl(value))) {setError('Brug et HTTPS-link eller en intern sti, der begynder med /.');return;}
    setSaving(true);setError('');
    try {await onSave({...draft,text:draft.text.trim()});} catch (e) {setError(e instanceof Error ? e.message : 'Kunne ikke gemme.');} finally {setSaving(false);}
  };
  return <div className="space-y-4 p-4">
    <div><h3 className="font-semibold">{draft.target?.label || selectedAnchor}</h3><p className="text-xs text-muted-foreground break-all">{draft.target?.page || 'Produktets eksisterende hjælpepunkt'}</p></div>
    <label className="block text-sm">Tekst<Textarea aria-label="Tooltiptekst" value={draft.text} maxLength={2000} onChange={e=>update({text:e.target.value})}/></label>
    <div className="grid grid-cols-2 gap-3">
      <label className="text-sm">Ikon<select aria-label="Tooltipikon" className="block w-full rounded border p-2" value={draft.icon} onChange={e=>update({icon:e.target.value as TooltipConfig['icon']})}>{[['info','Information'],['question','Spørgsmål'],['lightbulb','Tip'],['star','Stjerne'],['heart','Hjerte'],['alert','Bemærk'],['check','Flueben'],['image','Billede']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label className="text-sm">Farve<Input type="color" aria-label="Tooltipfarve" value={draft.color} onChange={e=>update({color:e.target.value})}/></label>
      <label className="text-sm">Effekt<select aria-label="Tooltipeffekt" className="block w-full rounded border p-2" value={draft.animation} onChange={e=>update({animation:e.target.value as TooltipConfig['animation']})}>{[['none','Ingen'],['fade','Fade ind'],['slide','Glid ind'],['bounce','Spring'],['zoom','Zoom ind']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
      <label className="text-sm">Åbn mod<select aria-label="Tooltipretning" className="block w-full rounded border p-2" value={draft.side || 'top'} onChange={e=>update({side:e.target.value as TooltipConfig['side']})}>{[['top','Top'],['bottom','Bund'],['left','Venstre'],['right','Højre']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    </div>
    {draft.target && <fieldset className="grid grid-cols-2 gap-3 rounded border p-3"><legend className="text-xs">Ikonets placering på elementet</legend>{(['x','y'] as const).map(axis=><label className="text-sm" key={axis}>{axis==='x'?'Vandret':'Lodret'} (%)<Input type="number" min={0} max={100} value={draft.target?.[axis] ?? (axis==='x'?100:0)} onChange={e=>update({target:{...draft.target!,[axis]:Math.max(0,Math.min(100,Number(e.target.value)))}})}/></label>)}</fieldset>}
    {tenantId && productId && <><WorkspaceImageInput label="Billede i tooltip" tenantId={tenantId} productId={productId} value={draft.imageUrl || ''} onChange={imageUrl=>update({imageUrl})}/><label className="block text-sm">Billedbeskrivelse<Input value={draft.imageAlt || ''} onChange={e=>update({imageAlt:e.target.value})}/></label><WorkspaceImageInput label="Eget ikon (valgfrit)" tenantId={tenantId} productId={productId} value={draft.iconUrl || ''} onChange={iconUrl=>update({iconUrl})}/></>}
    <label className="block text-sm">Link (valgfrit)<Input aria-label="Tooltiplink" value={draft.link || ''} onChange={e=>update({link:e.target.value})} placeholder="https://…"/></label>
    <div className="flex items-center gap-3 rounded border p-3 text-sm"><ProductTooltipIcon config={draft}/>Prøv tooltip</div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button type="button" disabled={saving || !draft.text.trim()} onClick={save}>{saving?'Gemmer…':'Gem tooltip'}</Button><Button type="button" variant="outline" onClick={onCancel}>Annuller</Button>{existingTooltip && <Button type="button" variant="destructive" disabled={saving} onClick={async()=>{setSaving(true);try{await onDelete(selectedAnchor);}catch(e){setError(e instanceof Error?e.message:'Kunne ikke slette.');}finally{setSaving(false)}}}>Slet tooltip</Button>}</div>
  </div>;
}
