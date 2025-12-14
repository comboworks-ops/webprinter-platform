/**
 * Tenant Branding Storage Adapter
 * 
 * Handles branding data operations for tenant shop owners.
 * Data is stored in the tenant's settings in the tenants table.
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
    type BrandingStorageAdapter,
    type BrandingData,
    type BrandingHistoryEntry,
    DEFAULT_BRANDING,
    mergeBrandingWithDefaults,
} from './types';

export function createTenantAdapter(
    tenantId: string,
    tenantName: string
): BrandingStorageAdapter {

    return {
        mode: 'tenant',
        entityId: tenantId,
        entityName: tenantName,

        async loadDraft(): Promise<BrandingData> {
            const { data, error } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', tenantId)
                .single();

            if (error) {
                console.error('Error loading tenant draft:', error);
                throw error;
            }

            const settings = (data as any)?.settings || {};
            const branding = settings.branding || {};

            // Check for older legacy format (root level keys in settings)
            if (settings.branding_draft) {
                return mergeBrandingWithDefaults(settings.branding_draft);
            }

            // Check for legacy format (branding object is the data itself, not a container)
            // If it doesn't have explicit 'draft' or 'published' keys, assume it's the branding data
            if (branding && !branding.draft && !branding.published) {
                // If it's an empty object, mergeBrandingWithDefaults returns defaults, which is fine
                return mergeBrandingWithDefaults(branding);
            }

            // Standard new format
            return mergeBrandingWithDefaults({
                ...branding.published, // Spread published first to get baseline
                ...branding.draft,     // Overlay draft updates
            });
        },

        async loadPublished(): Promise<BrandingData> {
            const { data, error } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', tenantId)
                .single();

            if (error) {
                console.error('Error loading tenant published:', error);
                throw error;
            }

            const settings = (data as any)?.settings || {};
            const branding = settings.branding || {};

            // Check for older legacy format
            if (settings.branding_published) {
                return mergeBrandingWithDefaults(settings.branding_published);
            }

            // Check for legacy format
            if (branding && !branding.draft && !branding.published) {
                return mergeBrandingWithDefaults(branding);
            }

            return mergeBrandingWithDefaults(branding.published || {});
        },

        async saveDraft(data: BrandingData): Promise<void> {
            // Get current settings first
            const { data: current, error: fetchError } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', tenantId)
                .single();

            if (fetchError) throw fetchError;

            const currentSettings = (current as any)?.settings || {};
            const currentBranding = currentSettings.branding || {};

            const newSettings = {
                ...currentSettings,
                branding: {
                    ...currentBranding,
                    draft: data
                }
            };

            const { error } = await supabase
                .from('tenants' as any)
                .update({ settings: newSettings })
                .eq('id', tenantId);

            if (error) throw error;
        },

        async publish(data: BrandingData, label?: string): Promise<void> {
            // Get current settings
            const { data: current, error: fetchError } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', tenantId)
                .single();

            if (fetchError) throw fetchError;

            const currentSettings = (current as any)?.settings || {};
            const currentBranding = currentSettings.branding || {};

            const historyEntry: BrandingHistoryEntry = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                label: label || `Publiceret ${new Date().toLocaleDateString('da-DK')}`,
                data: currentBranding.published || DEFAULT_BRANDING,
                timestamp: new Date().toISOString(),
            };

            const history = currentBranding.history || [];

            const newSettings = {
                ...currentSettings,
                branding: {
                    ...currentBranding,
                    published: data,
                    draft: data, // Draft = published after publish
                    history: [historyEntry, ...history].slice(0, 20), // Keep last 20
                }
            };

            const { error } = await supabase
                .from('tenants' as any)
                .update({ settings: newSettings })
                .eq('id', tenantId);

            if (error) throw error;
        },

        async discardDraft(): Promise<BrandingData> {
            const published = await this.loadPublished();
            await this.saveDraft(published);
            return published;
        },

        async resetToDefault(): Promise<BrandingData> {
            // Get current settings to preserve history
            const { data: current, error: fetchError } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', tenantId)
                .single();

            if (fetchError) throw fetchError;

            const currentSettings = (current as any)?.settings || {};
            const currentBranding = currentSettings.branding || {};

            const newSettings = {
                ...currentSettings,
                branding: {
                    ...currentBranding,
                    published: DEFAULT_BRANDING,
                    draft: DEFAULT_BRANDING,
                }
            };

            const { error } = await supabase
                .from('tenants' as any)
                .update({ settings: newSettings })
                .eq('id', tenantId);

            if (error) throw error;

            return DEFAULT_BRANDING;
        },

        async loadHistory(): Promise<BrandingHistoryEntry[]> {
            const { data, error } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', tenantId)
                .single();

            if (error) throw error;

            const settings = (data as any)?.settings || {};
            const branding = settings.branding || {};
            return branding.history || [];
        },

        async restoreVersion(versionId: string): Promise<BrandingData> {
            const history = await this.loadHistory();
            const version = history.find(h => h.id === versionId);

            if (!version) {
                throw new Error('Version not found');
            }

            await this.saveDraft(version.data);
            return version.data;
        },

        async uploadAsset(file: File, type: 'logo' | 'hero-image' | 'hero-video'): Promise<string> {
            const fileExt = file.name.split('.').pop();
            const fileName = `${type}-${Date.now()}.${fileExt}`;
            const filePath = `branding/${tenantId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('product-images')
                .getPublicUrl(filePath);

            return publicUrl;
        },

        async deleteAsset(url: string): Promise<void> {
            // Extract path from URL and delete
            try {
                const urlObj = new URL(url);
                const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/product-images\/(.+)/);
                if (pathMatch) {
                    await supabase.storage
                        .from('product-images')
                        .remove([pathMatch[1]]);
                }
            } catch (e) {
                console.warn('Could not delete asset:', e);
            }
        },
    };
}
