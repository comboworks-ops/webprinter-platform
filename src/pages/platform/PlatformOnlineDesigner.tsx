/**
 * Online Designer Feature Page
 * 
 * Platform marketing page describing the online designer feature.
 * Includes mention of Soft Proof (CMYK preview).
 */

import { Link } from "react-router-dom";
import { ArrowRight, Check, Eye, Layers, Palette, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlatformHeader from "@/components/platform/PlatformHeader";
import PlatformFooter from "@/components/platform/PlatformFooter";
import { SEO } from "@/components/SEO";

const PlatformOnlineDesigner = () => {
    const features = [
        "Professionel canvas editor til print",
        "Drag-and-drop interface",
        "Tekst, former og billedimport",
        "PDF-import og -eksport",
        "Bleed, trim og sikkerhedszoner",
        "Preflight-validering i realtid",
    ];

    const softProofFeatures = [
        "Soft Proof (CMYK preview) – Se hvordan RGB-farver ændrer sig i print",
        "ICC profil understøttelse (FOGRA39, sRGB)",
        "Gamut warning for out-of-gamut farver",
        "Eksport til print-ready PDF",
    ];

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <SEO
                title="Online Designer | Webprinter Platform"
                description="Professionel online designer til print. Soft proof, preflight og PDF eksport."
            />
            <PlatformHeader />

            {/* Hero Section */}
            <section className="pt-32 pb-16 bg-gradient-to-br from-primary/5 to-secondary/10">
                <div className="container px-4 mx-auto">
                    <div className="max-w-3xl mx-auto text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
                            <PenTool className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                            Professionel Online Designer
                        </h1>
                        <p className="text-xl text-muted-foreground mb-8">
                            Giv dine kunder mulighed for at designe deres egne tryksager
                            direkte i browseren – med professionelle værktøjer.
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
                            <h2 className="text-3xl font-bold mb-6">Designværktøjer i verdensklasse</h2>
                            <p className="text-muted-foreground mb-6">
                                Vores canvas-baserede designer giver dine kunder alle de
                                værktøjer de behøver for at skabe professionelle designs.
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
                                <Layers className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p>Image placeholder</p>
                                <p className="text-sm">Screenshot af canvas editor</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Soft Proof Section */}
            <section className="py-16 bg-gray-50">
                <div className="container px-4 mx-auto">
                    <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
                        <div className="bg-gray-200 rounded-2xl p-8 flex items-center justify-center order-2 md:order-1">
                            {/* Image placeholder */}
                            <div className="text-center text-muted-foreground">
                                <Eye className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p>Image placeholder</p>
                                <p className="text-sm">Soft proof sammenligning</p>
                            </div>
                        </div>
                        <div className="order-1 md:order-2">
                            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-3 py-1 rounded-full mb-4">
                                <Palette className="w-4 h-4" />
                                CMYK Farvestyring
                            </div>
                            <h2 className="text-3xl font-bold mb-6">Soft Proof teknologi</h2>
                            <p className="text-muted-foreground mb-6">
                                <strong>Soft Proof (CMYK preview)</strong> hjælper dine kunder med at se,
                                hvordan RGB-farver kan ændre sig når de printes i CMYK.
                                Ingen overraskelser ved levering.
                            </p>
                            <ul className="space-y-3">
                                {softProofFeatures.map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* CompanyHub Section */}
            <section className="py-16 bg-white">
                <div className="container px-4 mx-auto text-center max-w-3xl">
                    <h2 className="text-3xl font-bold mb-4">CompanyHub – B2B Portal</h2>
                    <p className="text-muted-foreground mb-8">
                        Giv dine erhvervskunder en dedikeret portal hvor de nemt kan
                        genbestille ofte brugte produkter. Perfekt til visitkort,
                        brevpapir og skabeloner.
                    </p>
                    <div className="bg-gray-100 rounded-2xl p-8 mb-8">
                        {/* Image placeholder */}
                        <div className="text-center text-muted-foreground">
                            <Layers className="w-16 h-16 mx-auto mb-4 opacity-50" />
                            <p>Image placeholder</p>
                            <p className="text-sm">Screenshot af CompanyHub portal</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 bg-primary text-white">
                <div className="container px-4 mx-auto text-center">
                    <h2 className="text-3xl font-bold mb-4">Giv dine kunder designkraft</h2>
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

export default PlatformOnlineDesigner;
