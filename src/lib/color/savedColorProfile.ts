export interface SavedColorProfile {
    version: 1;
    id: string;
    name: string;
    sha256?: string;
    productionColorMode?: 'convert_cmyk' | 'preserve_rgb';
}

/** Store the exact profile identity with artwork, without duplicating ICC binary data. */
export function withSavedColorProfile<T extends object>(snapshot: T, profile: SavedColorProfile) {
    return { ...snapshot, __webprinterColor: { ...profile } };
}

export function readSavedColorProfile(snapshot: unknown): SavedColorProfile | null {
    if (!snapshot || typeof snapshot !== 'object') return null;
    const value = (snapshot as Record<string, unknown>).__webprinterColor;
    if (value === undefined) return null;
    if (!value || typeof value !== 'object') throw new Error('Designets gemte farveprofil er ugyldig.');
    const profile = value as Record<string, unknown>;
    if (profile.version !== 1 || typeof profile.id !== 'string' || !profile.id.trim()
        || typeof profile.name !== 'string'
        || (profile.productionColorMode !== undefined && !['convert_cmyk', 'preserve_rgb'].includes(profile.productionColorMode as string))
        || (profile.sha256 !== undefined && (typeof profile.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(profile.sha256)))) {
        throw new Error('Designets gemte farveprofil er ugyldig.');
    }
    return { version: 1, id: profile.id, name: profile.name,
        ...(typeof profile.sha256 === 'string' ? { sha256: profile.sha256.toLowerCase() } : {}),
        ...(profile.productionColorMode ? { productionColorMode: profile.productionColorMode as SavedColorProfile['productionColorMode'] } : {}) };
}
