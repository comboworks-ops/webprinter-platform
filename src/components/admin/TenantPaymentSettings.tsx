import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, RefreshCw, CreditCard, Plug, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { loadConnect } from "@stripe/connect-js";
import { supabase } from "@/integrations/supabase/client";
import { useTenantPaymentSettings } from "@/hooks/useTenantPaymentSettings";

const STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  not_connected: {
    label: "Ikke forbundet",
    className: "border-slate-200 bg-slate-50 text-slate-700",
  },
  pending: {
    label: "Mangler oplysninger",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  restricted: {
    label: "Begrænset",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  connected: {
    label: "Aktiv",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  disabled: {
    label: "Deaktiveret",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

export default function TenantPaymentSettings() {
  const { data, isLoading, tenantId, refetch, upsert } = useTenantPaymentSettings();
  const [connectLoading, setConnectLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [connectClientSecret, setConnectClientSecret] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [feePercent, setFeePercent] = useState<string>("");
  const [feeFlat, setFeeFlat] = useState<string>("");
  const connectContainerRef = useRef<HTMLDivElement | null>(null);

  const status = data?.status || "not_connected";
  const statusMeta = STATUS_META[status] || STATUS_META.not_connected;

  useEffect(() => {
    setFeePercent(data?.platform_fee_percent?.toString() ?? "");
    setFeeFlat(data?.platform_fee_flat_ore?.toString() ?? "");
  }, [data?.platform_fee_percent, data?.platform_fee_flat_ore]);

  useEffect(() => {
    if (!connectClientSecret || !connectContainerRef.current) return;

    let isMounted = true;

    const init = async () => {
      const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
      if (!publishableKey) {
        setConnectError("Mangler VITE_STRIPE_PUBLISHABLE_KEY i miljøet.");
        return;
      }

      try {
        setConnectError(null);
        connectContainerRef.current!.innerHTML = "";
        const connectWrapper = await loadConnect();
        if (!connectWrapper || !isMounted) return;

        const connectInstance = connectWrapper.initialize({
          publishableKey,
          clientSecret: connectClientSecret,
        });

        if (!connectInstance) {
          setConnectError("Stripe Connect kunne ikke initialiseres. Kontroller public key og prøv igen.");
          return;
        }

        const element = connectInstance.create("account-onboarding");
        if (element && connectContainerRef.current) {
          connectContainerRef.current.appendChild(element);
        } else {
          setConnectError("Stripe onboarding kunne ikke indlæses. Prøv at genindlæse siden.");
        }
      } catch (error: any) {
        setConnectError(error?.message || "Kunne ikke indlæse Stripe onboarding.");
      }
    };

    init();

    return () => {
      isMounted = false;
      if (connectContainerRef.current) {
        connectContainerRef.current.innerHTML = "";
      }
    };
  }, [connectClientSecret]);

  const handleConnect = async () => {
    if (!tenantId) return;
    setConnectLoading(true);
    try {
      const { error: accountError } = await supabase.functions.invoke("stripe-connect-create-or-get", {
        body: { tenant_id: tenantId },
      });
      if (accountError) {
        const details = await (accountError as any)?.context?.json?.().catch(() => null);
        throw new Error(details?.error || accountError.message);
      }

      const { data: sessionData, error: sessionError } = await supabase.functions.invoke(
        "stripe-connect-account-session",
        { body: { tenant_id: tenantId } }
      );
      if (sessionError) {
        const details = await (sessionError as any)?.context?.json?.().catch(() => null);
        throw new Error(details?.error || sessionError.message);
      }

      setConnectClientSecret(sessionData?.client_secret || null);
      toast.success("Stripe onboarding åbnet.");
    } catch (error: any) {
      console.error("Stripe connect error:", error);
      toast.error(error?.message || "Kunne ikke oprette Stripe forbindelse.");
    } finally {
      setConnectLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!tenantId) return;
    setStatusLoading(true);
    try {
      const { error } = await supabase.functions.invoke("stripe-connect-sync-status", {
        body: { tenant_id: tenantId },
      });
      if (error) {
        const details = await (error as any)?.context?.json?.().catch(() => null);
        throw new Error(details?.error || error.message);
      }
      await refetch();
      toast.success("Status opdateret.");
    } catch (error: any) {
      console.error("Stripe status sync error:", error);
      toast.error(error?.message || "Kunne ikke opdatere status.");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!tenantId) return;
    setStatusLoading(true);
    try {
      const { error } = await supabase.functions.invoke("stripe-connect-disable", {
        body: { tenant_id: tenantId },
      });
      if (error) {
        const details = await (error as any)?.context?.json?.().catch(() => null);
        throw new Error(details?.error || error.message);
      }
      await refetch();
      toast.success("Stripe er deaktiveret.");
    } catch (error: any) {
      console.error("Stripe disable error:", error);
      toast.error(error?.message || "Kunne ikke deaktivere Stripe.");
    } finally {
      setStatusLoading(false);
    }
  };

  const feeSummary = useMemo(() => {
    const percentValue = Number(feePercent);
    const flatValue = Number(feeFlat);
    const percentText = Number.isFinite(percentValue) && feePercent !== "" ? `${percentValue}%` : "0%";
    const flatText = Number.isFinite(flatValue) && feeFlat !== "" ? `${flatValue} øre` : "0 øre";
    return `${percentText} + ${flatText}`;
  }, [feePercent, feeFlat]);

  const handleSaveFees = async () => {
    if (!tenantId) return;
    try {
      const percentValue = feePercent === "" ? null : Math.min(30, Math.max(0, Number(feePercent)));
      const flatValue = feeFlat === "" ? null : Math.max(0, Math.round(Number(feeFlat)));

      await upsert.mutateAsync({
        tenant_id: tenantId,
        platform_fee_percent: Number.isFinite(percentValue ?? NaN) ? percentValue : null,
        platform_fee_flat_ore: Number.isFinite(flatValue ?? NaN) ? flatValue : null,
      });

      toast.success("Platformgebyr gemt.");
    } catch (error: any) {
      console.error("Fee update error:", error);
      toast.error(error?.message || "Kunne ikke gemme platformgebyr.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Betaling</h1>
        <p className="text-muted-foreground">
          Stripe onboarding foregår i Webprinter og kræver e-mailbekræftelse hos Stripe.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Stripe
            </CardTitle>
            <CardDescription>Forbind Stripe for at modtage betalinger direkte til din konto.</CardDescription>
          </div>
          <Badge variant="outline" className={statusMeta.className}>
            {statusMeta.label}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div className="flex items-center gap-2">
              {data?.charges_enabled ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-amber-600" />
              )}
              <span>Charges: {data?.charges_enabled ? "Aktiveret" : "Ikke aktiveret"}</span>
            </div>
            <div className="flex items-center gap-2">
              {data?.payouts_enabled ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-amber-600" />
              )}
              <span>Udbetalinger: {data?.payouts_enabled ? "Aktiveret" : "Ikke aktiveret"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                Sidst synkroniseret:{" "}
                {data?.updated_at ? new Date(data.updated_at).toLocaleString("da-DK") : "Ikke synkroniseret"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(status === "not_connected" || status === "disabled") && (
              <Button onClick={handleConnect} disabled={connectLoading || !tenantId}>
                {connectLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Forbind Stripe
              </Button>
            )}

            {(status === "pending" || status === "restricted") && (
              <Button onClick={handleConnect} disabled={connectLoading || !tenantId}>
                {connectLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Fortsæt opsætning
              </Button>
            )}

            {status === "connected" && (
              <>
                <Button onClick={handleConnect} variant="secondary" disabled={connectLoading || !tenantId}>
                  {connectLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Administrér
                </Button>
                <Button onClick={handleDisable} variant="outline" disabled={statusLoading || !tenantId}>
                  Deaktiver
                </Button>
              </>
            )}

            <Button onClick={handleRefreshStatus} variant="ghost" disabled={statusLoading || !tenantId}>
              {statusLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Opdater status
            </Button>
          </div>

          {connectError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {connectError}
            </div>
          )}

          {connectClientSecret && (
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                <Plug className="h-4 w-4" />
                Stripe onboarding
              </div>
              <div ref={connectContainerRef} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platformgebyr</CardTitle>
          <CardDescription>
            Angiv det gebyr platformen lægger oveni ordren. Standard er 0.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="feePercent">Procent (0-30)</Label>
              <Input
                id="feePercent"
                type="number"
                min="0"
                max="30"
                step="0.1"
                value={feePercent}
                onChange={(event) => setFeePercent(event.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feeFlat">Fast beløb (øre)</Label>
              <Input
                id="feeFlat"
                type="number"
                min="0"
                step="1"
                value={feeFlat}
                onChange={(event) => setFeeFlat(event.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Aktuel opsætning: {feeSummary}</span>
            <Button onClick={handleSaveFees} disabled={upsert.isPending || !tenantId}>
              {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gem platformgebyr
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
