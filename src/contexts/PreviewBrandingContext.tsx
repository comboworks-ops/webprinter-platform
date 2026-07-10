import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import type { BrandingData } from "@/hooks/useBrandingDraft";
import { mergeBrandingWithDefaults } from "@/hooks/useBrandingDraft";
import { getGoogleFontsUrl } from "@/components/admin/FontSelector";
import { applyFavicon } from "@/hooks/useFavicon";
import { buildProductFilter } from "@/lib/branding/productAssets";

interface PreviewBrandingContextValue {
    /** The branding data (draft in preview, published in production) */
    branding: BrandingData | null;
    /** Product-level pricing overrides used only inside admin preview */
    productPricingOverrides: Record<string, unknown>;
    /** Whether we're in preview mode (admin iframe) */
    isPreviewMode: boolean;
    /** Tenant name for display */
    tenantName: string;
    /** Virtual storefront path used inside preview iframes */
    previewPath: string | null;
    /** Whether branding has been received */
    isReady: boolean;
}

const PreviewBrandingContext = createContext<PreviewBrandingContextValue>({
    branding: null,
    productPricingOverrides: {},
    isPreviewMode: false,
    tenantName: "WebPrinter",
    previewPath: null,
    isReady: false,
});

interface PreviewBrandingProviderProps {
    children: ReactNode;
    /** Initial branding to use before postMessage updates arrive */
    initialBranding?: BrandingData | null;
    /** Initial tenant name */
    initialTenantName?: string;
    /** Virtual route currently shown in preview */
    previewPath?: string | null;
}

// Dynamic font loader
function loadGoogleFonts(fonts: string[]) {
    const url = getGoogleFontsUrl(fonts);
    if (!url) return;

    const existingLink = document.getElementById('preview-fonts');
    if (existingLink) existingLink.remove();

    const link = document.createElement('link');
    link.id = 'preview-fonts';
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
}

// Helper to extract all fonts needed from branding data
function extractFontsFromBranding(branding: BrandingData | null): string[] {
    if (!branding) return [];

    return [
        branding?.fonts?.heading || 'Poppins',
        branding?.fonts?.body || 'Inter',
        branding?.fonts?.pricing || 'Roboto Mono',
        branding?.header?.fontId || 'Inter', // Header menu font
        branding?.header?.logoFont || 'Inter', // Logo text font
        branding?.header?.dropdownCategoryFontId || 'Inter', // Dropdown category font
        branding?.header?.dropdownProductFontId || 'Inter', // Dropdown product font
        (branding?.hero?.overlay as any)?.titleFontId || 'Poppins', // Banner title font
        (branding?.hero?.overlay as any)?.subtitleFontId || 'Inter', // Banner subtitle font
        branding?.forside?.productsSection?.button?.font || 'Poppins',
        branding?.forside?.productsSection?.card?.titleFont,
        branding?.forside?.productsSection?.card?.bodyFont,
        branding?.forside?.productsSection?.card?.priceFont,
        // Extract per-banner fonts from hero images
        ...(branding?.hero?.images || []).flatMap((img: any) => [
            img.titleFontId,
            img.subtitleFontId
        ]),
    ].filter(Boolean) as string[];
}

/**
 * Provider that listens for branding updates via postMessage when in preview mode.
 * In production, it just passes through null so components use their normal data sources.
 */
