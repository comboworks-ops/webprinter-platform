import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Phone, Mail, MapPin, Building2 } from "lucide-react";
import { useShopSettings } from "@/hooks/useShopSettings";

export const ContactContent = () => {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
        consent: false,
    });
    const { toast } = useToast();
    const { data: settings } = useShopSettings();
    const company = settings?.company || {};
    const contactPhone = company.phone || "+45 XX XX XX XX";
    const contactEmail = company.email || "support@ditdomæne.dk";
    const contactName = company.name || "Virksomhed";
    const contactAddress = company.address || "Adresse";
    const contactCvr = company.cvr || "";

    const handleSubmit = (e: React.FormEvent) => {
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

        console.log("Contact form submitted:", formData);

        toast({
            title: "Tak for din henvendelse!",
            description: "Vi vender tilbage hurtigst muligt.",
        });

        setFormData({
            name: "",
            email: "",
            phone: "",
            subject: "",
            message: "",
            consent: false,
        });
    };

    return (
        <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto">
                <h1 className="text-4xl md:text-5xl font-heading font-bold mb-12 text-center">Kontakt os</h1>

                <div className="grid md:grid-cols-2 gap-12">
                    {/* Contact Info */}
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-2xl font-heading font-semibold mb-6">Kontaktinformation</h2>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <Phone className="h-5 w-5 text-primary mt-1" />
                                    <div>
                                        <p className="font-medium">Telefon</p>
                                        <a
                                            href={`tel:${contactPhone.replace(/\s/g, '')}`}
                                            className="text-muted-foreground hover:text-primary transition-colors"
                                        >
                                            {contactPhone}
                                        </a>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Mail className="h-5 w-5 text-primary mt-1" />
                                    <div>
                                        <p className="font-medium">E-mail</p>
                                        <a
                                            href={`mailto:${contactEmail}`}
                                            className="text-muted-foreground hover:text-primary transition-colors"
                                        >
                                            {contactEmail}
                                        </a>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <MapPin className="h-5 w-5 text-primary mt-1" />
                                    <div>
                                        <p className="font-medium">Adresse</p>
                                        <p className="text-muted-foreground whitespace-pre-line">
                                            {contactName}
                                            {"\n"}
                                            {contactAddress}
                                        </p>
                                    </div>
                                </div>

                                {contactCvr && (
                                    <div className="flex items-start gap-3">
                                        <Building2 className="h-5 w-5 text-primary mt-1" />
                                        <div>
                                            <p className="font-medium">CVR-nummer</p>
                                            <p className="text-muted-foreground">{contactCvr}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-muted p-6 rounded-lg">
                            <h3 className="font-heading font-semibold mb-2">Åbningstider</h3>
                            <p className="text-sm text-muted-foreground">
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

                            <Button type="submit" size="lg" className="w-full">
                                Send besked
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
