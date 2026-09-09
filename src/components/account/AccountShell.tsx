import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ExternalLink, House, Image, Loader2, LogOut, MapPin, Menu, Package, Search, Settings, UserRound, X, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCustomerAccount, type CustomerProfile } from './CustomerAccountContext';
import '@/styles/customerAccount.css';
import { useHeaderFit } from '@/hooks/useHeaderFit';
import '@/styles/responsiveHeader.css';

export const ACCOUNT_NAVIGATION = [
  { href: '/min-konto', label: 'Oversigt', icon: House },
  { href: '/min-konto/ordrer', label: 'Mine ordrer', icon: Package },
  { href: '/min-konto/designs', label: 'Mine designs', icon: Image },
  { href: '/min-konto/adresser', label: 'Adresser', icon: MapPin },
  { href: '/min-konto/indstillinger', label: 'Indstillinger', icon: Settings },
];

interface CustomerHeaderShop {
  tenant_name?: string;
  branding?: {
    header?: { logoType?: string; logoImageUrl?: string; logoText?: string; logoTextColor?: string; logoFont?: string; bgColor?: string; textColor?: string };
    colors?: { primary?: string }; logo_url?: string; shop_name?: string;
  };
}
export function CustomerShopHeader({ shop, profile, email, link }: { shop?: CustomerHeaderShop | null; profile?: CustomerProfile | null; email?: string; link: (href: string) => string }) {
  const branding = shop?.branding || {};
  const header = branding.header || {};
  const logo = header.logoType === 'text' ? null : header.logoImageUrl || branding.logo_url;
  const name = header.logoText || branding.shop_name || shop?.tenant_name || 'Webprinter';
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const menuPanel = useRef<HTMLDivElement>(null);
  const fit = useHeaderFit();
  const location = useLocation();
  const navigate = useNavigate();
  const shopLinks = [
    { href: '/produkter', label: 'Produkter' },
    { href: '/grafisk-vejledning', label: 'Grafisk vejledning' },
    { href: '/kontakt', label: 'Kontakt' },
    { href: '/om-os', label: 'Om os' },
  ];
  useEffect(() => { setMenuOpen(false); }, [location.pathname, location.search]);
  useEffect(() => { if (!fit.compact) setMenuOpen(false); }, [fit.compact]);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); menuToggle.current?.focus(); }
    };
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuPanel.current?.contains(event.target) && !menuToggle.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    return () => { document.removeEventListener('keydown', closeOnEscape); document.removeEventListener('pointerdown', closeOutside); };
  }, [menuOpen]);
  const productSearch = () => <form className="customer-product-search" role="search" onSubmit={event => { event.preventDefault(); setMenuOpen(false); navigate(link(`/produkter?q=${encodeURIComponent(search.trim())}`)); }}><Search size={18} aria-hidden="true" /><input aria-label="Søg produkter" placeholder="Søg produkter…" value={search} onChange={event => setSearch(event.target.value)} /><button type="submit" aria-label="Søg i webshop"><ArrowRight size={16} /></button></form>;
  return <header ref={fit.rowRef} className="customer-shop-header responsive-header-row" data-header-mode={fit.compact ? 'compact' : 'desktop'} style={{ '--customer-header-bg': header.bgColor || branding.colors?.primary || '#087fc5', '--customer-header-ink': header.textColor || '#fff' } as CSSProperties}>
    <Link ref={fit.logoRef} className="customer-shop-logo responsive-header-logo" to={link('/')} aria-label={`${name} – til webshop`} style={{ color: header.logoTextColor || 'inherit', fontFamily: header.logoFont || 'inherit' }}>{logo ? <img src={logo} alt={name} /> : name}</Link>
    <nav ref={fit.navigationRef} className="customer-shop-links responsive-header-desktop responsive-header-navigation" aria-label="Webshop" aria-hidden={fit.compact || undefined}>{shopLinks.map(item => <Link key={item.href} to={link(item.href)}>{item.label}</Link>)}</nav>
    <div ref={fit.actionsRef} className="customer-shop-desktop-actions responsive-header-desktop responsive-header-actions" aria-hidden={fit.compact || undefined}>
      {productSearch()}
      <Link className="customer-back-shop" to={link('/')}>Til webshop <ExternalLink size={16} /></Link>
      <Link className="customer-header-user" to={link('/min-konto/indstillinger')} aria-label="Dine kontooplysninger"><UserRound size={24} aria-hidden="true" /><span>{profile?.first_name || (email ? 'Min konto' : 'Kundekonto')}{profile?.company && <small>{profile.company}</small>}</span></Link>
    </div>
    <div className="customer-shop-compact-actions responsive-header-compact">
      <Link className="customer-header-user" to={link('/min-konto/indstillinger')} aria-label="Dine kontooplysninger"><UserRound size={23} aria-hidden="true" /></Link>
      <button ref={menuToggle} type="button" data-header-toggle className="customer-shop-menu-toggle" aria-label={menuOpen ? 'Luk webshopmenu' : 'Åbn webshopmenu'} aria-expanded={menuOpen} aria-controls="customer-shop-navigation" onClick={() => setMenuOpen(open => !open)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
    </div>
    {fit.compact && menuOpen && <div ref={menuPanel} id="customer-shop-navigation" className="customer-shop-menu"><nav aria-label="Webshop">{shopLinks.map(item => <Link key={item.href} to={link(item.href)} onClick={() => setMenuOpen(false)}>{item.label}</Link>)}<Link to={link('/')} onClick={() => setMenuOpen(false)}>Til webshop <ExternalLink size={16} /></Link></nav>{productSearch()}</div>}
  </header>;
}

