import { Link } from 'react-router-dom';
import { ArrowRight, Film } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { OrganizationSchema } from '@/components/ProductSchema';
import { useCookieConsent } from '@/components/consent';
import { platformNavLink } from '@/lib/platform/context';
import { LandingHeader } from '@/components/platform/landing/LandingHeader';
import { landingDemoHref } from '@/components/platform/landing/landingLinks';
import { PlatformSlider } from '@/components/platform/PlatformSlider';
import { LandingCapabilities } from '@/components/platform/landing/LandingCapabilities';
import '@/components/platform/landing/landing.css';

/** Platform marketing only. Shop branding and transaction flows remain independent. */
export default function Index() {
  const { openSettings } = useCookieConsent();
  const demoHref = landingDemoHref();
  return (
    <div className="wp-landing">
      <SEO title="Webprinter — et moderne printsystem til dit trykkeri" description="Saml webshop, prisberegning, online design og ordrer i Webprinter. En printplatform under løbende udvikling, bygget til trykkeriets hverdag." /><OrganizationSchema />
      <a className="wp-skip" href="#landing-main">Gå til indhold</a>
      <LandingHeader />
      <main id="landing-main">
        <section className="wp-simple-hero wp-container" aria-labelledby="landing-title">
          <div className="wp-hero-copy">
            <p className="wp-eyebrow">Webprinter · platform til trykkerier</p>
            <h1 id="landing-title">En ny hjemmeside.<br /><span>Et samlet printsystem.</span></h1>
            <p className="wp-lead">Skift den gamle hjemmeside ud med en moderne platform til webshop, prisberegning, design og ordrer. Et fælles fundament, du kan bygge videre på.</p>
            <div className="wp-actions">
              <Link className="wp-button" to={demoHref}>Prøv webshoppen <ArrowRight size={17} aria-hidden="true" /></Link>
              <a className="wp-button wp-button-secondary" href="#systemet">Udforsk systemet</a>
            </div>
          </div>
        </section>
        <div className="wp-product-strip wp-container"><PlatformSlider /></div>
        <section className="wp-system-section" id="systemet" aria-labelledby="system-title">
          <div className="wp-container">
            <div className="wp-section-heading"><h2 id="system-title">Mere end en ny hjemmeside.</h2><p>Værktøjerne til både dine kunder og dit trykkeri.</p></div>
            <div className="wp-system-grid">
              <LandingCapabilities />
              <aside className="wp-system-video" id="system-video" aria-labelledby="video-title">
                <div className="wp-video-poster">
                  <img src="/platform/landing/storefront.webp" width="1440" height="1008" loading="lazy" alt="Et kig på Webprinters webshop og prisberegner" />
                  <span className="wp-video-status"><Film size={16} aria-hidden="true" /> Videogennemgang på vej</span>
                </div>
                <div className="wp-video-copy">
                  <h3 id="video-title">Se Webprinter i brug.</h3>
                  <p>Her kommer en film, der viser systemet fra kundens første valg til dit ordreoverblik. Du kan allerede gå på opdagelse i webshoppen.</p>
                  <Link className="wp-text-link" to={demoHref}>Åbn demoen <ArrowRight size={16} aria-hidden="true" /></Link>
                </div>
              </aside>
            </div>
          </div>
        </section>
        <section className="wp-evolving" id="udvikling" aria-labelledby="evolving-title">
          <div className="wp-container wp-evolving-grid">
            <div><p className="wp-eyebrow">Bygget til en hverdag med AI</p><h2 id="evolving-title">Du behøver ikke<br />starte fra bunden.</h2></div>
            <div className="wp-evolving-copy">
              <p>AI ændrer måden, vi søger, designer og arbejder på. Derfor udvikler vi Webprinter løbende, med mennesker og trykkeriets hverdag som udgangspunkt.</p>
              <p>Du får et fælles produkt at bygge videre på, frem for et nyt projekt fra bunden. Platformen kan udvikle sig med teknologien, så nye muligheder kan blive en del af din hverdag, når de giver mening.</p>
              <Link className="wp-text-link" to={platformNavLink('/kontakt')}>Tal med os om dit næste skridt <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="wp-footer">
        <div className="wp-container wp-footer-top">
          <Link className="wp-wordmark" to={platformNavLink('/')}>Webprinter.dk</Link>
          <nav aria-label="Platform og kontakt"><Link to={platformNavLink('/white-label')}>Webshop</Link><Link to={platformNavLink('/beregning')}>Prisberegning</Link><Link to={platformNavLink('/priser')}>Priser</Link><Link to={platformNavLink('/kontakt')}>Kontakt</Link><a href="mailto:info@webprinter.dk">info@webprinter.dk</a></nav>
        </div>
        <div className="wp-container wp-footer-bottom">
          <span>© {new Date().getFullYear()} Webprinter.dk</span>
          <nav aria-label="Vilkår og privatliv"><Link to={platformNavLink('/privacy-policy')}>Privatliv</Link><Link to={platformNavLink('/handelsbetingelser')}>Platformvilkår</Link><button type="button" onClick={openSettings}>Cookieindstillinger</button></nav>
        </div>
      </footer>
    </div>
  );
}
