import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink, Monitor, Smartphone, Tablet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrandingData } from "@/hooks/useBrandingDraft";

interface BrandingPreviewFrameProps {
    previewUrl: string;
    branding: BrandingData; // Real-time branding data from parent
    tenantName?: string;
}

type ViewportSize = "desktop" | "tablet" | "mobile";

const VIEWPORT_SIZES: Record<ViewportSize, { width: number; height: number; label: string }> = {
    desktop: { width: 1280, height: 800, label: "Desktop" },
    tablet: { width: 768, height: 1024, label: "Tablet" },
    mobile: { width: 390, height: 844, label: "Mobil" },
};

export function BrandingPreviewFrame({ previewUrl, branding, tenantName = "Din Shop" }: BrandingPreviewFrameProps) {
    const [viewport, setViewport] = useState<ViewportSize>("desktop");
    const [isLoading, setIsLoading] = useState(true);
    const [iframeReady, setIframeReady] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Send branding to iframe via postMessage
    const sendBrandingToIframe = useCallback(() => {
        if (iframeRef.current?.contentWindow && iframeReady) {
            iframeRef.current.contentWindow.postMessage(
                { type: 'BRANDING_UPDATE', branding, tenantName },
                '*'
            );
        }
    }, [branding, tenantName, iframeReady]);

    // Send branding whenever it changes
    useEffect(() => {
        sendBrandingToIframe();
    }, [sendBrandingToIframe]);

    // Listen for iframe ready signal
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'PREVIEW_READY') {
                setIframeReady(true);
                setIsLoading(false);
                // Send initial branding
                setTimeout(sendBrandingToIframe, 100);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [sendBrandingToIframe]);

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

    const openInNewTab = () => {
        window.open(previewUrl, '_blank');
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
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleRefresh} disabled={isLoading}>
                        <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={openInNewTab}>
                        <ExternalLink className="w-4 h-4" />
                    </Button>
                </div>
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

            {/* Status Bar */}
            <div className="p-2 border-t bg-white/80 backdrop-blur text-xs text-muted-foreground text-center">
                {currentSize.width} × {currentSize.height}px · {iframeReady ? "Live synkronisering" : "Venter på preview..."}
            </div>
        </div>
    );
}
