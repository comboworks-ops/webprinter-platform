/**
 * PublishDialog - Dialog for publishing prices to a product
 * Standalone component for Pricing Hub
 */

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, Package, AlertCircle, Check, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PublishDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectName: string;
    combinedData: any[];
    detectedAttributes?: {
        formats?: string[];
        materials?: string[];
        finishes?: string[];
        columnMap?: Record<string, string | null>;
    };
    exportMapping?: {
        mapping: {
            formats: { originalValue: string; displayName: string; widthMm?: number | null; heightMm?: number | null; imageUrl?: string }[];
            materials: { originalValue: string; displayName: string; imageUrl?: string }[];
            finishes: { originalValue: string; displayName: string; imageUrl?: string }[];
        };
        quantities?: number[];
    } | null;
    onPublishComplete?: () => void;
}

interface Product {
    id: string;
    name: string;
    slug: string;
}

export function PublishDialog({
    open,
    onOpenChange,
    projectName,
    combinedData,
    detectedAttributes,
    exportMapping,
    onPublishComplete,
}: PublishDialogProps) {
    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProductId, setSelectedProductId] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [step, setStep] = useState<"select" | "confirm" | "done">("select");

    // Fetch available products
    useEffect(() => {
        async function fetchProducts() {
            if (!open) return;
            setLoading(true);

            try {
                const { tenantId } = await resolveAdminTenant();
                if (!tenantId) return;

                const { data, error } = await (supabase
                    .from("products") as any)
                    .select("id, name, slug")
                    .eq("tenant_id", tenantId)
                    .order("name");

                if (error) throw error;
                setProducts(data || []);
            } catch (error) {
                console.error("Error fetching products:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchProducts();
    }, [open]);

    // Reset state when dialog closes
    useEffect(() => {
        if (!open) {
            setStep("select");
            setSelectedProductId("");
        }
    }, [open]);

    // Handle publish
    const handlePublish = async () => {
        if (!selectedProductId || combinedData.length === 0) return;

        setPublishing(true);

        try {
            const { tenantId } = await resolveAdminTenant();
            if (!tenantId) throw new Error("Kunne ikke finde tenant");

            const product = products.find(p => p.id === selectedProductId);
            if (!product) throw new Error("Produkt ikke fundet");

            if (!exportMapping?.mapping || exportMapping.mapping.materials.length === 0 || exportMapping.mapping.formats.length === 0) {
                toast.error("Gå først til Matrix Builder og opret layout");
                return;
            }

            const mapping = exportMapping.mapping;

            // 1. Fetch existing attribute groups and values
            const { data: existingGroupsData, error: groupsError } = await supabase
                .from('product_attribute_groups' as any)
                .select('*, values:product_attribute_values(*)')
                .eq('product_id', selectedProductId);

            if (groupsError) throw groupsError;

            let currentGroups = (existingGroupsData || []) as any[];

            // Helper to ensure group exists
            const ensureGroup = async (kind: string, name: string) => {
                let group = currentGroups.find(g => g.kind === kind);
                if (!group) {
                    // Create group
                    const { data: newGroup, error } = await supabase
                        .from('product_attribute_groups' as any)
                        .insert({
                            product_id: selectedProductId,
                            tenant_id: tenantId,
                            name: name,
                            kind: kind,
                            ui_mode: 'buttons',
                            sort_order: currentGroups.length,
                            enabled: true,
                            source: 'product'
                        })
                        .select()
                        .single();

                    if (error) throw error;
                    group = { ...newGroup, values: [] };
                    currentGroups.push(group);
                }
                return group;
            };

            const parsePositiveNumber = (value: unknown): number | null => {
                if (value === null || value === undefined) return null;
                const parsed = Number(String(value).replace(",", ".").trim());
                if (!Number.isFinite(parsed) || parsed <= 0) return null;
                return parsed;
            };

            // LOCK FIX (2026-02-09): keep metadata writes here so mapped names/dimensions/images
            // persist into product attributes and can be reused in product config + designer.
            // Helper to ensure value exists and carries optional metadata from mapping
            const ensureValue = async (
                group: any,
                item: { originalValue: string; displayName: string; widthMm?: number | null; heightMm?: number | null; imageUrl?: string },
                kind: "format" | "material" | "finish"
            ) => {
                const normalizedName = (item.displayName || item.originalValue || "").trim();
                if (!normalizedName) return null;

                const widthMm = kind === "format" ? parsePositiveNumber(item.widthMm) : null;
                const heightMm = kind === "format" ? parsePositiveNumber(item.heightMm) : null;
                const imageUrl = (item.imageUrl || "").trim();

                // Case-insensitive check
                let value = group.values.find((v: any) => v.name.toLowerCase() === normalizedName.toLowerCase());

                if (!value) {
                    const meta = imageUrl ? { image: imageUrl } : null;
                    // Create value
                    const { data: newValue, error } = await supabase
                        .from('product_attribute_values' as any)
                        .insert({
                            group_id: group.id,
                            product_id: selectedProductId,
                            tenant_id: tenantId,
                            name: normalizedName,
                            sort_order: group.values.length,
                            enabled: true,
                            width_mm: widthMm,
                            height_mm: heightMm,
                            meta
                        })
                        .select()
                        .single();

                    if (error) throw error;
                    value = newValue;
                    group.values.push(value);
                    return value;
                }

                // Update existing value with optional dimensions/image metadata
                const updatePayload: Record<string, any> = {};
                if (kind === "format" && widthMm && heightMm) {
                    if (Number(value.width_mm || 0) !== widthMm) updatePayload.width_mm = widthMm;
                    if (Number(value.height_mm || 0) !== heightMm) updatePayload.height_mm = heightMm;
                }

                if (imageUrl) {
                    const currentMeta = (typeof value.meta === "object" && value.meta) ? value.meta as Record<string, any> : {};
                    if (currentMeta.image !== imageUrl) {
                        updatePayload.meta = { ...currentMeta, image: imageUrl };
                    }
                }

                if (Object.keys(updatePayload).length > 0) {
                    const { data: updatedValue, error: updateError } = await supabase
                        .from('product_attribute_values' as any)
                        .update(updatePayload)
                        .eq('id', value.id)
                        .select()
                        .single();

                    if (updateError) throw updateError;
                    value = updatedValue;
                    group.values = group.values.map((v: any) => v.id === value.id ? value : v);
                }

                return value;
            };

            // 2. Identify keys from column map
            const columnMap = detectedAttributes?.columnMap || (combinedData[0] as any)?.__attrs?.columnMap || {};
            const sizeCol = columnMap.size || 'Size';
            const materialCol = columnMap.material || columnMap.paperWeight || 'Material';
            const paperWeightCol = columnMap.paperWeight || 'Paper weight';
            const finishCol = columnMap.finish || 'Finish';
            const quantityCol = columnMap.quantity || 'Quantity';
            const priceCol = columnMap.price || 'Price (DKK)';

            console.log('[Publish] Columns:', { sizeCol, materialCol, paperWeightCol, finishCol });

            // 3. Provision Attributes
            // A. Format
            const formatGroup = await ensureGroup('format', 'Format');

            // B. Material
            const materialGroup = await ensureGroup('material', 'Materiale');

            // C. Finish (if exists)
            let finishGroup: any = null;
            const hasFinishes = mapping.finishes.length > 0;
            if (hasFinishes) {
                finishGroup = await ensureGroup('finish', 'Efterbehandling');
            }

            const normalizeKey = (val: string) => val.trim().toLowerCase().replace(/[.,\s_-]+/g, '');
            const normalizeMaterialKey = (val: string) => normalizeKey(val.replace(/\s*(g|gsm|gram)$/i, ''));

            const buildValueLookup = async (
                group: any,
                items: { originalValue: string; displayName: string; widthMm?: number | null; heightMm?: number | null; imageUrl?: string }[],
                normalizer: (val: string) => string,
                kind: "format" | "material" | "finish"
            ) => {
                const idByKey = new Map<string, string>();
                const valueIds: string[] = [];

                for (const item of items) {
                    const display = (item.displayName || item.originalValue || '').trim();
                    if (!display) continue;
                    const val = await ensureValue(group, item, kind);
                    if (!val) continue;
                    const id = val.id;
                    const originalKey = normalizer(item.originalValue || display);
                    const displayKey = normalizer(display);
                    if (originalKey) idByKey.set(originalKey, id);
                    if (displayKey) idByKey.set(displayKey, id);
                    if (!valueIds.includes(id)) valueIds.push(id);
                }

                return { idByKey, valueIds };
            };

            const formatLookup = await buildValueLookup(formatGroup, mapping.formats, normalizeKey, "format");
            const materialLookup = await buildValueLookup(materialGroup, mapping.materials, normalizeMaterialKey, "material");
            const finishLookup = hasFinishes && finishGroup
                ? await buildValueLookup(finishGroup, mapping.finishes, normalizeKey, "finish")
                : { idByKey: new Map<string, string>(), valueIds: [] };

            // 4. Build Price Rows with IDs
            const rowMap = new Map<string, any>();
            let duplicateCount = 0;
            let missingMappings = 0;

            for (const row of combinedData) {
                const formatRaw = String(row[sizeCol] || '').trim();
                const materialRaw = String(row[materialCol] || row[paperWeightCol] || '').trim();
                const finishRaw = String(row[finishCol] || '').trim();
                const quantity = parseInt(String(row[quantityCol] || '0'));
                const priceStr = String(row[priceCol] || '');
                const price = parseFloat(priceStr.replace(/[^\d.,]/g, '').replace(',', '.'));

                if (!formatRaw || !materialRaw || isNaN(quantity) || isNaN(price) || price <= 0) {
                    continue;
                }

                const formatId = formatLookup.idByKey.get(normalizeKey(formatRaw));
                const materialId = materialLookup.idByKey.get(normalizeMaterialKey(materialRaw));
                const finishId = finishRaw ? finishLookup.idByKey.get(normalizeKey(finishRaw)) : null;

                if (!formatId || !materialId) {
                    missingMappings += 1;
                    continue;
                }
                if (finishRaw && !finishId) {
                    missingMappings += 1;
                    continue;
                }

                const verticalValueId = materialId;
                const variantId = finishId || 'none';
                const variantValueIds = finishId ? [finishId] : [];
                const variantName = [formatId, ...(finishId ? [finishId] : [])].sort().join('|');

                const key = `${selectedProductId}|${variantName}|${verticalValueId}|${quantity}`;
                if (rowMap.has(key)) {
                    duplicateCount += 1;
                }

                rowMap.set(key, {
                    tenant_id: tenantId,
                    product_id: selectedProductId,
                    variant_name: variantName,
                    variant_value: verticalValueId,
                    quantity: quantity,
                    price_dkk: Math.round(price),
                    extra_data: {
                        verticalAxisGroupId: materialGroup?.id || null,
                        verticalAxisValueId: verticalValueId,
                        formatId: formatId,
                        materialId: materialId,
                        variantId: finishId || null,
                        variantValueIds,
                        selectionMap: {
                            format: formatId,
                            material: materialId,
                            ...(finishId ? { variant: finishId, variantValueIds } : {})
                        }
                    }
                });
            }

            const priceRows = Array.from(rowMap.values());
            console.log('[Publish] Prepared', priceRows.length, 'rows with UUIDs');

            if (priceRows.length === 0) {
                throw new Error("Ingen gyldige priser fundet (tjek mapping og data)");
            }

            const quantities = (exportMapping?.quantities || [])
                .map(q => typeof q === 'number' ? q : parseInt(String(q), 10))
                .filter(q => !isNaN(q))
                .sort((a, b) => a - b);

            if (quantities.length === 0) {
                const qtySet = new Set<number>();
                combinedData.forEach(row => {
                    const q = parseInt(String(row[quantityCol] || '0'));
                    if (!isNaN(q) && q > 0) qtySet.add(q);
                });
                quantities.push(...Array.from(qtySet).sort((a, b) => a - b));
            }

            // 5. Update product pricing_structure (matrix_layout_v1)
            const pricingStructure = {
                mode: 'matrix_layout_v1' as const,
                version: 1,
                vertical_axis: {
                    sectionId: 'vertical-axis',
                    sectionType: 'materials',
                    groupId: materialGroup?.id || '',
                    valueIds: materialLookup.valueIds,
                    ui_mode: 'buttons',
                    valueSettings: {},
                    title: 'Materiale',
                    description: ''
                },
                layout_rows: [
                    {
                        id: 'row-1',
                        title: '',
                        description: '',
                        columns: [
                            {
                                id: 'format-section',
                                sectionType: 'formats',
                                groupId: formatGroup?.id || '',
                                valueIds: formatLookup.valueIds,
                                ui_mode: 'buttons',
                                selection_mode: 'required',
                                valueSettings: {},
                                title: 'Format',
                                description: ''
                            },
                            ...(hasFinishes && finishGroup
                                ? [{
                                    id: 'finish-section',
                                    sectionType: 'finishes',
                                    groupId: finishGroup.id,
                                    valueIds: finishLookup.valueIds,
                                    ui_mode: 'buttons',
                                    selection_mode: 'optional',
                                    valueSettings: {},
                                    title: 'Efterbehandling',
                                    description: ''
                                }]
                                : [])
                        ]
                    }
                ],
                quantities
            };

            const { error: productError } = await supabase
                .from('products')
                .update({
                    pricing_structure: pricingStructure,
                    pricing_type: 'matrix'
                } as any)
                .eq('id', selectedProductId);

            if (productError) throw productError;

            // 6. Delete existing prices
            const { error: deleteError } = await supabase
                .from('generic_product_prices' as any)
                .delete()
                .eq('product_id', selectedProductId);

            if (deleteError) throw new Error("Delete failed: " + deleteError.message);

            // 7. Insert new prices in batches
            const batchSize = 500;
            let insertedCount = 0;

            for (let i = 0; i < priceRows.length; i += batchSize) {
                const batch = priceRows.slice(i, i + batchSize);
                const { error: insertError } = await supabase
                    .from('generic_product_prices' as any)
                    .insert(batch);

                if (insertError) throw new Error("Insert failed: " + insertError.message);
                insertedCount += batch.length;
            }

            console.log('[Publish] Published', insertedCount, 'prices');
            try {
                localStorage.removeItem(`product_config_${selectedProductId}`);
            } catch {
                // Ignore storage errors (e.g., private mode)
            }
            const mappingNote = missingMappings > 0 ? ` (${missingMappings} rækker matchede ikke mapping)` : '';
            const dedupeNote = duplicateCount > 0 ? ` (${duplicateCount} dubletter overskrevet)` : '';
            toast.success(`${insertedCount} priser udgivet til ${product.name}${mappingNote}${dedupeNote}`);
            setStep("done");

            setTimeout(() => {
                onOpenChange(false);
                onPublishComplete?.();
            }, 1500);

        } catch (error: any) {
            console.error("Error publishing prices:", error);
            toast.error("Kunne ikke udgive priser: " + error.message);
        } finally {
            setPublishing(false);
        }
    };
const selectedProduct = products.find(p => p.id === selectedProductId);

return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
                <DialogTitle>Udgiv priser til produkt</DialogTitle>
                <DialogDescription>
                    Publicer prislisten "{projectName}" til et eksisterende produkt
                </DialogDescription>
            </DialogHeader>

            {step === "select" && (
                <>
                    {/* Summary */}
                    <div className="space-y-3 py-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Antal rækker:</span>
                            <Badge variant="secondary">{combinedData.length}</Badge>
                        </div>

                        {detectedAttributes && (
                            <>
                                {detectedAttributes.formats && detectedAttributes.formats.length > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Formater:</span>
                                        <div className="flex gap-1">
                                            {detectedAttributes.formats.slice(0, 4).map(f => (
                                                <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                                            ))}
                                            {detectedAttributes.formats.length > 4 && (
                                                <Badge variant="outline" className="text-xs">+{detectedAttributes.formats.length - 4}</Badge>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {detectedAttributes.materials && detectedAttributes.materials.length > 0 && (
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Materialer:</span>
                                        <div className="flex gap-1">
                                            {detectedAttributes.materials.slice(0, 4).map(m => (
                                                <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                                            ))}
                                            {detectedAttributes.materials.length > 4 && (
                                                <Badge variant="outline" className="text-xs">+{detectedAttributes.materials.length - 4}</Badge>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <Separator />

                    {/* Product Selection */}
                    <div className="space-y-3">
                        <Label>Vælg produkt</Label>
                        {loading ? (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : products.length === 0 ? (
                            <div className="text-center py-4 text-sm text-muted-foreground">
                                <AlertCircle className="h-5 w-5 mx-auto mb-2" />
                                Ingen produkter fundet
                            </div>
                        ) : (
                            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Vælg et produkt..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <ScrollArea className="h-[200px]">
                                        {products.map(product => (
                                            <SelectItem key={product.id} value={product.id}>
                                                <div className="flex items-center gap-2">
                                                    <Package className="h-4 w-4" />
                                                    {product.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </ScrollArea>
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </>
            )}

            {step === "confirm" && selectedProduct && (
                <div className="space-y-4 py-4">
                    <div className="flex items-center justify-center gap-4">
                        <div className="text-center">
                            <Badge variant="secondary" className="mb-2">{projectName}</Badge>
                            <p className="text-xs text-muted-foreground">{combinedData.length} rækker</p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                        <div className="text-center">
                            <Badge className="mb-2">{selectedProduct.name}</Badge>
                            <p className="text-xs text-muted-foreground">/{selectedProduct.slug}</p>
                        </div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                        <AlertCircle className="h-4 w-4 inline mr-2 text-amber-600" />
                        <span className="text-amber-800 dark:text-amber-200">
                            Eksisterende priser vil blive overskrevet. Denne handling kan ikke fortrydes.
                        </span>
                    </div>
                </div>
            )}

            {step === "done" && (
                <div className="py-8 text-center">
                    <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                        <Check className="h-6 w-6 text-green-600" />
                    </div>
                    <p className="font-medium">Priser udgivet!</p>
                    <p className="text-sm text-muted-foreground">
                        {combinedData.length} rækker blev importeret
                    </p>
                </div>
            )}

            {step !== "done" && (
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Annuller
                    </Button>
                    {step === "select" && (
                        <Button
                            onClick={() => setStep("confirm")}
                            disabled={!selectedProductId}
                        >
                            Fortsæt
                        </Button>
                    )}
                    {step === "confirm" && (
                        <Button onClick={handlePublish} disabled={publishing}>
                            {publishing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Udgiv priser
                        </Button>
                    )}
                </DialogFooter>
            )}
        </DialogContent>
    </Dialog>
);
}

export default PublishDialog;
