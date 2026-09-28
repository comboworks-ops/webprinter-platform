import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Copy, Plus, Trash2 } from 'lucide-react';
import type { FeaturedProductConfig, FeaturedProductSlideConfig, FeaturedSidePanelItem } from '@/hooks/useBrandingDraft';
import { FIRST_FEATURED_SLIDE, featuredSlideConfig, getFeaturedSlides, setFeaturedSlides, updateFeaturedSlide } from '@/lib/branding/featuredProductPresentation';
import { supabase } from '@/integrations/supabase/client';
import '@/styles/featuredProductInspector.css';

interface ProductChoice { id: string; name: string; pricing_type?: string | null; }
interface Props {
  config: FeaturedProductConfig;
  products: ProductChoice[];
  onChange: (config: FeaturedProductConfig) => void;
  onSelectSlide: (id: string) => void;
  selectedSlideId: string;
  disabled?: boolean;
  loadingProducts?: boolean;
  printDesign?: boolean;
  primaryColor: string;
  backgroundColor: string;
  titleColor: string;
  bodyColor: string;
  buttonFontSize: number;
  buttonPadding: number;
  focusTarget?: string | null;
  uploadImage: (file: File) => Promise<string | null>;
  uploading?: boolean;
}

function Field({ label, help, children }: { label: string; help?: string; children: ReactNode }) {
  return <label className="fp-field"><span>{label}</span>{children}{help && <small>{help}</small>}</label>;
}
function Toggle({ label, help, value, onChange }: { label: string; help?: string; value: boolean; onChange: (value: boolean) => void }) {
  return <label className="fp-toggle"><span><strong>{label}</strong>{help && <small>{help}</small>}</span><input type="checkbox" checked={value} onChange={event => onChange(event.target.checked)} /></label>;
}
function Section({ title, description, id, children, open = false }: { title: string; description: string; id: string; children: ReactNode; open?: boolean }) {
  return <details className="fp-section" id={id} open={open || undefined}><summary><span><strong>{title}</strong><small>{description}</small></span><ChevronDown size={16} /></summary><div className="fp-section-body">{children}</div></details>;
}
function Color({ label, help, value, fallback, onChange }: { label: string; help: string; value?: string; fallback: string; onChange: (value: string) => void }) {
  const color = value || fallback;
  return <div className="fp-color-row"><div><strong>{label}</strong><div className="fp-color-values"><input aria-label={label} type="color" value={/^#[\da-f]{6}$/i.test(color) ? color : '#ffffff'} onInput={event => onChange(event.currentTarget.value)} onChange={event => onChange(event.target.value)} /><input className="fp-color-hex" aria-label={`${label} farvekode`} key={color} defaultValue={color} spellCheck={false} onBlur={event => { const next=event.target.value.trim(); if (next === color) return; if (/^#[\da-f]{6}$/i.test(next)) { event.target.setCustomValidity(''); onChange(next); } else { event.target.setCustomValidity('Brug en farvekode som #087fc5.'); event.target.reportValidity(); } }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></div><small>{help}</small></div><button type="button" disabled={!value} onClick={() => onChange('')} title="Følg shopdesignet igen">Arv</button></div>;
}

export function FeaturedProductInspector(props: Props) {
  const { config, products, onChange, onSelectSlide, selectedSlideId, primaryColor } = props;
  const entries = getFeaturedSlides(config);
  const selectedIndex = Math.max(0, entries.findIndex(entry => entry.id === selectedSlideId));
  const selected = entries[selectedIndex];
  const settings = selected.config;
  const selectedProduct = products.find(product => product.id === settings.productId);
  const [quantities, setQuantities] = useState<number[]>([]);
  const [loadingQuantities, setLoadingQuantities] = useState(false);
  const [quantityError, setQuantityError] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fieldId = useId();
  const side = settings.sidePanel;
  const layout = settings.layout;
  const offsetYPx = layout?.offsetYPx ?? (!props.printDesign && settings.position === 'above' ? -(settings.overlapPx || 0) : 0);
  const updateLayout = (patch: Partial<NonNullable<FeaturedProductSlideConfig['layout']>>) => update({ layout: { ...settings.layout, ...patch } });
  const latestConfig = useRef(config);
  const latestOnChange = useRef(onChange);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  latestConfig.current = config;
  latestOnChange.current = onChange;
  const update = (patch: Partial<FeaturedProductSlideConfig>) => latestOnChange.current(updateFeaturedSlide(latestConfig.current, selected.id, patch));
  const updateSide = (patch: Partial<NonNullable<FeaturedProductSlideConfig['sidePanel']>>) => {
    const current = getFeaturedSlides(latestConfig.current).find(entry => entry.id === selected.id)?.config.sidePanel;
    update({ sidePanel: { ...current, enabled: current?.enabled ?? false, ...patch } });
  };
  const sideMode = side?.contentMode || (side?.items?.length ? 'items' : side?.mode || 'banner');
  const sideImages = [...new Set([side?.imageUrl, ...(side?.images || [])].filter((url): url is string => Boolean(url)))].slice(0, 5);

  useEffect(() => {
    let cancelled = false;
    setQuantities([]); setQuantityError(false);
    if (!settings.productId || selectedProduct?.pricing_type === 'STORFORMAT') { setLoadingQuantities(false); return; }
    setLoadingQuantities(true);
    void supabase.from('generic_product_prices').select('quantity').eq('product_id', settings.productId).order('quantity').then(({ data, error }) => {
      if (cancelled) return;
      setQuantityError(Boolean(error));
      setQuantities([...new Set((data || []).map(row => Number(row.quantity)).filter(value => Number.isFinite(value) && value > 0))].sort((a, b) => a - b));
      setLoadingQuantities(false);
    });
    return () => { cancelled = true; };
  }, [settings.productId, selectedProduct?.pricing_type]);

  useEffect(() => {
    if (!props.focusTarget) return;
    const element = document.getElementById(props.focusTarget);
    const section = element?.closest('details');
    if (section) section.open = true;
    element?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [props.focusTarget]);

  const chooseProduct = (value: string) => update({ productId: value || undefined, quantityPresets: undefined });
  const select = (index: number) => onSelectSlide(entries[index].id);
  const add = (duplicate: boolean) => {
    const id = crypto.randomUUID();
    const next = featuredSlideConfig(settings);
    if (!duplicate) {
      next.productId = undefined; next.customTitle = ''; next.customDescription = '';
      next.customImageUrl = null; next.galleryImages = []; next.galleryEnabled = false;
      next.sidePanel = { ...next.sidePanel, enabled: false, items: [], images: [], imageUrl: null, productId: undefined };
    }
    onChange({ ...config, slides: [...(config.slides || []), { id, config: next }] });
    onSelectSlide(id);
  };
  const move = (direction: number) => {
    const target = selectedIndex + direction;
    if (target < 0 || target >= entries.length) return;
    const reordered = [...entries];
    [reordered[selectedIndex], reordered[target]] = [reordered[target], reordered[selectedIndex]];
    const next = setFeaturedSlides(config, reordered); onChange(next); onSelectSlide(getFeaturedSlides(next)[target].id);
  };
  const remove = () => { onChange(setFeaturedSlides(config, entries.filter(entry => entry.id !== selected.id))); onSelectSlide(FIRST_FEATURED_SLIDE); };
  const imageField = (label: string, imageUrl: string | null | undefined, save: (url: string | null) => void, help?: string) => <div className="fp-media-field">
    <Field label={label} help={help}><input key={`${selected.id}:${imageUrl || ''}`} type="url" defaultValue={imageUrl || ''} placeholder="https://…" onBlur={event => { const url = event.target.value.trim(); if (url !== (imageUrl || '')) save(url || null); if (!imageUrl) event.target.value = ''; }} /></Field>
    <div className="fp-media-actions">{imageUrl && <img src={imageUrl} alt="Valgt billede" />}<label className="fp-upload">Upload billede<input aria-label={`Upload ${label.toLocaleLowerCase('da')}`} type="file" accept="image/*" disabled={props.uploading} onChange={async event => {
      const input = event.currentTarget; const file = input.files?.[0]; if (!file) return;
      setUploadError(''); const url = await props.uploadImage(file);
      if (!mounted.current) return;
      const target = getFeaturedSlides(latestConfig.current).find(entry => entry.id === selected.id);
      if (!target || JSON.stringify(target.config) !== JSON.stringify(settings)) setUploadError('Produktbanneret blev ændret under upload. Billedet er ikke sat ind.');
      else if (url) save(url); else setUploadError('Billedet kunne ikke uploades. Dit nuværende billede er bevaret.'); input.value = '';
    }} /></label>{imageUrl && <button type="button" onClick={() => save(null)}>Fjern</button>}</div>
  </div>;
  const galleryFields = (images: string[], save: (images: string[]) => void, maximum: number) => <div className="fp-gallery-list">
    {images.map((url, index) => <div className="fp-gallery-row" key={`${index}:${url}`}><img src={url} alt={`Billede ${index + 1}`} /><span>Billede {index + 1}</span><button type="button" aria-label={`Fjern billede ${index + 1}`} onClick={() => save(images.filter((_, i) => i !== index))}><Trash2 size={14} /></button></div>)}
    {images.length < maximum && imageField('Nyt galleribillede', '', url => { if (url) save([...images, url]); }, `Op til ${maximum} billeder. De skifter inden for den samme billedramme.`)}
  </div>;

  return <fieldset className="featured-product-inspector" disabled={props.disabled} id="site-design-focus-products-featured">
    <p className="fp-intro">En præsentation af dine produkter. Vælg et banner i listen og tilpas det. Dine ændringer gemmes i designkladden.</p>
    <Toggle label="Vis fremhævede produkter" value={config.enabled} onChange={enabled => onChange({ ...config, enabled })} />
    <ol className="fp-slide-list" aria-label="Produktbannere">{entries.map((entry, index) => <li key={entry.id}><button type="button" aria-current={entry.id === selected.id ? 'true' : undefined} onClick={() => select(index)}><span className="fp-slide-number">{index + 1}</span><span><strong>{entry.config.customTitle || products.find(product => product.id === entry.config.productId)?.name || 'Vælg et produkt'}</strong><small>{entry.config.galleryEnabled ? 'Produkt med billedgalleri' : 'Produkt med billede'}{entry.config.sidePanel?.enabled ? ' · sidebanner' : ''}</small></span></button></li>)}</ol>
    <button className="fp-add" type="button" onClick={() => add(false)}><Plus size={16} />Tilføj produktbanner</button>
    {entries.length > 1 && <Section title="Præsentation" description="Sådan vises produktbannerne på siden" id="featured-presentation-settings">
      <><Toggle label="Skift automatisk" help="Stopper ved betjening og følger reduceret bevægelse. Editorens preview skifter kun, når du vælger et banner." value={config.presentation?.autoPlay ?? false} onChange={autoPlay => onChange({ ...config, presentation: { mode: 'carousel', ...config.presentation, autoPlay } })} />
        {config.presentation?.autoPlay && <Field label="Sekunder pr. produkt"><input type="number" min={5} max={60} value={(config.presentation.intervalMs || 7000) / 1000} onChange={event => onChange({ ...config, presentation: { mode: 'carousel', ...config.presentation, intervalMs: Math.max(5, Math.min(60, Number(event.target.value) || 7)) * 1000 } })} /></Field>}</>
    </Section>}
    <div className="fp-edit-heading"><div><small>DU REDIGERER</small><h3>Produktbanner {selectedIndex + 1}</h3></div><div className="fp-item-actions"><button type="button" onClick={() => add(true)} aria-label="Duplikér produktbanner"><Copy size={15} /></button><button type="button" onClick={() => move(-1)} disabled={selectedIndex === 0} aria-label="Flyt produktbanner op"><ArrowUp size={15} /></button><button type="button" onClick={() => move(1)} disabled={selectedIndex === entries.length - 1} aria-label="Flyt produktbanner ned"><ArrowDown size={15} /></button><button type="button" onClick={remove} aria-label="Fjern produktbanner"><Trash2 size={15} /></button></div></div>
    <Section title="Placering og størrelse" description="Justering, bredde, afstande og runding på hele produktbanneret" id="site-design-focus-products-featured-box" open>
      <Field label="Justering på siden" help="Placér hele banneret til venstre, i midten eller til højre. Vælg en mindre bredde for at se forskellen."><select value={layout?.alignment || 'center'} onChange={event => updateLayout({ alignment: event.target.value as 'left' | 'center' | 'right' })}><option value="left">Venstre</option><option value="center">Centreret</option><option value="right">Højre</option></select></Field>
      <Field label={`Bannerets bredde · ${layout?.widthPct ?? 100}%`} help="Skalerer hele banneret med billeder, tekst og eventuelt sidebanner."><input aria-label="Bannerets bredde" type="range" min={40} max={100} step={5} value={layout?.widthPct ?? 100} onChange={event => updateLayout({ widthPct: Number(event.target.value) })} /></Field>
      <Field label={`Afstand til sidekanter · ${layout?.edgeInsetPx ?? 0} px`} help="Ekstra luft inden for sidens indholdsområde. Tilpasses automatisk på smalle skærme."><input aria-label="Afstand til sidekanter" type="range" min={0} max={120} step={4} value={layout?.edgeInsetPx ?? 0} onChange={event => updateLayout({ edgeInsetPx: Number(event.target.value) })} /></Field>
      <Field label={`Flyt op eller ned · ${offsetYPx} px`} help="Minus flytter op mod hero-banneret. 0 fjerner overlap. Plus giver luft over produktbanneret."><input aria-label="Flyt op eller ned" type="range" min={-160} max={240} step={4} value={offsetYPx} onChange={event => updateLayout({ offsetYPx: Number(event.target.value) })} /></Field>
      <button type="button" onClick={() => updateLayout({ offsetYPx: 24 })}>Placér uden overlap · 24 px luft</button>
      <Field label={`Luft under banneret · ${layout?.bottomGapPx ?? 0} px`}><input aria-label="Luft under banneret" type="range" min={0} max={160} step={4} value={layout?.bottomGapPx ?? 0} onChange={event => updateLayout({ bottomGapPx: Number(event.target.value) })} /></Field>
      <Field label={`Runding på produktboks · ${settings.borderRadiusPx ?? 24} px`}><input aria-label="Runding på produktboks" type="range" min={0} max={48} value={settings.borderRadiusPx ?? 24} onChange={event => update({ borderRadiusPx: Number(event.target.value) })} /></Field>
      <Field label="Layout på små skærme" help={props.printDesign ? "Fast komposition bevarer desktopdesignet. På smalle skærme fordeles indholdet automatisk, så tekst og knapper forbliver læsbare." : "Fast komposition bevarer alle placeringer og skalerer hele banneret. Kompakt giver større tekst på telefoner."}><select value={settings.layoutBehavior || 'fixed'} onChange={event => update({ layoutBehavior: event.target.value === 'fixed' ? 'fixed' : 'compact' })}><option value="fixed">Fast komposition — skalér samlet</option><option value="compact">Kompakt med faste knaplinjer</option></select></Field>
      {!props.printDesign && <><Field label="Præsentationens placering"><select value={config.position || 'above'} onChange={event => onChange({ ...config, position: event.target.value === 'below' ? 'below' : 'above' })}><option value="above">Før kategorier</option><option value="below">Efter kategorier</option></select></Field><Field label="Produktets side"><select value={settings.productSide || 'left'} onChange={event => update({ productSide: event.target.value === 'right' ? 'right' : 'left' })}><option value="left">Venstre</option><option value="right">Højre</option></select></Field><Field label="Indvendig skala"><input type="range" min={60} max={140} value={settings.boxScalePct ?? 80} onChange={event => update({ boxScalePct: Number(event.target.value) })} /></Field><Field label="Kortets udtryk"><select value={settings.cardStyle || 'default'} onChange={event => update({ cardStyle: event.target.value === 'glass' ? 'glass' : 'default' })}><option value="default">Let skygge</option><option value="glass">Uden skygge</option></select></Field></>}
      <button type="button" disabled={!layout} onClick={() => update({ layout: undefined })}>Brug designets placering igen</button>
    </Section>
    <Section title="Produkt og tekst" description="Produktvalg, overskrift og beskrivelse" id="site-design-focus-products-featured-copy" open>
      <Field label="Produkt" help="Pris og valgmuligheder hentes fra produktet. Tekstændringer her ændrer kun dette banner."><select value={settings.productId || ''} onChange={event => chooseProduct(event.target.value)} disabled={props.loadingProducts}><option value="">Vælg produkt…</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></Field>
      <Field label="Overskrift" help="Tomt felt bruger produktets navn."><input value={settings.customTitle || ''} onChange={event => update({ customTitle: event.target.value })} placeholder={selectedProduct?.name || 'Produktets navn'} /></Field>
      <Field label="Beskrivelse" help="Tomt felt bruger produktets beskrivelse."><textarea rows={3} value={settings.customDescription || ''} onChange={event => update({ customDescription: event.target.value })} placeholder="Produktets beskrivelse" /></Field>
    </Section>
    <Section title="Billede og billedgalleri" description="Billeder af dette produkt" id="site-design-focus-products-featured-image">
      <div id="site-design-focus-products-featured-gallery"><Toggle label="Flere billeder af samme produkt" help="Dette skifter kun billedet. Hele produktbanneret skifter via produktlisten ovenfor." value={settings.galleryEnabled ?? false} onChange={galleryEnabled => update({ galleryEnabled })} /></div>
      {settings.galleryEnabled ? <>{galleryFields(settings.galleryImages || [], galleryImages => update({ galleryImages }), 8)}<Field label="Sekunder pr. billede"><input type="number" min={3} max={30} value={(settings.galleryIntervalMs || 6000) / 1000} onChange={event => update({ galleryIntervalMs: Math.max(3, Number(event.target.value) || 6) * 1000 })} /></Field></> : imageField('Produktbillede', settings.customImageUrl, customImageUrl => update({ customImageUrl }), 'Tomt felt bruger produktets eget billede.')}
      <Field label="Billedvisning"><select value={settings.imageMode || 'contain'} onChange={event => update({ imageMode: event.target.value === 'full' ? 'full' : 'contain' })}><option value="contain">Vis hele billedet</option><option value="full">Fyld billedrammen</option></select></Field>
      <Field label={`Billedstørrelse · ${settings.imageScalePct ?? 100}%`} help="Ændrer billedet inde i rammen. Tekst og knapper bliver stående."><input type="range" min={60} max={140} step={5} value={settings.imageScalePct ?? 100} onChange={event => update({ imageScalePct: Number(event.target.value) })} /></Field>
    </Section>
    <Section title="Farver og bestillingsknap" description="Hvert felt fortæller, hvad der ændres" id="site-design-focus-products-featured-colors">
      <p className="fp-note">Farverne gælder kun dette produktbanner. “Arv” følger shoppens farver igen.</p>
      <Color label="Bannerets baggrund" help="Fladen bag produkt, tekst og pris. Sidebanneret har sine egne farver." value={settings.backgroundColor} fallback={props.backgroundColor} onChange={backgroundColor => update({ backgroundColor })} />
      <Color label="Overskriftens farve" help="Produktnavnet eller den overskrift, du har skrevet ovenfor." value={settings.titleColor} fallback={props.titleColor} onChange={titleColor => update({ titleColor })} />
      <Color label="Beskrivelsens farve" help="Den korte produktbeskrivelse under overskriften." value={settings.descriptionColor} fallback={props.bodyColor} onChange={descriptionColor => update({ descriptionColor })} />
      <Color label="Prisens farve" help="Den store pris. Antalsknappernes priser følger deres valgte tilstand." value={settings.priceColor} fallback={primaryColor} onChange={priceColor => update({ priceColor })} />
      <Color label="Valgt antal" help="Baggrunden på den aktive antalsknap og markeringen af produktvalg." value={settings.selectionColor} fallback={primaryColor} onChange={selectionColor => update({ selectionColor })} />
      <Color label="Tekst på valgt antal" help="Antal og pris inde i den aktive antalsknap." value={settings.selectionTextColor} fallback="#ffffff" onChange={selectionTextColor => update({ selectionTextColor })} />
      <div id="site-design-focus-products-featured-cta" className="fp-subsection">
        <Field label="Knaptekst"><input value={settings.ctaLabel || ''} placeholder="Bestil nu" onChange={event => update({ ctaLabel: event.target.value })} /></Field>
        <Color label="Bestillingsknap" help="Knappens baggrund, når den ikke er aktiveret." value={settings.ctaColor} fallback={primaryColor} onChange={ctaColor => update({ ctaColor })} />
        <Color label="Knap ved hover og fokus" help="Baggrunden ved mus eller tastaturfokus. Den ses ikke som hover på en telefon." value={settings.ctaHoverColor} fallback={settings.ctaColor || primaryColor} onChange={ctaHoverColor => update({ ctaHoverColor })} />
        <Color label="Knappens tekst" help="Teksten på bestillingsknappen i begge tilstande." value={settings.ctaTextColor} fallback="#ffffff" onChange={ctaTextColor => update({ ctaTextColor })} />
        <Field label="Tekststørrelse på knap"><input type="number" min={12} max={28} value={settings.ctaFontSizePx ?? props.buttonFontSize} onChange={event => update({ ctaFontSizePx: Math.min(28, Math.max(12, Number(event.target.value) || 16)) })} /></Field>
        <Field label="Luft over og under knapteksten"><input type="number" min={8} max={24} value={settings.ctaPaddingYPx ?? props.buttonPadding} onChange={event => update({ ctaPaddingYPx: Math.min(24, Math.max(8, Number(event.target.value) || 12)) })} /></Field>
        <Field label="Runding på knap"><input type="range" min={0} max={32} value={settings.ctaBorderRadiusPx ?? 8} onChange={event => update({ ctaBorderRadiusPx: Number(event.target.value) })} /></Field>
      </div>
    </Section>
    <Section title="Sidebanner" description="Ekstra billede, billedgalleri eller produkt ved siden af" id="site-design-focus-products-featured-side-panel">
      <Toggle label="Vis sidebanner" value={side?.enabled ?? false} onChange={enabled => updateSide({ enabled })} />
      {side?.enabled && <>
        <Field label="Indhold i sidebanner"><select value={sideMode} onChange={event => {
          if (event.target.value === 'items') updateSide({ contentMode: 'items', items: side.items?.length ? side.items : [{ id: crypto.randomUUID(), mode: 'banner', imageUrl: side.imageUrl, title: side.title, subtitle: side.subtitle, ctaLabel: side.ctaLabel, ctaHref: side.ctaHref }] });
          else { const mode = event.target.value === 'product' ? 'product' : 'banner'; updateSide({ contentMode: mode, mode }); }
        }}><option value="banner">Billede eller billedgalleri</option><option value="product">Ekstra produkt</option><option value="items">Galleri med billeder og produkter</option></select></Field>
        {sideMode === 'items' ? <>{(side.items || []).map((item, index) => {
          const updateItem = (patch: Partial<FeaturedSidePanelItem>) => updateSide({ items: side.items!.map(current => current.id === item.id ? { ...current, ...patch } : current) });
          return <div className="fp-subsection" key={item.id}><strong>Sidebanner {index + 1}</strong><Field label="Type"><select value={item.mode} onChange={event => updateItem({ mode: event.target.value === 'product' ? 'product' : 'banner' })}><option value="banner">Billede</option><option value="product">Produkt</option></select></Field>{item.mode === 'product' ? <Field label="Sideprodukt"><select value={item.productId || ''} onChange={event => updateItem({ productId: event.target.value })}><option value="">Vælg produkt…</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></Field> : imageField('Sidegalleriets billede', item.imageUrl, imageUrl => updateItem({ imageUrl }))}<Field label="Titel"><input value={item.title || ''} onChange={event => updateItem({ title: event.target.value })} /></Field><Field label="Undertekst"><input value={item.subtitle || ''} onChange={event => updateItem({ subtitle: event.target.value })} /></Field><Field label="Knaptekst"><input value={item.ctaLabel || ''} onChange={event => updateItem({ ctaLabel: event.target.value })} /></Field><Field label="Link"><input value={item.ctaHref || ''} onChange={event => updateItem({ ctaHref: event.target.value })} /></Field><button type="button" onClick={() => updateSide({ items: side.items!.filter(current => current.id !== item.id) })}>Fjern sidebanner</button></div>;
        })}{(side.items?.length || 0) < 5 && <button type="button" onClick={() => updateSide({ items: [...(side.items || []), { id: crypto.randomUUID(), mode: 'banner' }] })}><Plus size={14} />Tilføj i sidegalleri</button>}</> : sideMode === 'product' ? <Field label="Sideprodukt"><select value={side.productId || ''} onChange={event => updateSide({ productId: event.target.value || undefined })}><option value="">Vælg produkt…</option>{products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></Field> : <>
          {imageField('Sidebannerets billede', side.imageUrl, imageUrl => updateSide({ imageUrl }), 'Billedet ved siden af produktet, ikke produktfotoet.')}
          <Section title="Flere billeder i sidebanneret" description="Bevarer samme tekst, mens billederne skifter" id={`${fieldId}-side-images`}>{galleryFields(sideImages, images => updateSide({ images, imageUrl: images[0] || null }), 5)}</Section>
          <Field label="Sidebannerets titel"><input value={side.title || ''} onChange={event => updateSide({ title: event.target.value })} /></Field>
          <Field label="Sidebannerets undertekst"><textarea rows={2} value={side.subtitle || ''} onChange={event => updateSide({ subtitle: event.target.value })} /></Field>
          <Field label="Sidebannerets knaptekst"><input value={side.ctaLabel || ''} onChange={event => updateSide({ ctaLabel: event.target.value })} /></Field>
          <Field label="Sidebannerets link"><input value={side.ctaHref || ''} onChange={event => updateSide({ ctaHref: event.target.value })} placeholder="/shop" /></Field>
        </>}
        {sideMode !== 'product' && <><Color label="Farvelag over sidebilledet" help="Laget gør tekst over billedet lettere at læse. Styrken vælges nedenfor." value={side.overlayColor} fallback="#000000" onChange={overlayColor => updateSide({ overlayColor })} />
        <Field label="Styrke på farvelag"><input type="range" min={0} max={1} step={0.05} value={side.overlayOpacity ?? 0.35} onChange={event => updateSide({ overlayOpacity: Number(event.target.value) })} /></Field>
        <Color label="Sidebannerets titelfarve" help="Titlen oven på sidebilledet." value={side.titleColor} fallback="#ffffff" onChange={titleColor => updateSide({ titleColor })} />
        <Color label="Sidebannerets tekstfarve" help="Den korte tekst under sidebannerets titel." value={side.subtitleColor} fallback="#ffffff" onChange={subtitleColor => updateSide({ subtitleColor })} /></>}
        <Color label="Sidebannerets knap" help="Baggrunden på sidebannerets linkknap." value={side.ctaColor} fallback={primaryColor} onChange={ctaColor => updateSide({ ctaColor })} />
        <Color label="Sideknap ved hover og fokus" help="Farven ved mus eller tastaturfokus." value={side.ctaHoverColor} fallback={side.ctaColor || primaryColor} onChange={ctaHoverColor => updateSide({ ctaHoverColor })} />
        <Color label="Sideknappens tekst" help="Teksten på sidebannerets knap." value={side.ctaTextColor} fallback="#ffffff" onChange={ctaTextColor => updateSide({ ctaTextColor })} />
        <Field label="Sekunder pr. sidebillede"><input type="number" min={3} max={30} value={(side.slideshowIntervalMs || 6000) / 1000} onChange={event => updateSide({ slideshowIntervalMs: Math.max(3, Number(event.target.value) || 6) * 1000 })} /></Field>
        <Toggle label="Vis forrige / næste på sidebilleder" value={side.showNavigationArrows ?? false} onChange={showNavigationArrows => updateSide({ showNavigationArrows })} />
        <Toggle label="Blød billedovergang" value={side.fadeTransition ?? true} onChange={fadeTransition => updateSide({ fadeTransition })} />
        <Section title="Sidebannerets detaljer" description="Størrelse, runding og overgange" id={`${fieldId}-side-details`}>
          <Field label="Sidebilledets størrelse"><input type="range" min={60} max={140} value={side.imageScalePct ?? 100} onChange={event => updateSide({ imageScalePct: Number(event.target.value) })} /></Field>
          <Field label="Sidebannerets højde"><input type="range" min={60} max={140} value={side.boxScalePct ?? 80} onChange={event => updateSide({ boxScalePct: Number(event.target.value) })} /></Field>
          <Field label="Sidebannerets runding"><input type="range" min={0} max={48} value={side.borderRadiusPx ?? 24} onChange={event => updateSide({ borderRadiusPx: Number(event.target.value) })} /></Field>
          <Field label="Overgang i millisekunder"><input type="number" min={150} max={1800} step={50} value={side.transitionDurationMs ?? 700} onChange={event => updateSide({ transitionDurationMs: Math.max(150, Math.min(1800, Number(event.target.value) || 700)) })} /></Field>
          {sideMode !== 'product' && <Field label="Tekstens overgang"><select value={side.textAnimation || 'none'} onChange={event => updateSide({ textAnimation: event.target.value as NonNullable<typeof side>['textAnimation'] })}><option value="none">Ingen</option><option value="fade">Blød indtoning</option><option value="slide-up">Ind fra neden</option><option value="slide-down">Ind fra oven</option><option value="scale">Zoom</option><option value="blur">Fra sløret til skarp</option><option value="reveal-up">Afdæk nedefra</option><option value="soft-mask">Blød afdækning</option><option value="stagger-rise">Forskudt indtoning</option><option value="cinematic">Filmisk</option></select></Field>}
        </Section>
      </>}
    </Section>
    <Section title="Produktvalg og visning" description="Produktets antal og prisvisning" id="site-design-focus-products-featured-basics">
      <Toggle label="Vis pris" value={settings.showPrice} onChange={showPrice => update({ showPrice })} />
      <Toggle label="Vis produktvalg" value={settings.showOptions} onChange={showOptions => update({ showOptions })} />
      {!props.printDesign && <Toggle label="Vis også i produktlisten" value={settings.showInProductList ?? false} onChange={showInProductList => update({ showInProductList })} />}
      {selectedProduct?.pricing_type === 'STORFORMAT' ? <p className="fp-note">Storformat viser produktets eksisterende mål, materialer og antal. Priser redigeres i produktet.</p> : <div className="fp-quantity-options"><strong>Viste antal</strong><small>Vælg op til otte af produktets eksisterende antal. Priserne ændres ikke.</small>{loadingQuantities ? <p>Henter antal…</p> : quantityError ? <p role="status">Antal kunne ikke hentes. De gemte valg er bevaret.</p> : quantities.length ? quantities.map(quantity => <label key={quantity}><input type="checkbox" checked={settings.quantityPresets?.includes(quantity) ?? false} disabled={!settings.quantityPresets?.includes(quantity) && (settings.quantityPresets?.length || 0) >= 8} onChange={event => update({ quantityPresets: event.target.checked ? [...(settings.quantityPresets || []), quantity].sort((a, b) => a - b) : settings.quantityPresets?.filter(value => value !== quantity) })} />{quantity.toLocaleString('da-DK')} stk.</label>) : <p>Vælg et produkt med offentliggjorte antal.</p>}</div>}

    </Section>
    {uploadError && <p className="fp-note" role="alert">{uploadError}</p>}
  </fieldset>;
}
