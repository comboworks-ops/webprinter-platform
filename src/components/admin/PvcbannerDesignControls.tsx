import { wideFormatSectionOrder } from '@/lib/branding/wideFormatEditor';
import { WideFormatDesignPicker } from './WideFormatDesignPicker';
import { WideFormatLayoutPicker } from './WideFormatLayoutPicker';
import { wideFormatDesign } from '@/lib/branding/wideFormatDesigns';
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { signalSettings, withSignalSettings, SIGNAL_NUMBERS, SIGNAL_CHOICES, type SignalSettings } from '@/lib/branding/pvcbannerSettings';
import type { BrandingData } from '@/hooks/useBrandingDraft';

export const SIGNAL_SECTIONS = ['theme', 'logo', 'header', 'banner', 'showcase', 'main-buttons', 'content', 'usp-strip', 'footer', 'colors', 'typography', 'products'];
export const SIGNAL_SHARED_SECTIONS = ['theme','logo','header','main-buttons','footer','colors','typography'];
export const SIGNAL_SECTION_LABELS: Record<string,string> = { 'extra-content':'Indholdsblokke', 'signal-pages':'Indholdssider', theme:'Storformat · Shopdesign', banner:'Hero / hovedbanner', showcase:'Mellembanner', content:'Billede & fortælling', 'usp-strip':'Sådan fungerer det', 'main-buttons':'Knapper & links', products:'Produkter & katalog' };
type Field = [keyof SignalSettings, string];
type Group = [string, Field[]];
const groups: Record<string, Group[]> = {
  'text-sizes': [['Grundstørrelser', [['bodySize','Brødtekst (px)'],['headingSize','Sektionsoverskrifter (px)'],['lineHeight','Linjeafstand']]]],
  'button-links': [['Hero', [['heroButton','Primær knaptekst'],['heroLink','Primær destination'],['showSecondaryButton','Vis sekundær knap'],['secondaryButton','Sekundær knaptekst'],['secondaryLink','Sekundær destination']]],['Fortælling', [['storyButton','Knaptekst'],['storyLink','Destination']]]],
  'signal-pages': [
    ['Fælles for indholdssider', [['pageTitleSize','Sideoverskrift (px)']]],
    ['Kontakt', [['contactTitle','Overskrift'],['contactIntro','Introduktion']]],
    ['Om os', [['aboutTitle','Overskrift'],['aboutIntro','Introduktion']]],
    ['Grafisk vejledning', [['guideTitle','Overskrift (tom bruger eksisterende)'],['guideIntro','Introduktion (tom bruger eksisterende)']]],
  ],
  theme: [['Sidens ramme', [['contentWidth','Indholdsbredde (px)'],['sectionSpacing','Afstand mellem sektioner (px)'],['motion','Overgange']]]],
  logo: [['Logo', [['brand','Navn i logo'],['logo','Logobillede'],['logoSize','Logostørrelse (px)'],['brandSize','Navnets størrelse (px)']]]],
  header: [
    ['Navigation', [['menuBanners','Bannere – menutekst'],['menuSigns','Skilte – menutekst'],['menuDisplay','Messe – menutekst'],['menuPrint','Tryksager – menutekst']]],
    ['Dropdown-menu', [['dropdownStyle','Menutype'],['menuTrigger','Åbn menu med'],['dropdownBackground','Menuens baggrund'],['dropdownTextColor','Menuens tekstfarve']]],
    ['Størrelse & farver', [['menuSize','Menutekst (px)'],['headerHeight','Headerhøjde (px)'],['headerBackground','Headerens baggrund'],['headerTextColor','Headerens tekstfarve']]],
  ],
  banner: [
    ['Indhold', [['showHero','Vis hovedbanner'],['heroEyebrow','Overlinje'],['heroTitle','Overskrift'],['heroDescription','Beskrivelse']]],
    ['Billede & placering', [['heroImage','Bannerbillede'],['heroImageAlt','Billedbeskrivelse'],['heroLayout','Layout'],['heroHeight','Minimumshøjde på desktop (px)'],['heroImagePosition','Billedets vandrette fokus (%)']]],
    ['Typografi & farver', [['heroSize','Overskrift på desktop (px)'],['heroMobileSize','Overskrift på mobil (px)'],['heroTextSize','Beskrivelse (px)'],['heroBackground','Baggrund'],['heroTextColor','Tekstfarve']]],
  ],
  showcase: [
    ['Mellembanner under hero', [['showRibbon','Vis mellembanner'],['ribbonMode','Bannertype'],['ribbonHeight','Minimumshøjde (px)']]],
    ['Indhold & links', [['ribbonText1','Første tekst'],['ribbonLink1','Første link'],['ribbonText2','Anden tekst'],['ribbonLink2','Andet link'],['ribbonText3','Tredje tekst'],['ribbonLink3','Tredje link']]],
    ['Billede & udseende', [['ribbonImage','Bannerbillede'],['ribbonImageAlt','Billedbeskrivelse'],['ribbonBackground','Baggrund'],['ribbonColor','Tekstfarve'],['ribbonSize','Tekststørrelse (px)']]],
  ],
  'main-buttons': [
    ['Hero · primær knap', [['heroButton','Knaptekst'],['heroLink','Destination']]],
    ['Hero · sekundær knap', [['showSecondaryButton','Vis sekundær knap'],['secondaryButton','Knaptekst'],['secondaryLink','Destination']]],
    ['Fortælling · knap', [['storyButton','Knaptekst'],['storyLink','Destination']]],
    ['Fælles knapdesign', [['buttonStyle','Stil'],['buttonBackground','Knapfarve'],['buttonTextColor','Tekstfarve'],['buttonSize','Tekststørrelse (px)'],['buttonRadius','Afrundede hjørner (px)'],['buttonPadding','Vandret luft (px)']]],
  ],
  content: [
    ['Indhold', [['showStory','Vis fortælling'],['storyEyebrow','Overlinje'],['storyTitle','Overskrift'],['storyText','Tekst']]],
    ['Billede & layout', [['storyImage','Billede'],['storyImageAlt','Billedbeskrivelse'],['storyLayout','Placering']]],
    ['Typografi & farver', [['storySize','Overskrift (px)'],['storyTextSize','Brødtekst (px)'],['storyBackground','Baggrund'],['storyTextColor','Tekstfarve']]],
  ],
  'usp-strip': [
    ['Sådan fungerer det', [['showSteps','Vis sektionen'],['stepsTitle','Overskrift'],['step1Title','Trin 1 – titel'],['step1Text','Trin 1 – tekst'],['step2Title','Trin 2 – titel'],['step2Text','Trin 2 – tekst'],['step3Title','Trin 3 – titel'],['step3Text','Trin 3 – tekst']]],
    ['Farver', [['stepsBackground','Baggrund'],['stepsTextColor','Tekstfarve']]],
  ],
  footer: [['Indhold', [['footerText','Beskrivelse'],['footerNote','Afsender'],['footerSlogan','Bundtekst']]],['Udseende', [['footerBackground','Baggrund'],['footerTextColor','Tekstfarve'],['footerSize','Tekststørrelse (px)']]]],
  colors: [['Grundfarver', [['primary','Primær farve'],['accent','Accentfarve'],['ink','Tekstfarve'],['background','Sidebaggrund']]]],
  typography: [['Skrifter', [['headingFont','Overskrifter'],['bodyFont','Brødtekst']]],['Grundstørrelser', [['bodySize','Brødtekst (px)'],['headingSize','Sektionsoverskrifter (px)'],['lineHeight','Linjeafstand']]]],
  products: [
    ['Forsidens produkter', [['showProducts','Vis produkter på forsiden'],['featuredTitle','Sektionsoverskrift']]],
    ['Produktoversigt', [['catalogueEyebrow','Overlinje'],['catalogueTitle','Overskrift'],['catalogueDescription','Beskrivelse'],['catalogueSize','Overskrift (px)']]],
    ['Produktkort', [['productColumns','Kolonner på desktop'],['productTitleSize','Produktnavn (px)'],['productImageRatio','Billedformat']]],
  ],
};
export function PvcbannerDesignControls({branding, section, onChange, onUpload}: {branding: BrandingData; section: string; onChange: (draft: Partial<BrandingData>) => void; onUpload: (file: File, type: 'logo' | 'hero-image') => Promise<string | null>}) {
  const [uploading,setUploading] = useState(false);
  const latest = useRef(branding); latest.current = branding;
  const values = signalSettings(branding);
  const raw = (values.designId === 'signal' ? branding.themeSettings?.pvcbannerSignal : (branding.themeSettings?.wideFormatOverrides as Record<string, Partial<SignalSettings>> | undefined)?.[values.designId]) as Partial<SignalSettings> | undefined;
  const update = (key: keyof SignalSettings, value: string | boolean | number) => onChange({themeSettings: withSignalSettings(latest.current, {[key]:value}).themeSettings});
  return <div className="space-y-4 p-3">
    {section !== 'theme' && <div className="rounded-lg border bg-muted/30 p-3"><p className="text-sm font-medium">Storformat · {wideFormatDesign(values.designId).name}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{section === 'theme' ? 'Standardopsætning til storformat. Alle sektioner bruger kladde, fortryd og publicering fra Site Design. Vælg en sektion eller klik i previewet.' : 'Ændringer vises straks i previewet. Gem kladden øverst, når du er klar.'}</p></div>}
    {section === 'theme' && <WideFormatDesignPicker branding={branding} onChange={id=>onChange({themeSettings:{...latest.current.themeSettings,wideFormatDesign:id}})}/>}
    {section === 'theme' && <fieldset className="space-y-2 rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">Sektionernes rækkefølge</legend>{wideFormatSectionOrder(branding).map((id,index,order) => {
      const label = {hero:'Hovedbanner',banner2:'Mellembanner',products:'Produkter',content:'Fortælling',usp:'Fordele / trin',seo:'Ekstra indhold'}[id];
      const move = (offset: number) => { const next=[...order]; [next[index],next[index+offset]]=[next[index+offset],next[index]]; onChange({forside:{...branding.forside,layout:{...branding.forside.layout,sectionOrder:next}}}); };
      return <div key={id} className="flex items-center gap-2 text-sm"><span className="flex-1">{label}</span><button type="button" className="min-h-11 min-w-11 rounded border disabled:opacity-30" aria-label={`Flyt ${label} op`} disabled={index===0} onClick={()=>move(-1)}>↑</button><button type="button" className="min-h-11 min-w-11 rounded border disabled:opacity-30" aria-label={`Flyt ${label} ned`} disabled={index===order.length-1} onClick={()=>move(1)}>↓</button></div>;
    })}</fieldset>}
    {section === 'signal-pages' && <WideFormatLayoutPicker branding={branding} field="contactLayout" onChange={patch=>onChange({themeSettings:withSignalSettings(latest.current,patch).themeSettings})}/>}
    {(section === 'banner' || section === 'content') && <p className="text-xs text-muted-foreground">Klik på en knap i redigeringstilstand for at ændre dens tekst, destination og udseende.</p>}
    {(groups[section] || []).map(([title,fields]) => <fieldset key={title} className="space-y-4 rounded-lg border p-3"><legend className="px-1 text-sm font-semibold">{title}</legend>{fields.map(([key,label]) => {
      const id = `signal-${key}`, bounds = SIGNAL_NUMBERS[key], choices = SIGNAL_CHOICES[key];
      const color = /Color$|Background$|^primary$|^accent$|^ink$|^background$/.test(key);
      const media = /Image$|^logo$/.test(key);
      return <div key={key} className="space-y-2">
        {typeof values[key] === 'boolean' ? <div className="flex items-center justify-between gap-3"><Label htmlFor={id}>{label}</Label><Switch id={id} checked={Boolean(values[key])} onCheckedChange={value=>update(key,value)}/></div> : <>
          <Label htmlFor={id}>{label}</Label>
          {choices ? <select id={id} className="min-h-10 w-full rounded-md border bg-background p-2 text-sm" value={String(values[key])} onChange={event=>update(key,event.target.value)}>{choices.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
          : bounds ? <Input id={id} type="number" min={bounds[0]} max={bounds[1]} step={bounds[2] || 1} value={Number(values[key])} onChange={event=>{if(event.target.value !== '') update(key,Number(event.target.value));}}/>
          : color ? <div className="flex items-center gap-2"><span className="h-9 w-9 shrink-0 rounded border" style={{background:String(values[key])}}/><Input id={id} maxLength={7} placeholder="#1748ff" value={String(raw?.[key] ?? values[key])} onChange={event=>update(key,event.target.value)}/></div>
          : /Title|Text$|Description|Intro$/.test(key) ? <Textarea id={id} value={String(values[key])} onChange={event=>update(key,event.target.value)}/>
          : <Input id={id} value={String(values[key])} onChange={event=>update(key,event.target.value)}/>}
          {/Link\d*$/.test(key) && <p className="text-xs text-muted-foreground">En side i shoppen, f.eks. /produkter eller /produkt/pvc-banner.</p>}
          {media && <><img className="max-h-32 w-full rounded border object-contain" src={String(values[key])} alt="Valgt billede"/><Label htmlFor={`signal-upload-${key}`} className="block text-xs">Vælg et nyt billede</Label><Input id={`signal-upload-${key}`} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={uploading} onChange={async event => {
            const file=event.target.files?.[0]; if (!file) return; setUploading(true);
            try { const url=await onUpload(file,key === 'logo' ? 'logo' : 'hero-image'); if(url) update(key,url); }
            catch { toast.error('Billedet kunne ikke uploades. Prøv igen.'); }
            finally {setUploading(false);}
          }}/>{uploading && <p role="status">Uploader billede…</p>}</>}
        </>}
      </div>;
    })}</fieldset>)}
  </div>;
}
