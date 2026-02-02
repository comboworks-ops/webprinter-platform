import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, Home, ArrowLeft } from "lucide-react";
import { PreviewBrandingProvider, usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroSlider from "@/components/HeroSlider";
import html2canvas from "html2canvas";
import ProductGrid from "@/components/ProductGrid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Truck, Award, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mergeBrandingWithDefaults, type BrandingData } from "@/hooks/useBrandingDraft";
import { resolveAdminTenant, MASTER_TENANT_ID } from "@/lib/adminTenant";
import { GrafiskVejledningContent } from "@/components/content/GrafiskVejledningContent";
import { ContactContent } from "@/components/content/ContactContent";
import { AboutContent } from "@/components/content/AboutContent";
import { ProductPriceContent } from "@/components/content/ProductPriceContent";
import { TermsContent } from "@/components/content/TermsContent";

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
 * Now supports virtual navigation via currentPage prop.
 */
function PreviewShopContent({ currentPage }: { currentPage: string }) {
    const { branding, tenantName } = usePreviewBranding();
    const productsSection = branding?.forside?.productsSection;
    const showProducts = productsSection?.enabled ?? true;
    const productColumns = productsSection?.columns ?? 4;
    const productButtonConfig = productsSection?.button;
    const productBackgroundConfig = productsSection?.background;
    const productLayoutStyle = productsSection?.layoutStyle;
    const showStorformatTab = productsSection?.showStorformatTab ?? true;

    // Generate CSS variables from branding
    const primaryColor = branding?.colors?.primary || "#0EA5E9";
    const secondaryColor = branding?.colors?.secondary || "#F1F5F9";
    const backgroundColor = branding?.colors?.background || "#F8FAFC";
    const cardColor = branding?.colors?.card || "#FFFFFF";
    const headingFont = branding?.fonts?.heading || "Poppins";
    const bodyFont = branding?.fonts?.body || "Inter";
    const pricingFont = branding?.fonts?.pricing || "Roboto Mono";

    // Typography colors
    const headingTextColor = branding?.colors?.headingText || "#1F2937";
    const bodyTextColor = branding?.colors?.bodyText || "#4B5563";
    const pricingTextColor = branding?.colors?.pricingText || "#0EA5E9";
    const linkTextColor = branding?.colors?.linkText || "#0EA5E9";

    // Header settings for conditional layout
    const headerSettings = (branding?.header || {}) as { transparentOverHero?: boolean; height?: string };
    const transparentOverHero = headerSettings.transparentOverHero ?? true;
    const headerHeight = headerSettings.height === 'sm' ? 56 : headerSettings.height === 'lg' ? 96 : 72;
    // Main content margin: negative when transparent (overlay), zero when not (stacked)
    const mainMargin = transparentOverHero ? -headerHeight : 0;

    const cssVariables = {
        "--primary": hexToHsl(primaryColor),
        "--secondary": hexToHsl(secondaryColor),
        "--background": hexToHsl(backgroundColor),
        "--card": hexToHsl(cardColor),
        "--font-heading": `'${headingFont}', sans-serif`,
        "--font-body": `'${bodyFont}', sans-serif`,
        "--font-pricing": `'${pricingFont}', monospace`,
        // Typography colors as CSS custom properties
        "--heading-text": headingTextColor,
        "--body-text": bodyTextColor,
        "--pricing-text": pricingTextColor,
        "--link-text": linkTextColor,
        // Also set foreground based on heading text for compatibility
        "--foreground": hexToHsl(headingTextColor),
        "--muted-foreground": hexToHsl(bodyTextColor),
        fontFamily: `'${bodyFont}', sans-serif`,
    } as React.CSSProperties;

    // Render page content based on virtual navigation
    const renderPageContent = () => {
        // Specific product page
        if (currentPage.startsWith('/produkt/')) {
            const slug = currentPage.split('/').pop();
            return (
                <div className="pt-20">
                    <ProductPriceContent slug={slug} />
                </div>
            );
        }

        // Products pages
        if (currentPage === '/produkter' || currentPage === '/shop' || currentPage === '/prisberegner') {
            return (
                <section className="py-16 pt-24" id="produkter">
                    <div className="container mx-auto px-4">
                        <h1 className="text-3xl font-heading font-bold mb-8 text-center">Produkter</h1>
                        {showStorformatTab ? (
                            <Tabs defaultValue="tryksager" className="w-full">
                                <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-12">
                                    <TabsTrigger value="tryksager">Tryksager</TabsTrigger>
                                    <TabsTrigger value="storformat">Storformat print</TabsTrigger>
                                </TabsList>

                                <TabsContent value="tryksager" id="tryksager">
                                    <ProductGrid
                                        category="tryksager"
                                        columns={productColumns}
                                        buttonConfig={productButtonConfig}
                                        backgroundConfig={productBackgroundConfig}
                                        layoutStyle={productLayoutStyle}
                                    />
                                </TabsContent>

                                <TabsContent value="storformat" id="storformat">
                                    <ProductGrid
                                        category="storformat"
                                        columns={productColumns}
                                        buttonConfig={productButtonConfig}
                                        backgroundConfig={productBackgroundConfig}
                                        layoutStyle={productLayoutStyle}
                                    />
                                </TabsContent>
                            </Tabs>
                        ) : (
                            <ProductGrid
                                category="tryksager"
                                columns={productColumns}
                                buttonConfig={productButtonConfig}
                                backgroundConfig={productBackgroundConfig}
                                layoutStyle={productLayoutStyle}
                            />
                        )}
                    </div>
                </section>
            );
        }

        // Contact page
        if (currentPage === '/kontakt') {
            return (
                <section className="pt-24 pb-16">
                    <ContactContent />
                </section>
            );
        }

        // About page
        if (currentPage === '/om-os') {
            return (
                <div className="pt-20">
                    <AboutContent />
                </div>
            );
        }

        // Grafisk Vejledning
        if (currentPage === '/grafisk-vejledning') {
            return (
                <section className="pt-24 pb-16">
                    <GrafiskVejledningContent />
                </section>
            );
        }

        // ... existing imports ...

        // ... (in renderPageContent)

        // Terms / Conditions pages
        if (currentPage === '/vilkaar' || currentPage === '/betingelser') {
            return (
                <section className="pt-24 pb-16">
                    <TermsContent />
                </section>
            );
        }


        // Privacy Policy
        if (currentPage === '/privatliv') {
            return (
                <section className="py-16 pt-24">
                    <div className="container mx-auto px-4 max-w-3xl">
                        <h1 className="text-3xl font-heading font-bold mb-8 text-center">Privatlivspolitik</h1>
                        <div className="prose prose-lg mx-auto">
                            <p className="text-muted-foreground leading-relaxed">
                                Vi passer godt på dine data. Læs mere om hvordan vi indsamler og behandler personoplysninger.
                            </p>
                        </div>
                    </div>
                </section>
            );
        }

        // Cookie Policy
        if (currentPage === '/cookies') {
            return (
                <section className="py-16 pt-24">
                    <div className="container mx-auto px-4 max-w-3xl">
                        <h1 className="text-3xl font-heading font-bold mb-8 text-center">Cookiepolitik</h1>
                        <div className="prose prose-lg mx-auto">
                            <p className="text-muted-foreground leading-relaxed">
                                Information om brug af cookies på vores website.
                            </p>
                        </div>
                    </div>
                </section>
            );
        }

        // Default: Frontpage (Home)
        return (
            <main className="flex-1" style={{ marginTop: mainMargin }}>
                {/* Real Hero Slider - shows tenant hero images (now appears under the transparent header) */}
                <HeroSlider />

                {/* Products Section - MATCHES Shop.tsx */}
                {showProducts && (
                    <section className="py-16" id="produkter">
                        <div className="container mx-auto px-4">
                            {showStorformatTab ? (
                                <Tabs defaultValue="tryksager" className="w-full">
                                    <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-12">
                                        <TabsTrigger value="tryksager">Tryksager</TabsTrigger>
                                        <TabsTrigger value="storformat">Storformat print</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="tryksager" id="tryksager">
                                        <ProductGrid
                                            category="tryksager"
                                            columns={productColumns}
                                            buttonConfig={productButtonConfig}
                                            backgroundConfig={productBackgroundConfig}
                                            layoutStyle={productLayoutStyle}
                                        />
                                    </TabsContent>

                                    <TabsContent value="storformat" id="storformat">
                                        <ProductGrid
                                            category="storformat"
                                            columns={productColumns}
                                            buttonConfig={productButtonConfig}
                                            backgroundConfig={productBackgroundConfig}
                                            layoutStyle={productLayoutStyle}
                                        />
                                    </TabsContent>
                                </Tabs>
                            ) : (
                                <ProductGrid
                                    category="tryksager"
                                    columns={productColumns}
                                    buttonConfig={productButtonConfig}
                                    backgroundConfig={productBackgroundConfig}
                                    layoutStyle={productLayoutStyle}
                                />
                            )}
                        </div>
                    </section>
                )}

                {/* Content Block Section - Dynamic from branding */}
                {branding?.forside?.contentBlocks?.filter(block => block.enabled).map((block) => (
                    <section key={block.id} className="bg-secondary py-8">
                        <div className={`container mx-auto px-4 ${block.textAlign === 'center' ? 'text-center' : block.textAlign === 'right' ? 'text-right' : 'text-left'}`}>
                            <div className={`flex flex-col ${block.imageUrl ? (block.imagePosition === 'right' ? 'md:flex-row' : 'md:flex-row-reverse') : ''} gap-8 items-center`}>
                                {/* Text Content */}
                                <div className={`flex-1 ${block.imageUrl ? '' : 'w-full'}`}>
                                    {block.heading && (
                                        <h2
                                            className="text-2xl md:text-3xl font-semibold"
                                            style={{
                                                fontFamily: `'${block.headingFont || 'Poppins'}', sans-serif`,
                                                color: block.headingColor || '#1F2937'
                                            }}
                                        >
                                            {block.heading}
                                        </h2>
                                    )}
                                    {block.text && (
                                        <p
                                            className="mt-4"
                                            style={{
                                                fontFamily: `'${block.textFont || 'Inter'}', sans-serif`,
                                                color: block.textColor || '#4B5563'
                                            }}
                                        >
                                            {block.text}
                                        </p>
                                    )}
                                </div>
                                {/* Optional Image */}
                                {block.imageUrl && (
                                    <div className="flex-1">
                                        <img
                                            src={block.imageUrl}
                                            alt={block.heading || 'Content image'}
                                            className="rounded-lg max-h-64 object-cover mx-auto"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                ))}

                {/* USP Strip - MATCHES Shop.tsx */}
                <section className="bg-primary text-primary-foreground py-12">
                    <div className="container mx-auto px-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                            <div className="flex flex-col items-center">
                                <Truck className="h-12 w-12 mb-4" />
                                <h3 className="text-lg font-heading font-semibold mb-2 text-white">Hurtig levering</h3>
                                <p className="text-sm opacity-90 text-white">Express-muligheder til hele Danmark</p>
                            </div>
                            <div className="flex flex-col items-center">
                                <Award className="h-12 w-12 mb-4" />
                                <h3 className="text-lg font-heading font-semibold mb-2 text-white">Kvalitet til skarpe priser</h3>
                                <p className="text-sm opacity-90 text-white">25+ års erfaring med professionelt tryk</p>
                            </div>
                            <div className="flex flex-col items-center">
                                <Phone className="h-12 w-12 mb-4" />
                                <h3 className="text-lg font-heading font-semibold mb-2 text-white">Personlig rådgivning</h3>
                                <p className="text-sm opacity-90 text-white">Tlf: 71 99 11 10</p>
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
        );
    };

    return (
        <div className="min-h-screen flex flex-col" style={cssVariables}>
            {/* Real Header Component - shows real products navigation */}
            <Header />

            {/* Render page content based on currentPage */}
            {renderPageContent()}

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
 * - VIRTUAL NAVIGATION: Intercepts link clicks to keep branding provider mounted
 */
export default function PreviewShop() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { isAdmin, loading: roleLoading } = useUserRole();
    const [initialBranding, setInitialBranding] = useState<BrandingData | null>(null);
    const [tenantName, setTenantName] = useState("Dit Trykkeri");
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState('/');

    const isDraft = searchParams.get("draft") === "1";
    const tenantIdParam = searchParams.get("tenantId") || searchParams.get("tenant_id");

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

    useEffect(() => {
        if (roleLoading || !isAdmin) return;
        if (!tenantIdParam || tenantIdParam !== MASTER_TENANT_ID) return;

        const resolveAndRedirect = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: owned } = await supabase
                .from('tenants' as any)
                .select('id')
                .eq('owner_id', user.id)
                .maybeSingle();

            const ownedTenantId = (owned as any)?.id;
            if (ownedTenantId && ownedTenantId !== MASTER_TENANT_ID) {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.set("tenantId", ownedTenantId);
                navigate(`${window.location.pathname}?${nextParams.toString()}`, { replace: true });
                return;
            }

            const { tenantId } = await resolveAdminTenant();
            if (!tenantId || tenantId === MASTER_TENANT_ID) return;

            const nextParams = new URLSearchParams(searchParams);
            nextParams.set("tenantId", tenantId);
            navigate(`${window.location.pathname}?${nextParams.toString()}`, { replace: true });
        };

        resolveAndRedirect();
    }, [tenantIdParam, roleLoading, isAdmin, searchParams]);

    const [editMode, setEditMode] = useState(false);

    // Listen for Edit Mode toggle from parent AND screenshot capture requests
    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            if (event.data?.type === 'SET_EDIT_MODE') {
                setEditMode(event.data.enabled);
                if (event.data.enabled) {
                    toast.info("Redigering aktiveret - klik på elementer for at rette");
                }
            }

            // Handle screenshot capture request
            if (event.data?.type === 'CAPTURE_SCREENSHOT') {
                try {
                    // Find the main content container
                    const container = document.querySelector('.min-h-screen');
                    if (!container) {
                        window.parent.postMessage({ type: 'SCREENSHOT_ERROR', error: 'Container not found' }, '*');
                        return;
                    }

                    // Capture screenshot using html2canvas
                    const canvas = await html2canvas(container as HTMLElement, {
                        useCORS: true,
                        allowTaint: true,
                        scale: 0.5, // Reduce size for thumbnail
                        width: 1280,
                        height: 720,
                        windowWidth: 1280,
                        windowHeight: 720,
                        logging: false,
                    });

                    // Convert to base64 data URL
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

                    // Send back to parent
                    window.parent.postMessage({
                        type: 'SCREENSHOT_CAPTURED',
                        dataUrl,
                        requestId: event.data.requestId
                    }, '*');
                } catch (error) {
                    console.error('Screenshot capture error:', error);
                    window.parent.postMessage({
                        type: 'SCREENSHOT_ERROR',
                        error: String(error),
                        requestId: event.data.requestId
                    }, '*');
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Global click interceptor for virtual navigation AND visual editing
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            // Priority 1: Visual Editing
            if (editMode) {
                const target = e.target as HTMLElement;
                const brandingElement = target.closest('[data-branding-id]');

                if (brandingElement) {
                    e.preventDefault();
                    e.stopPropagation();
                    const sectionId = brandingElement.getAttribute('data-branding-id');

                    // Send message to parent editor
                    window.parent.postMessage({
                        type: 'ELEMENT_CLICKED',
                        sectionId
                    }, '*');

                    return; // Stop processing navigation
                }
            }

            // Priority 2: Virtual Navigation
            const target = e.target as HTMLElement;
            const link = target.closest('a');

            if (!link) return;

            const href = link.getAttribute('href');
            if (!href) return;

            // Only intercept internal links (starting with /)
            if (href.startsWith('/')) {
                // Block admin/auth routes
                const isBlocked = BLOCKED_ROUTE_PREFIXES.some(prefix => href.startsWith(prefix));
                if (isBlocked) {
                    e.preventDefault();
                    return;
                }

                // If in edit mode, we might want to prevent navigation unless it's explicitly allowed
                // For now, we allow navigation if no branding element was clicked above

                // Intercept and handle as virtual navigation
                e.preventDefault();
                e.stopPropagation();

                // Normalize the path
                const path = href === '/' ? '/' : href;
                setCurrentPage(path);

                // Scroll to top on navigation
                window.scrollTo(0, 0);
            }
        };

        // Add listener to capture phase to intercept before React Router
        document.addEventListener('click', handleClick, true);

        return () => {
            document.removeEventListener('click', handleClick, true);
        };
    }, [editMode]);

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
            <PreviewShopContent currentPage={currentPage} />
        </PreviewBrandingProvider>
    );
}
