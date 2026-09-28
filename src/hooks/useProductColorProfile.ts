import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveColorProfile, type ResolvedColorProfile } from '@/lib/color/profileResolver';
import { getProductProfileSelection, readProductColorRecipe, type ProductColorRecipe } from '@/lib/color/profileGuidance';

export interface ColorProfileData {
    id: string;
    name: string;
    profileBytes: ArrayBuffer | null;
    loading: boolean;
    error: string | null;
    tenantId: string | null;
    recipe: ProductColorRecipe | null;
    resolved: ResolvedColorProfile | null;
}
interface UseProductColorProfileOptions { productId: string | null; enabled?: boolean; }
const INITIAL_PROFILE: ColorProfileData = {
    id: '', name: '', profileBytes: null, loading: false, error: null,
    tenantId: null, recipe: null, resolved: null,
};

/** Product-scoped selection; stale requests never replace a newer product's profile. */
export function useProductColorProfile({ productId, enabled = true }: UseProductColorProfileOptions) {
    const [state, setState] = useState<{ productId: string | null; profile: ColorProfileData }>({ productId: null, profile: INITIAL_PROFILE });
    const [revision, setRevision] = useState(0);
    const requestVersion = useRef(0);
    const refetch = useCallback(() => setRevision(value => value + 1), []);

    useEffect(() => {
        const version = ++requestVersion.current;
        const publish = (profile: ColorProfileData) => {
            if (version === requestVersion.current) setState({ productId, profile });
        };
        if (!productId || !enabled) {
            publish(INITIAL_PROFILE);
            return;
        }
        publish({ ...INITIAL_PROFILE, loading: true });
        void (async () => {
            let tenantId: string | null = null;
            let recipe: ProductColorRecipe | null = null;
            let selectedId = '';
            try {
                const { data, error } = await supabase.from('products')
                    .select('output_color_profile_id, technical_specs, tenant_id').eq('id', productId).single();
                if (error || !data) throw new Error('Produktets farveindstillinger kunne ikke hentes.');
                // The existing migration predates the generated schema; keep this contract local.
                const product = data as unknown as { tenant_id: string; technical_specs: unknown; output_color_profile_id: string | null };
                tenantId = product.tenant_id;
                recipe = readProductColorRecipe(product.technical_specs);
                selectedId = getProductProfileSelection(product) || '';
                if (!selectedId) {
                    publish({ ...INITIAL_PROFILE, tenantId, recipe });
                    return;
                }
                const resolved = await resolveColorProfile({ id: selectedId, tenantId });
                publish({ id: resolved.id, name: resolved.name, profileBytes: resolved.bytes,
                    loading: false, error: null, tenantId, recipe, resolved });
            } catch (error) {
                publish({ ...INITIAL_PROFILE, id: selectedId, tenantId, recipe,
                    error: error instanceof Error ? error.message : 'Produktets farveprofil kunne ikke indlæses.' });
            }
        })();
        return () => { requestVersion.current++; };
    }, [productId, enabled, revision]);

    // Hide the previous product's bytes during the render before effect cleanup.
    const profile = state.productId === productId && enabled
        ? state.profile
        : { ...INITIAL_PROFILE, loading: Boolean(productId && enabled) };
    return { profile, refetch };
}

export default useProductColorProfile;
