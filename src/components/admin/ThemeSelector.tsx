/**
 * Theme Selector Component
 *
 * Displays available themes and allows switching between them.
 * Used in the branding editor to select site themes.
 */

import { getThemeList, getTheme, type ThemeMetadata, type ThemeSpecificSettings } from '@/lib/themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, Palette, Sparkles, Layout } from 'lucide-react';
import '@/themes/classic';
import '@/themes/glassmorphism';
import '@/themes/taste-style-themes';

const THEME_PREVIEW_STYLES: Record<string, React.CSSProperties> = {
    classic: {
        background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
    },
    glassmorphism: {
        background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.3) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.2)',
    },
    'taste-glassmorphism': {
        background: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,.72), transparent 36%), linear-gradient(135deg, #8ec5fc 0%, #e0c3fc 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.35)',
    },
    'taste-neo-brutalism': {
        background: 'linear-gradient(135deg, #fff200 0%, #fff200 48%, #ff3b30 49%, #ff3b30 100%)',
        boxShadow: 'inset 0 0 0 4px #111827',
    },
    'taste-minimalism': {
        background: 'linear-gradient(135deg, #ffffff 0%, #f7f7f4 100%)',
        border: '1px solid #d8d8d2',
    },
    'taste-neumorphism': {
        background: 'linear-gradient(135deg, #eef2f7 0%, #dbe3ee 100%)',
        boxShadow: 'inset 12px 12px 24px rgba(148,163,184,.45), inset -12px -12px 24px rgba(255,255,255,.8)',
    },
    'taste-flat-design': {
        background: 'linear-gradient(135deg, #14b8a6 0%, #14b8a6 50%, #f97316 50%, #f97316 100%)',
    },
    'taste-material-design': {
        background: 'linear-gradient(135deg, #1e88e5 0%, #43a047 100%)',
        boxShadow: 'inset 0 -18px 0 rgba(255,255,255,.18)',
    },
    'taste-swiss-international': {
        background: 'repeating-linear-gradient(90deg, #ffffff 0 18px, #ef4444 18px 20px), linear-gradient(135deg, #ffffff, #f3f4f6)',
        border: '1px solid #111827',
    },
    'taste-retro-y2k': {
        background: 'linear-gradient(135deg, #00f5ff 0%, #ff4ecd 55%, #ffe500 100%)',
    },
    'taste-editorial-magazine': {
        background: 'linear-gradient(135deg, #111827 0%, #111827 42%, #f8fafc 43%, #f8fafc 100%)',
    },
    'taste-dark-futuristic': {
        background: 'radial-gradient(circle at 65% 35%, rgba(34,211,238,.55), transparent 35%), linear-gradient(135deg, #020617 0%, #111827 100%)',
    },
    'taste-luxury-premium': {
        background: 'linear-gradient(135deg, #111111 0%, #3b3026 55%, #d4af37 100%)',
    },
    'taste-corporate-enterprise': {
        background: 'linear-gradient(135deg, #1e3a8a 0%, #64748b 100%)',
    },
    'taste-playful-cartoon': {
        background: 'radial-gradient(circle at 28% 32%, #ffffff 0 12%, transparent 13%), linear-gradient(135deg, #ff7ab6 0%, #7dd3fc 100%)',
    },
    'taste-organic-natural': {
        background: 'linear-gradient(135deg, #f0ead6 0%, #8fb996 55%, #3f7d58 100%)',
    },
    'taste-industrial-technical': {
        background: 'repeating-linear-gradient(45deg, #374151 0 10px, #facc15 10px 20px)',
    },
    'taste-apple-clean': {
        background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 55%, #c7d2fe 100%)',
        border: '1px solid #e5e7eb',
    },
    'taste-dashboard-saas': {
        background: 'linear-gradient(135deg, #2563eb 0%, #06b6d4 50%, #10b981 100%)',
    },
    'taste-ecommerce-modern': {
        background: 'linear-gradient(135deg, #ffedd5 0%, #fb923c 50%, #111827 100%)',
    },
    'taste-cinematic-storytelling': {
        background: 'radial-gradient(circle at 50% 25%, rgba(251,191,36,.72), transparent 32%), linear-gradient(135deg, #0f172a 0%, #7f1d1d 100%)',
    },
    'taste-gaming-ui': {
        background: 'linear-gradient(135deg, #0f172a 0%, #7c3aed 45%, #22c55e 100%)',
    },
    'taste-government-public-service': {
        background: 'linear-gradient(135deg, #ffffff 0%, #dbeafe 55%, #1d4ed8 100%)',
        border: '1px solid #bfdbfe',
    },
    'taste-marketplace-ui': {
        background: 'linear-gradient(135deg, #f8fafc 0%, #38bdf8 45%, #f59e0b 100%)',
    },
    'taste-mobile-first-app': {
        background: 'linear-gradient(135deg, #111827 0%, #4f46e5 45%, #ec4899 100%)',
    },
    'taste-print-cmyk-graphic': {
        background: 'linear-gradient(135deg, #00aeef 0%, #ec008c 35%, #fff200 70%, #111111 100%)',
    },
    'taste-restaurant-menu': {
        background: 'linear-gradient(135deg, #7f1d1d 0%, #f97316 52%, #fef3c7 100%)',
    },
};

interface ThemeSelectorProps {
    /** Currently selected theme ID */
    selectedThemeId: string;
    /** Callback when theme is changed */
    onThemeChange: (themeId: string) => void;
    /** Theme-specific settings */
    themeSettings?: ThemeSpecificSettings;
    /** Callback when theme settings change */
    onThemeSettingsChange?: (settings: ThemeSpecificSettings) => void;
    /** Render a dense picker for narrow admin panels */
    compact?: boolean;
}

