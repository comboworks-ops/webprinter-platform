import { SharedButtonsControls } from './SharedButtonsControls';
import type { ReactNode } from 'react';
import type { BrandingData, HeroSettings } from '@/hooks/useBrandingDraft';
import { getPrintDesignPreset } from '@/lib/branding/printDesignPresets';
import { resolvePrintHero } from '@/lib/branding/siteDesignControls';
import { SiteDesignHeroCopy } from './SiteDesignHeroCopy';

type Props = { draft: BrandingData; updateDraft: (patch: Partial<BrandingData>) => void; designDefaults?: BrandingData };
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="sd-control-field"><span>{label}</span>{children}</label>;
}
function Color({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Field label={label}><span className="sd-color-field"><input type="color" aria-label={label} value={/^#[\da-f]{6}$/i.test(value) ? value : '#ffffff'} onChange={e => onChange(e.target.value)} /><input aria-label={`${label} farvekode`} type="text" value={value} onChange={e => onChange(e.target.value)} spellCheck={false} /></span></Field>;
}
export function MainButtonsControls(props: Props) {
  return <SharedButtonsControls {...props} />;
}
export function HeaderQuickControls({ draft, updateDraft }: Props) {
  const header = draft.header;
  const change = (patch: Partial<typeof header>) => updateDraft({ header: { ...header, ...patch },
    ...(Object.keys(patch).some(key => key.startsWith('dropdown')) ? { themeSettings: { ...draft.themeSettings, dropdownColorsCustomized: true } } : {}),
  });
  return <div className="sd-quick-controls">
    <p>Menuens farver gælder også de nye produktmenuer. Åbn produktmenuen i previewets værktøjslinje for at se ændringerne.</p>
    <Color label="Headerens baggrund" value={header.bgColor} onChange={bgColor => change({ bgColor })} />
    <Color label="Menutekst" value={header.textColor} onChange={textColor => change({ textColor })} />
    <h3>Dropdown</h3>
    <Color label="Dropdown-baggrund" value={header.dropdownBgColor || '#FFFFFF'} onChange={dropdownBgColor => change({ dropdownBgColor })} />
    <Color label="Dropdown-produkttekst" value={header.dropdownProductColor || '#1F2937'} onChange={dropdownProductColor => change({ dropdownProductColor })} />
    <Color label="Dropdown-kategorier" value={header.dropdownCategoryColor || '#6B7280'} onChange={dropdownCategoryColor => change({ dropdownCategoryColor })} />
    <Color label="Dropdown-hover" value={header.dropdownHoverColor || '#EFF6FC'} onChange={dropdownHoverColor => change({ dropdownHoverColor })} />
    <Field label={`Dropdown-opacitet · ${Math.round((header.dropdownBgOpacity ?? 1) * 100)}%`}><input type="range" min="30" max="100" value={(header.dropdownBgOpacity ?? 1) * 100} onChange={e => change({ dropdownBgOpacity: Number(e.target.value) / 100 })} /></Field>
  </div>;
}
export function HeroQuickControls({ draft, updateDraft }: Props) {
  const isPrint = Boolean(getPrintDesignPreset(draft.themeId));
  const hero = isPrint ? resolvePrintHero(draft) : draft.hero;
  // Display the same resolved copy as the banner, but retain hidden per-slide copy.
  const change = (patch: Partial<HeroSettings>) => updateDraft({ hero: { ...draft.hero, ...patch } });
  const show = draft.forside.showBanner !== false && (getPrintDesignPreset(draft.themeId)?.hero !== null || draft.themeSettings.printHeroEnabled === true);
  const primary = hero.overlay.buttons.find(button => button.variant === 'primary');
  return <div className="sd-quick-controls">
    <label className="sd-control-toggle"><input type="checkbox" checked={show} onChange={e => updateDraft({ forside: { ...draft.forside, showBanner: e.target.checked }, themeSettings: { ...draft.themeSettings, printHeroEnabled: e.target.checked } })} /><span>Vis banner på forsiden</span></label>
    {!show && <p className="sd-control-note">Banneret er skjult. Slå det til for at se ændringerne.</p>}
    {isPrint && <Field label="Bannertekst"><select value={hero.textSource || 'shared'} onChange={e => change({ textSource: e.target.value as HeroSettings['textSource'] })}><option value="shared">Samme tekst på alle billeder</option><option value="slides">Tekst for hvert billede</option></select></Field>}
    {isPrint && hero.textSource !== 'slides' && <SiteDesignHeroCopy hero={hero} onChange={next => change({ overlay: next.overlay })} />}
    {(!isPrint || hero.textSource === 'slides') && <p>Ret teksten for hvert billede under Billeder, video og detaljer nedenfor.</p>}
    <label className="sd-control-toggle"><input type="checkbox" checked={hero.overlay.showButtons} onChange={e => change({ overlay: { ...hero.overlay, showButtons: e.target.checked } })} /><span>Vis bannerknapper</span></label>
    {isPrint && hero.textSource !== 'slides' && primary && <Field label="Primær knaptekst"><input value={primary.label} onChange={e => change({ overlay: { ...hero.overlay, buttons: hero.overlay.buttons.map(button => button.id === primary.id ? { ...button, label: e.target.value } : button) } })} /></Field>}
    <h3>Bevægelse</h3>
    <Field label="Banner-effekt"><select value={hero.parallax || hero.videoSettings.parallaxEnabled ? hero.parallaxStyle || 'classic' : 'none'} onChange={e => change({ parallax: e.target.value !== 'none', parallaxStyle: e.target.value === 'none' ? hero.parallaxStyle : e.target.value as HeroSettings['parallaxStyle'], videoSettings: { ...hero.videoSettings, parallaxEnabled: e.target.value !== 'none' } })}><option value="none">Rolig · ingen parallax</option><option value="classic">Parallax</option><option value="soft-depth">Blød dybde</option><option value="slow-zoom">Langsom zoom</option><option value="fixed-focus">Fast fokus</option></select></Field>
    <Field label="Billedskift"><select value={hero.slideshow.transition} onChange={e => change({ slideshow: { ...hero.slideshow, transition: e.target.value as HeroSettings['slideshow']['transition'] } })}><option value="fade">Blød overgang</option><option value="slide">Glid</option><option value="zoom-fade">Zoom og fade</option><option value="cross-zoom">Krydszoom</option><option value="soft-wipe">Blød afdækning</option><option value="ken-burns">Langsom billedzoom</option></select></Field>
    <label className="sd-control-toggle"><input type="checkbox" checked={hero.slideshow.enabled && hero.slideshow.autoplay} onChange={e => change({ slideshow: { ...hero.slideshow, enabled: e.target.checked, autoplay: e.target.checked } })} /><span>Skift billeder automatisk</span></label>
    {hero.images.length < 2 && hero.mediaType !== 'video' && <p className="sd-control-note">Tilføj mindst to billeder for at se billedskift.</p>}
    <Field label="Tid pr. billede"><select value={String(hero.slideshow.intervalMs)} onChange={e => change({ slideshow: { ...hero.slideshow, intervalMs: Number(e.target.value) } })}>{Array.from(new Set([3000, 5000, 8000, 10000, hero.slideshow.intervalMs])).sort((a,b) => a-b).map(value => <option key={value} value={value}>{value / 1000} sekunder</option>)}</select></Field>
    <Field label="Bannerhøjde"><select value={hero.heightPx || ''} onChange={e => change({ heightPx: e.target.value ? Number(e.target.value) : undefined })}><option value="">Følg shopdesign</option><option value="320">Kompakt · 320 px</option><option value="410">Standard · 410 px</option><option value="540">Stor · 540 px</option><option value="650">Ekstra stor · 650 px</option></select></Field>
    <Field label={`Mørkt lag over billedet · ${Math.round(hero.overlay_opacity * 100)}%`}><input type="range" min="0" max="80" value={hero.overlay_opacity * 100} onChange={e => change({ overlay_opacity: Number(e.target.value) / 100 })} /></Field>
    <p className="sd-control-note">Bevægelse respekterer kundens indstilling for reduceret animation.</p>
  </div>;
}
