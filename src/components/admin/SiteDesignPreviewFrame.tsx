import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink, Monitor, Smartphone, Tablet, Loader2, Home, Send, AlertTriangle, RotateCcw, Trash2, Crosshair, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { BrandingData } from "@/hooks/useBrandingDraft";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    getSiteDesignPreviewPathname,
    getSiteDesignPreviewProductSlug,
    normalizeSiteDesignPreviewPath,
} from "@/lib/preview/siteDesignPreviewNavigation";
import {
    buildProductPricingPreviewMessages,
    type ProductPricingPreviewState,
} from "@/lib/preview/productPricingPreview";

export interface SiteDesignPreviewProductOption {
    id: string;
    name: string;
    slug: string;
}

interface SiteDesignPreviewFrameProps {
    presentation?: "device" | "workspace";
    previewUrl: string;
    branding: BrandingData; // Real-time branding data from parent
    tenantName?: string;
    /** Optional callback to publish directly from preview */
    onPublish?: () => void;
    /** Whether publishing is in progress */
    isPublishing?: boolean;
    /** Optional callback to save draft before opening in new tab */
    onSaveDraft?: () => Promise<void>;
    /** Optional callback to reset design to default */
    onResetDesign?: () => void;
    /** External navigation request from editor */
    navigationRequest?: {
        id: number;
        type: "path" | "first-product";
        path?: string;
    } | null;
    /** Product-specific pricing structure override for preview-only rendering */
    productPricingPreview?: ProductPricingPreviewState | null;
    /** Called when preview path changes */
    onPreviewPathChange?: (path: string) => void;
    /** Whether preview clicks should select editable elements instead of navigating */
    editMode?: boolean;
    /** Toggle callback for preview edit mode */
    onEditModeChange?: (enabled: boolean) => void;
    /** Signal to clear selection in preview */
    clearSelectionSignal?: number;
    /** Products available for direct product-page preview */
    previewProducts?: SiteDesignPreviewProductOption[];
}

type ViewportSize = "desktop" | "tablet" | "mobile";

const VIEWPORT_SIZES: Record<ViewportSize, { width: number; height: number; label: string }> = {
    desktop: { width: 1280, height: 800, label: "Desktop" },
    tablet: { width: 768, height: 1024, label: "Tablet" },
    mobile: { width: 390, height: 844, label: "Mobil" },
};

const DESKTOP_FRAME_WIDTH = VIEWPORT_SIZES.desktop.width + 24;
const DESKTOP_SCREEN_FRAME_HEIGHT = VIEWPORT_SIZES.desktop.height + 24;
const DESKTOP_FRAME_HEIGHT = DESKTOP_SCREEN_FRAME_HEIGHT + 32;

// Allowed preview routes - only customer-visible pages
const ALLOWED_PREVIEW_PATHS = [
    '/',
    '/shop',
    '/produkter',
    '/produkt/',
    '/kontakt',
    '/om-os',
    '/grafisk-vejledning',
    '/betingelser',
    '/vilkaar',
    '/cookies',
    '/cookiepolitik',
    '/privatliv',
    '/checkout',
];

