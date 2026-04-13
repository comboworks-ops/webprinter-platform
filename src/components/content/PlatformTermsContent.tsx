import { PLATFORM_TERMS_VERSION } from "@/lib/legal/platformLegal";

const platformTermsSections = [
  {
    title: "1. Aftale og målgruppe",
    paragraphs: [
      "Disse handelsbetingelser gælder for køb af Webprinter Platform og relaterede ydelser mellem Webprinter.dk og det tilmeldte trykkeri, medmindre andet er aftalt skriftligt. Når du sælger B2B, bør salgs og leveringsbetingelser være en del af aftalegrundlaget.",
      "Webprinter Platform er primært rettet mod erhvervskunder. Ved bestilling eller tilmelding accepterer du disse betingelser.",
    ],
  },
  {
    title: "2. Bestilling",
    paragraphs: [
      "En bestilling er bindende, når den er gennemført i onboarding eller anden aftalt bestillingsproces, og du har modtaget ordrebekræftelse. Vi forbeholder os ret til at kontakte dig ved manglende oplysninger eller behov for afklaring.",
    ],
  },
  {
    title: "3. Priser og betaling",
    paragraphs: [
      "Alle priser er angivet i DKK og ekskl. moms. Fragt og tredjepartsomkostninger kan være en separat post afhængigt af aftalt opsætning og leverance.",
      "Betaling sker med de betalingsmetoder, der tilbydes ved bestilling eller aftale. Ved faktura gælder betalingsfrist 8 dage, og ved forsinket betaling kan der påløbe renter og gebyr efter gældende regler.",
    ],
  },
  {
    title: "4. Trykfiler og produktionsgrundlag",
    paragraphs: [
      "Du er ansvarlig for at levere trykfiler i korrekt format, opløsning, farverum og med korrekt beskæring, sikkerhedsafstand og skrifter, medmindre du har bestilt grafisk assistance.",
      "Vi behandler som udgangspunkt de filer og data, du uploader eller stiller til rådighed via platformen. Hvis materiale ikke er egnet, kan det påvirke resultatet.",
    ],
  },
  {
    title: "5. Korrektur og godkendelse",
    paragraphs: [
      "Hvis der tilbydes digital korrektur, er det dit ansvar at kontrollere tekst, layout, placering og versioner før godkendelse. Produktion eller videre behandling starter fra det tidspunkt, hvor korrektur er godkendt, og betaling er registreret, medmindre andet er aftalt.",
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
      "Levering sker til den adresse eller det setup, der er aftalt. Risikoen for fysiske leverancer overgår ved levering. Leveringstider er vejledende, medmindre andet er aftalt skriftligt. Forsinkelser hos fragtfører eller underleverandører kan forekomme.",
    ],
  },
  {
    title: "8. Ændring og annullering",
    paragraphs: [
      "Ydelser og tryksager produceres typisk efter kundens specifikationer. Når produktionen eller opsætningen er sat i gang, kan bestillingen normalt ikke ændres eller annulleres uden omkostninger. Hvis annullering accepteres, kan du blive faktureret for allerede udført arbejde, materialer og omkostninger.",
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
      "Du garanterer, at du har rettigheder til de materialer, du uploader eller bruger i platformen, herunder billeder, logoer, fonte og grafiske elementer, og at brugen ikke krænker tredjemands rettigheder.",
    ],
  },
  {
    title: "12. Persondata",
    paragraphs: [
      "Behandling af personoplysninger sker efter vores privatlivspolitik. Hvis du bruger platformen som trykkeri, kan Webprinter fungere som databehandler for ordredata, og særskilt databehandleraftale kan være relevant.",
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

export const PlatformTermsContent = () => {
  return (
    <div className="container px-4 mx-auto">
      <article className="max-w-3xl mx-auto space-y-10">
        <header className="space-y-4">
          <h1 className="text-4xl font-bold">Platformvilkår</h1>
          <p className="text-sm text-muted-foreground">Version {PLATFORM_TERMS_VERSION}</p>
          <p className="text-muted-foreground leading-relaxed">
            Disse vilkår gælder mellem Webprinter.dk og trykkerier eller andre erhvervskunder, der bestiller eller
            bruger Webprinter Platform som tenant.
          </p>
        </header>

        <div className="space-y-6">
          {platformTermsSections.map((section) => (
            <section key={section.title} className="rounded-lg border border-border/60 p-6 space-y-3">
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              <div className="space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-muted-foreground leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="rounded-lg bg-muted p-6">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Spørgsmål til platformvilkår kan sendes til{" "}
            <a href="mailto:info@webprinter.dk" className="text-primary hover:underline">
              info@webprinter.dk
            </a>{" "}
            eller{" "}
            <a href="tel:+4571991110" className="text-primary hover:underline">
              71 99 11 10
            </a>
            .
          </p>
        </div>
      </article>
    </div>
  );
};
