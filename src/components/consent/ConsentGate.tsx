/**
 * Consent Gate Component
 * 
 * Only renders children when the specified consent category is granted.
 * Use this to gate analytics/marketing scripts.
 */

import { type ReactNode } from 'react';
import { useCookieConsent, type ConsentCategories } from './CookieConsentProvider';

interface ConsentGateProps {
    category: keyof Omit<ConsentCategories, 'necessary'>;
    children: ReactNode;
    fallback?: ReactNode;
}

/**
 * Renders children only when consent is granted for the specified category.
 * 
 * @example
 * <ConsentGate category="statistics">
 *   <GoogleAnalytics />
 * </ConsentGate>
 */
export function ConsentGate({ category, children, fallback = null }: ConsentGateProps) {
    const { hasCategory } = useCookieConsent();

    if (!hasCategory(category)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}
