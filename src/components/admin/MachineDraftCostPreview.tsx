import { useMemo, useState } from "react";
import { CheckCircle2, Scissors } from "lucide-react";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { estimateMachineDraft } from "@/lib/pricing/machineDraftEstimate";
import type { MachineCostMachine } from "@/lib/pricing/machineCostSimulator";
import { IMPOSITION_PRESETS, ImpositionPreview } from "./ImpositionPreview";
import { cn } from "@/lib/utils";

const kr = new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" });
const number = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 2 });

export function MachineDraftCostPreview({ machine }: { machine: MachineCostMachine }) {
  const [presetId, setPresetId] = useState("a4");
  const [quantity, setQuantity] = useState(100);
  const [bleedMm, setBleedMm] = useState(3);
  const [gapMm, setGapMm] = useState(2);
  const [cuttingMinutes, setCuttingMinutes] = useState(0);
  const [cuttingRatePerHour, setCuttingRatePerHour] = useState(0);
  const preset = IMPOSITION_PRESETS.find(item => item.id === presetId)!;
  const estimates = useMemo(() => IMPOSITION_PRESETS.map(format => ({
    ...format,
    estimate: estimateMachineDraft(machine, { widthMm: format.widthMm, heightMm: format.heightMm, quantity, bleedMm, gapMm, cuttingMinutes, cuttingRatePerHour }),
  })), [machine, quantity, bleedMm, gapMm, cuttingMinutes, cuttingRatePerHour]);
  const estimate = estimates.find(item => item.id === presetId)!.estimate;
  const { result } = estimate;
  const isSheet = machine.mode === "SHEET";
  const sheetWidth = Number(isSheet ? machine.sheet_width_mm : machine.roll_width_mm) || 0;
  const sheetHeight = isSheet ? Number(machine.sheet_height_mm) || 0 : 1000;
  const marginTop = Math.max(0, Number(machine.margin_top_mm) || 0);
  const marginBottom = Math.max(0, Number(machine.margin_bottom_mm) || 0);
  const safeBleed = Math.max(0, bleedMm);
  const safeGap = Math.max(0, gapMm);
  const rollItemHeight = (result.orientation === 90 ? preset.widthMm : preset.heightMm) + safeBleed * 2;
  const previewRows = isSheet ? result.rows : Math.max(0, Math.floor((1000 - marginTop - marginBottom + safeGap) / (rollItemHeight + safeGap)));

  return (
    <div className="space-y-5" data-testid="machine-draft-preview" onKeyDown={event => {
      if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
    }}>
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Prøvekalkule</h3>
        <p className="mt-1 text-sm text-slate-500">Opdateres, mens du indtaster maskindata.</p>
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-slate-600">Færdigt format</legend>
        <div className="grid grid-cols-3 gap-2">
          {estimates.map(format => (
            <button key={format.id} type="button" aria-pressed={presetId === format.id} onClick={() => setPresetId(format.id)}
              className={cn("min-h-14 rounded-[4px] border px-2 py-2 text-left transition-colors", presetId === format.id ? "border-sky-600 bg-sky-50 text-sky-900" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400")}>
              <span className="block text-sm font-semibold">{format.shortLabel}</span>
              <span className="mt-0.5 block text-[11px]">{sheetWidth > 0 && sheetHeight > 0 ? `${format.estimate.result.itemsPerSheet} ${isSheet ? "pr. ark" : "på tværs"}` : "Angiv format"}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-3 gap-3">
        <div className="min-w-0 space-y-1.5"><Label htmlFor="preview-quantity">Antal</Label><NumberInput form="machine-draft-preview-controls" id="preview-quantity" min={1} step={1} value={quantity} onValueChange={setQuantity} /></div>
        <div className="min-w-0 space-y-1.5"><Label htmlFor="preview-bleed">Bleed, mm</Label><NumberInput form="machine-draft-preview-controls" id="preview-bleed" min={0} step={0.1} value={bleedMm} onValueChange={setBleedMm} /></div>
        <div className="min-w-0 space-y-1.5"><Label htmlFor="preview-gap">Afstand, mm</Label><NumberInput form="machine-draft-preview-controls" id="preview-gap" min={0} step={0.1} value={gapMm} onValueChange={setGapMm} /></div>
      </div>

      <section className="rounded-[5px] border border-slate-200 bg-slate-50 p-4" aria-label="Live maskinomkostning" aria-live="polite" aria-atomic="true">
        <div className="text-xs font-medium text-slate-600">{cuttingMinutes > 0 ? "Maskine og skæring" : "Maskinomkostning"} · {preset.shortLabel}</div>
        <div className="mt-1 text-3xl font-semibold tracking-tight text-slate-950" data-testid="machine-draft-total">{estimate.totalCost === null ? "—" : kr.format(estimate.totalCost)}</div>
        {estimate.ready ? <>
          <p className="mt-1 text-sm text-slate-600" data-testid="machine-draft-unit">{kr.format(estimate.unitCost!)} pr. stk. · {number.format(quantity)} stk. · enkeltsidet</p>
          <dl className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between gap-3"><dt>Maskine inkl. opsætning</dt><dd className="tabular-nums">{kr.format(result.machineCost)}</dd></div>
            <div className="flex justify-between gap-3"><dt>Skæring</dt><dd className="tabular-nums">{cuttingMinutes > 0 ? kr.format(estimate.cuttingCost) : "Ikke tilføjet"}</dd></div>
            <div className="flex justify-between gap-3"><dt>Maskintid</dt><dd className="tabular-nums">{number.format(result.totalTimeMin)} min.</dd></div>
            <div className="flex justify-between gap-3"><dt>{isSheet ? "Ark inkl. spild" : "Rulleforbrug inkl. spild"}</dt><dd className="tabular-nums" data-testid="machine-draft-consumption">{isSheet ? number.format(result.totalUnits) : `${number.format(result.consumedLengthM)} m`}</dd></div>
          </dl>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-sky-700" />Beregnet fra den aktuelle maskinprofil</p>
        </> : <p className="mt-2 text-sm text-slate-600" data-testid="machine-draft-missing">Angiv {estimate.missing.join(", ")} for at se omkostningen.</p>}
        <p className="mt-3 text-xs leading-relaxed text-slate-500">Papir og blæk/klik beregnes i Kostpris-test. Øvrig efterbehandling er ikke medregnet. Beløbet her er ekskl. moms og avance.</p>
      </section>

      <details className="rounded-[5px] border border-slate-200 bg-white p-4">
        <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800"><Scissors className="h-4 w-4" />Skæring{cuttingMinutes > 0 ? ` · ${number.format(cuttingMinutes)} min.` : " · tilføj omkostning"}</summary>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="preview-cutting-minutes">Tid i alt, min.</Label><NumberInput form="machine-draft-preview-controls" id="preview-cutting-minutes" min={0} step={0.5} value={cuttingMinutes} onValueChange={setCuttingMinutes} /></div>
          <div className="space-y-1.5"><Label htmlFor="preview-cutting-rate">Timepris, kr.</Label><NumberInput form="machine-draft-preview-controls" id="preview-cutting-rate" min={0} step={0.1} value={cuttingRatePerHour} onValueChange={setCuttingRatePerHour} /></div>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">Regn med opsætning og skæretid for hele oplaget. Testværdierne gemmes ikke med maskinen.</p>
      </details>

      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-800">{isSheet ? "Arkudnyttelse" : "Rulleudsnit · 1 meter"}</h4>
          <span className="text-xs text-slate-500">{preset.widthMm} × {preset.heightMm} mm</span>
        </div>
        <ImpositionPreview sheetWidthMm={sheetWidth} sheetHeightMm={sheetHeight}
          marginLeftMm={Number(machine.margin_left_mm) || 0} marginRightMm={Number(machine.margin_right_mm) || 0}
          marginTopMm={marginTop} marginBottomMm={marginBottom}
          itemWidthMm={preset.widthMm} itemHeightMm={preset.heightMm} bleedMm={bleedMm} gapMm={gapMm}
          layout={{ orientation: result.orientation, columns: result.columns, rows: previewRows }}
          sheetLabel={isSheet ? "Råark" : "1 m rulleudsnit"} countLabel={isSheet ? "emner pr. ark" : "emner i 1 m udsnit"} />
      </div>
    </div>
  );
}
