/**
 * Cookie Policy Page
 * 
 * Platform cookie policy page.
 */

import PlatformHeader from "@/components/platform/PlatformHeader";
import PlatformFooter from "@/components/platform/PlatformFooter";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { useCookieConsent } from "@/components/consent";

const Cookiepolitik = () => {
    const { openSettings } = useCookieConsent();

    return (
        <div className="min-h-screen flex flex-col font-sans">
            <SEO
                title="Cookiepolitik | Webprinter Platform"
                description="Læs om hvordan Webprinter bruger cookies."
            />
            <PlatformHeader />

            {/* Content */}
            <main className="flex-1 pt-32 pb-16">
                <div className="container px-4 mx-auto max-w-3xl">
                    <h1 className="text-4xl font-bold mb-8">Cookiepolitik</h1>

                    <div className="prose prose-gray max-w-none">
                        <p className="text-muted-foreground mb-6">
                            Sidst opdateret: Januar 2026
                        </p>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">Hvad er cookies?</h2>
                        <p className="mb-4">
                            Cookies er små tekstfiler, som gemmes på din computer eller mobilenhed,
                            når du besøger vores hjemmeside. De hjælper os med at huske dine
                            præferencer og forbedre din oplevelse.
                        </p>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">Hvilke cookies bruger vi?</h2>

                        <h3 className="text-xl font-semibold mt-6 mb-3">Nødvendige cookies</h3>
                        <p className="mb-4">
                            Disse cookies er essentielle for at hjemmesiden kan fungere korrekt.
                            De kan ikke deaktiveres. Eksempler inkluderer login-sessions og
                            cookiesamtykke.
                        </p>

                        <h3 className="text-xl font-semibold mt-6 mb-3">Præferencecookies</h3>
                        <p className="mb-4">
                            Disse cookies husker dine valg og tilpasninger, såsom sprog og region.
                        </p>

                        <h3 className="text-xl font-semibold mt-6 mb-3">Statistikcookies</h3>
                        <p className="mb-4">
                            Disse cookies hjælper os med at forstå, hvordan besøgende bruger
                            hjemmesiden, så vi kan forbedre den. Alle data er anonymiserede.
                        </p>

                        <h3 className="text-xl font-semibold mt-6 mb-3">Marketingcookies</h3>
                        <p className="mb-4">
                            Disse cookies bruges til at vise dig relevante annoncer baseret på
                            dine interesser. De kan også bruges til at begrænse antallet af
                            gange du ser en annonce.
                        </p>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">Sådan administrerer du cookies</h2>
                        <p className="mb-4">
                            Du kan til enhver tid ændre dine cookieindstillinger ved at klikke
                            på knappen nedenfor eller via linket "Cookieindstillinger" i
                            bunden af siden.
                        </p>

                        <Button onClick={openSettings} variant="outline">
                            Åbn cookieindstillinger
                        </Button>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">Kontakt</h2>
                        <p className="mb-4">
                            Har du spørgsmål om vores brug af cookies, er du velkommen til at
                            kontakte os på{' '}
                            <a href="mailto:info@webprinter.dk" className="text-primary hover:underline">
                                info@webprinter.dk
                            </a>
                        </p>
                    </div>
                </div>
            </main>

            <PlatformFooter />
        </div>
    );
};

export default Cookiepolitik;
