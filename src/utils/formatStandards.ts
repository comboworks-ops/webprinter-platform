
export interface FormatDimension {
    id: string;
    name: string;
    width: number;
    height: number;
}

export const STANDARD_FORMATS: FormatDimension[] = [
    { id: 'custom', name: 'Special størrelse (Fri format)', width: 0, height: 0 },
    { id: 'A0', name: 'A0 (841 x 1189 mm)', width: 841, height: 1189 },
    { id: 'A1', name: 'A1 (594 x 841 mm)', width: 594, height: 841 },
    { id: 'A2', name: 'A2 (420 x 594 mm)', width: 420, height: 594 },
    { id: 'A3', name: 'A3 (297 x 420 mm)', width: 297, height: 420 },
    { id: 'A4', name: 'A4 (210 x 297 mm)', width: 210, height: 297 },
    { id: 'A5', name: 'A5 (148 x 210 mm)', width: 148, height: 210 },
    { id: 'A6', name: 'A6 (105 x 148 mm)', width: 105, height: 148 },
    { id: 'A7', name: 'A7 (74 x 105 mm)', width: 74, height: 105 },
    { id: 'B0', name: 'B0 (1000 x 1414 mm)', width: 1000, height: 1414 },
    { id: 'B1', name: 'B1 (707 x 1000 mm)', width: 707, height: 1000 },
    { id: 'B2', name: 'B2 (500 x 707 mm)', width: 500, height: 707 },
    { id: 'M65', name: 'M65 (99 x 210 mm)', width: 99, height: 210 },
    { id: 'visitkort', name: 'Visitkort (85 x 55 mm)', width: 85, height: 55 },
];

/**
 * Attempts to find standard dimensions for a given string (e.g. "A4", "A5", "Visitkort")
 * Case-insensitive and ignores common prefixes/suffixes.
 */
export function getDimensionsFromVariant(variantName: string): { width: number, height: number } | null {
    if (!variantName) return null;

    const normalized = variantName.toLowerCase().trim();

    // Direct matches
    const directMatch = STANDARD_FORMATS.find(f =>
        normalized.includes(f.id.toLowerCase()) ||
        normalized.includes(f.name.toLowerCase().split(' ')[0])
    );

    if (directMatch && directMatch.id !== 'custom') {
        return { width: directMatch.width, height: directMatch.height };
    }

    return null;
}
