import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getIconStudioProductLabel } from '@/lib/icon-studio/catalog';
import { STUDIO_STYLES } from '../../../../supabase/functions/_shared/iconStudioRecipe.ts';
import { supabase } from '@/integrations/supabase/client';
import type { IconStudioReferenceAssetRow } from '@/lib/icon-studio/types';

export function StudioProductImageLibrary({ assets, onUseReference, initialView='folders', openRequest=0 }: { assets: IconStudioReferenceAssetRow[]; onUseReference: (asset: IconStudioReferenceAssetRow) => void; initialView?:'folders'|'generated'; openRequest?:number }) {
  const region = useRef<HTMLElement>(null);
  useEffect(()=>{if(openRequest){region.current?.scrollIntoView({block:"start"});region.current?.focus({preventScroll:true});}},[openRequest]);
  const [view, setView] = useState(initialView);
  const [product, setProduct] = useState('all');
  const [search, setSearch] = useState('');
  useEffect(()=>setView(initialView),[initialView]);
  const [format, setFormat] = useState('');
  const [orientation, setOrientation] = useState('portrait');
  const [busy, setBusy] = useState<string | null>(null);
  const formatOrder = ['din-lang', 'a7', 'a6', 'a5', 'a4', 'square-98', 'square-105', 'square-148', 'square-210'];
  const foldOrder = ['midterfalset', 'rullefalset', 'zigzagfalset', 'portfalset'];
  const library = assets.filter(asset => asset.metadata?.productImageLibrary === true && !asset.metadata.generatedFrom).sort((a, b) =>
    formatOrder.indexOf(String(a.metadata.formatKey)) - formatOrder.indexOf(String(b.metadata.formatKey))
    || foldOrder.indexOf(String(a.metadata.foldKey)) - foldOrder.indexOf(String(b.metadata.foldKey)));
  const generated=assets.filter(asset=>asset.metadata?.productImageLibrary===true && asset.metadata.generatedFrom).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  useEffect(()=>{if (!library.length && generated.length) setView('generated');},[library.length,generated.length]);
  if (!library.length && !generated.length) return null;
  const formats = [...new Set(library.map(asset => String(asset.metadata.formatLabel || '')))].filter(Boolean);
  const selected = formats.includes(format) ? format : formats[0];
  const filteredGenerated=generated.filter(asset=>(product==='all'||asset.product_key===product)&&asset.name.toLocaleLowerCase('da-DK').includes(search.toLocaleLowerCase('da-DK')));
  async function download(asset: IconStudioReferenceAssetRow) {
    setBusy(asset.id);
    try {
      const { data, error } = await supabase.storage.from('icon-studio').download(asset.storage_path);
      if (error || !data) throw new Error('Billedet kunne ikke hentes.');
      const url = URL.createObjectURL(data);
      try {
        const link = document.createElement('a'); link.href = url; link.download = asset.file_name;
        document.body.appendChild(link); link.click(); link.remove();
      } finally { URL.revokeObjectURL(url); }
    } catch { toast.error('Billedet kunne ikke hentes. Prøv igen.'); }
    finally { setBusy(null); }
  }
  return <section ref={region} tabIndex={-1} className="space-y-4 scroll-mt-28 rounded-lg border p-4" aria-label="Produktbilledbibliotek">
    <div><h2 className="text-lg font-semibold">Produktbilledbibliotek</h2>
      <p className="text-sm text-muted-foreground">{library.length + generated.length} billeder · {generated.length} gemte genereringer · klar til genbrug</p></div>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Bibliotekets samlinger">
      <Button type="button" disabled={!library.length} variant={view==='folders'?'default':'outline'} aria-pressed={view==='folders'} onClick={()=>setView('folders')}>Folderbilleder · {library.length}</Button>
      <Button type="button" variant={view==='generated'?'default':'outline'} aria-pressed={view==='generated'} onClick={()=>setView('generated')}>Gemte genereringer · {generated.length}</Button>
    </div>
    {view==='folders' ? <>
    <label className="flex flex-wrap items-center gap-3 text-sm">Format
      <select className="min-h-11 max-w-full rounded-md border bg-background px-3 text-base" value={selected} onChange={event => setFormat(event.target.value)}>
        {formats.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
    <label className="flex flex-wrap items-center gap-3 text-sm">Retning
      <select className="min-h-11 rounded-md border bg-background px-3 text-base" value={orientation} onChange={event => setOrientation(event.target.value)}>
        <option value="portrait">Lodret</option><option value="landscape">Vandret</option>
      </select>
    </label>
    </> : <div className="flex flex-wrap gap-3">
      <label className="flex flex-col gap-2 text-sm">Produkttype<select className="min-h-11 rounded-md border bg-background px-3 text-base" value={product} onChange={e=>setProduct(e.target.value)}><option value="all">Alle produkter</option>{[...new Set(generated.map(asset=>asset.product_key))].map(key=><option key={key} value={key}>{getIconStudioProductLabel(key)}</option>)}</select></label>
      <label className="flex min-w-0 flex-col gap-2 text-sm">Søg efter navn<Input type="search" className="min-h-11 text-base" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    </div>}
    {view==='generated' && !filteredGenerated.length && <p className="text-sm text-muted-foreground">{generated.length?'Ingen billeder matcher søgningen.':'Gem et genereret billede for at bygge videre på samlingen.'}</p>}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {(view==='generated'?filteredGenerated:library.filter(asset => asset.metadata.formatLabel === selected && (asset.metadata.orientationKey === 'square' || (asset.metadata.orientationKey || 'portrait') === orientation))).map(asset => <article key={asset.id} className="min-w-0 rounded-lg border p-3">
        <div className="aspect-square overflow-hidden bg-white">{asset.preview_url && <img src={asset.preview_url} alt={asset.name} loading="lazy" className="h-full w-full object-contain" />}</div>
        <h3 className="mt-3 text-sm font-medium">{asset.name}</h3>
        <p className="my-2 text-xs text-muted-foreground">{Number(asset.metadata.canvasWidth)||2080} × {Number(asset.metadata.canvasHeight)||2048} px{asset.metadata.foldKey === 'portfalset' ? ' · illustration · ikke en bestillingsmulighed' : ''}</p>
        {Boolean(asset.metadata.generatedFrom) && <p className="mb-2 text-xs text-muted-foreground">{getIconStudioProductLabel(asset.product_key)} · {STUDIO_STYLES.find(style=>style.id===(asset.metadata.generatedFrom as Record<string,unknown>).styleId)?.label || 'AI-billede'}{asset.metadata.formatLabel?` · ${asset.metadata.formatLabel}`:''}</p>}
        <Button className="mb-2 min-h-11 w-full" onClick={() => onUseReference(asset)}>Brug som reference</Button>
        <Button variant="outline" className="min-h-11 w-full" disabled={busy !== null} onClick={() => void download(asset)}>{busy === asset.id ? 'Henter…' : 'Download billede'}</Button>
        {typeof asset.metadata.publicUrl === 'string' && /^https:\/\//i.test(asset.metadata.publicUrl) && <Button variant="ghost" className="mt-1 min-h-11 w-full" onClick={() => {
          void navigator.clipboard.writeText(String(asset.metadata.publicUrl)).then(() => toast.success('Billedlink kopieret til produktbyggeren.'), () => toast.error('Billedlinket kunne ikke kopieres.'));
        }}>Kopiér billedlink</Button>}
      </article>)}
    </div>
  </section>;
}
