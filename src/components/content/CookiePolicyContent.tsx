import { Button } from "@/components/ui/button";
import { useCookieConsent } from "@/components/consent";

import { isOnlinetryksagerHost } from '@/lib/analytics/onlinetryksager';

const cookieTypes = [
  {
    title: "Nødvendige",
    body: "Får siden til at fungere, fx sessions, sikkerhed og valg i checkout.",
  },
  {
    title: "Præferencer",
    body: "Husker dine valg, fx sprog og visning.",
  },
  {
    title: "Statistik",
    body: "Hjælper os med at forstå brugen af siden, så vi kan forbedre den.",
  },
  {
    title: "Marketing",
    body: "Bruges til at vise relevant markedsføring og måle kampagner.",
  },
];

export const CookiePolicyContent = () => {
  const { openSettings } = useCookieConsent();
  const usesGoogleAnalytics = isOnlinetryksagerHost(window.location.hostname);

  return (
    <div className="container mx-auto px-4">
      <article className="max-w-3xl mx-auto space-y-10">
        <header className="space-y-4">
          <h1 data-branding-id="typography.heading" className="text-4xl md:text-5xl font-heading font-bold">
            Cookiepolitik
          </h1>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Webprinter.dk bruger cookies og lignende teknologier til at få siden til at fungere, forbedre oplevelsen
            og måle trafik, når du har givet samtykke. Datatilsynet og Digitaliseringsstyrelsen beskriver kravene til
            samtykke og oplysning ved cookies i deres fælles vejledning.
          </p>
        </header>

        <section className="space-y-4">
          <h2 data-branding-id="typography.heading" className="text-2xl md:text-3xl font-heading font-semibold">
            1. Hvad er cookies
          </h2>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Cookies er små tekstfiler, som gemmes på din enhed. De kan bruges til nødvendige funktioner, statistik og
            marketing.
          </p>
        </section>

        <section className="space-y-4">
          <h2 data-branding-id="typography.heading" className="text-2xl md:text-3xl font-heading font-semibold">
            2. Typer af cookies vi kan bruge
          </h2>
          <div className="space-y-4">
            {cookieTypes.map((item) => (
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
            3. Samtykke og ændring af valg
          </h2>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Ikke nødvendige cookies sættes kun, hvis du giver samtykke. Et samtykke skal være frivilligt, specifikt og
            informeret, og det skal være lige så nemt at trække tilbage som at give.
          </p>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            Du kan ændre dit valg via cookieindstillinger eller via din browser.
          </p>
          <Button type="button" variant="outline" onClick={openSettings}>
            Åbn cookieindstillinger
          </Button>
        </section>

        <section className="space-y-4">
          <h2 data-branding-id="typography.heading" className="text-2xl md:text-3xl font-heading font-semibold">
            4. Oversigt over cookies
          </h2>
          <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
            {usesGoogleAnalytics
              ? 'Google Analytics (leveret af Google) måler besøg og sidevisninger på onlinetryksager.dk, når du har accepteret statistikcookies. Cookies _ga og _ga_BKKZ1Q3ECQ genkender browseren og måler sessioner. De udløber efter op til 180 dage fra seneste opdatering. Kontosider, checkout og administration måles ikke med denne forbindelse. Google-signaler og annonceringsfunktioner er slået fra.'
              : 'Vi viser en opdateret liste over cookies i vores cookie banner eller cookie indstillinger, inklusiv formål og udløb.'}
          </p>
          {usesGoogleAnalytics && (
            <p data-branding-id="typography.body" className="text-muted-foreground leading-relaxed">
              Du kan til enhver tid slå statistik fra via cookieindstillinger. Det stopper målingen og fjerner disse Analytics-cookies.
              {' '}<a className="underline" href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">Læs om Googles behandling af data</a>.
            </p>
          )}
        </section>
      </article>
    </div>
  );
};
