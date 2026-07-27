import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  FileUp,
  Gauge,
  Library,
  Loader2,
  PackageOpen,
  Ruler,
  ShieldCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  simulateMachineCost,
  type MachineCostInkSet,
  type MachineCostJob,
  type MachineCostMachine,
  type MachineCostMaterial,
} from "@/lib/pricing/machineCostSimulator";
import {
  MACHINE_PROFILE_CANDIDATES,
  MACHINE_PROFILE_CATEGORY_LABELS,
  type MachineProfileCandidate,
  type MachineProfileCategory,
} from "@/lib/pricing/machineProfileCatalog";

type MachineCostWorkbenchProps = {
  machines: Array<MachineCostMachine & { id: string; name: string }>;
  materials: Array<MachineCostMaterial & { id: string; name: string }>;
  inkSets: Array<MachineCostInkSet & { id: string; name: string }>;
  onUseMachineDraft: (draft: Record<string, unknown>) => void;
};

type BrochureAnalysis = {
  fileName: string;
  pages: number;
  draft: Record<string, unknown>;
  findings: string[];
  warnings: string[];
};

const kr = new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" });
const number = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 });

const parsePdfNumber = (value: string) => Number(value.replace(/\s/g, "").replace(",", "."));

const analyzeBrochureText = (fileName: string, pages: number, rawText: string): BrochureAnalysis => {
  const text = rawText.replace(/\s+/g, " ");
  const lower = text.toLowerCase();
  const findings: string[] = [];
  const warnings: string[] = [];
  const draft: Record<string, unknown> = {
    name: fileName.replace(/\.pdf$/i, ""),
    margin_left_mm: 0,
    margin_right_mm: 0,
    margin_top_mm: 0,
    margin_bottom_mm: 0,
    setup_waste_sheets: 0,
    run_waste_pct: 0,
    setup_time_min: 0,
    machine_rate_per_hour: 0,
  };

  const looksLikeRoll = /(roll[- ]fed|roll media|rulle|latex|eco[- ]solvent|large format|wide format)/i.test(text);
  draft.mode = looksLikeRoll ? "ROLL" : "SHEET";

  const widthPatterns = [
    /(?:max(?:imum)?\.?\s*)?(?:media|print|roll|working)\s*width[^\d]{0,30}(\d{3,4}(?:[.,]\d+)?)\s*mm/i,
    /(?:mediebredde|rullebredde|arbejdsbredde)[^\d]{0,30}(\d{3,4}(?:[.,]\d+)?)\s*mm/i,
  ];
  const widthMatch = widthPatterns.map((pattern) => text.match(pattern)).find(Boolean);

  if (looksLikeRoll && widthMatch) {
    draft.roll_width_mm = parsePdfNumber(widthMatch[1]);
    findings.push(`Rullebredde fundet: ${number.format(Number(draft.roll_width_mm))} mm`);
  }

  const dimensionMatches = [...text.matchAll(/(\d{3,4}(?:[.,]\d+)?)\s*(?:mm)?\s*[x×]\s*(\d{3,4}(?:[.,]\d+)?)\s*mm/gi)]
    .map((match) => [parsePdfNumber(match[1]), parsePdfNumber(match[2])] as const)
    .filter(([width, height]) => width <= 2000 && height <= 2000 && width >= 100 && height >= 100)
    .sort((a, b) => b[0] * b[1] - a[0] * a[1]);

  if (!looksLikeRoll && dimensionMatches[0]) {
    draft.sheet_width_mm = dimensionMatches[0][0];
    draft.sheet_height_mm = dimensionMatches[0][1];
    findings.push(`Største relevante arkformat fundet: ${dimensionMatches[0][0]} × ${dimensionMatches[0][1]} mm`);
    warnings.push("Kontrollér at formatet er medieformatet og ikke maskinens udvendige mål.");
  }

  const m2Speeds = [...text.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*m(?:²|2)\s*(?:\/|per)\s*(?:h|hour|time)/gi)]
    .map((match) => parsePdfNumber(match[1]))
    .filter((value) => value > 0 && value < 1000);
  if (looksLikeRoll && m2Speeds.length > 0) {
    findings.push(`Brochuren nævner m²-hastigheder: ${[...new Set(m2Speeds)].slice(0, 6).join(", ")} m²/t`);
    warnings.push("Vælg ikke automatisk den højeste hastighed; brug den kvalitetstilstand I sælger.");
  }

  const ppmMatch = text.match(/(\d{2,3})\s*(?:pages per minute|ppm|sider pr\.? min)/i);
  if (ppmMatch) {
    findings.push(`Nominel hastighed fundet: ${ppmMatch[1]} sider/min.`);
    warnings.push("Sider/min. er ikke det samme som jeres målte råark/time ved blandede materialer.");
  }

  draft.duplex_supported = /(automatic duplex|auto duplex|duplex unit|perfecting|vendingsenhed)/i.test(text);
  if (draft.duplex_supported) findings.push("Duplex eller vendingsenhed omtales i brochuren.");

  if (lower.includes("ink") || lower.includes("blæk")) findings.push("Brochuren indeholder blækrelaterede oplysninger.");
  if (findings.length === 0) warnings.push("Der blev ikke fundet sikre maskinfelter. Opret kladden og udfyld værdierne manuelt.");
  warnings.push("Timekost, arbejdsløn, service, spild og reelt forbrug skal altid bekræftes af trykkeriet.");

  return { fileName, pages, draft, findings, warnings };
};

