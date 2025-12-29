
import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Cpu, Droplet, Layers, Percent, Settings2, Trash2, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// Forms
import { MachineForm } from "./MachineForm";
import { InkSetForm } from "./InkSetForm";
import { MaterialForm } from "./MaterialForm";
import { MarginProfileForm } from "./MarginProfileForm";
import { PricingProfileForm } from "./PricingProfileForm";

/**
 * MachinePricingManager
 * Main administrative interface for the Machine Pricing Add-On (MPA).
 */
export function MachinePricingManager() {
    const [activeTab, setActiveTab] = useState("machines");
    const [loading, setLoading] = useState(true);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [data, setData] = useState<{
        machines: any[];
        inkSets: any[];
        materials: any[];
        marginProfiles: any[];
        pricingProfiles: any[];
    }>({
        machines: [],
        inkSets: [],
        materials: [],
        marginProfiles: [],
        pricingProfiles: []
    });

    // Dialog state
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { tenantId: tid } = await resolveAdminTenant();
            if (!tid) return;
            setTenantId(tid);

            const [m, i, mat, marg, p] = await Promise.all([
                (supabase.from('machines' as any).select('*').eq('tenant_id', tid)),
                (supabase.from('ink_sets' as any).select('*').eq('tenant_id', tid)),
                (supabase.from('materials' as any).select('*').eq('tenant_id', tid)),
                (supabase.from('margin_profiles' as any).select('*, margin_profile_tiers(*)').eq('tenant_id', tid)),
                (supabase.from('pricing_profiles' as any).select('*').eq('tenant_id', tid))
            ]);

            setData({
                machines: m.data || [],
                inkSets: i.data || [],
                materials: mat.data || [],
                marginProfiles: (marg.data || []).map((mp: any) => ({
                    ...mp,
                    tiers: mp.margin_profile_tiers || []
                })),
                pricingProfiles: p.data || []
            });
        } catch (e) {
            toast.error("Kunne ikke hente data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDelete = async (table: string, id: string) => {
        if (!confirm("Er du sikker?")) return;
        const { error } = await supabase.from(table as any).delete().eq('id', id);
        if (error) toast.error("Fejl ved sletning");
        else {
            toast.success("Slettet");
            fetchData();
        }
    };

    const openAdd = () => {
        setEditingItem(null);
        setIsDialogOpen(true);
    };

    const openEdit = (item: any) => {
        setEditingItem(item);
        setIsDialogOpen(true);
    };

    if (loading && data.machines.length === 0) {
        return <div className="p-8 text-center">Indlæser...</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Maskin-beregning</h1>
                    <p className="text-muted-foreground mt-1">
                        Konfigurer dine trykmaskiner, blæk-omkostninger og materialer.
                    </p>
                </div>
                <Button className="gap-2" onClick={openAdd}>
                    <Plus className="h-4 w-4" />
                    Opret Ny
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-5 h-auto p-1 bg-muted/50 border rounded-xl overflow-hidden mb-8">
                    <TabsTrigger value="machines" className="py-3 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all grayscale data-[state=active]:grayscale-0">
                        <Cpu className="h-4 w-4" />
                        <span className="font-medium">Maskiner</span>
                    </TabsTrigger>
                    <TabsTrigger value="ink" className="py-3 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all grayscale data-[state=active]:grayscale-0">
                        <Droplet className="h-4 w-4" />
                        <span className="font-medium">Blæk</span>
                    </TabsTrigger>
                    <TabsTrigger value="materials" className="py-3 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all grayscale data-[state=active]:grayscale-0">
                        <Layers className="h-4 w-4" />
                        <span className="font-medium">Materialer</span>
                    </TabsTrigger>
                    <TabsTrigger value="margins" className="py-3 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all grayscale data-[state=active]:grayscale-0">
                        <Percent className="h-4 w-4" />
                        <span className="font-medium">Marginer</span>
                    </TabsTrigger>
                    <TabsTrigger value="profiles" className="py-3 gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm transition-all grayscale data-[state=active]:grayscale-0">
                        <Settings2 className="h-4 w-4" />
                        <span className="font-medium">Profiler</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="machines" className="mt-0 outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.machines.map(m => {
                            const capacityM2h = m.mode === 'SHEET'
                                ? (m.sheet_width_mm * m.sheet_height_mm * (m.sheets_per_hour || 0)) / 1000000
                                : (m.roll_width_mm / 1000) * (m.roll_velocity_m_per_min || 0) * 60;

                            return (
                                <Card key={m.id} className="group relative overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-md cursor-pointer" onClick={() => openEdit(m)}>
                                    <div className="p-5 flex items-start justify-between">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                                    <Cpu className="h-5 w-5" />
                                                </div>
                                                <h3 className="font-bold text-lg leading-tight">{m.name}</h3>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                                    <Badge variant="secondary" className="font-bold uppercase tracking-wider text-[10px]">
                                                        {m.mode === 'SHEET' ? 'Ark-maskine' : 'Rulle-maskine'}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    Kapacitet: <span className="text-foreground font-bold italic underline decoration-primary/30">
                                                        {capacityM2h.toFixed(1)} m²/t
                                                    </span>
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Arbejds-bredde: <span className="text-foreground font-semibold">
                                                        {m.mode === 'SHEET' ? `${m.sheet_width_mm}x${m.sheet_height_mm} mm` : `${m.roll_width_mm} mm`}
                                                    </span>
                                                </p>
                                                <p className="text-sm text-muted-foreground italic font-medium">
                                                    Drift-omkostning: <span className="text-primary font-bold">{m.machine_rate_per_hour} kr/t</span>
                                                </p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleDelete('machines', m.id); }}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-primary/30 group-hover:h-1.5 transition-all" />
                                </Card>
                            );
                        })}
                        <button onClick={openAdd} className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all duration-300 min-h-[160px]">
                            <Plus className="h-8 w-8 mb-2 opacity-50" />
                            <span className="font-bold tracking-tight">Opret ny maskine</span>
                        </button>
                    </div>
                </TabsContent>

                <TabsContent value="ink" className="mt-0 outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.inkSets.map(i => (
                            <Card key={i.id} className="group relative overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-md cursor-pointer" onClick={() => openEdit(i)}>
                                <div className="p-5 flex items-start justify-between">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                                                <Droplet className="h-5 w-5" />
                                            </div>
                                            <h3 className="font-bold text-lg leading-tight">{i.name}</h3>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Badge variant="outline" className="font-bold text-[10px] text-blue-600 border-blue-200">BLÆK-SYSTEM</Badge>
                                            <p className="text-sm text-muted-foreground">
                                                Pris pr. ml: <span className="text-foreground font-bold">{i.price_per_ml} kr</span>
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Standard-forbrug: <span className="text-foreground font-semibold">{i.ml_per_m2_at_100pct} ml/m²</span>
                                            </p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleDelete('ink_sets', i.id); }}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </Card>
                        ))}
                        <button onClick={openAdd} className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 text-muted-foreground hover:text-blue-500 transition-all duration-300 min-h-[160px]">
                            <Plus className="h-8 w-8 mb-2 opacity-50" />
                            <span className="font-bold tracking-tight">Opret nyt blæksæt</span>
                        </button>
                    </div>
                </TabsContent>

                <TabsContent value="materials" className="mt-0 outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.materials.map(m => (
                            <Card key={m.id} className="group relative overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-md cursor-pointer" onClick={() => openEdit(m)}>
                                <div className="p-5 flex items-start justify-between">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                                                <Layers className="h-5 w-5" />
                                            </div>
                                            <h3 className="font-bold text-lg leading-tight">{m.name}</h3>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Badge variant="outline" className="font-bold text-[10px] text-orange-600 border-orange-200 uppercase">{m.material_type}</Badge>
                                            <p className="text-sm text-muted-foreground">
                                                Model: <span className="text-foreground font-semibold">{m.pricing_mode === 'PER_SHEET' ? 'Pr. Ark' : 'Pr. kvadratmeter'}</span>
                                            </p>
                                            <p className="text-sm text-muted-foreground font-bold text-orange-600">
                                                {m.pricing_mode === 'PER_SHEET' ? `${m.price_per_sheet} kr/ark` : `${m.price_per_m2} kr/m²`}
                                            </p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleDelete('materials', m.id); }}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </Card>
                        ))}
                        <button onClick={openAdd} className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl hover:border-orange-500/50 hover:bg-orange-500/5 text-muted-foreground hover:text-orange-500 transition-all duration-300 min-h-[160px]">
                            <Plus className="h-8 w-8 mb-2 opacity-50" />
                            <span className="font-bold tracking-tight">Opret nyt materiale</span>
                        </button>
                    </div>
                </TabsContent>

                <TabsContent value="margins" className="mt-0 outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.marginProfiles.map(m => {
                            const minQty = m.tiers?.length > 0 ? Math.min(...m.tiers.map((t: any) => t.qty_from)) : 0;
                            const maxQty = m.tiers?.length > 0 ? Math.max(...m.tiers.map((t: any) => t.qty_to || 999999)) : 0;
                            const marginRange = m.tiers?.length > 0
                                ? `${Math.min(...m.tiers.map((t: any) => t.value))}% - ${Math.max(...m.tiers.map((t: any) => t.value))}%`
                                : `${m.min_margin_pct || 0}%`;

                            return (
                                <Card key={m.id} className="group relative overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-md cursor-pointer" onClick={() => openEdit(m)}>
                                    <div className="p-5 flex items-start justify-between">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                                                    <Percent className="h-5 w-5" />
                                                </div>
                                                <h3 className="font-bold text-lg leading-tight">{m.name}</h3>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Badge variant="outline" className="font-bold text-[10px] text-green-600 border-green-200">
                                                    {m.mode === 'TARGET_MARGIN' ? 'MÅL-AVANCE' : 'MARKUP'}
                                                </Badge>
                                                <p className="text-sm text-muted-foreground italic">
                                                    Interval: <span className="text-foreground font-bold">{minQty} - {maxQty === 999999 ? '∞' : maxQty} stk</span>
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Dækning: <span className="text-green-600 font-bold">{marginRange}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleDelete('margin_profiles', m.id); }}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                        <button onClick={openAdd} className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl hover:border-green-500/50 hover:bg-green-500/5 text-muted-foreground hover:text-green-500 transition-all duration-300 min-h-[160px]">
                            <Plus className="h-8 w-8 mb-2 opacity-50" />
                            <span className="font-bold tracking-tight">Opret margin-profil</span>
                        </button>
                    </div>
                </TabsContent>

                <TabsContent value="profiles" className="mt-0 outline-none">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.pricingProfiles.map(p => {
                            const machine = data.machines.find(m => m.id === p.machine_id);
                            const inkSet = data.inkSets.find(i => i.id === p.ink_set_id);
                            return (
                                <Card key={p.id} className="group relative overflow-hidden border-2 bg-primary/5 border-primary/20 hover:border-primary/50 transition-all duration-300 hover:shadow-md cursor-pointer" onClick={() => openEdit(p)}>
                                    <div className="p-5 flex items-start justify-between">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-primary text-primary-foreground shadow-sm">
                                                    <Settings2 className="h-5 w-5" />
                                                </div>
                                                <h3 className="font-bold text-lg leading-tight tracking-tight">{p.name}</h3>
                                            </div>
                                            <div className="grid grid-cols-1 gap-1.5">
                                                <div className="flex items-center gap-2 text-xs font-medium bg-white/50 p-1.5 rounded border border-primary/10">
                                                    <Cpu className="h-3 w-3 text-primary" />
                                                    {machine?.name || 'Vælg maskine...'}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs font-medium bg-white/50 p-1.5 rounded border border-primary/10">
                                                    <Droplet className="h-3 w-3 text-blue-500" />
                                                    {inkSet?.name || 'Vælg blæk...'}
                                                </div>
                                            </div>
                                            <div className="space-y-1 pt-1">
                                                {machine && inkSet && (
                                                    <p className="text-[11px] text-primary font-bold italic">
                                                        Est. maskin-emne pris: <span className="underline">
                                                            {((machine.machine_rate_per_hour / (machine.sheets_per_hour || 1)) + (inkSet.price_per_ml * inkSet.ml_per_m2_at_100pct * 0.1)).toFixed(2)} kr/m²
                                                        </span>
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-4">
                                                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                                                        Bleed: <span className="text-foreground">{p.default_bleed_mm}mm</span>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                                                        Gap: <span className="text-foreground">{p.default_gap_mm}mm</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); handleDelete('pricing_profiles', p.id); }}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <div className="absolute top-0 right-0 p-2">
                                        <Badge className="bg-primary hover:bg-primary font-bold shadow-sm">AKTIV SKABELON</Badge>
                                    </div>
                                </Card>
                            );
                        })}
                        <button onClick={openAdd} className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all duration-300 min-h-[200px]">
                            <Plus className="h-8 w-8 mb-2 opacity-50" />
                            <span className="font-bold tracking-tight">Opret ny pris-skabelon</span>
                        </button>
                    </div>
                </TabsContent>
            </Tabs>

            {/* Forms Integration */}
            {tenantId && (
                <>
                    {activeTab === "machines" && (
                        <MachineForm
                            open={isDialogOpen}
                            onOpenChange={setIsDialogOpen}
                            machine={editingItem}
                            tenantId={tenantId}
                            onSuccess={fetchData}
                        />
                    )}
                    {activeTab === "ink" && (
                        <InkSetForm
                            open={isDialogOpen}
                            onOpenChange={setIsDialogOpen}
                            inkSet={editingItem}
                            tenantId={tenantId}
                            onSuccess={fetchData}
                        />
                    )}
                    {activeTab === "materials" && (
                        <MaterialForm
                            open={isDialogOpen}
                            onOpenChange={setIsDialogOpen}
                            material={editingItem}
                            tenantId={tenantId}
                            onSuccess={fetchData}
                        />
                    )}
                    {activeTab === "margins" && (
                        <MarginProfileForm
                            open={isDialogOpen}
                            onOpenChange={setIsDialogOpen}
                            profile={editingItem}
                            tenantId={tenantId}
                            onSuccess={fetchData}
                        />
                    )}
                    {activeTab === "profiles" && (
                        <PricingProfileForm
                            open={isDialogOpen}
                            onOpenChange={setIsDialogOpen}
                            profile={editingItem}
                            tenantId={tenantId}
                            machines={data.machines}
                            inkSets={data.inkSets}
                            onSuccess={fetchData}
                        />
                    )}
                </>
            )}
        </div>
    );
}
