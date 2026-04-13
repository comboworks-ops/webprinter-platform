const informationTypes = [
  {
    title: "Besøg på hjemmeside",
    body: "IP adresse, enheds og browserdata, sidevisninger, henvisningskilder, samt cookies og lignende teknologier.",
  },
  {
    title: "Kontakt og dialog",
    body: "Navn, virksomhed, email, telefon, samt indholdet af din henvendelse.",
  },
  {
    title: "Konto og login",
    body: "Navn, email, adgangsstyring, logdata og handlinger i systemet.",
  },
  {
    title: "Bestilling og levering",
    body: "Kontaktperson, leveringsadresse, fakturaoplysninger, ordredata, filer du uploader samt kommunikation om produktionen.",
  },
  {
    title: "Support",
    body: "Supporthistorik, relevante filer og oplysninger du deler for at vi kan løse en sag.",
  },
];

const processingPurposes = [
  "At levere og drifte webshop og platform, herunder login, funktionalitet og sikkerhed (legitim interesse)",
  "At håndtere bestillinger, produktion, levering og fakturering (aftale)",
  "At svare på henvendelser og yde support (aftale eller legitim interesse)",
  "At forbedre oplevelsen og måle brugen af siden via statistik, hvis du giver samtykke (samtykke)",
  "At overholde lovkrav, fx bogføring og dokumentation (retlig forpligtelse)",
];

const recipients = [
  "Hosting og infrastruktur",
  "Email og supportværktøjer",
  "Betalingsløsninger",
  "Fragt og levering",
  "Analyseværktøjer (kun hvis du har givet samtykke)",
];

const retentionRules = [
  "Ordre og fakturadata opbevares efter bogføringskrav",
  "Konti og logdata slettes eller anonymiseres efter rimelig periode, når de ikke længere bruges",
  "Henvendelser og supporthistorik slettes løbende, når de ikke længere er relevante",
];

