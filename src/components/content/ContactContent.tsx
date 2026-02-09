import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Phone, Mail, MapPin, Building2 } from "lucide-react";
import { useShopSettings } from "@/hooks/useShopSettings";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import { DEFAULT_BRANDING, mergeBrandingWithDefaults } from "@/hooks/useBrandingDraft";
import { ContentBlocksRenderer } from "@/components/content/ContentBlocksRenderer";
import { LowerInfoRenderer } from "@/components/content/LowerInfoRenderer";

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
    const { branding: previewBranding } = usePreviewBranding();
    const company = settings?.company || {};
    const mergedBranding = previewBranding || mergeBrandingWithDefaults(settings?.branding || null);
    const contactSettings = mergedBranding.contactPage || DEFAULT_BRANDING.contactPage;
    const contactOverrides = contactSettings.contactInfo || DEFAULT_BRANDING.contactPage.contactInfo;
    const extras = mergedBranding.pageExtras?.contact;

    const contactPhone = contactOverrides.phone?.trim() || company.phone || "+45 XX XX XX XX";
    const contactEmail = contactOverrides.email?.trim() || company.email || "support@ditdomæne.dk";
    const contactName = contactOverrides.name?.trim() || company.name || "Virksomhed";
    const contactAddress = contactOverrides.address?.trim() || company.address || "Adresse";
    const contactCvr = contactOverrides.cvr?.trim() || company.cvr || "";
    const recipientEmail = contactSettings.formRecipientEmail?.trim() || contactEmail;

    const headingFont = contactSettings.headingFont || DEFAULT_BRANDING.contactPage.headingFont;
    const bodyFont = contactSettings.bodyFont || DEFAULT_BRANDING.contactPage.bodyFont;
    const formFont = contactSettings.formFont || DEFAULT_BRANDING.contactPage.formFont;
    const headingColor = contactSettings.headingColor || DEFAULT_BRANDING.contactPage.headingColor;
    const bodyTextColor = contactSettings.bodyTextColor || DEFAULT_BRANDING.contactPage.bodyTextColor;
    const formTextColor = contactSettings.formTextColor || DEFAULT_BRANDING.contactPage.formTextColor;
    const infoBoxBackground = contactSettings.infoBoxBackground || DEFAULT_BRANDING.contactPage.infoBoxBackground;
    const infoBoxTextColor = contactSettings.infoBoxTextColor || DEFAULT_BRANDING.contactPage.infoBoxTextColor;
    const infoBoxBorderColor = contactSettings.infoBoxBorderColor || DEFAULT_BRANDING.contactPage.infoBoxBorderColor;

    const mapSettings = contactSettings.map || DEFAULT_BRANDING.contactPage.map;
    const mapEnabled = !!mapSettings.imageUrl && mapSettings.placement !== 'hidden' && mapSettings.enabled !== false;
    const mapBoxBackground = mapSettings.boxBackground || DEFAULT_BRANDING.contactPage.map.boxBackground;
    const mapBoxBorderColor = mapSettings.boxBorderColor || DEFAULT_BRANDING.contactPage.map.boxBorderColor;
    const mapPlacement = mapSettings.placement || 'inline';

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

        console.log("Contact form submitted:", { ...formData, recipientEmail });

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
        <div
            className="w-full"
            style={contactSettings.backgroundEnabled ? { backgroundColor: contactSettings.backgroundColor } : undefined}
        >
            <div className="container mx-auto px-4">
            <div className="max-w-5xl mx-auto" style={{ fontFamily: `'${bodyFont}', sans-serif`, color: bodyTextColor }}>
                <h1
                    className="text-4xl md:text-5xl font-heading font-bold mb-12 text-center"
                    style={{ fontFamily: `'${headingFont}', sans-serif`, color: headingColor }}
                >
                    Kontakt os
                </h1>

                <div className="grid md:grid-cols-2 gap-12">
                    {/* Contact Info */}
                    <div className="space-y-6">
                        <div>
                            <h2
                                className="text-2xl font-heading font-semibold mb-6"
                                style={{ fontFamily: `'${headingFont}', sans-serif`, color: headingColor }}
                            >
                                Kontaktinformation
                            </h2>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <Phone className="h-5 w-5 text-primary mt-1" />
                                    <div>
                                        <p className="font-medium" style={{ color: headingColor }}>Telefon</p>
                                        <a
                                            href={`tel:${contactPhone.replace(/\s/g, '')}`}
                                            className="hover:text-primary transition-colors"
                                            style={{ color: bodyTextColor }}
                                        >
                                            {contactPhone}
                                        </a>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <Mail className="h-5 w-5 text-primary mt-1" />
                                    <div>
                                        <p className="font-medium" style={{ color: headingColor }}>E-mail</p>
                                        <a
                                            href={`mailto:${contactEmail}`}
                                            className="hover:text-primary transition-colors"
                                            style={{ color: bodyTextColor }}
                                        >
                                            {contactEmail}
                                        </a>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3">
                                    <MapPin className="h-5 w-5 text-primary mt-1" />
                                    <div>
                                        <p className="font-medium" style={{ color: headingColor }}>Adresse</p>
                                        <p className="whitespace-pre-line" style={{ color: bodyTextColor }}>
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
                                            <p className="font-medium" style={{ color: headingColor }}>CVR-nummer</p>
                                            <p style={{ color: bodyTextColor }}>{contactCvr}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {mapEnabled && mapPlacement === 'inline' && (
                            <div
                                className="border rounded-lg p-3"
                                style={{ backgroundColor: mapBoxBackground, borderColor: mapBoxBorderColor }}
                            >
                                <img
                                    src={mapSettings.imageUrl}
                                    alt="Kort"
                                    className="w-full rounded-md object-cover"
                                />
                            </div>
                        )}

                        <div
                            className="p-6 rounded-lg border"
                            style={{ backgroundColor: infoBoxBackground, borderColor: infoBoxBorderColor, color: infoBoxTextColor }}
                        >
                            <h3 className="font-heading font-semibold mb-2" style={{ fontFamily: `'${headingFont}', sans-serif` }}>
                                Åbningstider
                            </h3>
                            <p className="text-sm" style={{ color: infoBoxTextColor }}>
                                Mandag - Fredag: 09:00 - 16:00
                                <br />
                                Lørdag - Søndag: Lukket
                            </p>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div>
                        <div
                            className={contactSettings.formBox.enabled ? "p-6 rounded-lg border" : ""}
                            style={contactSettings.formBox.enabled ? {
                                backgroundColor: contactSettings.formBox.backgroundColor,
                                borderColor: contactSettings.formBox.borderColor,
                            } : undefined}
                        >
                            <form onSubmit={handleSubmit} className="space-y-4" style={{ fontFamily: `'${formFont}', sans-serif`, color: formTextColor }}>
                            <div className="space-y-2">
                                <Label htmlFor="name" style={{ color: formTextColor }}>Navn *</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email" style={{ color: formTextColor }}>E-mail *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone" style={{ color: formTextColor }}>Telefon</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="subject" style={{ color: formTextColor }}>Emne</Label>
                                <Input
                                    id="subject"
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="message" style={{ color: formTextColor }}>Besked *</Label>
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
                                <Label htmlFor="consent" className="text-sm font-normal cursor-pointer leading-relaxed" style={{ color: formTextColor }}>
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

                {mapEnabled && mapPlacement === 'fullWidth' && (
                    <div className="mt-12">
                        <div
                            className="border rounded-lg overflow-hidden"
                            style={{ backgroundColor: mapBoxBackground, borderColor: mapBoxBorderColor }}
                        >
                            <img
                                src={mapSettings.imageUrl}
                                alt="Kort"
                                className="w-full h-64 object-cover"
                            />
                        </div>
                    </div>
                )}
            </div>
            </div>
            <ContentBlocksRenderer blocks={extras?.contentBlocks} placement="all" brandingSectionId="page-extras" />
            <LowerInfoRenderer lowerInfo={extras?.lowerInfo} sectionId="page-extras" />
        </div>
    );
};
