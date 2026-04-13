import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, Home, ArrowLeft, Truck, Award, Phone, Shield, Clock, Star, Heart, Check } from "lucide-react";
import { PreviewBrandingProvider, usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { mergeBrandingWithDefaults, type BrandingData } from "@/hooks/useBrandingDraft";
import { resolveAdminTenant, MASTER_TENANT_ID } from "@/lib/adminTenant";
import { GrafiskVejledningContent } from "@/components/content/GrafiskVejledningContent";
import { ContactContent } from "@/components/content/ContactContent";
import { AboutContent } from "@/components/content/AboutContent";
import { ProductPriceContent } from "@/components/content/ProductPriceContent";
import { TermsContent } from "@/components/content/TermsContent";
import { CookiePolicyContent } from "@/components/content/CookiePolicyContent";
import { PrivacyPolicyContent } from "@/components/content/PrivacyPolicyContent";
import { SitePackagePreview } from "@/components/sites/SitePackagePreview";
import { StorefrontHomeContent } from "@/components/storefront/StorefrontHomeContent";
import { StorefrontSeo } from "@/components/storefront/StorefrontSeo";
import { StorefrontThemeFrame } from "@/components/storefront/StorefrontThemeFrame";
import { getSiteDesignTargetLabel } from "@/lib/siteDesignTargets";

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
    '/cookiepolitik',
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

const USP_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    truck: Truck,
    award: Award,
    phone: Phone,
    shield: Shield,
    clock: Clock,
    star: Star,
    heart: Heart,
    check: Check,
};

const FEATURED_SIDE_PANEL_BOX_ID = "forside.products.featured.side-panel.box";

function getUSPAnimationName(animation?: string) {
    switch (animation) {
        case "fade":
            return "usp-fade-in";
        case "slide-down":
            return "usp-slide-down";
        case "scale":
            return "usp-scale-in";
        case "blur":
            return "usp-blur-in";
        case "none":
            return "";
        case "slide-up":
        default:
            return "usp-slide-up";
    }
}

function getUSPItemStyle(
    settings: { mode?: string; animation?: string; staggerMs?: number } | undefined,
    index: number
): React.CSSProperties | undefined {
    if (!settings || settings.mode !== "animated") return undefined;

    const animationName = getUSPAnimationName(settings.animation);
    if (!animationName) return undefined;

    return {
        animation: `${animationName} 680ms ease both`,
        animationDelay: `${index * (settings.staggerMs || 120)}ms`,
    };
}

