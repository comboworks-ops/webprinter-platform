import { Check } from 'lucide-react';
import { WIDE_FORMAT_DESIGNS, type WideFormatDesignId } from '@/lib/branding/wideFormatDesigns';
import { signalSettings } from '@/lib/branding/pvcbannerSettings';

/** Lightweight page miniatures use the same saved copy, palette and artwork as the shop. */
export function WideFormatDesignPicker({branding,onChange}: {branding:{themeSettings?:Record<string,unknown>};onChange:(id:WideFormatDesignId)=>void}) {
  const selected=signalSettings(branding).designId;
  return <section className="sd-design-picker" aria-label="Storformat design">
    <h4>Vælg dit design</h4><p>Fem shops med egne layouts. Dit indhold og dine ændringer gemmes, når du skifter.</p>
    <div>{WIDE_FORMAT_DESIGNS.map((design,index)=>{
      const b=signalSettings({...branding,themeSettings:{...branding.themeSettings,wideFormatDesign:design.id}});
      return <button type="button" key={design.id} aria-pressed={selected===design.id} onClick={()=>onChange(design.id)} className="sd-wide-design-card">
        <span className="sd-wide-mini" data-design={design.id} style={{background:b.background,color:b.ink}} aria-hidden="true">
          <span className="sd-wide-mini-nav" style={{background:b.headerBackground,color:b.headerTextColor}}>{b.brand}<i>Menu</i></span>
          <span className="sd-wide-mini-hero"><span style={{fontFamily:b.headingFont}}>{b.heroTitle}<b style={{background:b.buttonBackground}}/></span><img src={b.heroImage} alt="" loading="lazy"/></span>
          <span className="sd-wide-mini-products">{[0,1,2].map(n=><i key={n} style={{borderColor:b.primary}}/>)}</span>
        </span>
        <span><span className="flex items-center gap-1 font-semibold">{index===0?'Standard ·':`${index}.`} {design.name.replace('Standard · ','')}{selected===design.id&&<Check size={14}/>}</span><span className="block mt-1 text-muted-foreground">{design.description}</span></span>
      </button>;
    })}</div>
  </section>;
}
