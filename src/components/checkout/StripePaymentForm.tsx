import { useState } from "react";
import {
    Elements,
    PaymentElement,
    useStripe,
    useElements,
} from "@stripe/react-stripe-js";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CreditCard, Lock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const stripePromise = loadStripe(
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ""
);

interface PaymentFormProps {
    clientSecret: string;
    amount: number;
    currency?: string;
    onSuccess: (paymentIntentId: string) => void;
    onCancel: () => void;
    connectedAccountId?: string | null;
}

function CheckoutForm({
    amount,
    onSuccess,
    onCancel,
}: {
    amount: number;
    onSuccess: (paymentIntentId: string) => void;
    onCancel: () => void;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);
    const [isComplete, setIsComplete] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsProcessing(true);

        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: window.location.origin + "/ordre-bekraeftelse",
                },
                redirect: "if_required",
            });

            if (error) {
                if (error.type === "card_error" || error.type === "validation_error") {
                    toast.error(error.message || "Der opstod en fejl med dit kort.");
                } else {
                    toast.error("Der opstod en uventet fejl. Prøv igen.");
                }
            } else if (paymentIntent && paymentIntent.status === "succeeded") {
                setIsComplete(true);
                toast.success("Betaling gennemført!");
                onSuccess(paymentIntent.id);
            } else if (paymentIntent && paymentIntent.status === "requires_action") {
                toast.info("Yderligere bekræftelse påkrævet...");
            }
        } catch (err) {
            console.error("Payment error:", err);
            toast.error("Der opstod en fejl under betalingen.");
        } finally {
            setIsProcessing(false);
        }
    };

    if (isComplete) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-green-800 mb-2">
                    Betaling gennemført!
                </h3>
                <p className="text-muted-foreground">
                    Vi behandler din ordre nu.
                </p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-slate-50 rounded-lg p-4 border">
                <PaymentElement
                    options={{
                        layout: "tabs",
                    }}
                />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span>Sikker betaling via Stripe. Dine kortoplysninger gemmes ikke hos os.</span>
            </div>

            <div className="flex gap-3">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    disabled={isProcessing}
                    className="flex-1"
                >
                    Annuller
                </Button>
                <Button
                    type="submit"
                    disabled={!stripe || isProcessing}
                    className="flex-1 h-12 text-lg font-bold"
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Behandler...
                        </>
                    ) : (
                        <>
                            Betal {amount.toLocaleString("da-DK")} kr
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
}

export function StripePaymentForm({
    clientSecret,
    amount,
    currency = "dkk",
    onSuccess,
    onCancel,
    connectedAccountId,
}: PaymentFormProps) {
    const options: StripeElementsOptions = {
        clientSecret,
        appearance: {
            theme: "stripe",
            variables: {
                colorPrimary: "#0ea5e9",
                colorBackground: "#ffffff",
                colorText: "#1e293b",
                colorDanger: "#ef4444",
                fontFamily: "system-ui, sans-serif",
                borderRadius: "8px",
            },
        },
        locale: "da",
    };

    // For connected accounts, we need to pass the account ID
    const stripeOptions = connectedAccountId
        ? { stripeAccount: connectedAccountId }
        : undefined;

    return (
        <Card className="w-full max-w-md mx-auto shadow-xl border-2">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">Kortbetaling</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {amount.toLocaleString("da-DK")} {currency.toUpperCase()}
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Elements
                    stripe={
                        connectedAccountId
                            ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "", {
                                stripeAccount: connectedAccountId,
                            })
                            : stripePromise
                    }
                    options={options}
                >
                    <CheckoutForm
                        amount={amount}
                        onSuccess={onSuccess}
                        onCancel={onCancel}
                    />
                </Elements>
            </CardContent>
        </Card>
    );
}

export default StripePaymentForm;
