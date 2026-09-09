/**
 * Color Proofing Panel
 * 
 * UI for controlling CMYK soft proof preview settings
 * Supports custom per-product ICC profiles with warnings when switching
 */

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OUTPUT_PROFILES, ProofingSettings } from "@/lib/color/iccProofing";
import { Palette, AlertCircle, Loader2, Info, Eye, Sparkles, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { PRINT_PROCESS_GUIDANCE } from "@/lib/color/profileGuidance";

interface TenantProfile {
    id: string;
    name: string;
}

interface ColorProofingPanelProps {
    settings: ProofingSettings;
    isReady: boolean;
    isProcessing: boolean;
    error: string | null;
    onSetEnabled: (enabled: boolean) => void;
    onSetOutputProfile: (profileId: string) => void;
    onSetShowGamutWarning: (show: boolean) => void;
    hasCustomProfile?: boolean;
    productProfileId?: string;
    productProfileName?: string;
    tenantId?: string;
    resolvedProfileName?: string;
    previewResolutionLimited?: boolean;
    isPreviewVisible?: boolean;
}

export function ColorProofingPanel({
    settings,
    isReady,
    isProcessing,
    error,
    onSetEnabled,
    onSetOutputProfile,
    onSetShowGamutWarning,
    hasCustomProfile = false,
    productProfileId,
    productProfileName,
    tenantId,
    resolvedProfileName,
    previewResolutionLimited = false,
    isPreviewVisible = false,
}: ColorProofingPanelProps) {
    const [tenantProfiles, setTenantProfiles] = useState<TenantProfile[]>([]);
    const [loadingProfiles, setLoadingProfiles] = useState(false);
    const [profileListError, setProfileListError] = useState<string | null>(null);

    // Fetch tenant's uploaded profiles
    useEffect(() => {
        let cancelled = false;
        setTenantProfiles([]);
        setProfileListError(null);
        async function fetchTenantProfiles() {
            if (!tenantId) { setLoadingProfiles(false); return; }

            setLoadingProfiles(true);
            try {
                const { data, error } = await supabase
                    .from('color_profiles' as any)
                    .select('id, name')
                    .eq('tenant_id', tenantId)
                    .eq('kind', 'cmyk_output')
                    .order('name');

                if (cancelled) return;
                if (error) throw error;
                if (data) {
                    setTenantProfiles(data as unknown as TenantProfile[]);
                }
            } catch (err) {
                if (!cancelled) setProfileListError('Dine egne profiler kunne ikke indlæses. Standardprofilerne er stadig tilgængelige.');
            } finally {
                if (!cancelled) setLoadingProfiles(false);
            }
        }

        fetchTenantProfiles();
        return () => { cancelled = true; };
    }, [tenantId]);

    // Check if user has switched away from product's profile
    const isUsingNonProductProfile = hasCustomProfile &&
        productProfileId &&
        settings.outputProfileId !== productProfileId &&
        settings.outputProfileId !== 'product';

    // Build the current profile display name
    const getCurrentProfileName = () => {
        if (isReady && resolvedProfileName) return resolvedProfileName;
        if (settings.outputProfileId === 'product' || settings.outputProfileId === productProfileId) {
            return productProfileName || 'Produkt profil';
        }

        // Check tenant profiles
        const tenantProfile = tenantProfiles.find(p => p.id === settings.outputProfileId);
        if (tenantProfile) return tenantProfile.name;

        // Check built-in profiles
        const builtInProfile = OUTPUT_PROFILES.find(p => p.id === settings.outputProfileId);
        if (builtInProfile) return builtInProfile.name;

        return settings.outputProfileId;
    };
    const selectedStandardProfile = OUTPUT_PROFILES.find(profile => profile.id === settings.outputProfileId);

    return (
        <div className="p-4 space-y-4">
            {/* Header with main toggle */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Soft Proof</h3>
                </div>
                <div className="flex items-center gap-2">
                    {isProcessing && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    <Switch
                        checked={settings.enabled}
                        onCheckedChange={onSetEnabled}
                        aria-label="Aktiver soft proof"
                    />
                </div>
            </div>

            {/* Product profile info */}
            {hasCustomProfile && productProfileName && (
                <div className="p-2 rounded bg-purple-50 border border-purple-200 text-purple-700 text-xs flex items-start gap-2">
                    <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                        <strong>Produktets farveprofil:</strong> {productProfileName}
                        <p className="mt-1 text-purple-600">
                            Denne profil er anbefalet til dette produkt.
                        </p>
                    </div>
                </div>
            )}

            {/* Warning when using non-product profile */}
            {isUsingNonProductProfile && (
                <div className="p-2 rounded bg-amber-50 border border-amber-200 text-amber-700 text-xs flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                        <strong>Advarsel:</strong> Du bruger ikke produktets anbefalede profil.
                        <p className="mt-1 text-amber-600">
                            Resultatet kan se anderledes ud ved print. Produktets profil: <strong>{productProfileName}</strong>
                        </p>
                    </div>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                        <strong>Farvevisning er ikke tilgængelig:</strong> {error}
                        <p className="mt-1">Originale farver vises, indtil profilen er klar.</p>
                    </div>
                </div>
            )}

            {/* Status indicator */}
            {settings.enabled && !error && (
                <div className={`p-2 rounded text-xs flex items-center gap-2 ${isReady
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-amber-50 border border-amber-200 text-amber-700'
                    }`}>
                    {isReady ? (
                        <>
                            <Eye className="h-4 w-4" />
                            <span>{isPreviewVisible ? `CMYK preview aktiv - ${getCurrentProfileName()}` : 'Originale farver vises under redigering eller opdatering.'}</span>
                        </>
                    ) : (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Indlæser farveprofil...</span>
                        </>
                    )}
                </div>
            )}

            {/* Profile selection */}
            <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Output profil</Label>
                <Select
                    value={settings.outputProfileId}
                    onValueChange={onSetOutputProfile}
                    disabled={!settings.enabled || loadingProfiles}
                >
                    <SelectTrigger className="h-9">
                        <SelectValue placeholder="Vælg profil" />
                    </SelectTrigger>
                    <SelectContent>
                        {/* Product's profile first (if any) */}
                        {hasCustomProfile && productProfileId && (
                            <>
                                <SelectItem value={productProfileId}>
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="h-3 w-3 text-purple-600" />
                                        <span>{productProfileName}</span>
                                        <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 bg-purple-100 text-purple-700">
                                            Anbefalet
                                        </Badge>
                                    </div>
                                </SelectItem>
                                <div className="h-px bg-border my-1" />
                            </>
                        )}

                        {/* Tenant's uploaded profiles */}
                        {tenantProfiles.length > 0 && (
                            <>
                                <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                                    Dine profiler
                                </div>
                                {tenantProfiles
                                    .filter(p => p.id !== productProfileId)
                                    .map((profile) => (
                                        <SelectItem key={profile.id} value={profile.id}>
                                            {profile.name}
                                        </SelectItem>
                                    ))}
                                <div className="h-px bg-border my-1" />
                            </>
                        )}

                        {/* Built-in profiles */}
                        <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                            Standard profiler
                        </div>
                        {OUTPUT_PROFILES.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                                {profile.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {profileListError && <p className="text-xs text-amber-700">{profileListError}</p>}
                {selectedStandardProfile && <div className="space-y-1 text-xs text-muted-foreground">
                    <p>{selectedStandardProfile.description}</p>
                    <p>{selectedStandardProfile.usageNote}</p>
                </div>}
            </div>

            <details className="rounded-lg border p-3 text-xs">
                <summary className="cursor-pointer font-medium">Hvilken profil passer til opgaven?</summary>
                <div className="mt-3 space-y-3 text-muted-foreground">
                    {PRINT_PROCESS_GUIDANCE.filter(process => process.id !== 'unspecified').map(process => (
                        <div key={process.id}><p className="font-medium text-foreground">{process.label}</p><p className="mt-1">{process.guidance}</p></div>
                    ))}
                </div>
            </details>

            {/* Gamut warning toggle */}
            <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                    <Label className="text-xs font-medium">Vis tydelige farveskift</Label>
                    <p className="text-xs text-muted-foreground">
                        Vejledende markering ved konvertering
                    </p>
                </div>
                <Switch
                    checked={settings.showGamutWarning}
                    onCheckedChange={onSetShowGamutWarning}
                    disabled={!settings.enabled || !isReady}
                    aria-label="Vis tydelige farveskift"
                />
            </div>

            {/* Disclaimer */}
            <div className="p-3 rounded-lg bg-muted/50 border text-xs space-y-1">
                <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="text-muted-foreground">
                        <p className="font-medium text-foreground">Om Soft Proof</p>
                        <p className="mt-1">
                            Soft proof simulerer hvordan farver vil se ud ved print på valgt profil.
                            Faktisk print kan variere afhængigt af papir, blæk og maskinkalibrering.
                        </p>
                        <p className="mt-2">Brug trykkeriets profil. Til storformat og tekstil afhænger den af maskine, blæk, materiale og printindstilling.</p>
                    </div>
                </div>
            </div>

            {settings.enabled && previewResolutionLimited && (
                <p className="text-xs text-amber-700">Visningen er meget stor, så previewets opløsning er begrænset. Eksportens opløsning påvirkes ikke.</p>
            )}

            {/* Legend when gamut warning is on */}
            {settings.enabled && settings.showGamutWarning && isReady && (
                <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 bg-green-500 rounded opacity-70"></div>
                    <span className="text-muted-foreground">
                        Grøn viser større farveskift. Det er en tilnærmelse, ikke en præcis gamutmåling.
                    </span>
                </div>
            )}
        </div>
    );
}

export default ColorProofingPanel;
