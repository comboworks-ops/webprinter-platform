// POD Billing - Tenant payment method setup for off-session charging

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { usePodTenantBilling } from "@/lib/pod/hooks";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PodBetaling() {
    const [tenantId, setTenantId] = useState<string | null>(null);

    useEffect(() => {
        resolveAdminTenant().then(({ tenantId: tid }) => setTenantId(tid));
    }, []);

    const { data: billing, isLoading, refetch } = usePodTenantBilling(tenantId || undefined);

    const [setupLoading, setSetupLoading] = useState(false);
    const [stripeLoaded, setStripeLoaded] = useState(false);
    const [showCardInput, setShowCardInput] = useState(false);

    // Check if billing is ready
    const isReady = billing?.is_ready && billing?.default_payment_method_id;

    const handleSetupPayment = async () => {
        setSetupLoading(true);

        try {
            // Call edge function to create SetupIntent
            const { data, error } = await supabase.functions.invoke("pod-tenant-billing-setup", {});

            if (error) throw error;
            if (!data?.clientSecret) throw new Error("No client secret returned");

            // For production, you would use Stripe.js to handle the SetupIntent
            // Here we'll show a simplified flow - in real implementation, mount Stripe Elements

            toast.info("SetupIntent oprettet. I produktion ville Stripe Elements vises her.");

            // Simulate saving payment method (in production this happens via Stripe callback)
            // For now, we'll just mark as ready for demo purposes
            const { error: updateError } = await supabase
                .from("pod_tenant_billing" as any)
                .update({
                    is_ready: true,
                    default_payment_method_id: "pm_demo_" + Date.now(),
                    updated_at: new Date().toISOString(),
                })
                .eq("tenant_id", tenantId);

            if (updateError) throw updateError;

            toast.success("Betalingsmetode konfigureret (demo)");
            refetch();
        } catch (err: any) {
            console.error("Setup error:", err);
            toast.error("Kunne ikke opsætte betaling: " + err.message);
        } finally {
            setSetupLoading(false);
        }
    };

    const handleRemovePayment = async () => {
        if (!confirm("Er du sikker på at du vil fjerne betalingsmetoden?")) return;

        try {
            const { error } = await supabase
                .from("pod_tenant_billing" as any)
                .update({
                    is_ready: false,
                    default_payment_method_id: null,
                    updated_at: new Date().toISOString(),
                })
                .eq("tenant_id", tenantId);

            if (error) throw error;

            toast.success("Betalingsmetode fjernet");
            refetch();
        } catch (err: any) {
            toast.error("Kunne ikke fjerne betalingsmetode: " + err.message);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">POD Betaling</h1>
                <p className="text-muted-foreground">
                    Konfigurer betalingsmetode for automatisk afregning af POD jobs
                </p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="max-w-2xl space-y-6">
                    {/* Current Status */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                Betalingsstatus
                            </CardTitle>
                            <CardDescription>
                                Din betalingsmetode bruges til at afregne POD jobs automatisk
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4">
                                {isReady ? (
                                    <>
                                        <div className="flex items-center gap-2 text-green-600">
                                            <CheckCircle className="h-5 w-5" />
                                            <span className="font-medium">Betalingsmetode aktiv</span>
                                        </div>
                                        <Badge variant="outline">
                                            {billing?.default_payment_method_id?.slice(0, 12)}...
                                        </Badge>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2 text-yellow-600">
                                        <AlertCircle className="h-5 w-5" />
                                        <span className="font-medium">Ingen betalingsmetode konfigureret</span>
                                    </div>
                                )}
                            </div>

                            {billing?.stripe_customer_id && (
                                <p className="text-sm text-muted-foreground mt-3">
                                    Stripe kunde: {billing.stripe_customer_id}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Setup Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {isReady ? "Opdater betalingsmetode" : "Tilføj betalingsmetode"}
                            </CardTitle>
                            <CardDescription>
                                Tilføj et betalingskort der bruges til automatisk afregning når du godkender POD jobs.
                                Kortet debiteres først når du aktivt godkender et job.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-6 border-2 border-dashed rounded-lg text-center">
                                <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                                <p className="text-sm text-muted-foreground mb-4">
                                    {isReady
                                        ? "Du har allerede en betalingsmetode konfigureret. Klik nedenfor for at opdatere."
                                        : "Klik nedenfor for at tilføje et kort via Stripe."
                                    }
                                </p>

                                <div className="flex gap-3 justify-center">
                                    <Button onClick={handleSetupPayment} disabled={setupLoading}>
                                        {setupLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <CreditCard className="h-4 w-4 mr-2" />
                                        )}
                                        {isReady ? "Opdater kort" : "Tilføj kort"}
                                    </Button>

                                    {isReady && (
                                        <Button variant="outline" onClick={handleRemovePayment}>
                                            Fjern kort
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Info Box */}
                            <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                                <h4 className="font-medium text-blue-900 mb-2">Sådan fungerer POD betaling</h4>
                                <ul className="text-sm text-blue-800 space-y-1">
                                    <li>• Når en kunde bestiller et POD-produkt, oprettes et job</li>
                                    <li>• Du ser jobbet i "POD Ordrer" og godkender det</li>
                                    <li>• Ved godkendelse trækkes din pris automatisk fra kortet</li>
                                    <li>• Jobbet sendes derefter til leverandøren</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Recent Transactions - Placeholder */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Seneste transaktioner</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-center py-8 text-muted-foreground">
                                Ingen transaktioner endnu
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

export default PodBetaling;
