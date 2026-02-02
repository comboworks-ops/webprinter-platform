/**
 * Platform Priser (Pricing) Page
 * 
 * Shows subscription pricing for the Webprinter platform.
 * Platform-only page, independent of demo shop.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import PlatformHeader from "@/components/platform/PlatformHeader";
import PlatformFooter from "@/components/platform/PlatformFooter";
import { PRICING_TIERS, formatPrice } from "@/lib/platform/pricing";
import { SEO } from "@/components/SEO";

const PlatformPriser = () => {
    const [isYearly, setIsYearly] = useState(false);

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <SEO
                title="Priser | Webprinter Platform"
                description="Se vores abonnementspriser og find den plan der passer til din virksomhed."
            />
            <PlatformHeader />

            {/* Hero Section */}
            <section className="pt-32 pb-16 bg-gradient-to-br from-primary/5 to-secondary/10">
                <div className="container px-4 mx-auto text-center">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                        Enkle, transparente priser
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
                        Vælg den plan der passer til din virksomhed. Start med en gratis prøveperiode.
                    </p>

                    {/* Billing toggle */}
                    <div className="flex items-center justify-center gap-3 mb-8">
                        <Label htmlFor="billing-toggle" className={!isYearly ? 'font-semibold' : 'text-muted-foreground'}>
                            Månedlig
                        </Label>
                        <Switch
                            id="billing-toggle"
                            checked={isYearly}
                            onCheckedChange={setIsYearly}
                        />
                        <Label htmlFor="billing-toggle" className={isYearly ? 'font-semibold' : 'text-muted-foreground'}>
                            Årlig <span className="text-green-600 text-sm">(spar 17%)</span>
                        </Label>
                    </div>
                </div>
            </section>

            {/* Pricing Cards */}
            <section className="py-16 bg-white">
                <div className="container px-4 mx-auto">
                    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        {PRICING_TIERS.map((tier) => (
                            <Card
                                key={tier.id}
                                className={`relative flex flex-col ${tier.highlighted
                                        ? 'border-primary shadow-lg scale-105'
                                        : 'border-gray-200'
                                    }`}
                            >
                                {tier.highlighted && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-semibold px-3 py-1 rounded-full">
                                        Mest populær
                                    </div>
                                )}
                                <CardHeader>
                                    <CardTitle className="text-2xl">{tier.name}</CardTitle>
                                    <CardDescription>{tier.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <div className="mb-6">
                                        <span className="text-4xl font-bold">
                                            {formatPrice(isYearly ? Math.round(tier.yearlyPrice / 12) : tier.monthlyPrice)}
                                        </span>
                                        <span className="text-muted-foreground">/måned</span>
                                        {isYearly && (
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Faktureres årligt ({formatPrice(tier.yearlyPrice)}/år)
                                            </p>
                                        )}
                                    </div>
                                    <ul className="space-y-3">
                                        {tier.features.map((feature, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                                                <span className="text-sm">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <CardFooter>
                                    <Link to={tier.id === 'enterprise' ? '/kontakt' : '/opret-shop'} className="w-full">
                                        <Button
                                            className="w-full"
                                            variant={tier.highlighted ? 'default' : 'outline'}
                                        >
                                            {tier.cta}
                                        </Button>
                                    </Link>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-16 bg-gray-50">
                <div className="container px-4 mx-auto max-w-3xl">
                    <h2 className="text-3xl font-bold text-center mb-8">Ofte stillede spørgsmål</h2>
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow-sm">
                            <h3 className="font-semibold mb-2">Kan jeg skifte plan senere?</h3>
                            <p className="text-muted-foreground text-sm">
                                Ja, du kan til enhver tid opgradere eller nedgradere din plan. Ændringer træder i kraft ved næste faktureringsperiode.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-sm">
                            <h3 className="font-semibold mb-2">Hvad sker der efter prøveperioden?</h3>
                            <p className="text-muted-foreground text-sm">
                                Efter de 14 dages gratis prøveperiode fortsætter du automatisk på den valgte plan. Du kan annullere når som helst.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-sm">
                            <h3 className="font-semibold mb-2">Er der bindingsperiode?</h3>
                            <p className="text-muted-foreground text-sm">
                                Nej, der er ingen bindingsperiode. Du kan annullere dit abonnement når som helst.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <PlatformFooter />
        </div>
    );
};

export default PlatformPriser;
