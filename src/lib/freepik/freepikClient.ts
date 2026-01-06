import { supabase } from "@/integrations/supabase/client";
import {
    FreepikSearchFilters,
    FreepikSearchResponse,
    FreepikResource
} from "./types";

/**
 * Freepik API Client
 * 
 * Interacts with the 'freepik-proxy' Supabase Edge Function to securely 
 * browse and import assets from Freepik.
 */
export class FreepikClient {
    /**
     * Search for resources on Freepik
     */
    static async search(filters: FreepikSearchFilters): Promise<FreepikSearchResponse> {
        console.log('[FreepikClient] Searching with filters:', filters);

        const { data, error } = await supabase.functions.invoke('freepik-proxy', {
            body: {
                action: 'search',
                params: filters
            }
        });

        if (error) {
            console.error('[FreepikClient] Search error:', error);
            throw new Error(`Freepik search failed: ${error.message}`);
        }

        return data as FreepikSearchResponse;
    }

    /**
     * Get details for a specific resource
     */
    static async getResource(id: number): Promise<FreepikResource> {
        const { data, error } = await supabase.functions.invoke('freepik-proxy', {
            body: {
                action: 'get_resource',
                params: { id }
            }
        });

        if (error) {
            throw new Error(`Failed to get Freepik resource: ${error.message}`);
        }

        return data as FreepikResource;
    }

    /**
     * Import a Freepik resource into the Design Library
     * This triggers the edge function to download the file and store it in Supabase
     */
    static async importToLibrary(resourceId: number): Promise<{ success: boolean; itemId?: string }> {
        const { data, error } = await supabase.functions.invoke('freepik-proxy', {
            body: {
                action: 'download',
                params: { id: resourceId }
            }
        });

        if (error) {
            console.error('[FreepikClient] Import error:', error);
            throw new Error(`Freepik import failed: ${error.message}`);
        }

        return data as { success: boolean; itemId?: string };
    }
}
