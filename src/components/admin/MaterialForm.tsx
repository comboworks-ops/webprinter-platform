import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Layers3, Package2, Ruler, Scaling, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MaterialFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material?: any;
  tenantId: string;
  onSuccess: () => void;
}

const getDefaultFormData = (material?: any) => ({
  name: material?.name || "",
  material_type: material?.material_type || "PAPER",
  pricing_mode: material?.pricing_mode || "PER_SHEET",
  price_per_sheet: material?.price_per_sheet || 0,
  price_per_m2: material?.price_per_m2 || 0,
  sheet_width_mm: material?.sheet_width_mm || 0,
  sheet_height_mm: material?.sheet_height_mm || 0,
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

export function MaterialForm({ open, onOpenChange, material, tenantId, onSuccess }: MaterialFormProps) {
  const [formData, setFormData] = useState(getDefaultFormData(material));

  useEffect(() => {
    setFormData(getDefaultFormData(material));
  }, [material, open]);

  const initialState = useMemo(() => JSON.stringify(getDefaultFormData(material)), [material]);
  const currentState = useMemo(() => JSON.stringify(formData), [formData]);
  const isDirty = initialState !== currentState;
  const sheetAreaM2 = useMemo(() => {
    return (Number(formData.sheet_width_mm || 0) * Number(formData.sheet_height_mm || 0)) / 1000000;
  }, [formData.sheet_height_mm, formData.sheet_width_mm]);
  const normalizedPrice = formData.pricing_mode === "PER_SHEET"
    ? Number(formData.price_per_sheet || 0)
    : Number(formData.price_per_m2 || 0);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const data = { ...formData, tenant_id: tenantId };
      let error;
      if (material?.id) {
        ({ error } = await supabase.from("materials" as any).update(data).eq("id", material.id));
      } else {
        ({ error } = await supabase.from("materials" as any).insert(data));
      }

      if (error) throw error;
      toast.success(material?.id ? "Materiale opdateret" : "Materiale oprettet");
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
                    {material?.id ? "Rediger materiale" : "Nyt materiale"}
                  </DialogTitle>
                  {isDirty ? (
                    <Badge className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 hover:bg-amber-100">
                      Ugemte ændringer
                    </Badge>
                  ) : null}
                </div>
                <DialogDescription className="max-w-2xl text-sm text-slate-500">
                  Materialet styrer råvaretype, prislogik og arkformat. Opsætningen skal føles som en indkøbs- og produktionsprofil.
                </DialogDescription>
              </div>

              <div className="grid gap-2 text-right text-sm text-slate-500 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em]">Materialetype</div>
                  <div className="mt-1 font-semibold text-slate-900">{formData.material_type}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em]">Prislogik</div>
                  <div className="mt-1 font-semibold text-slate-900">{formData.pricing_mode === "PER_SHEET" ? "Pr. ark" : "Pr. m²"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em]">Basispris</div>
                  <div className="mt-1 font-semibold text-emerald-700">{normalizedPrice.toFixed(2)} kr</div>
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
                      <Package2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Materiale identitet</h3>
                      <p className="text-sm text-slate-500">Navn og råvarekategori til brug i den interne beregning.</p>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="name">Navn</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                        placeholder="f.eks. 300g Silk"
                        required
                        className="h-12 rounded-xl border-white/70 bg-slate-50 shadow-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={formData.material_type} onValueChange={(value) => setFormData({ ...formData, material_type: value })}>
                        <SelectTrigger className="h-12 rounded-xl border-white/70 bg-slate-50 shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PAPER">Papir</SelectItem>
                          <SelectItem value="FOIL">Folie</SelectItem>
                          <SelectItem value="VINYL">Vinyl</SelectItem>
                          <SelectItem value="OTHER">Andet</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Pris-model</Label>
                      <Select value={formData.pricing_mode} onValueChange={(value) => setFormData({ ...formData, pricing_mode: value })}>
                        <SelectTrigger className="h-12 rounded-xl border-white/70 bg-slate-50 shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PER_SHEET">Pr. ark</SelectItem>
                          <SelectItem value="PER_M2">Pr. m²</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>

                {formData.pricing_mode === "PER_SHEET" ? (
                  <section className="rounded-[28px] border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                        <Ruler className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Ark-baseret pris</h3>
                        <p className="text-sm text-slate-500">Pris og råformat for materialer der købes og regnes per ark.</p>
                      </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-3">
                      <NumberField
                        id="pps"
                        label="Pris pr. ark"
                        unit="kr"
                        step="0.01"
                        value={Number(formData.price_per_sheet || 0)}
                        onChange={(value) => setFormData({ ...formData, price_per_sheet: value })}
                      />
                      <NumberField
                        id="sw"
                        label="Ark-bredde"
                        unit="mm"
                        value={Number(formData.sheet_width_mm || 0)}
                        onChange={(value) => setFormData({ ...formData, sheet_width_mm: value })}
                      />
                      <NumberField
                        id="sh"
                        label="Ark-højde"
                        unit="mm"
                        value={Number(formData.sheet_height_mm || 0)}
                        onChange={(value) => setFormData({ ...formData, sheet_height_mm: value })}
                      />
                    </div>
                  </section>
                ) : (
                  <section className="rounded-[28px] border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-6 shadow-sm">
                    <div className="mb-5 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                        <Scaling className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Areal-baseret pris</h3>
                        <p className="text-sm text-slate-500">Prislogik til materialer der regnes direkte per kvadratmeter.</p>
                      </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <NumberField
                        id="pm2"
                        label="Pris pr. m²"
                        unit="kr"
                        step="0.01"
                        value={Number(formData.price_per_m2 || 0)}
                        onChange={(value) => setFormData({ ...formData, price_per_m2: value })}
                      />
                    </div>
                  </section>
                )}
              </div>

              <aside className="space-y-5 lg:sticky lg:top-5">
                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Profil-preview</div>
                  <div className="mt-4 space-y-4 text-sm">
                    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <Sparkles className="mt-0.5 h-4 w-4 text-slate-500" />
                      <div>
                        <div className="font-semibold text-slate-900">{formData.name || "Unavngivet materiale"}</div>
                        <div className="text-xs text-slate-500">{formData.material_type}</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Pris-model</div>
                      <div className="mt-1 text-xl font-semibold text-slate-900">{formData.pricing_mode === "PER_SHEET" ? "Ark" : "m²"}</div>
                    </div>
                    {formData.pricing_mode === "PER_SHEET" ? (
                      <>
                        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-orange-700">Arkformat</div>
                          <div className="mt-1 text-xl font-semibold text-slate-900">{Number(formData.sheet_width_mm || 0)} × {Number(formData.sheet_height_mm || 0)} mm</div>
                          <div className="mt-1 text-xs text-orange-900/80">{sheetAreaM2.toFixed(3)} m² råareal</div>
                        </div>
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                          <div className="flex items-center gap-2 font-semibold text-emerald-800">
                            <BadgeCheck className="h-4 w-4" />
                            Estimeret arkværdi
                          </div>
                          <div className="mt-1 text-xs leading-relaxed text-emerald-900/80">
                            Materialet beregnes som et fast råark til {Number(formData.price_per_sheet || 0).toFixed(2)} kr pr. ark.
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-cyan-700">m²-baseret indkøb</div>
                        <div className="mt-1 text-xl font-semibold text-slate-900">{Number(formData.price_per_m2 || 0).toFixed(2)} kr/m²</div>
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4 sm:justify-between">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
              {material?.id ? "Opdatering af eksisterende materiale" : "Nyt materiale"}
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Annuller
              </Button>
              <Button type="submit" className="rounded-xl bg-emerald-500 px-5 hover:bg-emerald-600">
                Gem materiale
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
