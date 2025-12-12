import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink, Monitor, Smartphone, Tablet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrandingPreviewFrameProps {
    previewUrl: string;
    refreshKey?: number; // Change this to force refresh
}

type ViewportSize = "desktop" | "tablet" | "mobile";

const VIEWPORT_SIZES: Record<ViewportSize, { width: number; label: string }> = {
    desktop: { width: 1200, label: "Desktop" },
    tablet: { width: 768, label: "Tablet" },
    mobile: { width: 375, label: "Mobil" },
};

export function BrandingPreviewFrame({ previewUrl, refreshKey = 0 }: BrandingPreviewFrameProps) {
    const [viewport, setViewport] = useState<ViewportSize>("desktop");
    const [isLoading, setIsLoading] = useState(true);
    const [iframeKey, setIframeKey] = useState(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Refresh when refreshKey changes
    useEffect(() => {
        setIframeKey(prev => prev + 1);
        setIsLoading(true);
    }, [refreshKey]);

    const handleRefresh = () => {
        setIframeKey(prev => prev + 1);
        setIsLoading(true);
    };

    const handleLoad = () => {
        setIsLoading(false);
    };

    const openInNewTab = () => {
        window.open(previewUrl, '_blank');
    };

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                <div className="flex items-center gap-1">
                    {(["desktop", "tablet", "mobile"] as ViewportSize[]).map((size) => (
                        <Button
                            key={size}
                            variant={viewport === size ? "secondary" : "ghost"}
                            size="sm"
                            className="gap-1.5"
                            onClick={() => setViewport(size)}
                        >
                            {size === "desktop" && <Monitor className="w-4 h-4" />}
                            {size === "tablet" && <Tablet className="w-4 h-4" />}
                            {size === "mobile" && <Smartphone className="w-4 h-4" />}
                            <span className="hidden sm:inline">{VIEWPORT_SIZES[size].label}</span>
                        </Button>
                    ))}
                </div>

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
                        <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={openInNewTab}>
                        <ExternalLink className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Preview Area */}
            <div className="flex-1 bg-muted/50 p-4 overflow-auto">
                <div
                    className={cn(
                        "mx-auto bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300",
                        viewport === "desktop" && "w-full max-w-[1200px]",
                        viewport === "tablet" && "w-[768px] max-w-full",
                        viewport === "mobile" && "w-[375px] max-w-full"
                    )}
                    style={{ height: "calc(100% - 2rem)" }}
                >
                    {/* Loading Overlay */}
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                            <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <span className="text-sm text-muted-foreground">Indlæser preview...</span>
                            </div>
                        </div>
                    )}

                    {/* Iframe */}
                    <iframe
                        ref={iframeRef}
                        key={iframeKey}
                        src={previewUrl}
                        className="w-full h-full border-0"
                        onLoad={handleLoad}
                        title="Branding Preview"
                        sandbox="allow-scripts allow-same-origin"
                    />
                </div>
            </div>

            {/* Status Bar */}
            <div className="p-2 border-t bg-muted/30 text-xs text-muted-foreground text-center">
                {isLoading ? "Indlæser..." : `Preview · ${VIEWPORT_SIZES[viewport].label} (${VIEWPORT_SIZES[viewport].width}px)`}
            </div>
        </div>
    );
}
