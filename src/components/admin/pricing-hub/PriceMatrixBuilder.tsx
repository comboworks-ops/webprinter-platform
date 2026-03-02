/**
 * Price Matrix Builder - Drag-and-drop interface for mapping CSV values to product attributes
 */

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    GripVertical,
    X,
    Edit2,
    Check,
    Layers,
    LayoutGrid,
    Palette,
    ArrowRight,
    Eye,
    Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface MappedValue {
    id: string;
    originalValue: string;
    displayName: string;
    priceCount: number;
    connectedRows: any[];
    widthMm?: number | null;
    heightMm?: number | null;
    imageUrl?: string;
}

interface AttributeMapping {
    formats: MappedValue[];
    materials: MappedValue[];
    finishes: MappedValue[];
}

interface PriceMatrixBuilderProps {
    combinedData: any[];
    detectedAttributes: {
        formats?: string[];
        materials?: string[];
        finishes?: string[];
        quantities?: Array<number | string>;
        columnMap?: Record<string, string | null>;
    };
    onMappingComplete: (mapping: AttributeMapping, quantities: number[]) => void;
}

// Draggable Value Chip Component
function DraggableValueChip({
    value,
    priceCount,
    onDragStart,
    isDragging,
}: {
    value: string;
    priceCount: number;
    onDragStart: (value: string) => void;
    isDragging: boolean;
}) {
    return (
        <div
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", value);
                e.dataTransfer.effectAllowed = "move";
                onDragStart(value);
            }}
            className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing",
                "bg-card hover:bg-muted/50 transition-colors",
                isDragging && "opacity-50"
            )}
        >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{value}</span>
            <Badge variant="secondary" className="text-xs">
                {priceCount} priser
            </Badge>
        </div>
    );
}

