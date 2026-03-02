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

interface ThemeSelectorProps {
    /** Currently selected theme ID */
    selectedThemeId: string;
    /** Callback when theme is changed */
    onThemeChange: (themeId: string) => void;
    /** Theme-specific settings */
    themeSettings?: ThemeSpecificSettings;
    /** Callback when theme settings change */
    onThemeSettingsChange?: (settings: ThemeSpecificSettings) => void;
}

/**
 * Get icon for theme based on tags
 */
function getThemeIcon(theme: ThemeMetadata) {
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
    if (theme.id === 'classic') {
        return {
            background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
        };
    }
    if (theme.id === 'glassmorphism') {
        return {
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.3) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.2)',
        };
    }
    if (theme.id === 'minimal') {
        return {
            background: 'linear-gradient(135deg, #F8FAFC 0%, #E2E8F0 100%)',
        };
    }
    // Default gradient
    return {
        background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    };
}

export function ThemeSelector({
    selectedThemeId,
    onThemeChange,
    themeSettings,
    onThemeSettingsChange,
}: ThemeSelectorProps) {
    const themes = getThemeList();
    const selectedTheme = getTheme(selectedThemeId);

    return (
        <div className="space-y-6">
            {/* Theme Grid */}
            <div>
                <h3 className="text-lg font-semibold mb-4">Vælg tema</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Skift hele udseendet på din shop. Alle dine indstillinger (farver, logo, produkter) bevares.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {themes.map((theme) => {
                        const isSelected = selectedThemeId === theme.id;

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
                                    className="h-24 w-full flex items-center justify-center"
                                    style={getThemePreviewStyle(theme)}
                                >
                                    <div className="text-white/90">
                                        {getThemeIcon(theme)}
                                    </div>
                                    {isSelected && (
                                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                                            <Check className="h-3 w-3" />
                                        </div>
                                    )}
                                </div>

                                <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base">{theme.name}</CardTitle>
                                        {theme.isPremium && (
                                            <Badge variant="secondary" className="text-xs">
                                                Premium
                                            </Badge>
                                        )}
                                    </div>
                                    <CardDescription className="text-xs">
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
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                <p>
                    <strong>Tip:</strong> Når du skifter tema, ændres hele layoutet og designet på din shop.
                    Dine branding-indstillinger (farver, fonts, logo) anvendes automatisk på det valgte tema.
                </p>
            </div>
        </div>
    );
}
