/**
 * White Label Webshop Feature Page
 * 
 * Platform marketing page describing the white-label webshop feature.
 */

import { Link } from "react-router-dom";
import { ArrowRight, Check, Globe, Palette, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlatformHeader from "@/components/platform/PlatformHeader";
import PlatformFooter from "@/components/platform/PlatformFooter";
import { SEO } from "@/components/SEO";

const PlatformWhiteLabel = () => {
    const features = [
        "Dit eget domæne og branding",
        "Fuldt tilpasselige farver, fonts og logo",
        "Responsivt design til alle enheder",
        "SEO-optimeret fra starten",
        "Integreret betalingsløsning",
        "Automatisk ordrehåndtering",
    ];

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <SEO
                title="White Label Webshop | Webprinter Platform"
                description="Lav din egen brandede webshop for tryksager. Dit domæne, dit design, din forretning."
            />
            <PlatformHeader />

            {/* Hero Section */}
            <section className="pt-32 pb-16 bg-gradient-to-br from-primary/5 to-secondary/10">
                <div className="container px-4 mx-auto">
                    <div className="max-w-3xl mx-auto text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
                            <Globe className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                            White Label Webshop
                        </h1>
                        <p className="text-xl text-muted-foreground mb-8">
                            Din helt egen brandede webshop til tryksager.
                            Ingen kode nødvendig – vi klarer det tekniske.
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
                            <h2 className="text-3xl font-bold mb-6">Dit brand i centrum</h2>
                            <p className="text-muted-foreground mb-6">
                                Med vores white-label løsning får du en professionel webshop der
                                100% matcher din virksomheds identitet. Dine kunder ser kun dit brand.
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
                                <Palette className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p>Image placeholder</p>
                                <p className="text-sm">Screenshot af branding editor</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Additional Section */}
            <section className="py-16 bg-gray-50">
                <div className="container px-4 mx-auto">
                    <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
                        <div className="bg-gray-200 rounded-2xl p-8 flex items-center justify-center order-2 md:order-1">
                            {/* Image placeholder */}
                            <div className="text-center text-muted-foreground">
                                <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p>Image placeholder</p>
                                <p className="text-sm">Screenshot af produktside</p>
                            </div>
                        </div>
                        <div className="order-1 md:order-2">
                            <h2 className="text-3xl font-bold mb-6">Alt du behøver</h2>
                            <p className="text-muted-foreground mb-6">
                                Vores platform giver dig alle de funktioner du behøver for at
                                drive en succesfuld online printforretning.
                            </p>
                            <ul className="space-y-3 text-muted-foreground">
                                <li>• Produktkatalog med ubegrænset varianter</li>
                                <li>• Fleksibel prisstruktur med matrix-beregning</li>
                                <li>• Kundekonti med ordrehistorik</li>
                                <li>• Integration med de mest populære betalingsløsninger</li>
                                <li>• Automatiske mails og notifikationer</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 bg-primary text-white">
                <div className="container px-4 mx-auto text-center">
                    <h2 className="text-3xl font-bold mb-4">Klar til at starte?</h2>
                    <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
                        Prøv Webprinter Platform gratis i 14 dage. Ingen kreditkort nødvendigt.
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

export default PlatformWhiteLabel;
