import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CreditCard, Check, Zap, Crown, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PRICING_TIERS, formatPrice } from '@/lib/platform/pricing';
import { useTenantSubscription, type TenantSubscription } from '@/hooks/useTenantSubscription';

const STATUS_META: Record<string, { label: string; className: string }> = {
    inactive: { label: 'Ikke aktiveret', className: 'border-slate-200 bg-slate-50 text-slate-700' },
    trialing: { label: 'Prøveperiode', className: 'border-sky-200 bg-sky-50 text-sky-700' },
    active: { label: 'Aktiv', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
    past_due: { label: 'Forfalden', className: 'border-amber-200 bg-amber-50 text-amber-700' },
    canceled: { label: 'Opsagt', className: 'border-slate-200 bg-slate-50 text-slate-700' },
    unpaid: { label: 'Ubetalt', className: 'border-red-200 bg-red-50 text-red-700' },
    incomplete: { label: 'Afventer betaling', className: 'border-amber-200 bg-amber-50 text-amber-700' },
    incomplete_expired: { label: 'Udløbet', className: 'border-red-200 bg-red-50 text-red-700' },
    paused: { label: 'Sat på pause', className: 'border-slate-200 bg-slate-50 text-slate-700' },
};

function formatDate(value: string | null) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('da-DK');
}

async function invokeFunction<T>(name: string, body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke(name, { body });

    if (error) {
        const details = await (error as any)?.context?.json?.().catch(() => null);
        throw new Error(details?.error || error.message || 'Ukendt fejl');
    }

    return data as T;
}

function getCurrentPlan(subscription: TenantSubscription | undefined) {
    if (!subscription || subscription.plan_id === 'free') {
        return {
            name: 'Gratis',
            priceText: '0 kr/måned',
            icon: <Zap className="h-6 w-6 text-primary" />,
        };
    }

    const tier = PRICING_TIERS.find((entry) => entry.id === subscription.plan_id);
    const priceText = subscription.billing_cycle === 'yearly'
        ? `${formatPrice(tier?.yearlyPrice || 0)}/år`
        : `${formatPrice(tier?.monthlyPrice || 0)}/måned`;

    return {
        name: tier?.name || subscription.plan_id,
        priceText,
        icon: <Crown className="h-6 w-6 text-primary" />,
    };
}

