import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Layers3,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Workflow,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import "@/styles/machinePricing.css";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  planJobPool,
  type JobPoolDraft,
  type JobPoolSettings,
} from "@/lib/pricing/jobPoolOptimizer";
import type {
  MachineCostInkSet,
  MachineCostMachine,
  MachineCostMaterial,
} from "@/lib/pricing/machineCostSimulator";

type NamedMachine = MachineCostMachine & { id: string; name: string };
type NamedMaterial = MachineCostMaterial & { id: string; name: string };
type NamedInkSet = MachineCostInkSet & { id: string; name: string };

type MachineJobPoolWorkbenchProps = {
  machines: NamedMachine[];
  materials: NamedMaterial[];
  inkSets: NamedInkSet[];
  onOpenMachines?: () => void;
};

const DEFAULT_JOBS: JobPoolDraft[] = [
  { id: "draft-a5", name: "A5 flyer", quantity: 1000, widthMm: 148, heightMm: 210 },
  { id: "draft-a6", name: "A6 flyer", quantity: 2000, widthMm: 105, heightMm: 148 },
];

const DEFAULT_SETTINGS: JobPoolSettings = {
  costModel: "DIGITAL_CLICK",
  bleedMm: 3,
  gapMm: 4,
  sides: 2,
  coveragePct: 30,
  targetMarginPct: 40,
  roundingStep: 1,
  clickCostPerSide: 0,
  plateCount: 8,
  plateCostEach: 0,
  fixedJobCost: 0,
};

const JOB_COLORS = [
  { background: "#cffafe", border: "#0891b2", text: "#164e63" },
  { background: "#fce7f3", border: "#db2777", text: "#831843" },
  { background: "#fef3c7", border: "#d97706", text: "#78350f" },
  { background: "#dcfce7", border: "#16a34a", text: "#14532d" },
  { background: "#ede9fe", border: "#7c3aed", text: "#4c1d95" },
  { background: "#fee2e2", border: "#dc2626", text: "#7f1d1d" },
];

const kr = new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" });
const number = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 1 });