/**
 * Get icon for theme based on tags
 */
function getThemeIcon(theme: ThemeMetadata) {
    if (theme.tags?.includes('brutal') || theme.tags?.includes('graphic')) {
        return <Layout className="h-5 w-5" />;
    }
    if (theme.tags?.includes('glass') || theme.tags?.includes('modern')) {
        return <Sparkles className="h-5 w-5" />;
    }
    if (theme.tags?.includes('minimal') || theme.tags?.includes('clean')) {
        return <Layout className="h-5 w-5" />;
    }
    return <Palette className="h-5 w-5" />;
}

/**
 * Get preview gradient/color for theme thumbnail
 */
function getThemePreviewStyle(theme: ThemeMetadata): React.CSSProperties {
    return THEME_PREVIEW_STYLES[theme.id] || {
        background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    };
}

export function ThemeSelector({
    selectedThemeId,
    onThemeChange,
    themeSettings,
    onThemeSettingsChange,
    compact = false,
}: ThemeSelectorProps) {
    const themes = getThemeList();
    const selectedTheme = getTheme(selectedThemeId);

    return (
        <div className={compact ? "space-y-3" : "space-y-6"}>
            {/* Theme Grid */}
            <div>
                <h3 className={compact ? "mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground" : "text-lg font-semibold mb-4"}>
                    Vælg tema
                </h3>
                <p className={compact ? "mb-2 text-[11px] leading-4 text-muted-foreground" : "text-sm text-muted-foreground mb-4"}>
                    Skift hele udseendet på din shop. Alle dine indstillinger (farver, logo, produkter) bevares.
                </p>

                <div className={compact ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"}>
                    {themes.map((theme) => {
                        const isSelected = selectedThemeId === theme.id;

                        if (compact) {
                            return (
                                <button
                                    key={theme.id}
                                    type="button"
                                    aria-pressed={isSelected}
                                    title={theme.description}
                                    className={cn(
                                        "group min-h-12 rounded-md border bg-background p-1.5 text-left transition hover:border-primary/50 hover:bg-muted/40",
                                        isSelected && "border-primary bg-primary/5 ring-1 ring-primary/20"
                                    )}
                                    onClick={() => onThemeChange(theme.id)}
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border text-white shadow-sm"
                                            style={getThemePreviewStyle(theme)}
                                        >
                                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/20 text-white/90 backdrop-blur-sm [&_svg]:h-3 [&_svg]:w-3">
                                                {getThemeIcon(theme)}
                                            </span>
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[11px] font-semibold leading-4">{theme.name}</span>
                                            {theme.tags?.[0] ? (
                                                <span className="block truncate text-[10px] leading-3 text-muted-foreground">{theme.tags[0]}</span>
                                            ) : null}
                                        </span>
                                        {isSelected ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" /> : null}
                                    </div>
                                </button>
                            );
                        }

                        return (
                            <Card
                                key={theme.id}
                                className={cn(
                                    "cursor-pointer transition-all hover:shadow-md relative overflow-hidden",
                                    isSelected && "ring-2 ring-primary shadow-md"
                                )}
                                onClick={() => onThemeChange(theme.id)}
                            >
                                {/* Theme Preview */}
                                <div
                                    className="h-20 w-full flex items-center justify-center"
                                    style={getThemePreviewStyle(theme)}
                                >
                                    <div className="rounded-full bg-black/20 p-2 text-white/90 shadow-sm backdrop-blur-sm">
                                        {getThemeIcon(theme)}
                                    </div>
                                    {isSelected && (
                                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                                            <Check className="h-3 w-3" />
                                        </div>
                                    )}
                                </div>

                                <CardHeader className="pb-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <CardTitle className="text-sm leading-snug">{theme.name}</CardTitle>
                                        {theme.isPremium && (
                                            <Badge variant="secondary" className="text-xs">
                                                Premium
                                            </Badge>
                                        )}
                                    </div>
                                    <CardDescription className="min-h-8 text-xs leading-snug">
                                        {theme.description}
                                    </CardDescription>
                                </CardHeader>

                                {theme.tags && theme.tags.length > 0 && (
                                    <CardContent className="pt-0 pb-3">
                                        <div className="flex flex-wrap gap-1">
                                            {theme.tags.slice(0, 3).map((tag) => (
                                                <Badge
                                                    key={tag}
                                                    variant="outline"
                                                    className="text-[10px] px-1.5 py-0"
                                                >
                                                    {tag}
                                                </Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Theme-Specific Settings */}
            {selectedTheme?.editorSections && selectedTheme.editorSections.length > 0 && (
                <div className="space-y-4 border-t pt-4">
                    <h4 className="font-medium">Tema-indstillinger</h4>
                    {selectedTheme.editorSections.map((section) => (
                        <div key={section.id}>
                            <h5 className="text-sm font-medium mb-2">{section.label}</h5>
                            <section.render
                                settings={themeSettings || {}}
                                onChange={(newSettings) => {
                                    onThemeSettingsChange?.(newSettings);
                                }}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Info Text */}
            <div className={compact ? "rounded-md bg-muted/40 px-2.5 py-2 text-[11px] leading-4 text-muted-foreground" : "bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground"}>
                <p>
                    <strong>Tip:</strong> Når du skifter tema, ændres hele layoutet og designet på din shop.
                    Dine branding-indstillinger (farver, fonts, logo) anvendes automatisk på det valgte tema.
                </p>
            </div>
        </div>
    );
}
