import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SEO } from "@/components/SEO";
import { useShopSettings } from "@/hooks/useShopSettings";
import { TemplatesDownloadSection } from "@/components/TemplatesDownloadSection";
import {
    CheckCircle2,
    AlertTriangle,
    Lightbulb,
    Phone,
    Mail,
    Clock,
    ChevronDown,
    ChevronRight,
    FileText,
    Printer,
    Palette,
    Scissors,
    Layers,
    Sparkles,
    Image as ImageIcon,
    Shirt
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Accordion component for collapsible sections
const Accordion = ({
    title,
    children,
    defaultOpen = false,
    icon: Icon
}: {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    icon?: React.ElementType;
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="border border-border rounded-lg overflow-hidden mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    {Icon && <Icon className="h-5 w-5 text-primary" />}
                    <span className="font-semibold">{title}</span>
                </div>
                {isOpen ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
            </button>
            {isOpen && (
                <div className="p-4 bg-background">
                    {children}
                </div>
            )}
        </div>
    );
};

// Callout box component
const Callout = ({
    type,
    title,
    children
}: {
    type: 'warning' | 'tip' | 'info';
    title: string;
    children: React.ReactNode;
}) => {
    const styles = {
        warning: {
            bg: 'bg-amber-50 dark:bg-amber-950/20',
            border: 'border-amber-200 dark:border-amber-800',
            icon: AlertTriangle,
            iconColor: 'text-amber-600'
        },
        tip: {
            bg: 'bg-green-50 dark:bg-green-950/20',
            border: 'border-green-200 dark:border-green-800',
            icon: Lightbulb,
            iconColor: 'text-green-600'
        },
        info: {
            bg: 'bg-blue-50 dark:bg-blue-950/20',
            border: 'border-blue-200 dark:border-blue-800',
            icon: CheckCircle2,
            iconColor: 'text-blue-600'
        }
    };

    const style = styles[type];
    const Icon = style.icon;

    return (
        <div className={`${style.bg} ${style.border} border rounded-lg p-4 my-4`}>
            <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 ${style.iconColor} shrink-0 mt-0.5`} />
                <div>
                    <p className="font-semibold mb-1">{title}</p>
                    <div className="text-sm text-muted-foreground">{children}</div>
                </div>
            </div>
        </div>
    );
};

// Table of contents item
const TocItem = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <li>
        <a
            href={href}
            className="text-primary hover:underline text-sm"
        >
            {children}
        </a>
    </li>
);

const GrafiskVejledning = () => {
    const { data: settings } = useShopSettings();

    const shopName = settings?.branding?.shop_name || settings?.tenant_name || "Webprinter";
    const company = settings?.company || {};

    // Contact info - use tenant data if available, otherwise placeholders
    const contactPhone = company.phone || "+45 XX XX XX XX";
    const contactEmail = company.email || "support@ditdomæne.dk";
    const openingHours = "Man-Fre: 08:00-16:00";

    return (
        <div className="min-h-screen flex flex-col">
            <SEO
                title={`Grafisk Vejledning | ${shopName}`}
                description="Krav til trykfiler: bleed, PDF, opløsning, CMYK/RGB, spotlak, folie, konturskæring og storformat."
            />
            <Header />

            <main className="flex-1 py-12">
                <div className="container mx-auto px-4 max-w-4xl">
                    {/* Page Header */}
                    <div className="text-center mb-12">
                        <h1 className="text-4xl md:text-5xl font-bold mb-4">Grafisk Vejledning</h1>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            Alt du skal vide for at levere korrekte trykfiler – fra offsettryk til storformat,
                            spotlak, folie og konturskæring.
                        </p>
                    </div>

                    {/* Quick Checklist */}
                    <section id="tjekliste" className="mb-4">
                        <Card className="border-2 border-primary/20 bg-primary/5">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle2 className="h-6 w-6 text-primary" />
                                    Hurtig Tjekliste – Før du sender
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="grid md:grid-cols-2 gap-3">
                                    {[
                                        "PDF-format (helst PDF/X-4)",
                                        "Korrekt færdigt format + beskæring (bleed)",
                                        "CMYK farverum (ikke RGB til offsettryk)",
                                        "Korrekt opløsning (offset vs storformat)",
                                        "Skrifttyper indlejret eller konverteret til kurver",
                                        "Billeder indlejret/linket korrekt",
                                        "Én fil = ét job med korrekt sideantal",
                                        "Filnavn + ordrereference"
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-start gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-1" />
                                            <span className="text-sm">{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </section>

                    {/* Table of Contents */}
                    <nav className="mb-4 p-6 bg-muted/30 rounded-lg">
                        <h2 className="text-lg font-semibold mb-4">Indholdsfortegnelse</h2>
                        <ol className="grid md:grid-cols-2 gap-2 list-decimal list-inside">
                            <TocItem href="#offsettryk">Offsettryk (flyers, foldere, plakater)</TocItem>
                            <TocItem href="#cmyk-rgb">CMYK vs RGB + farveforventninger</TocItem>
                            <TocItem href="#storformat">Storformat / Wide-format</TocItem>
                            <TocItem href="#efterbehandling">Efterbehandling af bannere</TocItem>
                            <TocItem href="#spotlak">Specielle Effekter (Spotlak, Folie, CutContour, Hvidt Blæk)</TocItem>
                            <TocItem href="#trykmetoder">Silketryk vs Digitaltryk</TocItem>
                            <TocItem href="#tekstiltryk">Tekstiltryk: DTG & DTF</TocItem>
                            <TocItem href="#pdf-eksport">PDF-eksport guide</TocItem>
                            <TocItem href="#skabeloner">Skabeloner (PDF)</TocItem>
                            <TocItem href="#kontakt">Support & Kontakt</TocItem>
                        </ol>
                    </nav>

                    {/* Section 1: Offsettryk */}
                    <section id="offsettryk" className="mb-4 scroll-mt-24">
                        <Accordion title="Offsettryk (flyers, foldere, salgsmapper, plakater)" icon={Printer}>
                            <div className="space-y-4">
                                <p className="text-muted-foreground">
                                    Offsettryk er den klassiske metode til professionelt tryk i større oplag.
                                    Her er kravene til dine filer:
                                </p>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="bg-muted/30 p-4 rounded-lg">
                                        <h4 className="font-semibold mb-2">Format & Beskæring</h4>
                                        <ul className="text-sm space-y-1 text-muted-foreground">
                                            <li>• <strong>Færdigt format</strong> = slutmål (trim size)</li>
                                            <li>• <strong>Beskæring (bleed):</strong> 3 mm på alle sider</li>
                                            <li>• <strong>Sikkerhedsmargin:</strong> 3-5 mm fra kant</li>
                                        </ul>
                                    </div>
                                    <div className="bg-muted/30 p-4 rounded-lg">
                                        <h4 className="font-semibold mb-2">Farver & Opløsning</h4>
                                        <ul className="text-sm space-y-1 text-muted-foreground">
                                            <li>• <strong>Farverum:</strong> CMYK (ikke RGB)</li>
                                            <li>• <strong>Opløsning:</strong> 300 dpi ved 1:1</li>
                                            <li>• <strong>Skrifter:</strong> Indlejret eller kurver</li>
                                        </ul>
                                    </div>
                                </div>

                                <Callout type="tip" title="Pro tip: Sort tekst">
                                    Mindre sort tekst skal være 100% K (kun sort). Store sorte flader kan
                                    bruge "rich black" for en dybere sort: C40 M30 Y30 K100.
                                </Callout>

                                <Callout type="warning" title="NB om Rich Black">
                                    Brug kun rich black på større flader – aldrig på lille tekst!
                                    Registreringsforskydning kan gøre teksten uskarpt.
                                </Callout>

                                <h4 className="font-semibold mt-4 mb-2">Øvrige krav</h4>
                                <ul className="text-sm space-y-1 text-muted-foreground">
                                    <li>• Transparenser: PDF/X-4 anbefales. Ved problemer, fladgør transparenser.</li>
                                    <li>• Separate sider med korrekt orientering</li>
                                    <li>• Ingen unødvendige skæremærker medmindre aftalt</li>
                                </ul>
                            </div>
                        </Accordion>
                    </section>

                    {/* Section 2: CMYK vs RGB */}
                    <section id="cmyk-rgb" className="mb-4 scroll-mt-24">
                        <Accordion title="CMYK vs RGB + Farveforventninger" icon={Palette}>
                            <div className="space-y-4">
                                <p className="text-muted-foreground">
                                    Forståelse af farverum er afgørende for at få det trykte resultat, du forventer.
                                </p>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <h4 className="font-semibold mb-2 text-blue-800 dark:text-blue-200">RGB (skærm)</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Bruges til digital visning. Har et bredere farverum med mere intense farver
                                            (neon, elektrisk blå, lys grøn).
                                        </p>
                                    </div>
                                    <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                                        <h4 className="font-semibold mb-2 text-amber-800 dark:text-amber-200">CMYK (tryk)</h4>
                                        <p className="text-sm text-muted-foreground">
                                            Bruges til offsettryk. Kan ikke gengive alle RGB-farver –
                                            især neonfarver bliver mere afdæmpede.
                                        </p>
                                    </div>
                                </div>

                                <Callout type="info" title="Sådan undgår du overraskelser">
                                    Konverter altid til CMYK tidligt i processen og brug soft proof i dit designprogram
                                    til at simulere det trykte resultat. Pantone/spotfarver bruges kun ved særlig aftale.
                                </Callout>

                                <h4 className="font-semibold mt-4 mb-2">Tips til sort</h4>
                                <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                                    <thead className="bg-muted/50">
                                        <tr>
                                            <th className="p-3 text-left">Brug</th>
                                            <th className="p-3 text-left">Anbefaling</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-t border-border">
                                            <td className="p-3">Tekst (lille)</td>
                                            <td className="p-3 font-mono">100% K</td>
                                        </tr>
                                        <tr className="border-t border-border">
                                            <td className="p-3">Store sorte flader</td>
                                            <td className="p-3 font-mono">C40 M30 Y30 K100 (rich black)</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </Accordion>
                    </section>

                    {/* Section 3: Storformat */}
                    <section id="storformat" className="mb-4 scroll-mt-24">
                        <Accordion title="Storformat / Wide-format" icon={ImageIcon}>
                            <div className="space-y-4">
                                <p className="text-muted-foreground">
                                    Bannere, skilte, folie og andre storformatprodukter har andre krav end offsettryk.
                                </p>

                                <div className="bg-muted/30 p-4 rounded-lg">
                                    <h4 className="font-semibold mb-2">Grundlæggende specifikationer</h4>
                                    <ul className="text-sm space-y-2 text-muted-foreground">
                                        <li>• <strong>Skala:</strong> Levér gerne i 1:1 når muligt</li>
                                        <li>• <strong>Opløsning:</strong> 150-200 dpi ved slutstørrelse (lavere end offset pga. betragtningsafstand)</li>
                                        <li>• <strong>Logoer & tekst:</strong> Hold som vektorer for skarphed</li>
                                        <li>• <strong>Beskæring:</strong> Varierer fra produkt til produkt – tjek produktskabelon</li>
                                    </ul>
                                </div>

                                <Callout type="tip" title="Betragtningsafstand">
                                    Jo længere væk produktet ses fra, jo lavere opløsning kan bruges.
                                    Et banner der ses fra 5 meter kan bruge 100 dpi, mens et skilt i øjenhøjde
                                    bør være 150-200 dpi.
                                </Callout>

                                <h4 className="font-semibold mt-4 mb-2">Sikkerhedszoner</h4>
                                <p className="text-sm text-muted-foreground">
                                    Hold vigtig information (tekst, logoer) mindst <strong>20-50 mm</strong> fra
                                    kanten, afhængigt af produktet og efterbehandling. Søm, øjer og ombuk
                                    reducerer det synlige område.
                                </p>
                            </div>
                        </Accordion>
                    </section>

                    {/* Section 4: Efterbehandling */}
                    <section id="efterbehandling" className="mb-4 scroll-mt-24">
                        <Accordion title="Efterbehandling af Bannere" icon={Scissors}>
                            <div className="space-y-4">
                                <p className="text-muted-foreground">
                                    Efterbehandling af bannere påvirker, hvor langt fra kanten dit indhold kan placeres.
                                </p>

                                <div className="grid md:grid-cols-2 gap-4">
                                    {[
                                        { term: "Kant / Ombuk (Hem)", desc: "Kanten foldes bagover for styrke. Reducerer synligt område med 10-20 mm." },
                                        { term: "Forstærkning", desc: "Ekstra lag materiale ved kanter. Hold indhold 20 mm fra kant." },
                                        { term: "Syning (Sewn)", desc: "Syede kanter for holdbarhed. Regn med 15 mm sikkerhedszone." },
                                        { term: "Svejsning (Welded)", desc: "Varmsvejste samlinger. Samme sikkerhedszone som syning." },
                                    ].map((item, i) => (
                                        <div key={i} className="bg-muted/30 p-4 rounded-lg">
                                            <h4 className="font-semibold mb-1">{item.term}</h4>
                                            <p className="text-sm text-muted-foreground">{item.desc}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-muted/30 p-4 rounded-lg">
                                    <h4 className="font-semibold mb-2">Øjer / Eyelets</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Metalringe til ophængning placeres typisk 2-3 cm fra kanten.
                                        Hold vigtig information mindst <strong>50 mm</strong> fra alle kanter
                                        hvor der er øjer.
                                    </p>
                                </div>

                                <Callout type="warning" title="Husk">
                                    Efterbehandling reducerer det "sikre område" for dit design.
                                    Spørg altid om præcise mål for det valgte produkt.
                                </Callout>
                            </div>
                        </Accordion>
                    </section>

                    {/* Section 5: Specielle Effekter (Spotlak, Folie, CutContour, White Ink) */}
                    <section id="spotlak" className="mb-4 scroll-mt-24">
                        <Accordion title="Specielle Effekter (Spotlak, Folie, CutContour, Hvidt Blæk)" icon={Sparkles}>
                            <div className="space-y-6">

                                {/* Spotlak */}
                                <div id="spotlak-content" className="border border-border rounded-lg p-4">
                                    <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-primary" />
                                        Spotlak / Partiel UV
                                    </h4>
                                    <div className="space-y-4">
                                        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                                            <li><strong>Opret et separat lag</strong> til spotlak-områder (f.eks. "SPOT_UV")</li>
                                            <li><strong>Opret en spotfarve</strong> med navnet "SPOT_UV" eller "VARNISH"</li>
                                            <li>Fyld områder med <strong>100%</strong> af denne spotfarve (= fuld effekt)</li>
                                            <li>Brug <strong>vektorformer</strong> hvor muligt for skarpe kanter</li>
                                            <li>Sæt spotfarvelaget til <strong>overprint</strong> (vigtigt!)</li>
                                        </ol>
                                        <Callout type="warning" title="Minimumsstørrelser">
                                            <ul className="list-disc list-inside mt-1">
                                                <li>Linjer: minimum 0.5 mm tykkelse</li>
                                                <li>Tekst: minimum 8 pt</li>
                                                <li>Hold spotlak 2-3 mm fra beskæringskant og foldninger</li>
                                            </ul>
                                        </Callout>
                                    </div>
                                </div>

                                {/* Folie */}
                                <div id="folie" className="border border-border rounded-lg p-4">
                                    <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-primary" />
                                        Folie (Guld/Sølv)
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                                                <h5 className="font-semibold mb-2">Guld folie</h5>
                                                <p className="text-sm text-muted-foreground">
                                                    Spotfarve: <code className="bg-muted px-1 rounded">FOIL_GOLD</code>
                                                </p>
                                            </div>
                                            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-gray-300 dark:border-gray-700">
                                                <h5 className="font-semibold mb-2">Sølv folie</h5>
                                                <p className="text-sm text-muted-foreground">
                                                    Spotfarve: <code className="bg-muted px-1 rounded">FOIL_SILVER</code>
                                                </p>
                                            </div>
                                        </div>
                                        <h5 className="font-semibold">Krav til artwork</h5>
                                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                                            <li>Folieområder skal være <strong>vektorer</strong></li>
                                            <li>100% spotfarve = fuld folie</li>
                                            <li><strong>Ingen gradienter</strong> (medmindre særlig aftale)</li>
                                            <li>Minimum linjetykkelse: <strong>0.5 mm</strong></li>
                                            <li>Minimum teksthøjde: <strong>10 pt</strong></li>
                                        </ul>
                                    </div>
                                </div>

                                {/* Konturskæring */}
                                <div id="konturskæring" className="border border-border rounded-lg p-4">
                                    <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                        <Scissors className="h-4 w-4 text-primary" />
                                        Konturskæring / CutContour
                                    </h4>
                                    <div className="space-y-4">
                                        <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                                            <li><strong>Opret et lag</strong> øverst kaldet "CutContour"</li>
                                            <li>Tegn din skærelinje som en <strong>sti med kun streg</strong> (ingen fyld)</li>
                                            <li>Opret en <strong>spotfarve</strong> kaldet præcis "CutContour"</li>
                                            <li>Indstil farven til <strong>Spot Color</strong> med <strong>100% Magenta</strong></li>
                                            <li>Brug en tynd streg: <strong>0.25-0.5 pt</strong></li>
                                        </ol>
                                        <div className="bg-pink-50 dark:bg-pink-950/20 p-4 rounded-lg border border-pink-200 dark:border-pink-800">
                                            <h5 className="font-semibold mb-2">Spotfarve-indstillinger</h5>
                                            <div className="font-mono text-sm">
                                                <p>Navn: <strong>CutContour</strong></p>
                                                <p>Type: <strong>Spot Color</strong></p>
                                                <p>Farve: <strong>Magenta 100%</strong></p>
                                            </div>
                                        </div>
                                        <Callout type="warning" title="Sikkerhedszoner">
                                            <ul className="list-disc list-inside mt-1">
                                                <li>Hold 2-3 mm beskæring uden for skærelinjen</li>
                                                <li>Hold vigtigt indhold mindst 3 mm inden for skærelinjen</li>
                                            </ul>
                                        </Callout>
                                    </div>
                                </div>

                                {/* Hvidt Blæk */}
                                <div id="hvidt-blæk" className="border border-border rounded-lg p-4">
                                    <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-primary" />
                                        Hvidt Blæk (White Ink)
                                    </h4>
                                    <div className="space-y-4">
                                        <p className="text-sm text-muted-foreground">
                                            Hvidt blæk bruges til tryk på gennemsigtige eller mørke materialer.
                                        </p>
                                        <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                                            <li>Opret et separat lag kaldet "WHITE"</li>
                                            <li>Opret en spotfarve med navnet "WHITE"</li>
                                            <li>100% = fuld hvid dækning</li>
                                        </ol>
                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="bg-muted/30 p-4 rounded-lg">
                                                <h5 className="font-semibold mb-2">Anvendelser</h5>
                                                <ul className="text-sm text-muted-foreground space-y-1">
                                                    <li>• Tryk på transparent folie</li>
                                                    <li>• Bagtryk på vinduesfolie</li>
                                                    <li>• Base under farver på mørkt materiale</li>
                                                </ul>
                                            </div>
                                            <div className="bg-muted/30 p-4 rounded-lg">
                                                <h5 className="font-semibold mb-2">Opløsning</h5>
                                                <p className="text-sm text-muted-foreground">
                                                    Match opløsningen på resten af filen.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Accordion>
                    </section>

                    {/* Section 9: Trykmetoder */}
                    <section id="trykmetoder" className="mb-4 scroll-mt-24">
                        <Accordion title="Silketryk vs Digitaltryk" icon={Printer}>
                            <div className="grid md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Silketryk (Screen Print)</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="text-sm text-muted-foreground space-y-2">
                                            <li>✓ Stærke, holdbare farver</li>
                                            <li>✓ Specialfarver (neon, metallic)</li>
                                            <li>✓ Bedst til begrænsede farver</li>
                                            <li>✓ Meget holdbart</li>
                                            <li>• Opsætningsomkostninger (film/rammer)</li>
                                            <li>• Bedst til større oplag</li>
                                        </ul>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle className="text-lg">Digitaltryk</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <ul className="text-sm text-muted-foreground space-y-2">
                                            <li>✓ Fuld farve / fotorealistisk</li>
                                            <li>✓ Variable data muligt</li>
                                            <li>✓ Hurtig leveringstid</li>
                                            <li>✓ Økonomisk ved små oplag</li>
                                            <li>• CMYK-baseret (nogle farver begrænset)</li>
                                        </ul>
                                    </CardContent>
                                </Card>
                            </div>
                        </Accordion>
                    </section>

                    {/* Section 10: Tekstiltryk DTG & DTF */}
                    <section id="tekstiltryk" className="mb-4 scroll-mt-24">
                        <Accordion title="Tekstiltryk: DTG & DTF (tøjtryk)" icon={Shirt}>
                            <div className="space-y-4">
                                <p className="text-muted-foreground">
                                    DTG og DTF er de to mest populære metoder til digitalt tekstiltryk.
                                    Her finder du krav til dine filer for begge metoder.
                                </p>

                                {/* DTG Sub-section */}
                                <div className="border border-border rounded-lg p-4">
                                    <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                        <Shirt className="h-4 w-4 text-primary" />
                                        DTG (Direct-to-Garment) – krav til filer
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="bg-muted/30 p-4 rounded-lg">
                                            <h5 className="font-semibold mb-2">Hvad er DTG?</h5>
                                            <p className="text-sm text-muted-foreground">
                                                Print direkte på tekstilet med blækprinter. Blækket absorberes af fibrene
                                                og giver et blødt, åndbart resultat.
                                            </p>
                                        </div>

                                        <h5 className="font-semibold">Bedst til</h5>
                                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                            <li>Detaljerede, farvemættede designs med mange farver</li>
                                            <li>Fotorealistiske print</li>
                                            <li>Bomuld og bomuldsblanding (bedst på 100% bomuld)</li>
                                        </ul>

                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="bg-muted/30 p-4 rounded-lg">
                                                <h5 className="font-semibold mb-2">Filformat</h5>
                                                <ul className="text-sm text-muted-foreground space-y-1">
                                                    <li>✓ <strong>Anbefalet:</strong> PNG med transparent baggrund</li>
                                                    <li>• Alternativ: Højkvalitets JPG (ingen transparens)</li>
                                                </ul>
                                            </div>
                                            <div className="bg-muted/30 p-4 rounded-lg">
                                                <h5 className="font-semibold mb-2">Opløsning</h5>
                                                <ul className="text-sm text-muted-foreground space-y-1">
                                                    <li>• <strong>300 dpi</strong> ved slutstørrelse (1:1)</li>
                                                    <li>• Upload i faktisk printstørrelse</li>
                                                </ul>
                                            </div>
                                        </div>

                                        <Callout type="tip" title="Designtips til DTG">
                                            <ul className="list-disc list-inside mt-1">
                                                <li>Undgå meget tynde linjer og lille tekst (under 8 pt)</li>
                                                <li>Tænk på tekstilfarven – lys design på mørk trøje kræver hvid underbase</li>
                                                <li>Hvid underbase håndteres i produktionen – kontakt support ved specielle ønsker</li>
                                            </ul>
                                        </Callout>
                                    </div>
                                </div>

                                {/* DTF Sub-section */}
                                <div className="border border-border rounded-lg p-4">
                                    <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-primary" />
                                        DTF (Direct-to-Film) – krav til filer
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="bg-muted/30 p-4 rounded-lg">
                                            <h5 className="font-semibold mb-2">Hvad er DTF?</h5>
                                            <p className="text-sm text-muted-foreground">
                                                Print på en speciel PET-film, som derefter varmeoverføres (lamineres)
                                                til tekstilet. Giver et holdbart, fleksibelt resultat.
                                            </p>
                                        </div>

                                        <h5 className="font-semibold">Bedst til</h5>
                                        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                            <li>Mange tekstiltyper inkl. polyester, nylon og blandinger</li>
                                            <li>Holdbare transfers til arbejdstøj</li>
                                            <li>Mindre oplag med mange farver</li>
                                        </ul>

                                        <div className="grid md:grid-cols-2 gap-4">
                                            <div className="bg-muted/30 p-4 rounded-lg">
                                                <h5 className="font-semibold mb-2">Filformat</h5>
                                                <ul className="text-sm text-muted-foreground space-y-1">
                                                    <li>✓ <strong>Anbefalet:</strong> PNG med transparent baggrund</li>
                                                    <li>• Alternativ: PDF (vektor)</li>
                                                </ul>
                                            </div>
                                            <div className="bg-muted/30 p-4 rounded-lg">
                                                <h5 className="font-semibold mb-2">Opløsning</h5>
                                                <ul className="text-sm text-muted-foreground space-y-1">
                                                    <li>• <strong>300 dpi</strong> ved slutstørrelse (1:1)</li>
                                                    <li>• Skalér ikke små filer op</li>
                                                </ul>
                                            </div>
                                        </div>

                                        <Callout type="tip" title="Designtips til DTF">
                                            <ul className="list-disc list-inside mt-1">
                                                <li>Undgå ultra-tynde detaljer (kan blive skarpe kanter)</li>
                                                <li>Hold lidt sikkerhedsmargin omkring designet</li>
                                                <li>Upload normalt – spejling håndteres i produktionen</li>
                                            </ul>
                                        </Callout>
                                    </div>
                                </div>

                                {/* Comparison */}
                                <div className="border border-border rounded-lg p-4">
                                    <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                        <Printer className="h-4 w-4 text-primary" />
                                        DTG vs DTF – hvad skal jeg vælge?
                                    </h4>
                                    <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
                                        <thead className="bg-muted/50">
                                            <tr>
                                                <th className="p-3 text-left"></th>
                                                <th className="p-3 text-left">DTG</th>
                                                <th className="p-3 text-left">DTF</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="border-t border-border">
                                                <td className="p-3 font-semibold">Tekstiltype</td>
                                                <td className="p-3">Bedst på bomuld</td>
                                                <td className="p-3">Mange typer (polyester, blanding)</td>
                                            </tr>
                                            <tr className="border-t border-border">
                                                <td className="p-3 font-semibold">Følelse</td>
                                                <td className="p-3">Blæk i stoffet, blødt</td>
                                                <td className="p-3">Transfer-lag, lidt tykkere</td>
                                            </tr>
                                            <tr className="border-t border-border">
                                                <td className="p-3 font-semibold">Holdbarhed</td>
                                                <td className="p-3">God (ved korrekt vask)</td>
                                                <td className="p-3">Meget god / slidstær</td>
                                            </tr>
                                            <tr className="border-t border-border">
                                                <td className="p-3 font-semibold">Bedst til</td>
                                                <td className="p-3">Fotos, gradienter, soft look</td>
                                                <td className="p-3">Logoer, tekst, arbejdstøj</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Support Callout */}
                                <Card className="border border-primary/20 bg-primary/5">
                                    <CardContent className="pt-6">
                                        <div className="flex items-center gap-3">
                                            <Phone className="h-5 w-5 text-primary shrink-0" />
                                            <div>
                                                <p className="font-semibold">Er du i tvivl om DTG eller DTF?</p>
                                                <p className="text-sm text-muted-foreground">
                                                    Kontakt support: <a href={`tel:${contactPhone.replace(/\s/g, '')}`} className="text-primary hover:underline">{contactPhone}</a> eller <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">{contactEmail}</a>
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </Accordion>
                    </section>
                    {/* Section 11: PDF Export */}
                    <section id="pdf-eksport" className="mb-4 scroll-mt-24">
                        <Accordion title="Sådan Eksporterer du en Korrekt PDF" icon={FileText}>
                            <div className="space-y-4">
                                <div className="border border-border rounded-lg p-4">
                                    <h4 className="font-semibold mb-3">Adobe Illustrator</h4>
                                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                                        <li>Gå til <strong>Filer → Gem som</strong></li>
                                        <li>Vælg format: <strong>Adobe PDF (*.pdf)</strong></li>
                                        <li>Vælg preset: <strong>PDF/X-4:2008</strong></li>
                                        <li>Under "Mærker og bleed":
                                            <ul className="list-disc list-inside ml-4 mt-1">
                                                <li>Aktiver <strong>"Brug dokumentbleed"</strong> (eller sæt 3 mm manuelt)</li>
                                                <li>Beskæringsmærker: Kun hvis aftalt</li>
                                            </ul>
                                        </li>
                                        <li>Under "Output": CMYK konvertering</li>
                                        <li>Klik <strong>Gem PDF</strong></li>
                                    </ol>
                                </div>

                                <div className="border border-border rounded-lg p-4">
                                    <h4 className="font-semibold mb-3">Adobe InDesign</h4>
                                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                                        <li>Gå til <strong>Filer → Eksporter</strong></li>
                                        <li>Vælg format: <strong>Adobe PDF (Print)</strong></li>
                                        <li>Vælg preset: <strong>PDF/X-4:2008</strong></li>
                                        <li>Under "Mærker og bleed":
                                            <ul className="list-disc list-inside ml-4 mt-1">
                                                <li>Aktiver <strong>"Brug dokumentbleed"</strong></li>
                                                <li>Eller sæt bleed til 3 mm på alle sider</li>
                                            </ul>
                                        </li>
                                        <li>Under "Output": Vælg CMYK-profil</li>
                                        <li>Klik <strong>Eksporter</strong></li>
                                    </ol>
                                </div>

                                <div className="border border-border rounded-lg p-4">
                                    <h4 className="font-semibold mb-3">Canva</h4>
                                    <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                                        <li>Klik <strong>Del → Download</strong></li>
                                        <li>Vælg filtype: <strong>PDF Print</strong></li>
                                        <li>Aktiver <strong>"Beskæringsmærker og bleed"</strong> (hvis tilgængelig)</li>
                                        <li>Klik <strong>Download</strong></li>
                                    </ol>
                                    <Callout type="warning" title="Bemærk om Canva">
                                        Canva har begrænsninger for professionelt tryk. Tjek at farver er korrekte
                                        og at opløsningen er tilstrækkelig. Overvej professionelle programmer
                                        til krævende jobs.
                                    </Callout>
                                </div>

                                <div className="bg-muted/30 p-4 rounded-lg">
                                    <h4 className="font-semibold mb-2">Generelle tips</h4>
                                    <ul className="text-sm text-muted-foreground space-y-1">
                                        <li>• Inkluder beskæringsmærker kun hvis specifikt aftalt</li>
                                        <li>• Hold filen ren – fjern skjulte lag og ubrugte elementer</li>
                                        <li>• Navngiv filen tydeligt med ordrenummer</li>
                                    </ul>
                                </div>
                            </div>
                        </Accordion>
                    </section>

                    {/* Section 12: Skabeloner (PDF Templates) */}
                    <section id="skabeloner" className="mb-4 scroll-mt-24">
                        <TemplatesDownloadSection />
                    </section>

                    {/* Section 13: Support Contact */}
                    <section id="kontakt" className="mb-4 scroll-mt-24">
                        <Card className="border-2 border-primary/20">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Phone className="h-6 w-6 text-primary" />
                                    Support & Kontakt
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-muted-foreground mb-6">
                                    Har du spørgsmål til filopsætning eller er du i tvivl om noget?
                                    Vi hjælper gerne!
                                </p>

                                <div className="grid md:grid-cols-3 gap-4">
                                    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                        <Phone className="h-5 w-5 text-primary shrink-0" />
                                        <div>
                                            <p className="text-sm text-muted-foreground">Telefon</p>
                                            <a href={`tel:${contactPhone.replace(/\s/g, '')}`} className="font-semibold hover:text-primary">
                                                {contactPhone}
                                            </a>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                        <Mail className="h-5 w-5 text-primary shrink-0" />
                                        <div>
                                            <p className="text-sm text-muted-foreground">Email</p>
                                            <a href={`mailto:${contactEmail}`} className="font-semibold hover:text-primary">
                                                {contactEmail}
                                            </a>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                                        <Clock className="h-5 w-5 text-primary shrink-0" />
                                        <div>
                                            <p className="text-sm text-muted-foreground">Åbningstider</p>
                                            <p className="font-semibold">{openingHours}</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                </div>
            </main>

            <Footer />
        </div>
    );
};

export default GrafiskVejledning;
