import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Percent, Plus, SlidersHorizontal, Sparkles, Trash2, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MarginProfileFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile?: any;
  tenantId: string;
  onSuccess: () => void;
}

const sanitizeNumber = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function MarginProfileForm({ open, onOpenChange, profile: initialProfile, tenantId, onSuccess }: MarginProfileFormProps) {
  const [formData, setFormData] = useState({
    name: initialProfile?.name || "",
    mode: initialProfile?.mode || "TARGET_MARGIN",
    rounding_step: initialProfile?.rounding_step || 1,
    tier_basis: initialProfile?.tier_basis || "QUANTITY",
  });
  const [tiers, setTiers] = useState<any[]>([]);

  useEffect(() => {
    setFormData({
      name: initialProfile?.name || "",
      mode: initialProfile?.mode || "TARGET_MARGIN",
      rounding_step: initialProfile?.rounding_step || 1,
      tier_basis: initialProfile?.tier_basis || "QUANTITY",
    });

    if (initialProfile?.id) {
      fetchTiers(initialProfile.id);
    } else {
      setTiers([{ qty_from: 1, qty_to: null, value: 30 }]);
    }
  }, [initialProfile, open]);

  const fetchTiers = async (profileId: string) => {
    const { data } = await supabase
      .from("margin_profile_tiers" as any)
      .select("*")
      .eq("margin_profile_id", profileId)
      .order("qty_from");
    if (data) setTiers(data);
  };

  const addTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const newFrom = lastTier ? (lastTier.qty_to || lastTier.qty_from + 100) : 1;
    setTiers([...tiers, { qty_from: newFrom, qty_to: null, value: 20 }]);
  };

  const removeTier = (index: number) => {
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: string, value: any) => {
    const nextTiers = [...tiers];
    nextTiers[index][field] = value;
    setTiers(nextTiers);
  };

  const initialState = useMemo(
    () => JSON.stringify({
      formData: {
        name: initialProfile?.name || "",
        mode: initialProfile?.mode || "TARGET_MARGIN",
        rounding_step: initialProfile?.rounding_step || 1,
        tier_basis: initialProfile?.tier_basis || "QUANTITY",
      },
      tiers,
    }),
    [initialProfile?.mode, initialProfile?.name, initialProfile?.rounding_step, initialProfile?.tier_basis]
  );
  const currentState = useMemo(() => JSON.stringify({ formData, tiers }), [formData, tiers]);
  const isDirty = initialState !== currentState;
  const minRate = tiers.length > 0 ? Math.min(...tiers.map((tier) => Number(tier.value || 0))) : 0;
  const maxRate = tiers.length > 0 ? Math.max(...tiers.map((tier) => Number(tier.value || 0))) : 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const profileData = { ...formData, tenant_id: tenantId };
      let profileId = initialProfile?.id;

      if (profileId) {
        await supabase.from("margin_profiles" as any).update(profileData).eq("id", profileId);
      } else {
        const { data } = await supabase.from("margin_profiles" as any).insert(profileData).select().single();
        profileId = data.id;
      }

      await supabase.from("margin_profile_tiers" as any).delete().eq("margin_profile_id", profileId);
      await supabase.from("margin_profile_tiers" as any).insert(
        tiers.map((tier, index) => ({
          ...tier,
          margin_profile_id: profileId,
          tenant_id: tenantId,
          sort_order: index,
        }))
      );

      toast.success("Margin-profil gemt");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Fejl: ${err.message}`);
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
                    {initialProfile?.id ? "Rediger margin-profil" : "Ny margin-profil"}
                  </DialogTitle>
                  {isDirty ? (
                    <Badge className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 hover:bg-amber-100">
                      Ugemte ændringer
                    </Badge>
                  ) : null}
                </div>
                <DialogDescription className="max-w-2xl text-sm text-slate-500">
                  Marginprofilen styrer hvordan salgspris hæves over base cost. Tænk den som et kommercielt regelsæt med klare trin.
                </DialogDescription>
              </div>

              <div className="grid gap-2 text-right text-sm text-slate-500 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em]">Metode</div>
                  <div className="mt-1 font-semibold text-slate-900">{formData.mode === "TARGET_MARGIN" ? "Mål-avance" : "Markup"}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em]">Trin</div>
                  <div className="mt-1 font-semibold text-slate-900">{tiers.length} niveauer</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] uppercase tracking-[0.18em]">Spænd</div>
                  <div className="mt-1 font-semibold text-emerald-700">{minRate}% - {maxRate}%</div>
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
                      <SlidersHorizontal className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Profilramme</h3>
                      <p className="text-sm text-slate-500">Navn, beregningsmetode og afrundingslogik.</p>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="name">Profil-navn</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                        className="h-12 rounded-xl border-white/70 bg-slate-50 shadow-sm"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Metode</Label>
                      <Select value={formData.mode} onValueChange={(value) => setFormData({ ...formData, mode: value })}>
                        <SelectTrigger className="h-12 rounded-xl border-white/70 bg-slate-50 shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TARGET_MARGIN">Target Margin (%)</SelectItem>
                          <SelectItem value="MARKUP">Markup (%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rounding">Afrundingstrin</Label>
                      <div className="relative">
                        <Input
                          id="rounding"
                          type="number"
                          step="0.01"
                          value={formData.rounding_step}
                          onChange={(event) => setFormData({ ...formData, rounding_step: sanitizeNumber(event.target.value, 1) })}
                          className="h-12 rounded-xl border-white/70 bg-slate-50 pr-16 shadow-sm"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          kr
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Trin-basis</Label>
                      <Select value={formData.tier_basis} onValueChange={(value) => setFormData({ ...formData, tier_basis: value })}>
                        <SelectTrigger className="h-12 rounded-xl border-white/70 bg-slate-50 shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="QUANTITY">Antal (stk)</SelectItem>
                          <SelectItem value="AREA">Areal (m²)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>

                <section className="rounded-[28px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6 shadow-sm">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">Pris-trapper</h3>
                        <p className="text-sm text-slate-500">Byg trinene som den kommercielle logik skal følge.</p>
                      </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addTier} className="gap-2 rounded-xl">
                      <Plus className="h-4 w-4" />
                      Tilføj trin
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {tiers.map((tier, index) => (
                      <div key={index} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm">
                        <div className="mb-4 flex items-center justify-between gap-4">
                          <div className="text-sm font-semibold text-slate-900">Trin {index + 1}</div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500"
                            onClick={() => removeTier(index)}
                            disabled={tiers.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr]">
                          <div className="space-y-2">
                            <Label>{formData.tier_basis === "QUANTITY" ? "Antal fra" : "Areal fra"}</Label>
                            <Input
                              type="number"
                              value={tier.qty_from}
                              onChange={(event) => updateTier(index, "qty_from", sanitizeNumber(event.target.value, 1))}
                              className="h-11 rounded-xl border-white/70 bg-slate-50 shadow-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{formData.tier_basis === "QUANTITY" ? "Antal til" : "Areal til"}</Label>
                            <Input
                              type="number"
                              value={tier.qty_to || ""}
                              onChange={(event) => updateTier(index, "qty_to", event.target.value ? sanitizeNumber(event.target.value) : null)}
                              placeholder="∞"
                              className="h-11 rounded-xl border-white/70 bg-slate-50 shadow-sm"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>{formData.mode === "TARGET_MARGIN" ? "Margin %" : "Markup %"}</Label>
                            <div className="relative">
                              <Input
                                type="number"
                                value={tier.value}
                                onChange={(event) => updateTier(index, "value", sanitizeNumber(event.target.value))}
                                className="h-11 rounded-xl border-white/70 bg-slate-50 pr-12 shadow-sm"
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                %
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
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
                        <div className="font-semibold text-slate-900">{formData.name || "Unavngiven margin-profil"}</div>
                        <div className="text-xs text-slate-500">{formData.mode === "TARGET_MARGIN" ? "Mål-avance" : "Markup"}</div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-700">Spænd i profil</div>
                      <div className="mt-1 text-2xl font-semibold text-slate-900">{minRate}% - {maxRate}%</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Afrunding</div>
                      <div className="mt-1 text-xl font-semibold text-slate-900">{Number(formData.rounding_step || 0).toFixed(2)} kr</div>
                    </div>
                    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                      <div className="flex items-center gap-2 font-semibold text-violet-800">
                        <BadgeCheck className="h-4 w-4" />
                        Salgslogik
                      </div>
                      <div className="mt-1 text-xs leading-relaxed text-violet-900/80">
                        Profilen beregner {formData.mode === "TARGET_MARGIN" ? "mål-avance" : "markup"} ud fra {formData.tier_basis === "QUANTITY" ? "antal" : "areal"} og afrunder til nærmeste {Number(formData.rounding_step || 0).toFixed(2)} kr.
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 bg-white px-6 py-4 sm:justify-between">
            <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
              {initialProfile?.id ? "Opdatering af eksisterende profil" : "Ny margin-profil"}
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