export interface AccountWorkspaceProps {
  title: string; description?: string; actions?: ReactNode; children: ReactNode;
  header: ReactNode; currentPath: string; link: (href: string) => string;
  onLogout?: () => void; signingOut?: boolean; logoutError?: string | null; style?: CSSProperties;
}
export function AccountWorkspace({ title, description, actions, children, header, currentPath, link, onLogout, signingOut, logoutError, style }: AccountWorkspaceProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div id="customer-account" className="customer-account" style={style} data-account-design="companion">
    <a className="customer-skip" href="#customer-main">Gå til indhold</a>{header}
    <div className="customer-account-layout">
      <aside className="customer-account-sidebar">
        <div className="customer-account-sidebar-heading"><Link to={link('/min-konto')}>Min konto</Link><button className="customer-menu-toggle" aria-expanded={menuOpen} aria-controls="customer-account-navigation" aria-label={menuOpen ? 'Luk kontomenu' : 'Åbn kontomenu'} onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X /> : <Menu />}</button></div>
        <nav id="customer-account-navigation" className={menuOpen ? 'is-open' : ''} aria-label="Min konto">{ACCOUNT_NAVIGATION.map(item => {
          const active = item.href === '/min-konto' ? currentPath === item.href : currentPath.startsWith(item.href) || (item.href.endsWith('/ordrer') && currentPath === '/mine-ordrer');
          return <Link key={item.href} to={link(item.href)} aria-current={active ? 'page' : undefined} onClick={() => setMenuOpen(false)}><item.icon size={21} aria-hidden="true" />{item.label}</Link>;
        })}</nav>
        {onLogout && <div className="customer-logout"><button onClick={onLogout} disabled={signingOut}>{signingOut ? <Loader2 size={20} className="animate-spin" /> : <LogOut size={20} />}Log ud</button>{logoutError && <p role="alert">{logoutError}</p>}</div>}
      </aside>
      <main id="customer-main" className="customer-account-main" tabIndex={-1}><div className="customer-page-heading"><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="customer-page-actions">{actions}</div>}</div>{children}</main>
    </div>
  </div>;
}

export function AccountShell({ title, description, actions, children }: {title: string; description?: string; actions?: ReactNode; children: ReactNode}) {
  const account = useCustomerAccount();
  const location = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true); setLogoutError(null);
    try { const { error } = await supabase.auth.signOut(); if (error) throw error; navigate(account.link('/'), {replace: true}); }
    catch { setLogoutError('Kunne ikke logge ud. Prøv igen.'); } finally { setSigningOut(false); }
  };
  const primary = account.shop?.branding?.colors?.primary || '#087fc5';
  return <AccountWorkspace title={title} description={description} actions={actions} currentPath={location.pathname} link={account.link} onLogout={account.user ? signOut : undefined} signingOut={signingOut} logoutError={logoutError}
    style={{ '--customer-blue': primary, '--customer-font': account.shop?.branding?.fonts?.body || 'Inter' } as CSSProperties}
    header={<CustomerShopHeader shop={account.shop} profile={account.profile} email={account.user?.email} link={account.link} />}>{children}</AccountWorkspace>;
}

export function AccountState({ kind, title, description, onRetry, children }: {kind: 'loading'|'error'|'empty'; title?: string; description?: string; onRetry?: () => void; children?: ReactNode}) {
  return <div className={`customer-state customer-state-${kind}`} role={kind === 'error' ? 'alert' : 'status'} aria-live="polite">
    {kind === 'loading' ? <Loader2 size={26} className="animate-spin" aria-hidden="true" /> : kind === 'error' ? <AlertCircle size={28} aria-hidden="true" /> : <Package size={30} aria-hidden="true" />}
    <h2>{title || (kind === 'loading' ? 'Indlæser…' : kind === 'error' ? 'Vi kunne ikke hente oplysningerne' : 'Der er ikke noget her endnu')}</h2>{description && <p>{description}</p>}{onRetry && <button className="customer-button" onClick={onRetry}>Prøv igen</button>}{children}
  </div>;
}
