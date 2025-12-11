import { getGoogleFontsUrl } from "./FontSelector";
import { ArrowRight, Check, BarChart, Globe, ChevronDown } from "lucide-react";

interface BrandingPreviewProps {
    branding: {
        logo_url?: string | null;
        fonts?: {
            heading?: string;
            body?: string;
            pricing?: string;
        };
        colors?: {
            primary?: string;
            secondary?: string;
            background?: string;
            card?: string;
        };
        hero?: {
            type?: "image" | "slideshow" | "video";
            media?: string[];
            overlay_color?: string;
            overlay_opacity?: number;
        };
    };
    tenantName?: string;
}

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

export function BrandingPreview({ branding, tenantName = "Din Shop" }: BrandingPreviewProps) {
    const { fonts, colors, hero, logo_url } = branding;

    const headingFont = fonts?.heading || "Poppins";
    const bodyFont = fonts?.body || "Inter";
    const primaryColor = colors?.primary || "#0EA5E9";
    const backgroundColor = colors?.background || "#F8FAFC";
    const cardColor = colors?.card || "#FFFFFF";

    // Generate Google Fonts URL
    const fontsUrl = getGoogleFontsUrl([headingFont, bodyFont, fonts?.pricing || ""]);

    // CSS Variables for the preview
    const cssVars = {
        "--preview-primary": hexToHsl(primaryColor),
        "--preview-background": hexToHsl(backgroundColor),
        "--preview-card": hexToHsl(cardColor),
        "--preview-heading-font": `'${headingFont}', sans-serif`,
        "--preview-body-font": `'${bodyFont}', sans-serif`,
    } as React.CSSProperties;

    const hasHeroMedia = hero?.media && hero.media.length > 0 && hero.media[0];

    return (
        <div className="relative border rounded-xl overflow-hidden shadow-lg bg-muted/50">
            {/* Load Fonts */}
            {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

            {/* Preview Label */}
            <div className="absolute top-2 left-2 z-20 bg-black/70 text-white text-xs px-2 py-1 rounded-md">
                Live Preview
            </div>

            {/* Scaled Preview Container */}
            <div
                className="w-full aspect-video overflow-hidden"
                style={{
                    ...cssVars,
                    background: `hsl(var(--preview-background))`,
                }}
            >
                {/* Mini Header */}
                <div
                    className="flex items-center justify-between px-4 py-2 border-b"
                    style={{ background: `hsl(var(--preview-card))` }}
                >
                    <div className="flex items-center gap-2">
                        {logo_url ? (
                            <img src={logo_url} alt="Logo" className="h-6 w-auto object-contain" />
                        ) : (
                            <span
                                className="font-bold text-sm"
                                style={{ fontFamily: `var(--preview-heading-font)`, color: `hsl(var(--preview-primary))` }}
                            >
                                {tenantName}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Produkter</span>
                        <ChevronDown className="w-3 h-3" />
                        <span>Kontakt</span>
                    </div>
                </div>

                {/* Mini Hero */}
                <div
                    className="relative px-6 py-8 text-center"
                    style={{
                        background: hasHeroMedia
                            ? `url(${hero?.media?.[0]}) center/cover`
                            : `linear-gradient(135deg, hsl(var(--preview-primary) / 0.1), hsl(var(--preview-background)))`,
                    }}
                >
                    {/* Overlay */}
                    {hasHeroMedia && hero?.overlay_color && (
                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundColor: hero.overlay_color,
                                opacity: hero.overlay_opacity || 0.3
                            }}
                        />
                    )}

                    <div className="relative z-10">
                        <span
                            className="inline-block px-2 py-0.5 rounded-full text-[10px] mb-2"
                            style={{
                                background: `hsl(var(--preview-primary) / 0.2)`,
                                color: `hsl(var(--preview-primary))`
                            }}
                        >
                            Tagline her
                        </span>
                        <h1
                            className="text-xl font-bold mb-1"
                            style={{ fontFamily: `var(--preview-heading-font)` }}
                        >
                            {tenantName}
                        </h1>
                        <p
                            className="text-xs text-muted-foreground mb-3"
                            style={{ fontFamily: `var(--preview-body-font)` }}
                        >
                            Dit slogan eller beskrivelse kommer her
                        </p>
                        <button
                            className="px-3 py-1.5 rounded-md text-xs text-white"
                            style={{ background: `hsl(var(--preview-primary))` }}
                        >
                            Køb nu <ArrowRight className="inline w-3 h-3 ml-1" />
                        </button>
                    </div>
                </div>

                {/* Mini Features */}
                <div className="px-6 py-4 grid grid-cols-3 gap-2">
                    {[
                        { icon: Globe, title: "Feature 1" },
                        { icon: BarChart, title: "Feature 2" },
                        { icon: Check, title: "Feature 3" },
                    ].map((f, i) => (
                        <div
                            key={i}
                            className="p-2 rounded-lg border text-center"
                            style={{ background: `hsl(var(--preview-card))` }}
                        >
                            <f.icon
                                className="w-4 h-4 mx-auto mb-1"
                                style={{ color: `hsl(var(--preview-primary))` }}
                            />
                            <p
                                className="text-[10px] font-medium"
                                style={{ fontFamily: `var(--preview-heading-font)` }}
                            >
                                {f.title}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
