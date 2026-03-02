import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useCookieConsent } from '@/components/consent';

// Generate or get a persistent visitor ID
const VISITOR_ID_STORAGE_KEY = 'visitor_id';

const getVisitorId = (): string => {
    let visitorId = localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem(VISITOR_ID_STORAGE_KEY, visitorId);
    }
    return visitorId;
};

const clearVisitorId = () => {
    localStorage.removeItem(VISITOR_ID_STORAGE_KEY);
};

export function usePageTracking(enabled: boolean) {
    const location = useLocation();
    const lastTrackedPath = useRef<string | null>(null);
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    useEffect(() => {
        if (!enabled) {
            lastTrackedPath.current = null;
            clearVisitorId();
            return;
        }

        // Local development should not spam backend tracking endpoints.
        if (isLocalhost) {
            return;
        }

        // Don't track admin pages
        if (location.pathname.startsWith('/admin')) {
            return;
        }

        // Don't track the same page twice in a row
        if (lastTrackedPath.current === location.pathname) {
            return;
        }

        lastTrackedPath.current = location.pathname;

        const trackPageView = async () => {
            try {
                const visitorId = getVisitorId();

                await supabase.from('page_views' as any).insert({
                    page_path: location.pathname,
                    visitor_id: visitorId,
                    user_agent: navigator.userAgent,
                    referrer: document.referrer || null,
                });
            } catch (error) {
                // Silently fail - don't break the app for tracking errors
                console.debug('Page tracking error:', error);
            }
        };

        trackPageView();
    }, [enabled, location.pathname, isLocalhost]);
}

export function PageTracker() {
    const { hasCategory } = useCookieConsent();
    usePageTracking(hasCategory('statistics'));
    return null;
}
