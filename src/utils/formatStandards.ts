
export interface FormatDimension {
    id: string;
    name: string;
    width: number;
    height: number;
    category?: string;
    icon?: string;
}

export const STANDARD_FORMATS: FormatDimension[] = [
    // A-rækken
    { id: 'A0', name: 'A0', width: 841, height: 1189, category: 'A-rækken' },
    { id: 'A1', name: 'A1', width: 594, height: 841, category: 'A-rækken' },
    { id: 'A2', name: 'A2', width: 420, height: 594, category: 'A-rækken' },
    { id: 'A3', name: 'A3', width: 297, height: 420, category: 'A-rækken' },
    { id: 'A4', name: 'A4', width: 210, height: 297, category: 'A-rækken' },
    { id: 'A5', name: 'A5', width: 148, height: 210, category: 'A-rækken' },
    { id: 'A6', name: 'A6', width: 105, height: 148, category: 'A-rækken' },

    // Plakater
    { id: '50x70', name: '50x70 cm', width: 500, height: 700, category: 'Plakater' },
    { id: '70x100', name: '70x100 cm', width: 700, height: 1000, category: 'Plakater' },

    // Bannere
    { id: 'RU85x200', name: 'Roll-up 85x200', width: 850, height: 2000, category: 'Bannere' },

    // Kort
    { id: 'visitkort', name: 'Visitkort', width: 85, height: 55, category: 'Kort' },
    { id: 'M65', name: 'M65', width: 99, height: 210, category: 'Kort' },
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

    if (directMatch) {
        return { width: directMatch.width, height: directMatch.height };
    }

    return null;
}
