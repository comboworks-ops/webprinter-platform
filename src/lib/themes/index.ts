/**
 * Theme System Registry
 *
 * Central registry for all themes. Themes self-register when imported.
 * This module provides functions to query and access registered themes.
 */

import type { ThemeDefinition, ThemeMetadata } from './types';

// =============================================================================
// THEME REGISTRY
// =============================================================================

/** Internal theme registry map */
const themeRegistry = new Map<string, ThemeDefinition>();

/** Default theme ID (fallback when no theme is specified) */
export const DEFAULT_THEME_ID = 'classic';

// =============================================================================
// REGISTRY FUNCTIONS
// =============================================================================

/**
 * Register a theme with the system.
 * Called by theme modules when they are imported (self-registering pattern).
 *
 * @param theme - The complete theme definition to register
 */
export function registerTheme(theme: ThemeDefinition): void {
    if (themeRegistry.has(theme.metadata.id)) {
        if (import.meta.env.DEV) {
            console.warn(
                `[Themes] Theme "${theme.metadata.id}" already registered, overwriting.`
            );
        }
    }
    themeRegistry.set(theme.metadata.id, theme);
    if (import.meta.env.DEV) {
        console.log(`[Themes] Registered theme: ${theme.metadata.name}`);
    }
}

/**
 * Get a theme by its ID.
 *
 * @param id - Theme identifier
 * @returns Theme definition or undefined if not found
 */
export function getTheme(id: string): ThemeDefinition | undefined {
    return themeRegistry.get(id);
}

/**
 * Get a theme by ID with fallback to default theme.
 * Use this when you need a guaranteed theme (never undefined).
 *
 * @param id - Theme identifier
 * @returns Theme definition (falls back to default if not found)
 */
export function getThemeOrDefault(id: string): ThemeDefinition {
    const theme = themeRegistry.get(id);
    if (theme) return theme;

    const defaultTheme = themeRegistry.get(DEFAULT_THEME_ID);
    if (defaultTheme) return defaultTheme;

    throw new Error(
        `[Themes] No theme found for "${id}" and default theme "${DEFAULT_THEME_ID}" is not registered. ` +
        `Make sure to import at least one theme before using the theme system.`
    );
}

/**
 * Get all registered themes.
 *
 * @returns Array of all theme definitions
 */
export function getAllThemes(): ThemeDefinition[] {
    return Array.from(themeRegistry.values());
}

/**
 * Get metadata for all registered themes.
 * Useful for theme selector UI.
 *
 * @returns Array of theme metadata objects
 */
export function getThemeList(): ThemeMetadata[] {
    return getAllThemes().map((theme) => theme.metadata);
}

/**
 * Check if a theme is registered.
 *
 * @param id - Theme identifier
 * @returns True if theme is registered
 */
export function isThemeRegistered(id: string): boolean {
    return themeRegistry.has(id);
}

/**
 * Get the number of registered themes.
 *
 * @returns Count of registered themes
 */
export function getThemeCount(): number {
    return themeRegistry.size;
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export * from './types';
export { ThemeProvider, useTheme } from './theme-context';
