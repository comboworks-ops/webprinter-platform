import { useShopSettings } from "@/hooks/useShopSettings";

type TermsSection = {
  title: string;
  paragraphs: string[];
};

export const TermsContent = () => {
  const { data: settings } = useShopSettings();
  const company = (settings?.company || {}) as Record<string, string | null | undefined>;

  const shopName = String(company.name || settings?.tenant_name || "denne webshop").trim();
  const contactEmail = String(company.email || "info@webprinter.dk").trim();
  const contactPhone = String(company.phone || "71 99 11 10").trim();
  const contactAddress = String(company.address || "").trim();
  const contactCvr = String(company.cvr || "").trim();

  const sellerIdentityLines = [
    shopName,
    contactCvr ? `CVR nr: ${contactCvr}` : null,
    contactAddress || null,
    contactEmail ? `Email: ${contactEmail}` : null,
    contactPhone ? `Telefon: ${contactPhone}` : null,
  ].filter(Boolean) as string[];

  const termsSections: TermsSection[] = [
    {
      title: "1. Aftale og parter",
      paragraphs: [
        `Disse handelsbetingelser gælder for køb af tryksager og relaterede ydelser i denne webshop. Aftalen indgås mellem kunden og ${shopName}.`,
        "Hvis du handler som forbruger, gælder ufravigelige regler i forbrugerlovgivningen forud for disse betingelser.",
      ],
    },
    {
      title: "2. Bestilling",
      paragraphs: [
        "En ordre er bindende, når den er gennemført i checkout, og du har modtaget ordrebekræftelse eller anden tydelig bekræftelse på, at ordren er modtaget.",
        "Vi forbeholder os ret til at kontakte dig ved manglende oplysninger, uklare filer eller behov for afklaring, før produktionen sættes i gang.",
      ],
    },
    {
      title: "3. Priser og betaling",
      paragraphs: [
        "Priser, eventuel moms og leveringsomkostninger fremgår af produktsiden og checkout. Eventuelle særlige vilkår for faktura eller anden betalingsform skal fremgå særskilt.",
        "Betaling sker med de betalingsmetoder, der tilbydes ved bestilling. Produktionen starter som udgangspunkt først, når betaling eller anden aftalt godkendelse er registreret.",
      ],
    },
    {
      title: "4. Trykfiler og produktionsgrundlag",
      paragraphs: [
        "Du er ansvarlig for at levere trykfiler i korrekt format, opløsning, farverum og med korrekt beskæring, sikkerhedsafstand og skrifter, medmindre du har bestilt grafisk assistance.",
        "Vi producerer som udgangspunkt ud fra de filer og oplysninger, du uploader eller godkender i bestillingsforløbet. Hvis materialet ikke er egnet til produktion, kan det påvirke resultatet eller kræve afklaring før opstart.",
      ],
    },
    {
      title: "5. Korrektur og godkendelse",
      paragraphs: [
        "Hvis der tilbydes digital korrektur eller preview, er det dit ansvar at kontrollere tekst, layout, placering, størrelser og versioner før godkendelse.",
        "Produktion starter fra det tidspunkt, hvor korrektur er godkendt, og betaling er registreret, medmindre andet er aftalt.",
      ],
    },
    {
      title: "6. Farver, tolerancer og afvigelser",
      paragraphs: [
        "Tryk er en produktionsproces, og der kan forekomme mindre afvigelser i farver, materialer og beskæring i forhold til skærmvisning, prøver eller tidligere oplag.",
        "Ved oplag eller specialproduktion kan der forekomme sædvanlige branchemæssige tolerancer, medmindre andet er aftalt skriftligt.",
      ],
    },
    {
      title: "7. Levering og risiko",
      paragraphs: [
        "Levering sker til den adresse eller modtagelse, der er oplyst i bestillingen. Leveringstider er vejledende, medmindre andet fremgår klart af aftalen.",
        "Forsinkelser hos fragtfører, underleverandører eller i produktionen kan forekomme. Risikoen for fysiske varer overgår ved levering, medmindre ufravigelige regler siger andet.",
      ],
    },
    {
      title: "8. Ændring og annullering",
      paragraphs: [
        "Tryksager og specialproducerede varer fremstilles typisk efter kundens specifikationer. Når produktionen er sat i gang, kan ordren derfor normalt ikke ændres eller annulleres uden omkostninger.",
        "Hvis en annullering accepteres, kan allerede udført arbejde, materialer og andre dokumenterede omkostninger blive opkrævet. Dette begrænser ikke eventuelle ufravigelige forbrugerrettigheder.",
      ],
    },
    {
      title: "9. Reklamation",
      paragraphs: [
        "Du bør kontrollere leverancen hurtigst muligt efter modtagelse.",
        "Hvis du handler som forbruger, gælder købelovens ufravigelige regler om mangler og reklamation.",
        "Hvis du handler som erhvervskunde, skal synlige fejl og mangler reklameres skriftligt straks og senest 8 dage efter levering, og altid før varen tages i brug eller videredistribueres. Skjulte fejl og mangler skal reklameres uden ugrundet ophold efter, at de er eller burde være opdaget.",
        "Ved berettiget reklamation kan vi vælge at omtrykke, afhjælpe eller yde forholdsmæssigt afslag, medmindre andet følger af ufravigelige regler.",
      ],
    },
    {
      title: "10. Ansvarsbegrænsning",
      paragraphs: [
        "Vi er ikke ansvarlige for indirekte tab, herunder driftstab, tabt fortjeneste, tab af data eller følgeskader, medmindre andet følger af ufravigelig ret.",
        "Vores samlede ansvar er som udgangspunkt begrænset til ordrebeløbet for den pågældende ordre, medmindre andet er aftalt eller følger af ufravigelige regler.",
      ],
    },
    {
      title: "11. Rettigheder til indhold",
      paragraphs: [
        "Du garanterer, at du har de nødvendige rettigheder til de materialer, du uploader eller bruger i bestillingen, herunder billeder, logoer, fonte og grafiske elementer, og at brugen ikke krænker tredjemands rettigheder.",
      ],
    },
    {
      title: "12. Persondata",
      paragraphs: [
        "Behandling af personoplysninger sker efter privatlivspolitikken for denne webshop.",
        "Hvis webshoppen drives på Webprinter Platform, kan Webprinter/Printmaker levere system og drift som databehandler eller teknisk underleverandør for den butik, du handler med.",
      ],
    },
    {
      title: "13. Force majeure",
      paragraphs: [
        "Vi er ikke ansvarlige for manglende opfyldelse ved forhold uden for vores kontrol, herunder brand, strejke, myndighedspåbud, nedbrud hos underleverandører, forsyningssvigt eller ekstraordinære hændelser.",
      ],
    },
    {
      title: "14. Lovvalg og tvister",
      paragraphs: [
        "Aftalen er underlagt dansk ret.",
        "Hvis du handler som forbruger, påvirker disse betingelser ikke dine muligheder efter ufravigelige regler. Hvis du handler som erhvervskunde, afgøres tvister ved sælgers hjemting som første instans, medmindre andet følger af ufravigelige regler.",
      ],
    },
  ];

  return (
    <div className="container mx-auto px-4">
      <article className="max-w-3xl mx-auto space-y-10">
        <header className="space-y-4">
          <h1 data-branding-id="typography.heading" className="text-4xl md:text-5xl font-heading font-bold">
            Handelsbetingelser
          </h1>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Disse handelsbetingelser gælder for køb i denne webshop og beskriver rammerne for bestilling, produktion,
            levering og reklamation.
          </p>
        </header>

        <section className="space-y-4">
          <h2 data-branding-id="typography.heading" className="text-2xl md:text-3xl font-heading font-semibold">
            Sælgeroplysninger
          </h2>
          <div data-branding-id="colors.card" className="rounded-lg bg-muted p-6 space-y-2">
            {sellerIdentityLines.map((line) => (
              <p key={line} data-branding-id="typography.body" className="text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
        </section>

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
            Har du spørgsmål til handelsbetingelserne, kan du kontakte{" "}
            <span className="font-medium text-foreground">{shopName}</span>{" "}
            på{" "}
            <a data-branding-id="colors.linkText" href={`tel:${contactPhone.replace(/\s/g, "")}`} className="text-primary hover:underline">
              {contactPhone}
            </a>{" "}
            eller{" "}
            <a data-branding-id="colors.linkText" href={`mailto:${contactEmail}`} className="text-primary hover:underline">
              {contactEmail}
            </a>
            .
          </p>
        </div>
      </article>
    </div>
  );
};
