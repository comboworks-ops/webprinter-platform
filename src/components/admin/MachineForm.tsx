import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRightLeft,
  BadgeInfo,
  CheckCircle2,
  Clock3,
  Coins,
  Cpu,
  Gauge,
  Layers3,
  Ruler,
  ShieldAlert,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { IMPOSITION_PRESETS, ImpositionPreview } from "@/components/admin/ImpositionPreview";

interface MachineFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machine?: any;
  tenantId: string;
  onSuccess: () => void;
}

const getDefaultFormData = (machine?: any) => ({
  name: machine?.name || "",
  mode: machine?.mode || "SHEET",
  sheet_width_mm: machine?.sheet_width_mm || 0,
  sheet_height_mm: machine?.sheet_height_mm || 0,
  roll_width_mm: machine?.roll_width_mm || 0,
  margin_left_mm: machine?.margin_left_mm || 0,
  margin_right_mm: machine?.margin_right_mm || 0,
  margin_top_mm: machine?.margin_top_mm || 0,
  margin_bottom_mm: machine?.margin_bottom_mm || 0,
  duplex_supported: machine?.duplex_supported || false,
  setup_waste_sheets: machine?.setup_waste_sheets || 0,
  run_waste_pct: machine?.run_waste_pct || 0,
  setup_time_min: machine?.setup_time_min || 0,
  sheets_per_hour: machine?.sheets_per_hour || 0,
  m2_per_hour: machine?.m2_per_hour || 0,
  machine_rate_per_hour: machine?.machine_rate_per_hour || 0,
});

const sanitizeNumber = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sectionConfig = [
  {
    id: "general",
    title: "Machine Info",
    description: "Navn, maskintype og duplex",
    icon: Cpu,
  },
  {
    id: "sizes",
    title: "Size & Safety",
    description: "Arkformat, rullebredde og sikkerhedsmarginer",
    icon: Ruler,
  },
  {
    id: "capacity",
    title: "Capacity & Cost",
    description: "Hastighed, spild, opsaetningstid og timepris",
    icon: Gauge,
  },
] as const;

type UnitFieldProps = {
  id: string;
  label: string;
  unit: string;
  value: number;
  onChange: (nextValue: number) => void;
  step?: string;
  min?: number;
  hint?: string;
};

function UnitField({ id, label, unit, value, onChange, step = "1", min = 0, hint }: UnitFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <div className="relative">
        <Input
          id={id}
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(event) => onChange(sanitizeNumber(event.target.value))}
          className="h-12 rounded-xl border-white/70 bg-white pr-16 shadow-sm"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {unit}
        </span>
      </div>
    </div>
  );
}

