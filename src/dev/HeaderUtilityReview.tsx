import { IconPackProvider } from '@/components/icons/IconFamily';
import { IconPackSelector, ICON_PACKS } from '@/components/admin/IconPackSelector';
import { resolveIconPack } from '@/lib/icons/registry';
/** Local, in-memory samples. The controls are the actual storefront components. */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { DesktopHeaderActions } from '@/components/Header';
import { HeaderSearch } from '@/components/storefront/HeaderSearch';
import { HeaderUtilityPreview } from '@/components/storefront/HeaderUtilityPreview';
import { APPROVED_DROPDOWN_PRESETS, DEFAULT_DROPDOWN_PRESET, resolveDropdownPreset } from '@/lib/branding/dropdownPresets';
import { HeaderMenuControls } from '@/components/admin/HeaderMenuControls';
import { mergeBrandingWithDefaults, type HeaderSettings } from '@/hooks/useBrandingDraft';
import { headerMenuStyle, resolveMenuEntrance, menuColorsChanged } from '@/lib/branding/headerMenuSettings';
import { menuReviewLink, readMenuReviewQuery, MENU_REVIEW_STORAGE_KEY, readMenuReviewPalette } from './headerMenuReviewState';
import '@/index.css';

const products = ['Visitkort', 'Flyers A5', 'Plakater A3', 'Salgsmapper', 'Bannere', 'Klistermærker'].map((name, index) => ({ id: `local-${index}`, name, slug: `local-${index}`, category: ['Tryksager', 'Tryksager', 'Plakater', 'Salgsmapper', 'Storformat', 'Klistermærker'][index] }));
const sampleUser = { id: 'local-review-only', email: 'anna@example.invalid' } as User;
export function HeaderUtilityReview() {
  const [settings, setSettings] = useState(() => {
    let header = { ...mergeBrandingWithDefaults().header, dropdownPreset: DEFAULT_DROPDOWN_PRESET, dropdownBgOpacity: 1, dropdownBorderRadiusPx: 8 };
    let customized = false;
    let iconPack = 'classic';
    try {
      const saved = JSON.parse(localStorage.getItem(MENU_REVIEW_STORAGE_KEY) || 'null');
      if (saved?.version === 1 && saved.header) { header = { ...header, ...saved.header }; customized = Boolean(saved.dropdownColorsCustomized); iconPack = resolveIconPack(saved.selectedIconPackId); }
    } catch { /* Start with standard when no local draft is available. */ }
    const requested = readMenuReviewQuery(header, window.location.search);
    return { iconPack: resolveIconPack(new URLSearchParams(window.location.search).get('icons') || iconPack), header: requested, customized: readMenuReviewPalette(customized || menuColorsChanged(header, requested), window.location.search) };
  });
  const { header } = settings;
  const preset = header.dropdownPreset;
  const updateHeader = (patch: Partial<HeaderSettings>) => setSettings(current => {
    const header = { ...current.header, ...patch };
    return { ...current, header, customized: current.customized || menuColorsChanged(current.header, header) };
  });
  const entrance = resolveMenuEntrance(header.dropdownEntrance);
  const [notice, setNotice] = useState('Ikonsæt følger alle menudesigns.');
  const [language, setLanguage] = useState<'da' | 'en'>('da');
  const [searchOpen, setSearchOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(true);
  const style = headerMenuStyle(header, '#087fc5', settings.customized);
  return <IconPackProvider packId={settings.iconPack}><main className="utility-review" data-selected-menu={preset}>
    <style>{`
      .utility-review { min-height:100vh; padding:var(--ui-page-gutter,24px); background:#edf3f8; color:#162e43; font:14px/1.5 Inter,system-ui,sans-serif; }
      .utility-review h1 { font-size:clamp(24px,3vw,36px); font-weight:650; letter-spacing:-.03em; margin:0 0 8px; }
      .utility-review-intro { max-width:70ch; margin-bottom:24px; }
      .utility-review-layout { display:grid; grid-template-columns:minmax(280px,340px) minmax(0,1fr); gap:24px; align-items:start; margin-bottom:24px; }
      .utility-review-controls { padding:20px; border-radius:12px; border:1px solid #dbe5ed; background:#fff; }
      .utility-review-stage { position:sticky; top:16px; min-width:0; min-height:500px; background:#fff; border:1px solid #dbe5ed; border-radius:12px; padding:16px; margin-bottom:24px; }
      .utility-review-row { position:relative; display:flex; align-items:center; justify-content:flex-end; gap:12px; min-height:56px; }
      .utility-review-row > strong { margin-right:auto; font-size:22px; color:#087fc5; }
      .utility-review-actions { display:flex; align-items:center; gap:8px; }
      .utility-review-actions[data-hidden] { visibility:hidden; pointer-events:none; }
      .utility-review-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr)); gap:16px; }
      .utility-review-choice { min-width:0; border:1px solid #cbdbe7; border-radius:10px; background:#fff; text-align:left; overflow:hidden; }
      .utility-review-choice[aria-pressed=true] { outline:2px solid #087fc5; }
      .utility-review-choice > img { width:100%; aspect-ratio:3/2; object-fit:cover; border-bottom:1px solid #dbe5ed; }
      .utility-review-choice > span { display:block; padding:12px; }
      .utility-review-choice strong,.utility-review-choice small { display:block; }
      .utility-review-choice small { margin-top:5px; color:#526b7f; }
      .utility-review-note { margin:24px 0; color:#526b7f; max-width:75ch; }
      @media(max-width:1000px) { .utility-review-layout { grid-template-columns:1fr; } .utility-review-stage { position:relative; top:0; } }
      @media(max-width:600px) { .utility-review-row > strong { display:none; } .utility-review-stage { padding:8px; } .utility-review-actions { gap:0; } }
    `}</style>
    <h1>Menusæt, ikoner og bevægelse</h1>
    <p className="utility-review-intro">Samme designvalg som Produkter-menuen. Hvert sæt har nu sin egen matchende Min konto, søgning og sprog. Prøv forskellige søgeformer og sprogvisninger. Vælg en fælles åbning og farver i panelet, og åbn menuen igen for at se bevægelsen.</p>
    <p className="utility-review-intro"><a className="underline" href={menuReviewLink('/dropdown-menu-review.html', header, settings.customized, settings.iconPack)}>Se hele menusættet i designerens forhåndsvisning</a></p>
    <div className="utility-review-layout"><aside className="utility-review-controls"><HeaderMenuControls header={header} onChange={updateHeader}/></aside>
    <section className="utility-review-stage" aria-label="Prøv headerens menuer">
      <label className="mb-4 flex flex-wrap items-center gap-3 text-sm">Menusæt
        <select aria-label="Menusæt til prøve" className="min-h-11 rounded-md border bg-white px-3" value={preset} onChange={event => { updateHeader({ dropdownPreset: resolveDropdownPreset(event.target.value) }); setSearchOpen(false); }}>
          {APPROVED_DROPDOWN_PRESETS.map(option => <option key={option.id} value={option.id}>{option.number}. {option.name}{option.id === DEFAULT_DROPDOWN_PRESET ? ' · Standard' : ''}</option>)}
        </select>
      </label>
      <label className="mb-4 flex flex-wrap items-center gap-3 text-sm">Ikonsæt
        <select aria-label="Ikonsæt til prøve" className="min-h-11 rounded-md border bg-white px-3" value={settings.iconPack} onChange={event => setSettings(current => ({ ...current, iconPack: resolveIconPack(event.target.value) }))}>
          {ICON_PACKS.map(pack => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
        </select>
        <button type="button" className="min-h-11 underline" onClick={() => { localStorage.setItem(MENU_REVIEW_STORAGE_KEY, JSON.stringify({ version: 1, header, dropdownColorsCustomized: settings.customized, selectedIconPackId: settings.iconPack })); window.history.replaceState(null, '', menuReviewLink('/header-menu-review.html', header, settings.customized, settings.iconPack)); setNotice('Gemt lokalt i denne browser'); }}>Gem lokalt</button>
      </label><p className="mb-3 text-xs text-muted-foreground" role="status">{notice}</p>
      <div className="utility-review-row" style={style}>
        <strong>webprinter</strong>
        <div className="utility-review-actions" data-hidden={searchOpen || undefined}>
          <DesktopHeaderActions dropdownPreset={preset} menuStyle={style} entrance={entrance} languagePresentation={header.dropdownLanguagePresentation} desktopEnabled={!searchOpen} onCompactFocus={() => {}}
            searchFieldId="review-search" searchOpen={searchOpen} onSearchOpen={() => setSearchOpen(true)}
            authReady user={signedIn ? sampleUser : null} isAdmin language={language} setLanguage={setLanguage}
            ctaEnabled={false} ctaLabel="" ctaHref="/kontakt" ctaTextColor="#fff"
            handleLogout={() => setSignedIn(false)} selectedIconPackId={settings.iconPack} loginLabel="Log ind" adminPanelLabel="Indstillinger" logoutLabel="Log ud" />
        </div>
        <HeaderSearch id="review-search" open={searchOpen} products={products} loading={false} selectedIconPackId={settings.iconPack} preset={preset} style={style} entrance={entrance} presentation={header.dropdownSearchPresentation} onOpen={() => setSearchOpen(true)}
          onClose={restore => { setSearchOpen(false); if (restore) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[data-header-search-toggle]')?.focus()); }} />
      </div>
      <p className="utility-review-note">Lokal designprøve med en eksempelbruger og seks eksempelprodukter. Valgene er en lokal prøve. Konto- og produktlinks vises til designkontrol.</p>
      {!signedIn && <button className="underline" onClick={() => setSignedIn(true)}>Vis eksempelbruger igen</button>}
    </section></div>
    <details className="mb-6 rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">Sammenlign alle 14 ikonsæt</summary><div className="mt-4"><IconPackSelector selectedPackId={settings.iconPack} onChange={id => setSettings(current => ({ ...current, iconPack: id }))}/></div></details>
    <div className="utility-review-grid" aria-label="Vælg menudesign">
      {APPROVED_DROPDOWN_PRESETS.map(option => <button type="button" key={option.id} className="utility-review-choice" aria-pressed={preset === option.id} onClick={() => { updateHeader({ dropdownPreset: option.id }); setSearchOpen(false); }}>
        <img src={option.previewImage} alt="" loading="lazy" width={1536} height={1024} />
        <HeaderUtilityPreview preset={option.id} style={style} searchPresentation={header.dropdownSearchPresentation} languagePresentation={header.dropdownLanguagePresentation} />
        <span><strong>{option.number}. {option.name}{option.id === DEFAULT_DROPDOWN_PRESET ? ' · Standard' : ''}</strong><small>{option.description}</small></span>
      </button>)}
    </div>
    <p className="utility-review-note">I Site Design: Header → Dropdown menu → Menuernes design. Ét valg styrer hele sættet: Produkter, konto, søgning og sprog. Valget følger med den eksisterende kladde og forhåndsvisning.</p>
  </main></IconPackProvider>;
}
if (import.meta.env.DEV) {
  const root = import.meta.hot?.data.root || createRoot(document.getElementById('root')!);
  if (import.meta.hot) import.meta.hot.data.root = root;
  root.render(<BrowserRouter><HeaderUtilityReview /></BrowserRouter>);
}
