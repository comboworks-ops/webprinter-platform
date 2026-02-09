import { useEffect, useState, useCallback, useRef, type CSSProperties } from "react";
import { useSearchParams, Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";
import { PreviewBrandingProvider, usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import html2canvas from "html2canvas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mergeBrandingWithDefaults, type BrandingData, DEFAULT_BRANDING } from "@/hooks/useBrandingDraft";

// Theme System
import { ThemeProvider, useTheme } from "@/lib/themes";
import "@/themes/classic"; // Register classic theme
import "@/themes/glassmorphism"; // Register glassmorphism theme
import { getPageBackgroundStyle } from "@/lib/branding/background";
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
 * Wrapper that provides ThemeProvider based on current branding from context.
 * This allows the theme to update when branding changes in the editor.
 */
function ThemedPreviewContent({ currentPage }: { currentPage: string }) {
    const { branding } = usePreviewBranding();
    const themeId = branding?.themeId || 'classic';
    const themeSettings = branding?.themeSettings || {};

    return (
        <ThemeProvider themeId={themeId} themeSettings={themeSettings}>
            <PreviewShopContent currentPage={currentPage} />
        </ThemeProvider>
    );
}

/**
 * The actual shop content with branding applied.
 * This renders the REAL storefront layout with tenant products and branding.
 * IMPORTANT: This must mirror Shop.tsx exactly, with preview branding applied.
 * Now supports virtual navigation via currentPage prop.
 */
function PreviewShopContent({ currentPage }: { currentPage: string }) {
    const { branding, tenantName } = usePreviewBranding();
    const { components: Theme } = useTheme();
    const customPages = branding?.pages?.items || [];
    const productsSection = branding?.forside?.productsSection;
    const showProducts = productsSection?.enabled ?? true;
    const productColumns = productsSection?.columns ?? 4;
    const productButtonConfig = productsSection?.button;
    const productBackgroundConfig = productsSection?.background;
    const productLayoutStyle = productsSection?.layoutStyle;
    const showStorformatTab = productsSection?.showStorformatTab ?? true;
    const contentBlocks = branding?.forside?.contentBlocks?.filter((block) => block.enabled) || [];
    const blocksAbove = contentBlocks.filter((block) => block.placement === 'above_products');
    const blocksBelow = contentBlocks.filter((block) => block.placement !== 'above_products');
    const banner2 = branding?.forside?.banner2;
    const lowerInfo = branding?.forside?.lowerInfo;

    // Generate CSS variables from branding
    const primaryColor = branding?.colors?.primary || DEFAULT_BRANDING.colors.primary;
    const secondaryColor = branding?.colors?.secondary || DEFAULT_BRANDING.colors.secondary;
    const cardColor = branding?.colors?.card || DEFAULT_BRANDING.colors.card;
    const titleFont = branding?.fonts?.title || branding?.fonts?.heading || "Poppins";
    const subtitleFont = branding?.fonts?.subtitle || branding?.fonts?.heading || "Poppins";
    const descriptionFont = branding?.fonts?.description || branding?.fonts?.body || "Inter";
    const systemFont = branding?.fonts?.system || branding?.fonts?.body || "Inter";
    const buttonFont = branding?.fonts?.button || branding?.fonts?.body || "Inter";
    const pricingFont = branding?.fonts?.pricing || "Roboto Mono";

    // Typography colors
    const headingFallback = branding?.colors?.headingText || DEFAULT_BRANDING.colors.headingText;
    const titleTextColor = branding?.colors?.titleText || headingFallback;
    const subtitleTextColor = branding?.colors?.subtitleText || headingFallback;
    const bodyTextColor = branding?.colors?.bodyText || DEFAULT_BRANDING.colors.bodyText;
    const pricingTextColor = branding?.colors?.pricingText || DEFAULT_BRANDING.colors.pricingText;
    const linkTextColor = branding?.colors?.linkText || DEFAULT_BRANDING.colors.linkText;
    const systemTextColor = branding?.colors?.systemText || headingFallback;
    const buttonTextColor = branding?.colors?.buttonText || DEFAULT_BRANDING.colors.buttonText;
    const headingTextColor = headingFallback;
    const tabInactiveBg = branding?.colors?.tabInactiveBg || branding?.colors?.secondary || DEFAULT_BRANDING.colors.tabInactiveBg;
    const tabInactiveHoverBg = branding?.colors?.tabInactiveHoverBg || DEFAULT_BRANDING.colors.tabInactiveHoverBg;
    const tabActiveHoverBg = branding?.colors?.tabActiveHoverBg || branding?.colors?.hover || DEFAULT_BRANDING.colors.tabActiveHoverBg;

    // Header settings for conditional layout
    const headerSettings = (branding?.header || {}) as { transparentOverHero?: boolean; height?: string };
    const transparentOverHero = headerSettings.transparentOverHero ?? true;
    const headerHeight = headerSettings.height === 'sm' ? 56 : headerSettings.height === 'lg' ? 96 : 72;
    // Main content margin: negative when transparent (overlay), zero when not (stacked)
    const mainMargin = transparentOverHero ? -headerHeight : 0;

    const cssVariables = {
        "--primary": hexToHsl(primaryColor),
        "--secondary": hexToHsl(secondaryColor),
        "--card": hexToHsl(cardColor),
        "--font-heading": `'${titleFont}', sans-serif`,
        "--font-title": `'${titleFont}', sans-serif`,
        "--font-subtitle": `'${subtitleFont}', sans-serif`,
        "--font-body": `'${systemFont}', sans-serif`,
        "--font-system": `'${systemFont}', sans-serif`,
        "--font-description": `'${descriptionFont}', sans-serif`,
        "--font-button": `'${buttonFont}', sans-serif`,
        "--font-pricing": `'${pricingFont}', monospace`,
        // Typography colors as CSS custom properties
        "--heading-text": headingTextColor,
        "--title-text": titleTextColor,
        "--subtitle-text": subtitleTextColor,
        "--body-text": bodyTextColor,
        "--system-text": systemTextColor,
        "--description-text": bodyTextColor,
        "--button-text": buttonTextColor,
        "--pricing-text": pricingTextColor,
        "--link-text": linkTextColor,
        "--tabs-inactive-bg": tabInactiveBg,
        "--tabs-inactive-hover-bg": tabInactiveHoverBg,
        "--tabs-active-hover-bg": tabActiveHoverBg,
        // Also set foreground based on heading text for compatibility
        "--foreground": hexToHsl(systemTextColor),
        "--muted-foreground": hexToHsl(bodyTextColor),
        "--primary-foreground": hexToHsl(buttonTextColor),
        "--secondary-foreground": hexToHsl(buttonTextColor),
        fontFamily: `'${systemFont}', sans-serif`,
    } as CSSProperties;
    const pageBackgroundStyle = getPageBackgroundStyle(branding);

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
                                    <Theme.ProductGrid
                                        branding={branding!}
                                        tenantName={tenantName}
                                        isPreviewMode
                                        category="tryksager"
                                        columns={productColumns}
                                        buttonConfig={productButtonConfig}
                                        backgroundConfig={productBackgroundConfig}
                                        layoutStyle={productLayoutStyle}
                                    />
                                </TabsContent>

                                <TabsContent value="storformat" id="storformat">
                                    <Theme.ProductGrid
                                        branding={branding!}
                                        tenantName={tenantName}
                                        isPreviewMode
                                        category="storformat"
                                        columns={productColumns}
                                        buttonConfig={productButtonConfig}
                                        backgroundConfig={productBackgroundConfig}
                                        layoutStyle={productLayoutStyle}
                                    />
                                </TabsContent>
                            </Tabs>
                        ) : (
                            <Theme.ProductGrid
                                branding={branding!}
                                tenantName={tenantName}
                                isPreviewMode
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

        const customPage = customPages.find((page) => page.path === currentPage);
        if (customPage) {
            return (
                <section className="py-16 pt-24">
                    <div className="container mx-auto px-4 max-w-3xl">
                        <div className="mb-6">
                            {customPage.type === "subpage" && (
                                <p className="text-xs uppercase tracking-wider text-muted-foreground">Underside</p>
                            )}
                            <h1 className="text-3xl font-heading font-bold">{customPage.title}</h1>
                        </div>
                        <div className="prose prose-lg max-w-none">
                            <p className="text-muted-foreground leading-relaxed">
                                Indhold kommer senere. Du kan nu navigere til siden og bygge den op trin for trin.
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
                <Theme.HeroSlider branding={branding!} tenantName={tenantName} isPreviewMode />

                {/* Content Blocks (Above Products) */}
                {blocksAbove.map((block: any) => (
                    <Theme.ContentBlock key={block.id} branding={branding!} tenantName={tenantName} isPreviewMode block={block} />
                ))}

                {/* Products Section - MATCHES Shop.tsx */}
                <Theme.ProductsSection
                    branding={branding!}
                    tenantName={tenantName}
                    isPreviewMode
                    showProducts={showProducts}
                    showStorformatTab={showStorformatTab}
                    productColumns={productColumns}
                    productButtonConfig={productButtonConfig}
                    productBackgroundConfig={productBackgroundConfig}
                    productLayoutStyle={productLayoutStyle}
                />

                {/* Banner 2 (below products) */}
                <Theme.Banner2 branding={branding!} tenantName={tenantName} isPreviewMode banner2={banner2} />

                {/* Lower Info Section */}
                <Theme.LowerInfo branding={branding!} tenantName={tenantName} isPreviewMode lowerInfo={lowerInfo} />

                {/* Content Blocks (Below Products) */}
                {blocksBelow.map((block: any) => (
                    <Theme.ContentBlock key={block.id} branding={branding!} tenantName={tenantName} isPreviewMode block={block} />
                ))}
            </main>
        );
    };

    // Common theme props
    const themeProps = { branding: branding!, tenantName, isPreviewMode: true };

    return (
        <Theme.ShopLayout {...themeProps} cssVariables={cssVariables}>
            {/* Real Header Component - shows real products navigation */}
            <Theme.Header {...themeProps} />

            {/* Render page content based on currentPage */}
            <div className="flex-1" style={pageBackgroundStyle}>
                {renderPageContent()}
            </div>

            <Theme.Footer {...themeProps} />
        </Theme.ShopLayout>
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
    const [resolvedTenantId, setResolvedTenantId] = useState<string | null>(null);
    const [firstProductSlug, setFirstProductSlug] = useState<string | null>(null);

    const isDraft = searchParams.get("draft") === "1";
    const tenantIdParam = searchParams.get("tenantId") || searchParams.get("tenant_id");
    const isPreviewContext = isDraft || searchParams.get("preview_mode") === "1" || window.self !== window.top;

    useEffect(() => {
        if (!isPreviewContext) return;
        window.parent.postMessage({ type: 'PREVIEW_PAGE_CHANGED', path: currentPage }, '*');
    }, [currentPage, isPreviewContext]);

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
                    setResolvedTenantId((tenant as any).id || null);
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
    const resolveFirstProductSlug = useCallback(async () => {
        const tenantId = resolvedTenantId || tenantIdParam;
        if (!tenantId) {
            toast.error("Kunne ikke finde tenant til produkter");
            return null;
        }
        if (firstProductSlug) return firstProductSlug;
        try {
            const { data, error } = await supabase
                .from('products')
                .select('slug')
                .eq('is_published', true)
                .eq('tenant_id', tenantId)
                .not('slug', 'is', null)
                .order('name')
                .limit(1);

            if (error) throw error;
            const slug = (data && data[0]?.slug) || null;
            if (slug) {
                setFirstProductSlug(slug);
            }
            return slug;
        } catch (error) {
            console.error("Error loading first product:", error);
            toast.error("Kunne ikke finde første produkt");
            return null;
        }
    }, [resolvedTenantId, tenantIdParam, firstProductSlug]);

    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            if (event.data?.type === 'SET_EDIT_MODE') {
                setEditMode(event.data.enabled);
                if (event.data.enabled) {
                    toast.info("Redigering aktiveret - klik på elementer for at rette");
                }
            }

            if (event.data?.type === 'NAVIGATE_TO') {
                const path = typeof event.data.path === 'string' ? event.data.path : '/';
                setCurrentPage(path);
                window.scrollTo(0, 0);
            }

            if (event.data?.type === 'NAVIGATE_TO_FIRST_PRODUCT') {
                const slug = await resolveFirstProductSlug();
                if (slug) {
                    setCurrentPage(`/produkt/${slug}`);
                    window.scrollTo(0, 0);
                } else {
                    setCurrentPage('/produkter');
                    window.scrollTo(0, 0);
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
    }, [resolveFirstProductSlug]);

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
    if (!roleLoading && !isAdmin && !isPreviewContext) {
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
            <ThemedPreviewContent currentPage={currentPage} />
        </PreviewBrandingProvider>
    );
}
