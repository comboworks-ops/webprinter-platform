/**
 * useProductColorProfile Hook
 * 
 * Fetches the product's assigned CMYK output profile and loads the ICC data.
 * Used by the Designer to auto-load the correct profile for soft proofing.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ColorProfileData {
    id: string;
    name: string;
    profileBytes: ArrayBuffer | null;
    loading: boolean;
    error: string | null;
}

interface UseProductColorProfileOptions {
    productId: string | null;
    enabled?: boolean; // Only fetch when needed
}

interface UseProductColorProfileReturn {
    profile: ColorProfileData;
    refetch: () => void;
}

const INITIAL_PROFILE: ColorProfileData = {
    id: '',
    name: '',
    profileBytes: null,
    loading: false,
    error: null,
};

export function useProductColorProfile({
    productId,
    enabled = true,
}: UseProductColorProfileOptions): UseProductColorProfileReturn {
    const [profile, setProfile] = useState<ColorProfileData>(INITIAL_PROFILE);

    const fetchProfile = useCallback(async () => {
        if (!productId || !enabled) {
            setProfile(INITIAL_PROFILE);
            return;
        }

        setProfile((prev) => ({ ...prev, loading: true, error: null }));

        try {
            // 1. Fetch product to get output_color_profile_id
            const { data: product, error: productError } = await supabase
                .from('products')
                .select('output_color_profile_id')
                .eq('id', productId)
                .single();

            if (productError) throw productError;

            const profileId = product?.output_color_profile_id;
            if (!profileId) {
                // No custom profile assigned - use default
                setProfile({
                    id: '',
                    name: '',
                    profileBytes: null,
                    loading: false,
                    error: null,
                });
                return;
            }

            // 2. Fetch color profile metadata
            const { data: colorProfile, error: profileError } = await supabase
                .from('color_profiles' as any)
                .select('id, name, storage_path')
                .eq('id', profileId)
                .single();

            if (profileError) throw profileError;
            if (!colorProfile) {
                throw new Error('Farveprofil ikke fundet');
            }

            // 3. Download ICC file from storage
            const { data: fileData, error: downloadError } = await supabase.storage
                .from('color-profiles')
                .download((colorProfile as any).storage_path);

            if (downloadError) {
                console.warn('Could not download ICC profile:', downloadError);
                throw new Error('Kunne ikke hente farveprofil fil');
            }

            // Convert Blob to ArrayBuffer
            const arrayBuffer = await fileData.arrayBuffer();

            // Validate ICC Signature ('acsp' at offset 36)
            if (arrayBuffer.byteLength < 128) {
                console.warn('Downloaded ICC profile is too small:', arrayBuffer.byteLength);
                throw new Error('Ugyldig farveprofil (filen er for lille)');
            }

            const view = new DataView(arrayBuffer);
            const signature = view.getUint32(36, false); // Big endian
            // 0x61637370 = 'acsp'
            if (signature !== 0x61637370) {
                console.warn('Invalid ICC signature:', signature.toString(16));
                const text = new TextDecoder().decode(arrayBuffer.slice(0, 100)); // Peek content
                console.warn('Content preview:', text);
                throw new Error('Ugyldig farveprofil (forkert format)');
            }

            setProfile({
                id: (colorProfile as any).id,
                name: (colorProfile as any).name,
                profileBytes: arrayBuffer,
                loading: false,
                error: null,
            });

            console.log(`Loaded ICC profile: ${(colorProfile as any).name} (${arrayBuffer.byteLength} bytes)`);

        } catch (err: any) {
            console.error('Failed to load product color profile:', err);
            setProfile({
                id: '',
                name: '',
                profileBytes: null,
                loading: false,
                error: err.message || 'Kunne ikke indlæse farveprofil',
            });

            // Show toast only once on error
            toast.error('Farveprofil kunne ikke indlæses - bruger standard profil');
        }
    }, [productId, enabled]);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    return {
        profile,
        refetch: fetchProfile,
    };
}

export default useProductColorProfile;
