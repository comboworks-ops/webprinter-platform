/**
 * Platform SEO Defaults Tab
 * 
 * Configure global SEO settings for the platform.
 * With helpful tooltips explaining each field.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2 } from 'lucide-react';
import { usePlatformSeoSettings, useUpdatePlatformSeoSettings } from '@/lib/platform-seo/hooks';
import { FieldTooltip } from './FieldTooltip';

export function PlatformSeoDefaults() {
    const { toast } = useToast();
    const { data: settings, isLoading } = usePlatformSeoSettings();
    const updateSettings = useUpdatePlatformSeoSettings();

    const [formData, setFormData] = useState({
        primary_domain: 'webprinter.dk',
        canonical_base_url: 'https://webprinter.dk',
        default_title_template: '{pageTitle} | Webprinter Platform',
        default_description: 'Webprinter Platform - Den komplette løsning til moderne trykkerier.',
        default_robots: 'index,follow',
        default_og_image_url: '',
        organization_jsonld: '',
        website_jsonld: '',
    });

    // Sync form with loaded settings
    useEffect(() => {
        if (settings) {
            setFormData({
                primary_domain: settings.primary_domain || 'webprinter.dk',
                canonical_base_url: settings.canonical_base_url || 'https://webprinter.dk',
                default_title_template: settings.default_title_template || '{pageTitle} | Webprinter Platform',
                default_description: settings.default_description || '',
                default_robots: settings.default_robots || 'index,follow',
                default_og_image_url: settings.default_og_image_url || '',
                organization_jsonld: settings.organization_jsonld ? JSON.stringify(settings.organization_jsonld, null, 2) : '',
                website_jsonld: settings.website_jsonld ? JSON.stringify(settings.website_jsonld, null, 2) : '',
            });
        }
    }, [settings]);

    const handleSave = async () => {
        try {
            // Validate JSON fields
            let orgJsonld = null;
            let webJsonld = null;

            if (formData.organization_jsonld.trim()) {
                try {
                    orgJsonld = JSON.parse(formData.organization_jsonld);
                } catch {
                    toast({ title: 'Fejl', description: 'Ugyldig JSON i Organization JSON-LD', variant: 'destructive' });
                    return;
                }
            }

            if (formData.website_jsonld.trim()) {
                try {
                    webJsonld = JSON.parse(formData.website_jsonld);
                } catch {
                    toast({ title: 'Fejl', description: 'Ugyldig JSON i Website JSON-LD', variant: 'destructive' });
                    return;
                }
            }

            await updateSettings.mutateAsync({
                primary_domain: formData.primary_domain,
                canonical_base_url: formData.canonical_base_url,
                default_title_template: formData.default_title_template,
                default_description: formData.default_description,
                default_robots: formData.default_robots,
                default_og_image_url: formData.default_og_image_url || null,
                organization_jsonld: orgJsonld,
                website_jsonld: webJsonld,
            });

            toast({ title: 'Gemt', description: 'SEO-indstillinger er opdateret.' });
        } catch (error) {
            console.error('Error saving settings:', error);
            toast({ title: 'Fejl', description: 'Kunne ikke gemme indstillinger.', variant: 'destructive' });
        }
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
            {/* Domain Settings */}
            <Card>
                <CardHeader>
                    <CardTitle>Domæneindstillinger</CardTitle>
                    <CardDescription>
                        Konfigurer primært domæne og kanoniske URLs. Disse indstillinger fortæller søgemaskiner,
                        hvilket domæne der er det "officielle" for dit indhold.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="primary_domain" className="flex items-center">
                                Primært domæne
                                <FieldTooltip
                                    content="Dit hoveddomæne uden 'https://'. Dette er det domæne, Google vil vise i søgeresultater. Brug kun ét domæne (enten med eller uden www)."
                                    example="webprinter.dk"
                                />
                            </Label>
                            <Input
                                id="primary_domain"
                                value={formData.primary_domain}
                                onChange={(e) => setFormData(prev => ({ ...prev, primary_domain: e.target.value }))}
                                placeholder="webprinter.dk"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="canonical_base_url" className="flex items-center">
                                Kanonisk base-URL
                                <FieldTooltip
                                    content="Den fulde URL med 'https://' som danner grundlag for alle kanoniske links. Kanoniske links fortæller søgemaskiner, hvilken version af en side der er den 'rigtige' original."
                                    example="https://webprinter.dk"
                                />
                            </Label>
                            <Input
                                id="canonical_base_url"
                                value={formData.canonical_base_url}
                                onChange={(e) => setFormData(prev => ({ ...prev, canonical_base_url: e.target.value }))}
                                placeholder="https://webprinter.dk"
                            />
                            <p className="text-xs text-muted-foreground">
                                💡 Tip: Hvis du senere skifter domæne (fx til webprinter.com), kan du ændre dette felt.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Default Meta Tags */}
            <Card>
                <CardHeader>
                    <CardTitle>Standard meta-tags</CardTitle>
                    <CardDescription>
                        Disse værdier bruges automatisk på sider, der ikke har deres egen specifikke konfiguration.
                        De er dit "sikkerhedsnet" for SEO.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="default_title_template" className="flex items-center">
                            Titel-skabelon
                            <FieldTooltip
                                content="Skabelonen for sidetitler, som vises i browserens faneblad og i Google-søgeresultater. Brug {pageTitle} som pladsholder - den erstattes automatisk med sidens navn."
                                example="{pageTitle} | Webprinter Platform → 'Priser | Webprinter Platform'"
                            />
                        </Label>
                        <Input
                            id="default_title_template"
                            value={formData.default_title_template}
                            onChange={(e) => setFormData(prev => ({ ...prev, default_title_template: e.target.value }))}
                            placeholder="{pageTitle} | Webprinter Platform"
                        />
                        <p className="text-xs text-muted-foreground">
                            💡 Tip: Hold titler under 60 tegn. Google afkorter længere titler i søgeresultater.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="default_description" className="flex items-center">
                            Standard beskrivelse
                            <FieldTooltip
                                content="Meta-beskrivelsen vises under titlen i Google-søgeresultater. Den skal kort forklare, hvad siden handler om og lokke folk til at klikke. Skriv som om du taler til en potentiel kunde."
                                example="Webprinter Platform - Komplet løsning til moderne trykkerier med white-label webshop, smart prisberegning og online designer."
                            />
                        </Label>
                        <Textarea
                            id="default_description"
                            value={formData.default_description}
                            onChange={(e) => setFormData(prev => ({ ...prev, default_description: e.target.value }))}
                            placeholder="Beskrivelse af din platform..."
                            rows={3}
                        />
                        <p className="text-xs text-muted-foreground">
                            💡 Tip: Sigte efter 150-160 tegn. Inkluder vigtige søgeord naturligt i teksten.
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="default_robots" className="flex items-center">
                                Robots
                                <FieldTooltip
                                    content="Instruktioner til søgemaskiner. 'index' = vis siden i søgeresultater. 'follow' = følg links på siden. 'noindex' = skjul fra søgning. De fleste sider bør bruge 'index,follow'."
                                    example="index,follow (vises i søgning) eller noindex,nofollow (skjules)"
                                />
                            </Label>
                            <Input
                                id="default_robots"
                                value={formData.default_robots}
                                onChange={(e) => setFormData(prev => ({ ...prev, default_robots: e.target.value }))}
                                placeholder="index,follow"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="default_og_image_url" className="flex items-center">
                                Standard OG-billede URL
                                <FieldTooltip
                                    content="Billedet der vises når nogen deler din side på Facebook, LinkedIn, Twitter osv. Brug et professionelt billede i 1200x630 pixels. Hvis feltet er tomt, kan sociale medier vise et tilfældigt billede fra siden."
                                    example="https://webprinter.dk/images/social-preview.jpg"
                                />
                            </Label>
                            <Input
                                id="default_og_image_url"
                                value={formData.default_og_image_url}
                                onChange={(e) => setFormData(prev => ({ ...prev, default_og_image_url: e.target.value }))}
                                placeholder="https://..."
                            />
                            <p className="text-xs text-muted-foreground">
                                💡 Tip: Anbefalet størrelse: 1200x630 pixels. JPG eller PNG format.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* JSON-LD */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        Strukturerede data (JSON-LD)
                        <FieldTooltip
                            content="JSON-LD er en måde at give Google detaljerede oplysninger om din virksomhed i et struktureret format. Det kan give dig 'rich results' i søgninger - fx stjerner, logo, kontaktinfo direkte i Google."
                        />
                    </CardTitle>
                    <CardDescription>
                        Avanceret: Tilføj Organization og WebSite strukturerede data for bedre visning i Google.
                        Disse felter er valgfrie - lad dem stå tomme, hvis du ikke er sikker.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="organization_jsonld" className="flex items-center">
                            Organization JSON-LD
                            <FieldTooltip
                                content="Oplysninger om din virksomhed: navn, logo, adresse, kontaktinfo, sociale medier. Google kan bruge dette til at vise din virksomhedsinfo i søgeresultater."
                            />
                        </Label>
                        <Textarea
                            id="organization_jsonld"
                            value={formData.organization_jsonld}
                            onChange={(e) => setFormData(prev => ({ ...prev, organization_jsonld: e.target.value }))}
                            placeholder='{"@context": "https://schema.org", "@type": "Organization", ...}'
                            rows={6}
                            className="font-mono text-sm"
                        />
                        <details className="text-xs text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground">💡 Vis eksempel på Organization JSON-LD</summary>
                            <pre className="mt-2 p-2 bg-muted rounded text-[11px] overflow-x-auto">
                                {`{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Webprinter",
  "url": "https://webprinter.dk",
  "logo": "https://webprinter.dk/logo.png",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+45-71-99-11-10",
    "contactType": "customer service"
  }
}`}
                            </pre>
                        </details>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="website_jsonld" className="flex items-center">
                            WebSite JSON-LD
                            <FieldTooltip
                                content="Oplysninger om selve hjemmesiden: navn, URL, søgefunktion. Kan give dig en søgefeltvisning direkte i Google ved branded søgninger."
                            />
                        </Label>
                        <Textarea
                            id="website_jsonld"
                            value={formData.website_jsonld}
                            onChange={(e) => setFormData(prev => ({ ...prev, website_jsonld: e.target.value }))}
                            placeholder='{"@context": "https://schema.org", "@type": "WebSite", ...}'
                            rows={6}
                            className="font-mono text-sm"
                        />
                        <details className="text-xs text-muted-foreground">
                            <summary className="cursor-pointer hover:text-foreground">💡 Vis eksempel på WebSite JSON-LD</summary>
                            <pre className="mt-2 p-2 bg-muted rounded text-[11px] overflow-x-auto">
                                {`{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Webprinter Platform",
  "url": "https://webprinter.dk"
}`}
                            </pre>
                        </details>
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

export default PlatformSeoDefaults;
