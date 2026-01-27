
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PriceMatrix } from "./PriceMatrix";

interface MachineConfiguratorProps {
    productId: string;
    width: number;
    height: number;
    onPriceUpdate: (priceData: any) => void;
}

export function MachineConfigurator({ productId, width, height, onPriceUpdate }: MachineConfiguratorProps) {
    const [loading, setLoading] = useState(true);
    const [calculating, setCalculating] = useState(false);
    const [config, setConfig] = useState<any>(null);
    const [materials, setMaterials] = useState<any[]>([]);
    const [finishes, setFinishes] = useState<any[]>([]);
    const [optionGroups, setOptionGroups] = useState<any[]>([]);

    // Selection state
    const [selection, setSelection] = useState({
        quantity: 0,
        material_id: "",
        sides: "4+0",
        finish_ids: [] as string[],
        selected_options: {} as Record<string, string>, // groupId -> optionId
        size_name: "Brugerdefineret",
        width: width,
        height: height
    });

    const [priceResult, setPriceResult] = useState<any>(null);
    const [matrixData, setMatrixData] = useState<{ rows: string[], columns: number[], cells: any } | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { data: cfg, error: cfgErr } = await supabase
                .from('product_pricing_configs' as any)
                .select(`
          *,
          pricing_profiles(*),
          margin_profiles(*)
        `)
                .eq('product_id', productId)
                .single();

            if (cfgErr) throw cfgErr;
            const mpaCfg = cfg as any;
            setConfig(mpaCfg);

            // Fetch materials and finishes (from both master and current tenant)
            const tenantIds = ['00000000-0000-0000-0000-000000000000'];
            if (mpaCfg.tenant_id && mpaCfg.tenant_id !== tenantIds[0]) {
                tenantIds.push(mpaCfg.tenant_id);
            }

            const [matRes, finRes, optGroupRes] = await Promise.all([
                supabase.from('materials' as any).select('*').in('tenant_id', tenantIds),
                supabase.from('finish_options' as any).select('*').in('tenant_id', tenantIds),
                // Fetch option groups assigned to this product
                supabase.from('product_option_group_assignments' as any)
                    .select('option_group_id, product_option_groups(*, product_options(*))')
                    .eq('product_id', productId)
            ]);

            let mats = (matRes.data || []) as any[];
            let fins = (finRes.data || []) as any[];
            const groups = (optGroupRes.data || []).map((a: any) => a.product_option_groups).filter(Boolean) as any[];

            console.log('[MachineConfigurator] Fetched materials:', mats.map(m => m.name));
            console.log('[MachineConfigurator] Config material_ids:', mpaCfg.material_ids);

            // Filter if specified in config
            if (mpaCfg.material_ids?.length > 0) {
                mats = mats.filter(m => mpaCfg.material_ids.includes(m.id));
                console.log('[MachineConfigurator] After filtering:', mats.map(m => m.name));
            }
            if (mpaCfg.finish_ids?.length > 0) {
                fins = fins.filter(f => mpaCfg.finish_ids.includes(f.id));
            }

            setMaterials(mats);
            setFinishes(fins);
            setOptionGroups(groups);

            // Build default selected options (first option in each group)
            const defaultOptions: Record<string, string> = {};
            groups.forEach((g: any) => {
                if (g.product_options?.length > 0) {
                    defaultOptions[g.id] = g.product_options[0].id;
                }
            });

            // Default selection
            setSelection({
                quantity: mpaCfg.quantities?.[0] || 100,
                material_id: mats[0]?.id || "",
                sides: mpaCfg.allowed_sides === '4+4_ONLY' ? '4+4' : '4+0',
                finish_ids: [],
                selected_options: defaultOptions,
                size_name: mpaCfg.sizes?.[0]?.name || "Brugerdefineret",
                width: mpaCfg.sizes?.[0]?.width || width,
                height: mpaCfg.sizes?.[0]?.height || height
            });

        } catch (err: any) {
            console.error("Error loading MPA config:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [productId]);

    const calculatePrice = async () => {
        console.log('[MachineConfigurator] calculatePrice called with dimensions:', selection.width, 'x', selection.height);

        // Always calculate batch for all materials and quantities
        if (!materials.length || !config?.quantities?.length) {
            console.log("Skipping calculation: no materials or quantities");
            return;
        }

        setCalculating(true);
        try {
            const body = {
                productId,
                width: selection.width,
                height: selection.height,
                bleed_mm: config.bleed_mm,
                gap_mm: config.gap_mm,
                sides: selection.sides,
                finish_ids: selection.finish_ids,
                coverage: 10,
                // Always batch: send all material_ids and quantities
                material_ids: materials.map(m => m.id),
                quantities: config.quantities
            };

            const { data, error } = await supabase.functions.invoke('calculate-machine-price', { body });

            if (error) throw error;

            if (data.results) {
                // Format results for PriceMatrix
                const results = data.results as any[];
                const rows = [...new Set(results.map(r => r.materialName))];
                const columns = [...new Set(results.map(r => r.quantity))].sort((a, b) => a - b);
                const cells: any = {};

                results.forEach(r => {
                    if (!cells[r.materialName]) cells[r.materialName] = {};
                    cells[r.materialName][r.quantity] = r.totalPrice;
                });

                setMatrixData({ rows, columns, cells });

                // Also update priceResult for the currently "selected" or first cell
                const current = results.find(r => r.materialId === selection.material_id && r.quantity === selection.quantity) || results[0];
                if (current) {
                    console.log('[MachineConfigurator] Calling onPriceUpdate with:', current);
                    setPriceResult(current);
                    onPriceUpdate(current);
                } else {
                    console.log('[MachineConfigurator] No current result to update price with');
                }
            }
        } catch (err: any) {
            console.error("Price calculation error:", err);
        } finally {
            setCalculating(false);
        }
    };

    // Recalculate when selection OR config OR dimensions change
    useEffect(() => {
        if (config && materials.length > 0 && selection.width > 0 && selection.height > 0) {
            calculatePrice();
        }
    }, [selection.width, selection.height, selection.finish_ids, config, materials]);

    // Update dimensions if prop changes (for parent-controlled dimensions)
    useEffect(() => {
        if (!config?.sizes?.length) {
            setSelection(s => ({ ...s, width, height }));
        }
    }, [width, height]);


    if (loading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>;
    if (!config) return null;

    // Calculate area in m²
    const areaM2 = (selection.width / 1000) * (selection.height / 1000);

    return (
        <div className="space-y-6">
            {/* Din størrelse - Banner style */}
            <div className="bg-muted/50 border rounded-lg p-6">
                <h3 className="font-semibold mb-4">Din størrelse</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div className="space-y-2">
                        <Label htmlFor="mpa-width">Bredde (cm)</Label>
                        <Input
                            id="mpa-width"
                            type="number"
                            min="1"
                            max="5000"
                            value={Math.round(selection.width / 10)}
                            onChange={e => setSelection(s => ({ ...s, width: (parseInt(e.target.value) || 0) * 10 }))}
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="mpa-height">Højde (cm)</Label>
                        <Input
                            id="mpa-height"
                            type="number"
                            min="1"
                            max="5000"
                            value={Math.round(selection.height / 10)}
                            onChange={e => setSelection(s => ({ ...s, height: (parseInt(e.target.value) || 0) * 10 }))}
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Beregnet areal</Label>
                        <div className="h-10 flex items-center px-3 bg-primary/10 rounded-md border border-primary/20">
                            <span className="font-semibold text-primary">{areaM2.toFixed(2)} m²</span>
                        </div>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                    Prisen beregnes automatisk baseret på din størrelse.
                </p>
            </div>

            {/* Laminering / Finish Options with Icons */}
            {finishes.length > 0 && (
                <div>
                    <h3 className="font-semibold mb-4">Laminering</h3>
                    <div className="flex flex-wrap gap-4">
                        {/* Add "Ingen laminering" option */}
                        <button
                            onClick={() => setSelection({ ...selection, finish_ids: [] })}
                            className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all min-w-[100px] ${selection.finish_ids.length === 0
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                                }`}
                        >
                            <div className="w-12 h-12 mb-2 flex items-center justify-center bg-muted rounded-lg">
                                <span className="text-2xl">∅</span>
                            </div>
                            <span className="text-xs font-medium text-center">Ingen laminering</span>
                        </button>
                        {finishes.map(f => (
                            <button
                                key={f.id}
                                onClick={() => {
                                    const ids = selection.finish_ids.includes(f.id)
                                        ? selection.finish_ids.filter(id => id !== f.id)
                                        : [...selection.finish_ids.filter(id => !finishes.some(fin => fin.id === id && fin.pricing_mode === f.pricing_mode)), f.id];
                                    setSelection({ ...selection, finish_ids: ids });
                                }}
                                className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all min-w-[100px] ${selection.finish_ids.includes(f.id)
                                    ? 'border-primary bg-primary/5'
                                    : 'border-border hover:border-primary/50'
                                    }`}
                            >
                                <div className="w-12 h-12 mb-2 flex items-center justify-center bg-muted rounded-lg overflow-hidden">
                                    {f.icon_url ? (
                                        <img src={f.icon_url} alt={f.name} className="w-10 h-10 object-contain" />
                                    ) : (
                                        <span className="text-2xl">🎨</span>
                                    )}
                                </div>
                                <span className="text-xs font-medium text-center">{f.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Materiale / Antal Matrix */}
            <div>
                <PriceMatrix
                    rows={materials.map(m => m.name)}
                    columns={config.quantities || [1, 2, 5, 10, 20, 50]}
                    cells={matrixData?.cells || {}}
                    selectedCell={selection.material_id ? {
                        row: materials.find(m => m.id === selection.material_id)?.name || "",
                        column: selection.quantity
                    } : null}
                    onCellClick={(rowName, qty, base) => {
                        const mat = materials.find(m => m.name === rowName);
                        if (mat) {
                            setSelection(s => ({ ...s, material_id: mat.id, quantity: qty }));
                            // Find the price from matrixData
                            const price = matrixData?.cells?.[rowName]?.[qty];
                            if (price) {
                                onPriceUpdate({
                                    totalPrice: price,
                                    unitPrice: price / qty,
                                    materialName: rowName,
                                    quantity: qty
                                });
                            }
                        }
                    }}
                    columnUnit="stk"
                    customArea={areaM2}
                />
            </div>
        </div>
    );
}

