import { useEffect, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { resolveAdminTenant, MASTER_TENANT_ID } from "@/lib/adminTenant";
import { supabase } from "@/integrations/supabase/client";
import { usePodTenantBilling } from "@/lib/pod2/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, CheckCircle, AlertCircle, Lock } from "lucide-react";
import { toast } from "sonner";

let stripePromise: ReturnType<typeof loadStripe> | null = null;
function getStripePromise() {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!key) return null;
    if (!stripePromise) {
        stripePromise = loadStripe(key);
    }
    return stripePromise;
}

function SetupForm({
    tenantId,
    onSuccess,
    onCancel,
}: {
    tenantId: string;
    onSuccess: () => void;
    onCancel: () => void;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!stripe || !elements) return;

        setIsProcessing(true);
        try {
            const { error, setupIntent } = await stripe.confirmSetup({
                elements,
                confirmParams: {
                    return_url: `${window.location.origin}/admin/pod2-betaling`,
                },
                redirect: "if_required",
            });

            if (error) {
                toast.error(error.message || "Kunne ikke gemme betalingskort.");
                return;
            }

            if (setupIntent?.status !== "succeeded") {
                toast.error("Kortopsætning blev ikke gennemført.");
                return;
            }

            const paymentMethodId =
                typeof setupIntent.payment_method === "string"
                    ? setupIntent.payment_method
                    : setupIntent.payment_method?.id;

            if (!paymentMethodId) {
                toast.error("Stripe returnerede ikke en betalingsmetode.");
                return;
            }

            const { error: updateError } = await (supabase
                .from("pod2_tenant_billing" as any)
                .update({
                    default_payment_method_id: paymentMethodId,
                    is_ready: true,
                    updated_at: new Date().toISOString(),
                })
                .eq("tenant_id", tenantId));

            if (updateError) throw updateError;

            toast.success("Betalingsmetode gemt for POD v2.");
            onSuccess();
        } catch (error: any) {
            toast.error(`Kunne ikke gemme betalingsmetode: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg border bg-slate-50 p-4">
                <PaymentElement options={{ layout: "tabs" }} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span>Kortoplysninger gemmes sikkert via Stripe til fremtidige POD v2 afregninger.</span>
            </div>
            <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={onCancel} disabled={isProcessing}>
                    Annuller
                </Button>
                <Button type="submit" className="flex-1" disabled={isProcessing || !stripe}>
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                    Gem kort
                </Button>
            </div>
        </form>
    );
}

export function Pod2Betaling() {
    const [tenantId, setTenantId] = useState<string | null>(null);
    const [isMasterContext, setIsMasterContext] = useState(false);
    const [setupLoading, setSetupLoading] = useState(false);
    const [clientSecret, setClientSecret] = useState<string | null>(null);

    useEffect(() => {
        resolveAdminTenant().then(({ tenantId: resolvedTenantId, isMasterAdmin }) => {
            setTenantId(resolvedTenantId);
            setIsMasterContext(Boolean(isMasterAdmin && resolvedTenantId === MASTER_TENANT_ID));
        });
    }, []);

    const { data: billing, isLoading, refetch } = usePodTenantBilling(tenantId || undefined);

    const isReady = Boolean(billing?.is_ready && billing?.default_payment_method_id);
    const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    const stripeInstance = useMemo(() => (stripeKey ? getStripePromise() : null), [stripeKey]);
    const stripeOptions = useMemo<StripeElementsOptions | undefined>(() => {
        if (!clientSecret) return undefined;
        return {
            clientSecret,
            appearance: {
                theme: "stripe",
                variables: {
                    colorPrimary: "#0ea5e9",
                    borderRadius: "8px",
                    colorBackground: "#ffffff",
                    colorText: "#1e293b",
                    fontFamily: "system-ui, sans-serif",
                },
            },
            locale: "da",
        };
    }, [clientSecret]);

    const handleSetupPayment = async () => {
        setSetupLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke("pod2-tenant-billing-setup", {});
            if (error) throw error;
            if (!data?.clientSecret) throw new Error("SetupIntent mangler client secret");
            setClientSecret(data.clientSecret);
        } catch (error: any) {
            toast.error(`Kunne ikke starte kortopsætning: ${error.message}`);
        } finally {
            setSetupLoading(false);
        }
    };

    const handleRemovePayment = async () => {
        if (!tenantId) return;
        if (!confirm("Vil du fjerne den gemte betalingsmetode for POD v2?")) return;

        const { error } = await (supabase
            .from("pod2_tenant_billing" as any)
            .update({
                default_payment_method_id: null,
                is_ready: false,
                updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", tenantId));

        if (error) {
            toast.error(`Kunne ikke fjerne betalingsmetode: ${error.message}`);
            return;
        }

        toast.success("Betalingsmetode fjernet.");
        setClientSecret(null);
        refetch();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (isMasterContext) {
        return (
            <div className="max-w-2xl space-y-6">
                <div>
                    <h1 className="text-3xl font-bold">POD v2 Betaling</h1>
                    <p className="text-muted-foreground">Master videresender jobs, men har ikke egen tenant-afregning her.</p>
                </div>
                <Card>
                    <CardContent className="py-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600" />
                            <div className="space-y-1">
                                <p className="font-medium">Denne side bruges kun i tenant-kontekst.</p>
                                <p className="text-sm text-muted-foreground">
                                    POD v2 afregning opsættes af den enkelte tenant. Master bruger i stedet siden
                                    <span className="font-medium"> POD v2 Ordrer</span> til at videresende betalte jobs til leverandøren.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h1 className="text-3xl font-bold">POD v2 Betaling</h1>
                <p className="text-muted-foreground">Gem et kort til automatisk afregning, når POD v2 jobs godkendes i tenant-shoppen.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Betalingsstatus
                    </CardTitle>
                    <CardDescription>Dette kort bruges kun til POD v2 leverandøromkostninger efter kundebetalingen er modtaget.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {isReady ? (
                        <div className="flex items-center gap-3 text-green-700">
                            <CheckCircle className="h-5 w-5" />
                            <span className="font-medium">Betalingsmetode aktiv</span>
                            <Badge variant="outline">{billing?.default_payment_method_id?.slice(0, 14)}...</Badge>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 text-amber-700">
                            <AlertCircle className="h-5 w-5" />
                            <span className="font-medium">Ingen betalingsmetode gemt endnu</span>
                        </div>
                    )}

                    {billing?.stripe_customer_id && (
                        <p className="text-sm text-muted-foreground">Stripe kunde: {billing.stripe_customer_id}</p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{clientSecret ? "Tilføj eller opdater kort" : "Klargør betalingsmetode"}</CardTitle>
                    <CardDescription>
                        Når du godkender et POD v2 job, trækkes tenantens leverandøromkostning automatisk. Kortet gemmes sikkert hos Stripe.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!stripeKey && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            VITE_STRIPE_PUBLISHABLE_KEY mangler. Kortopsætning kan ikke vises uden den.
                        </div>
                    )}

                    {!clientSecret ? (
                        <div className="rounded-lg border border-dashed p-6 text-center">
                            <CreditCard className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                            <p className="mb-4 text-sm text-muted-foreground">
                                Start kortopsætning for POD v2. Du kan opdatere kortet når som helst.
                            </p>
                            <div className="flex justify-center gap-3">
                                <Button onClick={handleSetupPayment} disabled={setupLoading || !tenantId || !stripeKey}>
                                    {setupLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                                    {isReady ? "Opdater kort" : "Tilføj kort"}
                                </Button>
                                {isReady && (
                                    <Button variant="outline" onClick={handleRemovePayment}>
                                        Fjern kort
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : stripeInstance && stripeOptions ? (
                        <Elements stripe={stripeInstance} options={stripeOptions}>
                            <SetupForm
                                tenantId={tenantId!}
                                onSuccess={() => {
                                    setClientSecret(null);
                                    refetch();
                                }}
                                onCancel={() => setClientSecret(null)}
                            />
                        </Elements>
                    ) : null}

                    <div className="rounded-lg border bg-blue-50 p-4 text-sm text-blue-900">
                        <p className="font-medium">Workflow</p>
                        <ul className="mt-2 space-y-1 text-blue-800">
                            <li>• Kunden betaler i tenant-shoppen.</li>
                            <li>• Tenant godkender POD v2 job og betaler leverandøromkostningen.</li>
                            <li>• Master videresender derefter jobbet til print-huset.</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default Pod2Betaling;
