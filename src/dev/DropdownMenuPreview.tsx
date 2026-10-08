import { IconPackProvider } from '@/components/icons/IconFamily';
import { IconPackSelector } from '@/components/admin/IconPackSelector';
import { resolveIconPack } from '@/lib/icons/registry';
/** Local menu review: shared editor and storefront, browser-only saved choices. */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { HeaderSection } from '@/components/admin/HeaderSection';
import { SiteDesignPreviewFrame } from '@/components/admin/SiteDesignPreviewFrame';
import { mergeBrandingWithDefaults, type BrandingData } from '@/hooks/useBrandingDraft';
import { applyPrintDesignPreset, DEFAULT_PRINT_DESIGN_ID } from '@/lib/branding/printDesignPresets';
import { APPROVED_DROPDOWN_PRESETS, DEFAULT_DROPDOWN_PRESET } from '@/lib/branding/dropdownPresets';
import { menuReviewLink, readMenuReviewQuery, MENU_REVIEW_STORAGE_KEY, readMenuReviewPalette } from './headerMenuReviewState';
import { menuColorsChanged } from '@/lib/branding/headerMenuSettings';
import '@/index.css';

const STORAGE_KEY = MENU_REVIEW_STORAGE_KEY;
const TENANT_ID = '00000000-0000-0000-0000-000000000000';
const WIDTHS = [1440, 1280, 1024, 768, 390, 320] as const;

function initialDraft() {
  const branding = applyPrintDesignPreset(mergeBrandingWithDefaults(), DEFAULT_PRINT_DESIGN_ID);
  return { ...branding, header: { ...branding.header, dropdownPreset: DEFAULT_DROPDOWN_PRESET } };
}

function readLocalDraft() {
  const baseline = initialDraft();
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (stored?.version === 1 && stored.header && typeof stored.header === 'object') {
      return mergeBrandingWithDefaults({ ...baseline, selectedIconPackId: resolveIconPack(stored.selectedIconPackId), header: { ...baseline.header, ...stored.header }, themeSettings: { ...baseline.themeSettings, dropdownColorsCustomized: Boolean(stored.dropdownColorsCustomized) } });
    }
  } catch { /* An unavailable or invalid local draft starts from the selected default. */ }
  return baseline;
}

