/**
 * Export Types for Designer Export System
 * 
 * Defines the export modes and related types.
 */

export type ExportMode = 'print_pdf' | 'proof_pdf' | 'original_pdf' | 'vector_pdf';

export interface ExportModeOption {
    id: ExportMode;
    label: string;
    description: string;
    recommended?: boolean;
    disabled?: boolean;
    hidden?: boolean;
}

export interface ExportOptions {
    mode: ExportMode;
    includeBleed: boolean;
    includeTrimMarks?: boolean;  // Future feature
    preserveVector?: boolean;    // For vector PDF background preservation
}

export interface DocumentSpec {
    name: string;
    width_mm: number;
    height_mm: number;
    bleed_mm: number;
    safe_area_mm?: number;
    dpi?: number;
    color_profile?: string;
    product_id?: string;
    template_id?: string;
}

export interface PdfSourceMeta {
    originalUrl: string;
    originalFilename: string;
    uploadedAt: string;
}

export interface ExportResult {
    success: boolean;
    filename: string;
    error?: string;
}
