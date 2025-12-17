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
    type SavedDesign,
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
            // Get current settings to preserve history and auto-save current state
            const { data: current, error: fetchError } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', tenantId)
                .single();

            if (fetchError) throw fetchError;

            const currentSettings = (current as any)?.settings || {};
            const currentBranding = currentSettings.branding || {};
            const currentDraft = currentBranding.draft || currentBranding.published || {};

            // Auto-save current state before reset
            const savedDesigns = currentBranding.savedDesigns || [];
            const autoSaveEntry: SavedDesign = {
                id: `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: `Auto-gem før nulstil (${new Date().toLocaleDateString('da-DK')})`,
                data: mergeBrandingWithDefaults(currentDraft),
                createdAt: new Date().toISOString(),
                isAutoSave: true,
            };

            // Attempt to fetch Master Tenant branding to use as default
            let newDefault = DEFAULT_BRANDING;
            try {
                const { data: masterTenant } = await supabase
                    .from('tenants' as any)
                    .select('settings')
                    .eq('id', '00000000-0000-0000-0000-000000000000') // Master ID
                    .maybeSingle();

                if (masterTenant?.settings?.branding?.published) {
                    newDefault = mergeBrandingWithDefaults(masterTenant.settings.branding.published);
                } else if (masterTenant?.settings?.branding) {
                    // Legacy master format
                    newDefault = mergeBrandingWithDefaults(masterTenant.settings.branding);
                }
            } catch (e) {
                console.warn('Could not fetch master branding, using built-in defaults:', e);
            }

            const newSettings = {
                ...currentSettings,
                branding: {
                    ...currentBranding,
                    published: newDefault,
                    draft: newDefault,
                    savedDesigns: [autoSaveEntry, ...savedDesigns].slice(0, 20), // Keep last 20
                    history: currentBranding.history || [], // Preserve history
                }
            };

            const { error } = await supabase
                .from('tenants' as any)
                .update({ settings: newSettings })
                .eq('id', tenantId);

            if (error) throw error;

            return newDefault;
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

        // Saved Designs methods

        async saveDesign(name: string, data: BrandingData, isAutoSave?: boolean): Promise<SavedDesign> {
            const { data: current, error: fetchError } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', tenantId)
                .single();

            if (fetchError) throw fetchError;

            const currentSettings = (current as any)?.settings || {};
            const currentBranding = currentSettings.branding || {};
            const savedDesigns = currentBranding.savedDesigns || [];

            const newDesign: SavedDesign = {
                id: `design-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: name || `Design ${new Date().toLocaleDateString('da-DK')}`,
                data: data,
                createdAt: new Date().toISOString(),
                isAutoSave: isAutoSave || false,
            };

            const newSettings = {
                ...currentSettings,
                branding: {
                    ...currentBranding,
                    savedDesigns: [newDesign, ...savedDesigns].slice(0, 20), // Keep last 20
                }
            };

            const { error } = await supabase
                .from('tenants' as any)
                .update({ settings: newSettings })
                .eq('id', tenantId);

            if (error) throw error;

            return newDesign;
        },

        async loadSavedDesigns(): Promise<SavedDesign[]> {
            const { data, error } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', tenantId)
                .single();

            if (error) throw error;

            const settings = (data as any)?.settings || {};
            const branding = settings.branding || {};
            return branding.savedDesigns || [];
        },

        async loadSavedDesign(id: string): Promise<BrandingData> {
            const savedDesigns = await this.loadSavedDesigns();
            const design = savedDesigns.find(d => d.id === id);

            if (!design) {
                throw new Error('Design not found');
            }

            return design.data;
        },

        async deleteSavedDesign(id: string): Promise<void> {
            const { data: current, error: fetchError } = await supabase
                .from('tenants' as any)
                .select('settings')
                .eq('id', tenantId)
                .single();

            if (fetchError) throw fetchError;

            const currentSettings = (current as any)?.settings || {};
            const currentBranding = currentSettings.branding || {};
            const savedDesigns = (currentBranding.savedDesigns || []).filter((d: SavedDesign) => d.id !== id);

            const newSettings = {
                ...currentSettings,
                branding: {
                    ...currentBranding,
                    savedDesigns,
                }
            };

            const { error } = await supabase
                .from('tenants' as any)
                .update({ settings: newSettings })
                .eq('id', tenantId);

            if (error) throw error;
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