export function SubscriptionSettings() {
    const { data, isLoading, tenantId, refetch } = useTenantSubscription();
    const [searchParams, setSearchParams] = useSearchParams();
    const [isYearly, setIsYearly] = useState(false);
    const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
    const [portalLoading, setPortalLoading] = useState(false);

    useEffect(() => {
        if (data?.billing_cycle === 'yearly') {
            setIsYearly(true);
        }
    }, [data?.billing_cycle]);

    useEffect(() => {
        const checkoutState = searchParams.get('checkout');
        if (!checkoutState) return;

        if (checkoutState === 'success') {
            toast.success('Stripe checkout er gennemført. Abonnementet opdateres, når Stripe webhooken er færdig.');
            void refetch();
        } else if (checkoutState === 'cancelled') {
            toast.message('Stripe checkout blev annulleret.');
        }

        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('checkout');
        setSearchParams(nextParams, { replace: true });
    }, [refetch, searchParams, setSearchParams]);

    const subscription = data;
    const statusMeta = STATUS_META[subscription?.status || 'inactive'] || STATUS_META.inactive;
    const currentPlan = getCurrentPlan(subscription);
    const nextBilling = formatDate(subscription?.current_period_end || null);
    const trialEnd = formatDate(subscription?.trial_end || null);
    const hasStripeCustomer = Boolean(subscription?.stripe_customer_id);
    const hasManagedSubscription = Boolean(
        subscription?.stripe_subscription_id && ['trialing', 'active', 'past_due', 'unpaid', 'paused'].includes(subscription.status)
    );

    const headerDescription = useMemo(() => {
        if (!subscription || subscription.plan_id === 'free') {
            return 'Din tenant er oprettet. Vælg en plan for at starte prøveperioden i Stripe.';
        }
        if (subscription.status === 'trialing' && trialEnd) {
            return `Prøveperioden er aktiv indtil ${trialEnd}.`;
        }
        if (subscription.status === 'active' && nextBilling) {
            return `Næste fakturering sker ${nextBilling}.`;
        }
        if (subscription.status === 'past_due') {
            return 'Der er et udestående beløb. Åbn Stripe for at opdatere betaling eller kort.';
        }
        return 'Administrer dit platformabonnement og fakturering her.';
    }, [nextBilling, subscription, trialEnd]);

    const handleStartCheckout = async (planId: string) => {
        if (!tenantId) {
            toast.error('Kunne ikke finde tenant til abonnement.');
            return;
        }

        setCheckoutPlanId(planId);
        try {
            const billingCycle = isYearly ? 'yearly' : 'monthly';
            const data = await invokeFunction<{ url?: string }>('stripe-subscription-create-checkout', {
                tenant_id: tenantId,
                plan_id: planId,
                billing_cycle: billingCycle,
                success_url: `${window.location.origin}/admin/abonnement?checkout=success`,
                cancel_url: `${window.location.origin}/admin/abonnement?checkout=cancelled`,
            });

            if (!data?.url) {
                throw new Error('Stripe returnerede ikke en checkout-url.');
            }

            window.location.assign(data.url);
        } catch (error: any) {
            console.error('Subscription checkout error:', error);
            toast.error(error?.message || 'Kunne ikke starte abonnement checkout.');
        } finally {
            setCheckoutPlanId(null);
        }
    };

    const handleOpenPortal = async () => {
        if (!tenantId) {
            toast.error('Kunne ikke finde tenant til abonnement.');
            return;
        }

        setPortalLoading(true);
        try {
            const data = await invokeFunction<{ url?: string }>('stripe-subscription-create-portal', {
                tenant_id: tenantId,
                return_url: `${window.location.origin}/admin/abonnement`,
            });

            if (!data?.url) {
                throw new Error('Stripe returnerede ikke en portal-url.');
            }

            window.location.assign(data.url);
        } catch (error: any) {
            console.error('Subscription portal error:', error);
            toast.error(error?.message || 'Kunne ikke åbne Stripe portal.');
        } finally {
            setPortalLoading(false);
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
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Abonnement</h1>
                <p className="text-muted-foreground">{headerDescription}</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Dit Nuværende Abonnement
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                {currentPlan.icon}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">{currentPlan.name}</h3>
                                <p className="text-muted-foreground">{currentPlan.priceText}</p>
                            </div>
                        </div>

                        <div className="space-y-2 text-left sm:text-right">
                            <Badge variant="outline" className={statusMeta.className}>
                                {statusMeta.label}
                            </Badge>
                            {trialEnd && subscription?.status === 'trialing' && (
                                <p className="text-sm text-muted-foreground">Prøveperiode til {trialEnd}</p>
                            )}
                            {nextBilling && subscription?.status !== 'trialing' && (
                                <p className="text-sm text-muted-foreground">Næste fakturering: {nextBilling}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => void refetch()} disabled={!tenantId}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Opdater status
                        </Button>

                        {(hasManagedSubscription || hasStripeCustomer) && (
                            <Button onClick={handleOpenPortal} disabled={portalLoading || !tenantId}>
                                {portalLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {!portalLoading && <ExternalLink className="mr-2 h-4 w-4" />}
                                Administrér i Stripe
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Tilgængelige Planer</CardTitle>
                    <CardDescription>Vælg den plan der passer til din virksomhed. Checkout åbner i Stripe.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-center gap-3">
                        <Label htmlFor="tenant-billing-toggle" className={!isYearly ? 'font-semibold' : 'text-muted-foreground'}>
                            Månedlig
                        </Label>
                        <Switch
                            id="tenant-billing-toggle"
                            checked={isYearly}
                            onCheckedChange={setIsYearly}
                        />
                        <Label htmlFor="tenant-billing-toggle" className={isYearly ? 'font-semibold' : 'text-muted-foreground'}>
                            Årlig <span className="text-green-600 text-sm">(spar 17%)</span>
                        </Label>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                        {PRICING_TIERS.map((plan) => {
                            const isCurrentPlan = subscription?.plan_id === plan.id && ['trialing', 'active', 'past_due', 'unpaid', 'paused'].includes(subscription.status);
                            const displayPrice = isYearly ? `${formatPrice(plan.yearlyPrice)}/år` : `${formatPrice(plan.monthlyPrice)}/måned`;
                            const checkoutLoading = checkoutPlanId === plan.id;

                            return (
                                <div
                                    key={plan.id}
                                    className={`relative rounded-xl border-2 p-6 transition-all ${
                                        isCurrentPlan
                                            ? 'border-primary bg-primary/5'
                                            : 'border-muted hover:border-primary/50'
                                    }`}
                                >
                                    {plan.highlighted && (
                                        <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
                                            Mest populær
                                        </Badge>
                                    )}

                                    <div className="mb-4 flex items-center gap-2">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                            {plan.id === 'enterprise' ? <Crown className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
                                        </div>
                                        <h3 className="text-lg font-bold">{plan.name}</h3>
                                    </div>

                                    <div className="mb-4">
                                        <span className="text-3xl font-bold">{displayPrice}</span>
                                        {isYearly && (
                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Svarer til {formatPrice(Math.round(plan.yearlyPrice / 12))}/måned ved årsbetaling
                                            </p>
                                        )}
                                    </div>

                                    <ul className="mb-6 space-y-2">
                                        {plan.features.map((feature) => (
                                            <li key={feature} className="flex items-center gap-2 text-sm">
                                                <Check className="h-4 w-4 flex-shrink-0 text-green-500" />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>

                                    <Button
                                        variant={isCurrentPlan ? 'outline' : 'default'}
                                        className="w-full"
                                        disabled={checkoutLoading || isCurrentPlan || !tenantId}
                                        onClick={() => void handleStartCheckout(plan.id)}
                                    >
                                        {checkoutLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {isCurrentPlan ? 'Nuværende plan' : 'Vælg plan'}
                                    </Button>
                                </div>
                            );
                        })}
                    </div>

                    <div className="rounded-lg border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                        Når du vælger en plan, åbner vi Stripe Checkout. Den 14 dages prøveperiode starter først, når checkout er gennemført.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default SubscriptionSettings;
