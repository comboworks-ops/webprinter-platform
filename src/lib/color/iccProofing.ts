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
    role: 'cmyk_output';
    process: 'offset_coated' | 'offset_uncoated';
    material: string;
    characterization: string;
    usageNote: string;
    legacy?: boolean;
    sha256?: string;
    availability: 'bundled' | 'install_required';
    downloadUrl?: string;
    licenseNote: string;
}

// Built-in output profiles (CMYK print standards)
// Profile distribution terms are separate from the color engine license.
export const OUTPUT_PROFILES: ICCProfile[] = [
    {
        id: 'fogra39',
        name: 'ISO Coated v2 300% (FOGRA39)',
        description: 'Bestrøget papir – ældre leverandørkrav, 300% samlet farvedækning.',
        url: '/icc/ISOcoated_v2_300_eci.icc',
        role: 'cmyk_output',
        process: 'offset_coated',
        material: 'Bestrøget papir',
        characterization: 'FOGRA39',
        usageNote: 'Behold til eksisterende produkter eller når trykkeriet kræver ISO Coated v2 300%.',
        legacy: true,
        sha256: 'c6b4b62f0726243742eced8b9669476a6be89e581f50a7600ed8b6fcbb9cdab8',
        availability: 'bundled',
        licenseNote: 'Eksisterende profil i systemet. Profilens rettigheder er adskilt fra farvemotorens licens.',
    },
    {
        id: 'fogra51',
        name: 'PSO Coated v3 (FOGRA51)',
        description: 'Moderne europæisk offset på premium bestrøget papir.',
        url: '/icc/PSOcoated_v3.icc',
        role: 'cmyk_output',
        process: 'offset_coated',
        material: 'Premium bestrøget papir',
        characterization: 'FOGRA51',
        usageNote: 'Vælg når trykkeriet arbejder efter denne trykbetingelse. Er ikke en universel profil til storformat eller tøj.',
        sha256: 'c30ad2c01e8f93135ec7682c535e0a81bc2d177c301e196376c5f5838b5c8e86',
        availability: 'install_required',
        downloadUrl: 'https://registry.color.org/profile-registry/profiles/PSOcoated_v3.icc',
        licenseNote: 'ECI-profil. Hent fra den officielle kilde og upload til din butik efter profilens vilkår. Distribueres ikke i appens produktionsbundle.',
    },
    {
        id: 'fogra52',
        name: 'PSO Uncoated v3 (FOGRA52)',
        description: 'Europæisk offset på ubestrøget papir med optisk hvidt.',
        url: '/icc/PSOuncoated_v3_FOGRA52.icc',
        role: 'cmyk_output',
        process: 'offset_uncoated',
        material: 'Ubestrøget papir med optisk hvidt',
        characterization: 'FOGRA52',
        usageNote: 'Brug til den aftalte ubestrøgne trykbetingelse; ikke alle ubestrøgne papirer matcher FOGRA52.',
        sha256: '7c39f74fbede1e8c85f8fbb9df7d359aea638b9b68dd0854fdd3ba386e3a02c0',
        availability: 'install_required',
        downloadUrl: 'https://registry.color.org/profile-registry/profiles/PSOuncoated_v3_FOGRA52.icc',
        licenseNote: 'ECI-profil. Hent fra den officielle kilde og upload til din butik efter profilens vilkår. Distribueres ikke i appens produktionsbundle.',
    },
];

// Default sRGB input profile (bundled)
export const SRGB_PROFILE_URL = '/icc/sRGB_IEC61966-2-1.icc';
export const SRGB_INPUT_PROFILE = {
    id: 'srgb',
    name: 'sRGB IEC61966-2-1',
    role: 'rgb_working' as const,
    url: SRGB_PROFILE_URL,
    description: 'Kilderum for browserens RGB-design. Beskriver farverne i filen; er ikke en CMYK-outputprofil.',
    sha256: 'b3599c68b79236e5ce69d8dd22178157553631c5fe829130602cde98d8764790',
};

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
