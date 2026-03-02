/**
 * usePricingHub Hook
 * 
 * Manages state and operations for the Pricing Hub feature:
 * - Folders and projects CRUD
 * - CSV file uploads and parsing
 * - Material auto-creation
 * 
 * STANDALONE: Does not modify any existing pricing code
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { toast } from "sonner";

// Types for Pricing Hub
export interface PricingHubFolder {
    id: string;
    tenant_id: string;
    name: string;
    parent_id: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface PricingHubImport {
    id: string;
    tenant_id: string;
    project_id: string;
    name: string;
    original_filename: string;
    csv_data: any[];
    column_mapping: Record<string, string>;
    row_count: number;
    attributes_detected: {
        formats?: string[];
        materials?: string[];
        finishes?: string[];
    };
    sort_order: number;
    created_at: string;
}

export interface PricingHubProject {
    id: string;
    tenant_id: string;
    folder_id: string | null;
    name: string;
    description: string | null;
    status: "draft" | "ready" | "published";
    combined_data: any[];
    detected_attributes: {
        formats?: string[];
        materials?: string[];
        finishes?: string[];
        quantities?: number[];
        columnMap?: Record<string, string | null>;
    };
    settings: Record<string, any>;
    sort_order: number;
    created_at: string;
    updated_at: string;
    created_by: string | null;
    published_to_product_id: string | null;
    imports?: PricingHubImport[];
}

/**
 * Parsed price variant row - each row represents ONE price for a specific variant
 * Variant key = (Quantity, Size, Paper weight, Finish) → Price
 */
export interface PriceVariant {
    quantity: number;
    size: string;
    paperWeight: number;
    material?: string;
    finish: string;
    price: number;
    // Original raw row for reference
    _raw: Record<string, string>;
}

// Column name mappings (case-insensitive matching)
const COLUMN_MAPPINGS = {
    quantity: ["Quantity", "quantity", "Antal", "antal", "Stk", "stk", "QTY", "qty"],
    size: ["Size", "size", "Format", "format", "Størrelse", "størrelse"],
    material: ["Material", "material", "Materiale", "materiale", "Papir", "papir", "Paper", "paper", "Medie", "medie", "Media", "media"],
    paperWeight: ["Paper weight", "paper weight", "Weight", "weight", "Grammage", "grammage", "Paper Weight", "Papirvægt", "papirvægt", "gsm", "GSM", "Gramvægt"],
    finish: ["Finish", "finish", "Efterbehandling", "efterbehandling", "Coating", "coating", "Lak", "lak", "Surface", "surface"],
    price: ["Price (DKK)", "Price", "price", "Pris", "pris", "Price (DKK)", "DKK", "dkk", "Pris (DKK)"],
};

// Find matching column name from headers
function findColumn(headers: string[], aliases: string[]): string | null {
    for (const header of headers) {
        const normalized = header.trim().toLowerCase();
        for (const alias of aliases) {
            if (normalized === alias.toLowerCase()) {
                return header;
            }
        }
    }
    return null;
}

// Parse CSV text into structured variant data
function parseCSV(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = csvText.split(/\r?\n/).filter(line => line.trim());
    console.log("parseCSV: Total lines after filtering:", lines.length);

    if (lines.length === 0) return { headers: [], rows: [] };

    // Auto-detect delimiter (semicolon or comma)
    const firstLine = lines[0];
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = semicolonCount > commaCount ? ';' : ',';
    console.log("parseCSV: Detected delimiter:", delimiter, { semicolonCount, commaCount });

    // Parse header
    const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^"(.*)"$/, "$1"));
    console.log("parseCSV: Headers:", headers);

    // Parse rows
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(delimiter).map(v => v.trim().replace(/^"(.*)"$/, "$1"));

        // Create row object
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || "";
        });
        rows.push(row);

        if (i <= 3) {
            console.log(`parseCSV: Row ${i}:`, row);
        }
    }

    console.log("parseCSV: Total rows parsed:", rows.length);
    return { headers, rows };
}

