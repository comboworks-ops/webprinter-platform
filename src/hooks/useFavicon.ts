/**
 * useFavicon Hook
 * 
 * Dynamically updates the browser tab favicon based on branding settings.
 * Supports both preset icons (rendered as SVG) and custom uploaded images.
 */

import { useEffect, useCallback } from 'react';
import type { BrandingData } from '@/hooks/useBrandingDraft';

// Icon SVG paths for favicons (simplified versions for 32x32)
const FAVICON_SVG_PATHS: Record<string, string> = {
    'default': 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
    'store': 'M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z',
    'printer': 'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z',
    'shopping-bag': 'M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z',
    'shopping-cart': 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
    'package': 'M20 3H4c-1.11 0-2 .89-2 2v14c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 16H4v-5h16v5zm0-7H4V5h16v7z',
    'box': 'M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 18.5l-6.5-6.5h4.5V10h4v2h4.5l-6.5 6.5zM5.12 5l.81-1h12l.94 1H5.12z',
    'sparkles': 'M12 3L10.5 7.5 6 9l4.5 1.5L12 15l1.5-4.5L18 9l-4.5-1.5L12 3zm-4 12l-.75 2.25L5 18l2.25.75L8 21l.75-2.25L11 18l-2.25-.75L8 15zm10-4l-.75 2.25L15 14l2.25.75L18 17l.75-2.25L21 14l-2.25-.75L18 11z',
    'star': 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
    'palette': 'M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z',
    'heart': 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    'zap': 'M7 2v11h3v9l7-12h-4l4-8z',
};

/**
 * Creates a favicon SVG data URL from a preset icon and color
 */
function createPresetFavicon(presetId: string, color: string): string {
    const path = FAVICON_SVG_PATHS[presetId] || FAVICON_SVG_PATHS['default'];

    // SVG with transparent background (no fill rect)
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
            <path d="${path}" fill="${color}"/>
        </svg>
    `.trim();

    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Updates the favicon in the document head
 */
function updateFavicon(href: string): void {
    // Remove existing favicon links
    const existingIcons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
    existingIcons.forEach(icon => icon.remove());

    // Create new favicon link
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = href.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/x-icon';
    link.href = href;

    document.head.appendChild(link);
}

/**
 * Hook to apply favicon from branding data
 */
export function useFavicon(branding: BrandingData | null): void {
    useEffect(() => {
        if (!branding?.favicon) return;

        const { favicon } = branding;

        try {
            if (favicon.type === 'custom' && favicon.customUrl) {
                // Use custom uploaded favicon
                updateFavicon(favicon.customUrl);
            } else if (favicon.type === 'preset' && favicon.presetId) {
                // Generate SVG favicon from preset
                const dataUrl = createPresetFavicon(favicon.presetId, favicon.presetColor || '#0EA5E9');
                updateFavicon(dataUrl);
            }
        } catch (error) {
            console.error('Error applying favicon:', error);
        }
    }, [branding?.favicon]);
}

/**
 * Applies favicon immediately (for use outside React components)
 */
export function applyFavicon(favicon: BrandingData['favicon']): void {
    if (!favicon) return;

    try {
        if (favicon.type === 'custom' && favicon.customUrl) {
            updateFavicon(favicon.customUrl);
        } else if (favicon.type === 'preset' && favicon.presetId) {
            const dataUrl = createPresetFavicon(favicon.presetId, favicon.presetColor || '#0EA5E9');
            updateFavicon(dataUrl);
        }
    } catch (error) {
        console.error('Error applying favicon:', error);
    }
}

export default useFavicon;
