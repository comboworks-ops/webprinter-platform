const termsSections = [
  {
    title: "1. Aftale og målgruppe",
    paragraphs: [
      "Disse handelsbetingelser gælder for køb af tryksager og relaterede ydelser via Webprinter.dk, medmindre andet er aftalt skriftligt. Når du sælger B2B, bør salgs og leveringsbetingelser være en del af aftalegrundlaget.",
      "Webprinter.dk er primært rettet mod erhvervskunder. Ved afgivelse af ordre accepterer du disse betingelser.",
    ],
  },
  {
    title: "2. Bestilling",
    paragraphs: [
      "En ordre er bindende, når den er gennemført i checkout, og du har modtaget ordrebekræftelse. Vi forbeholder os ret til at kontakte dig ved manglende oplysninger, uklare filer eller behov for afklaring.",
    ],
  },
  {
    title: "3. Priser og betaling",
    paragraphs: [
      "Alle priser er angivet i DKK og ekskl. moms. Fragt kan være en separat post afhængigt af produkt og leveringsform.",
      "Betaling sker med de betalingsmetoder, der tilbydes ved bestilling. Ved faktura gælder betalingsfrist 8 dage, og ved forsinket betaling kan der påløbe renter og gebyr efter gældende regler.",
    ],
  },
  {
    title: "4. Trykfiler og produktionsgrundlag",
    paragraphs: [
      "Du er ansvarlig for at levere trykfiler i korrekt format, opløsning, farverum og med korrekt beskæring, sikkerhedsafstand og skrifter, medmindre du har bestilt grafisk assistance.",
      "Vi trykker som udgangspunkt ud fra de filer, du uploader. Hvis filen ikke er trykegnet, kan det påvirke resultatet.",
    ],
  },
  {
    title: "5. Korrektur og godkendelse",
    paragraphs: [
      "Hvis der tilbydes digital korrektur, er det dit ansvar at kontrollere tekst, layout, placering og versioner før godkendelse. Produktionen starter fra det tidspunkt, hvor korrektur er godkendt, og betaling er registreret, medmindre andet er aftalt.",
    ],
  },
  {
    title: "6. Farver, tolerancer og afvigelser",
    paragraphs: [
      "Tryk er en produktionsproces, og der kan forekomme mindre afvigelser i farver og beskæring i forhold til skærmvisning og tidligere oplag.",
      "Hvis der er tale om oplag, kan der forekomme over eller underlevering inden for almindelig branchetolerance, fx op til 10 procent, medmindre andet er aftalt.",
    ],
  },
  {
    title: "7. Levering og risiko",
    paragraphs: [
      "Levering sker til den adresse, du oplyser. Risikoen for varen overgår ved levering. Leveringstider er vejledende, medmindre andet er aftalt skriftligt. Forsinkelser hos fragtfører kan forekomme.",
    ],
  },
  {
    title: "8. Ændring og annullering",
    paragraphs: [
      "Tryksager produceres typisk efter kundens specifikationer. Når produktionen er sat i gang, kan ordren normalt ikke ændres eller annulleres uden omkostninger. Hvis annullering accepteres, kan du blive faktureret for allerede udført arbejde, materialer og omkostninger.",
    ],
  },
  {
    title: "9. Reklamation",
    paragraphs: [
      "Bestilleren skal ved modtagelsen foretage en sådan undersøgelse af leverancen, som ordentlig forretningsbrug kræver.",
      "Synlige fejl og mangler skal reklameres skriftligt straks og senest 8 dage efter levering, og altid før varen tages i brug eller videredistribueres.",
      "Skjulte fejl og mangler skal reklameres uden ugrundet ophold efter, at de er eller burde være opdaget.",
      "Ved berettiget reklamation kan vi vælge at omtrykke, afhjælpe eller yde forholdsmæssigt afslag.",
    ],
  },
  {
    title: "10. Ansvarsbegrænsning",
    paragraphs: [
      "Vi er ikke ansvarlige for indirekte tab, herunder driftstab, tabt fortjeneste, tab af data eller følgeskader, medmindre andet følger af ufravigelig ret.",
      "Vores samlede ansvar er begrænset til ordrebeløbet for den pågældende ordre, medmindre andet er aftalt.",
    ],
  },
  {
    title: "11. Rettigheder til indhold",
    paragraphs: [
      "Du garanterer, at du har rettigheder til de materialer, du uploader, herunder billeder, logoer, fonte og grafiske elementer, og at brugen ikke krænker tredjemands rettigheder.",
    ],
  },
  {
    title: "12. Persondata",
    paragraphs: [
      "Behandling af personoplysninger sker efter vores privatlivspolitik. Hvis du handler via et trykkeri på platformen, kan det være trykkeriets privatlivspolitik der gælder for ordredata.",
    ],
  },
  {
    title: "13. Force majeure",
    paragraphs: [
      "Vi er ikke ansvarlige for manglende opfyldelse ved forhold uden for vores kontrol, herunder brand, strejke, myndighedspåbud, nedbrud hos underleverandører, forsyningssvigt eller ekstraordinære hændelser.",
    ],
  },
  {
    title: "14. Lovvalg og værneting",
    paragraphs: [
      "Aftalen er underlagt dansk ret.",
      "Tvister afgøres ved sælgers hjemting, pt. Retten i Randers, som første instans, medmindre andet følger af ufravigelige regler.",
    ],
  },
];

export const TermsContent = () => {
  return (
    <div className="container mx-auto px-4">
      <article className="max-w-3xl mx-auto space-y-10">
        <header className="space-y-4">
          <h1 data-branding-id="typography.heading" className="text-4xl md:text-5xl font-heading font-bold">
            Handelsbetingelser
          </h1>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Disse handelsbetingelser gælder for køb af tryksager og relaterede ydelser via Webprinter.dk, medmindre
            andet er aftalt skriftligt.
          </p>
        </header>

        <div className="space-y-6">
          {termsSections.map((section) => (
            <section key={section.title} data-branding-id="colors.card" className="rounded-lg border border-border/60 p-6 space-y-3">
              <h2 data-branding-id="typography.heading" className="text-2xl font-heading font-semibold">
                {section.title}
              </h2>
              <div className="space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div data-branding-id="colors.card" className="rounded-lg bg-muted p-6">
          <p data-branding-id="typography.body" className="text-sm text-muted-foreground leading-relaxed">
            Har du spørgsmål til vores betingelser? Kontakt os på{" "}
            <a data-branding-id="colors.linkText" href="tel:+4571991110" className="text-primary hover:underline">
              71 99 11 10
            </a>{" "}
            eller{" "}
            <a data-branding-id="colors.linkText" href="mailto:info@webprinter.dk" className="text-primary hover:underline">
              info@webprinter.dk
            </a>
            .
          </p>
        </div>
      </article>
    </div>
  );
};