// Parse rows into typed PriceVariant objects
function parseVariants(headers: string[], rows: Record<string, string>[]): {
    variants: PriceVariant[];
    columnMap: Record<string, string | null>;
    quantities: number[];
    sizes: string[];
    materials: string[];
    paperWeights: number[];
    finishes: string[];
} {
    // Find column mappings
    const columnMap = {
        quantity: findColumn(headers, COLUMN_MAPPINGS.quantity),
        size: findColumn(headers, COLUMN_MAPPINGS.size),
        material: findColumn(headers, COLUMN_MAPPINGS.material),
        paperWeight: findColumn(headers, COLUMN_MAPPINGS.paperWeight),
        finish: findColumn(headers, COLUMN_MAPPINGS.finish),
        price: findColumn(headers, COLUMN_MAPPINGS.price),
    };

    console.log("parseVariants: Column mapping:", columnMap);

    // Parse each row into a PriceVariant
    const variants: PriceVariant[] = [];
    const quantitySet = new Set<number>();
    const sizeSet = new Set<string>();
    const materialSet = new Set<string>();
    const paperWeightSet = new Set<number>();
    const finishSet = new Set<string>();

    for (const row of rows) {
        const quantity = columnMap.quantity ? parseInt(row[columnMap.quantity], 10) : 0;
        const size = columnMap.size ? row[columnMap.size].trim() : "";
        const material = columnMap.material ? row[columnMap.material].trim() : "";
        const paperWeight = columnMap.paperWeight ? parseInt(row[columnMap.paperWeight], 10) : 0;
        const finish = columnMap.finish ? row[columnMap.finish].trim().toLowerCase() : "";
        const price = columnMap.price ? parseInt(row[columnMap.price].replace(/[^\d]/g, ""), 10) : 0;

        // Skip rows with invalid data
        if (isNaN(quantity) || quantity <= 0) continue;

        const variant: PriceVariant = {
            quantity,
            size,
            paperWeight,
            material: material || undefined,
            finish,
            price,
            _raw: row,
        };

        variants.push(variant);

        // Collect unique values
        quantitySet.add(quantity);
        if (size) sizeSet.add(size);
        if (material) {
            materialSet.add(material);
        } else if (paperWeight > 0) {
            paperWeightSet.add(paperWeight);
            materialSet.add(`${paperWeight}g`);
        }
        if (finish) finishSet.add(finish);
    }

    console.log("parseVariants: Parsed", variants.length, "variants");
    console.log("parseVariants: Unique quantities:", Array.from(quantitySet).sort((a, b) => a - b));
    console.log("parseVariants: Unique sizes:", Array.from(sizeSet));
    console.log("parseVariants: Unique paperWeights:", Array.from(paperWeightSet));
    console.log("parseVariants: Unique finishes:", Array.from(finishSet));

    return {
        variants,
        columnMap,
        quantities: Array.from(quantitySet).sort((a, b) => a - b),
        sizes: Array.from(sizeSet),
        materials: Array.from(materialSet),
        paperWeights: Array.from(paperWeightSet).sort((a, b) => a - b),
        finishes: Array.from(finishSet),
    };
}

// Generate variant key for deduplication (by variant, NOT by price)
function variantKey(v: PriceVariant): string {
    return `${v.quantity}|${v.size}|${v.paperWeight}|${v.finish}`;
}

// Detect attributes from parsed data (for backwards compatibility)
function detectAttributes(headers: string[], rows: Record<string, string>[]): {
    formats: string[];
    materials: string[];
    finishes: string[];
    quantities: number[];
    columnMap: Record<string, string | null>;
} {
    const parsed = parseVariants(headers, rows);

    return {
        formats: parsed.sizes,
        materials: parsed.materials.length > 0 ? parsed.materials : parsed.paperWeights.map(w => `${w}g`),
        finishes: parsed.finishes,
        quantities: parsed.quantities,
        columnMap: parsed.columnMap,
    };
}

