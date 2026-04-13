import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Copy, Cpu, Droplet, Layers, Loader2, Percent, Plus, Settings2, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

import { MachineForm } from "./MachineForm";
import { InkSetForm } from "./InkSetForm";
import { MaterialForm } from "./MaterialForm";
import { MarginProfileForm } from "./MarginProfileForm";
import { PricingProfileForm } from "./PricingProfileForm";

const DUPLICATE_SUFFIX = " (kopi)";

const getDuplicateName = (name?: string | null) => `${name || "Ny profil"}${DUPLICATE_SUFFIX}`;

const stripBaseFields = (record: Record<string, any>, extraKeys: string[] = []) => {
    const clone = { ...record };
    ["id", "created_at", "updated_at", ...extraKeys].forEach((key) => {
        delete clone[key];
    });
    return clone;
};

export function MachinePricingManager() {
    const [activeTab, setActiveTab] = useState("machines");
    const [loading, setLoading] = useState(true);
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [duplicateKey, setDuplicateKey] = useState<string | null>(null);
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

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            const { tenantId: tid } = await resolveAdminTenant();
            if (!tid) return;
            setTenantId(tid);

            const [m, i, mat, marg, p] = await Promise.all([
                supabase.from("machines" as any).select("*").eq("tenant_id", tid),
                supabase.from("ink_sets" as any).select("*").eq("tenant_id", tid),
                supabase.from("materials" as any).select("*").eq("tenant_id", tid),
                supabase.from("margin_profiles" as any).select("*, margin_profile_tiers(*)").eq("tenant_id", tid),
                supabase.from("pricing_profiles" as any).select("*").eq("tenant_id", tid)
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
        const { error } = await supabase.from(table as any).delete().eq("id", id);
        if (error) toast.error("Fejl ved sletning");
        else {
            toast.success("Slettet");
            fetchData();
        }
    };

    const duplicateItem = async (
        kind: "machines" | "ink" | "materials" | "margins" | "profiles",
        item: any,
        event?: React.MouseEvent
    ) => {
        event?.stopPropagation();
        if (!tenantId) return;

        const busyKey = `${kind}:${item.id}`;
        setDuplicateKey(busyKey);

        try {
            if (kind === "machines") {
                const payload = stripBaseFields(item, []);
                const { error } = await supabase.from("machines" as any).insert({
                    ...payload,
                    tenant_id: tenantId,
                    name: getDuplicateName(item.name),
                });
                if (error) throw error;
            }

            if (kind === "ink") {
                const payload = stripBaseFields(item, []);
                const { error } = await supabase.from("ink_sets" as any).insert({
                    ...payload,
                    tenant_id: tenantId,
                    name: getDuplicateName(item.name),
                });
                if (error) throw error;
            }

            if (kind === "materials") {
                const payload = stripBaseFields(item, []);
                const { error } = await supabase.from("materials" as any).insert({
                    ...payload,
                    tenant_id: tenantId,
                    name: getDuplicateName(item.name),
                });
                if (error) throw error;
            }

            if (kind === "profiles") {
                const payload = stripBaseFields(item, []);
                const { error } = await supabase.from("pricing_profiles" as any).insert({
                    ...payload,
                    tenant_id: tenantId,
                    name: getDuplicateName(item.name),
                });
                if (error) throw error;
            }

            if (kind === "margins") {
                const payload = stripBaseFields(item, ["tiers", "margin_profile_tiers"]);
                const { data: inserted, error } = await supabase
                    .from("margin_profiles" as any)
                    .insert({
                        ...payload,
                        tenant_id: tenantId,
                        name: getDuplicateName(item.name),
                    })
                    .select()
                    .single();
                if (error) throw error;

                const tiers = (item.tiers || item.margin_profile_tiers || []).map((tier: any, index: number) => ({
                    ...stripBaseFields(tier),
                    tenant_id: tenantId,
                    margin_profile_id: inserted.id,
                    sort_order: index,
                }));

                if (tiers.length > 0) {
                    const { error: tierError } = await supabase.from("margin_profile_tiers" as any).insert(tiers);
                    if (tierError) throw tierError;
                }
            }

            toast.success("Kopi oprettet");
            await fetchData();
        } catch (error: any) {
            toast.error(`Kunne ikke duplikere: ${error.message}`);
        } finally {
            setDuplicateKey(null);
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

    const overviewStats = useMemo(() => ([
        {
            label: "Maskiner",
            value: data.machines.length,
            description: "Produktionsenheder",
        },
        {
            label: "Blaeksaet",
            value: data.inkSets.length,
            description: "Farveprofiler",
        },
        {
            label: "Materialer",
            value: data.materials.length,
            description: "Raavarer",
        },
        {
            label: "Margin-profiler",
            value: data.marginProfiles.length,
            description: "Kommercielle regler",
        },
        {
            label: "Pris-profiler",
            value: data.pricingProfiles.length,
            description: "Klar til beregning",
        },
    ]), [data.inkSets.length, data.machines.length, data.marginProfiles.length, data.materials.length, data.pricingProfiles.length]);

    if (loading && data.machines.length === 0) {
        return <div className="p-8 text-center">Indlaeser...</div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-cyan-50 p-6 shadow-sm">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                    <div className="max-w-3xl space-y-3">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
                                Machine Pricing
                            </Badge>
                            <Badge className="rounded-full bg-cyan-100 px-3 py-1 text-cyan-700 hover:bg-cyan-100">
                                Produktionssystem
                            </Badge>
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Maskin-beregning</h1>
                            <p className="mt-2 text-muted-foreground">
                                Hele modulet er nu struktureret som et produktionssystem: maskiner, materialer, blaek, marginer og profiler arbejder sammen som genbrugelige byggesten.
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Aktiv sektion</div>
                            <div className="mt-1 font-semibold text-slate-900">
                                {activeTab === "machines" ? "Maskiner" : activeTab === "ink" ? "Blaek" : activeTab === "materials" ? "Materialer" : activeTab === "margins" ? "Marginer" : "Profiler"}
                            </div>
                        </div>
                        <Button className="gap-2 rounded-xl" onClick={openAdd}>
                            <Plus className="h-4 w-4" />
                            Opret ny
                        </Button>
                    </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                    {overviewStats.map((item) => (
                        <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
                            <div className="mt-2 text-2xl font-semibold text-slate-900">{item.value}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.description}</div>
                        </div>
                    ))}
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid h-auto w-full grid-cols-5 overflow-hidden rounded-[24px] border border-slate-200 bg-white p-1.5 shadow-sm">
                    <TabsTrigger value="machines" className="gap-2 rounded-[18px] py-3 transition-all data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm">
                        <Cpu className="h-4 w-4" />
                        <span className="font-medium">Maskiner</span>
                    </TabsTrigger>
                    <TabsTrigger value="ink" className="gap-2 rounded-[18px] py-3 transition-all data-[state=active]:bg-sky-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                        <Droplet className="h-4 w-4" />
                        <span className="font-medium">Blaek</span>
                    </TabsTrigger>
                    <TabsTrigger value="materials" className="gap-2 rounded-[18px] py-3 transition-all data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm">
                        <Layers className="h-4 w-4" />
                        <span className="font-medium">Materialer</span>
                    </TabsTrigger>
                    <TabsTrigger value="margins" className="gap-2 rounded-[18px] py-3 transition-all data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                        <Percent className="h-4 w-4" />
                        <span className="font-medium">Marginer</span>
                    </TabsTrigger>
                    <TabsTrigger value="profiles" className="gap-2 rounded-[18px] py-3 transition-all data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-sm">
                        <Settings2 className="h-4 w-4" />
                        <span className="font-medium">Profiler</span>
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="machines" className="mt-6 outline-none">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {data.machines.map((m) => {
                            const capacityM2h = m.mode === "SHEET"
                                ? ((Number(m.sheet_width_mm || 0) * Number(m.sheet_height_mm || 0)) / 1000000) * Number(m.sheets_per_hour || 0)
                                : Number(m.m2_per_hour || 0);
                            const busy = duplicateKey === `machines:${m.id}`;

                            return (
                                <Card key={m.id} className="group relative cursor-pointer overflow-hidden rounded-[28px] border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg" onClick={() => openEdit(m)}>
                                    <div className="flex items-start justify-between p-5">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                                                    <Cpu className="h-5 w-5" />
                                                </div>
                                                <h3 className="text-lg font-bold leading-tight">{m.name}</h3>
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                                    <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                                                        {m.mode === "SHEET" ? "Ark-maskine" : "Rulle-maskine"}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    Kapacitet: <span className="font-bold italic text-foreground underline decoration-primary/30">{capacityM2h.toFixed(1)} m²/t</span>
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Arbejds-bredde: <span className="font-semibold text-foreground">{m.mode === "SHEET" ? `${m.sheet_width_mm}x${m.sheet_height_mm} mm` : `${m.roll_width_mm} mm`}</span>
                                                </p>
                                                <p className="text-sm font-medium italic text-muted-foreground">
                                                    Drift-omkostning: <span className="font-bold text-emerald-700">{m.machine_rate_per_hour} kr/t</span>
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                                Aabn profil <ArrowRight className="h-3.5 w-3.5" />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-slate-900"
                                                onClick={(event) => duplicateItem("machines", m, event)}
                                                disabled={busy}
                                            >
                                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500" onClick={(event) => { event.stopPropagation(); handleDelete("machines", m.id); }}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-900/50 transition-all group-hover:h-1.5" />
                                </Card>
                            );
                        })}
                        <button onClick={openAdd} className="flex min-h-[180px] flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-muted-foreground transition-all duration-300 hover:border-slate-900/30 hover:bg-slate-50 hover:text-slate-900">
                            <Plus className="mb-2 h-8 w-8 opacity-50" />
                            <span className="font-bold tracking-tight">Opret ny maskine</span>
                            <span className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Produktionsenhed</span>
                        </button>
                    </div>
                </TabsContent>

                <TabsContent value="ink" className="mt-6 outline-none">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {data.inkSets.map((i) => {
                            const busy = duplicateKey === `ink:${i.id}`;
                            return (
                                <Card key={i.id} className="group relative cursor-pointer overflow-hidden rounded-[28px] border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-lg" onClick={() => openEdit(i)}>
                                    <div className="flex items-start justify-between p-5">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                                                    <Droplet className="h-5 w-5" />
                                                </div>
                                                <h3 className="text-lg font-bold leading-tight">{i.name}</h3>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Badge variant="outline" className="border-blue-200 text-[10px] font-bold text-blue-600">BLAEK-SYSTEM</Badge>
                                                <p className="text-sm text-muted-foreground">
                                                    Pris pr. ml: <span className="font-bold text-foreground">{i.price_per_ml} kr</span>
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Standard-forbrug: <span className="font-semibold text-foreground">{i.ml_per_m2_at_100pct} ml/m²</span>
                                                </p>
                                                <p className="text-sm font-semibold text-sky-700">
                                                    Daekning: {i.default_coverage_pct}% · Tolerance: {i.tolerance_pct}%
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-slate-900"
                                                onClick={(event) => duplicateItem("ink", i, event)}
                                                disabled={busy}
                                            >
                                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500" onClick={(event) => { event.stopPropagation(); handleDelete("ink_sets", i.id); }}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                        <button onClick={openAdd} className="flex min-h-[180px] flex-col items-center justify-center rounded-[28px] border border-dashed border-sky-200 bg-white p-8 text-muted-foreground transition-all duration-300 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700">
                            <Plus className="mb-2 h-8 w-8 opacity-50" />
                            <span className="font-bold tracking-tight">Opret nyt blaeksaet</span>
                            <span className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Farveprofil</span>
                        </button>
                    </div>
                </TabsContent>

                <TabsContent value="materials" className="mt-6 outline-none">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {data.materials.map((m) => {
                            const busy = duplicateKey === `materials:${m.id}`;
                            return (
                                <Card key={m.id} className="group relative cursor-pointer overflow-hidden rounded-[28px] border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg" onClick={() => openEdit(m)}>
                                    <div className="flex items-start justify-between p-5">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                                                    <Layers className="h-5 w-5" />
                                                </div>
                                                <h3 className="text-lg font-bold leading-tight">{m.name}</h3>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Badge variant="outline" className="border-orange-200 text-[10px] font-bold uppercase text-orange-600">{m.material_type}</Badge>
                                                <p className="text-sm text-muted-foreground">
                                                    Model: <span className="font-semibold text-foreground">{m.pricing_mode === "PER_SHEET" ? "Pr. Ark" : "Pr. kvadratmeter"}</span>
                                                </p>
                                                <p className="text-sm font-bold text-orange-600">
                                                    {m.pricing_mode === "PER_SHEET" ? `${m.price_per_sheet} kr/ark` : `${m.price_per_m2} kr/m²`}
                                                </p>
                                                {m.pricing_mode === "PER_SHEET" ? (
                                                    <p className="text-sm text-muted-foreground">
                                                        Raaformat: <span className="font-semibold text-foreground">{m.sheet_width_mm}x{m.sheet_height_mm} mm</span>
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-slate-900"
                                                onClick={(event) => duplicateItem("materials", m, event)}
                                                disabled={busy}
                                            >
                                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500" onClick={(event) => { event.stopPropagation(); handleDelete("materials", m.id); }}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                        <button onClick={openAdd} className="flex min-h-[180px] flex-col items-center justify-center rounded-[28px] border border-dashed border-orange-200 bg-white p-8 text-muted-foreground transition-all duration-300 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700">
                            <Plus className="mb-2 h-8 w-8 opacity-50" />
                            <span className="font-bold tracking-tight">Opret nyt materiale</span>
                            <span className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Raavare</span>
                        </button>
                    </div>
                </TabsContent>

                <TabsContent value="margins" className="mt-6 outline-none">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {data.marginProfiles.map((m) => {
                            const minQty = m.tiers?.length > 0 ? Math.min(...m.tiers.map((t: any) => t.qty_from)) : 0;
                            const maxQty = m.tiers?.length > 0 ? Math.max(...m.tiers.map((t: any) => t.qty_to || 999999)) : 0;
                            const marginRange = m.tiers?.length > 0
                                ? `${Math.min(...m.tiers.map((t: any) => t.value))}% - ${Math.max(...m.tiers.map((t: any) => t.value))}%`
                                : `${m.min_margin_pct || 0}%`;
                            const busy = duplicateKey === `margins:${m.id}`;

                            return (
                                <Card key={m.id} className="group relative cursor-pointer overflow-hidden rounded-[28px] border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg" onClick={() => openEdit(m)}>
                                    <div className="flex items-start justify-between p-5">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                                                    <Percent className="h-5 w-5" />
                                                </div>
                                                <h3 className="text-lg font-bold leading-tight">{m.name}</h3>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Badge variant="outline" className="border-green-200 text-[10px] font-bold text-green-600">
                                                    {m.mode === "TARGET_MARGIN" ? "MAAL-AVANCE" : "MARKUP"}
                                                </Badge>
                                                <p className="text-sm italic text-muted-foreground">
                                                    Interval: <span className="font-bold text-foreground">{minQty} - {maxQty === 999999 ? "∞" : maxQty} stk</span>
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    Daekning: <span className="font-bold text-green-600">{marginRange}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-slate-900"
                                                onClick={(event) => duplicateItem("margins", m, event)}
                                                disabled={busy}
                                            >
                                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500" onClick={(event) => { event.stopPropagation(); handleDelete("margin_profiles", m.id); }}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                        <button onClick={openAdd} className="flex min-h-[180px] flex-col items-center justify-center rounded-[28px] border border-dashed border-emerald-200 bg-white p-8 text-muted-foreground transition-all duration-300 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700">
                            <Plus className="mb-2 h-8 w-8 opacity-50" />
                            <span className="font-bold tracking-tight">Opret margin-profil</span>
                            <span className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Salgslogik</span>
                        </button>
                    </div>
                </TabsContent>

                <TabsContent value="profiles" className="mt-6 outline-none">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {data.pricingProfiles.map((p) => {
                            const machine = data.machines.find((m) => m.id === p.machine_id);
                            const inkSet = data.inkSets.find((i) => i.id === p.ink_set_id);
                            const busy = duplicateKey === `profiles:${p.id}`;
                            return (
                                <Card key={p.id} className="group relative cursor-pointer overflow-hidden rounded-[28px] border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg" onClick={() => openEdit(p)}>
                                    <div className="flex items-start justify-between p-5">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
                                                    <Settings2 className="h-5 w-5" />
                                                </div>
                                                <h3 className="text-lg font-bold leading-tight tracking-tight">{p.name}</h3>
                                            </div>
                                            <div className="grid grid-cols-1 gap-1.5">
                                                <div className="flex items-center gap-2 rounded border border-primary/10 bg-white/50 p-1.5 text-xs font-medium">
                                                    <Cpu className="h-3 w-3 text-primary" />
                                                    {machine?.name || "Vaelg maskine..."}
                                                </div>
                                                <div className="flex items-center gap-2 rounded border border-primary/10 bg-white/50 p-1.5 text-xs font-medium">
                                                    <Droplet className="h-3 w-3 text-blue-500" />
                                                    {inkSet?.name || "Vaelg blaek..."}
                                                </div>
                                            </div>
                                            <div className="space-y-1 pt-1">
                                                {machine && inkSet && (
                                                    <p className="text-[11px] font-bold italic text-violet-700">
                                                        Est. maskin-emne pris: <span className="underline">{((machine.machine_rate_per_hour / Math.max(machine.sheets_per_hour || 1, 1)) + (inkSet.price_per_ml * inkSet.ml_per_m2_at_100pct * 0.1)).toFixed(2)} kr/m²</span>
                                                    </p>
                                                )}
                                                <div className="flex items-center gap-4">
                                                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                                        Bleed: <span className="text-foreground">{p.default_bleed_mm}mm</span>
                                                    </div>
                                                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                                        Gap: <span className="text-foreground">{p.default_gap_mm}mm</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-muted-foreground hover:text-slate-900"
                                                onClick={(event) => duplicateItem("profiles", p, event)}
                                                disabled={busy}
                                            >
                                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-500" onClick={(event) => { event.stopPropagation(); handleDelete("pricing_profiles", p.id); }}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="absolute right-0 top-0 p-2">
                                        <Badge className="bg-violet-600 font-bold shadow-sm hover:bg-violet-600">AKTIV SKABELON</Badge>
                                    </div>
                                </Card>
                            );
                        })}
                        <button onClick={openAdd} className="flex min-h-[200px] flex-col items-center justify-center rounded-[28px] border border-dashed border-violet-200 bg-white p-8 text-muted-foreground transition-all duration-300 hover:border-violet-400 hover:bg-violet-50 hover:text-violet-700">
                            <Sparkles className="mb-2 h-8 w-8 opacity-50" />
                            <span className="font-bold tracking-tight">Opret ny pris-skabelon</span>
                            <span className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Maskine + blaek + defaults</span>
                        </button>
                    </div>
                </TabsContent>
            </Tabs>

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
