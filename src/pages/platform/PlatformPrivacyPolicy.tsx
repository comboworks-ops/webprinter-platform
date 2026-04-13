/**
 * Platform Privacy Policy Page
 * 
 * Platform-only privacy policy (independent of demo shop).
 */

import PlatformHeader from "@/components/platform/PlatformHeader";
import PlatformFooter from "@/components/platform/PlatformFooter";
import { SEO } from "@/components/SEO";
import { PrivacyPolicyContent } from "@/components/content/PrivacyPolicyContent";
import { PLATFORM_PRIVACY_VERSION } from "@/lib/legal/platformLegal";

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
                <div className="space-y-6">
                    <div className="container px-4 mx-auto max-w-3xl">
                        <p className="text-sm text-muted-foreground">Version {PLATFORM_PRIVACY_VERSION}</p>
                    </div>
                    <PrivacyPolicyContent
                        variant="platform"
                        shopName="Webprinter.dk"
                        company={{
                            name: "Printmaker ApS",
                            cvr: "42683043",
                            address: "Stationsvej 17, 8544 Mørke",
                            email: "info@webprinter.dk",
                            phone: "71 99 11 10",
                        }}
                    />
                </div>
            </main>

            <PlatformFooter />
        </div>
    );
};

export default PlatformPrivacyPolicy;
