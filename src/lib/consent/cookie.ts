/**
 * Cookie Utilities for Consent Management
 * 
 * Safe helpers for reading/writing cookies without external dependencies.
 */

export interface CookieOptions {
    path?: string;
    maxAge?: number;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    // Note: NO domain attribute - host-only cookies
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        const rawValue = parts.pop()?.split(';').shift() ?? null;
        if (rawValue) {
            try {
                return decodeURIComponent(rawValue);
            } catch {
                return rawValue;
            }
        }
    }
    return null;
}

/**
 * Set a cookie with options
 * Note: Does NOT set Domain attribute to ensure host-only cookie
 */
export function setCookie(name: string, value: string, options: CookieOptions = {}): void {
    const {
        path = '/',
        maxAge = 180 * 24 * 60 * 60, // 180 days default
        secure = window.location.protocol === 'https:',
        sameSite = 'Lax',
    } = options;

    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    cookie += `; Path=${path}`;
    cookie += `; Max-Age=${maxAge}`;
    cookie += `; SameSite=${sameSite}`;
    if (secure) {
        cookie += '; Secure';
    }
    // Explicitly NOT setting Domain attribute = host-only cookie

    document.cookie = cookie;
}

/**
 * Delete a cookie
 */
export function deleteCookie(name: string): void {
    setCookie(name, '', { maxAge: 0 });
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(str: string | null, fallback: T): T {
    if (!str) return fallback;
    try {
        return JSON.parse(str) as T;
    } catch {
        return fallback;
    }
}

/**
 * Safe JSON stringify
 */
export function safeJsonStringify(obj: unknown): string {
    try {
        return JSON.stringify(obj);
    } catch {
        return '';
    }
}