export function DropdownMenuPreview() {
  const [savedDraft, setSavedDraft] = useState<BrandingData>(() => {
    const draft = readLocalDraft();
    const header = readMenuReviewQuery(draft.header, window.location.search);
    return { ...draft, selectedIconPackId: resolveIconPack(new URLSearchParams(window.location.search).get('icons') || draft.selectedIconPackId), header, themeSettings: { ...draft.themeSettings, dropdownColorsCustomized: readMenuReviewPalette(Boolean(draft.themeSettings?.dropdownColorsCustomized) || menuColorsChanged(draft.header, header), window.location.search) } };
  });
  const [draft, setDraft] = useState<BrandingData>(savedDraft);
  const [width, setWidth] = useState<number>(1440);
  const [availableWidth, setAvailableWidth] = useState(1000);
  const [notice, setNotice] = useState('Local preview · Ændringer gemmes kun i denne browser');
  const previewHost = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const height = width <= 390 ? 844 : 900;
  const scale = Math.min(1, Math.max(0.1, (availableWidth - 32) / width));
  const changed = JSON.stringify([draft.header,draft.selectedIconPackId]) !== JSON.stringify([savedDraft.header,savedDraft.selectedIconPackId]);
  const selected = APPROVED_DROPDOWN_PRESETS.find(preset => preset.id === draft.header.dropdownPreset);

  const openMenu = useCallback(() => {
    previewHost.current?.querySelector('iframe')?.contentWindow?.postMessage(
      { type: 'SET_PREVIEW_PRODUCT_MENU', open: true }, window.location.origin,
    );
  }, []);

  const scheduleOpen = useCallback(() => {
    timers.current.forEach(clearTimeout);
    // The shared frame completes its own initial menu synchronization at 650 ms.
    timers.current = [120, 850, 1300].map(delay => setTimeout(openMenu, delay));
  }, [openMenu]);

  useEffect(() => {
    const host = previewHost.current;
    if (!host) return;
    const measure = () => setAvailableWidth(host.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    const iframe = host.querySelector('iframe');
    iframe?.addEventListener('load', scheduleOpen);
    const handleReady = (event: MessageEvent) => {
      if (event.source === iframe?.contentWindow && event.origin === window.location.origin
        && event.data?.type === 'PREVIEW_READY') scheduleOpen();
    };
    window.addEventListener('message', handleReady);
    return () => {
      observer.disconnect();
      iframe?.removeEventListener('load', scheduleOpen);
      window.removeEventListener('message', handleReady);
      timers.current.forEach(clearTimeout);
    };
  }, [scheduleOpen]);

  useEffect(() => { scheduleOpen(); }, [draft.header, width, scheduleOpen]);

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, header: draft.header, selectedIconPackId: draft.selectedIconPackId, dropdownColorsCustomized: draft.themeSettings?.dropdownColorsCustomized }));
      window.history.replaceState(null, '', menuReviewLink('/dropdown-menu-review.html', draft.header, Boolean(draft.themeSettings?.dropdownColorsCustomized), draft.selectedIconPackId));
      setSavedDraft(draft);
      setNotice('Gemt lokalt i denne browser');
    } catch { setNotice('Browseren kunne ikke gemme valget lokalt.'); }
  };

  return <IconPackProvider packId={draft.selectedIconPackId}><main className="dm-review" data-dropdown-menu-preview data-selected-menu={draft.header.dropdownPreset}>
    <style>{`
      .dm-review { min-height:100vh; background:#eef3f8; color:#132b43; font:14px/1.5 Inter,system-ui,sans-serif; }
      .dm-review-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--ui-space-4); padding:var(--ui-space-4) var(--ui-page-gutter); background:#fff; border-bottom:1px solid #d9e3ed; }
      .dm-review-header h1 { margin:0; font-size:clamp(1.25rem,2vw,1.6rem); font-weight:700; line-height:1.25; }
      .dm-review-header p { margin:5px 0 0; color:#52667b; }
      .dm-review-actions { display:flex; flex-wrap:wrap; align-items:center; gap:var(--ui-space-2); }
      .dm-review-actions button,.dm-review-controls button,.dm-review-controls select { min-height:44px; padding:8px 12px; border:1px solid #b9cbdd; border-radius:7px; background:#fff; color:#173650; font:inherit; }
      .dm-review-actions button:disabled { opacity:.45; }
      .dm-review-actions button[data-primary] { color:white; background:#187cb7; border-color:#187cb7; }
      .dm-review-layout { display:grid; grid-template-columns:minmax(280px,340px) minmax(0,1fr); align-items:start; gap:var(--ui-space-4); padding:var(--ui-space-4) var(--ui-page-gutter) var(--ui-space-8); }
      .dm-review-inspector { min-width:0; max-height:calc(100dvh - 132px); overflow-y:auto; border-radius:10px; background:#fff; padding:var(--ui-space-3); }
      .dm-review-stage { min-width:0; }
      .dm-review-controls { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--ui-space-3); padding:var(--ui-space-3); border:1px solid #d9e3ed; border-bottom:0; border-radius:10px 10px 0 0; background:#fff; }
      .dm-review-controls label { display:flex; align-items:center; gap:8px; }
      .dm-review-size { font-size:12px; color:#52667b; }
      .dm-review-preview { border:1px solid #d9e3ed; border-radius:0 0 10px 10px; overflow:hidden; }
      .dm-review-preview .sd-frame-workspace > :first-child,.dm-review-preview .sd-frame-workspace > :last-child,.dm-review-preview .sd-preview-hint { display:none; }
      .dm-review-preview .sd-preview-area { align-items:flex-start; padding:16px; }
      .dm-review-preview .sd-flat-preview { width:var(--review-scaled-width)!important; height:var(--review-scaled-height)!important; flex-shrink:0; overflow:hidden; background:#fff; }
      .dm-review-preview .sd-flat-preview > div:not(.sd-preview-loading) { width:var(--review-width)!important; height:var(--review-height)!important; transform:scale(var(--review-scale))!important; transform-origin:top left; }
      .dm-review-preview iframe { width:var(--review-width)!important; height:var(--review-height)!important; display:block; }
      .dm-review-footnote { margin:var(--ui-space-3) 0 0; color:#52667b; max-width:75ch; }
      @media(max-width:900px) { .dm-review-layout { grid-template-columns:1fr; } .dm-review-inspector { max-height:420px; } }
    `}</style>
    <header className="dm-review-header">
      <div><h1>Menuernes design · ni designvalg</h1><p role="status">{changed ? 'Lokale ændringer · ikke gemt endnu' : notice}</p></div>
      <div className="dm-review-actions">
        <button type="button" onClick={() => setDraft(initialDraft())}>Vælg standard #5</button>
        <button type="button" disabled={!changed} onClick={() => setDraft(savedDraft)}>Fortryd</button>
        <button type="button" data-primary onClick={save}>Gem lokalt</button>
      </div>
    </header>
    <div className="dm-review-layout">
      <aside className="dm-review-inspector" aria-label="Vælg produktmenu">
        <HeaderSection header={draft.header}
          dropdownColorsCustomized={Boolean(draft.themeSettings?.dropdownColorsCustomized)} primaryColor={draft.colors.primary}
          onChange={header => setDraft(current => ({ ...current, header, themeSettings: { ...current.themeSettings, dropdownColorsCustomized: current.themeSettings?.dropdownColorsCustomized || menuColorsChanged(current.header, header) } }))}
          focusTargetId="site-design-focus-header-dropdown-layout" />
        <details className="m-3 rounded-lg border p-3"><summary className="cursor-pointer text-sm font-semibold">Ikoner til hele shoppen · 14 sæt</summary><div className="mt-3"><IconPackSelector selectedPackId={draft.selectedIconPackId} onChange={id => setDraft(current => ({ ...current, selectedIconPackId: id }))}/></div></details>
      </aside>
      <section className="dm-review-stage" aria-label="Forhåndsvisning af produktmenu">
        <div className="dm-review-controls">
          <div><strong>{selected ? `${selected.number}. ${selected.name}` : 'Produktmenu'}</strong><div className="dm-review-size">{width} × {height} px · vist ved {Math.round(scale * 100)} %</div></div>
          <div className="dm-review-actions">
            <label>Skærmbredde <select aria-label="Skærmbredde" value={width} onChange={event => setWidth(Number(event.target.value))}>{WIDTHS.map(value => <option value={value} key={value}>{value} px</option>)}</select></label>
            <button type="button" onClick={openMenu}>Åbn produktmenu</button>
          </div>
        </div>
        <div ref={previewHost} className="dm-review-preview" data-preview-width={width} style={{
          height: height * scale + 34,
          '--review-width': `${width}px`, '--review-height': `${height}px`,
          '--review-scale': scale, '--review-scaled-width': `${width * scale}px`, '--review-scaled-height': `${height * scale}px`,
        } as CSSProperties}>
          <SiteDesignPreviewFrame presentation="workspace" branding={draft} tenantName="Webprinter"
            previewUrl={`/preview-shop?draft=1&preview_mode=1&tenantId=${TENANT_ID}&editor=dropdown-menu-review`} />
        </div>
        <p className="dm-review-footnote">Samme menuvalg som i Site Design: Produkter, Min konto, søgning og sprog. Gem lokalt ændrer kun denne browsers prøvevalg. Standard: 5. Search &amp; Discover. <a href={menuReviewLink('/header-menu-review.html', draft.header, Boolean(draft.themeSettings?.dropdownColorsCustomized), draft.selectedIconPackId)} className="underline">Prøv dette sæts konto, søgning og sprog med eksempeldata</a>.</p>
      </section>
    </div>
  </main></IconPackProvider>;
}

if (import.meta.env.DEV) {
  const root = import.meta.hot?.data.root || createRoot(document.getElementById('root')!);
  if (import.meta.hot) import.meta.hot.data.root = root;
  root.render(<DropdownMenuPreview />);
}
