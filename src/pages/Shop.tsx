import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroSlider from "@/components/HeroSlider";
import ProductGrid from "@/components/ProductGrid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Award, Phone } from "lucide-react";
import { useShopSettings } from "@/hooks/useShopSettings";

const Shop = () => {
    const { data: settings } = useShopSettings();
    const branding = settings?.branding;
    const productsSection = branding?.forside?.productsSection;
    const showProducts = productsSection?.enabled ?? true;
    const productColumns = productsSection?.columns ?? 4;
    const productButtonConfig = productsSection?.button;
    const productBackgroundConfig = productsSection?.background;
    const productLayoutStyle = productsSection?.layoutStyle;
    const showStorformatTab = productsSection?.showStorformatTab ?? true;

    return <div className="min-h-screen flex flex-col">
        <Header />

        {/* Main content - HeroSlider uses negative margin to slide under the Header */}
        <main className="flex-1" style={{ marginTop: '-80px' }}>
            <HeroSlider />

            {/* Products Section */}
            {showProducts && (
                <section className="py-16" id="produkter">
                    <div className="container mx-auto px-4">
                        {showStorformatTab ? (
                            <Tabs defaultValue="tryksager" className="w-full">
                                <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-12">
                                    <TabsTrigger value="tryksager">Tryksager</TabsTrigger>
                                    <TabsTrigger value="storformat">Storformat print</TabsTrigger>
                                </TabsList>

                                <TabsContent value="tryksager" id="tryksager">
                                    <ProductGrid
                                        category="tryksager"
                                        columns={productColumns}
                                        buttonConfig={productButtonConfig}
                                        backgroundConfig={productBackgroundConfig}
                                        layoutStyle={productLayoutStyle}
                                    />
                                </TabsContent>

                                <TabsContent value="storformat" id="storformat">
                                    <ProductGrid
                                        category="storformat"
                                        columns={productColumns}
                                        buttonConfig={productButtonConfig}
                                        backgroundConfig={productBackgroundConfig}
                                        layoutStyle={productLayoutStyle}
                                    />
                                </TabsContent>
                            </Tabs>
                        ) : (
                            <ProductGrid
                                category="tryksager"
                                columns={productColumns}
                                buttonConfig={productButtonConfig}
                                backgroundConfig={productBackgroundConfig}
                                layoutStyle={productLayoutStyle}
                            />
                        )}
                    </div>
                </section>
            )}

            {/* Content Block Section - Dynamic from branding */}
            {branding?.forside?.contentBlocks?.filter(block => block.enabled).map((block) => (
                <section
                    key={block.id}
                    data-branding-id={block.id}
                    className="bg-secondary py-8"
                >
                    <div className={`container mx-auto px-4 ${block.textAlign === 'center' ? 'text-center' : block.textAlign === 'right' ? 'text-right' : 'text-left'}`}>
                        <div className={`flex flex-col ${block.imageUrl ? (block.imagePosition === 'right' ? 'md:flex-row' : 'md:flex-row-reverse') : ''} gap-8 items-center`}>
                            {/* Text Content */}
                            <div className={`flex-1 ${block.imageUrl ? '' : 'w-full'}`}>
                                {block.heading && (
                                    <h2
                                        className="text-2xl md:text-3xl font-semibold"
                                        style={{
                                            fontFamily: `'${block.headingFont || 'Poppins'}', sans-serif`,
                                            color: block.headingColor || '#1F2937'
                                        }}
                                    >
                                        {block.heading}
                                    </h2>
                                )}
                                {block.text && (
                                    <p
                                        className="mt-4"
                                        style={{
                                            fontFamily: `'${block.textFont || 'Inter'}', sans-serif`,
                                            color: block.textColor || '#4B5563'
                                        }}
                                    >
                                        {block.text}
                                    </p>
                                )}
                            </div>
                            {/* Optional Image */}
                            {block.imageUrl && (
                                <div className="flex-1">
                                    <img
                                        src={block.imageUrl}
                                        alt={block.heading || 'Content image'}
                                        className="rounded-lg max-h-64 object-cover mx-auto"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            ))}

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