function getUSPGridStyle(
    settings: { mode?: string } | undefined,
    itemCount: number
): React.CSSProperties | undefined {
    if (!settings || settings.mode !== "animated") return undefined;

    const minWidth = itemCount >= 16 ? 72 : itemCount >= 10 ? 88 : 116;
    return {
        gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`,
    };
}

function getUSPGridClassName(settings?: { mode?: string }) {
    if (settings?.mode === "animated") {
        return "grid gap-4 md:gap-5 items-start text-center";
    }

    return "grid grid-cols-1 md:grid-cols-3 gap-8 text-center";
}

function getUSPItemClassName(settings?: { mode?: string }) {
    if (settings?.mode === "animated") {
        return "flex flex-col items-center justify-start text-center transition-transform duration-300 hover:-translate-y-0.5";
    }

    return "flex flex-col items-center";
}

function resolveSiteDesignPreviewElement(target: HTMLElement | null): HTMLElement | null {
    const directSiteDesignTarget = target?.closest?.('[data-site-design-target]') as HTMLElement | null;
    if (directSiteDesignTarget) {
        return directSiteDesignTarget;
    }

    const brandingElement = target?.closest?.('[data-branding-id], [data-click-to-edit]') as HTMLElement | null;
    if (!brandingElement) return null;

    const rawId = brandingElement.getAttribute('data-branding-id') || brandingElement.getAttribute('data-click-to-edit') || '';
    if (rawId.startsWith('forside.products.featured.side-panel.') && rawId !== FEATURED_SIDE_PANEL_BOX_ID) {
        return (
            brandingElement.closest(`[data-branding-id="${FEATURED_SIDE_PANEL_BOX_ID}"], [data-click-to-edit="${FEATURED_SIDE_PANEL_BOX_ID}"]`) as HTMLElement | null
        ) || brandingElement;
    }

    return brandingElement;
}

function buildUSPGroundCSS(settings?: {
    mode?: string;
    animation?: string;
    staggerMs?: number;
    useGradient?: boolean;
    gradientFrom?: string;
    gradientTo?: string;
    gradientDirection?: string;
    backgroundColor?: string;
}): React.CSSProperties {
    if (!settings) {
        return { backgroundColor: '#0EA5E9' };
    }
    if (settings.useGradient && settings.gradientFrom && settings.gradientTo) {
        const direction = settings.gradientDirection || 'to-r';
        return {
            background: `linear-gradient(${direction.replace('to-', 'to ').replace('-', ' ')}, ${settings.gradientFrom}, ${settings.gradientTo})`,
        };
    }
    return {
        backgroundColor: settings.backgroundColor || '#0EA5E9',
    };
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
 * Uses the same themed storefront frame as live routes while still supporting
 * virtual page switching inside the preview iframe.
 */
function PreviewShopContent({ currentPage }: { currentPage: string }) {
    const { branding, tenantName } = usePreviewBranding();
    const resolvedBranding = mergeBrandingWithDefaults(branding || {});
    const resolvedTenantName = String(
        resolvedBranding.shop_name || tenantName || "Din Shop",
    ).trim() || "Din Shop";

    // Render page content based on virtual navigation
    const renderPageContent = () => {
        // Specific product page
        if (currentPage.startsWith('/produkt/')) {
            const slug = currentPage.split('/').pop();
            return (
                <main className="flex-1 py-8">
                    <ProductPriceContent slug={slug} />
                </main>
            );
        }

        // Contact page
        if (currentPage === '/kontakt') {
            return (
                <main className="flex-1 py-16">
                    <ContactContent />
                </main>
            );
        }

        // About page
        if (currentPage === '/om-os') {
            return (
                <main className="flex-1">
                    <AboutContent />
                </main>
            );
        }

        // Grafisk Vejledning
        if (currentPage === '/grafisk-vejledning') {
            return (
                <main className="flex-1 py-12">
                    <GrafiskVejledningContent />
                </main>
            );
        }

        // Terms / Conditions pages
        if (currentPage === '/vilkaar' || currentPage === '/betingelser') {
            return (
                <main className="flex-1 py-16 pt-24">
                    <TermsContent />
                </main>
            );
        }


        // Privacy Policy
        if (currentPage === '/privatliv') {
            return (
                <main className="flex-1 py-16 pt-24">
                    <PrivacyPolicyContent />
                </main>
            );
        }

        // Cookie Policy
        if (currentPage === '/cookies' || currentPage === '/cookiepolitik') {
            return (
                <main className="flex-1 py-16 pt-24">
                    <CookiePolicyContent />
                </main>
            );
        }

        // Default: Frontpage (Home)
        return (
            <StorefrontHomeContent
                branding={resolvedBranding}
                tenantName={resolvedTenantName}
                isPreviewMode
            />
        );
    };

    return (
        <StorefrontThemeFrame
            branding={resolvedBranding}
            tenantName={resolvedTenantName}
            isPreviewMode
            topSlot={<StorefrontSeo />}
        >
            {renderPageContent()}
        </StorefrontThemeFrame>
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
    const [firstProductSlug, setFirstProductSlug] = useState<string | null>(null);

    const isDraft = searchParams.get("draft") === "1";
    const tenantIdParam = searchParams.get("tenantId") || searchParams.get("tenant_id");
    const siteIdParam = searchParams.get("siteId") || searchParams.get("site_id");
    const isSitePreview = searchParams.get("sitePreview") === "1" && !!siteIdParam;
    const isPreviewContext = isDraft || searchParams.get("preview_mode") === "1" || window.self !== window.top;

    useEffect(() => {
        if (!isPreviewContext) return;
        window.parent.postMessage({ type: 'PREVIEW_NAVIGATION', path: currentPage }, '*');
        // Backwards-compatible event name used by older editor controls
        window.parent.postMessage({ type: 'PREVIEW_PAGE_CHANGED', path: currentPage }, '*');
    }, [currentPage, isPreviewContext]);

    // Load initial branding from database
    useEffect(() => {
        if (isSitePreview) {
            setIsLoading(false);
            return;
        }

        async function loadInitialBranding() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                let query = supabase
                    .from('tenants' as any)
                    .select('id, name, settings');

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
    }, [isDraft, roleLoading, tenantIdParam, isSitePreview]);

    useEffect(() => {
        if (isSitePreview) return;
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
    }, [tenantIdParam, roleLoading, isAdmin, searchParams, isSitePreview]);

    const [editMode, setEditMode] = useState(false);
    const [hoveredTargetId, setHoveredTargetId] = useState<string | null>(null);

    const resolveFirstProductSlug = useCallback(async () => {
        const tenantId = tenantIdParam;
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
            if (slug) setFirstProductSlug(slug);
            return slug;
        } catch (error) {
            console.error("Error loading first product:", error);
            toast.error("Kunne ikke finde første produkt");
            return null;
        }
    }, [tenantIdParam, firstProductSlug]);

    // Listen for Edit Mode toggle from parent AND screenshot capture requests
    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            if (event.data?.type === 'SET_EDIT_MODE') {
                setEditMode((prev) => {
                    const next = Boolean(event.data.enabled);
                    if (!prev && next) {
                        toast.info("Klik på et element i preview for at åbne den rigtige sektion");
                    }
                    return next;
                });
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
                } else {
                    setCurrentPage('/produkter');
                }
                window.scrollTo(0, 0);
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
                const brandingElement = resolveSiteDesignPreviewElement(target);

                if (brandingElement) {
                    e.preventDefault();
                    e.stopPropagation();
                    const sectionId = brandingElement.getAttribute('data-site-design-target')
                        || brandingElement.getAttribute('data-branding-id')
                        || brandingElement.getAttribute('data-click-to-edit');

                    // Send message to parent editor
                    window.parent.postMessage({
                        type: 'EDIT_SECTION',
                        sectionId
                    }, '*');
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

    useEffect(() => {
        if (!editMode) {
            setHoveredTargetId(null);
            return;
        }

        let lastHoveredElement: HTMLElement | null = null;

        const clearHoveredElement = () => {
            if (lastHoveredElement) {
                lastHoveredElement.removeAttribute('data-branding-hovered');
                lastHoveredElement = null;
            }
            setHoveredTargetId(null);
        };

        const handlePointerMove = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            const brandingElement = resolveSiteDesignPreviewElement(target);

            if (brandingElement === lastHoveredElement) return;

            if (lastHoveredElement) {
                lastHoveredElement.removeAttribute('data-branding-hovered');
            }

            if (brandingElement) {
                brandingElement.setAttribute('data-branding-hovered', 'true');
                setHoveredTargetId(
                    brandingElement.getAttribute('data-site-design-target')
                    || brandingElement.getAttribute('data-branding-id')
                );
            } else {
                setHoveredTargetId(null);
            }

            lastHoveredElement = brandingElement;
        };

        document.addEventListener('mousemove', handlePointerMove, true);
        window.addEventListener('blur', clearHoveredElement);

        return () => {
            document.removeEventListener('mousemove', handlePointerMove, true);
            window.removeEventListener('blur', clearHoveredElement);
            clearHoveredElement();
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

    if (isSitePreview && siteIdParam) {
        return <SitePackagePreview siteId={siteIdParam} tenantId={tenantIdParam || null} />;
    }

    return (
        <div data-site-design-edit-mode={editMode ? "true" : "false"} className="relative min-h-screen">
            <style>{`
                [data-site-design-edit-mode="true"] [data-branding-id],
                [data-site-design-edit-mode="true"] [data-site-design-target] {
                    cursor: pointer;
                    transition: outline-color 120ms ease, box-shadow 120ms ease, transform 120ms ease;
                }
                [data-site-design-edit-mode="true"] [data-branding-id][data-branding-hovered="true"],
                [data-site-design-edit-mode="true"] [data-site-design-target][data-branding-hovered="true"] {
                    outline: 2px solid rgba(14, 165, 233, 0.95);
                    outline-offset: 4px;
                    box-shadow: 0 0 0 6px rgba(14, 165, 233, 0.12);
                }
            `}</style>

            <PreviewBrandingProvider
                initialBranding={initialBranding}
                initialTenantName={tenantName}
                previewPath={currentPage}
            >
                <PreviewShopContent currentPage={currentPage} />
            </PreviewBrandingProvider>

            {editMode && (
                <div className="pointer-events-none fixed bottom-4 left-4 z-[2000] rounded-full bg-slate-950/90 px-4 py-2 text-sm text-white shadow-xl backdrop-blur">
                    {hoveredTargetId
                        ? `Klik for at redigere: ${getSiteDesignTargetLabel(hoveredTargetId)}`
                        : "Klik på et markerbart element for at redigere det"}
                </div>
            )}
        </div>
    );
}
