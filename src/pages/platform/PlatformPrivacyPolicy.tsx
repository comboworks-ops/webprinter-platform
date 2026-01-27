/**
 * Platform Privacy Policy Page
 * 
 * Platform-only privacy policy (independent of demo shop).
 */

import PlatformHeader from "@/components/platform/PlatformHeader";
import PlatformFooter from "@/components/platform/PlatformFooter";
import { SEO } from "@/components/SEO";

const PlatformPrivacyPolicy = () => {
    return (
        <div className="min-h-screen flex flex-col font-sans">
            <SEO
                title="Privatlivspolitik | Webprinter Platform"
                description="Læs om hvordan Webprinter Platform behandler dine persondata."
            />
            <PlatformHeader />

            {/* Content */}
            <main className="flex-1 pt-32 pb-16">
                <div className="container px-4 mx-auto max-w-3xl">
                    <h1 className="text-4xl font-bold mb-8">Privatlivspolitik</h1>

                    <div className="prose prose-gray max-w-none">
                        <p className="text-muted-foreground mb-6">
                            Sidst opdateret: Januar 2026
                        </p>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">1. Dataansvarlig</h2>
                        <p className="mb-4">
                            Webprinter.dk er dataansvarlig for behandlingen af de personoplysninger,
                            som vi modtager om dig. Kontaktoplysninger findes nederst på denne side.
                        </p>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">2. Hvilke oplysninger indsamler vi</h2>
                        <p className="mb-4">
                            Vi indsamler følgende typer af oplysninger:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Kontaktoplysninger (navn, email, telefon)</li>
                            <li>Faktureringsoplysninger</li>
                            <li>Tekniske data (IP-adresse, browser type)</li>
                            <li>Brugsdata fra vores platform</li>
                        </ul>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">3. Formål med behandlingen</h2>
                        <p className="mb-4">
                            Vi behandler dine personoplysninger til følgende formål:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Levering af vores services</li>
                            <li>Kundesupport</li>
                            <li>Fakturering</li>
                            <li>Forbedring af vores platform</li>
                            <li>Kommunikation om opdateringer og nye funktioner</li>
                        </ul>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">4. Opbevaring af data</h2>
                        <p className="mb-4">
                            Vi opbevarer dine personoplysninger så længe det er nødvendigt for at
                            opfylde de formål, som oplysningerne blev indsamlet til, eller så længe
                            vi er forpligtet til det i henhold til lovgivningen.
                        </p>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">5. Dine rettigheder</h2>
                        <p className="mb-4">
                            Du har ret til at:
                        </p>
                        <ul className="list-disc pl-6 mb-4 space-y-2">
                            <li>Få indsigt i dine personoplysninger</li>
                            <li>Få rettet urigtige oplysninger</li>
                            <li>Få slettet oplysninger</li>
                            <li>Gøre indsigelse mod behandlingen</li>
                            <li>Få udleveret dine oplysninger (dataportabilitet)</li>
                        </ul>

                        <h2 className="text-2xl font-semibold mt-8 mb-4">6. Kontakt</h2>
                        <p className="mb-4">
                            Hvis du har spørgsmål til vores behandling af dine personoplysninger,
                            er du velkommen til at kontakte os:
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

export default PlatformPrivacyPolicy;
