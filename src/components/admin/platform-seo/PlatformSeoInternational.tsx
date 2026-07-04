/**
 * Platform SEO International Tab
 * 
 * Manage locales and hreflang configuration.
 * With helpful tooltips explaining each field.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Languages, Plus, Trash2, Save, Loader2, Eye, Info } from 'lucide-react';
import { usePlatformSeoSettings, useUpdatePlatformSeoSettings } from '@/lib/platform-seo/hooks';
import type { PlatformSeoLocale } from '@/lib/platform-seo/types';
import { FieldTooltip } from './FieldTooltip';

export function PlatformSeoInternational() {
    const { toast } = useToast();
    const { data: settings, isLoading } = usePlatformSeoSettings();
    const updateSettings = useUpdatePlatformSeoSettings();

    const [locales, setLocales] = useState<PlatformSeoLocale[]>([
        { locale: 'da-DK', lang: 'da', isDefault: true, pathPrefix: '' },
    ]);
    const [previewPath, setPreviewPath] = useState('/priser');

    useEffect(() => {
        if (settings?.locales) {
            setLocales(settings.locales);
        }
    }, [settings]);

    const handleAddLocale = () => {
        setLocales(prev => [
            ...prev,
            { locale: '', lang: '', isDefault: false, pathPrefix: '' },
        ]);
    };

    const handleRemoveLocale = (index: number) => {
        setLocales(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdateLocale = (index: number, field: keyof PlatformSeoLocale, value: string | boolean) => {
        setLocales(prev => prev.map((loc, i) => {
            if (i !== index) return loc;

            // If setting this as default, unset others
            if (field === 'isDefault' && value === true) {
                return { ...loc, isDefault: true };
            }

            return { ...loc, [field]: value };
        }).map((loc, i) => {
            // Ensure only one default
            if (field === 'isDefault' && value === true && i !== index) {
                return { ...loc, isDefault: false };
            }
            return loc;
        }));
    };

    const handleSave = async () => {
        // Validate
        const hasDefault = locales.some(l => l.isDefault);
        if (!hasDefault) {
            toast({ title: 'Fejl', description: 'Der skal være mindst én standard-locale.', variant: 'destructive' });
            return;
        }

        for (const loc of locales) {
            if (!loc.locale || !loc.lang) {
                toast({ title: 'Fejl', description: 'Alle locales skal have locale og lang udfyldt.', variant: 'destructive' });
                return;
            }
        }

        try {
            await updateSettings.mutateAsync({ locales });
            toast({ title: 'Gemt', description: 'Locale-indstillinger er opdateret.' });
        } catch (error) {
            console.error('Error saving locales:', error);
            toast({ title: 'Fejl', description: 'Kunne ikke gemme indstillinger.', variant: 'destructive' });
        }
    };

    const generateHreflangPreview = () => {
        const baseUrl = settings?.canonical_base_url || 'https://www.webprinter.dk';
        return locales.map(loc => ({
            lang: loc.locale,
            href: `${baseUrl}${loc.pathPrefix}${previewPath}`,
        })).concat([{
            lang: 'x-default',
            href: `${baseUrl}${locales.find(l => l.isDefault)?.pathPrefix || ''}${previewPath}`,
        }]);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Help Info Box */}
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Hvad er hreflang og internationale SEO-indstillinger?</p>
                    <p>
                        Hvis din hjemmeside findes på flere sprog (fx dansk og engelsk), bruger du hreflang-tags til at
                        fortælle Google hvilke sprogversioner der findes. Dette sikrer, at danske brugere ser den danske
                        version i Google, og engelske brugere ser den engelske.
                    </p>
                    <p className="mt-2">
                        💡 <strong>Tip:</strong> Hvis du kun har en dansk hjemmeside, behøver du ikke ændre noget her.
                        Standarden (da-DK) er allerede sat op.
                    </p>
                </div>
            </div>

            {/* Locales Configuration */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Languages className="h-5 w-5" />
                        Sprog og locales
                        <FieldTooltip
                            content="En 'locale' er en kombination af sprog og region. Fx 'da-DK' betyder dansk for Danmark, 'de-AT' betyder tysk for Østrig. Dette bruges til at vise det rigtige indhold til brugere fra forskellige lande."
                        />
                    </CardTitle>
                    <CardDescription>
                        Konfigurer tilgængelige sprog for platform-siderne. Ét sprog skal være markeret som standard.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {locales.map((locale, index) => (
                        <div key={index} className="flex items-end gap-4 p-4 bg-muted/50 rounded-lg">
                            <div className="flex-1 grid gap-4 md:grid-cols-4">
                                <div className="space-y-2">
                                    <Label className="flex items-center">
                                        Locale
                                        <FieldTooltip
                                            content="Den fulde locale-kode med sprog og region. Bruges til præcis targeting i Google. Format: sprog-REGION"
                                            example="da-DK (dansk, Danmark) eller en-US (engelsk, USA)"
                                        />
                                    </Label>
                                    <Input
                                        value={locale.locale}
                                        onChange={(e) => handleUpdateLocale(index, 'locale', e.target.value)}
                                        placeholder="da-DK"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center">
                                        Lang
                                        <FieldTooltip
                                            content="Kort sprogkode (2 bogstaver). Bruges i HTML og af browsere til at forstå sproget."
                                            example="da (dansk), en (engelsk), de (tysk)"
                                        />
                                    </Label>
                                    <Input
                                        value={locale.lang}
                                        onChange={(e) => handleUpdateLocale(index, 'lang', e.target.value)}
                                        placeholder="da"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center">
                                        Sti-præfiks
                                        <FieldTooltip
                                            content="URL-præfiks for dette sprog. Standardsproget har normalt intet præfiks (tom), mens andre sprog har fx '/en' for engelsk. Så '/priser' bliver til '/en/priser' for engelsk."
                                            example="(tom) for dansk, /en for engelsk"
                                        />
                                    </Label>
                                    <Input
                                        value={locale.pathPrefix}
                                        onChange={(e) => handleUpdateLocale(index, 'pathPrefix', e.target.value)}
                                        placeholder="/en"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center">
                                        Standard
                                        <FieldTooltip
                                            content="Er dette dit hovedsprog? Standardsproget bruges som 'x-default' i hreflang og vises til brugere, hvor Google ikke kan afgøre deres foretrukne sprog."
                                        />
                                    </Label>
                                    <div className="flex items-center h-10">
                                        <Switch
                                            checked={locale.isDefault}
                                            onCheckedChange={(checked) => handleUpdateLocale(index, 'isDefault', checked)}
                                        />
                                        <span className="ml-2 text-sm text-muted-foreground">
                                            {locale.isDefault ? 'Ja' : 'Nej'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveLocale(index)}
                                disabled={locales.length <= 1}
                                title="Fjern locale"
                            >
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))}

                    <Button variant="outline" onClick={handleAddLocale}>
                        <Plus className="mr-2 h-4 w-4" />
                        Tilføj locale
                    </Button>

                    <p className="text-xs text-muted-foreground mt-2">
                        💡 <strong>Tip:</strong> Tilføj kun locales for sprog du faktisk understøtter på din hjemmeside.
                        Tomme sprogversioner skader din SEO.
                    </p>
                </CardContent>
            </Card>

            {/* Hreflang Preview */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Eye className="h-5 w-5" />
                        Hreflang forhåndsvisning
                        <FieldTooltip
                            content="Hreflang-tags er HTML-kode der fortæller Google om alle sprogversioner af en side. Google bruger dette til at vise den rigtige sprogversion i søgeresultater baseret på brugerens lokation og sprogpræferencer."
                        />
                    </CardTitle>
                    <CardDescription>
                        Se hvordan hreflang-tags vil blive genereret for en given sti. Disse tags tilføjes automatisk
                        til alle platform-sider.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <Label htmlFor="preview_path">Test med sti</Label>
                            <Input
                                id="preview_path"
                                value={previewPath}
                                onChange={(e) => setPreviewPath(e.target.value)}
                                placeholder="/priser"
                            />
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm space-y-1">
                        {generateHreflangPreview().map(({ lang, href }) => (
                            <div key={lang} className="break-all">
                                &lt;link rel="alternate" hreflang="{lang}" href="{href}" /&gt;
                            </div>
                        ))}
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                        <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-amber-800">
                            <strong>x-default</strong> er en speciel hreflang der bruges når Google ikke kan afgøre brugerens
                            foretrukne sprog. Den peger på dit standardsprog.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={updateSettings.isPending}>
                    {updateSettings.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    Gem indstillinger
                </Button>
            </div>
        </div>
    );
}

export default PlatformSeoInternational;
