import { materialTooltipDefaults } from '@/lib/products/materialPresentation';
import { tooltipDraftChanged } from '@/lib/products/tooltipDraft';
import { useWideMaterialTooltipDefaults } from '@/hooks/useWideMaterialTooltipDefaults';
import { ADMIN_WORKSPACE_EXIT_EVENT } from '@/lib/admin/workspaceExit';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { TooltipEditor } from './TooltipEditor';
import { AvailabilityTooltipEditor } from './AvailabilityTooltipEditor';
import { useProductAttributes } from '@/hooks/useProductAttributes';
import { unavailableOptionAnchor, UNAVAILABLE_OPTION_ANCHOR } from '@/lib/products/optionAvailability';
import { captureTooltipTarget, findTooltipTarget, type TooltipTarget } from '@/lib/products/tooltipPlacement';
import { saveProductTooltips } from '@/lib/products/saveProductTooltips';
import { TOOLTIP_PREVIEW_UPDATE } from '@/components/StorefrontTooltipLayer';
import type { TooltipConfig } from '@/components/ProductTooltipIcon';
import type { AnchorZone } from './ProductPagePreview';
import '@/styles/productEditorUnified.css';

type Owner = {id:string; name:string; slug:string; banner_config: {visual_tooltips?:TooltipConfig[]}; pricing_structure?: {vertical_axis?:{sectionId:string;sectionType:string;groupId:string;valueIds:string[];valueSettings?:Record<string,{displayName?:string}>};layout_rows?:{columns?:{id:string;groupId:string;title?:string;labelOverride?:string;ui_mode?:string;valueIds?:string[];valueSettings?:Record<string,{displayName?:string}>}[]}[]}};
export function VisualTooltipDesigner({productId,tenantId,productSlug,productName,tooltips,onTooltipsChange}: {
  productId:string; tenantId:string; productSlug:string; productName?:string; productImage?:string; tooltips:TooltipConfig[]; onTooltipsChange:(tooltips:TooltipConfig[])=>void|Promise<void>;
}) {
  const frame=useRef<HTMLIFrameElement>(null);
  const [owner,setOwner]=useState<Owner>({id:productId,name:productName || '',slug:productSlug,banner_config:{visual_tooltips:tooltips}});
  const [page,setPage]=useState(`/produkt/${productSlug}`);
  const [placing,setPlacing]=useState(false);
  const [granularity,setGranularity]=useState('element');
  const [mobile,setMobile]=useState(false);
  const [loaded,setLoaded]=useState(0);
  const [selected,setSelected]=useState<{anchor:string;target?:TooltipTarget}|null>(null);
  const [draft,setDraft]=useState<TooltipConfig|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [list,setList]=useState<TooltipConfig[]>(tooltips);
  const queryClient=useQueryClient();
  const {groups}=useProductAttributes(owner.id,tenantId);
  const wideMaterialDefaults=useWideMaterialTooltipDefaults(owner.id,tenantId);
  const request=useRef(0);
  const loadOwner=useCallback(async (filter:{id?:string;slug?:string})=>{
    const token=++request.current;setLoading(true);setError('');
    try {
      let query=supabase.from('products').select('id,name,slug,banner_config,pricing_structure').eq('tenant_id',tenantId);
      query=filter.id ? query.eq('id',filter.id):query.eq('slug',filter.slug!);
      const {data,error}=await query.single();if(error)throw error;
      if(token!==request.current)return false;
      const next=data as unknown as Owner;setOwner(next);setList(next.banner_config?.visual_tooltips || []);setDraft(null);setSelected(null);return true;
    } catch(e){if(token===request.current)setError(e instanceof Error?e.message:'Kunne ikke hente produktet.');return false;}
    finally{if(token===request.current)setLoading(false);}
  },[tenantId]);
  useEffect(()=>{void loadOwner({id:productId});},[loadOwner,productId]);
  const materialDefaults=useMemo(()=>{
    const axis=owner.pricing_structure?.vertical_axis;
    const sections=[...(axis?.sectionType==='materials' ? [{id:axis.sectionId,...axis}] : []), ...(owner.pricing_structure?.layout_rows||[]).flatMap(row=>row.columns||[])];
    const seen=new Set<string>();
    return [...sections.flatMap(section=>{
      const group=groups.find(group=>group.id===section.groupId);
      if(group?.kind!=='material' && section.id!==axis?.sectionId)return [];
      return (section.valueIds||[]).flatMap(id=>{
        const value=group?.values?.find(value=>value.id===id && value.enabled!==false);
        if(!value)return [];
        return materialTooltipDefaults({name:section.valueSettings?.[id]?.displayName || value.name,sourceName:value.name,meta:value.meta},section.id,id).filter(config=>{if(seen.has(config.anchor))return false;seen.add(config.anchor);return true;});
      });
    }),...wideMaterialDefaults];
  },[owner,groups,wideMaterialDefaults]);
  const availableMaterialTooltips=materialDefaults.map(config=>list.find(item=>item.anchor===config.anchor)||config);
  const dirty=Boolean(draft && (draft.text.trim() || draft.imageUrl || draft.iconUrl) && tooltipDraftChanged(draft,list.find(item=>item.anchor===draft.anchor)||materialDefaults.find(item=>item.anchor===draft.anchor)));
  const dirtyRef=useRef(dirty);dirtyRef.current=dirty;
  useEffect(()=>{
    if(!dirty)return;
    const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};
    const exit=(e:Event)=>{if(!window.confirm('Du har ugemt tooltiptekst. Forlad redigeringen?'))e.preventDefault();};
    const leave=(e:MouseEvent)=>{const target=(e.target as Element).closest('a[href],[role=tab]');if(target&&!target.closest('.tooltip-real-workspace')&&!window.confirm('Du har ugemt tooltiptekst. Forlad redigeringen?')){e.preventDefault();e.stopPropagation();}};
    window.addEventListener('beforeunload',warn);window.addEventListener(ADMIN_WORKSPACE_EXIT_EVENT,exit);document.addEventListener('click',leave,true);
    return()=>{window.removeEventListener('beforeunload',warn);window.removeEventListener(ADMIN_WORKSPACE_EXIT_EVENT,exit);document.removeEventListener('click',leave,true);};
  },[dirty]);
  const anchors=useMemo<AnchorZone[]>(()=> (owner.pricing_structure?.layout_rows || []).flatMap(row=>(row.columns||[]).flatMap(section=>{
    if(section.ui_mode==='hidden')return [];
    const group=groups.find(group=>group.id===section.groupId);
    return (section.valueIds||[]).flatMap(id=>{const value=group?.values?.find(value=>value.id===id && value.enabled!==false);if(!value)return [];const label=`${section.labelOverride||section.title||group?.name||'Valg'}: ${section.valueSettings?.[id]?.displayName||value.name}`;return [{id:unavailableOptionAnchor(section.id,id),label,labelDa:label}];});
  })),[owner,groups]);
  const previewList=useMemo(()=>draft ? [...list.filter(item=>item.anchor!==draft.anchor),draft] : list,[list,draft]);
  const send=useCallback(()=>{
    frame.current?.contentWindow?.postMessage({type:'SET_EDIT_MODE',enabled:false},window.location.origin);
    frame.current?.contentWindow?.postMessage({type:TOOLTIP_PREVIEW_UPDATE,productId:owner.id,tooltips:previewList},window.location.origin);
  },[owner.id,previewList]);
  useEffect(()=>{send();},[send,loaded]);
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow)return;
      if(event.data?.type==='PREVIEW_READY')send();
      if(event.data?.type==='PREVIEW_NAVIGATION' && typeof event.data.path==='string'){
        const next=event.data.path;setPage(next);setSelected(previous=>previous?.target?.page===next?previous:null);setDraft(previous=>previous?.target?.page===next?previous:null);
        const match=next.match(/^\/produkt\/([^/?#]+)/);if(match && decodeURIComponent(match[1])!==owner.slug)void loadOwner({slug:decodeURIComponent(match[1])});
      }
    };
    window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive);
  },[send,owner.slug,loadOwner]);
  useEffect(()=>{
    const win=frame.current?.contentWindow;const doc=frame.current?.contentDocument;if(!win||!doc)return;
    let highlighted:HTMLElement|null=null;let outline='';
    const clear=()=>{if(highlighted)highlighted.style.outline=outline;highlighted=null;};
    const candidate=(el:Element)=>granularity==='section' ? el.closest('[data-site-design-target],[data-branding-id],section')||el : el;
    const move=(event:MouseEvent)=>{if(!placing)return;clear();const el=candidate(event.target as Element);const target=captureTooltipTarget(el,page);const found=target&&findTooltipTarget(doc,target);if(found){highlighted=found as HTMLElement;outline=highlighted.style.outline;highlighted.style.outline='2px solid #0ea5e9';}};
    const click=(event:MouseEvent)=>{
      const el=event.target as Element;if(el.closest('[data-tooltip-overlay]'))return;
      if(!placing){if(el.closest('a')&&dirtyRef.current&&!window.confirm('Du har ugemt tooltiptekst. Forlad den?')){event.preventDefault();event.stopImmediatePropagation();}return;}
      event.preventDefault();event.stopImmediatePropagation();
      const target=captureTooltipTarget(candidate(el),page);
      if(!target||!findTooltipTarget(doc,target)){setError('Vælg en entydig tekst, knap eller sektion. Dette element kan ikke genfindes sikkert.');return;}
      if(dirtyRef.current&&!window.confirm('Kassér den ugemte tooltiptekst og vælg et andet element?'))return;
      const finish=()=>{setError('');setSelected({anchor:`placed:${crypto.randomUUID()}`,target});setDraft(null);};
      if(target.productId&&target.productId!==owner.id)void loadOwner({id:target.productId}).then(ok=>{if(ok)finish()});else finish();
    };
    const submit=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();};
    win.addEventListener('mousemove',move);win.addEventListener('click',click,true);win.addEventListener('submit',submit,true);
    return()=>{clear();win.removeEventListener('mousemove',move);win.removeEventListener('click',click,true);win.removeEventListener('submit',submit,true);};
  },[loaded,placing,granularity,page,owner.id,loadOwner]);
  const saveList=async(next:TooltipConfig[])=>{
    try {
      if(owner.id===productId)await onTooltipsChange(next);else await saveProductTooltips(supabase,tenantId,owner.id,list,next);
      setList(next);setDraft(null);setSelected(null);await queryClient.invalidateQueries({queryKey:['storefront-placed-tooltips']});await queryClient.invalidateQueries({queryKey:['product-availability-tooltips',owner.id]});toast.success('Tooltips gemt');
    }catch(e){setError(e instanceof Error?e.message:'Kunne ikke gemme.');throw e;}
  };
  const navigate=(path:string)=>{if(dirty&&!window.confirm('Du har ugemt tooltiptekst. Forlad den?'))return;frame.current?.contentWindow?.postMessage({type:'NAVIGATE_TO',path},window.location.origin);};
  const params=new URLSearchParams({tenantId,page:`/produkt/${productSlug}`,tooltipEditor:'1',preview_mode:'1',editor:'site-design-v2'});
  const previewDraft=useCallback((next:TooltipConfig)=>setDraft(next),[]);
  return <div className="tooltip-real-workspace">
    <div className="flex flex-wrap items-center gap-3"><div><h2 className="text-lg font-semibold">Tooltips · {owner.name}</h2><p className="text-sm text-muted-foreground">Gå rundt i shoppen, vælg et element, og tilføj hjælp der følger elementet.</p></div><span className="ml-auto text-xs">{dirty?'Ugemt tooltip':`${list.length} gemte tooltips`}</span></div>
    {error&&<p role="alert" className="rounded border border-red-200 p-3 text-sm">{error}</p>}
    <div className="tooltip-real-columns">
      <aside className="tooltip-real-inspector">
        <TooltipEditor key={`${owner.id}:${selected?.anchor||''}`} selectedAnchor={selected?.anchor||null} target={selected?.target} existingTooltip={list.find(item=>item.anchor===selected?.anchor)||materialDefaults.find(item=>item.anchor===selected?.anchor)} canDelete={list.some(item=>item.anchor===selected?.anchor)} tenantId={tenantId} productId={owner.id} onPreview={previewDraft} onSave={tooltip=>saveList([...list.filter(item=>item.anchor!==tooltip.anchor),tooltip])} onDelete={anchor=>saveList(list.filter(item=>item.anchor!==anchor))} onCancel={()=>{setSelected(null);setDraft(null)}}/>
        <div className="space-y-2 border-t p-4"><h3 className="text-sm font-semibold">Materialer og papir</h3><p className="text-xs text-muted-foreground">Materialebeskrivelser vises automatisk som hjælp. Redigér tekst, ikon og Læs mere her. Egne certificeringslogoer skal være godkendt til brug i shoppen.</p>{availableMaterialTooltips.length===0 && <p className="text-xs text-muted-foreground">Ingen supplerende materialebeskrivelser på dette produkt.</p>}{availableMaterialTooltips.map(item=><button type="button" className="block w-full rounded border p-2 text-left text-sm" key={item.anchor} onClick={()=>{if(dirty&&!window.confirm('Kassér den ugemte tooltiptekst?'))return;setDraft(null);setSelected({anchor:item.anchor});}}>{item.title||item.anchor}<small className="block text-muted-foreground">{list.some(saved=>saved.anchor===item.anchor)?'Egen tooltip':'Fra materialebeskrivelsen'} · {item.text.slice(0,70)}</small></button>)}</div>
        <div className="space-y-2 border-t p-4"><h3 className="text-sm font-semibold">Gemte placeringer</h3>{list.filter(item=>!item.anchor.startsWith(UNAVAILABLE_OPTION_ANCHOR)&&!item.anchor.startsWith('material:')).map(item=><button className="block w-full rounded border p-2 text-left text-sm" key={item.anchor} onClick={()=>{if(dirty&&!window.confirm('Kassér den ugemte tooltiptekst?'))return;setDraft(null);setSelected({anchor:item.anchor,target:item.target});if(item.target?.page && item.target.page!==page)frame.current?.contentWindow?.postMessage({type:'NAVIGATE_TO',path:item.target.page},window.location.origin);}}>{item.target?.label || item.anchor}<small className="block text-muted-foreground">{item.text.slice(0,70)}</small></button>)}</div>
      </aside>
      <section className="pw-preview"><div className="pw-preview-toolbar"><Button variant={!placing?'default':'outline'} aria-pressed={!placing} onClick={()=>setPlacing(false)}>Gå rundt</Button><Button variant={placing?'default':'outline'} aria-pressed={placing} onClick={()=>setPlacing(true)} disabled={loading}>Placér tooltip</Button><select aria-label="Tooltipmål" value={granularity} onChange={e=>setGranularity(e.target.value)}><option value="element">Enkelt element</option><option value="section">Hel sektion</option></select><button type="button" onClick={()=>navigate('/')}>Forside</button><button type="button" onClick={()=>navigate(`/produkt/${productSlug}`)}>Dette produkt</button><button type="button" onClick={()=>setMobile(!mobile)}>{mobile?'Desktop':'Mobil'}</button></div><p className="px-3 py-2 text-xs text-muted-foreground">{page} · {placing?'Klik på teksten, knappen eller billedet':'Afprøv valg og følg butikkens links'}</p><div className={`pw-frame-shell ${mobile?'mobile':''}`}><iframe ref={frame} src={`/preview-shop?${params}`} title="Rigtig webshop til tooltipplacering" onLoad={()=>{setLoaded(value=>value+1);send()}}/></div></section>
    </div>
    <details className="rounded border p-4"><summary className="cursor-pointer font-medium">Hjælp til utilgængelige valg</summary><div className="pt-4"><AvailabilityTooltipEditor anchors={anchors} tooltips={list} onChange={next=>{void saveList(next).catch(()=>{})}}/></div></details>
  </div>;
}
