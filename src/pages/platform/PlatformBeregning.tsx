/**
 * Smart Prisberegning (Pricing Engine) Feature Page
 * 
 * Platform marketing page describing the pricing calculation feature.
 */

import { Link } from "react-router-dom";
import { ArrowRight, BarChart, Calculator, Check, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlatformHeader from "@/components/platform/PlatformHeader";
import PlatformFooter from "@/components/platform/PlatformFooter";
import { SEO } from "@/components/SEO";

const PlatformBeregning = () => {
    const features = [
        "Matrix-baseret prisberegning for alle produkttyper",
        "Automatisk volumensrabat",
        "Materialebaserede priser (kr/m² for storformat)",
        "Maskinprisberegning (MPA) for præcis kalkulation",
        "Realtidsopdatering af priser",
        "Margin profiler med tiered markup",
    ];

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <SEO
                title="Smart Prisberegning | Webprinter Platform"
                description="Avanceret prisberegning til tryksager. Matrix-priser, volumensrabat og maskinprisberegning."
            />
            <PlatformHeader />

            {/* Hero Section */}
            <section className="pt-32 pb-16 bg-gradient-to-br from-primary/5 to-secondary/10">
                <div className="container px-4 mx-auto">
                    <div className="max-w-3xl mx-auto text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
                            <BarChart className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                            Smart Prisberegning
                        </h1>
                        <p className="text-xl text-muted-foreground mb-8">
                            Avanceret prislogik der håndterer alt fra simple flyers
                            til komplekse storformat-produkter.
                        </p>
                        <Link to="/opret-shop">
                            <Button size="lg" className="gap-2">
                                Start gratis prøveperiode <ArrowRight className="w-4 h-4" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-16 bg-white">
                <div className="container px-4 mx-auto">
                    <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
                        <div>
                            <h2 className="text-3xl font-bold mb-6">Præcis prissætning</h2>
                            <p className="text-muted-foreground mb-6">
                                Vores prisberegner understøtter komplekse prisstrukturer så du
                                altid kan tilbyde den rigtige pris til dine kunder.
                            </p>
                            <ul className="space-y-3">
                                {features.map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="bg-gray-100 rounded-2xl p-8 flex items-center justify-center">
                            {/* Image placeholder */}
                            <div className="text-center text-muted-foreground">
                                <Calculator className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p>Image placeholder</p>
                                <p className="text-sm">Screenshot af prismatrix</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Additional Section */}
            <section className="py-16 bg-gray-50">
                <div className="container px-4 mx-auto">
                    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        <div className="bg-white p-6 rounded-xl shadow-sm">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                <BarChart className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="font-semibold mb-2">Matrix Priser</h3>
                            <p className="text-sm text-muted-foreground">
                                Definér priser baseret på antal, størrelse og materialevalg i
                                en fleksibel prismatrix.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                <Percent className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="font-semibold mb-2">Volumensrabat</h3>
                            <p className="text-sm text-muted-foreground">
                                Automatisk rabat ved større ordrer. Vis besparelser for at
                                opfordre til større køb.
                            </p>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                <Calculator className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="font-semibold mb-2">MPA Kalkulation</h3>
                            <p className="text-sm text-muted-foreground">
                                Machine Pricing Add-on beregner præcise priser baseret på
                                maskineffektivitet og materialeforbrug.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 bg-primary text-white">
                <div className="container px-4 mx-auto text-center">
                    <h2 className="text-3xl font-bold mb-4">Klar til smartere prissætning?</h2>
                    <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
                        Prøv Webprinter Platform gratis i 14 dage.
                    </p>
                    <Link to="/opret-shop">
                        <Button size="lg" variant="secondary" className="gap-2">
                            Start gratis prøveperiode <ArrowRight className="w-4 h-4" />
                        </Button>
                    </Link>
                </div>
            </section>

            <PlatformFooter />
        </div>
    );
};

export default PlatformBeregning;
