import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Blend, Droplets, Layers3, Settings2, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { IMPOSITION_PRESETS, ImpositionPreview } from "@/components/admin/ImpositionPreview";

interface PricingProfileFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    profile?: any;
    tenantId: string;
    machines: any[];
    inkSets: any[];
    onSuccess: () => void;
}

const getDefaultFormData = (profile?: any) => ({
    name: profile?.name || "",
    machine_id: profile?.machine_id || "",
    ink_set_id: profile?.ink_set_id || "",
    default_bleed_mm: profile?.default_bleed_mm || 3,
    default_gap_mm: profile?.default_gap_mm || 2,
    include_bleed_in_ink: profile?.include_bleed_in_ink ?? true,
});

const sanitizeNumber = (value: string, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export function PricingProfileForm({ open, onOpenChange, profile, tenantId, machines, inkSets, onSuccess }: PricingProfileFormProps) {
    const [formData, setFormData] = useState(getDefaultFormData(profile));
    const [previewPresetId, setPreviewPresetId] = useState("a5");

    useEffect(() => {
        setFormData(getDefaultFormData(profile));
    }, [profile, open]);

    const selectedMachine = useMemo(
        () => machines.find((machine) => machine.id === formData.machine_id) || null,
        [formData.machine_id, machines]
    );
    const selectedInkSet = useMemo(
        () => inkSets.find((inkSet) => inkSet.id === formData.ink_set_id) || null,
        [formData.ink_set_id, inkSets]
    );
    const previewPreset = useMemo(
        () => IMPOSITION_PRESETS.find((preset) => preset.id === previewPresetId) || IMPOSITION_PRESETS[1],
        [previewPresetId]
    );
    const initialState = useMemo(() => JSON.stringify(getDefaultFormData(profile)), [profile]);
    const currentState = useMemo(() => JSON.stringify(formData), [formData]);
    const isDirty = initialState !== currentState;

    const machineSheetWidth = selectedMachine
        ? selectedMachine.mode === "SHEET"
            ? Number(selectedMachine.sheet_width_mm || 0)
            : Number(selectedMachine.roll_width_mm || 0)
        : 0;
    const machineSheetHeight = selectedMachine
        ? selectedMachine.mode === "SHEET"
            ? Number(selectedMachine.sheet_height_mm || 0)
            : 1000
        : 0;
    const machinePrintableWidth = Math.max(0,
        machineSheetWidth - Number(selectedMachine?.margin_left_mm || 0) - Number(selectedMachine?.margin_right_mm || 0)
    );
    const machinePrintableHeight = Math.max(0,
        machineSheetHeight - Number(selectedMachine?.margin_top_mm || 0) - Number(selectedMachine?.margin_bottom_mm || 0)
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.machine_id || !formData.ink_set_id) {
            toast.error("Vaelg venligst baade maskine og blaeksaet");
            return;
        }

        try {
            const data = { ...formData, tenant_id: tenantId };
            let error;
            if (profile?.id) {
                ({ error } = await supabase.from('pricing_profiles' as any).update(data).eq('id', profile.id));
            } else {
                ({ error } = await supabase.from('pricing_profiles' as any).insert(data));
            }

            if (error) throw error;
            toast.success(profile?.id ? "Profil opdateret" : "Profil oprettet");
            onSuccess();
            onOpenChange(false);
        } catch (err: any) {
            toast.error("Kunne ikke gemme: " + err.message);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="left-4 right-4 top-4 z-50 h-[calc(100vh-2rem)] w-auto max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-[28px] border-none bg-slate-50 p-0 shadow-2xl data-[state=closed]:slide-out-to-top-[4%] data-[state=open]:slide-in-from-top-[4%] sm:left-10 sm:right-10 sm:top-8 sm:h-[calc(100vh-4rem)]">
                <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
                    <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5 text-left">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-2">
                                <div className="flex items-center gap-3">
                                    <DialogTitle className="text-2xl font-semibold tracking-tight">
                                        {profile?.id ? "Rediger pris-profil" : "Ny pris-profil"}
                                    </DialogTitle>
                                    {isDirty ? (
                                        <Badge className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 hover:bg-amber-100">
                                            Ugemte aendringer
                                        </Badge>
                                    ) : null}
                                </div>
                                <DialogDescription className="max-w-2xl text-sm text-slate-500">
                                    Profilen kobler maskine og blaeksaet med standarder for bleed og gap. Det skal foeles som en produktionsskabelon, ikke en loes opsaetning.
                                </DialogDescription>
                            </div>

                            <div className="grid gap-2 text-right text-sm text-slate-500 sm:grid-cols-3">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.18em]">Maskine</div>
                                    <div className="mt-1 font-semibold text-slate-900">{selectedMachine?.name || "Ikke valgt"}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.18em]">Blaeksaet</div>
                                    <div className="mt-1 font-semibold text-slate-900">{selectedInkSet?.name || "Ikke valgt"}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.18em]">Standard</div>
                                    <div className="mt-1 font-semibold text-emerald-700">
                                        {formData.default_bleed_mm} / {formData.default_gap_mm} mm
                                    </div>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                        <div className="grid min-h-full gap-6 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-6">
                            <div className="space-y-6">
                                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                                    <div className="mb-5 flex items-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                                            <Settings2 className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900">Profilidentitet</h3>
                                            <p className="text-sm text-slate-500">Giv profilen et klart navn, saa den kan genbruges i beregninger.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="name">Profil-navn</Label>
                                        <Input
                                            id="name"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="f.eks. Offset Standard"
                                            required
                                            className="h-12 rounded-xl border-white/70 bg-slate-50 shadow-sm"
                                        />
                                    </div>
                                </section>

                                <section className="rounded-[28px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-6 shadow-sm">
                                    <div className="mb-5 flex items-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                                            <Blend className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900">Produktionskobling</h3>
                                            <p className="text-sm text-slate-500">Vaelg den maskine og det blaeksaet som denne profil skal bruge som standard.</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-5 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label>Primaer maskine</Label>
                                            <Select value={formData.machine_id} onValueChange={(v) => setFormData({ ...formData, machine_id: v })}>
                                                <SelectTrigger className="h-12 rounded-xl border-white/70 bg-white shadow-sm">
                                                    <SelectValue placeholder="Vaelg maskine" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {machines.map((machine) => (
                                                        <SelectItem key={machine.id} value={machine.id}>
                                                            {machine.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Blaek-opsaetning</Label>
                                            <Select value={formData.ink_set_id} onValueChange={(v) => setFormData({ ...formData, ink_set_id: v })}>
                                                <SelectTrigger className="h-12 rounded-xl border-white/70 bg-white shadow-sm">
                                                    <SelectValue placeholder="Vaelg blaek" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {inkSets.map((inkSet) => (
                                                        <SelectItem key={inkSet.id} value={inkSet.id}>
                                                            {inkSet.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </section>

                                <section className="rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 shadow-sm">
                                    <div className="mb-5 flex items-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                                            <Layers3 className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900">Bleed & Gap defaults</h3>
                                            <p className="text-sm text-slate-500">De vaerdier som beregningen skal starte fra, naar en ny maskinprofil bruges.</p>
                                        </div>
                                    </div>

                                    <div className="grid gap-5 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="bleed">Standard bleed</Label>
                                            <div className="relative">
                                                <Input
                                                    id="bleed"
                                                    type="number"
                                                    value={formData.default_bleed_mm}
                                                    onChange={(e) => setFormData({ ...formData, default_bleed_mm: sanitizeNumber(e.target.value) })}
                                                    className="h-12 rounded-xl border-white/70 bg-white pr-16 shadow-sm"
                                                />
                                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    mm
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="gap">Standard gap</Label>
                                            <div className="relative">
                                                <Input
                                                    id="gap"
                                                    type="number"
                                                    value={formData.default_gap_mm}
                                                    onChange={(e) => setFormData({ ...formData, default_gap_mm: sanitizeNumber(e.target.value) })}
                                                    className="h-12 rounded-xl border-white/70 bg-white pr-16 shadow-sm"
                                                />
                                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    mm
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-5 rounded-2xl border border-emerald-200 bg-white/70 px-4 py-3">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="text-sm font-medium text-slate-900">Medregn bleed i blaek-omkostning</div>
                                                <div className="text-xs text-slate-500">Bruges naar bleed skal taelle med i det estimerede blaekforbrug.</div>
                                            </div>
                                            <Switch id="inkbleed" checked={formData.include_bleed_in_ink} onCheckedChange={(v) => setFormData({ ...formData, include_bleed_in_ink: v })} />
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <aside className="space-y-5 lg:sticky lg:top-5">
                                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Profil-preview</div>
                                    <div className="mt-4 space-y-4 text-sm">
                                        <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                                            <Settings2 className="mt-0.5 h-4 w-4 text-slate-500" />
                                            <div>
                                                <div className="font-semibold text-slate-900">{formData.name || "Unavngiven profil"}</div>
                                                <div className="text-xs text-slate-500">Prisprofil til maskinberegning</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                                            <Sparkles className="mt-0.5 h-4 w-4 text-cyan-700" />
                                            <div>
                                                <div className="font-semibold text-slate-900">{selectedMachine?.name || "Maskine ikke valgt"}</div>
                                                <div className="text-xs text-slate-500">Maskine</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-4">
                                            <Droplets className="mt-0.5 h-4 w-4 text-sky-700" />
                                            <div>
                                                <div className="font-semibold text-slate-900">{selectedInkSet?.name || "Blaeksaet ikke valgt"}</div>
                                                <div className="text-xs text-slate-500">Blaekopsaetning</div>
                                            </div>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Bleed</div>
                                                <div className="mt-1 text-xl font-semibold text-slate-900">{formData.default_bleed_mm} mm</div>
                                            </div>
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Gap</div>
                                                <div className="mt-1 text-xl font-semibold text-slate-900">{formData.default_gap_mm} mm</div>
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                                            <div className="flex items-center gap-2 font-semibold text-emerald-800">
                                                <BadgeCheck className="h-4 w-4" />
                                                Blaeklogik
                                            </div>
                                            <div className="mt-1 text-xs leading-relaxed text-emerald-900/80">
                                                {formData.include_bleed_in_ink
                                                    ? "Bleed bliver regnet med i blaekforbruget."
                                                    : "Bleed holdes uden for blaekforbruget."}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Testformat</div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {IMPOSITION_PRESETS.map((preset) => (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => setPreviewPresetId(preset.id)}
                                                className={cn(
                                                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                                                    previewPreset.id === preset.id
                                                        ? "border-violet-200 bg-violet-100 text-violet-800"
                                                        : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700"
                                                )}
                                            >
                                                {preset.shortLabel}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-3 text-xs text-slate-500">
                                        Previewet kombinerer maskinens printbare felt med profilens bleed og gap.
                                    </div>
                                </div>

                                {selectedMachine ? (
                                    <ImpositionPreview
                                        sheetWidthMm={machineSheetWidth}
                                        sheetHeightMm={machineSheetHeight}
                                        marginLeftMm={Number(selectedMachine.margin_left_mm || 0)}
                                        marginRightMm={Number(selectedMachine.margin_right_mm || 0)}
                                        marginTopMm={Number(selectedMachine.margin_top_mm || 0)}
                                        marginBottomMm={Number(selectedMachine.margin_bottom_mm || 0)}
                                        itemWidthMm={previewPreset.widthMm}
                                        itemHeightMm={previewPreset.heightMm}
                                        bleedMm={Number(formData.default_bleed_mm || 0)}
                                        gapMm={Number(formData.default_gap_mm || 0)}
                                    />
                                ) : (
                                    <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm">
                                        Vaelg en maskine for at se imposition-preview. Previewet viser derefter hvor mange enheder af {previewPreset.name.toLowerCase()} der kan ligge paa det printbare felt.
                                    </div>
                                )}

                                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Samlet setup</div>
                                    <div className="mt-4 space-y-4 text-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <span className="text-slate-500">Printbart felt</span>
                                            <span className="text-right font-medium text-slate-900">{machinePrintableWidth} x {machinePrintableHeight} mm</span>
                                        </div>
                                        <div className="flex items-start justify-between gap-4">
                                            <span className="text-slate-500">Preview format</span>
                                            <span className="text-right font-medium text-slate-900">{previewPreset.name}</span>
                                        </div>
                                        <div className="flex items-start justify-between gap-4">
                                            <span className="text-slate-500">Celle</span>
                                            <span className="text-right font-medium text-slate-900">
                                                {previewPreset.widthMm + Number(formData.default_bleed_mm || 0) * 2} x {previewPreset.heightMm + Number(formData.default_bleed_mm || 0) * 2} mm
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </div>

                    <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4 sm:justify-between">
                        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            {profile?.id ? "Opdatering af eksisterende profil" : "Ny prisprofil"}
                        </div>
                        <div className="flex items-center gap-3">
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                                Annuller
                            </Button>
                            <Button type="submit" className="rounded-xl bg-emerald-500 px-5 hover:bg-emerald-600">
                                Gem profil
                            </Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
