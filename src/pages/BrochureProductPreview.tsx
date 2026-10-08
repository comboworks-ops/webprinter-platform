import { EditableNumberInput } from "@/components/ui/editable-number-input";
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Download, BookOpen } from 'lucide-react';
import { rectangleShape, wideFormatTemplateUrl } from '@/lib/designer/wideFormatGeometry';
import { generateWideFormatTemplate } from '@/lib/designer/generateWideFormatTemplate';
import { ProductFormatGuideDialog } from '@/components/product-price-page/ProductFormatGuide';
import '@/styles/brochureProduct.css';

interface Format {key:string;orientation:string;widthMm:number;heightMm:number;label:string;pages:Array<{pageCount:number;articleId:string}>;template:{templateUrl:string;templatePdfSha256:string;bleedMm:number;safeMm:number}|null}
interface Catalog {name:string;descriptionDa:string;formats:Format[];freeSize:{minWidthMm:number;maxWidthMm:number;minHeightMm:number;maxHeightMm:number}}
interface PriceVariant {cover:string;varnish:string;prices:Array<[number,number,number,string]>}
interface Article {articleId:string;pageCount:number;quantities:number[];rows:Array<{id:string;labelDa:string;variants:PriceVariant[]}>;priceComplete:boolean}
const money = new Intl.NumberFormat('da-DK',{maximumFractionDigits:0});

/** Concrete local draft preview. The approved import uses the existing matrix
 * publisher; this route is development-only and cannot accept an order. */
