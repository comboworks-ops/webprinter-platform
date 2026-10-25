import { StudioColourInput } from './StudioColourInput';
import { ONLINETRYKSAGER_PACK_ID, selectStudioPackReference, studioPackEntry } from '../../../../supabase/functions/_shared/iconStudioOnlinetryksager.ts';
import { StudioOpenAiConnection } from './StudioOpenAiConnection';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ICON_STUDIO_PRODUCTS, getIconStudioProductLabel, type IconStudioProductKey } from '@/lib/icon-studio/catalog';
import { STUDIO_STYLES, STUDIO_TREATMENTS, STUDIO_VIEWS, STUDIO_MAX_COLLECTION, studioStyle, studioViews, studioVariant, studioRecipeSignature, planStudioCollection, type StudioRecipe, type StudioView } from '../../../../supabase/functions/_shared/iconStudioRecipe.ts';
import { prepareIconStudioJobs, runIconStudioJob, retryIconStudioJob, downloadIconStudioCollection, type CreateIconStudioJobInput } from '@/lib/icon-studio/service';
import { parseStudioPayload } from '../../../../supabase/functions/_shared/iconStudioValidation.ts';
import { groupStudioCollections, runStudioQueue } from '@/lib/icon-studio/collections';
import type { IconStudioBrandAssetRow, IconStudioJobRow, IconStudioJobWithOutputs, IconStudioReferenceAssetRow } from '@/lib/icon-studio/types';
import type { IconStudioProviderPreference } from '@/lib/icon-studio/provider';
import '@/styles/iconStudioComposer.css';
import { useStudioBrandPalette } from '@/hooks/useStudioBrandPalette';
import type { StudioPaletteMode } from '@/lib/icon-studio/brandPalette';

interface Props {
  tenantId:string; jobs:IconStudioJobWithOutputs[]; references:IconStudioReferenceAssetRow[]; brandAssets:IconStudioBrandAssetRow[];
  refresh:() => Promise<void>; renderJob:(job:IconStudioJobWithOutputs) => ReactNode;
  librarySelection:{id:string;nonce:number}|null; openLibrary:() => void;
  openReferences:() => void; onBusyChange:(busy:boolean) => void;
}
const QUICK_STYLES = ['photo','studio3d','clay','animation','flat','outline','watercolour','exclusive'];
const styleLabel = (id:string) => id==='photo'?'Realistisk':id==='studio3d'?'3D':studioStyle(id).label;
const INITIAL_RECIPE: Omit<StudioRecipe, 'palette'> = {version:1,compositionVersion:2,styleId:'clay',treatmentId:'none',viewId:'left',anchorOutputId:null};

