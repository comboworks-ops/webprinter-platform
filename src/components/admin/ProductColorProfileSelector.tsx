/**
 * ProductColorProfileSelector
 * 
 * Component for selecting a default CMYK output profile for a product.
 * Used in the product admin UI.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveAdminTenant } from '@/lib/adminTenant';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Palette, Loader2 } from 'lucide-react';

interface ColorProfile {
    id: string;
    name: string;
    kind: string;
}

interface ProductColorProfileSelectorProps {
    productId: string;
    currentProfileId: string | null;
    onProfileChange: (profileId: string | null) => void;
    disabled?: boolean;
}

export function ProductColorProfileSelector({
    productId,
    currentProfileId,
    onProfileChange,
    disabled = false,
}: ProductColorProfileSelectorProps) {
    const [profiles, setProfiles] = useState<ColorProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchProfiles() {
            try {
                const { tenantId } = await resolveAdminTenant();
                if (!tenantId) return;

                const { data, error } = await supabase
                    .from('color_profiles' as any)
                    .select('id, name, kind')
                    .eq('tenant_id', tenantId)
                    .eq('kind', 'cmyk_output')
                    .order('name');

                if (error) throw error;
                setProfiles((data || []) as ColorProfile[]);
            } catch (err) {
                console.error('Failed to fetch color profiles:', err);
            } finally {
                setLoading(false);
            }
        }

        fetchProfiles();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Indlæser farveprofiler...</span>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <Label className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                CMYK Output Profil (Soft Proof)
            </Label>
            <Select
                value={currentProfileId || 'none'}
                onValueChange={(value) => onProfileChange(value === 'none' ? null : value)}
                disabled={disabled}
            >
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Vælg farveprofil..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">
                        <span className="text-muted-foreground">Brug standard (FOGRA39)</span>
                    </SelectItem>
                    {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                            {profile.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
                Denne profil bruges automatisk når kunder designer til dette produkt
            </p>
        </div>
    );
}

export default ProductColorProfileSelector;
