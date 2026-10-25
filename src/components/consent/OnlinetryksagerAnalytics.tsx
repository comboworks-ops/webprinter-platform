import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useCookieConsent } from './CookieConsentProvider';
import { createOnlinetryksagerAnalytics } from '@/lib/analytics/onlinetryksager';
import { IS_ISOLATED_PREVIEW } from '@/lib/isolatedPreview';

export function OnlinetryksagerAnalytics() {
  const { hasCategory } = useCookieConsent();
  const { pathname } = useLocation();
  const statistics = hasCategory('statistics') === true;
  const tracker = useRef<ReturnType<typeof createOnlinetryksagerAnalytics> | null>(null);

  useEffect(() => {
    if (IS_ISOLATED_PREVIEW) return;
    const instance = createOnlinetryksagerAnalytics(window, document);
    tracker.current = instance;
    return () => { instance.destroy(); tracker.current = null; };
  }, []);

  useEffect(() => { tracker.current?.update(statistics, pathname); }, [statistics, pathname]);
  return null;
}
