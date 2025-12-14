/**
 * Master Branding Storage Adapter
 * 
 * Handles branding template data operations for the platform owner (Master Admin).
 * Data is stored in a dedicated master_branding_template row or in the master tenant settings.
 */

import { supabase } from '@/integrations/supabase/client';
import {
    type BrandingStorageAdapter,
    type BrandingData,
    type BrandingHistoryEntry,
    DEFAULT_BRANDING,
    mergeBrandingWithDefaults,
} from './types';

// Master tenant UUID
const MASTER_TENANT_ID = '00000000-0000-0000-0000-000000000000';

export function createMasterAdapter(): BrandingStorageAdapter {

    return {
        mode: 'master',
        entityId: MASTER_TENANT_ID,
        entityName: 'Platform Skabelon',

        async loadDraft(): Promise<BrandingData> {
            const { data, error } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', MASTER_TENANT_ID)
                .single();

            if (error) {
                console.error('Error loading master draft:', error);
                // Return defaults if master tenant doesn't exist
                return DEFAULT_BRANDING;
            }

            const settings = (data as any)?.settings || {};
            return mergeBrandingWithDefaults({
                ...settings.branding_template_draft,
                ...settings.branding_template_published,
            });
        },

        async loadPublished(): Promise<BrandingData> {
            const { data, error } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', MASTER_TENANT_ID)
                .single();

            if (error) {
                console.error('Error loading master published:', error);
                return DEFAULT_BRANDING;
            }

            const settings = (data as any)?.settings || {};
            return mergeBrandingWithDefaults(settings.branding_template_published || {});
        },

        async saveDraft(data: BrandingData): Promise<void> {
            // Get current settings first
            const { data: current, error: fetchError } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', MASTER_TENANT_ID)
                .single();

            if (fetchError) {
                // Master tenant might not exist, try to create
                console.warn('Master tenant not found, using local storage fallback');
                localStorage.setItem('master_branding_draft', JSON.stringify(data));
                return;
            }

            const currentSettings = (current as any)?.settings || {};
            const newSettings = {
                ...currentSettings,
                branding_template_draft: data,
            };

            const { error } = await supabase
                .from('tenants' as any)
                .update({ settings: newSettings })
                .eq('id', MASTER_TENANT_ID);

            if (error) throw error;
        },

        async publish(data: BrandingData, label?: string): Promise<void> {
            // Get current settings
            const { data: current, error: fetchError } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', MASTER_TENANT_ID)
                .single();

            if (fetchError) throw fetchError;

            const currentSettings = (current as any)?.settings || {};
            const historyEntry: BrandingHistoryEntry = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                label: label || `Skabelon ${new Date().toLocaleDateString('da-DK')}`,
                data: currentSettings.branding_template_published || DEFAULT_BRANDING,
                timestamp: new Date().toISOString(),
            };

            const history = currentSettings.branding_template_history || [];

            const newSettings = {
                ...currentSettings,
                branding_template_published: data,
                branding_template_draft: data,
                branding_template_history: [historyEntry, ...history].slice(0, 20),
            };

            const { error } = await supabase
                .from('tenants' as any)
                .update({ settings: newSettings })
                .eq('id', MASTER_TENANT_ID);

            if (error) throw error;
        },

        async discardDraft(): Promise<BrandingData> {
            const published = await this.loadPublished();
            await this.saveDraft(published);
            return published;
        },

        async resetToDefault(): Promise<BrandingData> {
            const { data: current, error: fetchError } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', MASTER_TENANT_ID)
                .single();

            if (fetchError) throw fetchError;

            const currentSettings = (current as any)?.settings || {};
            const newSettings = {
                ...currentSettings,
                branding_template_published: DEFAULT_BRANDING,
                branding_template_draft: DEFAULT_BRANDING,
            };

            const { error } = await supabase
                .from('tenants' as any)
                .update({ settings: newSettings })
                .eq('id', MASTER_TENANT_ID);

            if (error) throw error;

            return DEFAULT_BRANDING;
        },

        async loadHistory(): Promise<BrandingHistoryEntry[]> {
            const { data, error } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', MASTER_TENANT_ID)
                .single();

            if (error) return [];

            const settings = (data as any)?.settings || {};
            return settings.branding_template_history || [];
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
            const filePath = `branding/master/${fileName}`;

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

/**
 * Load the published master template for use in tenant "Apply Template" feature.
 */
export async function loadMasterTemplate(): Promise<BrandingData> {
    const adapter = createMasterAdapter();
    return adapter.loadPublished();
}
