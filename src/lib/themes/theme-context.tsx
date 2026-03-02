/**
 * Theme Context Provider
 *
 * Provides the active theme to all child components.
 * Components use useTheme() to access theme components and settings.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type {
    ThemeDefinition,
    ThemeComponents,
    ThemeSpecificSettings,
    ThemeContextValue,
} from './types';
import { getThemeOrDefault, DEFAULT_THEME_ID } from './index';

// =============================================================================
// CONTEXT
// =============================================================================

const ThemeContext = createContext<ThemeContextValue | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

export interface ThemeProviderProps {
    /** Children to wrap with theme context */
    children: ReactNode;

    /** Theme ID to use (defaults to 'classic') */
    themeId?: string;

    /** Theme-specific settings overrides */
    themeSettings?: ThemeSpecificSettings;
}

/**
 * Theme Provider component.
 * Wrap your app or page with this to enable theme switching.
 *
 * @example
 * ```tsx
 * <ThemeProvider themeId="glassmorphism">
 *   <ShopContent />
 * </ThemeProvider>
 * ```
 */
export function ThemeProvider({
    children,
    themeId = DEFAULT_THEME_ID,
    themeSettings = {},
}: ThemeProviderProps) {
    const value = useMemo<ThemeContextValue>(() => {
        // Get theme definition (falls back to default if not found)
        const theme = getThemeOrDefault(themeId);

        return {
            themeId: theme.metadata.id,
            theme,
            components: theme.components,
            themeSettings: {
                ...theme.defaultSettings,
                ...themeSettings,
            },
        };
    }, [themeId, themeSettings]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook to access the current theme.
 * Must be used within a ThemeProvider.
 *
 * @returns Current theme context value
 * @throws Error if used outside ThemeProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { components: Theme, themeId } = useTheme();
 *
 *   return (
 *     <Theme.Header branding={branding} tenantName={tenantName} />
 *   );
 * }
 * ```
 */
export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error(
            '[useTheme] Must be used within a ThemeProvider. ' +
            'Make sure your component is wrapped with <ThemeProvider>.'
        );
    }

    return context;
}

/**
 * Hook to safely access theme context (returns null if not in provider).
 * Useful for components that may render outside theme context.
 *
 * @returns Theme context value or null
 */
export function useThemeOptional(): ThemeContextValue | null {
    return useContext(ThemeContext);
}
