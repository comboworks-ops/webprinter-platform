import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Award, Users, Leaf, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useShopSettings } from "@/hooks/useShopSettings";

export const AboutContent = () => {
    const { data: settings } = useShopSettings();
    const shopName = String(
        settings?.branding?.shop_name
        || settings?.tenant_name
        || settings?.company?.name
        || "denne webshop"
    ).trim();
    const introText = `Vi er specialister i tryksager og visuel kommunikation. Hos ${shopName} kombinerer vi moderne produktion med personlig service, så du kan bestille professionelt print hurtigt og trygt.`;

    return (
        <section className="py-16 bg-secondary/30" data-branding-id="colors.secondary">
            <div className="container mx-auto px-4">
                <div className="max-w-3xl mx-auto text-center mb-12">
                    <h1 data-branding-id="typography.heading" className="text-4xl md:text-5xl font-heading font-bold mb-6">
                        {`Om ${shopName}`}
                    </h1>
                    <p data-branding-id="typography.body" className="text-lg text-muted-foreground leading-relaxed">
                        {introText}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <Card data-branding-id="colors.primary" className="bg-primary text-primary-foreground">
                        <CardContent className="p-6 text-center">
                            <Award className="h-12 w-12 mx-auto mb-4" />
                            <h3 data-branding-id="typography.heading" className="text-lg font-heading font-semibold mb-2 text-white">Kvalitet</h3>
                            <p data-branding-id="typography.body" className="text-sm opacity-90 text-white">
                                Topkvalitet i alle vores produkter med moderne printteknik
                            </p>
                        </CardContent>
                    </Card>

                    <Card data-branding-id="colors.primary" className="bg-primary text-primary-foreground">
                        <CardContent className="p-6 text-center">
                            <Users className="h-12 w-12 mx-auto mb-4" />
                            <h3 data-branding-id="typography.heading" className="text-lg font-heading font-semibold mb-2 text-white">Personlig rådgivning</h3>
                            <p data-branding-id="typography.body" className="text-sm opacity-90 text-white">
                                Eksperter der hjælper dig med at vælge den rigtige løsning
                            </p>
                        </CardContent>
                    </Card>

                    <Card data-branding-id="colors.primary" className="bg-primary text-primary-foreground">
                        <CardContent className="p-6 text-center">
                            <Leaf className="h-12 w-12 mx-auto mb-4" />
                            <h3 data-branding-id="typography.heading" className="text-lg font-heading font-semibold mb-2 text-white">Bæredygtighed</h3>
                            <p data-branding-id="typography.body" className="text-sm opacity-90 text-white">
                                Vi tager ansvar for miljøet i vores produktion
                            </p>
                        </CardContent>
                    </Card>

                    <Card data-branding-id="colors.primary" className="bg-primary text-primary-foreground">
                        <CardContent className="p-6 text-center">
                            <Clock className="h-12 w-12 mx-auto mb-4" />
                            <h3 data-branding-id="typography.heading" className="text-lg font-heading font-semibold mb-2 text-white">Levering til tiden</h3>
                            <p data-branding-id="typography.body" className="text-sm opacity-90 text-white">
                                Hurtig behandling og præcise leveringstider
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="text-center">
                    <Button size="lg" asChild>
                        <Link data-branding-id="colors.primary" to="/produkter" style={{ color: 'white' }}>Se produkter</Link>
                    </Button>
                </div>
            </div>
        </section>
    );
};
