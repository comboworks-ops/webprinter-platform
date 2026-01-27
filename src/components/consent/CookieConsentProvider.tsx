/**
 * Cookie Consent Provider
 * 
 * Provides consent state and functions via React Context.
 * Stores consent in a host-only cookie (wp_consent_v1).
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getCookie, setCookie, safeJsonParse, safeJsonStringify } from '@/lib/consent/cookie';

// Cookie name and version
const CONSENT_COOKIE_NAME = 'wp_consent_v1';

// Consent categories
export interface ConsentCategories {
    necessary: true; // Always true, cannot be disabled
    preferences: boolean;
    statistics: boolean;
    marketing: boolean;
}

// Full consent state
export interface ConsentState extends ConsentCategories {
    v: 1;
    updatedAt: string;
}

// Context value
interface CookieConsentContextValue {
    consent: ConsentState | null;
    isBannerVisible: boolean;
    isSettingsOpen: boolean;
    hasConsented: boolean;
    acceptAll: () => void;
    rejectAll: () => void;
    setCategories: (categories: Omit<ConsentCategories, 'necessary'>) => void;
    openSettings: () => void;
    closeSettings: () => void;
    hasCategory: (category: keyof ConsentCategories) => boolean;
}

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

/**
 * Hook to access consent context
 */
export function useCookieConsent(): CookieConsentContextValue {
    const context = useContext(CookieConsentContext);
    if (!context) {
        throw new Error('useCookieConsent must be used within CookieConsentProvider');
    }
    return context;
}

interface CookieConsentProviderProps {
    children: ReactNode;
}

/**
 * Cookie Consent Provider Component
 */
export function CookieConsentProvider({ children }: CookieConsentProviderProps) {
    const [consent, setConsent] = useState<ConsentState | null>(null);
    const [isBannerVisible, setIsBannerVisible] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    // Read consent from cookie on mount
    useEffect(() => {
        const cookieValue = getCookie(CONSENT_COOKIE_NAME);
        const parsed = safeJsonParse<ConsentState | null>(cookieValue, null);

        if (parsed && parsed.v === 1) {
            setConsent(parsed);
            setIsBannerVisible(false);
        } else {
            setConsent(null);
            setIsBannerVisible(true);
        }
        setIsInitialized(true);
    }, []);

    // Save consent to cookie
    const saveConsent = useCallback((newConsent: ConsentState) => {
        setCookie(CONSENT_COOKIE_NAME, safeJsonStringify(newConsent));
        setConsent(newConsent);
        setIsBannerVisible(false);
        setIsSettingsOpen(false);
    }, []);

    // Accept all categories
    const acceptAll = useCallback(() => {
        const newConsent: ConsentState = {
            v: 1,
            necessary: true,
            preferences: true,
            statistics: true,
            marketing: true,
            updatedAt: new Date().toISOString(),
        };
        saveConsent(newConsent);
    }, [saveConsent]);

    // Reject all non-essential categories
    const rejectAll = useCallback(() => {
        const newConsent: ConsentState = {
            v: 1,
            necessary: true,
            preferences: false,
            statistics: false,
            marketing: false,
            updatedAt: new Date().toISOString(),
        };
        saveConsent(newConsent);
    }, [saveConsent]);

    // Set specific categories
    const setCategories = useCallback((categories: Omit<ConsentCategories, 'necessary'>) => {
        const newConsent: ConsentState = {
            v: 1,
            necessary: true,
            preferences: categories.preferences,
            statistics: categories.statistics,
            marketing: categories.marketing,
            updatedAt: new Date().toISOString(),
        };
        saveConsent(newConsent);
    }, [saveConsent]);

    // Open settings dialog
    const openSettings = useCallback(() => {
        setIsSettingsOpen(true);
    }, []);

    // Close settings dialog
    const closeSettings = useCallback(() => {
        setIsSettingsOpen(false);
    }, []);

    // Check if a category is consented
    const hasCategory = useCallback((category: keyof ConsentCategories): boolean => {
        if (category === 'necessary') return true;
        return consent?.[category] ?? false;
    }, [consent]);

    const hasConsented = consent !== null;

    const value: CookieConsentContextValue = {
        consent,
        isBannerVisible: isInitialized && isBannerVisible,
        isSettingsOpen,
        hasConsented,
        acceptAll,
        rejectAll,
        setCategories,
        openSettings,
        closeSettings,
        hasCategory,
    };

    return (
        <CookieConsentContext.Provider value={value}>
            {children}
        </CookieConsentContext.Provider>
    );
}
