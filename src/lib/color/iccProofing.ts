/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                        🔒 PROTECTED CORE FILE 🔒                          ║
 * ║                                                                           ║
 * ║  This file contains critical soft proofing functionality.                 ║
 * ║  DO NOT MODIFY without reviewing: /soft-proof-protected                   ║
 * ║                                                                           ║
 * ║  Last verified working: 2026-01-03                                        ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * ICC Color Proofing Configuration and Helpers
 * 
 * Provides configuration, types, and utilities for soft proof CMYK simulation.
 */

// Available output profiles
export interface ICCProfile {
    id: string;
    name: string;
    description: string;
    url: string; // Path to bundled .icc file or URL
}

// Built-in output profiles (CMYK print standards)
// Note: We use public domain / open-source ICC profiles
export const OUTPUT_PROFILES: ICCProfile[] = [
    {
        id: 'fogra39',
        name: 'ISO Coated v2 (FOGRA39)',
        description: 'Standard coated paper (European)',
        url: '/icc/ISOcoated_v2_300_eci.icc',
    },
];

// Default sRGB input profile (bundled)
export const SRGB_PROFILE_URL = '/icc/sRGB_IEC61966-2-1.icc';

// Proofing settings
export interface ProofingSettings {
    enabled: boolean;
    outputProfileId: string;
    showGamutWarning: boolean;
    gamutWarningColor: string;
    // Custom profile support (per-product)
    customProfileId?: string;
    customProfileName?: string;
    customProfileBytes?: ArrayBuffer | null;
}

// Default proofing settings
export const DEFAULT_PROOFING_SETTINGS: ProofingSettings = {
    enabled: false,
    outputProfileId: 'fogra39',
    showGamutWarning: false,
    gamutWarningColor: '#00ff00', // Bright green for out-of-gamut
    customProfileId: undefined,
    customProfileName: undefined,
    customProfileBytes: null,
};

// Get proofing settings from localStorage
export function loadProofingSettings(): ProofingSettings {
    try {
        const stored = localStorage.getItem('designer_proofing_settings');
        if (stored) {
            const parsed = JSON.parse(stored);
            // CRITICAL: Always strip customProfileBytes from storage as they can't be serialized safely
            // and might be corrupted residuals from previous versions.
            return {
                ...DEFAULT_PROOFING_SETTINGS,
                ...parsed,
                customProfileBytes: null
            };
        }
    } catch (e) {
        console.warn('Failed to load proofing settings:', e);
    }
    return DEFAULT_PROOFING_SETTINGS;
}

// Save proofing settings to localStorage (excludes binary data)
export function saveProofingSettings(settings: ProofingSettings): void {
    try {
        // Create a copy without the large binary bytes
        const { customProfileBytes: _, ...persistable } = settings;
        localStorage.setItem('designer_proofing_settings', JSON.stringify(persistable));
    } catch (e) {
        console.warn('Failed to save proofing settings:', e);
    }
}

// Fetch ICC profile as ArrayBuffer
export async function fetchICCProfile(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ICC profile: ${url}`);
    }
    return response.arrayBuffer();
}

// Get profile by ID
export function getProfileById(id: string): ICCProfile | undefined {
    return OUTPUT_PROFILES.find(p => p.id === id);
}

// Message types for worker communication
export interface ProofingWorkerMessage {
    type: 'init' | 'transform' | 'dispose';
    id: string;
    inputProfileData?: ArrayBuffer;
    outputProfileData?: ArrayBuffer;
    imageData?: ImageData;
    width?: number;
    height?: number;
    showGamutWarning?: boolean;
    gamutWarningColor?: string;
}

export interface ProofingWorkerResponse {
    type: 'ready' | 'transformed' | 'error' | 'disposed';
    id: string;
    imageData?: ImageData;
    gamutMask?: ImageData; // Out-of-gamut pixels
    error?: string;
}
