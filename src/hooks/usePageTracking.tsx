import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// Generate or get a persistent visitor ID
const getVisitorId = (): string => {
    let visitorId = localStorage.getItem('visitor_id');
    if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem('visitor_id', visitorId);
    }
    return visitorId;
};

export function usePageTracking() {
    const location = useLocation();
    const lastTrackedPath = useRef<string | null>(null);

    useEffect(() => {
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
    }, [location.pathname]);
}

export function PageTracker() {
    usePageTracking();
    return null;
}
