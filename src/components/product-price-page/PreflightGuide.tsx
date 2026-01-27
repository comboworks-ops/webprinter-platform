
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Info, Ruler, Scissors, Milestone } from "lucide-react";

interface PreflightGuideProps {
    width: number;
    height: number;
    bleed: number;
    minDpi?: number;
}

export const PreflightGuide: React.FC<PreflightGuideProps> = ({ width, height, bleed, minDpi = 300 }) => {
    // Calculate display height for the preview box (maintain aspect ratio)
    const previewWidth = 120;
    const ratio = height / width;
    const previewHeight = Math.min(Math.max(ratio * previewWidth, 80), 180);

    return (
        <Card className="overflow-hidden border-primary/20 bg-primary/5 shadow-sm">
            <CardHeader className="py-3 px-4 bg-primary/10 border-b border-primary/10">
                <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-bold uppercase tracking-tight">Preflight Guide</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                {/* Visual Preview */}
                <div className="flex justify-center py-2">
                    <div
                        className="relative bg-white border border-slate-200 shadow-sm flex items-center justify-center transition-all duration-500 ease-in-out"
                        style={{
                            width: `${previewWidth}px`,
                            height: `${previewHeight}px`,
                        }}
                    >
                        {/* Bleed line (Red Dashed) */}
                        <div
                            className="absolute border border-red-500 border-dashed pointer-events-none"
                            style={{
                                top: `${(bleed / (height + bleed * 2)) * 100}%`,
                                bottom: `${(bleed / (height + bleed * 2)) * 100}%`,
                                left: `${(bleed / (width + bleed * 2)) * 100}%`,
                                right: `${(bleed / (width + bleed * 2)) * 100}%`,
                            }}
                        />
                        <span className="text-[10px] font-medium text-slate-400 rotate-0">Tryk-område</span>
                    </div>
                </div>

                {/* Specs List */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="flex items-start gap-2">
                        <Ruler className="h-3.5 w-3.5 mt-0.5 text-slate-500" />
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold leading-none mb-1">Netto Format</p>
                            <p className="text-sm font-semibold">{width} x {height} mm</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <Scissors className="h-3.5 w-3.5 mt-0.5 text-red-500" />
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold leading-none mb-1">Beskæring</p>
                            <p className="text-sm font-semibold">{bleed} mm (Bleed)</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <Milestone className="h-3.5 w-3.5 mt-0.5 text-slate-500" />
                        <div>
                            <p className="text-[10px] text-slate-500 uppercase font-bold leading-none mb-1">Brutto Mål</p>
                            <p className="text-sm font-semibold">{(width + bleed * 2).toFixed(1)} x {(height + bleed * 2).toFixed(1)} mm</p>
                        </div>
                    </div>
                    {minDpi && (
                        <div className="flex items-start gap-2">
                            <Info className="h-3.5 w-3.5 mt-0.5 text-blue-500" />
                            <div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold leading-none mb-1">Opløsning</p>
                                <p className="text-sm font-semibold">Min. {minDpi} DPI</p>
                            </div>
                        </div>
                    )}
                </div>

                <p className="text-[11px] text-slate-500 italic border-t border-primary/10 pt-3">
                    Husk at inkludere {bleed} mm beskæring på alle sider af din fil. Den røde stiplede linje viser, hvor dit design bliver skåret.
                </p>
            </CardContent>
        </Card>
    );
};
