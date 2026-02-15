import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Crown, CreditCard, Loader2, RefreshCw, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenantSubscription, type TenantSubscriptionCycle, type TenantSubscriptionPlan } from "@/hooks/useTenantSubscription";

type PlanDef = {
  id: TenantSubscriptionPlan;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  popular?: boolean;
};

const PLAN_DEFS: PlanDef[] = [
  {
    id: "free",
    name: "Gratis",
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: ["Basis webshop", "Standard support", "1 admin bruger", "Webprinter subdomain"],
  },
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 299,
    yearlyPrice: 2990,
    features: ["Op til 10 produkter", "Basis support", "1 admin bruger", "Webprinter subdomain"],
  },
  {
    id: "professional",
    name: "Professional",
    monthlyPrice: 599,
    yearlyPrice: 5990,
    features: ["Ubegrænsede produkter", "Prioriteret support", "5 admin brugere", "Eget domæne", "Avanceret statistik"],
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: 1499,
    yearlyPrice: 14990,
    features: ["Alt i Professional", "Dedikeret support", "Ubegrænsede brugere", "API adgang", "White-label emails", "Custom integration"],
  },
];

const STATUS_LABELS: Record<string, string> = {
  inactive: "Inaktiv",
  trialing: "Prøveperiode",
  active: "Aktiv",
  past_due: "Forfalden",
  canceled: "Opsagt",
  unpaid: "Ubetalt",
  incomplete: "Afventer betaling",
  incomplete_expired: "Udløbet",
  paused: "Pauset",
};

function planDisplayName(planId: TenantSubscriptionPlan): string {
  return PLAN_DEFS.find((plan) => plan.id === planId)?.name || "Ukendt";
}

function formatDkk(value: number): string {
  return `${value.toLocaleString("da-DK")} kr`;
}

