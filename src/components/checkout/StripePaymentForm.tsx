
import { type FormEvent, useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions, type Stripe } from "@stripe/stripe-js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface StripePaymentFormProps {
    clientSecret: string;
    amount: number;
    currency: string;
    onSuccess: (paymentIntentId: string) => void;
    onCancel: () => void;
    connectedAccountId?: string | null;
}

const stripePromiseCache: Record<string, Promise<Stripe | null>> = {};

function getStripePromise(publishableKey: string, connectedAccountId?: string | null) {
    const trimmedAccountId = connectedAccountId?.trim() || "";
    const cacheKey = trimmedAccountId || "platform";

    if (!stripePromiseCache[cacheKey]) {
        stripePromiseCache[cacheKey] = loadStripe(
            publishableKey,
            trimmedAccountId ? { stripeAccount: trimmedAccountId } : undefined,
        );
    }

    return stripePromiseCache[cacheKey];
}

function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat("da-DK", {
        style: "currency",
        currency: currency.toUpperCase(),
        maximumFractionDigits: 2,
    }).format(amount);
}

function StripePaymentFormInner({
    amount,
    currency,
    onSuccess,
    onCancel,
}: Omit<StripePaymentFormProps, "clientSecret" | "connectedAccountId">) {
    const stripe = useStripe();
    const elements = useElements();
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setSubmitting(true);

        try {
            const result = await stripe.confirmPayment({
                elements,
                redirect: "if_required",
            });

            if (result.error) {
                toast.error(result.error.message || "Betalingen kunne ikke gennemfores.");
                return;
            }

            if (result.paymentIntent?.status === "succeeded") {
                onSuccess(result.paymentIntent.id);
                return;
            }

            if (result.paymentIntent?.status === "processing") {
                toast.success("Betalingen behandles. Du modtager en bekræftelse snart.");
                onSuccess(result.paymentIntent.id);
                return;
            }

            toast.error("Betalingen blev ikke fuldfort. Proev et andet kort.");
        } catch (error: any) {
            toast.error(error?.message || "Der skete en fejl under betalingen.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Card className="shadow-2xl">
            <CardHeader>
                <CardTitle>Betaling</CardTitle>
                <CardDescription>
                    Total: {formatCurrency(amount, currency)}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <PaymentElement />
                    <div className="grid grid-cols-1 gap-2">
                        <Button type="submit" disabled={!stripe || !elements || submitting}>
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Behandler betaling...
                                </>
                            ) : (
                                "Betal nu"
                            )}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                            disabled={submitting}
                        >
                            Annuller
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

export function StripePaymentForm({
    clientSecret,
    amount,
    currency,
    onSuccess,
    onCancel,
    connectedAccountId,
}: StripePaymentFormProps) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

    const stripePromise = useMemo(() => {
        if (!publishableKey) return null;
        return getStripePromise(publishableKey, connectedAccountId);
    }, [publishableKey, connectedAccountId]);

    const options = useMemo<StripeElementsOptions>(() => ({
        clientSecret,
        locale: "da",
        appearance: {
            theme: "stripe",
        },
    }), [clientSecret]);

    if (!publishableKey) {
        return (
            <Card className="shadow-2xl border-red-200">
                <CardHeader>
                    <CardTitle className="text-red-700">Stripe er ikke konfigureret</CardTitle>
                    <CardDescription>
                        Miljo-variablen <code>VITE_STRIPE_PUBLISHABLE_KEY</code> mangler.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    if (!stripePromise) {
        return (
            <Card className="shadow-2xl border-red-200">
                <CardHeader>
                    <CardTitle className="text-red-700">Stripe kunne ikke initialiseres</CardTitle>
                    <CardDescription>
                        Proev at genindlaese siden eller kontakt support.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Elements
            stripe={stripePromise}
            options={options}
            key={`${connectedAccountId || "platform"}:${clientSecret}`}
        >
            <StripePaymentFormInner
                amount={amount}
                currency={currency}
                onSuccess={onSuccess}
                onCancel={onCancel}
            />
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Betaling behandles sikkert af Stripe.</span>
            </div>
        </Elements>
    );
}