export function SiteDesignPreviewFrame({
    presentation = "device",
    previewUrl,
    branding,
    tenantName = "Din Shop",
    onPublish,
    isPublishing = false,
    onSaveDraft,
    onResetDesign,
    navigationRequest,
    productPricingPreview,
    onPreviewPathChange,
    editMode = false,
    onEditModeChange,
    clearSelectionSignal,
    previewProducts = [],
}: SiteDesignPreviewFrameProps) {
    // Broadcast channel so detached preview windows get live updates
    const broadcastRef = useRef<BroadcastChannel | null>(null);
    const previousPricingPreviewProductIdRef = useRef<string | null>(null);
    const [viewport, setViewport] = useState<ViewportSize>("desktop");
    const [isFlipped, setIsFlipped] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [iframeReady, setIframeReady] = useState(false);
    const [currentPath, setCurrentPath] = useState("/");
    const [menuPreviewOpen, setMenuPreviewOpen] = useState(false);
    const [desktopScale, setDesktopScale] = useState(0.6);
    const [workspaceHeight, setWorkspaceHeight] = useState(VIEWPORT_SIZES.desktop.height);
    const [isSavingForPreview, setIsSavingForPreview] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const previewAreaRef = useRef<HTMLDivElement>(null);
    const lastNavigationIdRef = useRef<number | null>(null);

    const syncEditModeToIframe = useCallback(() => {
        console.log('[PreviewFrame] syncEditModeToIframe called, editMode:', editMode, 'iframeReady:', iframeReady);
        if (iframeRef.current?.contentWindow) {
            console.log('[PreviewFrame] Sending SET_EDIT_MODE:', editMode);
            iframeRef.current.contentWindow.postMessage(
                { type: "SET_EDIT_MODE", enabled: editMode },
                "*"
            );
            // Clear selection when exiting edit mode
            if (!editMode) {
                iframeRef.current.contentWindow.postMessage(
                    { type: "CLEAR_SELECTION" },
                    "*"
                );
            }
        } else {
            console.log('[PreviewFrame] Cannot send SET_EDIT_MODE - no contentWindow');
        }
    }, [editMode, iframeReady]);

    const syncMenuPreviewToIframe = useCallback((open = menuPreviewOpen) => {
        if (!iframeRef.current?.contentWindow || !iframeReady) return;
        iframeRef.current.contentWindow.postMessage(
            { type: "SET_PREVIEW_PRODUCT_MENU", open },
            "*"
        );
    }, [iframeReady, menuPreviewOpen]);

    const navigatePreviewToPath = useCallback((rawPath: string) => {
        const path = normalizeSiteDesignPreviewPath(rawPath);
        iframeRef.current?.contentWindow?.postMessage(
            { type: "NAVIGATE_TO", path },
            "*"
        );
        setCurrentPath(path);
        onPreviewPathChange?.(path);
        setMenuPreviewOpen(false);
        syncMenuPreviewToIframe(false);
    }, [onPreviewPathChange, syncMenuPreviewToIframe]);
    
    // Function to clear selection in iframe
    const clearSelection = useCallback(() => {
        if (iframeRef.current?.contentWindow && iframeReady) {
            iframeRef.current.contentWindow.postMessage(
                { type: "CLEAR_SELECTION" },
                "*"
            );
        }
    }, [iframeReady]);
    
    // Listen for clearSelectionSignal from parent
    useEffect(() => {
        if (clearSelectionSignal) {
            clearSelection();
        }
    }, [clearSelectionSignal, clearSelection]);

    // Send branding to iframe via postMessage
    const sendBrandingToIframe = useCallback(() => {
        if (iframeRef.current?.contentWindow && iframeReady) {
            iframeRef.current.contentWindow.postMessage(
                { type: 'BRANDING_UPDATE', branding, tenantName },
                '*'
            );
        }
        // Also broadcast to any open preview windows
        if (broadcastRef.current) {
            broadcastRef.current.postMessage({ type: 'BRANDING_UPDATE', branding, tenantName });
        }
    }, [branding, tenantName, iframeReady]);

    // Send branding whenever it changes
    useEffect(() => {
        sendBrandingToIframe();
    }, [sendBrandingToIframe]);

    // Listen for iframe ready signal and navigation events
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'PREVIEW_READY') {
                setIframeReady(true);
                setIsLoading(false);
                // Send initial branding
                setTimeout(sendBrandingToIframe, 100);
            }

            // Handle navigation events from iframe
            if (event.data?.type === 'PREVIEW_NAVIGATION') {
                const path = normalizeSiteDesignPreviewPath(event.data.path);

                // Check if navigation is allowed
                const isAllowed = ALLOWED_PREVIEW_PATHS.some(allowed =>
                    path === allowed || path.startsWith(allowed)
                );

                if (isAllowed) {
                    setCurrentPath(path);
                    onPreviewPathChange?.(path);
                } else {
                    // Block navigation to non-customer pages
                    navigatePreviewToPath("/");
                }
            }

            if (event.data?.type === "PREVIEW_PRODUCT_MENU_CHANGED") {
                setMenuPreviewOpen(Boolean(event.data.open));
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [navigatePreviewToPath, onPreviewPathChange, sendBrandingToIframe]);

    useEffect(() => {
        if (!navigationRequest || !iframeReady || !iframeRef.current?.contentWindow) return;
        if (lastNavigationIdRef.current === navigationRequest.id) return;

        if (navigationRequest.type === "first-product") {
            iframeRef.current.contentWindow.postMessage(
                { type: "NAVIGATE_TO_FIRST_PRODUCT" },
                "*"
            );
            setCurrentPath("/produkt");
        } else if (navigationRequest.path) {
            const path = normalizeSiteDesignPreviewPath(navigationRequest.path);
            iframeRef.current.contentWindow.postMessage(
                { type: "NAVIGATE_TO", path },
                "*"
            );
            setCurrentPath(path);
        }

        lastNavigationIdRef.current = navigationRequest.id;
    }, [navigationRequest, iframeReady]);

    useEffect(() => {
        if (!iframeReady || !iframeRef.current?.contentWindow) return;

        const messages = buildProductPricingPreviewMessages({
            previousProductId: previousPricingPreviewProductIdRef.current,
            preview: productPricingPreview,
        });

        messages.forEach((message) => {
            iframeRef.current?.contentWindow?.postMessage(message, "*");
            broadcastRef.current?.postMessage(message);
        });

        previousPricingPreviewProductIdRef.current = productPricingPreview?.productId || null;
    }, [iframeReady, productPricingPreview]);

    useEffect(() => {
        if (!iframeReady) return;
        const timer = window.setTimeout(() => {
            syncEditModeToIframe();
            syncMenuPreviewToIframe();
        }, 80);
        return () => window.clearTimeout(timer);
    }, [iframeReady, syncEditModeToIframe, syncMenuPreviewToIframe]);

    useEffect(() => {
        if (presentation !== "workspace" && viewport !== "desktop") return;
        const previewArea = previewAreaRef.current;
        if (!previewArea) return;

        const updateDesktopScale = () => {
            const flat = presentation === "workspace";
            const availableWidth = Math.max(flat ? 1 : 320, previewArea.clientWidth - (flat ? 0 : 64));
            const availableHeight = Math.max(flat ? 1 : 240, previewArea.clientHeight - (flat ? 0 : 64));
            const size = VIEWPORT_SIZES[viewport];
            const width = flat ? (isFlipped ? size.height : size.width) : DESKTOP_FRAME_WIDTH;
            const height = flat ? (isFlipped ? size.width : size.height) : DESKTOP_FRAME_HEIGHT;
            const nextScale = Math.min(
                availableWidth / width,
                flat && viewport === "desktop" ? 1 : availableHeight / height,
                1,
            );
            const fittedScale = Math.max(flat ? 0.1 : 0.25, nextScale);
            setDesktopScale(fittedScale);
            if (flat && viewport === "desktop") setWorkspaceHeight(Math.floor(availableHeight / fittedScale));
        };

        updateDesktopScale();
        const observer = new ResizeObserver(updateDesktopScale);
        observer.observe(previewArea);
        return () => observer.disconnect();
    }, [viewport, isFlipped, presentation]);

    // Setup broadcast channel for cross-window preview updates
    useEffect(() => {
        const channel = new BroadcastChannel('branding-preview');
        broadcastRef.current = channel;

        const handleBroadcast = (event: MessageEvent) => {
            // Preview windows can request the latest branding snapshot when they boot
            if (event.data?.type === 'REQUEST_BRANDING' || event.data?.type === 'PREVIEW_READY_BROADCAST') {
                channel.postMessage({ type: 'BRANDING_UPDATE', branding, tenantName });
            }
        };

        channel.addEventListener('message', handleBroadcast);

        return () => {
            channel.removeEventListener('message', handleBroadcast);
            channel.close();
            broadcastRef.current = null;
        };
    }, [branding, tenantName]);

    const handleLoad = () => {
        // Iframe loaded, wait for PREVIEW_READY message
        // If no message after 2s, assume legacy mode
        setTimeout(() => {
            if (!iframeReady) {
                setIsLoading(false);
            }
        }, 2000);
    };

    const handleRefresh = () => {
        setIsLoading(true);
        setIframeReady(false);
        if (iframeRef.current) {
            iframeRef.current.src = previewUrl + '&t=' + Date.now();
        }
    };

    const openInNewTab = async () => {
        // If we have a save callback, save draft first so new tab has current changes
        if (onSaveDraft) {
            setIsSavingForPreview(true);
            try {
                await onSaveDraft();
                toast.info("Kladde gemt - åbner preview...");
            } catch (err) {
                toast.error("Kunne ikke gemme kladde før preview");
                setIsSavingForPreview(false);
                return;
            }
            setIsSavingForPreview(false);
        }
        // Open with draft=1 to enable BroadcastChannel listening (but NOT preview_mode=1, which enables editing UI)
        const urlWithDraft = previewUrl.includes('?')
            ? `${previewUrl}&draft=1&t=${Date.now()}`
            : `${previewUrl}?draft=1&t=${Date.now()}`;
        window.open(urlWithDraft, '_blank');

        // Send branding via broadcast channel immediately so new tab gets it
        setTimeout(() => {
            if (broadcastRef.current) {
                broadcastRef.current.postMessage({ type: 'BRANDING_UPDATE', branding, tenantName });
            }
        }, 500);
    };

    const baseSize = VIEWPORT_SIZES[viewport];
    // When flipped (landscape), swap width and height for tablet/mobile
    const currentSize = (viewport !== "desktop" && isFlipped)
        ? { ...baseSize, width: baseSize.height, height: baseSize.width }
        : baseSize;
    const displaySize = presentation === "workspace" && viewport === "desktop"
        ? { width: currentSize.width, height: workspaceHeight }
        : currentSize;
    // Increased scale for tablet/mobile
    const scale = viewport === "tablet" ? 0.75 : 0.7;
    const currentPathname = getSiteDesignPreviewPathname(currentPath);
    const currentProductSlug = getSiteDesignPreviewProductSlug(currentPath);
    const previewDestinationValue = currentProductSlug
        ? `product:${currentProductSlug}`
        : currentPathname === "/checkout"
            ? "page:/checkout"
            : currentPathname === "/produkter" || currentPathname === "/shop"
                ? "page:/produkter"
                : "page:/";

    const handlePreviewDestinationChange = (value: string) => {
        if (value.startsWith("product:")) {
            const slug = value.slice("product:".length);
            navigatePreviewToPath(`/produkt/${encodeURIComponent(slug)}`);
            return;
        }

        navigatePreviewToPath(value.slice("page:".length) || "/");
    };

    const handleMenuPreviewToggle = () => {
        const nextOpen = !menuPreviewOpen;
        setMenuPreviewOpen(nextOpen);
        syncMenuPreviewToIframe(nextOpen);
    };

    return (
        <TooltipProvider delayDuration={180}>
        <div className={cn("flex flex-col h-full bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg overflow-hidden", presentation === "workspace" && "sd-frame-workspace")}>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 border-b bg-white/80 backdrop-blur">
                <div className="flex min-w-0 flex-wrap items-center gap-1">
                    {(["desktop", "tablet", "mobile"] as ViewportSize[]).map((size) => (
                        <Button
                            key={size}
                            aria-label={VIEWPORT_SIZES[size].label}
                            aria-pressed={viewport === size}
                            variant={viewport === size ? "default" : "ghost"}
                            size="sm"
                            className="gap-1.5 h-8"
                            onClick={() => {
                                setViewport(size);
                                // Reset flip when switching to desktop
                                if (size === "desktop") setIsFlipped(false);
                            }}
                        >
                            {size === "desktop" && <Monitor className="w-4 h-4" />}
                            {size === "tablet" && <Tablet className={cn("w-4 h-4", viewport === "tablet" && isFlipped && "rotate-90")} />}
                            {size === "mobile" && <Smartphone className={cn("w-4 h-4", viewport === "mobile" && isFlipped && "rotate-90")} />}
                            <span className="hidden lg:inline text-xs">{VIEWPORT_SIZES[size].label}</span>
                        </Button>
                    ))}

                    {/* Flip button - only for tablet/mobile */}
                    {viewport !== "desktop" && (
                        <Button
                            variant={isFlipped ? "secondary" : "ghost"}
                            size="sm"
                            className="h-8 w-8 p-0 ml-1"
                            onClick={() => setIsFlipped(!isFlipped)}
                            title={isFlipped ? "Portræt" : "Landskab"}
                            aria-label={isFlipped ? "Vis portræt" : "Vis landskab"}
                        >
                            <RotateCcw className="w-4 h-4" />
                        </Button>
                    )}

                    {onEditModeChange && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={editMode ? "default" : "outline"}
                                    size="sm"
                                    className="ml-2 h-8 gap-1.5"
                                    onClick={() => onEditModeChange(!editMode)}
                                    aria-label={editMode ? "Afslut klik-redigering" : "Aktivér klik-redigering"}
                                    aria-pressed={editMode}
                                >
                                    <Crosshair className="w-4 h-4" />
                                    <span className="hidden lg:inline text-xs">
                                        {editMode ? "Redigering aktiv" : "Redigér"}
                                    </span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                {editMode
                                    ? "Afslut klik-redigering og brug previewet normalt"
                                    : "Aktivér klik-redigering i previewet"}
                            </TooltipContent>
                        </Tooltip>
                    )}

                    <Select
                        value={previewDestinationValue}
                        onValueChange={handlePreviewDestinationChange}
                    >
                        <SelectTrigger
                            className="ml-1 h-8 w-[172px] bg-white text-xs sm:w-[210px]"
                            aria-label="Vælg side eller produkt til preview"
                        >
                            <SelectValue placeholder="Vælg preview" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectLabel>Sider</SelectLabel>
                                <SelectItem value="page:/">Forside</SelectItem>
                                <SelectItem value="page:/produkter">Produktoversigt</SelectItem>
                                <SelectItem value="page:/checkout">Checkout</SelectItem>
                            </SelectGroup>
                            {previewProducts.some((product) => Boolean(product.slug)) ? (
                                <>
                                    <SelectSeparator />
                                    <SelectGroup>
                                        <SelectLabel>Produktsider</SelectLabel>
                                        {previewProducts
                                            .filter((product) => Boolean(product.slug))
                                            .map((product) => (
                                                <SelectItem
                                                    key={product.id}
                                                    value={`product:${product.slug}`}
                                                >
                                                    {product.name}
                                                </SelectItem>
                                            ))}
                                    </SelectGroup>
                                </>
                            ) : null}
                        </SelectContent>
                    </Select>

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant={menuPreviewOpen ? "default" : "outline"}
                                size="icon"
                                className="ml-1 h-8 w-8 shrink-0"
                                onClick={handleMenuPreviewToggle}
                                aria-label={menuPreviewOpen ? "Skjul produktmenu" : "Vis produktmenu"}
                                aria-pressed={menuPreviewOpen}
                            >
                                <Menu className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {menuPreviewOpen ? "Skjul produktmenu" : "Vis produktmenu"}
                        </TooltipContent>
                    </Tooltip>
                </div>

                <div className="flex items-center gap-1">
                    {iframeReady && (
                        <span className="text-xs text-green-600 mr-2 hidden sm:inline">● Live</span>
                    )}

                    {/* Reset Design */}
                    {onResetDesign && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={onResetDesign}
                            title="Nulstil til standard design"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline text-xs">Nulstil design</span>
                        </Button>
                    )}

                    {/* Back to Frontpage */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => navigatePreviewToPath("/")}
                        title="Tilbage til forside"
                    >
                        <Home className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs">Forside</span>
                    </Button>

                    <Button aria-label="Opdatér preview" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleRefresh} disabled={isLoading}>
                        <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={openInNewTab}
                        disabled={isSavingForPreview}
                        title="Åbn preview i nyt vindue"
                        aria-label="Åbn preview i nyt vindue"
                    >
                        {isSavingForPreview ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <ExternalLink className="w-4 h-4" />
                        )}
                    </Button>
                </div>
            </div>

            {/* Preview Security Notice */}
            <div className="sd-preview-hint px-2 py-1 bg-amber-50 border-b border-amber-200 text-xs text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {editMode
                    ? "Klik på markerbare elementer i preview for at åbne den rigtige værktøjssektion."
                    : "Preview viser kun kundesynlige sider. Backend er ikke tilgængelig."}
            </div>

            {/* Device Preview Area */}
            <div
                ref={previewAreaRef}
                className="sd-preview-area flex-1 flex items-center justify-center bg-slate-100 overflow-hidden relative p-8"
            >
                {presentation === "workspace" ? (
                    <div className="sd-flat-preview" style={{ width: displaySize.width * desktopScale, height: displaySize.height * desktopScale }}>
                        {isLoading && <div className="sd-preview-loading" role="status"><Loader2 className="h-6 w-6 animate-spin" />Indlæser preview…</div>}
                        <div style={{ width: displaySize.width, height: displaySize.height, transform: `scale(${desktopScale})` }}>
                            <iframe
                                ref={iframeRef}
                                src={previewUrl}
                                className="h-full w-full border-0"
                                onLoad={() => {
                                    handleLoad();
                                    setTimeout(sendBrandingToIframe, 500);
                                    setTimeout(syncEditModeToIframe, 600);
                                    setTimeout(syncMenuPreviewToIframe, 650);
                                }}
                                title="Branding Preview"
                                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                            />
                        </div>
                    </div>
                ) : viewport === "desktop" ? (
                    <div
                        className="relative shrink-0"
                        style={{
                            width: DESKTOP_FRAME_WIDTH * desktopScale,
                            height: DESKTOP_FRAME_HEIGHT * desktopScale,
                        }}
                    >
                        <div
                            className="absolute left-0 top-0 flex flex-col items-center"
                            style={{
                                width: DESKTOP_FRAME_WIDTH,
                                height: DESKTOP_FRAME_HEIGHT,
                                transform: `scale(${desktopScale})`,
                                transformOrigin: "top left",
                            }}
                        >
                            <div
                                className="relative shrink-0 rounded-xl bg-gray-800 p-3 shadow-2xl ring-1 ring-white/10"
                                style={{
                                    width: DESKTOP_FRAME_WIDTH,
                                    height: DESKTOP_SCREEN_FRAME_HEIGHT,
                                }}
                            >
                                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-gray-700 rounded-full z-10" />

                                <div
                                    className="relative overflow-hidden rounded-lg border border-gray-700/50 bg-white"
                                    style={{
                                        width: VIEWPORT_SIZES.desktop.width,
                                        height: VIEWPORT_SIZES.desktop.height,
                                    }}
                                >
                                    {isLoading && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-20 backdrop-blur-sm">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                                <span className="text-sm text-muted-foreground">Indlæser preview...</span>
                                            </div>
                                        </div>
                                    )}
                                    <iframe
                                        ref={iframeRef}
                                        src={previewUrl}
                                        className="h-full w-full border-0"
                                        onLoad={() => {
                                            handleLoad();
                                            setTimeout(sendBrandingToIframe, 500);
                                            setTimeout(syncEditModeToIframe, 600);
                                            setTimeout(syncMenuPreviewToIframe, 650);
                                        }}
                                        title="Branding Preview"
                                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                                    />
                                </div>
                            </div>
                            <div className="mt-[1px] h-4 w-32 rounded-b-xl bg-gray-700/50 shadow-lg" />
                            <div className="mt-1 h-1.5 w-48 rounded-full bg-gray-800/20 blur-sm" />
                        </div>
                    </div>
                ) : (
                    /* Scaled Device Frame (Tablet/Mobile) */
                    <div
                        className={cn(
                            "relative bg-gray-800 shadow-2xl flex-shrink-0 transition-all duration-500 ease-out",
                            viewport === "mobile" && "rounded-[2.5rem]",
                            viewport === "tablet" && "rounded-[1.5rem]"
                        )}
                        style={{
                            width: isFlipped
                                ? VIEWPORT_SIZES[viewport].height * scale + 24
                                : VIEWPORT_SIZES[viewport].width * scale + 24,
                            height: isFlipped
                                ? VIEWPORT_SIZES[viewport].width * scale + 24
                                : VIEWPORT_SIZES[viewport].height * scale + 24,
                            padding: 12,
                            transform: isFlipped ? 'rotate(0deg)' : 'rotate(0deg)',
                        }}
                    >
                        {/* Notch for mobile - moves to right side when flipped */}
                        {viewport === "mobile" && !isFlipped && (
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-gray-800 rounded-b-xl z-10 transition-all duration-500" />
                        )}
                        {viewport === "mobile" && isFlipped && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-20 bg-gray-800 rounded-l-xl z-10 transition-all duration-500" />
                        )}

                        {/* Screen */}
                        <div
                            className="relative w-full h-full bg-white overflow-hidden transition-all duration-500"
                            style={{
                                borderRadius: viewport === "mobile" ? "1.5rem" : "0.75rem"
                            }}
                        >
                            {/* Loading Overlay */}
                            {isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white z-20">
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                        <span className="text-sm text-muted-foreground">Indlæser...</span>
                                    </div>
                                </div>
                            )}

                            {/* Scaled Iframe Container */}
                            <div
                                style={{
                                    width: currentSize.width,
                                    height: currentSize.height,
                                    transform: `scale(${scale})`,
                                    transformOrigin: 'top left',
                                }}
                            >
                                <iframe
                                    ref={iframeRef}
                                    src={previewUrl}
                                    className="w-full h-full border-0"
                                    onLoad={() => {
                                        handleLoad();
                                        setTimeout(syncEditModeToIframe, 600);
                                        setTimeout(syncMenuPreviewToIframe, 650);
                                    }}
                                    title="Branding Preview"
                                    sandbox="allow-scripts allow-same-origin"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Status Bar with Publish Option */}
            <div className="p-2 border-t bg-white/80 backdrop-blur flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                    {displaySize.width} × {displaySize.height}px · {iframeReady ? "Live synkronisering" : "Venter på preview..."} · {editMode ? "Klik-redigering aktiv" : "Navigation aktiv"}
                </span>

                {onPublish && (
                    <Button
                        size="sm"
                        onClick={onPublish}
                        disabled={isPublishing}
                        className="h-7 text-xs gap-1"
                    >
                        {isPublishing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <Send className="w-3 h-3" />
                        )}
                        Publicér nu
                    </Button>
                )}
            </div>
        </div>
        </TooltipProvider>
    );
}
