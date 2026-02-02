/**
 * Platform Contact Page
 * 
 * Platform-only contact page (independent of demo shop).
 */

import { useState } from "react";
import { Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import PlatformHeader from "@/components/platform/PlatformHeader";
import PlatformFooter from "@/components/platform/PlatformFooter";
import { SEO } from "@/components/SEO";

const PlatformKontakt = () => {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        company: "",
        message: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Simulate form submission
        await new Promise(resolve => setTimeout(resolve, 1000));

        toast({
            title: "Besked modtaget",
            description: "Vi vender tilbage hurtigst muligt.",
        });

        setFormData({ name: "", email: "", company: "", message: "" });
        setIsSubmitting(false);
    };

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <SEO
                title="Kontakt | Webprinter Platform"
                description="Kontakt Webprinter Platform. Vi hjælper dig gerne med at komme i gang."
            />
            <PlatformHeader />

            {/* Hero */}
            <section className="pt-32 pb-16 bg-gradient-to-br from-primary/5 to-secondary/10">
                <div className="container px-4 mx-auto text-center">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                        Kontakt os
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Har du spørgsmål om Webprinter Platform? Vi er klar til at hjælpe.
                    </p>
                </div>
            </section>

            {/* Contact Form & Info */}
            <section className="py-16 bg-white">
                <div className="container px-4 mx-auto">
                    <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
                        {/* Contact Form */}
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Send os en besked</h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <Label htmlFor="name">Navn *</Label>
                                    <Input
                                        id="name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="email">Email *</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="company">Virksomhed</Label>
                                    <Input
                                        id="company"
                                        value={formData.company}
                                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="message">Besked *</Label>
                                    <Textarea
                                        id="message"
                                        rows={5}
                                        value={formData.message}
                                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                        required
                                    />
                                </div>
                                <Button type="submit" className="w-full" disabled={isSubmitting}>
                                    {isSubmitting ? "Sender..." : "Send besked"}
                                </Button>
                            </form>
                        </div>

                        {/* Contact Info */}
                        <div>
                            <h2 className="text-2xl font-bold mb-6">Kontaktinformation</h2>
                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <Mail className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold mb-1">Email</h3>
                                        <a href="mailto:info@webprinter.dk" className="text-muted-foreground hover:text-primary transition-colors">
                                            info@webprinter.dk
                                        </a>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <Phone className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold mb-1">Telefon</h3>
                                        <a href="tel:+4571991110" className="text-muted-foreground hover:text-primary transition-colors">
                                            +45 71 99 11 10
                                        </a>
                                    </div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                        <MapPin className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold mb-1">Adresse</h3>
                                        <p className="text-muted-foreground">
                                            Webprinter<br />
                                            Danmark
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 p-6 bg-gray-50 rounded-xl">
                                <h3 className="font-semibold mb-2">Åbningstider</h3>
                                <p className="text-sm text-muted-foreground">
                                    Mandag - Fredag: 09:00 - 17:00<br />
                                    Weekend: Lukket
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <PlatformFooter />
        </div>
    );
};

export default PlatformKontakt;