function NumericField({
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
        <Input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
          className="h-10 rounded-lg pr-14"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">{unit}</span>
      </div>
    </div>
  );
}

function ResultLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2 ${strong ? "font-semibold text-slate-950" : "text-slate-600"}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

export function MachineCostWorkbench({ machines, materials, inkSets, onUseMachineDraft }: MachineCostWorkbenchProps) {
  const [machineId, setMachineId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [inkSetId, setInkSetId] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryCategory, setLibraryCategory] = useState<"all" | MachineProfileCategory>("all");
  const [librarySearch, setLibrarySearch] = useState("");
  const [brochureBusy, setBrochureBusy] = useState(false);
  const [brochureAnalysis, setBrochureAnalysis] = useState<BrochureAnalysis | null>(null);
  const brochureInputRef = useRef<HTMLInputElement | null>(null);
  const [job, setJob] = useState<MachineCostJob>({
    costModel: "INKJET",
    quantity: 20,
    widthMm: 210,
    heightMm: 297,
    bleedMm: 3,
    gapMm: 2,
    sides: 1,
    coveragePct: 30,
    targetMarginPct: 40,
    roundingStep: 1,
    clickCostPerSide: 0,
    plateCount: 4,
    plateCostEach: 125,
    fixedJobCost: 0,
  });

  useEffect(() => {
    if (!machineId && machines[0]) setMachineId(machines[0].id);
    if (!materialId && materials[0]) setMaterialId(materials[0].id);
    if (!inkSetId && inkSets[0]) setInkSetId(inkSets[0].id);
  }, [inkSetId, inkSets, machineId, machines, materialId, materials]);

  const machine = machines.find((item) => item.id === machineId);
  const material = materials.find((item) => item.id === materialId);
  const inkSet = inkSets.find((item) => item.id === inkSetId);
  const result = useMemo(
    () => machine && material && inkSet ? simulateMachineCost(machine, material, inkSet, job) : null,
    [inkSet, job, machine, material],
  );

  const filteredProfiles = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();
    return MACHINE_PROFILE_CANDIDATES.filter((profile) => {
      const categoryMatch = libraryCategory === "all" || profile.category === libraryCategory;
      const searchMatch = !query || `${profile.manufacturer} ${profile.model}`.toLowerCase().includes(query);
      return categoryMatch && searchMatch;
    });
  }, [libraryCategory, librarySearch]);

  const updateJob = <K extends keyof MachineCostJob>(key: K, value: MachineCostJob[K]) => {
    setJob((current) => ({ ...current, [key]: value }));
  };

  const selectProfile = (profile: MachineProfileCandidate) => {
    onUseMachineDraft({ ...profile.machineDraft, _profile_source_url: profile.sourceUrl, _profile_source_label: profile.sourceLabel });
    setLibraryOpen(false);
  };

  const readBrochure = async (file?: File) => {
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Vælg en PDF-brochure");
      return;
    }

    setBrochureBusy(true);
    setBrochureAnalysis(null);
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
      const bytes = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      const pageLimit = Math.min(pdf.numPages, 16);
      const pageTexts: string[] = [];
      for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pageTexts.push(content.items.map((item) => (item as { str?: string }).str || "").join(" "));
      }
      setBrochureAnalysis(analyzeBrochureText(file.name, pdf.numPages, pageTexts.join(" ")));
      toast.success("Brochuren er læst. Kontrollér forslagene før du opretter maskinen.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Ukendt PDF-fejl";
      toast.error(`Kunne ikke læse brochuren: ${message}`);
    } finally {
      setBrochureBusy(false);
      if (brochureInputRef.current) brochureInputRef.current.value = "";
    }
  };

  const readiness = [
    { label: "Maskine", ready: Boolean(machine) },
    { label: "Timekost", ready: Number(machine?.machine_rate_per_hour || 0) > 0 },
    { label: "Materiale", ready: Boolean(material) && Number(material?.price_per_sheet || material?.price_per_m2 || 0) > 0 },
    {
      label: job.costModel === "DIGITAL_CLICK" ? "Klikpris" : job.costModel === "OFFSET" ? "Blæk/plader" : "Blæk",
      ready: job.costModel === "DIGITAL_CLICK"
        ? Number(job.clickCostPerSide || 0) > 0
        : Boolean(inkSet) && Number(inkSet?.price_per_ml || 0) > 0 && (job.costModel !== "OFFSET" || Number(job.plateCostEach || 0) > 0),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
              <Calculator className="h-4 w-4" />
              Sikker beregning før publicering
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Kostpris-test</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Test oplægning, medie, blæk, maskintid og avance. Resultatet ændrer ikke priser i shoppen.
            </p>
          </div>
          <Button variant="outline" className="gap-2 rounded-lg" onClick={() => setLibraryOpen(true)}>
            <Library className="h-4 w-4" />
            Maskinbibliotek
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {readiness.map((item) => (
            <Badge key={item.label} variant="outline" className={item.ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}>
              {item.ready ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertTriangle className="mr-1 h-3 w-3" />}
              {item.label}
            </Badge>
          ))}
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.72fr)]">
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-slate-950">1. Produktion</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Maskine</Label>
                <Select value={machineId} onValueChange={setMachineId}>
                  <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Vælg maskine" /></SelectTrigger>
                  <SelectContent>{machines.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Materiale</Label>
                <Select value={materialId} onValueChange={setMaterialId}>
                  <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Vælg materiale" /></SelectTrigger>
                  <SelectContent>{materials.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Blæksæt</Label>
                <Select value={inkSetId} onValueChange={setInkSetId}>
                  <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Vælg blæk" /></SelectTrigger>
                  <SelectContent>{inkSets.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Kostmodel</Label>
                <Select value={job.costModel} onValueChange={(value) => updateJob("costModel", value as MachineCostJob["costModel"])}>
                  <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INKJET">Blæk pr. m²</SelectItem>
                    <SelectItem value="DIGITAL_CLICK">Digital klikpris</SelectItem>
                    <SelectItem value="OFFSET">Offset med plader</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="border-t border-slate-200 pt-5">
            <h3 className="text-sm font-semibold text-slate-950">2. Job og oplægning</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <NumericField id="cost-quantity" label="Antal" value={job.quantity} unit="stk." min={1} onChange={(value) => updateJob("quantity", Math.max(1, Math.floor(value)))} />
              <NumericField id="cost-width" label="Bredde" value={job.widthMm} unit="mm" onChange={(value) => updateJob("widthMm", value)} />
              <NumericField id="cost-height" label="Højde" value={job.heightMm} unit="mm" onChange={(value) => updateJob("heightMm", value)} />
              <NumericField id="cost-bleed" label="Beskæring" value={job.bleedMm} unit="mm" step={0.5} onChange={(value) => updateJob("bleedMm", value)} />
              <NumericField id="cost-gap" label="Mellemrum" value={job.gapMm} unit="mm" step={0.5} onChange={(value) => updateJob("gapMm", value)} />
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-slate-600">Tryksider</Label>
                <Select value={String(job.sides)} onValueChange={(value) => updateJob("sides", value === "2" ? 2 : 1)}>
                  <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="1">1 side</SelectItem><SelectItem value="2">2 sider</SelectItem></SelectContent>
                </Select>
              </div>
              <NumericField id="cost-coverage" label="Farvedækning" value={job.coveragePct} unit="%" max={100} onChange={(value) => updateJob("coveragePct", Math.min(100, value))} />
              <NumericField id="cost-margin" label="Målmargin" value={job.targetMarginPct} unit="%" max={95} onChange={(value) => updateJob("targetMarginPct", Math.min(95, value))} />
              {job.costModel === "DIGITAL_CLICK" ? (
                <NumericField id="cost-click" label="Klikpris pr. side" value={Number(job.clickCostPerSide || 0)} unit="kr." step={0.01} onChange={(value) => updateJob("clickCostPerSide", value)} />
              ) : null}
              {job.costModel === "OFFSET" ? (
                <>
                  <NumericField id="cost-plates" label="Antal plader" value={Number(job.plateCount || 0)} unit="stk." onChange={(value) => updateJob("plateCount", Math.floor(value))} />
                  <NumericField id="cost-plate-price" label="Pris pr. plade" value={Number(job.plateCostEach || 0)} unit="kr." step={0.01} onChange={(value) => updateJob("plateCostEach", value)} />
                  <NumericField id="cost-offset-fixed" label="Øvrig fast jobkost" value={Number(job.fixedJobCost || 0)} unit="kr." step={0.01} onChange={(value) => updateJob("fixedJobCost", value)} />
                </>
              ) : null}
            </div>
          </section>

          {result ? (
            <section className="border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">3. Oplægning</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {result.mode === "SHEET"
                      ? `${result.columns} × ${result.rows} = ${result.itemsPerSheet} emner pr. ark`
                      : `${result.columns} emner på tværs · ${number.format(result.consumedLengthM)} løbende meter`}
                  </p>
                </div>
                <Badge variant="secondary">{result.orientation === 90 ? "Roteret 90°" : "Normal retning"}</Badge>
              </div>
              <div className="mt-4 h-52 overflow-hidden rounded-lg border border-slate-300 bg-slate-100 p-3">
                <div
                  className="grid h-full gap-1 overflow-hidden rounded border border-dashed border-slate-400 bg-white p-2"
                  style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(result.columns, 10))}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: Math.max(1, Math.min(result.mode === "SHEET" ? result.itemsPerSheet : result.columns * 3, 60)) }).map((_, index) => (
                    <div key={index} className="min-h-4 rounded-sm border border-cyan-500 bg-cyan-50" />
                  ))}
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="border-l-0 border-slate-200 xl:border-l xl:pl-8">
          <div className="sticky top-6">
            <div className="flex items-center gap-2">
              <PackageOpen className="h-4 w-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-950">Kalkulation</h3>
            </div>
            {!result ? (
              <p className="mt-4 text-sm text-slate-500">Vælg maskine, materiale og blæk for at beregne jobbet.</p>
            ) : (
              <>
                <div className="mt-4 divide-y divide-slate-200 text-sm">
                  <ResultLine label="Materiale" value={kr.format(result.materialCost)} />
                  {job.costModel !== "DIGITAL_CLICK" ? <ResultLine label={`Blæk · ${number.format(result.inkMl)} ml`} value={kr.format(result.inkCost)} /> : null}
                  {result.clickCost > 0 || job.costModel === "DIGITAL_CLICK" ? <ResultLine label="Klikafgift" value={kr.format(result.clickCost)} /> : null}
                  {result.plateCost > 0 || job.costModel === "OFFSET" ? <ResultLine label="Trykplader" value={kr.format(result.plateCost)} /> : null}
                  {result.fixedJobCost > 0 ? <ResultLine label="Øvrig fast jobkost" value={kr.format(result.fixedJobCost)} /> : null}
                  <ResultLine label={`Maskine · ${number.format(result.totalTimeMin)} min.`} value={kr.format(result.machineCost)} />
                  <ResultLine label="Samlet kostpris" value={kr.format(result.baseCost)} strong />
                </div>
                <div className="mt-5 rounded-lg bg-slate-950 p-5 text-white">
                  <div className="text-xs uppercase text-slate-400">Foreslået salgspris ekskl. moms</div>
                  <div className="mt-2 text-3xl font-semibold tabular-nums">{kr.format(result.sellPrice)}</div>
                  <div className="mt-3 flex justify-between text-sm text-slate-300">
                    <span>{kr.format(result.unitPrice)} pr. stk.</span>
                    <span>{number.format(result.actualMarginPct)}% margin</span>
                  </div>
                </div>
                <div className="mt-5 space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between"><span>Produktionsenheder</span><span>{result.productionUnits}</span></div>
                  <div className="flex justify-between"><span>Spild/enheder</span><span>{result.wasteUnits}</span></div>
                  <div className="flex justify-between"><span>Medieareal</span><span>{number.format(result.mediaAreaM2)} m²</span></div>
                  <div className="flex justify-between"><span>Fortjeneste</span><span>{kr.format(result.profit)}</span></div>
                </div>
                {result.warnings.length > 0 ? (
                  <Alert className="mt-5 border-amber-200 bg-amber-50 text-amber-950">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Kræver bekræftelse</AlertTitle>
                    <AlertDescription>
                      <ul className="mt-2 space-y-1">
                        {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="mt-5 border-emerald-200 bg-emerald-50 text-emerald-950">
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>Grunddata er udfyldt</AlertTitle>
                    <AlertDescription>Gem en kontrolleret prisprofil før produktet tilknyttes.</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      <Sheet open={libraryOpen} onOpenChange={setLibraryOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader className="text-left">
            <SheetTitle>Maskinbibliotek</SheetTitle>
            <SheetDescription>
              Fabriksdata starter en kladde. Trykkeriets egne omkostninger og målte produktionsdata skal udfyldes før brug.
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="catalog" className="mt-6">
            <TabsList className="grid h-10 w-full grid-cols-2 rounded-lg">
              <TabsTrigger value="catalog" className="rounded-md"><BookOpen className="mr-2 h-4 w-4" />Bibliotek</TabsTrigger>
              <TabsTrigger value="brochure" className="rounded-md"><FileSearch className="mr-2 h-4 w-4" />Læs brochure</TabsTrigger>
            </TabsList>

            <TabsContent value="catalog" className="mt-5 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="Søg producent eller model" className="h-10 rounded-lg" />
                <Select value={libraryCategory} onValueChange={(value) => setLibraryCategory(value as typeof libraryCategory)}>
                  <SelectTrigger className="h-10 rounded-lg sm:w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle typer</SelectItem>
                    {Object.entries(MACHINE_PROFILE_CATEGORY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{filteredProfiles.length} profiler</span>
                <span>Hastighed og timekost kræver godkendelse</span>
              </div>
              <div className="divide-y divide-slate-200 border-y border-slate-200">
                {filteredProfiles.map((profile) => (
                  <div key={profile.id} className="py-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-950">{profile.manufacturer} {profile.model}</h3>
                          <Badge variant="outline">{MACHINE_PROFILE_CATEGORY_LABELS[profile.category]}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{profile.ratedPerformance}</p>
                        <ul className="mt-2 space-y-1 text-xs text-slate-500">
                          {profile.verifiedFacts.map((fact) => <li key={fact}>• {fact}</li>)}
                        </ul>
                        <a href={profile.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:underline">
                          {profile.sourceLabel}<ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <Button size="sm" className="shrink-0 rounded-lg" onClick={() => selectProfile(profile)}>Brug som kladde</Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="brochure" className="mt-5 space-y-5">
              <input ref={brochureInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => readBrochure(event.target.files?.[0])} />
              <button
                type="button"
                onClick={() => brochureInputRef.current?.click()}
                disabled={brochureBusy}
                className="flex min-h-40 w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center transition-colors hover:border-cyan-500 hover:bg-cyan-50 disabled:opacity-60"
              >
                {brochureBusy ? <Loader2 className="h-7 w-7 animate-spin text-cyan-700" /> : <FileUp className="h-7 w-7 text-cyan-700" />}
                <span className="mt-3 font-medium text-slate-950">{brochureBusy ? "Læser brochure..." : "Vælg producentens PDF-brochure"}</span>
                <span className="mt-1 text-sm text-slate-500">PDF’en analyseres lokalt og gemmes ikke automatisk.</span>
              </button>

              {brochureAnalysis ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div>
                      <div className="font-semibold text-slate-950">{brochureAnalysis.fileName}</div>
                      <div className="text-xs text-slate-500">{brochureAnalysis.pages} sider</div>
                    </div>
                    <Badge variant="secondary">Kladde</Badge>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">Fundne oplysninger</h3>
                    {brochureAnalysis.findings.length > 0 ? (
                      <ul className="mt-2 space-y-2 text-sm text-slate-600">
                        {brochureAnalysis.findings.map((finding) => <li key={finding} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{finding}</li>)}
                      </ul>
                    ) : <p className="mt-2 text-sm text-slate-500">Ingen sikre felter fundet.</p>}
                  </div>
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Kontrollér manuelt</AlertTitle>
                    <AlertDescription><ul className="mt-2 space-y-1">{brochureAnalysis.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></AlertDescription>
                  </Alert>
                  <Button className="w-full rounded-lg" onClick={() => { onUseMachineDraft(brochureAnalysis.draft); setLibraryOpen(false); }}>
                    <Ruler className="mr-2 h-4 w-4" />Brug forslag som maskinkladde
                  </Button>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