export const PrivacyPolicyContent = () => {
  return (
    <div className="container mx-auto px-4">
      <article className="max-w-3xl mx-auto space-y-10">
        <header className="space-y-4">
          <h1 data-branding-id="typography.heading" className="text-4xl md:text-5xl font-heading font-bold">
            Privatlivspolitik
          </h1>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Når du besøger Webprinter.dk eller kontakter os, behandler vi personoplysninger som dataansvarlig.
          </p>
        </header>

        <section className="space-y-4">
          <h2 data-branding-id="typography.heading" className="text-2xl md:text-3xl font-heading font-semibold">
            1. Dataansvarlig
          </h2>
          <div data-branding-id="colors.card" className="rounded-lg bg-muted p-6 space-y-2">
            <p data-branding-id="typography.body" className="text-muted-foreground">
              Webprinter.dk drives af:
            </p>
            <p data-branding-id="typography.body" className="text-muted-foreground">
              Virksomhed: Printmaker ApS
            </p>
            <p data-branding-id="typography.body" className="text-muted-foreground">
              CVR nr: 42683043
            </p>
            <p data-branding-id="typography.body" className="text-muted-foreground">
              Adresse: Stationsvej 17, 8544 Mørke
            </p>
            <p data-branding-id="typography.body" className="text-muted-foreground">
              Email: info@webprinter.dk
            </p>
            <p data-branding-id="typography.body" className="text-muted-foreground">
              Telefon: 71 99 11 10
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <h2 data-branding-id="typography.heading" className="text-2xl md:text-3xl font-heading font-semibold">
            2. Når Webprinter er databehandler for et trykkeri
          </h2>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Hvis du bestiller tryksager i en shop, der kører på Webprinter Platform, er det typisk det pågældende
            trykkeri, der er dataansvarlig for kundeoplysninger i forbindelse med købet. Webprinter kan i den situation
            fungere som databehandler, fordi vi leverer systemet og drifter løsningen.
          </p>
        </section>

        <section className="space-y-4">
          <h2 data-branding-id="typography.heading" className="text-2xl md:text-3xl font-heading font-semibold">
            3. Hvilke oplysninger vi behandler
          </h2>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Vi kan behandle følgende typer oplysninger, afhængigt af hvordan du bruger siden:
          </p>
          <div className="space-y-4">
            {informationTypes.map((item) => (
              <div key={item.title} data-branding-id="colors.card" className="rounded-lg border border-border/60 p-4">
                <h3 data-branding-id="typography.heading" className="font-heading text-lg font-semibold">
                  {item.title}
                </h3>
                <p data-branding-id="typography.body" className="mt-2 text-muted-foreground leading-relaxed">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 data-branding-id="typography.heading" className="text-2xl md:text-3xl font-heading font-semibold">
            4. Formål og behandlingsgrundlag
          </h2>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Vi behandler personoplysninger til følgende formål:
          </p>
          <ul data-branding-id="typography.body" className="list-disc pl-6 space-y-2 text-muted-foreground">
            {processingPurposes.map((purpose) => (
              <li key={purpose}>{purpose}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 data-branding-id="typography.heading" className="text-2xl md:text-3xl font-heading font-semibold">
            5. Modtagere og databehandlere
          </h2>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Vi kan dele oplysninger med leverandører, der hjælper os med drift og levering, fx:
          </p>
          <ul data-branding-id="typography.body" className="list-disc pl-6 space-y-2 text-muted-foreground">
            {recipients.map((recipient) => (
              <li key={recipient}>{recipient}</li>
            ))}
          </ul>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Vi sikrer databehandleraftaler, hvor det er relevant.
          </p>
        </section>

        <section className="space-y-4">
          <h2 data-branding-id="typography.heading" className="text-2xl md:text-3xl font-heading font-semibold">
            6. Overførsel til lande uden for EU/EØS
          </h2>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Hvis vi bruger leverandører uden for EU/EØS, sker det kun med et gyldigt overførselsgrundlag, fx EU
            Kommissionens standardkontrakter.
          </p>
        </section>

        <section className="space-y-4">
          <h2 data-branding-id="typography.heading" className="text-2xl md:text-3xl font-heading font-semibold">
            7. Opbevaring og sletning
          </h2>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Vi opbevarer kun oplysninger så længe det er nødvendigt:
          </p>
          <ul data-branding-id="typography.body" className="list-disc pl-6 space-y-2 text-muted-foreground">
            {retentionRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-4">
          <h2 data-branding-id="typography.heading" className="text-2xl md:text-3xl font-heading font-semibold">
            8. Dine rettigheder
          </h2>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Du har ret til indsigt, rettelse, sletning, begrænsning, dataportabilitet og indsigelse i det omfang
            reglerne giver mulighed. Du kan også trække samtykke tilbage når som helst.
          </p>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Kontakt os på{" "}
            <a data-branding-id="colors.linkText" href="mailto:info@webprinter.dk" className="text-primary hover:underline">
              info@webprinter.dk
            </a>{" "}
            for at udøve dine rettigheder.
          </p>
        </section>

        <section className="space-y-4">
          <h2 data-branding-id="typography.heading" className="text-2xl md:text-3xl font-heading font-semibold">
            9. Sikkerhed
          </h2>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Vi arbejder med tekniske og organisatoriske sikkerhedsforanstaltninger, herunder adgangsstyring, logning og
            løbende vedligehold, for at beskytte data mod tab og misbrug.
          </p>
        </section>

        <section className="space-y-4">
          <h2 data-branding-id="typography.heading" className="text-2xl md:text-3xl font-heading font-semibold">
            10. Klage
          </h2>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Du kan klage til Datatilsynet, hvis du mener vi behandler dine oplysninger i strid med reglerne.
          </p>
        </section>

        <section className="space-y-4">
          <h2 data-branding-id="typography.heading" className="text-2xl md:text-3xl font-heading font-semibold">
            11. Ændringer
          </h2>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Vi kan opdatere denne privatlivspolitik, hvis vores løsning eller krav ændrer sig. Den nyeste version vil
            altid ligge på Webprinter.dk.
          </p>
        </section>
      </article>
    </div>
  );
};
