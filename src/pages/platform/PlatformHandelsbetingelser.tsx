/**
 * Platform Handelsbetingelser (Terms of Service) Page
 * 
 * Platform-only terms of service (independent of demo shop).
 */

import PlatformHeader from "@/components/platform/PlatformHeader";
import PlatformFooter from "@/components/platform/PlatformFooter";
import { SEO } from "@/components/SEO";
import { PlatformTermsContent } from "@/components/content/PlatformTermsContent";

const PlatformHandelsbetingelser = () => {
    return (
        <div className="min-h-screen flex flex-col font-sans">
            <SEO
                title="Platformvilkår | Webprinter Platform"
                description="Læs vilkårene for trykkerier og andre erhvervskunder, der bestiller eller bruger Webprinter Platform."
            />
            <PlatformHeader />

            {/* Content */}
            <main className="flex-1 pt-32 pb-16">
                <PlatformTermsContent />
            </main>

            <PlatformFooter />
        </div>
    );
};

export default PlatformHandelsbetingelser;