export default function BrochureProductPreview() {
 const navigate=useNavigate();
 const [routeParams]=useSearchParams();
 const initialOrientation=['portrait','landscape','square','free'].includes(routeParams.get('orientation')||'')?routeParams.get('orientation')!:'portrait';
 const [catalog,setCatalog]=useState<Catalog|null>(null),[article,setArticle]=useState<Article|null>(null);
 const [orientation,setOrientation]=useState(initialOrientation),[formatKey,setFormatKey]=useState(routeParams.get('format')||'210x297'),[pageCount,setPageCount]=useState(Number(routeParams.get('pages'))||8);
 const [cover,setCover]=useState(routeParams.get('cover')||'matte'),[varnish,setVarnish]=useState(routeParams.get('varnish')||'none'),[visibleRows,setVisibleRows]=useState(12);
 const [width,setWidth]=useState(Number(routeParams.get('width'))||148),[height,setHeight]=useState(Number(routeParams.get('height'))||210),[query,setQuery]=useState(''),[error,setError]=useState('');
 const [selection,setSelection]=useState<{row:string;quantity:number;price:number}|null>(null);
 const restoreChoice=useRef(Boolean(routeParams.get('paper')&&routeParams.get('quantity')));
 const restoreQuoteRequested=useRef(false);
 const [freeQuotes,setFreeQuotes]=useState<Record<string,PriceVariant['prices']>>({}),[quoteBusy,setQuoteBusy]=useState<string|null>(null),[designerBusy,setDesignerBusy]=useState(false);
 const quoteGeneration=useRef(0);
 const formats=catalog?.formats.filter(f=>f.orientation===orientation)||[];
 const format=catalog?.formats.find(f=>f.key===formatKey);
 const source=format?.pages.find(p=>p.pageCount===pageCount);
 useEffect(()=>{let active=true;fetch('/brochure/catalog.json').then(r=>{if(!r.ok)throw Error('Produktkladden kunne ikke hentes.');return r.json();}).then(data=>{if(active)setCatalog(data);}).catch(e=>setError(e.message));return()=>{active=false;};},[]);
 useEffect(()=>{if(!catalog)return;const selected=catalog.formats.find(f=>f.key===formatKey&&f.orientation===orientation)||catalog.formats.find(f=>f.orientation===orientation);if(!selected)return;if(selected.key!==formatKey)setFormatKey(selected.key);if(!selected.pages.some(p=>p.pageCount===pageCount))setPageCount(selected.pages[0].pageCount);},[catalog,formatKey,orientation,pageCount]);
 useEffect(()=>{
  if(!source)return;let active=true;setArticle(null);setSelection(null);setVisibleRows(12);
  fetch(`/brochure/articles/${source.articleId}.json`).then(r=>{if(!r.ok)throw Error('Formatets papirtyper kunne ikke hentes.');return r.json();}).then(data=>{if(active)setArticle(data);}).catch(e=>{if(active)setError(e.message);});
  return()=>{active=false;};
 },[source]);
 const changeOrientation=(value:string)=>{const first=catalog?.formats.find(f=>f.orientation===value);if(!first)return;setOrientation(value);setFormatKey(first.key);setPageCount(first.pages.some(p=>p.pageCount===pageCount)?pageCount:first.pages[0].pageCount);};
 const changeFormat=(value:string)=>{const next=catalog?.formats.find(f=>f.key===value);if(!next)return;setFormatKey(value);if(!next.pages.some(p=>p.pageCount===pageCount))setPageCount(next.pages[0].pageCount);};
 const free=orientation==='free';
 useEffect(()=>{
  if(!article||!source||!restoreChoice.current)return;
  const scope=`${source.articleId}:${free?width:format?.widthMm}x${free?height:format?.heightMm}`;
  if(routeParams.get('draftScope')!==scope){restoreChoice.current=false;return;}
  const row=article.rows.find(value=>value.id===routeParams.get('paper'));
  if(!row){restoreChoice.current=false;return;}
  const prices=free?freeQuotes[row.id]:row.variants.find(value=>value.cover===cover&&value.varnish===varnish)?.prices;
  if(free&&!prices)return;
  restoreChoice.current=false;
  const quantity=Number(routeParams.get('quantity'));
  const price=prices?.find(value=>value[0]===quantity)?.[1];
  // Restore only a current, source-backed cell. Never accept a price in the URL.
  if(row&&price)setSelection({row:row.id,quantity,price});
 },[article,source,format,cover,varnish,free,routeParams,width,height,freeQuotes]);
 useEffect(()=>{quoteGeneration.current++;setFreeQuotes({});setQuoteBusy(null);setSelection(null);},[width,height,source?.articleId]);
 const validSize=!free||(Boolean(catalog)&&width>=catalog!.freeSize.minWidthMm&&width<=catalog!.freeSize.maxWidthMm&&height>=catalog!.freeSize.minHeightMm&&height<=catalog!.freeSize.maxHeightMm&&[width,height].every(value=>Math.abs(value*10-Math.round(value*10))<.000001));
 const freeTemplateUrl=validSize&&free?wideFormatTemplateUrl(rectangleShape,width,height):null;
 const openDesigner=async()=>{
  if(!format||!validSize)return;
  setDesignerBusy(true);setError('');
  try {
  const params=new URLSearchParams({brochurePages:String(pageCount),widthMm:String(free?width:format.widthMm),heightMm:String(free?height:format.heightMm),bleedMm:'3'});
  const scope=`${source?.articleId}:${free?width:format.widthMm}x${free?height:format.heightMm}`;
  const existingDraftId=routeParams.get('draftId');
  const localDraftId=routeParams.get('draftScope')===scope&&existingDraftId&&/^[a-f0-9-]{36}$/i.test(existingDraftId)?existingDraftId:crypto.randomUUID();
  params.set('draftId',localDraftId);
  const back=new URLSearchParams({orientation,format:formatKey,pages:String(pageCount),cover,varnish,width:String(width),height:String(height),draftId:localDraftId,draftScope:scope});
  if(selection){back.set('paper',selection.row);back.set('quantity',String(selection.quantity));}
  params.set('returnTo',`/brochure-preview?${back}`);
  if(format.template){params.set('templatePdfUrl',format.template.templateUrl);params.set('templatePdfSha256',format.template.templatePdfSha256);params.set('templatePdfName',`Brochure ${format.label}`);}
  if(freeTemplateUrl){const bytes=await generateWideFormatTemplate(freeTemplateUrl);const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.slice().buffer))).map(n=>n.toString(16).padStart(2,'0')).join('');params.set('templatePdfUrl',freeTemplateUrl);params.set('templatePdfSha256',hash);params.set('templatePdfName',`Brochure ${width} × ${height} mm`);}
  navigate(`/designer?${params}`);
  }catch(failure){setError((failure as Error).message);}finally{setDesignerBusy(false);}
 };
 const fetchFreePrices=async(rowId:string)=>{
  if(!source||!validSize||quoteBusy)return;
  const generation=quoteGeneration.current;setQuoteBusy(rowId);setError('');
  try {const params=new URLSearchParams({articleId:source.articleId,substrateId:rowId,widthMm:String(width),heightMm:String(height)});const response=await fetch(`/api/brochure-quote?${params}`);const data=await response.json();if(!response.ok)throw Error(data.error||'Prisen kunne ikke hentes.');if(generation!==quoteGeneration.current)return;
   if(data.articleId!==source.articleId||data.substrateId!==rowId||data.widthMm!==width||data.heightMm!==height||data.pageCount!==pageCount)throw Error('Prisen matcher ikke brochuren.');
   setFreeQuotes(old=>({...old,[rowId]:data.prices}));
  }catch(failure){if(generation===quoteGeneration.current)setError((failure as Error).message);}finally{if(generation===quoteGeneration.current)setQuoteBusy(null);}
 };
 useEffect(()=>{
  if(!free||!article||!source||!validSize||!restoreChoice.current||restoreQuoteRequested.current)return;
  const row=article.rows.find(value=>value.id===routeParams.get('paper'));
  if(!row||routeParams.get('draftScope')!==`${source.articleId}:${width}x${height}`)return;
  restoreQuoteRequested.current=true;
  void fetchFreePrices(row.id);
  // Re-quote once for the exact restored dimensions, rather than retaining an
  // old client price. Generation guards discard responses after a size edit.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[article,source,free,validSize,width,height,routeParams]);
 const quantities=free?[...new Set(Object.values(freeQuotes).flatMap(prices=>prices.map(p=>p[0])))].sort((a,b)=>a-b):article?.quantities||[];
 const rows=article?.rows.filter(r=>(free||r.variants.some(v=>v.cover===cover&&v.varnish===varnish))&&r.labelDa.toLocaleLowerCase('da').includes(query.toLocaleLowerCase('da')))||[];
 return <div className="brochure-product">
  <header className="brochure-product-top"><Link to="/">Webprinter</Link><span>Produktkladde · lokal forhåndsvisning</span><Link to="/brochure-shop-preview?tenantId=00000000-0000-0000-0000-000000000000">Vis i shoppen</Link></header>
  <main className="brochure-product-main">
   <div className="brochure-product-intro"><div><span className="brochure-eyebrow">Magasiner · programmer · kataloger</span><h1>{catalog?.name||'Brochurer med trådhæftning'}</h1><p>{catalog?.descriptionDa||'Vælg format og papir, og saml alle sider i sidedesigneren.'}</p></div><BookOpen size={80} strokeWidth={1}/></div>
   {error&&<p role="alert">{error}</p>}
   <section className="brochure-product-controls" aria-label="Brochurens egenskaber">
    <fieldset><legend>Retning</legend><div className="brochure-choice-row">{[['portrait','Lodret'],['landscape','Vandret'],['square','Kvadratisk'],['free','Fri størrelse']].map(([key,label])=><Button key={key} variant={orientation===key?'default':'outline'} aria-pressed={orientation===key} onClick={()=>changeOrientation(key)}>{label}</Button>)}</div></fieldset>
    <fieldset><legend>Format</legend>{free?<><div className="brochure-size-inputs"><label>Bredde, mm<EditableNumberInput type="number" min={98} max={297} step={0.1} value={width} onChange={e=>setWidth(Number(e.target.value))}/></label><span>×</span><label>Højde, mm<EditableNumberInput type="number" min={98} max={297} step={0.1} value={height} onChange={e=>setHeight(Number(e.target.value))}/></label></div><p>Fra 98 til 297 mm i begge retninger. Prisen hentes for de præcise mål.</p>{!validSize&&<p role="alert">Begge mål skal være 98–297 mm i trin på 0,1 mm.</p>}</>:<div className="brochure-choice-row">{formats.map(f=><Button key={f.key} variant={f.key===formatKey?'default':'outline'} aria-pressed={f.key===formatKey} onClick={()=>changeFormat(f.key)}>{f.label}</Button>)}</div>}</fieldset>
    <fieldset><legend>Sider inklusive omslag</legend><select aria-label="Sidetal inklusive omslag" value={pageCount} onChange={e=>setPageCount(Number(e.target.value))}>{format?.pages.map(p=><option key={p.pageCount} value={p.pageCount}>{p.pageCount} sider</option>)}</select><p>Forside er side 1. Bagside er sidste side. Sidetallet går op i fire.</p></fieldset>
    {!free&&<fieldset><legend>Omslagets papirtype</legend><div className="brochure-choice-row">{[['matte','Mat'],['gloss','Blank'],['recycled','Genbrug'],['natural','Naturpapir'],['default','Fast specialomslag']].map(([key,label])=><Button key={key} variant={cover===key?'default':'outline'} aria-pressed={cover===key} onClick={()=>{setCover(key);setSelection(null);}}>{label}</Button>)}</div><p>Omslagets gramvægt vælges sammen med indholdspapiret i tabellen.</p></fieldset>}
    {!free&&<fieldset><legend>Dispersionslak på omslag</legend><div className="brochure-choice-row">{[['none','Uden ekstra lak'],['dispersion_matte','Mat dispersionslak']].map(([key,label])=><Button key={key} variant={varnish===key?'default':'outline'} aria-pressed={varnish===key} onClick={()=>{setVarnish(key);setSelection(null);}}>{label}</Button>)}</div></fieldset>}
   </section>
   <section className="brochure-matrix-section" aria-label="Papir, omslag og antal"><div className="brochure-matrix-heading"><div><h2>Papir, omslag og antal</h2><p>Samlet pris i kroner ekskl. moms.</p></div><label>Søg papir<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Fx 135 g eller naturpapir"/></label></div>
    {free&&<p>Omslag og papirtype står i tabellen. Hent priser for de præcise mål; denne variant har ingen separat dispersionslak.</p>}{!article?<p role="status">Henter papirtyper…</p>:<>{rows.length===0&&<p>{query?'Ingen papirtyper matcher søgningen.':'Ingen papirkombinationer passer til de valgte omslagsvalg. Vælg en anden papirtype eller lak.'}</p>}<div className="brochure-matrix-scroll"><table><thead><tr><th scope="col">Indhold og omslag</th>{quantities.map(q=><th key={q} scope="col">{money.format(q)} stk.</th>)}</tr></thead><tbody>{rows.slice(0,visibleRows).map(row=>{const variant=row.variants.find(v=>v.cover===cover&&v.varnish===varnish);const prices=free?freeQuotes[row.id]:variant?.prices;return<tr key={row.id}><th scope="row">{row.labelDa.split('||').map((part,i)=><span key={i}>{part.trim()}</span>)}{free&&<Button variant="outline" disabled={!validSize||Boolean(quoteBusy)} onClick={()=>void fetchFreePrices(row.id)}>{quoteBusy===row.id?'Henter priser…':freeQuotes[row.id]?'Opdatér priser':'Hent priser'}</Button>}</th>{quantities.map(q=>{const price=prices?.find(p=>p[0]===q)?.[1];return<td key={q}><button disabled={!price} aria-pressed={selection?.row===row.id&&selection.quantity===q} aria-label={`${row.labelDa}, ${q} stk.${price?`, ${price} kroner`:', ikke tilgængelig'}`} onClick={()=>price&&setSelection({row:row.id,quantity:q,price})}>{price?`${money.format(price)} kr.`:'—'}</button></td>;})}</tr>;})}</tbody></table></div>{!free&&!article.priceComplete&&<p className="brochure-draft-note">Prisindsamlingen er i gang. Kun kontrollerede kombinationer har en pris.</p>}{rows.length>visibleRows&&<Button variant="outline" onClick={()=>setVisibleRows(n=>n+20)}>Vis flere papirtyper ({rows.length-visibleRows})</Button>}</>}
   </section>
   <section className="brochure-artwork"><div><h2>Én PDF, alle sider på plads</h2><p>Upload hele brochuren, eller design side for side. Forbind 2–3, 4–5 osv. for et design hen over midten.</p>{selection&&<strong>{money.format(selection.quantity)} stk. · {money.format(selection.price)} kr. ekskl. moms</strong>}</div><div className="brochure-artwork-actions">{format&&validSize&&<ProductFormatGuideDialog data={{productName:catalog?.name||'Brochure',formatLabel:free?`${width} × ${height} mm`:format.label,finishedWidthMm:free?width:format.widthMm,finishedHeightMm:free?height:format.heightMm,bleedMm:3,safeAreaMm:3,minDpi:300,layoutKind:'brochure',brochurePageCount:pageCount,template:freeTemplateUrl?{name:'Brochure-sideskabelon.pdf',url:freeTemplateUrl}:format.template?{name:'Brochure-sideskabelon.pdf',url:format.template.templateUrl}:null}}/>}{freeTemplateUrl&&<a href={freeTemplateUrl} download><Download size={16}/>Download sideskabelon</a>}{format?.template&&<a href={format.template.templateUrl} download><Download size={16}/>Download sideskabelon</a>}<Button disabled={!validSize||!format||designerBusy} onClick={()=>void openDesigner()}>Åbn sidedesigner</Button></div></section>
  </main>
 </div>;
}
