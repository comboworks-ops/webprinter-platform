/**
 * Matrix Layout V1 - Canonical Pricing Structure Types
 * 
 * This defines the single source of truth for layout-driven pricing.
 * All products using this system store their configuration in products.pricing_structure.
 */

// ============ Section Types ============
export type SectionType = 'formats' | 'materials' | 'finishes' | 'products';

export type UiMode = 'buttons' | 'dropdown' | 'checkboxes' | 'hidden';

// ============ Vertical Axis Config ============
export interface VerticalAxisConfig {
    sectionId: string;
    sectionType: SectionType;
    groupId: string;
    valueIds: string[];
    title?: string;       // User-defined Display Title
    description?: string; // User-defined Description
    labelOverride?: string; // Legacy: mapped to title
    ui_mode?: UiMode;
}

// ============ Layout Column (Section within a Row) ============
export interface LayoutColumn {
    id: string;  // Stable section ID (e.g., "sec_abc123")
    sectionType: SectionType;
    groupId: string;
    valueIds: string[];
    ui_mode: UiMode;
    title?: string;
    description?: string;
    labelOverride?: string;
}

// ============ Layout Row ============
export interface LayoutRow {
    id: string;  // Stable row ID (e.g., "row_xyz789")
    title?: string; // Optional header for the entire row of sections
    description?: string;
    columns: LayoutColumn[];
}

// ============ Full Pricing Structure (stored on product) ============
export interface MatrixLayoutV1 {
    mode: 'matrix_layout_v1';
    version: 1;
    vertical_axis: VerticalAxisConfig;
    layout_rows: LayoutRow[];
    quantities?: number[];
}

// Legacy/other modes can be added here
export type PricingStructure = MatrixLayoutV1 | { mode: string;[key: string]: any };

// ============ Selection State ============
// Maps section ID -> selected value ID (avoids collision between same-named sections)
export type SelectedSectionValues = Record<string, string>;

// ============ CSV Meta Header ============
export interface CSVMeta {
    vertical_axis: {
        sectionId: string;
        groupId: string;
        sectionType: SectionType;
    };
    sections: Array<{
        sectionId: string;
        groupId: string;
        sectionType: SectionType;
        ui_mode: UiMode;
    }>;
    quantities: number[];
}

// ============ Generic Product Price Schema ============
export interface GenericProductPriceRow {
    product_id: string;
    variant_name: string;  // = activeVariantKey (composite section selections)
    variant_value: string; // = verticalAxisValueId (UUID)
    quantity: number;
    price_dkk: number;
    extra_data?: {
        verticalAxisGroupId: string;
        verticalAxisValueId: string;
        selectionMap: Record<string, string>; // sectionId -> valueId
        formatId?: string;
        materialId?: string;
    };
}

// ============ Utility Functions ============

/**
 * Compute the activeVariantKey from selected sections.
 * Stable order: by section ID alphabetically.
 * Format: "sec_<id1>:val_<valId1>|sec_<id2>:val_<valId2>"
 * If no sections selected, returns "none"
 */
export function computeVariantKey(
    selectedSectionValues: SelectedSectionValues,
    excludeSectionIds: string[] = []
): string {
    const entries = Object.entries(selectedSectionValues)
        .filter(([secId]) => !excludeSectionIds.includes(secId))
        .sort((a, b) => a[0].localeCompare(b[0]));

    if (entries.length === 0) return 'none';

    return entries
        .map(([secId, valId]) => `sec_${secId}:val_${valId}`)
        .join('|');
}

/**
 * Extract formatId and materialId from selected values if those section types exist.
 */
export function extractDimensionIds(
    selectedSectionValues: SelectedSectionValues,
    layoutRows: LayoutRow[],
    verticalAxis?: VerticalAxisConfig
): { formatId?: string; materialId?: string } {
    const result: { formatId?: string; materialId?: string } = {};

    // Check vertical axis
    if (verticalAxis) {
        if (verticalAxis.sectionType === 'formats' && selectedSectionValues[verticalAxis.sectionId]) {
            result.formatId = selectedSectionValues[verticalAxis.sectionId];
        } else if (verticalAxis.sectionType === 'materials' && selectedSectionValues[verticalAxis.sectionId]) {
            result.materialId = selectedSectionValues[verticalAxis.sectionId];
        }
    }

    // Check layout columns
    for (const row of layoutRows) {
        for (const col of row.columns) {
            const selectedVal = selectedSectionValues[col.id];
            if (!selectedVal) continue;

            if (col.sectionType === 'formats' && !result.formatId) {
                result.formatId = selectedVal;
            } else if (col.sectionType === 'materials' && !result.materialId) {
                result.materialId = selectedVal;
            }
        }
    }

    return result;
}

/**
 * Parse CSV meta header if present.
 * Returns null if meta not found or invalid.
 */
export function parseCSVMeta(firstLine: string): CSVMeta | null {
    if (!firstLine.startsWith('#meta;')) return null;
    try {
        const jsonStr = firstLine.substring(6); // Remove "#meta;"
        return JSON.parse(jsonStr);
    } catch {
        return null;
    }
}

/**
 * Generate CSV meta header line.
 */
export function generateCSVMetaLine(meta: CSVMeta): string {
    return `#meta;${JSON.stringify(meta)}`;
}

/**
 * Disambiguate section headers for CSV export.
 * If duplicate names exist, append short section ID.
 */
export function disambiguateSectionHeaders(
    sections: Array<{ id: string; name: string }>
): string[] {
    const nameCounts: Record<string, number> = {};
    sections.forEach(s => {
        nameCounts[s.name] = (nameCounts[s.name] || 0) + 1;
    });

    return sections.map(s => {
        if (nameCounts[s.name] > 1) {
            // Append short section ID for disambiguation
            const shortId = s.id.substring(0, 8);
            return `${s.name}__sec_${shortId}`;
        }
        return s.name;
    });
}