export function IconStudioComposer({tenantId,jobs,references,brandAssets,refresh,renderJob,openReferences,onBusyChange,librarySelection,openLibrary}:Props) {
  const branding = useStudioBrandPalette(tenantId);
  const [paletteMode,setPaletteMode] = useState<StudioPaletteMode>('saved');
  const [mode,setMode] = useState<'single'|'collection'>('single');
  const [product,setProduct] = useState<IconStudioProductKey>('presentation_folder');
  const [products,setProducts] = useState<IconStudioProductKey[]>(['presentation_folder','business_card','flyer']);
  const [views,setViews] = useState<StudioView[]>(['left']);
  const [recipe,setRecipe] = useState<StudioRecipe>(()=>({...INITIAL_RECIPE,palette:branding.data?.saved?.palette || ['#ffffff','#ffffff']}));
  const [provider,setProvider] = useState<IconStudioProviderPreference>('openai');
  const [size,setSize] = useState<512|1024|1536|2048>(1024);
  const [brand,setBrand] = useState('none');
  const [name,setName] = useState('Min billedsamling');
  const [busy,setBusy] = useState(false);
  const [downloading,setDownloading] = useState(false);
  const [paused,setPaused] = useState(false);
  const [error,setError] = useState<string|null>(null);
  const [focusIds,setFocusIds] = useState<string[]>([]);
  const [activeCollection,setActiveCollection] = useState<string|null>(null);
  const stop = useRef(false);
  const alive = useRef(true);
  const running = useRef(false);
  const automaticPalette = paletteMode === 'custom' ? null : branding.data?.[paletteMode];
  const paletteNeedsSync = Boolean(automaticPalette && (automaticPalette.palette[0] !== recipe.palette[0] || automaticPalette.palette[1] !== recipe.palette[1]));
  const paletteUnavailable = paletteMode !== 'custom' && (branding.isPending || branding.isError || !automaticPalette || paletteNeedsSync);
  useEffect(()=>{
    if (busy || !automaticPalette || !paletteNeedsSync) return;
    setRecipe(current=>({...current,palette:[...automaticPalette.palette],anchorOutputId:null}));
    setFocusIds([]);setActiveCollection(null);
  },[automaticPalette,busy,paletteNeedsSync]);
  useEffect(() => { alive.current=true; return () => {alive.current=false;stop.current=true;onBusyChange(false);}; },[onBusyChange]);
  useEffect(() => {
    if (!busy) return;
    const warn = (event:BeforeUnloadEvent) => {event.preventDefault();};
    window.addEventListener('beforeunload',warn);
    return () => window.removeEventListener('beforeunload',warn);
  },[busy]);
  const libraryRegion = useRef<HTMLElement>(null);
  const referenceList = useRef(references);
  referenceList.current = references;
  useEffect(() => {
    if (!librarySelection) return;
    const asset = referenceList.current.find(a => a.id === librarySelection.id && a.tenant_id === tenantId && a.metadata?.productImageLibrary === true);
    if (!asset) return;
    setProduct(asset.product_key);setMode('single');setFocusIds([]);setActiveCollection(null);setError(null);
    setRecipe(r => ({...r,viewId:studioViews(r.styleId,asset.product_key).some(v=>v.id===r.viewId)?r.viewId:'left',libraryReferenceId:asset.id,referencePackId:undefined,productReferenceId:undefined,anchorOutputId:null}));
    libraryRegion.current?.scrollIntoView({block:"start"});libraryRegion.current?.focus({preventScroll:true});
  },[librarySelection,tenantId]);
  const libraryReference = references.find(a => a.id === recipe.libraryReferenceId && a.tenant_id === tenantId);
  const packReferences = references.filter(a=>a.is_active && studioPackEntry(a.metadata));
  const productReferences = packReferences.filter(a=>a.product_key===product);
  const productReference = recipe.referencePackId ? productReferences.find(a=>a.id===recipe.productReferenceId) || selectStudioPackReference(packReferences,product) : undefined;
  const missingPackProducts = recipe.referencePackId ? (mode==='single'?[product]:products).filter(p=>!packReferences.some(a=>a.product_key===p)) : [];
  const style = studioStyle(recipe.styleId);
  const selectedProducts = mode === 'single' ? [product] : products;
  const allowedViews = STUDIO_VIEWS.filter(v => selectedProducts.every(p => studioViews(recipe.styleId,p).some(item => item.id === v.id)));
  const selectedViews = mode === 'single' ? [recipe.viewId] : views;
  const invalidView = selectedViews.some(id => !allowedViews.some(v => v.id === id));
  const count = selectedProducts.length * selectedViews.length;
  const signature = studioRecipeSignature(recipe);
  const recipeJobs = useMemo(() => jobs.filter(job => {try {return Boolean(job.payload?.recipe && parseStudioPayload(job.payload,tenantId).recipe);} catch {return false;}}),[jobs,tenantId]);
  const matchesProvider = (job:IconStudioJobWithOutputs) => provider==='auto'
    ? ['openai-image-v1','gemini-image-v1'].includes(job.provider_key)
    : job.provider_key===(provider==='gemini'?'gemini-image-v1':'openai-image-v1');
  const approved = recipeJobs.filter(job => job.approved_output_id && job.payload.recipe && studioRecipeSignature(job.payload.recipe) === signature
    && matchesProvider(job));
  const anchor = approved.find(job => job.approved_output_id === recipe.anchorOutputId) || approved[0];
  const collections = useMemo(() => groupStudioCollections(recipeJobs),[recipeJobs]);
  const collection = collections.find(c => c.id === activeCollection);
  const sample = recipeJobs.find(j => !j.payload.collection && j.product_key === product && j.payload.recipe && studioRecipeSignature(j.payload.recipe) === signature && j.selected_brand_asset_id === (brand==='none'?null:brand) && j.payload.output.size === size && j.payload.recipe.viewId === recipe.viewId && (!recipe.referencePackId || j.payload.references.referenceAssetIds[0] === productReference?.id)
    && matchesProvider(j));
  const shownJobs = collection?.items || (focusIds.length ? jobs.filter(j => focusIds.includes(j.id)) : sample ? [sample] : []);

  function chooseStyle(styleId:string) {
    const next = studioStyle(styleId);
    const possible = STUDIO_VIEWS.filter(v => selectedProducts.every(p => studioViews(styleId,p).some(item => item.id === v.id)));
    setRecipe(r => ({...r,styleId,treatmentId:next.treatments.includes(r.treatmentId)?r.treatmentId:'none',viewId:possible.some(v => v.id === r.viewId)?r.viewId:'left',anchorOutputId:null}));
    setViews(current => {const valid=current.filter(id => possible.some(v => v.id===id));return valid.length?valid:['left'];});
    setFocusIds([]);setActiveCollection(null);
  }
  function inputFor(p:IconStudioProductKey,r:StudioRecipe):CreateIconStudioJobInput {
    return { tenantId,productKey:p,styleKey:studioStyle(r.styleId).legacyStyle,variantKey:studioVariant(r.viewId),providerPreference:provider,
      brandOverlayEnabled:brand!=='none',brandAssetId:brand==='none'?null:brand,finishKey:'flat',format:'png',size,
      referenceAssets:references,brandAssets,recipe:{...r,productReferenceId:r.referencePackId && p===product?productReference?.id:undefined},sampleCount:1 };
  }
  async function execute(items:IconStudioJobRow[]) {
    const outcome = await runStudioQueue(items, item => runIconStudioJob(item.id,tenantId,references,brandAssets), () => stop.current || !alive.current, async () => { if (alive.current) await refresh(); });
    if (!alive.current) return;
    if (outcome.failed) setError(`${outcome.errorMessage || 'En opgave kunne ikke afsluttes.'} De øvrige billeder er sat på pause.`);
    else if (stop.current) setPaused(true);
    else toast.success('Billederne er klar til gennemsyn.');
  }
  async function withBusy(action:() => Promise<void>) {
    if (running.current) return;
    running.current=true;stop.current=false;setBusy(true);onBusyChange(true);setPaused(false);setError(null);
    try {await action();} catch(e) {if(alive.current)setError(e instanceof Error?e.message:'Billedopgaven kunne ikke oprettes.');}
    finally {running.current=false;if(alive.current){setBusy(false);onBusyChange(false);await refresh();}}
  }
  async function create(asCollection:boolean) {
    await withBusy(async () => {
      if (paletteUnavailable) throw new Error('Vent på shoppens designfarver, eller vælg egne farver.');
      const items = asCollection ? planStudioCollection(products,views,{...recipe,anchorOutputId:anchor?.approved_output_id || null}) : [{productKey:product,recipe:{...recipe,anchorOutputId:null}}];
      if (asCollection && !anchor) throw new Error('Lav og godkend først et prøvebillede i denne stil.');
      if (asCollection && (!name.trim() || name.length>80)) throw new Error('Giv samlingen et navn på højst 80 tegn.');
      const id = asCollection ? crypto.randomUUID() : null;
      const inputs:CreateIconStudioJobInput[] = items.map((item,index) => ({...inputFor(item.productKey,item.recipe),...(id?{collection:{id,name:name.trim(),index,total:items.length}}:{})}));
      // An approved collection uses the same provider as its anchor, never a silent switch.
      if (asCollection && anchor) inputs.forEach(input => {if(anchor.provider_key==='openai-image-v1')input.expectedConnection=anchor.payload.connection || {source:'platform',version:null};input.providerPreference=anchor.provider_key==='openai-image-v1'?'openai':anchor.provider_key==='gemini-image-v1'?'gemini':'mock';});
      const prepared = await prepareIconStudioJobs(inputs);
      if (!alive.current) return;
      setFocusIds(prepared.map(j=>j.id));setActiveCollection(id);await refresh();await execute(prepared);
    });
  }
  function restore(job:IconStudioJobWithOutputs) {
    if (!job.payload.recipe) return;
    setPaletteMode('custom');
    setRecipe({...job.payload.recipe,compositionVersion:2,anchorOutputId:job.payload.recipe.compositionVersion===2?job.payload.recipe.anchorOutputId:null});setProduct(job.product_key);setSize(job.payload.output.size);setBrand(job.selected_brand_asset_id||'none');
    // Reusing an old test image must still create a real AI image in this flow.
    setProvider(job.provider_key==='gemini-image-v1'?'gemini':'openai');
    setFocusIds([]);setActiveCollection(job.payload.collection?.id || null);
    const previous = collections.find(c=>c.id===job.payload.collection?.id);
    if (previous) {
      setProducts([...new Set(previous.items.map(j=>j.product_key))]);
      setViews([...new Set(previous.items.map(j=>j.payload.recipe!.viewId))]);
    }
  }
  return <div className="studio-composer studio-simple">
    <div className="studio-simple-layout">
      <fieldset disabled={busy} className="studio-simple-form">
        <legend className="sr-only">Vælg produkt og stil</legend>
        <label className="studio-field studio-main-product">Produkt<select value={product} onChange={e=>{const p=e.target.value as IconStudioProductKey;setProduct(p);setRecipe(r=>({...r,productReferenceId:undefined,libraryReferenceId:undefined,anchorOutputId:null,viewId:studioViews(r.styleId,p).some(v=>v.id===r.viewId)?r.viewId:'left'}));setFocusIds([]);setActiveCollection(null);}}>{ICON_STUDIO_PRODUCTS.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select></label>
        <section ref={libraryRegion} tabIndex={-1} className="scroll-mt-28 rounded-lg border p-3 space-y-2" aria-label="Reference fra billedbiblioteket">
          {recipe.libraryReferenceId ? <>
            <div className="flex min-w-0 items-center gap-3">
              {libraryReference?.preview_url && <img src={libraryReference.preview_url} alt={libraryReference.name} className="h-20 w-20 shrink-0 rounded border bg-white object-contain"/>}
              <div className="min-w-0"><h2 className="text-sm font-semibold">Valgt reference</h2><p className="break-words text-sm">{libraryReference?.name || 'Referencen er ikke længere tilgængelig'}</p></div>
            </div>
            <p className="text-sm text-muted-foreground">Form og proportioner følger referencen. Vælg en ny stil herunder.</p>
            <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={openLibrary}>Skift reference</Button><Button type="button" variant="ghost" onClick={()=>{setRecipe(r=>({...r,libraryReferenceId:undefined,anchorOutputId:null}));setFocusIds([]);setActiveCollection(null);}}>Fjern reference</Button></div>
          </> : <Button type="button" variant="outline" onClick={openLibrary}>Vælg reference fra billedbiblioteket</Button>}
        </section>
        <section className="studio-simple-styles" aria-label="Stil">
          <h2>Stil</h2>
          <div className="studio-style-filters" role="group" aria-label="Vælg stil">{QUICK_STYLES.map(id=><button type="button" key={id} aria-pressed={recipe.styleId===id} onClick={()=>chooseStyle(id)}>{styleLabel(id)}</button>)}</div>
          <details className="studio-more-styles">
            <summary>Flere stile{!QUICK_STYLES.includes(recipe.styleId)?` · ${styleLabel(recipe.styleId)}`:''}</summary>
            <div className="studio-style-filters" role="group" aria-label="Flere stile">{STUDIO_STYLES.filter(s=>!QUICK_STYLES.includes(s.id)).map(s=><button type="button" key={s.id} aria-pressed={recipe.styleId===s.id} onClick={()=>chooseStyle(s.id)}>{s.label}</button>)}</div>
          </details>
          <p className="studio-style-hint">{style.description}</p>
        </section>
        <section className="studio-brand-palette" aria-label="Billedets brandfarver">
          <label className="studio-field">Farver fra<select value={paletteMode} onChange={e=>setPaletteMode(e.target.value as StudioPaletteMode)}>
            <option value="saved">Gemt design · automatisk</option>
            <option value="published">Offentlig hjemmeside · automatisk</option>
            <option value="custom">Egne farver</option>
          </select></label>
          {paletteMode!=='custom' && branding.isPending ? <p role="status" className="studio-style-hint">Henter shoppens designfarver…</p> : <>
            <p className="studio-style-hint">{paletteMode==='custom'?'Egne billedfarver':automaticPalette?.designName || 'Designfarver er ikke tilgængelige'}</p>
            {!paletteUnavailable && <div className="studio-brand-swatches" aria-label="Valgte billedfarver">{recipe.palette.map((colour,index)=><span key={index}><i aria-hidden="true" style={{backgroundColor:colour}}/>{colour}</span>)}</div>}
          </>}
          {paletteMode!=='custom' && (branding.isError || (!branding.isPending&&!automaticPalette)) && <p role="alert" className="studio-style-hint">Designfarverne kunne ikke hentes. <button type="button" onClick={()=>void branding.refetch()}>Prøv igen</button>, eller vælg egne farver.</p>}
        </section>
        <details className="studio-simple-options">
          <summary>Farver, logo og flere valg</summary>
          <div className="studio-advanced">
            <div className="studio-palette">{recipe.palette.map((colour,i)=><StudioColourInput key={i} label={i===0?'Primær farve':'Sekundær farve'} value={colour} onChange={next=>{setPaletteMode('custom');setRecipe(r=>{const palette:[string,string]=[...r.palette];palette[i]=next;return {...r,palette,anchorOutputId:null};});setFocusIds([]);setActiveCollection(null);}}/>)}</div>
            <label className="studio-field">Logo<select value={brand} onChange={e=>{setBrand(e.target.value);setFocusIds([]);setActiveCollection(null);}}><option value="none">Uden logo</option>{brandAssets.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label className="studio-field">Visning<select value={recipe.viewId} onChange={e=>{setRecipe(r=>({...r,viewId:e.target.value as StudioView}));setFocusIds([]);setActiveCollection(null);}}>{studioViews(recipe.styleId,product).map(v=><option key={v.id} value={v.id}>{v.label}</option>)}</select></label>
            <label className="studio-field">Ekstra effekt<select value={recipe.treatmentId} onChange={e=>{setRecipe(r=>({...r,treatmentId:e.target.value as StudioRecipe['treatmentId'],anchorOutputId:null}));setFocusIds([]);setActiveCollection(null);}}>{STUDIO_TREATMENTS.filter(t=>style.treatments.includes(t.id)).map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
            <label className="studio-field">Referencepakke<select value={recipe.referencePackId||'none'} onChange={e=>{setRecipe(r=>({...r,referencePackId:e.target.value==='none'?undefined:ONLINETRYKSAGER_PACK_ID,productReferenceId:undefined,libraryReferenceId:undefined,anchorOutputId:null}));setFocusIds([]);setActiveCollection(null);}}><option value="none">Ingen referencepakke</option><option value={ONLINETRYKSAGER_PACK_ID}>Onlinetryksager</option></select></label>
            {recipe.referencePackId&&<div className="studio-pack-reference">
              {productReferences.length>0?<><label className="studio-field">Konstruktion · {getIconStudioProductLabel(product)}<select value={productReference?.id||''} onChange={e=>{setRecipe(r=>({...r,productReferenceId:e.target.value}));setFocusIds([]);setActiveCollection(null);}}>{productReferences.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>{productReference?.preview_url&&<img src={productReference.preview_url} alt={`Kildereference: ${productReference.name}`} className="h-28 w-28 rounded-md border object-contain"/>}</>:<p>Der er endnu ingen reference til dette produkt.</p>}
              <Button type="button" variant="outline" onClick={openReferences}>Åbn referencepakken</Button>
            </div>}
            <label className="studio-field">Billedmotor<select value={provider} onChange={e=>{setProvider(e.target.value as IconStudioProviderPreference);setFocusIds([]);setActiveCollection(null);}}><option value="openai">OpenAI</option><option value="gemini">Gemini</option><option value="auto">Automatisk</option></select></label>
            <label className="studio-field">Billedstørrelse<select value={size} onChange={e=>{setSize(Number(e.target.value) as typeof size);setFocusIds([]);setActiveCollection(null);}}>{[512,1024,1536,2048].map(n=><option key={n} value={n}>{n} × {n} px</option>)}</select></label>
          </div>
        </details>
        {mode==='collection'&&<section className="studio-simple-collection">
          <div className="studio-section-heading"><h2>Matching samling</h2><Button type="button" variant="ghost" onClick={()=>setMode('single')}>Ét billede</Button></div>
          <label className="studio-field">Samlingens navn<Input value={name} maxLength={80} onChange={e=>setName(e.target.value)}/></label>
          <details className="studio-product-picker"><summary>{products.length} produkter valgt</summary><div>{ICON_STUDIO_PRODUCTS.map(p=><label key={p.key}><input type="checkbox" checked={products.includes(p.key)} onChange={e=>setProducts(current=>e.target.checked?[...current,p.key]:current.filter(k=>k!==p.key))}/>{p.label}</label>)}</div></details>
          <div className="studio-view-list" role="group" aria-label="Samlingens visninger">{STUDIO_VIEWS.map(v=><button key={v.id} type="button" disabled={!allowedViews.some(item=>item.id===v.id)} aria-pressed={views.includes(v.id)} onClick={()=>setViews(current=>current.includes(v.id)?current.filter(id=>id!==v.id):[...current,v.id])}>{v.label}</button>)}</div>
          <label className="studio-field">Godkendt stilprøve<select value={anchor?.approved_output_id||''} onChange={e=>setRecipe(r=>({...r,anchorOutputId:e.target.value||null}))}><option value="">Lav og godkend et billede først</option>{approved.map(j=><option key={j.id} value={j.approved_output_id!}>{getIconStudioProductLabel(j.product_key)} · {new Date(j.created_at).toLocaleDateString('da-DK')}</option>)}</select></label>
          <p className="studio-style-hint">Samlingen følger det godkendte billedes stil.</p>
          {invalidView&&<p role="alert">En valgt visning passer ikke til alle produkterne. <button type="button" onClick={()=>setViews(current=>current.filter(id=>allowedViews.some(v=>v.id===id)))}>Fjern utilgængelige visninger</button></p>}
          {count>STUDIO_MAX_COLLECTION&&<p role="alert">Vælg højst {STUDIO_MAX_COLLECTION} billeder ad gangen.</p>}
        </section>}
        <div className="studio-simple-generate">
          <p className="studio-recipe-summary">{getIconStudioProductLabel(product)} · {styleLabel(recipe.styleId)}{recipe.treatmentId!=='none'?` · ${STUDIO_TREATMENTS.find(t=>t.id===recipe.treatmentId)?.label}`:''}{brand!=='none'?' · med logo':''}</p>
          <Button disabled={busy||paletteUnavailable||Boolean(recipe.libraryReferenceId&&!libraryReference)||Boolean(recipe.referencePackId&&!productReference)} onClick={()=>void create(false)}>{busy?'Genererer…':mode==='collection'?'Generér stilprøve':'Generér billede'}</Button>
          {mode==='collection'&&<Button disabled={busy||paletteUnavailable||missingPackProducts.length>0||!anchor||!count||count>STUDIO_MAX_COLLECTION||invalidView||!name.trim()} onClick={()=>void create(true)}>Generér samling · {count} billeder</Button>}
          {missingPackProducts.length>0&&<p role="alert" className="studio-style-hint">Mangler referencer: {missingPackProducts.map(getIconStudioProductLabel).join(', ')}.</p>}
          <p className="studio-cost-note">Generering bruger AI-kreditter.</p>
          {mode==='single'&&!recipe.libraryReferenceId&&<Button type="button" variant="ghost" onClick={()=>setMode('collection')}>Lav en matching samling</Button>}
        </div>
      </fieldset>
      <section className="studio-simple-results" aria-label="Dit billede">
        {busy&&<div role="status" className="studio-generation-status"><span>AI skaber {mode==='collection'?'billederne':'dit billede'}. Hold siden åben.</span><Button variant="outline" onClick={()=>{stop.current=true;setPaused(true);}}>Pause efter dette billede</Button></div>}
        {paused&&!busy&&<p role="status" className="studio-notice">Samlingen er sat på pause. Dine billeder er gemt.</p>}
        {error&&<p role="alert" className="studio-error">{error}</p>}
        {shownJobs.length===0&&<div className="studio-result-placeholder"><span aria-hidden="true">✦</span><h2>Dit billede vises her</h2><p>Vælg produkt og stil, og tryk Generér billede.</p></div>}
        {collection&&<div className="studio-section-heading"><h2>{collection.name}</h2><Badge variant="outline">{collection.items.filter(j=>['ready_for_review','approved'].includes(j.status)).length}/{collection.total} klar</Badge></div>}
        {collection&&<div className="studio-result-actions"><Button variant="outline" disabled={busy||!collection.items.some(j=>j.status==='draft')} onClick={()=>void withBusy(()=>execute(collection.items))}>Fortsæt ventende billeder</Button><Button variant="outline" disabled={busy} onClick={()=>{restore(collection.items[0]);setMode('collection');setName(`${collection.name} · ny serie`.slice(0,80));}}>Genbrug stil</Button><Button variant="outline" disabled={downloading||collection.items.length!==collection.total||collection.items.some(j=>!j.approved_output_id)} onClick={async()=>{setDownloading(true);try{await downloadIconStudioCollection(tenantId,collection.name,collection.items);}catch(e){toast.error(e instanceof Error?e.message:'Samlingen kunne ikke hentes.');}finally{setDownloading(false);}}}>{downloading?'Henter…':'Download samling · ZIP'}</Button></div>}
        <div className="studio-output-list">{shownJobs.map(job=><div key={job.id}>
          {job.status==='draft'&&<p>Venter på generering.</p>}
          {job.status==='processing'&&!busy&&<p className="studio-notice">Billedet er startet. Opdater status for at hente resultatet.</p>}
          {renderJob(job)}
          <div className="studio-result-actions"><Button variant="ghost" disabled={busy} onClick={()=>restore(job)}>Genbrug indstillinger</Button>
          {job.status==='ready_for_review'&&job.outputs.length>0&&<Button variant="outline" disabled={busy} onClick={()=>void withBusy(async()=>{const next=await retryIconStudioJob(job,true);setFocusIds([next.id]);await refresh();await execute([next]);})}>Generér en ny version</Button>}
          {job.status==='failed'&&job.outputs.length===0&&<Button variant="outline" disabled={busy} onClick={()=>void withBusy(async()=>{const next=await retryIconStudioJob(job);setFocusIds([next.id]);await refresh();await execute([next]);})}>Prøv igen · bruger billedforbrug</Button>}
          {!collection&&job.status==='draft'&&<Button variant="outline" disabled={busy} onClick={()=>void withBusy(()=>execute([job]))}>Fortsæt billedet</Button>}</div>
        </div>)}</div>
      </section>
    </div>
    <div className="studio-simple-secondary">
      {collections.length>0&&<details><summary>Åbn gemt samling</summary><label className="studio-field">Gemt samling<select disabled={busy} value={activeCollection||''} onChange={e=>{setActiveCollection(e.target.value||null);setFocusIds([]);}}><option value="">Vælg en samling</option>{collections.map(c=><option key={c.id} value={c.id}>{c.name} · {c.total} billeder</option>)}</select></label></details>}
      <details><summary>AI-forbindelse og egen API-nøgle</summary><StudioOpenAiConnection key={tenantId} tenantId={tenantId} disabled={busy}/></details>
    </div>
  </div>;
}
