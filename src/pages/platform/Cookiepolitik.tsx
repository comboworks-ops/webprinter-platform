/**
 * Cookie Policy Page
 * 
 * Platform cookie policy page.
 */

import PlatformHeader from "@/components/platform/PlatformHeader";
import PlatformFooter from "@/components/platform/PlatformFooter";
import { SEO } from "@/components/SEO";
import { CookiePolicyContent } from "@/components/content/CookiePolicyContent";

const Cookiepolitik = () => {
    return (
        <div className="min-h-screen flex flex-col font-sans">
            <SEO
                title="Cookiepolitik | Webprinter Platform"
                description="Læs om hvordan Webprinter bruger cookies."
            />
            <PlatformHeader />

            {/* Content */}
            <main className="flex-1 pt-32 pb-16">
                <CookiePolicyContent />
            </main>

            <PlatformFooter />
        </div>
    );
};

export default Cookiepolitik;
