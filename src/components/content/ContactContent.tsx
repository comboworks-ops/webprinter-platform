import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Phone, Mail, MapPin, Building2 } from "lucide-react";
import { useShopSettings } from "@/hooks/useShopSettings";
import { sendContactMessage } from "@/lib/contact/sendContactMessage";

export const ContactContent = () => {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
        consent: false,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();
    const { data: settings } = useShopSettings();
    const company = settings?.company || {};
    const contactPhone = typeof company.phone === "string" ? company.phone.trim() : "";
    const contactEmail = typeof company.email === "string" ? company.email.trim() : "";
    const contactName = typeof company.name === "string" ? company.name.trim() : (settings?.tenant_name || "");
    const contactAddress = typeof company.address === "string" ? company.address.trim() : "";
    const contactCvr = typeof company.cvr === "string" ? company.cvr.trim() : "";
    const addressLines = [contactName, contactAddress].filter(Boolean);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.email || !formData.message) {
            toast({
                title: "Fejl",
                description: "Udfyld venligst alle påkrævede felter.",
                variant: "destructive",
            });
            return;
        }

        if (!formData.consent) {
            toast({
                title: "Fejl",
                description: "Du skal acceptere betingelserne for at sende beskeden.",
                variant: "destructive",
            });
            return;
        }

        if (!settings?.id) {
            toast({
                title: "Fejl",
                description: "Shop-kontekst mangler. Prøv at genindlæse siden.",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);

        try {
            await sendContactMessage({
                mode: "tenant",
                tenantId: settings.id,
                senderName: formData.name,
                senderEmail: formData.email,
                senderPhone: formData.phone,
                subject: formData.subject,
                message: formData.message,
            });

            toast({
                title: "Tak for din henvendelse!",
                description: "Din besked er sendt. Vi vender tilbage hurtigst muligt.",
            });

            setFormData({
                name: "",
                email: "",
                phone: "",
                subject: "",
                message: "",
                consent: false,
            });
        } catch (error) {
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Vi kunne ikke sende din besked. Prøv igen om et øjeblik.";
            console.error("Contact form submission failed:", error);
            toast({
                title: "Der opstod en fejl",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
                <h1 data-branding-id="typography.heading" className="text-4xl md:text-5xl font-heading font-bold mb-12 text-center">Kontakt os</h1>

                <div className="grid md:grid-cols-2 gap-12">
                    {/* Contact Info */}
                    <div className="space-y-6">
                        <div>
                            <h2 data-branding-id="typography.heading" className="text-2xl font-heading font-semibold mb-6">Kontaktinformation</h2>

                            <div className="space-y-4">
                                {contactPhone && (
                                    <div className="flex items-start gap-3">
                                        <Phone className="h-5 w-5 text-primary mt-1" />
                                        <div>
                                            <p data-branding-id="typography.heading" className="font-medium">Telefon</p>
                                            <a
                                                href={`tel:${contactPhone.replace(/\s/g, '')}`}
                                                data-branding-id="colors.linkText"
                                                className="text-muted-foreground hover:text-primary transition-colors"
                                            >
                                                {contactPhone}
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {contactEmail && (
                                    <div className="flex items-start gap-3">
                                        <Mail className="h-5 w-5 text-primary mt-1" />
                                        <div>
                                            <p data-branding-id="typography.heading" className="font-medium">E-mail</p>
                                            <a
                                                href={`mailto:${contactEmail}`}
                                                data-branding-id="colors.linkText"
                                                className="text-muted-foreground hover:text-primary transition-colors"
                                            >
                                                {contactEmail}
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {addressLines.length > 0 && (
                                    <div className="flex items-start gap-3">
                                        <MapPin className="h-5 w-5 text-primary mt-1" />
                                        <div>
                                            <p data-branding-id="typography.heading" className="font-medium">Adresse</p>
                                            <p data-branding-id="typography.body" className="text-muted-foreground whitespace-pre-line">
                                                {addressLines.join("\n")}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {contactCvr && (
                                    <div className="flex items-start gap-3">
                                        <Building2 className="h-5 w-5 text-primary mt-1" />
                                        <div>
                                            <p data-branding-id="typography.heading" className="font-medium">CVR-nummer</p>
                                            <p data-branding-id="typography.body" className="text-muted-foreground">{contactCvr}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div data-branding-id="colors.card" className="bg-muted p-6 rounded-lg">
                            <h3 data-branding-id="typography.heading" className="font-heading font-semibold mb-2">Åbningstider</h3>
                            <p data-branding-id="typography.body" className="text-sm text-muted-foreground">
                                Mandag - Fredag: 09:00 - 16:00
                                <br />
                                Lørdag - Søndag: Lukket
                            </p>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Navn *</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">E-mail *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">Telefon</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="subject">Emne</Label>
                                <Input
                                    id="subject"
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="message">Besked *</Label>
                                <Textarea
                                    id="message"
                                    rows={5}
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="flex items-start space-x-2">
                                <Checkbox
                                    id="consent"
                                    checked={formData.consent}
                                    onCheckedChange={(checked) => setFormData({ ...formData, consent: checked as boolean })}
                                />
                                <Label htmlFor="consent" className="text-sm font-normal cursor-pointer leading-relaxed">
                                    Jeg accepterer at mine oplysninger bruges til at behandle min henvendelse i henhold til
                                    privatlivspolitikken.
                                </Label>
                            </div>

                            <Button data-branding-id="colors.primary" type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                                {isSubmitting ? "Sender..." : "Send besked"}
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