export function usePricingHub() {
    const [folders, setFolders] = useState<PricingHubFolder[]>([]);
    const [projects, setProjects] = useState<PricingHubProject[]>([]);
    const [selectedProject, setSelectedProject] = useState<PricingHubProject | null>(null);
    const [loading, setLoading] = useState(true);
    const [tenantId, setTenantId] = useState<string | null>(null);

    // Fetch tenant ID using existing utility
    useEffect(() => {
        async function getTenantId() {
            const { tenantId } = await resolveAdminTenant();
            if (tenantId) {
                setTenantId(tenantId);
            }
        }
        getTenantId();
    }, []);

    // Fetch folders and projects
    const refreshData = useCallback(async () => {
        if (!tenantId) return;

        try {
            setLoading(true);

            // Fetch folders
            const { data: foldersData, error: foldersError } = await supabase
                .from("pricing_hub_folders" as any)
                .select("*")
                .order("sort_order", { ascending: true });

            if (foldersError) throw foldersError;
            setFolders((foldersData as any[]) || []);

            // Fetch projects with imports
            const { data: projectsData, error: projectsError } = await supabase
                .from("pricing_hub_projects" as any)
                .select("*, imports:pricing_hub_imports(*)")
                .order("sort_order", { ascending: true });

            if (projectsError) throw projectsError;
            setProjects((projectsData as unknown as PricingHubProject[]) || []);

            // Update selected project if it still exists
            if (selectedProject) {
                const updated = (projectsData as unknown as PricingHubProject[])?.find(p => p.id === selectedProject.id);
                if (updated) setSelectedProject(updated);
            }
        } catch (error) {
            console.error("Error fetching pricing hub data:", error);
        } finally {
            setLoading(false);
        }
    }, [tenantId, selectedProject?.id]);

    // Initial load
    useEffect(() => {
        if (tenantId) {
            refreshData();
        }
    }, [tenantId, refreshData]);

    // Create folder
    const createFolder = useCallback(async (name: string, parentId: string | null = null) => {
        if (!tenantId) return;

        try {
            const { data, error } = await supabase
                .from("pricing_hub_folders" as any)
                .insert({
                    tenant_id: tenantId,
                    name,
                    parent_id: parentId,
                    sort_order: folders.length,
                })
                .select()
                .single();

            if (error) throw error;
            toast.success("Mappe oprettet");
            await refreshData();
            return data;
        } catch (error: any) {
            console.error("Error creating folder:", error);
            toast.error("Kunne ikke oprette mappe: " + error.message);
        }
    }, [tenantId, folders.length, refreshData]);

    // Create project
    const createProject = useCallback(async (name: string, folderId: string | null = null) => {
        if (!tenantId) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from("pricing_hub_projects" as any)
                .insert({
                    tenant_id: tenantId,
                    folder_id: folderId,
                    name,
                    status: "draft",
                    combined_data: [],
                    detected_attributes: {},
                    settings: {},
                    sort_order: projects.length,
                    created_by: user?.id,
                })
                .select()
                .single();

            if (error) throw error;
            toast.success("Projekt oprettet");
            await refreshData();

            // Auto-select the new project
            if (data) {
                setSelectedProject(data as unknown as PricingHubProject);
            }

            return data;
        } catch (error: any) {
            console.error("Error creating project:", error);
            toast.error("Kunne ikke oprette projekt: " + error.message);
        }
    }, [tenantId, projects.length, refreshData]);

    // Delete folder
    const deleteFolder = useCallback(async (folderId: string) => {
        try {
            const { error } = await supabase
                .from("pricing_hub_folders" as any)
                .delete()
                .eq("id", folderId);

            if (error) throw error;
            toast.success("Mappe slettet");
            await refreshData();
        } catch (error: any) {
            console.error("Error deleting folder:", error);
            toast.error("Kunne ikke slette mappe: " + error.message);
        }
    }, [refreshData]);

    // Delete project
    const deleteProject = useCallback(async (projectId: string) => {
        try {
            const { error } = await supabase
                .from("pricing_hub_projects" as any)
                .delete()
                .eq("id", projectId);

            if (error) throw error;

            if (selectedProject?.id === projectId) {
                setSelectedProject(null);
            }

            toast.success("Projekt slettet");
            await refreshData();
        } catch (error: any) {
            console.error("Error deleting project:", error);
            toast.error("Kunne ikke slette projekt: " + error.message);
        }
    }, [refreshData, selectedProject?.id]);

    // Rename folder
    const renameFolder = useCallback(async (folderId: string, newName: string) => {
        try {
            const { error } = await supabase
                .from("pricing_hub_folders" as any)
                .update({ name: newName, updated_at: new Date().toISOString() })
                .eq("id", folderId);

            if (error) throw error;
            toast.success("Mappe omdøbt");
            await refreshData();
        } catch (error: any) {
            console.error("Error renaming folder:", error);
            toast.error("Kunne ikke omdøbe mappe: " + error.message);
        }
    }, [refreshData]);

    // Rename project
    const renameProject = useCallback(async (projectId: string, newName: string) => {
        try {
            const { error } = await supabase
                .from("pricing_hub_projects" as any)
                .update({ name: newName, updated_at: new Date().toISOString() })
                .eq("id", projectId);

            if (error) throw error;
            toast.success("Projekt omdøbt");
            await refreshData();
        } catch (error: any) {
            console.error("Error renaming project:", error);
            toast.error("Kunne ikke omdøbe projekt: " + error.message);
        }
    }, [refreshData]);

    // Upload and parse CSV file
    const uploadCSV = useCallback(async (projectId: string, file: File) => {
        if (!tenantId) {
            console.error("uploadCSV: No tenantId");
            toast.error("Ingen tenant ID fundet");
            return;
        }

        console.log("uploadCSV: Starting upload", { projectId, fileName: file.name, tenantId });

        try {
            const text = await file.text();
            console.log("uploadCSV: File text loaded, length:", text.length);

            const { headers, rows } = parseCSV(text);
            console.log("uploadCSV: Parsed CSV", { headers, rowCount: rows.length });

            if (rows.length === 0) {
                toast.error("CSV-filen er tom eller kunne ikke parses");
                return;
            }

            // Detect attributes
            const attributes = detectAttributes(headers, rows);
            console.log("uploadCSV: Detected attributes", attributes);

            // Create import record
            console.log("uploadCSV: Inserting into pricing_hub_imports...");
            const { data, error } = await supabase
                .from("pricing_hub_imports" as any)
                .insert({
                    tenant_id: tenantId,
                    project_id: projectId,
                    name: file.name.replace(".csv", ""),
                    original_filename: file.name,
                    csv_data: rows,
                    column_mapping: headers.reduce((acc, h, i) => ({ ...acc, [h]: h }), {}),
                    row_count: rows.length,
                    attributes_detected: attributes,
                    sort_order: 0,
                })
                .select()
                .single();

            if (error) {
                console.error("uploadCSV: Insert error", error);
                throw error;
            }

            console.log("uploadCSV: Insert successful", data);

            // Update project with combined data and detected attributes
            const project = projects.find(p => p.id === projectId);
            if (project) {
                const combinedData = [...(project.combined_data || []), ...rows];
                const allAttributes = {
                    formats: [...new Set([...(project.detected_attributes?.formats || []), ...attributes.formats])],
                    materials: [...new Set([...(project.detected_attributes?.materials || []), ...attributes.materials])],
                    finishes: [...new Set([...(project.detected_attributes?.finishes || []), ...attributes.finishes])],
                    quantities: [...new Set([...(project.detected_attributes?.quantities || []), ...attributes.quantities])].sort((a, b) => a - b),
                    columnMap: attributes.columnMap,
                };

                console.log("uploadCSV: Updating project with combined data", { combinedDataCount: combinedData.length });

                const { error: updateError } = await supabase
                    .from("pricing_hub_projects" as any)
                    .update({
                        combined_data: combinedData,
                        detected_attributes: allAttributes,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", projectId);

                if (updateError) {
                    console.error("uploadCSV: Project update error", updateError);
                }
            }

            toast.success(`Importeret ${rows.length} rækker fra ${file.name}`);
            await refreshData();
            return data;
        } catch (error: any) {
            console.error("Error uploading CSV:", error);
            toast.error("Kunne ikke importere CSV: " + error.message);
        }
    }, [tenantId, projects, refreshData]);

    return {
        folders,
        projects,
        selectedProject,
        setSelectedProject,
        loading,
        tenantId,
        createFolder,
        createProject,
        deleteFolder,
        deleteProject,
        renameFolder,
        renameProject,
        uploadCSV,
        refreshData,
    };
}

export default usePricingHub;