// Drop Zone Component
function DropZone({
    title,
    zoneType,
    icon: Icon,
    items,
    onDrop,
    onRemove,
    onRename,
    onUpdate,
    color,
}: {
    title: string;
    zoneType: keyof AttributeMapping;
    icon: React.ElementType;
    items: MappedValue[];
    onDrop: (value: string) => void;
    onRemove: (id: string) => void;
    onRename: (id: string, newName: string) => void;
    onUpdate: (id: string, patch: Partial<MappedValue>) => void;
    color: string;
}) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const value = e.dataTransfer.getData("text/plain");
        if (value) onDrop(value);
    };

    const startEdit = (item: MappedValue) => {
        setEditingId(item.id);
        setEditValue(item.displayName);
    };

    const confirmEdit = (id: string) => {
        if (editValue.trim()) {
            onRename(id, editValue.trim());
        }
        setEditingId(null);
    };

    const parseNumberOrNull = (value: string): number | null => {
        const normalized = value.replace(",", ".").trim();
        if (!normalized) return null;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    };

    return (
        <Card
            className={cn(
                "border-2 transition-all min-h-[200px]",
                isDragOver && "border-primary bg-primary/5"
            )}
            onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
        >
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                    <div className={cn("p-1.5 rounded", color)}>
                        <Icon className="h-4 w-4 text-white" />
                    </div>
                    {title}
                    <Badge variant="outline" className="ml-auto">
                        {items.length}
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {items.length === 0 ? (
                    <div className="flex items-center justify-center h-24 border-2 border-dashed rounded-lg text-muted-foreground text-sm">
                        Træk værdier hertil
                    </div>
                ) : (
                    <div className="space-y-2">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
                            >
                                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />

                                {editingId === item.id ? (
                                    <div className="flex-1 flex items-center gap-1">
                                        <Input
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="h-7 text-sm"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") confirmEdit(item.id);
                                                if (e.key === "Escape") setEditingId(null);
                                            }}
                                        />
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0"
                                            onClick={() => confirmEdit(item.id)}
                                        >
                                            <Check className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm truncate">
                                                {item.displayName}
                                            </div>
                                            {item.displayName !== item.originalValue && (
                                                <div className="text-xs text-muted-foreground truncate">
                                                    Original: {item.originalValue}
                                                </div>
                                            )}
                                            {zoneType === "formats" && (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <Input
                                                        value={item.widthMm ?? ""}
                                                        placeholder="Bredde mm"
                                                        className="h-7 text-xs"
                                                        onChange={(e) => onUpdate(item.id, { widthMm: parseNumberOrNull(e.target.value) })}
                                                    />
                                                    <Input
                                                        value={item.heightMm ?? ""}
                                                        placeholder="Højde mm"
                                                        className="h-7 text-xs"
                                                        onChange={(e) => onUpdate(item.id, { heightMm: parseNumberOrNull(e.target.value) })}
                                                    />
                                                </div>
                                            )}
                                            <div className="mt-2">
                                                <Input
                                                    value={item.imageUrl || ""}
                                                    placeholder="Billede URL (valgfri)"
                                                    className="h-7 text-xs"
                                                    onChange={(e) => onUpdate(item.id, { imageUrl: e.target.value.trim() })}
                                                />
                                            </div>
                                        </div>
                                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                                            {item.priceCount}
                                        </Badge>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0"
                                            onClick={() => startEdit(item)}
                                        >
                                            <Edit2 className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                            onClick={() => onRemove(item.id)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// Matrix Preview Component
function MatrixPreview({
    mapping,
    quantities,
}: {
    mapping: AttributeMapping;
    quantities: number[];
}) {
    if (mapping.formats.length === 0 || mapping.materials.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-lg text-muted-foreground">
                <div className="text-center">
                    <LayoutGrid className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Tilføj formater og materialer for at se forhåndsvisning</p>
                </div>
            </div>
        );
    }

    return (
        <div className="border rounded-lg overflow-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-muted/50">
                        <th className="p-2 text-left font-medium">Material / Format</th>
                        {mapping.formats.map((format) => (
                            <th key={format.id} className="p-2 text-center font-medium">
                                {format.displayName}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {mapping.materials.map((material) => (
                        <tr key={material.id} className="border-t">
                            <td className="p-2 font-medium bg-muted/30">{material.displayName}</td>
                            {mapping.formats.map((format) => (
                                <td key={format.id} className="p-2 text-center">
                                    <div className="text-xs text-muted-foreground">
                                        {quantities.length > 0 ? `${quantities.length} antal` : "-"}
                                    </div>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {mapping.finishes.length > 0 && (
                <div className="p-2 bg-muted/30 border-t">
                    <div className="text-xs font-medium">Efterbehandling:</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {mapping.finishes.map((finish) => (
                            <Badge key={finish.id} variant="outline" className="text-xs">
                                {finish.displayName}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Main Component
export function PriceMatrixBuilder({
    combinedData,
    detectedAttributes,
    onMappingComplete,
}: PriceMatrixBuilderProps) {
    const [draggingValue, setDraggingValue] = useState<string | null>(null);
    const [mapping, setMapping] = useState<AttributeMapping>({
        formats: [],
        materials: [],
        finishes: [],
    });

    // Use the pre-detected attribute values from the parser
    // Group by type for the available values panel
    const availableValues = useMemo(() => {
        console.log("PriceMatrixBuilder: detectedAttributes received:", detectedAttributes);
        console.log("PriceMatrixBuilder: combinedData rows:", combinedData.length);

        const result: { value: string; type: "size" | "material" | "finish"; count: number }[] = [];

        const colMap = detectedAttributes?.columnMap || {};
        const sizeCol = colMap.size || '';
        const materialCol = colMap.material || colMap.paperWeight || '';
        const finishCol = colMap.finish || '';

        const getUniqueValues = (colName: string) => {
            if (!colName) return [];
            const set = new Set<string>();
            combinedData.forEach(row => {
                const raw = row?.[colName];
                if (raw !== null && raw !== undefined) {
                    const val = String(raw).trim();
                    if (val) set.add(val);
                }
            });
            return Array.from(set);
        };

        // Add formats (sizes)
        const formats = (detectedAttributes?.formats && detectedAttributes.formats.length > 0)
            ? detectedAttributes.formats
            : getUniqueValues(sizeCol);
        console.log("PriceMatrixBuilder: formats:", formats);
        formats.forEach(f => {
            // Count how many rows have this format
            const count = combinedData.filter(row => {
                return Object.values(row).some(v => v === f || String(v) === f);
            }).length;
            result.push({ value: f, type: "size", count });
        });

        // Add materials (paper weights)
        const materials = (detectedAttributes?.materials && detectedAttributes.materials.length > 0)
            ? detectedAttributes.materials
            : getUniqueValues(materialCol);
        console.log("PriceMatrixBuilder: materials:", materials);
        materials.forEach(m => {
            const count = combinedData.filter(row => {
                return Object.values(row).some(v => v === m || String(v) === m);
            }).length;
            result.push({ value: m, type: "material", count });
        });

        // Add finishes
        const finishes = (detectedAttributes?.finishes && detectedAttributes.finishes.length > 0)
            ? detectedAttributes.finishes
            : getUniqueValues(finishCol);
        console.log("PriceMatrixBuilder: finishes:", finishes);
        finishes.forEach(f => {
            const count = combinedData.filter(row => {
                return Object.values(row).some(v =>
                    v === f || String(v).toLowerCase() === f.toLowerCase()
                );
            }).length;
            result.push({ value: f, type: "finish", count });
        });

        console.log("PriceMatrixBuilder: availableValues result:", result);
        return result;
    }, [combinedData, detectedAttributes]);

    // Get mapped value strings for filtering
    const mappedValueIds = useMemo(() => {
        const all = [...mapping.formats, ...mapping.materials, ...mapping.finishes];
        return new Set(all.map((v) => v.originalValue));
    }, [mapping]);

    // Available (unmapped) values filtered
    const unmappedValues = useMemo(() => {
        return availableValues.filter((v) => !mappedValueIds.has(v.value));
    }, [availableValues, mappedValueIds]);

    // Extract quantities from detected attributes
    const quantities = useMemo(() => {
        const qtys = detectedAttributes?.quantities;
        if (Array.isArray(qtys)) {
            return qtys.map(q => typeof q === 'number' ? q : parseInt(String(q), 10)).filter(n => !isNaN(n));
        }
        return [];
    }, [detectedAttributes]);

    // Handle drop to zone
    const handleDrop = useCallback((zone: keyof AttributeMapping, value: string) => {
        const valueData = availableValues.find((v) => v.value === value);
        if (!valueData) return;

        // Count connected rows
        const connectedRows = combinedData.filter(row => {
            return Object.values(row).some(v =>
                v === value || String(v) === value || String(v).toLowerCase() === value.toLowerCase()
            );
        });

        const newItem: MappedValue = {
            id: `${zone}-${value}-${Date.now()}`,
            originalValue: value,
            displayName: value,
            priceCount: connectedRows.length,
            connectedRows,
            widthMm: null,
            heightMm: null,
            imageUrl: "",
        };

        setMapping((prev) => ({
            ...prev,
            [zone]: [...prev[zone], newItem],
        }));
        setDraggingValue(null);
    }, [availableValues, combinedData]);

    // Handle remove from zone
    const handleRemove = useCallback((zone: keyof AttributeMapping, id: string) => {
        setMapping((prev) => ({
            ...prev,
            [zone]: prev[zone].filter((item) => item.id !== id),
        }));
    }, []);

    // Handle rename
    const handleRename = useCallback((zone: keyof AttributeMapping, id: string, newName: string) => {
        setMapping((prev) => ({
            ...prev,
            [zone]: prev[zone].map((item) =>
                item.id === id ? { ...item, displayName: newName } : item
            ),
        }));
    }, []);

    const handleUpdate = useCallback((zone: keyof AttributeMapping, id: string, patch: Partial<MappedValue>) => {
        setMapping((prev) => ({
            ...prev,
            [zone]: prev[zone].map((item) =>
                item.id === id ? { ...item, ...patch } : item
            ),
        }));
    }, []);

    const isReadyToExport = mapping.formats.length > 0 && mapping.materials.length > 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-semibold">Pris Matrix Builder</h3>
                    <p className="text-sm text-muted-foreground">
                        Træk værdier fra venstre til de rigtige kategorier
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        For design-online: angiv bredde/højde (mm) på formater. Du kan også sætte billede-URL på værdier.
                    </p>
                </div>
                <Button
                    disabled={!isReadyToExport}
                    onClick={() => onMappingComplete(mapping, quantities)}
                >
                    <Send className="h-4 w-4 mr-2" />
                    Fortsæt til eksport
                </Button>
            </div>

            <Separator />

            <div className="grid grid-cols-12 gap-6">
                {/* Left: Available Values */}
                <div className="col-span-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Tilgængelige værdier</CardTitle>
                            <CardDescription>
                                {unmappedValues.length} værdier · Træk til højre
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px] pr-4">
                                <div className="space-y-2">
                                    {unmappedValues.map((item) => (
                                        <DraggableValueChip
                                            key={item.value}
                                            value={item.value}
                                            priceCount={item.count}
                                            onDragStart={setDraggingValue}
                                            isDragging={draggingValue === item.value}
                                        />
                                    ))}
                                    {unmappedValues.length === 0 && (
                                        <div className="text-center text-muted-foreground text-sm py-8">
                                            Alle værdier er blevet tildelt
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Drop Zones */}
                <div className="col-span-8 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <DropZone
                            title="Formater (vandret akse)"
                            zoneType="formats"
                            icon={LayoutGrid}
                            items={mapping.formats}
                            onDrop={(v) => handleDrop("formats", v)}
                            onRemove={(id) => handleRemove("formats", id)}
                            onRename={(id, name) => handleRename("formats", id, name)}
                            onUpdate={(id, patch) => handleUpdate("formats", id, patch)}
                            color="bg-blue-500"
                        />
                        <DropZone
                            title="Materialer (lodret akse)"
                            zoneType="materials"
                            icon={Layers}
                            items={mapping.materials}
                            onDrop={(v) => handleDrop("materials", v)}
                            onRemove={(id) => handleRemove("materials", id)}
                            onRename={(id, name) => handleRename("materials", id, name)}
                            onUpdate={(id, patch) => handleUpdate("materials", id, patch)}
                            color="bg-green-500"
                        />
                    </div>
                    <DropZone
                        title="Efterbehandling (valgfrit)"
                        zoneType="finishes"
                        icon={Palette}
                        items={mapping.finishes}
                        onDrop={(v) => handleDrop("finishes", v)}
                        onRemove={(id) => handleRemove("finishes", id)}
                        onRename={(id, name) => handleRename("finishes", id, name)}
                        onUpdate={(id, patch) => handleUpdate("finishes", id, patch)}
                        color="bg-purple-500"
                    />

                    {/* Preview */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm">
                                <Eye className="h-4 w-4" />
                                Matrix forhåndsvisning
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <MatrixPreview mapping={mapping} quantities={quantities} />
                            {quantities.length > 0 && (
                                <div className="mt-3 text-xs text-muted-foreground">
                                    Antal fra CSV: {quantities.join(", ")}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default PriceMatrixBuilder;
