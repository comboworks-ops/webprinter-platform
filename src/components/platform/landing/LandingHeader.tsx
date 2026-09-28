import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { landingDemoHref } from './landingLinks';
import { platformNavLink } from '@/lib/platform/context';
import { useHeaderFit } from '@/hooks/useHeaderFit';
import '@/styles/responsiveHeader.css';

export function LandingHeader() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const location = useLocation();
  const fit = useHeaderFit();
  useEffect(() => { setOpen(false); }, [location.pathname, location.search]);
  useEffect(() => { if (!fit.compact) setOpen(false); }, [fit.compact]);
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); toggle.current?.focus(); }
    };
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !toggle.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', closeOutside);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', closeOutside); };
  }, [open]);
  const navigation = <><a href="#systemet">Systemet</a><a href="#system-video">Se systemet</a><a href="#udvikling">Platform i udvikling</a><Link to={platformNavLink('/kontakt')}>Kontakt</Link><Link to={platformNavLink('/admin/login')}>Log ind</Link></>;
  return (
    <header className="wp-header" data-header-mode={fit.compact ? 'compact' : 'desktop'}>
      <div ref={fit.rowRef} className="wp-container wp-header-inner responsive-header-row">
        <Link ref={fit.logoRef} className="wp-wordmark responsive-header-logo" to={platformNavLink('/')} aria-label="Webprinter.dk forside">Webprinter.dk</Link>
        <nav ref={fit.navigationRef} className="wp-desktop-nav responsive-header-desktop responsive-header-navigation" aria-label="Hovednavigation" aria-hidden={fit.compact || undefined}>{navigation}</nav>
        <div ref={fit.actionsRef} className="wp-header-actions responsive-header-desktop responsive-header-actions" aria-hidden={fit.compact || undefined}>
          <Link className="wp-button wp-button-small" to={landingDemoHref()}>Se demo</Link>
        </div>
        <div className="responsive-header-compact">
          <button ref={toggle} data-header-toggle className="wp-menu-toggle" type="button" aria-label={open ? 'Luk menu' : 'Åbn menu'} aria-controls="landing-compact-navigation" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
      </div>
      {fit.compact && open && <nav ref={panel} id="landing-compact-navigation" className="wp-compact-nav" aria-label="Hovednavigation" onClick={() => setOpen(false)}>{navigation}<Link className="wp-button wp-button-small" to={landingDemoHref()}>Se demo</Link></nav>}
    </header>
  );
}