export function SubscriptionSettings() {
  const { tenantId, data, isLoading, refetch } = useTenantSubscription();
  const [billingCycle, setBillingCycle] = useState<TenantSubscriptionCycle>("monthly");
  const [checkoutLoadingPlan, setCheckoutLoadingPlan] = useState<TenantSubscriptionPlan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const currentPlan = data?.plan_id || "free";
  const currentStatus = data?.status || "inactive";

  const statusLabel = STATUS_LABELS[currentStatus] || currentStatus;
  const nextBilling = data?.current_period_end || null;
  const isCurrentSubscriptionLive = ["trialing", "active", "past_due"].includes(currentStatus);
  const hasPortalCustomer = !!data?.stripe_customer_id;

  const cycleText = useMemo(
    () => (billingCycle === "yearly" ? "år" : "md"),
    [billingCycle],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscriptionState = params.get("subscription");
    if (!subscriptionState) return;

    if (subscriptionState === "success") {
      toast.success("Checkout gennemført. Abonnement opdateres via Stripe webhook.");
    } else if (subscriptionState === "cancel") {
      toast.info("Checkout blev annulleret.");
    }

    refetch();

    params.delete("subscription");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [refetch]);

  const handleStartCheckout = async (planId: TenantSubscriptionPlan) => {
    if (!tenantId) return;
    if (planId === "free") {
      toast.info("Gratis-plan kræver ikke Stripe checkout.");
      return;
    }

    setCheckoutLoadingPlan(planId);
    try {
      const currentUrl = window.location.origin + "/admin/abonnement";
      const { data: response, error } = await supabase.functions.invoke("stripe-subscription-create-checkout", {
        body: {
          tenant_id: tenantId,
          plan_id: planId,
          billing_cycle: billingCycle,
          success_url: `${currentUrl}?subscription=success`,
          cancel_url: `${currentUrl}?subscription=cancel`,
        },
      });

      if (error) {
        const details = await (error as any)?.context?.json?.().catch(() => null);
        throw new Error(details?.error || error.message);
      }

      if (!response?.url) {
        throw new Error("Stripe checkout URL mangler.");
      }

      window.location.assign(response.url);
    } catch (err: any) {
      console.error("Subscription checkout error:", err);
      toast.error(err?.message || "Kunne ikke starte abonnement checkout.");
    } finally {
      setCheckoutLoadingPlan(null);
    }
  };

  const handleOpenBillingPortal = async () => {
    if (!tenantId) return;
    setPortalLoading(true);
    try {
      const { data: response, error } = await supabase.functions.invoke("stripe-subscription-create-portal", {
        body: {
          tenant_id: tenantId,
          return_url: window.location.origin + "/admin/abonnement",
        },
      });

      if (error) {
        const details = await (error as any)?.context?.json?.().catch(() => null);
        throw new Error(details?.error || error.message);
      }

      if (!response?.url) {
        throw new Error("Stripe portal URL mangler.");
      }

      window.location.assign(response.url);
    } catch (err: any) {
      console.error("Subscription portal error:", err);
      toast.error(err?.message || "Kunne ikke åbne Stripe billing portal.");
    } finally {
      setPortalLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">Abonnement</h1>
        <p className="text-muted-foreground">Administrer abonnement, fakturering og plan-opgraderinger.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Nuværende abonnement
            </CardTitle>
            <CardDescription>Stripe-status for den aktive tenant.</CardDescription>
          </div>
          <Badge variant="outline">{statusLabel}</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4 bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                {currentPlan === "free" ? (
                  <Zap className="h-5 w-5 text-primary" />
                ) : (
                  <Crown className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <p className="font-semibold">{planDisplayName(currentPlan)}</p>
                <p className="text-sm text-muted-foreground">
                  {data?.billing_cycle === "yearly" ? "Årlig" : "Månedlig"} fakturering
                </p>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              {nextBilling ? (
                <p>Næste fakturering: {new Date(nextBilling).toLocaleDateString("da-DK")}</p>
              ) : (
                <p>Ingen aktiv faktureringsperiode</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Opdater status
            </Button>
            <Button
              variant="default"
              onClick={handleOpenBillingPortal}
              disabled={!hasPortalCustomer || portalLoading}
            >
              {portalLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Åbn Stripe Billing Portal
            </Button>
            {!hasPortalCustomer && (
              <p className="text-xs text-muted-foreground">
                Billing portal bliver tilgængelig efter første checkout.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vælg plan</CardTitle>
          <CardDescription>Vælg månedlig eller årlig fakturering og start checkout i Stripe.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="inline-flex rounded-lg border p-1 bg-muted/20">
            <Button
              size="sm"
              variant={billingCycle === "monthly" ? "default" : "ghost"}
              onClick={() => setBillingCycle("monthly")}
            >
              Månedlig
            </Button>
            <Button
              size="sm"
              variant={billingCycle === "yearly" ? "default" : "ghost"}
              onClick={() => setBillingCycle("yearly")}
            >
              Årlig
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {PLAN_DEFS.filter((plan) => plan.id !== "free").map((plan) => {
              const isCurrent = isCurrentSubscriptionLive && currentPlan === plan.id;
              const displayPrice = billingCycle === "yearly" ? Math.round(plan.yearlyPrice / 12) : plan.monthlyPrice;
              const savingText = billingCycle === "yearly" ? `Faktureres ${formatDkk(plan.yearlyPrice)}/år` : null;
              const isLoadingPlan = checkoutLoadingPlan === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border-2 p-5 transition-colors ${isCurrent ? "border-primary bg-primary/5" : "border-muted"}`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">Mest populær</Badge>
                  )}
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      {plan.id === "starter" ? <Zap className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
                    </div>
                    <p className="font-semibold">{plan.name}</p>
                  </div>

                  <div className="mb-4">
                    <p className="text-3xl font-bold">{formatDkk(displayPrice)}</p>
                    <p className="text-sm text-muted-foreground">/{cycleText}</p>
                    {savingText && <p className="text-xs text-muted-foreground mt-1">{savingText}</p>}
                  </div>

                  <ul className="mb-4 space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-emerald-600 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    onClick={() => handleStartCheckout(plan.id)}
                    disabled={isLoadingPlan}
                  >
                    {isLoadingPlan && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {isCurrent ? "Aktiv plan" : "Vælg plan"}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default SubscriptionSettings;