function NumberField({
  id,
  label,
  value,
  unit,
  min = 0,
  max,
  step = 1,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-slate-600">{label}</Label>
      <div className="relative">
        <NumberInput
          id={id}
          min={min}
          max={max}
          step={step}
          value={value}
          onValueChange={onChange}
          emptyValue={min}
          className="h-10 rounded-md pr-12"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{unit}</span>
      </div>
    </div>
  );
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 truncate text-lg font-semibold tabular-nums ${accent ? "text-slate-700" : "text-slate-950"}`}>
        {value}
      </div>
    </div>
  );
}

export function MachineJobPoolWorkbench({
  machines,
  materials,
  inkSets,
  onOpenMachines,
}: MachineJobPoolWorkbenchProps) {
  const sheetMachines = useMemo(() => machines.filter((machine) => machine.mode === "SHEET"), [machines]);
  const sheetMaterials = useMemo(
    () => materials.filter((material) => (
      material.pricing_mode === "PER_SHEET"
      || (Number(material.sheet_width_mm) > 0 && Number(material.sheet_height_mm) > 0)
    )),
    [materials],
  );
  const [machineId, setMachineId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [inkSetId, setInkSetId] = useState("");
  const [jobs, setJobs] = useState<JobPoolDraft[]>(DEFAULT_JOBS);
  const [settings, setSettings] = useState<JobPoolSettings>(DEFAULT_SETTINGS);
  const [selectedFormId, setSelectedFormId] = useState("");

  useEffect(() => {
    if (!sheetMachines.some((machine) => machine.id === machineId)) {
      setMachineId(sheetMachines[0]?.id ?? "");
    }
    if (!sheetMaterials.some((material) => material.id === materialId)) {
      setMaterialId(sheetMaterials[0]?.id ?? "");
    }
    if (!inkSets.some((inkSet) => inkSet.id === inkSetId)) {
      setInkSetId(inkSets[0]?.id ?? "");
    }
  }, [inkSetId, inkSets, machineId, materialId, sheetMachines, sheetMaterials]);

  const machine = sheetMachines.find((item) => item.id === machineId);
  const material = sheetMaterials.find((item) => item.id === materialId);
  const inkSet = inkSets.find((item) => item.id === inkSetId);
  const plan = useMemo(
    () => machine && material && inkSet
      ? planJobPool(machine, material, inkSet, jobs, settings)
      : null,
    [inkSet, jobs, machine, material, settings],
  );

  useEffect(() => {
    if (!plan || plan.forms.length === 0) {
      setSelectedFormId("");
      return;
    }
    if (!plan.forms.some((form) => form.id === selectedFormId)) {
      setSelectedFormId(plan.forms[0].id);
    }
  }, [plan, selectedFormId]);

  const selectedForm = plan?.forms.find((form) => form.id === selectedFormId) ?? plan?.forms[0];
  const jobColor = useMemo(
    () => new Map(jobs.map((job, index) => [job.id, JOB_COLORS[index % JOB_COLORS.length]])),
    [jobs],
  );

  const updateJob = <K extends keyof JobPoolDraft>(id: string, key: K, value: JobPoolDraft[K]) => {
    setJobs((current) => current.map((job) => job.id === id ? { ...job, [key]: value } : job));
  };

  const addJob = () => {
    const index = jobs.length + 1;
    setJobs((current) => [
      ...current,
      {
        id: `draft-${Date.now()}-${index}`,
        name: `Job ${index}`,
        quantity: 500,
        widthMm: 148,
        heightMm: 210,
      },
    ]);
  };

  const resetDraft = () => {
    setJobs(DEFAULT_JOBS.map((job) => ({ ...job })));
    setSettings({ ...DEFAULT_SETTINGS });
  };

  const updateSetting = <K extends keyof JobPoolSettings>(key: K, value: JobPoolSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const recommendationLabel = plan?.recommendation === "pool"
    ? "Saml jobs"
    : plan?.recommendation === "separate"
      ? "Producer separat"
      : "Kræver kontrol";

  return (
    <div className="machine-pricing-surface workspace-jobpool">
      <section className="border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Workflow className="h-4 w-4" />
              Rådgivende produktionsplan
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Jobpulje og sammelform</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Sammenlign kompatible jobs på et fælles råark uden at ændre produkter, priser eller ordrer.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              Kun kladde
            </Badge>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-md" onClick={resetDraft} title="Nulstil kladde" aria-label="Nulstil kladde">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-950">1. Fælles produktion</h3>
        {sheetMachines.length === 0 ? (
          <Alert className="mt-3 border-amber-200 bg-amber-50 text-amber-950">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Der er endnu ingen arkmaskine</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                De {machines.length} nuværende {machines.length === 1 ? "maskine er" : "maskiner er"} rullebaserede.
                Sammelform på ark åbner, når en arkmaskine med arkformat og kapacitet er oprettet.
              </span>
              {onOpenMachines ? (
                <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-md border-amber-300 bg-white" onClick={onOpenMachines}>
                  Gå til maskiner
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        {sheetMachines.length > 0 && sheetMaterials.length === 0 ? (
          <Alert className="mt-3 border-amber-200 bg-amber-50 text-amber-950">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Der mangler et råark</AlertTitle>
            <AlertDescription>
              Opret et materiale med arkpris eller faste råarksmål, før jobpuljen beregnes.
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Arkmaskine</Label>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger className="h-10 rounded-md"><SelectValue placeholder="Vælg maskine" /></SelectTrigger>
              <SelectContent className="machine-pricing-menu">{sheetMachines.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Råmateriale</Label>
            <Select value={materialId} onValueChange={setMaterialId}>
              <SelectTrigger className="h-10 rounded-md"><SelectValue placeholder="Vælg materiale" /></SelectTrigger>
              <SelectContent className="machine-pricing-menu">{sheetMaterials.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Blæksæt</Label>
            <Select value={inkSetId} onValueChange={setInkSetId}>
              <SelectTrigger className="h-10 rounded-md"><SelectValue placeholder="Vælg blæk" /></SelectTrigger>
              <SelectContent className="machine-pricing-menu">{inkSets.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Kostmodel</Label>
            <Select value={settings.costModel} onValueChange={(value) => updateSetting("costModel", value as JobPoolSettings["costModel"])}>
              <SelectTrigger className="h-10 rounded-md"><SelectValue /></SelectTrigger>
              <SelectContent className="machine-pricing-menu">
                <SelectItem value="DIGITAL_CLICK">Digital klikpris</SelectItem>
                <SelectItem value="INKJET">Blæk pr. m²</SelectItem>
                <SelectItem value="OFFSET">Offset med plader</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-600">Tryksider</Label>
            <Select value={String(settings.sides)} onValueChange={(value) => updateSetting("sides", value === "2" ? 2 : 1)}>
              <SelectTrigger className="h-10 rounded-md"><SelectValue /></SelectTrigger>
              <SelectContent className="machine-pricing-menu"><SelectItem value="1">1 side</SelectItem><SelectItem value="2">2 sider</SelectItem></SelectContent>
            </Select>
          </div>
          <NumberField id="pool-bleed" label="Bleed" value={settings.bleedMm} unit="mm" step={0.5} onChange={(value) => updateSetting("bleedMm", value)} />
          <NumberField id="pool-gap" label="Mellemrum" value={settings.gapMm} unit="mm" step={0.5} onChange={(value) => updateSetting("gapMm", value)} />
          <NumberField id="pool-coverage" label="Farvedækning" value={settings.coveragePct} unit="%" max={100} onChange={(value) => updateSetting("coveragePct", Math.min(100, value))} />
          <NumberField id="pool-margin" label="Målmargin" value={settings.targetMarginPct} unit="%" max={95} onChange={(value) => updateSetting("targetMarginPct", Math.min(95, value))} />
          {settings.costModel === "DIGITAL_CLICK" ? (
            <NumberField id="pool-click" label="Klik pr. side" value={Number(settings.clickCostPerSide || 0)} unit="kr." step={0.01} onChange={(value) => updateSetting("clickCostPerSide", value)} />
          ) : null}
          {settings.costModel === "OFFSET" ? (
            <>
              <NumberField id="pool-plates" label="Plader pr. form" value={Number(settings.plateCount || 0)} unit="stk." onChange={(value) => updateSetting("plateCount", Math.floor(value))} />
              <NumberField id="pool-plate-cost" label="Pris pr. plade" value={Number(settings.plateCostEach || 0)} unit="kr." step={0.01} onChange={(value) => updateSetting("plateCostEach", value)} />
              <NumberField id="pool-fixed-cost" label="Fast formkost" value={Number(settings.fixedJobCost || 0)} unit="kr." step={0.01} onChange={(value) => updateSetting("fixedJobCost", value)} />
            </>
          ) : null}
        </div>
      </section>

      <section className="border-t border-slate-200 pt-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">2. Jobs i puljen</h3>
            <p className="mt-1 text-sm text-slate-500">{jobs.length} kladdejob</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 rounded-md" onClick={addJob}>
            <Plus className="h-4 w-4" />
            Tilføj job
          </Button>
        </div>

        <div className="mt-3 overflow-x-auto border-y border-slate-200">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[minmax(180px,1.5fr)_130px_130px_130px_48px] gap-3 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
              <span>Job</span><span>Antal</span><span>Bredde</span><span>Højde</span><span />
            </div>
            {jobs.map((job, index) => {
              const color = JOB_COLORS[index % JOB_COLORS.length];
              return (
                <div key={job.id} className="grid grid-cols-[minmax(180px,1.5fr)_130px_130px_130px_48px] items-center gap-3 border-t border-slate-200 px-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="h-4 w-4 shrink-0 rounded-sm border" style={{ backgroundColor: color.background, borderColor: color.border }} />
                    <Input value={job.name} onChange={(event) => updateJob(job.id, "name", event.target.value)} className="h-9 min-w-0 rounded-md" aria-label={`Navn på job ${index + 1}`} />
                  </div>
                  <NumberInput min={1} emptyValue={1} value={job.quantity} onValueChange={(value) => updateJob(job.id, "quantity", Math.max(1, Math.floor(value)))} className="h-9 rounded-md" aria-label={`Antal for ${job.name}`} />
                  <div className="relative"><NumberInput min={1} value={job.widthMm} onValueChange={(value) => updateJob(job.id, "widthMm", value)} className="h-9 rounded-md pr-10" aria-label={`Bredde for ${job.name}`} /><span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">mm</span></div>
                  <div className="relative"><NumberInput min={1} value={job.heightMm} onValueChange={(value) => updateJob(job.id, "heightMm", value)} className="h-9 rounded-md pr-10" aria-label={`Højde for ${job.name}`} /><span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">mm</span></div>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-md text-slate-400 hover:text-red-600" onClick={() => setJobs((current) => current.filter((item) => item.id !== job.id))} title={`Fjern ${job.name}`} aria-label={`Fjern ${job.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 pt-5">
        <div className="flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-950">3. Produktionsforslag</h3>
        </div>

        {!machine || !material || !inkSet ? (
          <Alert className="mt-4 border-amber-200 bg-amber-50 text-amber-950">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Grunddata mangler</AlertTitle>
            <AlertDescription>Vælg en arkmaskine, et materiale og et blæksæt.</AlertDescription>
          </Alert>
        ) : plan?.status === "blocked" ? (
          <Alert variant="destructive" className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Planen kan ikke beregnes</AlertTitle>
            <AlertDescription>{plan.errors.join(" ")}</AlertDescription>
          </Alert>
        ) : plan && selectedForm ? (
          <>
            <div className="mt-4 grid divide-y divide-slate-200 border-y border-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-5">
              <Metric label="Anbefaling" value={recommendationLabel} />
              <Metric label="Sammelform kostpris" value={kr.format(plan.pooledCost)} />
              <Metric label="Estimeret besparelse" value={kr.format(plan.estimatedSavings)} accent={plan.estimatedSavings > 0} />
              <Metric label="Ark inkl. spild" value={number.format(plan.totalSheets)} />
              <Metric label="Foreslået salgspris" value={kr.format(plan.pooledSellPrice)} />
            </div>

            <div className="mt-6 grid gap-7 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.8fr)]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <ClipboardList className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="truncate text-sm font-medium text-slate-900">
                      {number.format(selectedForm.sheetWidthMm)} × {number.format(selectedForm.sheetHeightMm)} mm
                    </span>
                    <Badge variant="secondary">{number.format(selectedForm.utilizationPct)}% udnyttet</Badge>
                  </div>
                  {plan.forms.length > 1 ? (
                    <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
                      {plan.forms.map((form, index) => (
                        <button
                          key={form.id}
                          type="button"
                          onClick={() => setSelectedFormId(form.id)}
                          className={`h-8 rounded-md px-3 text-xs font-medium ${selectedForm.id === form.id ? "bg-white text-slate-950 shadow-none" : "text-slate-500 hover:text-slate-900"}`}
                        >
                          Form {index + 1}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex min-h-[320px] items-center justify-center overflow-auto rounded-md border border-slate-300 bg-slate-100 p-5">
                  <div
                    className="relative w-full max-w-[720px] overflow-hidden border border-slate-400 bg-white shadow-none"
                    style={{ aspectRatio: `${selectedForm.printableWidthMm} / ${selectedForm.printableHeightMm}` }}
                  >
                    {selectedForm.placements.map((placement) => {
                      const color = jobColor.get(placement.jobId) ?? JOB_COLORS[0];
                      const job = jobs.find((item) => item.id === placement.jobId);
                      const widthPct = placement.widthMm / selectedForm.printableWidthMm * 100;
                      const heightPct = placement.heightMm / selectedForm.printableHeightMm * 100;
                      const showLabel = widthPct >= 9 && heightPct >= 6;
                      return (
                        <div
                          key={`${placement.jobId}-${placement.slotIndex}`}
                          className="absolute overflow-hidden border"
                          title={`${job?.name || placement.jobId} · plads ${placement.slotIndex + 1}`}
                          style={{
                            left: `${placement.xMm / selectedForm.printableWidthMm * 100}%`,
                            top: `${placement.yMm / selectedForm.printableHeightMm * 100}%`,
                            width: `${widthPct}%`,
                            height: `${heightPct}%`,
                            backgroundColor: color.background,
                            borderColor: color.border,
                            color: color.text,
                          }}
                        >
                          {showLabel ? <span className="block truncate px-1 py-0.5 text-[10px] font-medium">{job?.name}</span> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <aside className="border-slate-200 xl:border-l xl:pl-7">
                <div className="flex items-center justify-between gap-4">
                  <h4 className="text-sm font-semibold text-slate-950">Formfordeling</h4>
                  <span className="text-xs text-slate-500">{selectedForm.netSheets} nettoark</span>
                </div>
                <div className="mt-3 overflow-hidden rounded-md border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr><th className="px-3 py-2 font-medium">Job</th><th className="px-3 py-2 text-right font-medium">Pr. ark</th><th className="px-3 py-2 text-right font-medium">Planlagt</th><th className="px-3 py-2 text-right font-medium">Ekstra</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedForm.jobs.map((job) => (
                        <tr key={job.jobId}>
                          <td className="max-w-40 truncate px-3 py-2.5 font-medium text-slate-800">{job.name}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{job.slotsPerSheet}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{job.plannedQuantity}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">{job.overrunQuantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200 text-sm">
                  <div className="flex items-center justify-between gap-4 py-2"><span className="text-slate-500">Materiale</span><span className="tabular-nums">{kr.format(selectedForm.cost.materialCost)}</span></div>
                  <div className="flex items-center justify-between gap-4 py-2"><span className="text-slate-500">Maskine</span><span className="tabular-nums">{kr.format(selectedForm.cost.machineCost)}</span></div>
                  {selectedForm.cost.clickCost > 0 ? <div className="flex items-center justify-between gap-4 py-2"><span className="text-slate-500">Klik</span><span className="tabular-nums">{kr.format(selectedForm.cost.clickCost)}</span></div> : null}
                  {selectedForm.cost.inkCost > 0 ? <div className="flex items-center justify-between gap-4 py-2"><span className="text-slate-500">Blæk</span><span className="tabular-nums">{kr.format(selectedForm.cost.inkCost)}</span></div> : null}
                  {selectedForm.cost.plateCost > 0 ? <div className="flex items-center justify-between gap-4 py-2"><span className="text-slate-500">Plader</span><span className="tabular-nums">{kr.format(selectedForm.cost.plateCost)}</span></div> : null}
                  <div className="flex items-center justify-between gap-4 py-2 font-semibold"><span>Formens kostpris</span><span className="tabular-nums">{kr.format(selectedForm.cost.baseCost)}</span></div>
                </div>
              </aside>
            </div>

            {plan.warnings.length > 0 ? (
              <Alert className="mt-6 border-amber-200 bg-amber-50 text-amber-950">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Kræver produktionskontrol</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 space-y-1">
                    {plan.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="mt-6 border-emerald-200 bg-slate-50 text-emerald-950">
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Grunddata er udfyldt</AlertTitle>
                <AlertDescription>Planen kan bruges som internt beregningsforslag, men er ikke sendt til produktion.</AlertDescription>
              </Alert>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}
