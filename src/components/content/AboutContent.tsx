import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Award, Users, Leaf, Clock } from "lucide-react";
import { Link } from "react-router-dom";

export const AboutContent = () => {
    return (
        <section className="py-16 bg-secondary/30">
            <div className="container mx-auto px-4">
                <div className="max-w-3xl mx-auto text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-heading font-bold mb-6">Hvem er Webprinter.dk</h1>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Vi er specialister i tryksager – fra visitkort til bannere.
                        Hos Webprinter.dk kombinerer vi moderne produktion med klassisk håndværk og personlig service.
                        Vi leverer til hele Danmark – hurtigt og konkurrencedygtigt.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    <Card className="bg-primary text-primary-foreground">
                        <CardContent className="p-6 text-center">
                            <Award className="h-12 w-12 mx-auto mb-4" />
                            <h3 className="text-lg font-heading font-semibold mb-2 text-white">Kvalitet</h3>
                            <p className="text-sm opacity-90 text-white">
                                Topkvalitet i alle vores produkter med moderne printteknik
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-primary text-primary-foreground">
                        <CardContent className="p-6 text-center">
                            <Users className="h-12 w-12 mx-auto mb-4" />
                            <h3 className="text-lg font-heading font-semibold mb-2 text-white">Personlig rådgivning</h3>
                            <p className="text-sm opacity-90 text-white">
                                Eksperter der hjælper dig med at vælge den rigtige løsning
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-primary text-primary-foreground">
                        <CardContent className="p-6 text-center">
                            <Leaf className="h-12 w-12 mx-auto mb-4" />
                            <h3 className="text-lg font-heading font-semibold mb-2 text-white">Bæredygtighed</h3>
                            <p className="text-sm opacity-90 text-white">
                                Vi tager ansvar for miljøet i vores produktion
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="bg-primary text-primary-foreground">
                        <CardContent className="p-6 text-center">
                            <Clock className="h-12 w-12 mx-auto mb-4" />
                            <h3 className="text-lg font-heading font-semibold mb-2 text-white">Levering til tiden</h3>
                            <p className="text-sm opacity-90 text-white">
                                Hurtig behandling og præcise leveringstider
                            </p>
                        </CardContent>
                    </Card>
                </div>

                <div className="text-center">
                    <Button size="lg" asChild>
                        <Link to="/produkter" style={{ color: 'white' }}>Se produkter</Link>
                    </Button>
                </div>
            </div>
        </section>
    );
};
