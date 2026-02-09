import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useShopSettings } from "@/hooks/useShopSettings";
import { getPageBackgroundStyle } from "@/lib/branding/background";

const Terms = () => {
  const { data: settings } = useShopSettings();
  const pageBackgroundStyle = getPageBackgroundStyle(settings?.branding);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-16" style={pageBackgroundStyle}>
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-heading font-bold mb-12">Generelle salgsbetingelser</h1>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="aftale">
                <AccordionTrigger>1. Aftaleindgåelse</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  En aftale om køb af tryksager eller storformat print indgås, når Webprinter.dk har bekræftet din ordre
                  skriftligt pr. e-mail eller telefon. Alle tilbud er uforpligtende, medmindre andet er aftalt.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="priser">
                <AccordionTrigger>2. Priser</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Alle priser er angivet i danske kroner ekskl. moms, medmindre andet er anført. Vi forbeholder os ret til
                  prisændringer uden forudgående varsel. Den pris, der gælder på tidspunktet for din ordrebekræftelse, er
                  den endelige pris.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="betaling">
                <AccordionTrigger>3. Betaling</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Betaling skal ske ved ordreafgivelse via bankoverførsel, kreditkort eller faktura (kun for erhvervskunder
                  med aftale). Ved manglende betaling forbeholder vi os ret til at tilbageholde varen, indtil betalingen er
                  modtaget.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="levering">
                <AccordionTrigger>4. Levering</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Leveringstider er vejledende og afhænger af det valgte produkt og leveringsmetode. Standard levering er
                  2-5 hverdage, ekspres 1-2 hverdage. Forsinkelser grundet force majeure eller andre omstændigheder uden for
                  vores kontrol kan ikke medføre erstatningskrav.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="reklamation">
                <AccordionTrigger>5. Reklamation</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Hvis du opdager fejl eller mangler ved varen, skal du reklamere straks og senest 8 dage efter modtagelsen.
                  Reklamation sker til support@webprinter.dk. Vi forbeholder os ret til at vurdere reklamationen og beslutte,
                  om der skal ske ombytning, kreditering eller anden kompensation.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="ansvar">
                <AccordionTrigger>6. Ansvar</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Webprinter.dk er ikke ansvarlig for indirekte tab, herunder tabt indtjening eller andre følgeskader. Vores
                  ansvar er begrænset til den betalte købesum for det pågældende produkt.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="fortrydelse">
                <AccordionTrigger>7. Fortrydelsesret</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Da alle vores produkter er specialfremstillede efter kundens specifikationer, er der ingen fortrydelsesret
                  i henhold til købelovens §18, stk. 2, nr. 3. Undtagelser kan kun ske efter konkret vurdering.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="trykfiler">
                <AccordionTrigger>8. Trykfiler og godkendelse</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Kunden er ansvarlig for at levere trykklare filer i de angivne formater (PDF, AI, etc.). Vi tilbyder
                  korrektur og godkendelse før tryk, men kunden bærer det endelige ansvar for indhold, stavefejl og layout.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="gdpr">
                <AccordionTrigger>9. Persondatapolitik (GDPR)</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Vi behandler dine personoplysninger i overensstemmelse med GDPR. Dine oplysninger bruges kun til at
                  behandle din ordre og kommunikere med dig. Vi videregiver aldrig dine data til tredjeparter uden dit
                  samtykke.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="lovvalg">
                <AccordionTrigger>10. Lovvalg og værneting</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Enhver tvist vedrørende disse betingelser er underlagt dansk ret og skal afgøres ved Retten i Aarhus.
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="mt-12 p-6 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Har du spørgsmål til vores betingelser? Kontakt os på{" "}
                <a href="tel:+4571991110" className="text-primary hover:underline">71 99 11 10</a> eller{" "}
                <a href="mailto:support@webprinter.dk" className="text-primary hover:underline">support@webprinter.dk</a>
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Terms;
