/** This public measurement ID belongs only to the two Onlinetryksager hosts. */
export const MEASUREMENT_ID = 'G-BKKZ1Q3ECQ';
const DISABLE_KEY = `ga-disable-${MEASUREMENT_ID}`;
const SCRIPT_ID = 'onlinetryksager-google-analytics';
const PUBLIC_PATHS = new Set(['/', '/shop', '/produkter', '/prisberegner', '/kontakt', '/om-os', '/grafisk-vejledning', '/betingelser', '/vilkaar', '/privatliv', '/cookiepolitik', '/cookies']);
const DENIED = { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  'ga-disable-G-BKKZ1Q3ECQ'?: boolean;
};

export function isOnlinetryksagerHost(hostname: string): boolean {
  return hostname === 'onlinetryksager.dk' || hostname === 'www.onlinetryksager.dk';
}

export function publicAnalyticsPath(pathname: string): string | null {
  if (PUBLIC_PATHS.has(pathname)) return pathname;
  return /^\/produkt\/[a-zA-Z0-9_-]{1,160}\/?$/.test(pathname) ? pathname : null;
}

/** Basic consent mode: no Google request until the existing statistics consent. */
export function createOnlinetryksagerAnalytics(window: Window, document: Document) {
  const win = window as AnalyticsWindow;
  const eligibleHost = isOnlinetryksagerHost(win.location.hostname) && win.location.protocol === 'https:';
  let script: HTMLScriptElement | null = null;
  let ready = false;
  let enabled = false;
  let configured = false;
  let pendingPath: string | null = null;
  let lastPath: string | null = null;
  let previousLocation = '';

  const removeCookies = () => {
    for (const name of ['_ga', '_ga_BKKZ1Q3ECQ']) {
      document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
    }
  };

  const sendPage = () => {
    if (!enabled || !ready || !pendingPath || !win.gtag || pendingPath === lastPath) return;
    const location = win.location.origin + pendingPath;
    let referrer = previousLocation;
    if (!referrer && document.referrer) {
      try { referrer = new URL(document.referrer).origin + '/'; } catch { /* Ignore invalid referrers. */ }
    }
    const page = { page_location: location, page_title: 'Onlinetryksager.dk', page_referrer: referrer };
    win.gtag('consent', 'update', { ...DENIED, analytics_storage: 'granted' });
    if (!configured) {
      win.gtag('config', MEASUREMENT_ID, {
        ...page, send_page_view: false, allow_google_signals: false,
        allow_ad_personalization_signals: false, cookie_domain: 'none', cookie_expires: 15552000,
      });
      configured = true;
    }
    // Sanitize defaults as well as page_view, including later automatic session events.
    win.gtag('set', page);
    win.gtag('event', 'page_view', { ...page, send_to: MEASUREMENT_ID });
    lastPath = pendingPath;
    previousLocation = location;
  };

  const stop = (clearCookies: boolean) => {
    if (!eligibleHost) return;
    enabled = false;
    win[DISABLE_KEY] = true;
    pendingPath = null;
    lastPath = null;
    previousLocation = '';
    // Do not issue a denied-consent ping: the opt-out flag stops further collection.
    if (!ready && script) {
      script.onload = null;
      script.onerror = null;
      script.remove();
      script = null;
    }
    if (clearCookies) removeCookies();
  };

  return {
    update(statisticsConsent: boolean, pathname: string) {
      if (!eligibleHost) return;
      const path = publicAnalyticsPath(pathname);
      if (statisticsConsent !== true || !path) { stop(statisticsConsent !== true); return; }
      enabled = true;
      win[DISABLE_KEY] = false;
      pendingPath = path;
      if (ready) { sendPage(); return; }
      if (script) return;
      win.dataLayer = win.dataLayer || [];
      win.gtag = win.gtag || function (..._commands: unknown[]) {
        // Google's documented command queue uses IArguments rather than a rest array.
        // eslint-disable-next-line prefer-rest-params
        win.dataLayer!.push(arguments);
      };
      win.gtag('consent', 'default', DENIED);
      win.gtag('js', new Date());
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
      script.onload = () => { ready = true; sendPage(); };
      script.onerror = () => { stop(false); };
      document.head.appendChild(script);
    },
    destroy() { stop(false); },
  };
}
