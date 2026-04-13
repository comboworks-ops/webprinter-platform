import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Droplets, FlaskConical, Percent, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface InkSetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inkSet?: any;
  tenantId: string;
  onSuccess: () => void;
}

const getDefaultFormData = (inkSet?: any) => ({
  name: inkSet?.name || "",
  price_per_ml: inkSet?.price_per_ml || 0,
  ml_per_m2_at_100pct: inkSet?.ml_per_m2_at_100pct || 15,
  default_coverage_pct: inkSet?.default_coverage_pct || 10,
  tolerance_pct: inkSet?.tolerance_pct || 0,
});

const sanitizeNumber = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function NumberField({
  id,
  label,
  value,
  unit,
  step = "1",
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  unit: string;
  step?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
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

export function InkSetForm({ open, onOpenChange, inkSet, tenantId, onSuccess }: InkSetFormProps) {
  const [formData, setFormData] = useState(getDefaultFormData(inkSet));

  useEffect(() => {
    setFormData(getDefaultFormData(inkSet));
  }, [inkSet, open]);

  const initialState = useMemo(() => JSON.stringify(getDefaultFormData(inkSet)), [inkSet]);
  const currentState = useMemo(() => JSON.stringify(formData), [formData]);
  const isDirty = initialState !== currentState;
  const mlCostAtDefaultCoverage = useMemo(() => {
    const mlAtCoverage = Number(formData.ml_per_m2_at_100pct || 0) * (Number(formData.default_coverage_pct || 0) / 100);
    return mlAtCoverage * Number(formData.price_per_ml || 0);
  }, [formData.default_coverage_pct, formData.ml_per_m2_at_100pct, formData.price_per_ml]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const data = { ...formData, tenant_id: tenantId };
      let error;
      if (inkSet?.id) {
        ({ error } = await supabase.from("ink_sets" as any).update(data).eq("id", inkSet.id));
      } else {
        ({ error } = await supabase.from("ink_sets" as any).insert(data));
      }

      if (error) throw error;
      toast.success(inkSet?.id ? "Blæksæt opdateret" : "Blæksæt oprettet");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Kunne ikke gemme: ${err.message}`);
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
                    {inkSet?.id ? "Rediger blæksæt" : "Nyt blæksæt"}
                  </DialogTitle>
                  {isDirty ? (
                    <Badge className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 hover:bg-amber-100">
                      Ugemte ændringer
                    </Badge>
                  ) : null}
                </div>
                <DialogDescription className="max-w-2xl text-sm text-slate-500">
                  Blæksættet beskriver pris, forbrug og dækning. Det skal læses som en produktionsprofil for farveforbrug.
                </DialogDescription>
              </div>

              <div className="grid gap-2 text-right text-sm text-slate-500 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em]">Pris pr. ml</div>
                  <div className="mt-1 font-semibold text-slate-900">{Number(formData.price_per_ml || 0).toFixed(2)} kr</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em]">100% dækning</div>
                  <div className="mt-1 font-semibold text-slate-900">{Number(formData.ml_per_m2_at_100pct || 0).toFixed(1)} ml/m²</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em]">Estimat</div>
                  <div className="mt-1 font-semibold text-emerald-700">{mlCostAtDefaultCoverage.toFixed(2)} kr/m²</div>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="grid min-h-full gap-6 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-6">
              <div className="space-y-6">
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Droplets className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Blæksæt identitet</h3>
                      <p className="text-sm text-slate-500">Navngiv systemet så operatøren hurtigt kan se hvilken blæklogik der bruges.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Navn</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                      placeholder="f.eks. CMYK Standard"
                      required
                      className="h-12 rounded-xl border-white/70 bg-slate-50 shadow-sm"
                    />
                  </div>
                </section>

                <section className="rounded-[28px] border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                      <FlaskConical className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Forbrug & pris</h3>
                      <p className="text-sm text-slate-500">Definer pris pr. ml og forbrug ved fuld dækning.</p>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <NumberField
                      id="price"
                      label="Pris pr. ml"
                      unit="kr"
                      step="0.01"
                      value={Number(formData.price_per_ml || 0)}
                      onChange={(value) => setFormData({ ...formData, price_per_ml: value })}
                    />
                    <NumberField
                      id="mlm2"
                      label="ml pr. m² ved 100%"
                      unit="ml/m²"
                      step="0.1"
                      value={Number(formData.ml_per_m2_at_100pct || 0)}
                      onChange={(value) => setFormData({ ...formData, ml_per_m2_at_100pct: value })}
                    />
                  </div>
                </section>

                <section className="rounded-[28px] border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-6 shadow-sm">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                      <Percent className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Dækning & tolerance</h3>
                      <p className="text-sm text-slate-500">Standardantagelser som maskinberegningen bruger før operatøren finjusterer jobbet.</p>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <NumberField
                      id="coverage"
                      label="Standard dækning"
                      unit="%"
                      value={Number(formData.default_coverage_pct || 0)}
                      onChange={(value) => setFormData({ ...formData, default_coverage_pct: value })}
                    />
                    <NumberField
                      id="tol"
                      label="Tolerance"
                      unit="%"
                      value={Number(formData.tolerance_pct || 0)}
                      onChange={(value) => setFormData({ ...formData, tolerance_pct: value })}
                    />
                  </div>
                </section>
              </div>

              <aside className="space-y-5 lg:sticky lg:top-5">
                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Profil-preview</div>
                  <div className="mt-4 space-y-4 text-sm">
                    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <Sparkles className="mt-0.5 h-4 w-4 text-slate-500" />
                      <div>
                        <div className="font-semibold text-slate-900">{formData.name || "Unavngivet blæksæt"}</div>
                        <div className="text-xs text-slate-500">Aktivt farvesystem</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-sky-700">Kost pr. m² ved standarddækning</div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">{mlCostAtDefaultCoverage.toFixed(2)} kr</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Tolerancevindue</div>
                      <div className="mt-1 text-xl font-semibold text-slate-900">± {Number(formData.tolerance_pct || 0)}%</div>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                      <div className="flex items-center gap-2 font-semibold text-emerald-800">
                        <BadgeCheck className="h-4 w-4" />
                        Produktionsnote
                      </div>
                      <div className="mt-1 text-xs leading-relaxed text-emerald-900/80">
                        Standardberegningen tager udgangspunkt i {Number(formData.default_coverage_pct || 0)}% dækning og {Number(formData.ml_per_m2_at_100pct || 0).toFixed(1)} ml/m² ved fuld flade.
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4 sm:justify-between">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
              {inkSet?.id ? "Opdatering af eksisterende blæksæt" : "Nyt blæksæt"}
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Annuller
              </Button>
              <Button type="submit" className="rounded-xl bg-emerald-500 px-5 hover:bg-emerald-600">
                Gem blæksæt
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
