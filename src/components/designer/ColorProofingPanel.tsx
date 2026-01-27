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
}: ColorProofingPanelProps) {
    const [tenantProfiles, setTenantProfiles] = useState<TenantProfile[]>([]);
    const [loadingProfiles, setLoadingProfiles] = useState(false);

    // Fetch tenant's uploaded profiles
    useEffect(() => {
        async function fetchTenantProfiles() {
            if (!tenantId) return;

            setLoadingProfiles(true);
            try {
                const { data, error } = await supabase
                    .from('color_profiles' as any)
                    .select('id, name')
                    .eq('tenant_id', tenantId)
                    .eq('kind', 'cmyk_output')
                    .order('name');

                if (!error && data) {
                    setTenantProfiles(data as TenantProfile[]);
                }
            } catch (err) {
                console.error('Failed to fetch tenant profiles:', err);
            } finally {
                setLoadingProfiles(false);
            }
        }

        fetchTenantProfiles();
    }, [tenantId]);

    // Check if user has switched away from product's profile
    const isUsingNonProductProfile = hasCustomProfile &&
        productProfileId &&
        settings.outputProfileId !== productProfileId &&
        settings.outputProfileId !== 'product';

    // Build the current profile display name
    const getCurrentProfileName = () => {
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
                        <strong>Fejl:</strong> {error}
                        <p className="mt-1">Soft proof er deaktiveret.</p>
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
                            <span>CMYK preview aktiv - {getCurrentProfileName()}</span>
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
            </div>

            {/* Gamut warning toggle */}
            <div className="flex items-center justify-between pt-2">
                <div className="space-y-0.5">
                    <Label className="text-xs font-medium">Gamut advarsel</Label>
                    <p className="text-xs text-muted-foreground">
                        Marker farver uden for CMYK
                    </p>
                </div>
                <Switch
                    checked={settings.showGamutWarning}
                    onCheckedChange={onSetShowGamutWarning}
                    disabled={!settings.enabled || !isReady}
                    aria-label="Vis gamut advarsel"
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
                    </div>
                </div>
            </div>

            {/* Legend when gamut warning is on */}
            {settings.enabled && settings.showGamutWarning && isReady && (
                <div className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 bg-green-500 rounded opacity-70"></div>
                    <span className="text-muted-foreground">
                        Farver markeret grønt er uden for CMYK gamut
                    </span>
                </div>
            )}
        </div>
    );
}

export default ColorProofingPanel;
