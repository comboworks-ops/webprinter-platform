/**
 * Ordre Workflow Feature Page
 * 
 * Platform marketing page describing the order management workflow feature.
 */

import { Link } from "react-router-dom";
import { ArrowRight, Check, ClipboardList, Package, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import PlatformHeader from "@/components/platform/PlatformHeader";
import PlatformFooter from "@/components/platform/PlatformFooter";
import { SEO } from "@/components/SEO";

const PlatformOrderFlow = () => {
    const features = [
        "Komplet ordrehåndtering fra bestilling til levering",
        "Automatiske statusopdateringer til kunder",
        "Filvalidering og preflight-tjek",
        "Fakturagenerering",
        "Leveringssporing",
        "Kunde-til-admin beskedflow",
    ];

    const steps = [
        { icon: ClipboardList, title: "Ordre modtages", desc: "Kunde placerer ordre og uploader filer" },
        { icon: Package, title: "Produktion", desc: "Preflight-tjek, godkendelse og produktion" },
        { icon: Truck, title: "Levering", desc: "Forsendelse og sporing til kunden" },
    ];

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <SEO
                title="Ordre Workflow | Webprinter Platform"
                description="Strømlinet ordrehåndtering fra bestilling til levering. Automatiser dit trykkeri."
            />
            <PlatformHeader />

            {/* Hero Section */}
            <section className="pt-32 pb-16 bg-gradient-to-br from-primary/5 to-secondary/10">
                <div className="container px-4 mx-auto">
                    <div className="max-w-3xl mx-auto text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
                            <ClipboardList className="w-8 h-8 text-primary" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                            Ordre Workflow
                        </h1>
                        <p className="text-xl text-muted-foreground mb-8">
                            Fra bestilling til levering – strømlinet og automatiseret
                            ordrehåndtering for dit trykkeri.
                        </p>
                        <Link to="/opret-shop">
                            <Button size="lg" className="gap-2">
                                Start gratis prøveperiode <ArrowRight className="w-4 h-4" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Workflow Steps */}
            <section className="py-16 bg-white">
                <div className="container px-4 mx-auto">
                    <div className="max-w-4xl mx-auto">
                        <h2 className="text-3xl font-bold text-center mb-12">Sådan fungerer det</h2>
                        <div className="grid md:grid-cols-3 gap-8">
                            {steps.map((step, idx) => (
                                <div key={idx} className="text-center">
                                    <div className="relative">
                                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                                            <step.icon className="w-8 h-8 text-primary" />
                                        </div>
                                        {idx < steps.length - 1 && (
                                            <div className="hidden md:block absolute top-8 left-1/2 w-full h-0.5 bg-gray-200" />
                                        )}
                                    </div>
                                    <h3 className="font-semibold mb-2">{step.title}</h3>
                                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-16 bg-gray-50">
                <div className="container px-4 mx-auto">
                    <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
                        <div>
                            <h2 className="text-3xl font-bold mb-6">Fuld kontrol over ordrer</h2>
                            <p className="text-muted-foreground mb-6">
                                Vores ordrehåndteringssystem giver dig komplet overblik og
                                automatiserer de tidskrævende opgaver.
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
                        <div className="bg-gray-200 rounded-2xl p-8 flex items-center justify-center">
                            {/* Image placeholder */}
                            <div className="text-center text-muted-foreground">
                                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p>Image placeholder</p>
                                <p className="text-sm">Screenshot af ordre dashboard</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 bg-primary text-white">
                <div className="container px-4 mx-auto text-center">
                    <h2 className="text-3xl font-bold mb-4">Automatisér din ordrehåndtering</h2>
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

export default PlatformOrderFlow;
