import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Info, MousePointer2 } from "lucide-react";
import { ProductPagePreview, type TooltipConfig, ANCHOR_ZONES } from "./ProductPagePreview";
import { TooltipEditor } from "./TooltipEditor";

interface VisualTooltipDesignerProps {
    productName?: string;
    productImage?: string;
    tooltips: TooltipConfig[];
    onTooltipsChange: (tooltips: TooltipConfig[]) => void;
    formats?: { id: string; label: string }[];
    materials?: { id: string; label: string }[];
    quantities?: number[];
}

export function VisualTooltipDesigner({
    productName,
    productImage,
    tooltips,
    onTooltipsChange,
    formats,
    materials,
    quantities
}: VisualTooltipDesignerProps) {
    const [selectedAnchor, setSelectedAnchor] = useState<string | null>(null);
    const [hoveredAnchor, setHoveredAnchor] = useState<string | null>(null);

    const handleAnchorClick = (anchorId: string) => {
        setSelectedAnchor(anchorId);
    };

    const handleSaveTooltip = (tooltip: TooltipConfig) => {
        const existingIndex = tooltips.findIndex(t => t.anchor === tooltip.anchor);
        let newTooltips: TooltipConfig[];

        if (existingIndex >= 0) {
            newTooltips = [...tooltips];
            newTooltips[existingIndex] = tooltip;
        } else {
            newTooltips = [...tooltips, tooltip];
        }

        onTooltipsChange(newTooltips);
        setSelectedAnchor(null);
    };

    const handleDeleteTooltip = (anchorId: string) => {
        const newTooltips = tooltips.filter(t => t.anchor !== anchorId);
        onTooltipsChange(newTooltips);
        setSelectedAnchor(null);
    };

    const handleCancel = () => {
        setSelectedAnchor(null);
    };

    const existingTooltip = selectedAnchor
        ? tooltips.find(t => t.anchor === selectedAnchor)
        : null;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">Visual Tooltip Designer</h3>
                    <p className="text-sm text-muted-foreground">
                        Klik på et område i preview'et for at tilføje en tooltip
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                    <Info className="w-3 h-3" />
                    {tooltips.length} tooltip{tooltips.length !== 1 ? 's' : ''} konfigureret
                </div>
            </div>

            {/* Main Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Product Preview */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MousePointer2 className="w-3 h-3" />
                        Hover over områder for at se anchor-punkter
                    </div>
                    <ProductPagePreview
                        productName={productName}
                        productImage={productImage}
                        formats={formats}
                        materials={materials}
                        quantities={quantities}
                        tooltips={tooltips}
                        selectedAnchor={selectedAnchor}
                        hoveredAnchor={hoveredAnchor}
                        onAnchorClick={handleAnchorClick}
                        onAnchorHover={setHoveredAnchor}
                        isEditMode={true}
                    />
                </div>

                {/* Right: Tooltip Editor */}
                <div>
                    <Card className="h-full">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium">Tooltip Editor</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <TooltipEditor
                                selectedAnchor={selectedAnchor}
                                existingTooltip={existingTooltip}
                                onSave={handleSaveTooltip}
                                onDelete={handleDeleteTooltip}
                                onCancel={handleCancel}
                            />
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Configured Tooltips List */}
            {tooltips.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Konfigurerede Tooltips</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {tooltips.map((tooltip) => {
                                const zone = ANCHOR_ZONES.find(z => z.id === tooltip.anchor);
                                return (
                                    <div
                                        key={tooltip.anchor}
                                        className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                                        onClick={() => setSelectedAnchor(tooltip.anchor)}
                                    >
                                        <div
                                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                            style={{ backgroundColor: tooltip.color }}
                                        >
                                            {tooltip.icon === 'info' && 'i'}
                                            {tooltip.icon === 'question' && '?'}
                                            {tooltip.icon === 'lightbulb' && '💡'}
                                            {tooltip.icon === 'star' && '★'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium truncate">{zone?.labelDa}</div>
                                            <div className="text-[10px] text-muted-foreground truncate">{tooltip.text}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
