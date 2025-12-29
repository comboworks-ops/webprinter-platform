/**
 * ICC Color Proofing Configuration and Helpers
 * 
 * Provides soft proof preview for CMYK output simulation
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
        description: 'European standard for coated paper printing',
        url: '/icc/ISOcoated_v2_300_eci.icc',
    },
    {
        id: 'fogra51',
        name: 'PSO Coated v3 (FOGRA51)',
        description: 'Modern European coated paper standard',
        url: '/icc/PSOcoated_v3.icc',
    },
    {
        id: 'swop',
        name: 'US Web Coated (SWOP) v2',
        description: 'American standard for web offset printing',
        url: '/icc/USWebCoatedSWOP.icc',
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
            return { ...DEFAULT_PROOFING_SETTINGS, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.warn('Failed to load proofing settings:', e);
    }
    return DEFAULT_PROOFING_SETTINGS;
}

// Save proofing settings to localStorage
export function saveProofingSettings(settings: ProofingSettings): void {
    try {
        localStorage.setItem('designer_proofing_settings', JSON.stringify(settings));
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
