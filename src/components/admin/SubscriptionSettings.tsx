import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Check, Zap, Crown, FileText, Download } from 'lucide-react';

export function SubscriptionSettings() {
    // Mock data
    const currentPlan = 'free';
    const billingCycle = 'monthly';
    const nextBilling: string | null = null;

    const plans = [
        {
            id: 'free',
            name: 'Gratis',
            price: 0,
            features: ['Basis webshop', 'Standard support', '1 admin bruger', 'Webprinter subdomain'],
            icon: <Zap className="h-5 w-5" />,
        },
        {
            id: 'starter',
            name: 'Starter',
            price: 299,
            features: ['Op til 10 produkter', 'Basis support', '1 admin bruger', 'Webprinter subdomain'],
            icon: <Zap className="h-5 w-5" />,
        },
        {
            id: 'pro',
            name: 'Pro',
            price: 599,
            features: ['Ubegrænsede produkter', 'Prioriteret support', '5 admin brugere', 'Eget domæne', 'Avanceret statistik'],
            icon: <Crown className="h-5 w-5" />,
            popular: true,
        },
        {
            id: 'enterprise',
            name: 'Enterprise',
            price: 1299,
            features: ['Alt i Pro', 'Dedikeret support', 'Ubegrænsede brugere', 'API adgang', 'White-label emails', 'Custom integration'],
            icon: <Crown className="h-5 w-5" />,
        },
    ];

    const invoices: { id: string; date: string; amount: number; status: string }[] = [];
    const paymentMethod: { brand: string; last4: string; expiry: string } | null = null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Abonnement</h1>
                <p className="text-muted-foreground">Administrer dit abonnement og fakturering</p>
            </div>

            {/* Current Plan */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        Dit Nuværende Abonnement
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                {currentPlan === 'free' ? (
                                    <Zap className="h-6 w-6 text-primary" />
                                ) : (
                                    <Crown className="h-6 w-6 text-primary" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">
                                    {currentPlan === 'free' ? 'Gratis Plan' : 'Pro Plan'}
                                </h3>
                                <p className="text-muted-foreground">
                                    {currentPlan === 'free' ? '0 kr/måned' : '599 kr/måned'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <Badge className="bg-green-100 text-green-800">Aktiv</Badge>
                            {nextBilling && (
                                <p className="text-sm text-muted-foreground mt-1">
                                    Næste fakturering: {new Date(nextBilling).toLocaleDateString('da-DK')}
                                </p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Available Plans */}
            <Card>
                <CardHeader>
                    <CardTitle>Tilgængelige Planer</CardTitle>
                    <CardDescription>Vælg den plan der passer til din virksomhed</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid md:grid-cols-3 gap-4">
                        {plans.map((plan) => (
                            <div
                                key={plan.id}
                                className={`relative p-6 rounded-xl border-2 transition-all ${currentPlan === plan.id
                                        ? 'border-primary bg-primary/5'
                                        : 'border-muted hover:border-primary/50'
                                    }`}
                            >
                                {plan.popular && (
                                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
                                        Mest Populær
                                    </Badge>
                                )}
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                        {plan.icon}
                                    </div>
                                    <h3 className="text-lg font-bold">{plan.name}</h3>
                                </div>
                                <div className="mb-4">
                                    <span className="text-3xl font-bold">{plan.price}</span>
                                    <span className="text-muted-foreground"> kr/md</span>
                                </div>
                                <ul className="space-y-2 mb-6">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-center gap-2 text-sm">
                                            <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                                            {feature}
                                        </li>
                                    ))}
                                </ul>
                                <Button
                                    variant={currentPlan === plan.id ? 'outline' : 'default'}
                                    className="w-full"
                                    disabled={currentPlan === plan.id}
                                >
                                    {currentPlan === plan.id ? 'Nuværende plan' : 'Skift til denne'}
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Invoices */}
            {invoices.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Fakturaer
                        </CardTitle>
                        <CardDescription>Download dine tidligere fakturaer</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {invoices.map((invoice) => (
                                <div
                                    key={invoice.id}
                                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <FileText className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium">{invoice.id}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {new Date(invoice.date).toLocaleDateString('da-DK')}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-medium">{invoice.amount} kr</span>
                                        <Badge className="bg-green-100 text-green-800">Betalt</Badge>
                                        <Button variant="ghost" size="sm">
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Payment Method */}
            {paymentMethod && (
                <Card>
                    <CardHeader>
                        <CardTitle>Betalingsmetode</CardTitle>
                        <CardDescription>Dit kort bruges til at betale dit abonnement</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-800 rounded flex items-center justify-center text-white text-xs font-bold">
                                    {paymentMethod.brand.toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-medium">•••• •••• •••• {paymentMethod.last4}</p>
                                    <p className="text-sm text-muted-foreground">Udløber {paymentMethod.expiry}</p>
                                </div>
                            </div>
                            <Button variant="outline">Opdater kort</Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export default SubscriptionSettings;
