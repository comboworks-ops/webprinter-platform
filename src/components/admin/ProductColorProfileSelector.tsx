import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveAdminTenant } from '@/lib/adminTenant';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette, Loader2 } from 'lucide-react';
import { OUTPUT_PROFILES } from '@/lib/color/iccProofing';
import { resolveColorProfile } from '@/lib/color/profileResolver';
import { PRINT_PROCESS_GUIDANCE, getPrintProcessGuidance, type ProductColorRecipe, type PrintProcess } from '@/lib/color/profileGuidance';

interface ColorProfile { id: string; name: string; kind: string; }
interface ProductColorProfileSelectorProps {
    productId: string;
    currentProfileId: string | null;
    onProfileChange: (profileId: string | null) => void;
    recipe?: ProductColorRecipe | null;
    onRecipeChange?: (recipe: ProductColorRecipe | null) => void;
    disabled?: boolean;
}

/** UUID assignment stays in the existing FK. Standard recipes use technical_specs.color_management. */
export function ProductColorProfileSelector({ productId, currentProfileId, onProfileChange, recipe, onRecipeChange, disabled = false }: ProductColorProfileSelectorProps) {
    const [profiles, setProfiles] = useState<ColorProfile[]>([]);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [availability, setAvailability] = useState<Record<string, string | null>>({});
    const selectionVersion = useRef(0);

    useEffect(() => {
        let active = true;
        selectionVersion.current++;
        setLoading(true); setProfiles([]); setAvailability({}); setError(null); setChecking(false);
        void (async () => {
            try {
                const { tenantId: resolvedTenantId } = await resolveAdminTenant();
                if (!resolvedTenantId) throw new Error('Butikken kunne ikke bestemmes.');
                const { data, error: queryError } = await supabase.from('color_profiles' as never)
                    .select('id, name, kind').eq('tenant_id', resolvedTenantId).eq('kind', 'cmyk_output').order('name');
                if (queryError) throw new Error('Butikkens profiler kunne ikke hentes.');
                if (!active) return;
                setTenantId(resolvedTenantId); setProfiles((data || []) as ColorProfile[]);
                await Promise.all(OUTPUT_PROFILES.map(async profile => {
                    let issue: string | null = null;
                    try { await resolveColorProfile({ id: profile.id, tenantId: resolvedTenantId }); }
                    catch (reason) { issue = reason instanceof Error ? reason.message : 'Profilen er ikke klar.'; }
                    if (active) setAvailability(previous => ({ ...previous, [profile.id]: issue }));
                }));
            } catch (reason) {
                if (active) setError(reason instanceof Error ? reason.message : 'Farveprofilerne kunne ikke hentes.');
            } finally { if (active) setLoading(false); }
        })();
        return () => { active = false; selectionVersion.current++; };
    }, [productId]);

    const currentSelection = recipe?.outputProfileId || currentProfileId || 'none';
    const process = recipe?.process || 'unspecified';
    const baseRecipe: ProductColorRecipe = recipe || { version: 1, process: 'unspecified', sourceColorSpace: 'sRGB' };
    const chooseProfile = async (id: string) => {
        const version = ++selectionVersion.current;
        setError(null);
        if (id === 'none') {
            const { outputProfileId: _removed, ...rest } = baseRecipe;
            onProfileChange(null); onRecipeChange?.(rest); return;
        }
        setChecking(true);
        try {
            await resolveColorProfile({ id, tenantId });
            if (version !== selectionVersion.current) return;
            if (OUTPUT_PROFILES.some(profile => profile.id === id)) {
                if (!onRecipeChange) throw new Error('Produktets standardprofilvalg er ikke tilsluttet.');
                onProfileChange(null); onRecipeChange({ ...baseRecipe, outputProfileId: id });
            } else {
                const { outputProfileId: _removed, ...rest } = baseRecipe;
                onProfileChange(id); onRecipeChange?.(rest);
            }
        } catch (reason) {
            if (version === selectionVersion.current) setError(reason instanceof Error ? reason.message : 'Profilen kunne ikke indlæses.');
        } finally { if (version === selectionVersion.current) setChecking(false); }
    };

    return <div className="space-y-4 rounded-md border p-4">
        <Label className="flex items-center gap-2"><Palette className="h-4 w-4" /> Farveprofil og trykmetode</Label>
        {onRecipeChange && <div className="space-y-2">
            <Label htmlFor="product-print-process" className="text-sm">Trykmetode</Label>
            <Select value={process} disabled={disabled || checking} onValueChange={value => onRecipeChange({ ...baseRecipe, process: value as PrintProcess })}>
                <SelectTrigger id="product-print-process"><SelectValue /></SelectTrigger><SelectContent>
                    {PRINT_PROCESS_GUIDANCE.map(item => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
                </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{getPrintProcessGuidance(process).guidance}</p>
        </div>}
        {onRecipeChange && <div className="space-y-2">
            <Label htmlFor="product-production-color-mode">Farver i nye produktionsfiler</Label>
            <Select value={recipe?.productionColorMode || 'default'} disabled={disabled || checking} onValueChange={value => {
                const { productionColorMode: _removed, ...rest } = baseRecipe;
                onRecipeChange(value === 'default' ? rest : { ...rest, productionColorMode: value as ProductColorRecipe['productionColorMode'] });
            }}>
                <SelectTrigger id="product-production-color-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="default">Standard for trykmetoden</SelectItem>
                    <SelectItem value="convert_cmyk">CMYK via den valgte profil</SelectItem>
                    <SelectItem value="preserve_rgb">sRGB – leverandøren konverterer</SelectItem>
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Vælg efter leverandørens filkrav. Produktets standard bruges, indtil et leverandørkrav vælges. Soft proof-valget kan bruges til begge.</p>
        </div>}
        <div className="space-y-2">
            <Label htmlFor="product-output-color-profile">Produktets CMYK-profil til soft proof</Label>
            <Select value={currentSelection} onValueChange={value => void chooseProfile(value)} disabled={disabled || loading || checking}>
                <SelectTrigger id="product-output-color-profile"><SelectValue placeholder="Vælg farveprofil…" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">Ingen produktspecifik profil (soft proof: FOGRA39)</SelectItem>
                    {onRecipeChange && OUTPUT_PROFILES.map(profile => <SelectItem key={profile.id} value={profile.id} disabled={Boolean(availability[profile.id]) || !(profile.id in availability)}>
                        {profile.name}{availability[profile.id] ? ' – ikke klar' : ''}
                    </SelectItem>)}
                    {profiles.map(profile => <SelectItem key={profile.id} value={profile.id}>{profile.name}</SelectItem>)}
                    {currentProfileId && !profiles.some(profile => profile.id === currentProfileId) && <SelectItem value={currentProfileId}>Gemt profil – {currentProfileId}</SelectItem>}
                </SelectContent>
            </Select>
            {(loading || checking) && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" /> Kontrollerer profilens fil…</p>}
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            {availability[currentSelection] && <p className="text-sm text-amber-700">{availability[currentSelection]}</p>}
            <p className="text-xs text-muted-foreground">sRGB er browserdesignets kilderum. CMYK-profilen beskriver en trykbetingelse; den ændrer ikke automatisk leverandørens filkrav.</p>
            <p className="text-xs text-muted-foreground">Manglende standardprofil: hent den officielle ICC-fil og installer den under Farveprofiler. Eksisterende produktvalg ændres først, når du gemmer produktet.</p>
        </div>
    </div>;
}
export default ProductColorProfileSelector;
