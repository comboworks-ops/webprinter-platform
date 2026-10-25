import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isPvcbannerJourney } from './pvcbannerAppearanceScope';
import '@/styles/pvcbannerJourney.css';

/** Presentation only. Artwork, permissions, quotes and saved tenant settings are untouched. */
export function PvcbannerAppearance({ tenantId }: { tenantId?: string | null }) {
  const { pathname, search } = useLocation();
  const enabled = isPvcbannerJourney(window.location.hostname, pathname, search, tenantId);
  useLayoutEffect(() => {
    if (!enabled) return;
    document.body.setAttribute('data-pvcbanner-journey', 'signal');
    return () => document.body.removeAttribute('data-pvcbanner-journey');
  }, [enabled]);
  return null;
}
