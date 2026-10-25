import type { BrandingData } from '@/hooks/useBrandingDraft';
import { wideFormatDesign } from './wideFormatDesigns';

export type WideElement = { id: string; section: string; label: string; selector: string; container?: boolean };
const elements: WideElement[] = [];
function section(section: string, selector: string, children: Array<[string, string, string]>) {
  elements.push({ id: section, section, label: 'Hele sektionen', selector, container: true });
  children.forEach(([id, label, child]) => elements.push({ id: `${section}.${id}`, section, label, selector: `${selector} ${child}` }));
}
section('header', '.pvc-native-shell .site-header', [['navigation','Navigation','.responsive-header-navigation button'],['actions','Søg, konto og sprog','.responsive-header-actions'],['menu','Dropdown-menu','.mega-menu']]);
section('logo', '.pvc-native-shell .brand', [['name','Logonavn','strong'],['byline','Afsender','small']]);
section('banner', '.wide-format-home .hero', [['eyebrow','Overlinje','.eyebrow'],['title','Overskrift','h1'],['description','Beskrivelse','.hero-description'],['image','Billede','.hero-art img']]);
section('showcase', '.wide-format-home .category-ribbon', [1,2,3].map(n => [`link${n}`,`Link ${n}`,`a:nth-of-type(${n})`]));
section('products', '.wide-format-home .featured', [['title','Sektionsoverskrift',':scope > h2']]);
// Catalogue and card styling also applies when a product is repeated on the homepage.
elements.push({id:'products.catalogue',section:'products',label:'Produktoversigt',selector:'.wide-format-home .catalogue',container:true});
for (const [id,label,selector] of [['heading','Katalogoverskrift','.catalogue-title h1'],['intro','Katalogintroduktion','.catalogue-title p'],['filters','Kategoriknapper','.filter-tabs button'],['card','Produktkort','.product-card'],['name','Produktnavne','.product-copy h3'],['description','Produktbeskrivelser','.product-copy p'],['image','Produktbilleder','.product-image'],['action','Vælg produkt','.product-configure']]) elements.push({id:`products.${id}`,section:'products',label,selector:`.wide-format-home ${selector}`});
section('content', '.wide-format-home .wide-story', [['eyebrow','Overlinje','.eyebrow'],['title','Overskrift','h2'],['text','Brødtekst','.story-copy > p:not(.eyebrow)'],['image','Billede','.story-image img']]);
section('usp-strip', '.wide-format-home .steps-strip', [['title','Overskrift','h2'],...[1,2,3].flatMap(n => [[`number${n}`,`Trin ${n} – nummer`,`article:nth-child(${n}) > span`],[`title${n}`,`Trin ${n} – titel`,`article:nth-child(${n}) h3`],[`text${n}`,`Trin ${n} – tekst`,`article:nth-child(${n}) p`]] as Array<[string,string,string]>)]);
section('footer', '.pvc-native-shell .footer', [['description','Beskrivelse',':scope > div:first-child > p'],['headings','Kolonneoverskrifter','h3'],['links','Links','a:not(.brand)'],['note','Afsender','.footer-note'],['bottom','Bundlinje','.footer-bottom']]);
elements.push({id:'header.bar',section:'header',label:'Toplinje',selector:'.pvc-native-shell .preview-bar'});
for (const [id,label,selector] of [['primary','Hero · primær knap','.hero-actions .button:not(.secondary)'],['secondary','Hero · sekundær knap','.hero-actions .button.secondary'],['story','Fortælling · knap','.story-copy .button']]) elements.push({id:`main-buttons.${id}`,section:'main-buttons',label,selector:`.wide-format-home ${selector}`});
export const WIDE_ELEMENTS = elements;
export const wideElement = (id?: string | null) => WIDE_ELEMENTS.find(item => item.id === id);

