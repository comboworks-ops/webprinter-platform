import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink, Monitor, Smartphone, Tablet, Loader2, Home, Send, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { BrandingData } from "@/hooks/useBrandingDraft";

interface BrandingPreviewFrameProps {
    previewUrl: string;
    branding: BrandingData; // Real-time branding data from parent
    tenantName?: string;
    /** Optional callback to publish directly from preview */
    onPublish?: () => void;
    /** Whether publishing is in progress */
    isPublishing?: boolean;
    /** Optional callback to save draft before opening in new tab */
    onSaveDraft?: () => Promise<void>;
}

type ViewportSize = "desktop" | "tablet" | "mobile";

const VIEWPORT_SIZES: Record<ViewportSize, { width: number; height: number; label: string }> = {
    desktop: { width: 1280, height: 800, label: "Desktop" },
    tablet: { width: 768, height: 1024, label: "Tablet" },
    mobile: { width: 390, height: 844, label: "Mobil" },
};

// Allowed preview routes - only customer-visible pages
const ALLOWED_PREVIEW_PATHS = [
    '/',
    '/shop',
    '/produkter',
    '/produkt/',
    '/kontakt',
    '/om-os',
    '/betingelser',
];

export function BrandingPreviewFrame({
    previewUrl,
    branding,
    tenantName = "Din Shop",
    onPublish,
    isPublishing = false,
    onSaveDraft,
}: BrandingPreviewFrameProps) {
    // Broadcast channel so detached preview windows get live updates
    const broadcastRef = useRef<BroadcastChannel | null>(null);
    const [viewport, setViewport] = useState<ViewportSize>("desktop");
    const [isLoading, setIsLoading] = useState(true);
    const [iframeReady, setIframeReady] = useState(false);
    const [currentPath, setCurrentPath] = useState("/");
    const [isSavingForPreview, setIsSavingForPreview] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

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
                const path = event.data.path;

                // Check if navigation is allowed
                const isAllowed = ALLOWED_PREVIEW_PATHS.some(allowed =>
                    path === allowed || path.startsWith(allowed)
                );

                if (isAllowed) {
                    setCurrentPath(path);
                } else {
                    // Block navigation to non-customer pages
                    navigateToFrontpage();
                }
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [sendBrandingToIframe]);

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

    const navigateToFrontpage = () => {
        if (iframeRef.current?.contentWindow) {
            // Send navigation command to iframe
            iframeRef.current.contentWindow.postMessage(
                { type: 'NAVIGATE_TO', path: '/' },
                '*'
            );
        }
        setCurrentPath("/");
        // Also refresh to ensure we're on frontpage
        handleRefresh();
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
        // Open with draft=1 to load from saved draft
        const urlWithDraft = previewUrl.includes('?')
            ? `${previewUrl}&draft=1&t=${Date.now()}`
            : `${previewUrl}?draft=1&t=${Date.now()}`;
        window.open(urlWithDraft, '_blank');
    };

    const currentSize = VIEWPORT_SIZES[viewport];
    const scale = viewport === "desktop" ? 0.6 : viewport === "tablet" ? 0.5 : 0.45;

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 border-b bg-white/80 backdrop-blur">
                <div className="flex items-center gap-1">
                    {(["desktop", "tablet", "mobile"] as ViewportSize[]).map((size) => (
                        <Button
                            key={size}
                            variant={viewport === size ? "default" : "ghost"}
                            size="sm"
                            className="gap-1.5 h-8"
                            onClick={() => setViewport(size)}
                        >
                            {size === "desktop" && <Monitor className="w-4 h-4" />}
                            {size === "tablet" && <Tablet className="w-4 h-4" />}
                            {size === "mobile" && <Smartphone className="w-4 h-4" />}
                            <span className="hidden lg:inline text-xs">{VIEWPORT_SIZES[size].label}</span>
                        </Button>
                    ))}
                </div>

                <div className="flex items-center gap-1">
                    {iframeReady && (
                        <span className="text-xs text-green-600 mr-2 hidden sm:inline">● Live</span>
                    )}

                    {/* Back to Frontpage */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1"
                        onClick={navigateToFrontpage}
                        title="Tilbage til forside"
                    >
                        <Home className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs">Forside</span>
                    </Button>

                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleRefresh} disabled={isLoading}>
                        <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={openInNewTab}
                        disabled={isSavingForPreview}
                        title="Åbn preview i nyt vindue"
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
            <div className="px-2 py-1 bg-amber-50 border-b border-amber-200 text-xs text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Preview viser kun kundesynlige sider. Backend er ikke tilgængelig.
            </div>

            {/* Device Preview Area */}
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
                {/* Device Frame */}
                <div
                    className={cn(
                        "relative bg-gray-800 rounded-[2rem] shadow-2xl transition-all duration-500 ease-out",
                        viewport === "mobile" && "rounded-[2.5rem]",
                        viewport === "tablet" && "rounded-[1.5rem]"
                    )}
                    style={{
                        width: currentSize.width * scale + 24,
                        height: currentSize.height * scale + 24,
                        padding: 12,
                    }}
                >
                    {/* Notch for mobile */}
                    {viewport === "mobile" && (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-20 h-5 bg-gray-800 rounded-b-xl z-10" />
                    )}

                    {/* Screen */}
                    <div
                        className="relative w-full h-full bg-white rounded-xl overflow-hidden"
                        style={{ borderRadius: viewport === "mobile" ? "1.5rem" : "0.75rem" }}
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
                                onLoad={handleLoad}
                                title="Branding Preview"
                                sandbox="allow-scripts allow-same-origin"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Bar with Publish Option */}
            <div className="p-2 border-t bg-white/80 backdrop-blur flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                    {currentSize.width} × {currentSize.height}px · {iframeReady ? "Live synkronisering" : "Venter på preview..."}
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
    );
}
