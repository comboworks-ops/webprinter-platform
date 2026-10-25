import { resolveWideElementSelection, wideElementCss, wideElementStyles } from '@/lib/branding/wideFormatElements';
import { getGoogleFontsUrl } from '@/components/admin/FontSelector';
import { applyFavicon } from '@/hooks/useFavicon';
import SiteHeader from '@/components/Header';
import SiteFooter from '@/components/Footer';
import { wideFormatSectionIsShared } from '@/lib/branding/wideFormatEditor';
import { getPageBackgroundStyle } from '@/lib/branding/background';
import { useCookieConsent } from '@/components/consent';
import { useLanguage } from '@/contexts/LanguageContext';
import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Header, Footer, Dialog } from './PvcbannerShell.jsx';
import { SignalSettingsProvider } from './signalBrandingContext';
import { connectedCatalogue } from '../../../prototypes/pvcbanner-signal/src/commerce.mjs';
import { useStorefrontCatalog } from '@/hooks/useStorefrontCatalog';
import { usePreviewBranding } from '@/contexts/PreviewBrandingContext';
import { appendStorefrontTenantContext } from '@/lib/storefrontTenantContext';
import { signalSettings, type SignalSettings } from '@/lib/branding/pvcbannerSettings';
import { buildBrandingCssVariables, type BrandingData } from '@/lib/branding';
import '@/styles/responsiveHeader.css';
import '@/styles/pvcbannerNativeShell.css';
import '@/styles/pvcbannerNative.css';
import '@/styles/wideFormatShops.css';

const PageSettings = createContext<SignalSettings | null>(null);
export const usePvcbannerPageSettings = () => useContext(PageSettings);