export type WideElementStyle = { color?: string; backgroundColor?: string; fontFamily?: string; fontSize?: number; mobileFontSize?: number; fontWeight?: string; lineHeight?: number; letterSpacing?: number; textAlign?: string; borderRadius?: number; paddingBlock?: number };
const bounds = {fontSize:[10,160],mobileFontSize:[10,100],lineHeight:[0.9,2.5],letterSpacing:[-3,12],borderRadius:[0,80],paddingBlock:[0,160]};
export function cleanWideElementStyle(value: unknown): WideElementStyle {
  const result: Record<string, string | number> = {};
  if (!value || typeof value !== 'object') return result;
  for (const [key,v] of Object.entries(value)) {
    if (key in bounds && typeof v === 'number' && Number.isFinite(v)) result[key] = Math.max(bounds[key][0],Math.min(bounds[key][1],v));
    if (['color','backgroundColor'].includes(key) && typeof v === 'string' && /^#[\da-f]{6}$/i.test(v)) result[key]=v;
    if (key === 'fontFamily' && typeof v === 'string' && /^[a-z][a-z0-9 .-]{0,79}$/i.test(v)) result[key]=v;
    if (key === 'fontWeight' && typeof v === 'string' && /^(400|500|600|700|800|900)$/.test(v)) result[key]=v;
    if (key === 'textAlign' && typeof v === 'string' && /^(left|center|right)$/.test(v)) result[key]=v;
  }
  return result;
}
export function wideElementStyles(branding: Pick<BrandingData,'themeSettings'>): Record<string, WideElementStyle> {
  const bank = branding.themeSettings?.wideFormatElementStyles as Record<string,Record<string,unknown>> | undefined;
  const values=bank?.[wideFormatDesign(branding.themeSettings?.wideFormatDesign).id] || {};
  return Object.fromEntries(WIDE_ELEMENTS.filter(item=>values[item.id]).map(item=>[item.id,cleanWideElementStyle(values[item.id])]));
}
export function withWideElementStyle(branding: BrandingData, id: string, patch: WideElementStyle | null): Partial<BrandingData> {
  if (!wideElement(id)) return {};
  const design=wideFormatDesign(branding.themeSettings?.wideFormatDesign).id;
  const bank=branding.themeSettings?.wideFormatElementStyles as Record<string,Record<string,unknown>> || {};
  // Null is an explicit reset, retained by the draft's deep merge.
  const next=patch === null ? null : cleanWideElementStyle({...wideElementStyles(branding)[id],...patch});
  return {themeSettings:{...branding.themeSettings,wideFormatElementStyles:{...bank,[design]:{...bank[design],[id]:next}}}};
}
const selectorFor = (item: WideElement, prefix: string) => `${prefix} ${item.selector.replace(/:scope > /g, '> ')}`;
const font = (name: string) => name === 'Anton' ? 'PvcAnton, Anton, sans-serif' : name === 'Inter' ? 'PvcInter, Inter, sans-serif' : `"${name}"`;
export function wideElementCss(branding: Pick<BrandingData,'themeSettings'>): string {
  const saved=wideElementStyles(branding), prefix=`.pvc-native[data-wide-format="${wideFormatDesign(branding.themeSettings?.wideFormatDesign).id}"]`;
  // Section defaults first; exact element overrides win even inside a styled section.
  return [...WIDE_ELEMENTS].sort((a,b)=>Number(Boolean(b.container))-Number(Boolean(a.container))).map(item=>{
    const style=saved[item.id]; if (!style) return '';
    const selector=selectorFor(item,prefix);
    const declarations=(keys:string[])=>Object.entries(style).filter(([key])=>keys.includes(key)).map(([key,value])=>`${key.replace(/[A-Z]/g,m=>`-${m.toLowerCase()}`)}:${key==='fontFamily'?font(String(value)):value}${typeof value==='number' && key!=='lineHeight'?'px':''}!important`).join(';');
    const typeKeys=['color','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textAlign'];
    const typography=declarations(typeKeys), box=declarations(['backgroundColor','borderRadius','paddingBlock']);
    const targets=item.container?`${selector},${selector} :where(h1,h2,h3,p,a,button,span,strong,small)` : selector;
    return `${box?`${selector}{${box}}`:''}${typography?`${targets}{${typography}}`:''}${style.mobileFontSize?`@media(max-width:640px){${targets}{font-size:${style.mobileFontSize}px!important}}`:''}`;
  }).join('\n');
}
/** Resolve the deepest authored target. Shared components keep their existing inspectors. */
export function resolveWideElementSelection(target: Element | null): {element: Element; id: string} | null {
  if (!target?.closest('.pvc-native')) return null;
  let match: {element:Element;id:string} | null=null;
  for (const item of WIDE_ELEMENTS) {
    const element=target.closest(item.selector.replace(/:scope > /g, '> '));
    if (element && (!match || match.element.contains(element))) match={element,id:item.id};
  }
  return match;
}
