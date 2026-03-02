/**
 * Glassmorphism Theme - Shop Layout Component
 *
 * Provides the overall page structure with glass-themed styling.
 */

import type { ShopLayoutProps } from '@/lib/themes/types';

export function GlassShopLayout({ children, cssVariables, branding }: ShopLayoutProps) {
    const primaryColor = branding?.colors?.primary || '#0EA5E9';

    return (
        <div
            className="min-h-screen flex flex-col glassmorphism-theme"
            style={{
                ...cssVariables,
                // Add glass-specific CSS variables
                '--glass-bg': 'rgba(255, 255, 255, 0.7)',
                '--glass-border': 'rgba(255, 255, 255, 0.3)',
                '--glass-shadow': '0 8px 32px rgba(0, 0, 0, 0.1)',
            } as React.CSSProperties}
        >
            {/* Subtle background gradient */}
            <div
                className="fixed inset-0 -z-10 pointer-events-none"
                style={{
                    background: `
                        radial-gradient(circle at 20% 80%, ${primaryColor}10 0%, transparent 50%),
                        radial-gradient(circle at 80% 20%, ${primaryColor}08 0%, transparent 50%),
                        linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)
                    `,
                }}
            />
            {children}
        </div>
    );
}