export function PvcbannerNativeFrame({ branding, children, contentOnly }: { branding: BrandingData; children: ReactNode; contentOnly?: boolean }) {
  const b = signalSettings(branding);
  useEffect(() => { applyFavicon(branding.favicon); }, [branding.favicon]);
  const { openSettings } = useCookieConsent();
  const { language, setLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const preview = usePreviewBranding();
  const { products, loading, errorMessage } = useStorefrontCatalog({enabled:!contentOnly});
  const [dialog, setDialog] = useState<'search' | 'account' | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(false);
  const [previewMenu, setPreviewMenu] = useState(false);
  const route = preview.previewPath || location.pathname;
  const catalogue = connectedCatalogue(products.filter(p => p.id && p.name && /^[a-z0-9][a-z0-9_-]*$/i.test(p.slug)), { product: (slug: string) => `/produkt/${encodeURIComponent(slug)}` }).map(p => ({...p,imageUrl:products.find(row => row.slug === p.id)?.image_url || `/site-previews/pvcbanner-signal/assets/${p.image}`}));
  const results = catalogue.filter(p => `${p.title} ${p.group}`.toLocaleLowerCase('da').includes(search.toLocaleLowerCase('da')));
  function go(path: string) {
    setDialog(null);
    if (preview.isPreviewMode) {
      if (/^\/(auth|admin|konto)(\/|\?|$)/.test(path)) return;
      window.dispatchEvent(new CustomEvent('pvc-native-navigate', { detail: path }));
    } else navigate(appendStorefrontTenantContext(path));
  }
  useEffect(() => { setDialog(null); }, [route]);
  useEffect(() => {
    if (!preview.isPreviewMode) return;
    const receive = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== window.location.origin) return;
      if (event.data?.type === 'SET_EDIT_MODE') setEditing(event.data.enabled === true);
      if (event.data?.type === 'SET_PREVIEW_PRODUCT_MENU') setPreviewMenu(event.data.open === true || event.data.enabled === true);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [preview.isPreviewMode]);
  // Native preview selection also works in the lightweight local editor harness.
  const intercept = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    const elementSelection = resolveWideElementSelection(target);
    const selection = target.closest<HTMLElement>('[data-signal-section]');
    const edit = editing || document.querySelector('[data-site-design-edit-mode="true"]');
    if (preview.isPreviewMode && edit && (selection || elementSelection)) {
      event.preventDefault(); event.stopPropagation();
      window.parent.postMessage({ type: 'EDIT_SECTION', sectionId: elementSelection ? `wide-element:${elementSelection.id}` : selection?.dataset.signalSection }, window.location.origin);
      return;
    }
    const anchor = target.closest<HTMLAnchorElement>('a[href]');
    if (anchor && anchor.getAttribute('href')?.startsWith('/') && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      event.preventDefault(); event.stopPropagation(); go(anchor.getAttribute('href')!);
    }
  };
  const font = (name: string) => name === 'Anton' ? 'PvcAnton, Anton, sans-serif' : name === 'Inter' ? 'PvcInter, Inter, sans-serif' : name;
  const style = {
    ...buildBrandingCssVariables({...branding,colors:{...branding.colors,primary:b.primary,background:b.background,headingText:b.ink,bodyText:b.ink,linkText:b.primary}}),
    '--blue':b.primary,'--yellow':b.accent,'--ink':b.ink,'--line':'#e2e6ec','--wash':'#f4f7fc','--muted':'#606b7a',
    '--page':`${b.contentWidth}px`,'--signal-heading':font(b.headingFont),'--signal-body-font':font(b.bodyFont),
    '--signal-body':`${b.bodySize}px`,'--signal-heading-size':`${b.headingSize}px`,'--signal-leading':b.lineHeight,
    '--signal-button':b.buttonBackground,'--signal-button-text':b.buttonTextColor,'--signal-button-size':`${b.buttonSize}px`,
    '--signal-button-radius':`${b.buttonRadius}px`,'--signal-button-padding':`${b.buttonPadding}px`,
    '--signal-space':`${b.sectionSpacing}px`,'--signal-columns':b.productColumns,'--signal-product-title':`${b.productTitleSize}px`,'--signal-image-ratio':b.productImageRatio === 'square' ? '1' : '1.25',
    '--signal-page-title':`${b.pageTitleSize}px`,'--signal-page-space':`${b.sectionSpacing}px`,
    '--signal-duration':b.motion === 'none' ? '0ms' : '180ms','--signal-ease':'cubic-bezier(.2,.65,.3,1)',
    color:b.ink,background:b.background,...getPageBackgroundStyle(branding),fontFamily:font(b.bodyFont),
    '--flow-blue':b.primary,'--flow-ink':b.ink,'--order-primary-surface':b.buttonBackground,'--order-primary-text':b.buttonTextColor,
  } as CSSProperties;
  return <PageSettings.Provider value={b}><SignalSettingsProvider value={{...b,headingFont:font(b.headingFont),nativeLinks:true,navigate:go,previewMenu,fullBranding:branding}}>
    <div className="pvc-native" data-wide-format={b.designId} data-shared-calculator={b.sharedCalculatorLayout} data-contact-layout={b.contactLayout} data-checkout-layout={b.checkoutStyle} data-motion={b.motion} data-button-style={b.buttonStyle} style={style} onClickCapture={intercept}>
      <style>{wideElementCss(branding)}</style>
      {getGoogleFontsUrl(Object.values(wideElementStyles(branding)).map(style=>style.fontFamily).filter(Boolean)) && <link rel="stylesheet" href={getGoogleFontsUrl(Object.values(wideElementStyles(branding)).map(style=>style.fontFamily).filter(Boolean))}/>}
      {!contentOnly && (wideFormatSectionIsShared(branding, 'header') || wideFormatSectionIsShared(branding, 'logo') ? <div data-signal-section="header"><SiteHeader/></div> : <div className="pvc-native-shell"><div className="preview-bar"><span>{b.brand.toLocaleUpperCase('da')} · BY WEBPRINTER</span><span>Design og bestil online</span></div><Header key={route} catalogue={catalogue} orderHref="/checkout/konfigurer" onSearch={() => setDialog('search')} onAccount={() => setDialog('account')} onLanguage={() => setLanguage(language === 'da' ? 'en' : 'da')} languageLabel={language === 'da' ? 'Dansk' : 'English'}/></div>)}
      <div className="pvc-native-content" key={route}>{children}</div>
      {!contentOnly && (wideFormatSectionIsShared(branding, 'footer') ? <div data-signal-section="footer"><SiteFooter/></div> : <div className="pvc-native-shell"><Footer onCookieSettings={openSettings}/></div>)}
      {dialog && <div className="pvc-native-shell"><Dialog title={dialog === 'search' ? 'Find dit format' : 'Din konto'} onClose={() => setDialog(null)}>
        {dialog === 'search' ? <><label className="search-field"><input aria-label="Søg efter produkt" placeholder="Søg i sortimentet…" value={search} onChange={event => setSearch(event.target.value)}/></label><div className="search-results">{results.map(p => <a key={p.id} href={p.href}><img src={p.imageUrl} alt=""/><span><strong>{p.title}</strong><small>{p.tag}</small></span></a>)}</div>{!results.length && <p role="status">{loading ? 'Henter sortiment…' : errorMessage ? 'Sortimentet kunne ikke hentes. Prøv igen senere.' : 'Ingen produkter matcher din søgning.'}</p>}</> : <><p>Log ind for at se dine ordrer og gemte designs hos {b.brand}.</p>{preview.isPreviewMode ? <p>Konto åbnes i webshoppen. Du er i Site Design-preview.</p> : <div className="account-actions"><a className="button" href="/auth">Log ind</a><a className="button secondary" href="/auth?mode=signup">Opret konto</a></div>}</>}
      </Dialog></div>}
    </div>
  </SignalSettingsProvider></PageSettings.Provider>;
}
