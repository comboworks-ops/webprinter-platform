import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroSlider from "@/components/HeroSlider";
import ProductGrid from "@/components/ProductGrid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Award, Phone } from "lucide-react";

const Shop = () => {

    return <div className="min-h-screen flex flex-col">
        <Header />

        {/* Main content - HeroSlider uses negative margin to slide under the Header */}
        <main className="flex-1" style={{ marginTop: '-80px' }}>
            <HeroSlider />

            {/* Tagline */}
            <section className="bg-secondary py-8">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-2xl md:text-3xl font-heading font-semibold text-foreground">Velkommen til danmarks billigste tryksager</h2>
                </div>
            </section>

            {/* Products Section */}
            <section className="py-16" id="produkter">
                <div className="container mx-auto px-4">
                    <Tabs defaultValue="tryksager" className="w-full">
                        <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-12">
                            <TabsTrigger value="tryksager">Tryksager</TabsTrigger>
                            <TabsTrigger value="storformat">Storformat print</TabsTrigger>
                        </TabsList>

                        <TabsContent value="tryksager" id="tryksager">
                            <ProductGrid category="tryksager" />
                        </TabsContent>

                        <TabsContent value="storformat" id="storformat">
                            <ProductGrid category="storformat" />
                        </TabsContent>
                    </Tabs>
                </div>
            </section>

            {/* USP Strip */}
            <section className="bg-primary text-primary-foreground py-12">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                        <div className="flex flex-col items-center">
                            <Truck className="h-12 w-12 mb-4" />
                            <h3 className="text-lg font-heading font-semibold mb-2">Hurtig levering</h3>
                            <p className="text-sm opacity-90">Express-muligheder til hele Danmark</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <Award className="h-12 w-12 mb-4" />
                            <h3 className="text-lg font-heading font-semibold mb-2">Kvalitet til skarpe priser</h3>
                            <p className="text-sm opacity-90">25+ års erfaring med professionelt tryk</p>
                        </div>
                        <div className="flex flex-col items-center">
                            <Phone className="h-12 w-12 mb-4" />
                            <h3 className="text-lg font-heading font-semibold mb-2">Personlig rådgivning</h3>
                            <p className="text-sm opacity-90">Tlf: 71 99 11 10</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* SEO Content */}
            <section className="py-16 bg-secondary/30">
                <div className="container mx-auto px-4">
                    <div className="max-w-4xl mx-auto space-y-8">
                        <div>
                            <h2 className="text-xl font-heading font-semibold mb-3">Billige tryksager online</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Webprinter.dk gør det nemt at bestille flyers, foldere, visitkort og hæfter i høj kvalitet til lave priser.
                                Beregn din pris direkte online og få levering i hele Danmark.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-xl font-heading font-semibold mb-3">Storformat print til enhver opgave</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Fra bannere og beachflag til skilte og tekstilprint – vi producerer storformat i topkvalitet.
                                Alt printes med UV-bestandige farver og professionel finish.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-xl font-heading font-semibold mb-3">Dansk trykkeri med hurtig levering</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Vi har over 25 års erfaring og leverer både til erhverv og private.
                                Kontakt os i dag og oplev service, kvalitet og konkurrencedygtige priser.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </main>

        <Footer />
    </div>;
};

export default Shop;
