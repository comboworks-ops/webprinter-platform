/**
 * Platform Handelsbetingelser (Terms of Service) Page
 * 
 * Platform-only terms of service (independent of demo shop).
 */

import PlatformHeader from "@/components/platform/PlatformHeader";
import PlatformFooter from "@/components/platform/PlatformFooter";
import { SEO } from "@/components/SEO";

const PlatformHandelsbetingelser = () => {
    return (
        <div className="min-h-screen flex flex-col font-sans">
            <SEO
                title="Handelsbetingelser | Webprinter Platform"
                description="Læs vores handelsbetingelser for brug af Webprinter Platform."
            />
            <PlatformHeader />

            {/* Content */}
            <main className="flex-1 pt-32 pb-16">
                <div className="container px-4 mx-auto max-w-3xl">
                    <h1 className="text-4xl font-bold mb-8">Handelsbetingelser</h1>

                    <div className="prose prose-gray max-w-none">
                        <p className="text-muted-foreground mb-6">
                            Sidst opdateret: Januar 2026
                        </p>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">1. Generelt</h2>
                        <p className="mb-4">
                            Disse handelsbetingelser gælder for alle aftaler om abonnement på
                            Webprinter Platform indgået mellem Webprinter.dk og kunden.
                        </p>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">2. Abonnement</h2>
                        <p className="mb-4">
                            Ved tilmelding til Webprinter Platform indgår kunden et abonnement.
                            Abonnementet starter ved tilmelding og fornyes automatisk.
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Månedlige abonnementer faktureres månedligt</li>
                            <li>Årlige abonnementer faktureres én gang årligt</li>
                            <li>Prøveperiode er gratis i 14 dage</li>
                        </ul>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">3. Betaling</h2>
                        <p className="mb-4">
                            Betaling sker forud via de betalingsmetoder, som er tilgængelige
                            på platformen. Alle priser er i danske kroner (DKK) og ekskl. moms.
                        </p>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">4. Opsigelse</h2>
                        <p className="mb-4">
                            Abonnementet kan opsiges til enhver tid. Ved opsigelse fortsætter
                            abonnementet til udløb af den indeværende betalingsperiode.
                        </p>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">5. Ansvar</h2>
                        <p className="mb-4">
                            Webprinter.dk er ikke ansvarlig for tab eller skader opstået som
                            følge af brug af platformen, herunder men ikke begrænset til
                            driftstab, tabt fortjeneste eller datatab.
                        </p>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">6. Ændringer</h2>
                        <p className="mb-4">
                            Webprinter.dk forbeholder sig retten til at ændre disse handelsbetingelser.
                            Væsentlige ændringer vil blive meddelt med mindst 30 dages varsel.
                        </p>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">7. Lovvalg og værneting</h2>
                        <p className="mb-4">
                            Disse handelsbetingelser er underlagt dansk ret. Eventuelle tvister
                            skal afgøres ved de danske domstole.
                        </p>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">8. Kontakt</h2>
                        <p className="mb-4">
                            Ved spørgsmål til disse handelsbetingelser kontakt os på:
                        </p>
                        <p className="mb-4">
                            Email: <a href="mailto:info@webprinter.dk" className="text-primary hover:underline">info@webprinter.dk</a>
                        </p>
                    </div>
                </div>
            </main>

            <PlatformFooter />
        </div>
    );
};

export default PlatformHandelsbetingelser;