export function MachineForm({ open, onOpenChange, machine, tenantId, onSuccess }: MachineFormProps) {
  const [formData, setFormData] = useState(getDefaultFormData(machine));
  const [previewPresetId, setPreviewPresetId] = useState("a4");
  const [previewBleedMm, setPreviewBleedMm] = useState(3);
  const [previewGapMm, setPreviewGapMm] = useState(2);
  const [activeSection, setActiveSection] = useState<(typeof sectionConfig)[number]["id"]>(sectionConfig[0].id);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFormData(getDefaultFormData(machine));
  }, [machine, open]);

  const initialState = useMemo(() => JSON.stringify(getDefaultFormData(machine)), [machine]);
  const currentState = useMemo(() => JSON.stringify(formData), [formData]);
  const isDirty = initialState !== currentState;

  const sheetWidth = formData.mode === "SHEET" ? Math.max(0, Number(formData.sheet_width_mm || 0)) : Math.max(0, Number(formData.roll_width_mm || 0));
  const sheetHeight = formData.mode === "SHEET" ? Math.max(0, Number(formData.sheet_height_mm || 0)) : 1000;
  const printableWidth = Math.max(0, sheetWidth - Number(formData.margin_left_mm || 0) - Number(formData.margin_right_mm || 0));
  const printableHeight = Math.max(0, sheetHeight - Number(formData.margin_top_mm || 0) - Number(formData.margin_bottom_mm || 0));
  const capacityPerHour = formData.mode === "SHEET"
    ? Number(formData.sheets_per_hour || 0)
    : Number(formData.m2_per_hour || 0);
  const operatingLabel = formData.mode === "SHEET"
    ? `${Math.round(Number(formData.sheets_per_hour || 0))} ark/t`
    : `${Number(formData.m2_per_hour || 0).toFixed(1)} m²/t`;
  const previewPreset = useMemo(
    () => IMPOSITION_PRESETS.find((preset) => preset.id === previewPresetId) || IMPOSITION_PRESETS[2],
    [previewPresetId]
  );

  const sectionStatus = useMemo(() => {
    const generalMissing: string[] = [];
    if (!formData.name.trim()) generalMissing.push("Navn");

    const sizesMissing: string[] = [];
    if (formData.mode === "SHEET") {
      if (sheetWidth <= 0) sizesMissing.push("Bredde");
      if (sheetHeight <= 0) sizesMissing.push("Hoejde");
    } else if (sheetWidth <= 0) {
      sizesMissing.push("Rullebredde");
    }
    if (printableWidth <= 0 || printableHeight <= 0) sizesMissing.push("Printbart felt");

    const capacityMissing: string[] = [];
    if (capacityPerHour <= 0) capacityMissing.push(formData.mode === "SHEET" ? "Ark/t" : "m²/t");
    if (Number(formData.machine_rate_per_hour || 0) <= 0) capacityMissing.push("Timepris");

    return {
      general: generalMissing,
      sizes: sizesMissing,
      capacity: capacityMissing,
    };
  }, [capacityPerHour, formData.machine_rate_per_hour, formData.mode, formData.name, printableHeight, printableWidth, sheetHeight, sheetWidth]);

  const completedSections = Object.values(sectionStatus).filter((missing) => missing.length === 0).length;
  const completionPercent = Math.round((completedSections / sectionConfig.length) * 100);

  useEffect(() => {
    if (!open) return;
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    const updateActiveSection = () => {
      const viewportTop = viewport.getBoundingClientRect().top;
      let closestSection: (typeof sectionConfig)[number]["id"] = sectionConfig[0].id;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const section of sectionConfig) {
        const element = document.getElementById(section.id);
        if (!element) continue;
        const distance = Math.abs(element.getBoundingClientRect().top - viewportTop - 24);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestSection = section.id;
        }
      }

      setActiveSection(closestSection);
    };

    updateActiveSection();
    viewport.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);

    return () => {
      viewport.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const data = { ...formData, tenant_id: tenantId };
      let error;
      if (machine?.id) {
        ({ error } = await supabase.from("machines" as any).update(data).eq("id", machine.id));
      } else {
        ({ error } = await supabase.from("machines" as any).insert(data));
      }

      if (error) throw error;
      toast.success(machine?.id ? "Maskine opdateret" : "Maskine oprettet");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Kunne ikke gemme: ${err.message}`);
    }
  };

  const jumpToSection = (sectionId: (typeof sectionConfig)[number]["id"]) => {
    setActiveSection(sectionId);
    const element = document.getElementById(sectionId);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="left-4 right-4 top-4 z-50 h-[calc(100vh-2rem)] w-auto max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-[28px] border-none bg-slate-50 p-0 shadow-2xl data-[state=closed]:slide-out-to-top-[4%] data-[state=open]:slide-in-from-top-[4%] sm:left-6 sm:right-6 sm:top-6 sm:h-[calc(100vh-3rem)]">
        <form onSubmit={handleSubmit} className="flex h-full min-h-0 flex-col">
          <DialogHeader className="border-b border-slate-200 bg-white px-6 py-5 text-left">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <DialogTitle className="text-2xl font-semibold tracking-tight">
                    {machine?.id ? "Rediger maskine" : "Ny maskine"}
                  </DialogTitle>
                  <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
                    {formData.mode === "SHEET" ? "Ark-maskine" : "Rulle-maskine"}
                  </Badge>
                  {isDirty ? (
                    <Badge className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 hover:bg-amber-100">
                      Ugemte aendringer
                    </Badge>
                  ) : null}
                </div>
                <DialogDescription className="max-w-2xl text-sm text-slate-500">
                  Ombygget som en tydelig maskinprofil-editor med sektioner, live preview og noeglemaalinger. Beregningslogikken er uaendret.
                </DialogDescription>
              </div>

              <div className="grid gap-2 text-right text-sm text-slate-500 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em]">Printbart felt</div>
                  <div className="mt-1 font-semibold text-slate-900">
                    {printableWidth} x {printableHeight} mm
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em]">Kapacitet</div>
                  <div className="mt-1 font-semibold text-slate-900">{operatingLabel}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em]">Maskin-rate</div>
                  <div className="mt-1 font-semibold text-emerald-700">{Number(formData.machine_rate_per_hour || 0).toFixed(0)} kr/t</div>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div ref={scrollViewportRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="grid min-h-full lg:grid-cols-[240px_minmax(0,1fr)_340px]">
              <aside className="hidden border-r border-slate-200 bg-white/80 lg:block">
                <div className="flex h-full flex-col p-4">
                  <div className="mb-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          Profilopsaetning
                        </div>
                        <div className="mt-1 text-lg font-semibold text-slate-900">{completionPercent}% klar</div>
                      </div>
                      <div className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        completionPercent === 100 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {completedSections}/{sectionConfig.length}
                      </div>
                    </div>
                    <Progress value={completionPercent} className="mt-4 h-2.5 bg-slate-200" />
                    <div className="mt-2 text-xs text-slate-500">
                      Navnet, produktionsformatet og kapaciteten skal vaere sat foer profilen er komplet.
                    </div>
                  </div>

                  <div className="space-y-2">
                    {sectionConfig.map((section, index) => {
                      const Icon = section.icon;
                      const missing = sectionStatus[section.id];
                      const isComplete = missing.length === 0;
                      const isActive = activeSection === section.id;
                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => jumpToSection(section.id)}
                          className={cn(
                            "group flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition",
                            isActive
                              ? "border-teal-200 bg-teal-50 shadow-sm"
                              : "border-transparent bg-slate-50 hover:border-teal-200 hover:bg-teal-50"
                          )}
                        >
                          <div className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition",
                            isComplete ? "text-emerald-600" : isActive ? "text-teal-600" : "text-slate-500"
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-slate-900">
                                {index + 1}. {section.title}
                              </div>
                              {isComplete ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                              )}
                            </div>
                            <div className="mt-1 text-xs leading-relaxed text-slate-500">
                              {isComplete ? section.description : `Mangler: ${missing.join(", ")}`}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-auto rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start gap-3">
                      <BadgeInfo className="mt-0.5 h-4 w-4 text-slate-500" />
                      <div className="space-y-1 text-xs text-slate-500">
                        <p className="font-semibold uppercase tracking-[0.16em] text-slate-400">Retning</p>
                        <p>
                          Layoutet samler maskindata i klare blokke, saa det foeles som en produktionsprofil og ikke kun en formular.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>

              <div className="px-4 py-5 sm:px-6">
                <div className="space-y-6">
                  <section id="general" className="scroll-mt-6 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <Cpu className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Machine Info</h3>
                        <p className="text-sm text-slate-500">Navn, produktionstype og om maskinen kan koere duplex.</p>
                      </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="name">Maskin-navn</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                          placeholder="f.eks. HP Indigo 7900"
                          required
                          className="h-12 rounded-xl border-white/70 bg-slate-50 shadow-sm"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Maskintype</Label>
                        <Select value={formData.mode} onValueChange={(value) => setFormData({ ...formData, mode: value })}>
                          <SelectTrigger className="h-12 rounded-xl border-white/70 bg-slate-50 shadow-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SHEET">Ark (sheet-fed)</SelectItem>
                            <SelectItem value="ROLL">Rulle (web / roll-fed)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-sm font-medium text-slate-900">Duplex-understoettelse</div>
                            <div className="text-xs text-slate-500">Bruges til 4+4 jobs og dobbeltsidet produktion.</div>
                          </div>
                          <Switch
                            id="duplex"
                            checked={formData.duplex_supported}
                            onCheckedChange={(checked) => setFormData({ ...formData, duplex_supported: checked })}
                          />
                        </div>
                      </div>
                    </div>
                  </section>

                  <section id="sizes" className="scroll-mt-6 space-y-6">
                    <div className="rounded-[28px] border border-teal-100 bg-gradient-to-br from-teal-50 via-white to-cyan-50 p-6 shadow-sm">
                      <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                          <Ruler className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">
                            {formData.mode === "SHEET" ? "Maximum sheet input" : "Maximum roll input"}
                          </h3>
                          <p className="text-sm text-slate-500">
                            Definer maskinens raaformat. Previewet til hoejre opdateres direkte.
                          </p>
                        </div>
                      </div>

                      <div className={cn("grid gap-5", formData.mode === "SHEET" ? "md:grid-cols-2" : "md:grid-cols-1")}>
                        {formData.mode === "SHEET" ? (
                          <>
                            <UnitField
                              id="sw"
                              label="Bredde"
                              unit="mm"
                              value={Number(formData.sheet_width_mm || 0)}
                              onChange={(nextValue) => setFormData({ ...formData, sheet_width_mm: nextValue })}
                            />
                            <UnitField
                              id="sh"
                              label="Hoejde"
                              unit="mm"
                              value={Number(formData.sheet_height_mm || 0)}
                              onChange={(nextValue) => setFormData({ ...formData, sheet_height_mm: nextValue })}
                            />
                          </>
                        ) : (
                          <UnitField
                            id="rw"
                            label="Rulle-bredde"
                            unit="mm"
                            value={Number(formData.roll_width_mm || 0)}
                            onChange={(nextValue) => setFormData({ ...formData, roll_width_mm: nextValue })}
                            hint="Preview bruger 1000 mm eksempel-laengde"
                          />
                        )}
                      </div>
                    </div>

                    <div className="rounded-[28px] border border-rose-100 bg-gradient-to-br from-rose-50 via-white to-fuchsia-50 p-6 shadow-sm">
                      <div className="mb-5 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
                          <ShieldAlert className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900">Safety margins</h3>
                          <p className="text-sm text-slate-500">Ikke-printbart omraade til registrering, griber og haandtering.</p>
                        </div>
                      </div>

                      <div className="grid gap-5 md:grid-cols-2">
                        <UnitField
                          id="mt"
                          label="Top"
                          unit="mm"
                          value={Number(formData.margin_top_mm || 0)}
                          onChange={(nextValue) => setFormData({ ...formData, margin_top_mm: nextValue })}
                        />
                        <UnitField
                          id="mb"
                          label="Bund"
                          unit="mm"
                          value={Number(formData.margin_bottom_mm || 0)}
                          onChange={(nextValue) => setFormData({ ...formData, margin_bottom_mm: nextValue })}
                        />
                        <UnitField
                          id="ml"
                          label="Venstre"
                          unit="mm"
                          value={Number(formData.margin_left_mm || 0)}
                          onChange={(nextValue) => setFormData({ ...formData, margin_left_mm: nextValue })}
                        />
                        <UnitField
                          id="mr"
                          label="Hoejre"
                          unit="mm"
                          value={Number(formData.margin_right_mm || 0)}
                          onChange={(nextValue) => setFormData({ ...formData, margin_right_mm: nextValue })}
                        />
                      </div>
                    </div>
                  </section>

                  <section id="capacity" className="scroll-mt-6 rounded-[28px] border border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                        <Gauge className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Capacity & Cost</h3>
                        <p className="text-sm text-slate-500">Opsaetningstid, hastighed, spild og maskinens timepris.</p>
                      </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <UnitField
                        id="setup-time"
                        label="Opsaetningstid"
                        unit="min"
                        value={Number(formData.setup_time_min || 0)}
                        onChange={(nextValue) => setFormData({ ...formData, setup_time_min: nextValue })}
                      />
                      <UnitField
                        id="rate"
                        label="Timepris"
                        unit="kr/t"
                        value={Number(formData.machine_rate_per_hour || 0)}
                        onChange={(nextValue) => setFormData({ ...formData, machine_rate_per_hour: nextValue })}
                        step="0.1"
                      />
                      {formData.mode === "SHEET" ? (
                        <UnitField
                          id="sph"
                          label="Ark i timen"
                          unit="ark/t"
                          value={Number(formData.sheets_per_hour || 0)}
                          onChange={(nextValue) => setFormData({ ...formData, sheets_per_hour: nextValue })}
                        />
                      ) : (
                        <UnitField
                          id="m2h"
                          label="m² i timen"
                          unit="m²/t"
                          value={Number(formData.m2_per_hour || 0)}
                          onChange={(nextValue) => setFormData({ ...formData, m2_per_hour: nextValue })}
                          step="0.1"
                        />
                      )}
                      <UnitField
                        id="swaste"
                        label="Opstarts-spild"
                        unit={formData.mode === "SHEET" ? "ark" : "stk"}
                        value={Number(formData.setup_waste_sheets || 0)}
                        onChange={(nextValue) => setFormData({ ...formData, setup_waste_sheets: nextValue })}
                      />
                      <UnitField
                        id="rwaste"
                        label="Koersels-spild"
                        unit="%"
                        value={Number(formData.run_waste_pct || 0)}
                        onChange={(nextValue) => setFormData({ ...formData, run_waste_pct: nextValue })}
                        step="0.1"
                      />
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          <Clock3 className="h-4 w-4" />
                          Setup
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-slate-900">{Number(formData.setup_time_min || 0)} min</div>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          <Layers3 className="h-4 w-4" />
                          Spild
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-slate-900">
                          {Number(formData.setup_waste_sheets || 0)} + {Number(formData.run_waste_pct || 0)}%
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                          <Coins className="h-4 w-4" />
                          OPEX
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-emerald-700">{Number(formData.machine_rate_per_hour || 0).toFixed(0)} kr/t</div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>

              <aside className="border-t border-slate-200 bg-white px-5 py-5 lg:border-l lg:border-t-0">
                <div className="space-y-5 lg:sticky lg:top-5">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Preview</div>
                    <h3 className="mt-1 text-lg font-semibold text-slate-900">Imposition test</h3>
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
                              ? "border-cyan-200 bg-cyan-100 text-cyan-800"
                              : "border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:text-cyan-700"
                          )}
                        >
                          {preset.shortLabel}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="preview-bleed">Test bleed</Label>
                        <div className="relative">
                          <Input
                            id="preview-bleed"
                            type="number"
                            min={0}
                            step="0.1"
                            value={previewBleedMm}
                            onChange={(event) => setPreviewBleedMm(sanitizeNumber(event.target.value))}
                            className="h-11 rounded-xl border-white/70 bg-white pr-14 shadow-sm"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            mm
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="preview-gap">Trim gap</Label>
                        <div className="relative">
                          <Input
                            id="preview-gap"
                            type="number"
                            min={0}
                            step="0.1"
                            value={previewGapMm}
                            onChange={(event) => setPreviewGapMm(sanitizeNumber(event.target.value))}
                            className="h-11 rounded-xl border-white/70 bg-white pr-14 shadow-sm"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                            mm
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                      Lokal preview-kontrol. Den aendrer ikke maskinens gemte data.
                    </div>
                  </div>

                  <ImpositionPreview
                    sheetWidthMm={sheetWidth}
                    sheetHeightMm={sheetHeight}
                    marginLeftMm={Number(formData.margin_left_mm || 0)}
                    marginRightMm={Number(formData.margin_right_mm || 0)}
                    marginTopMm={Number(formData.margin_top_mm || 0)}
                    marginBottomMm={Number(formData.margin_bottom_mm || 0)}
                    itemWidthMm={previewPreset.widthMm}
                    itemHeightMm={previewPreset.heightMm}
                    bleedMm={previewBleedMm}
                    gapMm={previewGapMm}
                  />

                  <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Maskinresume</div>
                    <div className="mt-4 space-y-4 text-sm">
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500">Produktionsmode</span>
                        <span className="font-medium text-slate-900">{formData.mode === "SHEET" ? "Ark" : "Rulle"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500">Raaformat</span>
                        <span className="text-right font-medium text-slate-900">
                          {formData.mode === "SHEET" ? `${sheetWidth} × ${sheetHeight} mm` : `${sheetWidth} mm rulle`}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500">Printbart felt</span>
                        <span className="text-right font-medium text-slate-900">{printableWidth} × {printableHeight} mm</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500">Testlayout</span>
                        <span className="text-right font-medium text-slate-900">
                          {previewPreset.name} · {previewBleedMm}/{previewGapMm} mm
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500">Duplex</span>
                        <span className="font-medium text-slate-900">{formData.duplex_supported ? "Ja" : "Nej"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500">Kapacitet</span>
                        <span className="font-medium text-slate-900">{capacityPerHour > 0 ? operatingLabel : "Ikke sat"}</span>
                      </div>
                      <div className="flex items-start justify-between gap-4">
                        <span className="text-slate-500">Spildprofil</span>
                        <span className="text-right font-medium text-slate-900">
                          {Number(formData.setup_waste_sheets || 0)} opstart / {Number(formData.run_waste_pct || 0)}% drift
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-cyan-100 bg-cyan-50 p-5 text-sm text-cyan-900">
                    <div className="mb-2 flex items-center gap-2 font-semibold">
                      <ArrowRightLeft className="h-4 w-4" />
                      Designretning
                    </div>
                    <p className="leading-relaxed">
                      Dette er en mere visuel produktionseditor: klare sektioner, faa beslutninger ad gangen og et preview der forklarer konsekvensen af marginer og format.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4 sm:justify-between">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
              {machine?.id ? "Opdatering af eksisterende maskine" : "Ny maskinprofil"}
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Annuller
              </Button>
              <Button type="submit" className="rounded-xl bg-emerald-500 px-5 hover:bg-emerald-600">
                Gem maskine
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
