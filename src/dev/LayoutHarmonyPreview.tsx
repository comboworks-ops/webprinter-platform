/** Local typography and menu stress review. Account examples stay in memory. */
import { useMemo, useState, type CSSProperties } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { ArrowRight } from 'lucide-react';
import Header from '@/components/Header';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { mergeBrandingWithDefaults } from '@/hooks/useBrandingDraft';
import { AccountWorkspace, CustomerShopHeader } from '@/components/account/AccountShell';
import { CustomerOverviewView, type CustomerOverviewOrder } from '@/components/account/CustomerOverviewView';
import '@/index.css';
import '@/themes/print/print.css';

const fixturePath = '/output/layout-harmony-2026-09-08/index.html';
const masterTenant = '00000000-0000-0000-0000-000000000000';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

export function LayoutHarmonyPreview() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'account' ? 'account' : 'storefront';
  const longLabels = params.get('labels') === 'long';
  const popoverSearch = params.get('search') === 'popover';
  const [notice, setNotice] = useState('');
  const name = longLabels ? 'Alexandrine-Christiane' : 'Anna';
  const company = longLabels ? 'Skandinavisk Kommunikationsdesign og Specialtrykkeri A/S' : 'Studio Nord';
  const email = longLabels ? 'alexandrine.christiane.kundeservice@eksempelkommunikationsbureau.test' : 'anna@example.test';
  const shopName = longLabels ? 'SkandinaviskSpecialtrykkeri' : 'webprinter';
  const branding = useMemo(() => mergeBrandingWithDefaults({
    ...(popoverSearch ? { themeId: 'print-nordic' } : {}),
    fonts: { body: 'Inter', heading: 'Inter', pricing: 'Inter' },
    header: {
      logoType: 'text', logoText: longLabels ? 'SkandinaviskSpecialtrykkeri' : 'webprinter',
      logoFont: 'Inter', logoTextColor: '#ffffff', logoLink: fixturePath,
      bgColor: '#087fc5', bgOpacity: 1, textColor: '#ffffff', fontId: 'Inter',
      height: 'md', alignment: longLabels ? 'center' : 'left',
      menuFontSizePx: longLabels ? 22 : 16, transparentOverHero: false,
      scroll: { sticky: true, hideOnScroll: false, fadeOnScroll: false },
      navItems: [
        { id: 'home', label: longLabels ? 'Velkommen til trykkeriet' : 'Forside', href: `${fixturePath}?view=storefront`, isVisible: true, order: 0 },
        { id: 'products', label: longLabels ? 'Produkter og specialproduktion' : 'Produkter', href: '/produkter', isVisible: true, order: 1 },
        { id: 'grafisk', label: longLabels ? 'Grafisk vejledning og trykfiler' : 'Grafisk vejledning', href: '/grafisk-vejledning', isVisible: true, order: 2 },
        { id: 'contact', label: longLabels ? 'Kontakt vores kundeservice' : 'Kontakt', href: '/kontakt', isVisible: true, order: 3 },
        { id: 'about', label: longLabels ? 'Om vores trykkeri og medarbejdere' : 'Om os', href: '/om-os', isVisible: true, order: 4 },
      ],
    },
  }), [longLabels, popoverSearch]);
  const orders: CustomerOverviewOrder[] = [
    { id: 'local-1048', order_number: 'WP-1048', product_name: longLabels ? 'Produktpræsentationsbrochurer med specialbeskæring og ekstra lange produktbeskrivelser' : 'Brochurer A4', quantity: 250, status: 'pending', requires_file_reupload: true, created_at: '2026-09-07T12:00:00Z' },
    { id: 'local-1042', order_number: 'WP-1042', product_name: longLabels ? 'SpecialfremstilledeKommunikationsmaterialerTilEfterårskampagnen2026' : 'Visitkort', quantity: 500, status: 'production', unread_count: 2, created_at: '2026-09-05T10:00:00Z' },
    { id: 'local-1021', order_number: 'WP-1021', product_name: longLabels ? 'Informationsplakater til den landsdækkende efterårskampagne' : 'Plakater A3', quantity: 100, status: 'delivered', created_at: '2026-09-01T09:00:00Z' },
  ];
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    setParams(next);
  };
  const localLink = (href: string) => {
    const query = new URLSearchParams({ view: href.startsWith('/min-konto') || href.startsWith('/company') ? 'account' : 'storefront', labels: longLabels ? 'long' : 'standard' });
    if (popoverSearch) query.set('search', 'popover');
    return `${fixturePath}?${query}`;
  };

  return <div data-layout-harmony-preview data-preview-view={view} data-preview-labels={longLabels ? 'long' : 'standard'} data-preview-search={popoverSearch ? 'popover' : 'persistent'}>
    <style>{`
      .harmony-review-controls { position:relative; z-index:10; padding:16px max(20px,calc((100vw - 1408px)/2)); border-bottom:1px solid #d4dfeb; background:#f2f7fc; color:#18334e; font:14px/1.5 Inter,system-ui,sans-serif; }
      .harmony-review-controls > div { display:flex; align-items:center; flex-wrap:wrap; gap:12px 24px; }
      .harmony-review-controls strong { font-size:14px; }
      .harmony-review-controls label { display:inline-flex; flex-wrap:wrap; align-items:center; gap:8px; }
      .harmony-review-controls select { min-height:40px; padding:8px 12px; border:1px solid #bdcfe0; border-radius:5px; background:white; color:#18334e; font:inherit; }
      .harmony-review-controls p { margin:10px 0 0; max-width:80ch; }
      .harmony-storefront-content { padding-top:96px; }
      .harmony-type-examples { padding-block:32px 64px; }
      .harmony-type-examples > section { padding-block:24px; border-top:1px solid #dfe5ed; }
      .harmony-type-examples h2 { font-size:24px; line-height:1.25; margin-bottom:12px; }
      .harmony-type-examples p { max-width:68ch; line-height:1.6; }
      .harmony-type-examples .print-primary { margin-top:20px; }
    `}</style>
    {view === 'storefront' && <Header brandingOverride={branding} />}
    <div className={view === 'storefront' ? 'harmony-storefront-content' : undefined}>
      <aside className="harmony-review-controls" aria-label="Lokal typografi- og menutest">
        <div><strong>Lokal typografi- og menutest · eksempeldata</strong>
          <label>Visning <select aria-label="Visning" value={view} onChange={event => update('view', event.target.value)}><option value="storefront">Webshop</option><option value="account">Kundekonto</option></select></label>
          <label>Indhold <select aria-label="Indhold" value={longLabels ? 'long' : 'standard'} onChange={event => update('labels', event.target.value)}><option value="standard">Standard</option><option value="long">Lange navne og menupunkter</option></select></label>
          {view === 'storefront' && <label>Søgning <select aria-label="Søgning" value={popoverSearch ? 'popover' : 'persistent'} onChange={event => update('search', event.target.value)}><option value="persistent">Fast søgefelt</option><option value="popover">Udvideligt søgefelt</option></select></label>}
        </div>
        <p>{longLabels ? 'Webshopmenu: 22 px, centreret og med lange tekster. Kundekonto: lange kunde-, produkt- og virksomhedsnavne.' : 'Standardtekster og samme visningskomponenter som i systemet.'} Kontoeksemplerne gemmes ikke. Webshopheaderens links åbner systemets almindelige sider.</p>
        {notice && <p role="status">{notice}</p>}
      </aside>
      {view === 'account' ? <AccountWorkspace
        title={`Goddag, ${name}`}
        description="Her finder du dine bestillinger, beskeder og oplysninger. Det vigtigste næste skridt skal være let at se, også når navnene er lange."
        currentPath="/min-konto" link={localLink}
        onLogout={() => setNotice('Dette er eksempeldata. Ingen konto er blevet logget ud.')}
        actions={<Link className="customer-button" to={localLink('/produkter')}>Ny bestilling <ArrowRight size={18} aria-hidden="true" /></Link>}
        style={{ '--customer-blue': '#087fc5', '--customer-font': 'Inter' } as CSSProperties}
        header={<CustomerShopHeader shop={{ tenant_name: shopName, branding: { header: { logoType: 'text', logoText: shopName, logoFont: 'Inter', logoTextColor: '#fff', bgColor: '#087fc5', textColor: '#fff' } } }} profile={{ first_name: name, last_name: longLabels ? 'Christiansen-Sørensen' : 'Sørensen', company, phone: '' }} email={email} link={localLink} />}>
        <CustomerOverviewView orders={orders} ordersState="ready" link={localLink}
          contact={{ name: `${name} ${longLabels ? 'Christiansen-Sørensen' : 'Sørensen'}`, email, company }}
          defaultAddress={{ first_name: name, last_name: 'Christiansen-Sørensen', street_address: longLabels ? 'Kommunikationscentrets Internationale Forbindelsesvej 123' : 'Eksempelvej 12', street_address_2: longLabels ? 'Bygning B, tredje sal, afdeling for grafisk kommunikation' : undefined, postal_code: '5000', city: 'Odense C' }}
          companyLinks={[{ id: 'local-company', name: company, href: localLink('/company') }]} />
      </AccountWorkspace> : <main className="print-shop" data-print-design="print-familiar">
        <div className="print-container harmony-type-examples">
          <div className="print-catalog-heading"><div><h1>{longLabels ? 'Tryksager til gode idéer og store kommunikationsopgaver' : 'Tryksager til dine idéer'}</h1><p>Rolig typografi, plads mellem indholdet og en menu, der tilpasser sig den plads, den faktisk har.</p></div></div>
          <section><h2>{longLabels ? 'Brochurer, præsentationer og materialer til din næste kampagne' : 'Find det rette tryk'}</h2><p>Den samme tekst skal være rar at læse på en bred skærm, en tablet og en telefon. Overskrifter må gerne skifte linje naturligt. Menupunkter skal blive på én linje, indtil den samlede navigation skifter til menu.</p><Link className="print-primary" to={`${fixturePath}?view=account&labels=${longLabels ? 'long' : 'standard'}`}>Se kundekontoen <ArrowRight size={18} aria-hidden="true" /></Link></section>
          <section><h2>Gennemgå i flere bredder</h2><p>Prøv 320, 390, 768, 1024, 1280, 1488 og 1800 pixels. Skift indhold uden at genindlæse for også at kontrollere, at menuen genberegner sin plads.</p><Link className="print-browse-all" to={`/?tenantId=${masterTenant}`}>Åbn den almindelige webshop <ArrowRight size={16} aria-hidden="true" /></Link></section>
        </div>
      </main>}
    </div>
  </div>;
}

if (import.meta.env.DEV) {
  const root = import.meta.hot?.data.root || createRoot(document.getElementById('root')!);
  if (import.meta.hot) import.meta.hot.data.root = root;
  root.render(<HelmetProvider><QueryClientProvider client={queryClient}><LanguageProvider><TooltipProvider><BrowserRouter><LayoutHarmonyPreview /></BrowserRouter></TooltipProvider></LanguageProvider></QueryClientProvider></HelmetProvider>);
}