export function PreviewBrandingProvider({
    children,
    initialBranding = null,
    initialTenantName = "WebPrinter",
    previewPath = null,
}: PreviewBrandingProviderProps) {
    const [hasLiveUpdate, setHasLiveUpdate] = useState(false);
    const initialAppliedRef = useRef(false);
    const [branding, setBranding] = useState<BrandingData | null>(
        initialBranding ? mergeBrandingWithDefaults(initialBranding) : null
    );
    const [productPricingOverrides, setProductPricingOverrides] = useState<Record<string, unknown>>({});
    const [tenantName, setTenantName] = useState(initialTenantName);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const [isReady, setIsReady] = useState(!!initialBranding);
    const [editMode, setEditMode] = useState(false);
    const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

    // Update state when initial props change
    useEffect(() => {
        if (initialBranding && !initialAppliedRef.current) {
            const newBranding = mergeBrandingWithDefaults(initialBranding);
            setBranding(newBranding);
            setIsReady(true);
            initialAppliedRef.current = true;

            // Load fonts for initial branding (including per-banner fonts)
            loadGoogleFonts(extractFontsFromBranding(newBranding));
        }
    }, [initialBranding]);

    useEffect(() => {
        if (initialTenantName) {
            setTenantName(initialTenantName);
        }
    }, [initialTenantName]);

    // Check if we're in an iframe or have preview params
    useEffect(() => {
        const isInIframe = window.self !== window.top;
        const params = new URLSearchParams(window.location.search);
        const hasPreviewParam = params.get("preview_mode") === "1" || params.get("draft") === "1";

        setIsPreviewMode(isInIframe || hasPreviewParam);

        // If not in preview mode and we have initial branding, we're ready
        if (!isInIframe && !hasPreviewParam && initialBranding) {
            setIsReady(true);
        }
    }, [initialBranding]);

    // Listen for branding updates from parent admin panel
    useEffect(() => {
        if (!isPreviewMode) return;

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === "BRANDING_UPDATE") {
                const newBranding = mergeBrandingWithDefaults(event.data.branding);
                setBranding(newBranding);
                setHasLiveUpdate(true);
                initialAppliedRef.current = true;

                if (event.data.tenantName) {
                    setTenantName(event.data.tenantName);
                }

                setIsReady(true);

                // Load fonts dynamically when branding changes
                loadGoogleFonts(extractFontsFromBranding(newBranding));
            }

            if (event.data?.type === "PRODUCT_PRICING_PREVIEW_UPDATE") {
                const productId = typeof event.data.productId === "string" ? event.data.productId : "";
                if (!productId) return;

                setProductPricingOverrides((prev) => ({
                    ...prev,
                    [productId]: event.data.pricingStructure || null,
                }));
            }

            if (event.data?.type === "SET_EDIT_MODE") {
                setEditMode(Boolean(event.data.enabled));
                if (!event.data.enabled) {
                    setSelectedElementId(null);
                }
            }

            if (event.data?.type === "CLEAR_SELECTION") {
                setSelectedElementId(null);
            }
        };

        window.addEventListener("message", handleMessage);

        // Signal to parent that we're ready to receive branding
        if (window.parent !== window) {
            window.parent.postMessage({ type: "PREVIEW_READY" }, "*");
        }

        return () => window.removeEventListener("message", handleMessage);
    }, [isPreviewMode]);

    useEffect(() => {
        if (!isPreviewMode) return;

        document.documentElement.setAttribute("data-site-design-edit-mode", editMode ? "true" : "false");

        const handleClick = (event: MouseEvent) => {
            if (!editMode) return;

            const target = event.target as HTMLElement | null;
            const brandingElement = target?.closest?.(
                "[data-site-design-target], [data-branding-id], [data-click-to-edit]",
            ) as HTMLElement | null;

            if (!brandingElement) return;

            const sectionId = brandingElement.getAttribute("data-site-design-target")
                || brandingElement.getAttribute("data-branding-id")
                || brandingElement.getAttribute("data-click-to-edit");

            if (!sectionId) return;

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();

            setSelectedElementId(sectionId);
            brandingElement.setAttribute("data-selected", "true");

            window.parent.postMessage({ type: "EDIT_SECTION", sectionId }, "*");
            window.parent.postMessage({ type: "ELEMENT_CLICKED", sectionId }, "*");
        };

        document.addEventListener("click", handleClick, true);

        return () => {
            document.removeEventListener("click", handleClick, true);
            document.documentElement.removeAttribute("data-site-design-edit-mode");
        };
    }, [isPreviewMode, editMode]);

    useEffect(() => {
        if (!isPreviewMode) return;

        document.querySelectorAll("[data-selected='true']").forEach((element) => {
            if (
                element.getAttribute("data-site-design-target") !== selectedElementId
                && element.getAttribute("data-branding-id") !== selectedElementId
                && element.getAttribute("data-click-to-edit") !== selectedElementId
            ) {
                element.removeAttribute("data-selected");
            }
        });

        if (!selectedElementId) return;

        const selected = document.querySelector(
            `[data-site-design-target="${CSS.escape(selectedElementId)}"], [data-branding-id="${CSS.escape(selectedElementId)}"], [data-click-to-edit="${CSS.escape(selectedElementId)}"]`,
        );
        selected?.setAttribute("data-selected", "true");
    }, [isPreviewMode, selectedElementId]);

    useEffect(() => {
        if (!isPreviewMode) return;

        const styleId = "site-design-preview-click-to-edit-styles";
        if (document.getElementById(styleId)) return;

        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            [data-site-design-edit-mode="true"] [data-site-design-target],
            [data-site-design-edit-mode="true"] [data-branding-id],
            [data-site-design-edit-mode="true"] [data-click-to-edit] {
                cursor: pointer;
            }

            [data-site-design-edit-mode="true"] [data-site-design-target]:hover,
            [data-site-design-edit-mode="true"] [data-branding-id]:hover,
            [data-site-design-edit-mode="true"] [data-click-to-edit]:hover,
            [data-site-design-edit-mode="true"] [data-selected="true"] {
                outline: 2px solid hsl(var(--primary));
                outline-offset: 4px;
            }
        `;
        document.head.appendChild(style);

        return () => {
            style.remove();
        };
    }, [isPreviewMode]);

    // Listen for broadcasted branding updates (opened in new window)
    useEffect(() => {
        // Only use broadcast when in preview mode (iframe or ?draft/preview)
        const params = new URLSearchParams(window.location.search);
        const hasPreviewParam = params.get("preview_mode") === "1" || params.get("draft") === "1";
        const isInIframe = window.self !== window.top;
        const useBroadcast = isInIframe || hasPreviewParam;
        if (!useBroadcast) return;

        const channel = new BroadcastChannel('branding-preview');

        const handleBroadcast = (event: MessageEvent) => {
            if (event.data?.type === "BRANDING_UPDATE") {
                const newBranding = mergeBrandingWithDefaults(event.data.branding);
                setBranding(newBranding);
                setHasLiveUpdate(true);
                initialAppliedRef.current = true;

                if (event.data.tenantName) {
                    setTenantName(event.data.tenantName);
                }

                setIsReady(true);

                loadGoogleFonts(extractFontsFromBranding(newBranding));
            }

            if (event.data?.type === "PRODUCT_PRICING_PREVIEW_UPDATE") {
                const productId = typeof event.data.productId === "string" ? event.data.productId : "";
                if (!productId) return;

                setProductPricingOverrides((prev) => ({
                    ...prev,
                    [productId]: event.data.pricingStructure || null,
                }));
            }

            if (event.data?.type === "BRANDING_PING") {
                channel.postMessage({ type: "BRANDING_PONG" });
            }
        };

        // Request the latest branding snapshot from whoever owns it (admin/editor)
        channel.postMessage({ type: "REQUEST_BRANDING" });
        // Also announce readiness so admin can reply
        channel.postMessage({ type: "PREVIEW_READY_BROADCAST" });

        channel.addEventListener("message", handleBroadcast);

        return () => {
            channel.removeEventListener("message", handleBroadcast);
            channel.close();
        };
    }, []);

    const fontSignature = JSON.stringify(extractFontsFromBranding(branding));

    // Load fonts for initial branding too (including local section overrides)
    useEffect(() => {
        loadGoogleFonts(extractFontsFromBranding(branding));
    }, [fontSignature, branding]);

    // Apply global product image filters
    useEffect(() => {
        if (!branding?.productImages) return;

        const root = document.documentElement;
        root.style.setProperty('--product-hue-rotate', `${branding.productImages.hueRotate}deg`);
        root.style.setProperty('--product-saturate', `${branding.productImages.saturate}%`);
        root.style.setProperty('--product-filter', buildProductFilter(branding.productImages));
    }, [branding?.productImages?.setId, branding?.productImages?.hueRotate, branding?.productImages?.saturate]);

    // Apply favicon from branding
    useEffect(() => {
        if (!branding?.favicon) return;
        applyFavicon(branding.favicon);
    }, [branding?.favicon?.type, branding?.favicon?.presetId, branding?.favicon?.presetColor, branding?.favicon?.customUrl]);

    return (
        <PreviewBrandingContext.Provider value={{ branding, productPricingOverrides, isPreviewMode, tenantName, previewPath, isReady }}>
            {children}
        </PreviewBrandingContext.Provider>
    );
}

/**
 * Hook to access preview branding in components.
 */
export function usePreviewBranding() {
    return useContext(PreviewBrandingContext);
}

/**
 * Helper to merge preview branding with default/fallback values.
 */
export function usePreviewBrandingValue<K extends keyof BrandingData>(
    key: K,
    fallback: BrandingData[K]
): BrandingData[K] {
    const { branding, isPreviewMode } = usePreviewBranding();

    if (isPreviewMode && branding) {
        return branding[key] ?? fallback;
    }

    return fallback;
}
