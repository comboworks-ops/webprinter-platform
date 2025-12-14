import { useEffect, useState, useCallback } from "react";
import { useSearchParams, Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, Home, ArrowLeft } from "lucide-react";
import { PreviewBrandingProvider, usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroSlider from "@/components/HeroSlider";
import ProductGrid from "@/components/ProductGrid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Award, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mergeBrandingWithDefaults, type BrandingData } from "@/hooks/useBrandingDraft";

// List of ALLOWED customer-visible routes in preview mode
// This prevents navigation to admin/backend routes
const ALLOWED_PREVIEW_ROUTES = [
    '/',
    '/shop',
    '/produkter',
    '/kontakt',
    '/om-os',
    '/betingelser',
    '/cookies',
    '/privatliv',
    '/vilkaar',
];

// Routes that should be blocked in preview mode
const BLOCKED_ROUTE_PREFIXES = [
    '/admin',
    '/auth',
    '/local-tenant',
    '/setup',
    '/preview-shop', // Prevent infinite loop
    '/preview-storefront',
];

// Helper to convert hex to HSL for CSS variables
function hexToHsl(hex: string): string {
    if (!hex || !hex.startsWith("#")) return "0 0% 0%";

    let c = hex.substring(1).split("");
    if (c.length === 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    const r = parseInt(c.slice(0, 2).join(""), 16) / 255;
    const g = parseInt(c.slice(2, 4).join(""), 16) / 255;
    const b = parseInt(c.slice(4, 6).join(""), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Preview navigation guard - ensures only customer-visible pages are accessible
 */
function PreviewNavigationGuard({ children }: { children: React.ReactNode }) {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const path = location.pathname;

        // Check if route is blocked
        const isBlocked = BLOCKED_ROUTE_PREFIXES.some(prefix => path.startsWith(prefix));

        if (isBlocked) {
            // Redirect to preview frontpage
            navigate('/preview-shop', { replace: true });
            return;
        }

        // For product pages, we allow /produkt/* routes
        const isProductPage = path.startsWith('/produkt/');
        const isAllowed = ALLOWED_PREVIEW_ROUTES.includes(path) || isProductPage;

        if (!isAllowed && path !== '/preview-shop') {
            // Redirect unknown routes to frontpage in preview
            navigate('/preview-shop', { replace: true });
        }
    }, [location.pathname, navigate]);

    return <>{children}</>;
}

/**
 * The actual shop content with branding applied.
 * This renders the REAL storefront layout with tenant products and branding.
 * IMPORTANT: This must mirror Shop.tsx exactly, with preview branding applied.
 */
function PreviewShopContent() {
    const { branding, tenantName } = usePreviewBranding();

    // Generate CSS variables from branding
    const primaryColor = branding?.colors?.primary || "#0EA5E9";
    const secondaryColor = branding?.colors?.secondary || "#F1F5F9";
    const backgroundColor = branding?.colors?.background || "#F8FAFC";
    const cardColor = branding?.colors?.card || "#FFFFFF";
    const headingFont = branding?.fonts?.heading || "Poppins";
    const bodyFont = branding?.fonts?.body || "Inter";

    const cssVariables = {
        "--primary": hexToHsl(primaryColor),
        "--secondary": hexToHsl(secondaryColor),
        "--background": hexToHsl(backgroundColor),
        "--card": hexToHsl(cardColor),
        "--font-heading": `'${headingFont}', sans-serif`,
        "--font-body": `'${bodyFont}', sans-serif`,
        fontFamily: `'${bodyFont}', sans-serif`,
    } as React.CSSProperties;

    return (
        <div className="min-h-screen flex flex-col" style={cssVariables}>
            {/* Real Header Component - shows real products navigation */}
            <Header />

            {/* Main content - HeroSlider uses negative margin to slide under the Header */}
            <main className="flex-1" style={{ marginTop: '-80px' }}>
                {/* Real Hero Slider - shows tenant hero images (now appears under the transparent header) */}
                <HeroSlider />

                {/* Tagline - MATCHES Shop.tsx */}
                <section className="bg-secondary py-8">
                    <div className="container mx-auto px-4 text-center">
                        <h2 className="text-2xl md:text-3xl font-heading font-semibold text-foreground">
                            Velkommen til danmarks billigste tryksager
                        </h2>
                    </div>
                </section>

                {/* Products Section - MATCHES Shop.tsx */}
                <section className="py-16" id="produkter">
                    <div className="container mx-auto px-4">
                        <Tabs defaultValue="tryksager" className="w-full">
                            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-12">
                                <TabsTrigger value="tryksager">Tryksager</TabsTrigger>
                                <TabsTrigger value="storformat">Storformat print</TabsTrigger>
                            </TabsList>

                            <TabsContent value="tryksager" id="tryksager">
                                <ProductGrid category="tryksager" />
                            </TabsContent>

                            <TabsContent value="storformat" id="storformat">
                                <ProductGrid category="storformat" />
                            </TabsContent>
                        </Tabs>
                    </div>
                </section>

                {/* USP Strip - MATCHES Shop.tsx */}
                <section className="bg-primary text-primary-foreground py-12">
                    <div className="container mx-auto px-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                            <div className="flex flex-col items-center">
                                <Truck className="h-12 w-12 mb-4" />
                                <h3 className="text-lg font-heading font-semibold mb-2">Hurtig levering</h3>
                                <p className="text-sm opacity-90">Express-muligheder til hele Danmark</p>
                            </div>
                            <div className="flex flex-col items-center">
                                <Award className="h-12 w-12 mb-4" />
                                <h3 className="text-lg font-heading font-semibold mb-2">Kvalitet til skarpe priser</h3>
                                <p className="text-sm opacity-90">25+ års erfaring med professionelt tryk</p>
                            </div>
                            <div className="flex flex-col items-center">
                                <Phone className="h-12 w-12 mb-4" />
                                <h3 className="text-lg font-heading font-semibold mb-2">Personlig rådgivning</h3>
                                <p className="text-sm opacity-90">Tlf: 71 99 11 10</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SEO Content - MATCHES Shop.tsx */}
                <section className="py-16 bg-secondary/30">
                    <div className="container mx-auto px-4">
                        <div className="max-w-4xl mx-auto space-y-8">
                            <div>
                                <h2 className="text-xl font-heading font-semibold mb-3">Billige tryksager online</h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    Webprinter.dk gør det nemt at bestille flyers, foldere, visitkort og hæfter i høj kvalitet til lave priser.
                                    Beregn din pris direkte online og få levering i hele Danmark.
                                </p>
                            </div>

                            <div>
                                <h2 className="text-xl font-heading font-semibold mb-3">Storformat print til enhver opgave</h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    Fra bannere og beachflag til skilte og tekstilprint – vi producerer storformat i topkvalitet.
                                    Alt printes med UV-bestandige farver og professionel finish.
                                </p>
                            </div>

                            <div>
                                <h2 className="text-xl font-heading font-semibold mb-3">Dansk trykkeri med hurtig levering</h2>
                                <p className="text-muted-foreground leading-relaxed">
                                    Vi har over 25 års erfaring og leverer både til erhverv og private.
                                    Kontakt os i dag og oplev service, kvalitet og konkurrencedygtige priser.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}

/**
 * Preview Shop Page - Renders the REAL shop page with draft branding for admin preview.
 * Protected route - requires admin access.
 * 
 * Key Features:
 * - Shows actual ProductGrid with real tenant products and their icons
 * - Applies draft branding (fonts, colors) via CSS variables
 * - Receives real-time branding updates via postMessage from admin panel
 * - Isolated from live customers (admin-only route)
 * - SECURITY: Only allows navigation to customer-visible pages (no backend access)
 */
export default function PreviewShop() {
    const [searchParams] = useSearchParams();
    const { isAdmin, loading: roleLoading } = useUserRole();
    const [initialBranding, setInitialBranding] = useState<BrandingData | null>(null);
    const [tenantName, setTenantName] = useState("Dit Trykkeri");
    const [isLoading, setIsLoading] = useState(true);

    const isDraft = searchParams.get("draft") === "1";

    // Load initial branding from database
    useEffect(() => {
        async function loadInitialBranding() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                let query = supabase
                    .from('tenants' as any)
                    .select('id, name, settings');

                const tenantIdParam = searchParams.get("tenantId");
                if (tenantIdParam) {
                    query = query.eq('id', tenantIdParam);
                } else {
                    query = query.eq('owner_id', user.id);
                }

                const { data: tenant } = await query.maybeSingle();

                if (tenant) {
                    setTenantName((tenant as any).name || "Dit Trykkeri");
                    const brandingSettings = (tenant as any).settings?.branding || {};

                    if (isDraft && brandingSettings.draft) {
                        setInitialBranding(mergeBrandingWithDefaults(brandingSettings.draft));
                    } else if (brandingSettings.published) {
                        setInitialBranding(mergeBrandingWithDefaults(brandingSettings.published));
                    } else {
                        // Legacy format - branding is the actual data
                        setInitialBranding(mergeBrandingWithDefaults(brandingSettings));
                    }
                }
            } catch (error) {
                console.error("Error loading branding:", error);
            } finally {
                setIsLoading(false);
            }
        }

        if (!roleLoading) {
            loadInitialBranding();
        }
    }, [isDraft, roleLoading]);

    // Require admin access
    if (!roleLoading && !isAdmin) {
        return <Navigate to="/auth" replace />;
    }

    if (isLoading || roleLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    return (
        <PreviewBrandingProvider
            initialBranding={initialBranding}
            initialTenantName={tenantName}
        >
            <PreviewNavigationGuard>
                <PreviewShopContent />
            </PreviewNavigationGuard>
        </PreviewBrandingProvider>
    );
}
