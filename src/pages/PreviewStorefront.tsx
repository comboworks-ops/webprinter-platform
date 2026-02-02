import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2, ArrowRight, Check, BarChart, Globe } from "lucide-react";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import { getGoogleFontsUrl } from "@/components/admin/FontSelector";

interface BrandingData {
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
        type?: string;
        media?: string[];
        overlay_color?: string;
        overlay_opacity?: number;
        parallax?: boolean;
    };
}

// Helper to convert hex to HSL
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

// Dynamic font loader
function loadGoogleFonts(fonts: string[]) {
    const url = getGoogleFontsUrl(fonts);
    if (!url) return;

    // Remove old font link if exists
    const existingLink = document.getElementById('preview-fonts');
    if (existingLink) existingLink.remove();

    const link = document.createElement('link');
    link.id = 'preview-fonts';
    link.rel = 'stylesheet';
    link.href = url;
    document.head.appendChild(link);
}

export default function PreviewStorefront() {
    const [searchParams] = useSearchParams();
    const { isAdmin, loading: roleLoading } = useUserRole();
    const [branding, setBranding] = useState<BrandingData | null>(null);
    const [tenantName, setTenantName] = useState("Din Shop");
    const [isLoading, setIsLoading] = useState(true);
    const [isEmbedded, setIsEmbedded] = useState(false);
    const hasLiveUpdateRef = useRef(false);

    const tenantId = searchParams.get("tenantId");
    const versionId = searchParams.get("versionId");
    const isDraft = searchParams.get("draft") === "1";

    // Check if we're in an iframe
    useEffect(() => {
        setIsEmbedded(window.self !== window.top);
    }, []);

    // Listen for branding updates from parent (postMessage bridge)
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'BRANDING_UPDATE') {
                setBranding(event.data.branding);
                hasLiveUpdateRef.current = true;
                if (event.data.tenantName) {
                    setTenantName(event.data.tenantName);
                }

                // Load fonts dynamically
                const fonts = event.data.branding?.fonts;
                if (fonts) {
                    loadGoogleFonts([
                        fonts.heading || 'Poppins',
                        fonts.body || 'Inter',
                        fonts.pricing || 'Roboto Mono',
                        event.data.branding?.forside?.productsSection?.button?.font || 'Poppins'
                    ]);
                }
            }
        };

        window.addEventListener('message', handleMessage);

        // Signal to parent that we're ready
        if (window.parent !== window) {
            window.parent.postMessage({ type: 'PREVIEW_READY' }, '*');
        }

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Initial load from database
    useEffect(() => {
        async function loadBranding() {
            try {
                // If tenantId is provided (e.g. from Platform Admin viewing a tenant), load that tenant directly
                // This does not require auth if we rely on RLS allowing read of tenants (or if user is master admin)
                // However, normal flow requires user to be logged in.

                let tenantData = null;

                if (tenantId) {
                    const { data } = await supabase
                        .from('tenants' as any)
                        .select('id, name, settings')
                        .eq('id', tenantId)
                        .maybeSingle();
                    tenantData = data;
                } else if (versionId) {
                    // Load version history
                } else {
                    // Fallback to user's own tenant
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { data } = await supabase
                            .from('tenants' as any)
                            .select('id, name, settings')
                            .eq('owner_id', user.id)
                            .maybeSingle();
                        tenantData = data;
                    }
                }

                if (versionId) {
                    const { data: version } = await supabase
                        .from('branding_versions' as any)
                        .select('data')
                        .eq('id', versionId)
                        .single();

                    if (version) {
                        if (!hasLiveUpdateRef.current) {
                            setBranding((version as any).data);
                        }
                    }
                } else if (tenantData) {
                    setTenantName((tenantData as any).name || "Din Shop");
                    const brandingSettings = (tenantData as any).settings?.branding || {};

                    if (isDraft && brandingSettings.draft) {
                        if (!hasLiveUpdateRef.current) {
                            setBranding(brandingSettings.draft);
                        }
                    } else if (brandingSettings.published) {
                        if (!hasLiveUpdateRef.current) {
                            setBranding(brandingSettings.published);
                        }
                    } else {
                        if (!hasLiveUpdateRef.current) {
                            setBranding(brandingSettings);
                        }
                    }
                }
            } catch (error) {
                console.error("Error loading branding:", error);
            } finally {
                setIsLoading(false);
            }
        }

        if (!roleLoading) {
            loadBranding();
        }
    }, [versionId, isDraft, roleLoading, tenantId]);

    // BroadcastChannel for detached preview windows (not embedded)
    useEffect(() => {
        const isInPreviewMode = searchParams.get("draft") === "1" || searchParams.get("preview_mode") === "1";
        if (!isInPreviewMode) return;

        const channel = new BroadcastChannel('branding-preview');

        const handleBroadcast = (event: MessageEvent) => {
            if (event.data?.type === "BRANDING_UPDATE") {
                hasLiveUpdateRef.current = true;
                setBranding(event.data.branding);
                if (event.data.tenantName) {
                    setTenantName(event.data.tenantName);
                }
                if (event.data.branding?.fonts) {
                    loadGoogleFonts([
                        event.data.branding.fonts.heading || 'Poppins',
                        event.data.branding.fonts.body || 'Inter',
                        event.data.branding.fonts.pricing || 'Roboto Mono',
                        event.data.branding?.forside?.productsSection?.button?.font || 'Poppins'
                    ]);
                }
            }
        };

        channel.postMessage({ type: "REQUEST_BRANDING" });
        channel.postMessage({ type: "PREVIEW_READY_BROADCAST" });
        channel.addEventListener("message", handleBroadcast);

        return () => {
            channel.removeEventListener("message", handleBroadcast);
            channel.close();
        };
    }, [searchParams]);

    // Load fonts on initial branding
    useEffect(() => {
        if (branding?.fonts) {
            loadGoogleFonts([
                branding.fonts.heading || 'Poppins',
                branding.fonts.body || 'Inter',
                branding.fonts.pricing || 'Roboto Mono',
                branding?.forside?.productsSection?.button?.font || 'Poppins'
            ]);
        }
    }, [branding?.fonts?.heading, branding?.fonts?.body, branding?.fonts?.pricing, branding?.forside?.productsSection?.button?.font]);

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

    // Generate CSS variables from branding
    const headingFont = branding?.fonts?.heading || "Poppins";
    const bodyFont = branding?.fonts?.body || "Inter";
    const primaryColor = branding?.colors?.primary || "#0EA5E9";
    const backgroundColor = branding?.colors?.background || "#F8FAFC";
    const cardColor = branding?.colors?.card || "#FFFFFF";

    const hasHeroMedia = branding?.hero?.media && branding.hero.media.length > 0;

    return (
        <>
            {/* Storefront with applied branding */}
            <div
                className="min-h-screen flex flex-col"
                style={{
                    "--primary": hexToHsl(primaryColor),
                    "--background": hexToHsl(backgroundColor),
                    "--card": hexToHsl(cardColor),
                    fontFamily: `'${bodyFont}', sans-serif`,
                    paddingTop: isEmbedded ? 0 : 40,
                } as React.CSSProperties}
            >
                {/* Header - Use the real component for consistent behavior */}
                <Header />

                {/* Hero Section */}
                <section
                    className="relative flex-1 flex items-center justify-center pt-16 pb-12 overflow-hidden min-h-[60vh]"
                    style={{
                        background: hasHeroMedia
                            ? `url(${branding?.hero?.media?.[0]}) center/cover`
                            : `linear-gradient(135deg, hsl(${hexToHsl(primaryColor)} / 0.1), hsl(${hexToHsl(backgroundColor)}))`,
                        backgroundAttachment: branding?.hero?.parallax ? 'fixed' : 'scroll',
                    }}
                >
                    {/* Overlay */}
                    {hasHeroMedia && (
                        <div
                            className="absolute inset-0"
                            style={{
                                backgroundColor: branding?.hero?.overlay_color || '#000',
                                opacity: branding?.hero?.overlay_opacity || 0.3,
                            }}
                        />
                    )}

                    <div className="container px-4 mx-auto text-center z-10 relative">
                        <span
                            className="inline-block py-1 px-3 rounded-full text-sm font-medium mb-4"
                            style={{
                                background: `hsl(${hexToHsl(primaryColor)} / 0.1)`,
                                color: `hsl(${hexToHsl(primaryColor)})`,
                            }}
                        >
                            Den komplette løsning
                        </span>
                        <h1
                            className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6"
                            style={{ fontFamily: `'${headingFont}', sans-serif` }}
                        >
                            {tenantName}
                        </h1>
                        <p
                            className="text-lg sm:text-xl max-w-2xl mx-auto mb-8 opacity-80"
                            style={{ fontFamily: `'${bodyFont}', sans-serif` }}
                        >
                            Gør din ekspertise til en skalerbar online forretning.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Button
                                size="lg"
                                className="h-12 px-8 text-lg gap-2"
                                style={{ background: `hsl(${hexToHsl(primaryColor)})` }}
                            >
                                Kom i gang <ArrowRight className="w-4 h-4" />
                            </Button>
                            <Button size="lg" variant="outline" className="h-12 px-8 text-lg">
                                Se produkter
                            </Button>
                        </div>
                    </div>
                </section>

                {/* Features Grid */}
                <section className="py-16 sm:py-24" style={{ background: `hsl(${hexToHsl(cardColor)})` }}>
                    <div className="container px-4 mx-auto">
                        <div className="text-center mb-12 sm:mb-16">
                            <h2
                                className="text-2xl sm:text-3xl font-bold mb-4"
                                style={{ fontFamily: `'${headingFont}', sans-serif` }}
                            >
                                Alt hvad du behøver
                            </h2>
                            <p className="text-muted-foreground">Professionelle værktøjer til din forretning.</p>
                        </div>

                        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8">
                            {[
                                { icon: <Globe className="w-6 h-6" />, title: "Webshop", desc: "Dit brand, dit domæne." },
                                { icon: <BarChart className="w-6 h-6" />, title: "Prisberegning", desc: "Komplekse beregninger." },
                                { icon: <Check className="w-6 h-6" />, title: "Workflow", desc: "Strømlinet proces." },
                            ].map((feature, i) => (
                                <div
                                    key={i}
                                    className="p-6 rounded-2xl border hover:shadow-lg transition-shadow"
                                    style={{ background: `hsl(${hexToHsl(backgroundColor)})` }}
                                >
                                    <div
                                        className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                                        style={{
                                            background: `hsl(${hexToHsl(primaryColor)} / 0.1)`,
                                            color: `hsl(${hexToHsl(primaryColor)})`,
                                        }}
                                    >
                                        {feature.icon}
                                    </div>
                                    <h3
                                        className="text-xl font-semibold mb-2"
                                        style={{ fontFamily: `'${headingFont}', sans-serif` }}
                                    >
                                        {feature.title}
                                    </h3>
                                    <p className="text-muted-foreground">{feature.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <Footer />
            </div>
        </>
    );
}
