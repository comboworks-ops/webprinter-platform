import { FontSelector } from './FontSelector';
import { WIDE_ELEMENTS, wideElementStyles, withWideElementStyle, type WideElementStyle } from '@/lib/branding/wideFormatElements';
import type { BrandingData } from '@/hooks/useBrandingDraft';

export function WideFormatElementInspector({branding,section,selected,onSelect,onChange}: {branding:BrandingData;section:string;selected:string|null;onSelect:(id:string)=>void;onChange:(patch:Partial<BrandingData>)=>void}) {
  const choices=WIDE_ELEMENTS.filter(item=>item.section===section);
  if (!choices.length) return null;
  const element=choices.find(item=>item.id===selected) || choices[0];
  const style=wideElementStyles(branding)[element.id] || {};
  const update=(patch:WideElementStyle)=>onChange(withWideElementStyle(branding,element.id,patch));
  return <fieldset className="m-3 space-y-4 rounded-lg border p-3" data-wide-element-inspector={element.id}>
    <legend className="px-1 text-sm font-semibold">Redigér element</legend>
    <label className="block space-y-2 text-sm"><span>Valgt element</span><select aria-label="Valgt element" className="min-h-11 w-full rounded border bg-background p-2" value={element.id} onChange={e=>onSelect(e.target.value)}>{choices.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <p className="text-xs text-muted-foreground">Klik på tekst, billeder eller knapper i previewet. Tomme felter følger shoppens design. Ændringer gælder kun dette shopdesign.</p>
    {(['color','backgroundColor'] as const).map(key=><label key={key} className="block space-y-2 text-sm"><span>{key==='color'?'Elementets tekstfarve':'Elementets baggrund'}</span><input aria-label={key==='color'?'Elementets tekstfarve':'Elementets baggrund'} className="min-h-11 w-full rounded border bg-background p-2" placeholder="#123456" maxLength={7} defaultValue={style[key] || ''} key={`${element.id}-${style[key]}`} onBlur={e=>{if (/^#[\da-f]{6}$/i.test(e.target.value)) update({[key]:e.target.value});}}/></label>)}
    <FontSelector label="Elementets skrifttype" value={style.fontFamily || ''} onChange={fontFamily=>update({fontFamily})}/>
    <div className="grid grid-cols-2 gap-3">{([['fontSize','Størrelse (px)',10,160,1],['mobileFontSize','Mobil (px)',10,100,1],['lineHeight','Linjeafstand',0.9,2.5,0.1],['letterSpacing','Bogstavafstand',-3,12,0.1],['borderRadius','Afrunding (px)',0,80,1],['paddingBlock','Luft op/ned (px)',0,160,1]] as const).map(([key,label,min,max,step])=><label className="space-y-2 text-sm" key={key}><span>{label}</span><input aria-label={label} className="min-h-11 w-full rounded border bg-background p-2" type="number" min={min} max={max} step={step} placeholder="Design" value={style[key] ?? ''} onChange={e=>{if(e.target.value!=='')update({[key]:Number(e.target.value)});}}/></label>)}</div>
    <label className="block space-y-2 text-sm"><span>Skrifttykkelse</span><select aria-label="Skrifttykkelse" className="min-h-11 w-full rounded border bg-background p-2" value={style.fontWeight || ''} onChange={e=>update({fontWeight:e.target.value})}><option value="" disabled>Følg designet</option>{['400','500','600','700','800','900'].map(w=><option key={w}>{w}</option>)}</select></label>
    <label className="block space-y-2 text-sm"><span>Tekstjustering</span><select aria-label="Tekstjustering" className="min-h-11 w-full rounded border bg-background p-2" value={style.textAlign || ''} onChange={e=>update({textAlign:e.target.value})}><option value="" disabled>Følg designet</option><option value="left">Venstre</option><option value="center">Centreret</option><option value="right">Højre</option></select></label>
    <button type="button" className="min-h-11 rounded border px-3 text-sm" onClick={()=>onChange(withWideElementStyle(branding,element.id,null))}>Nulstil elementets udseende</button>
  </fieldset>;
}
