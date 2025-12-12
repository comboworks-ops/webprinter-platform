import { useEffect, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";

// Import the actual storefront components
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, BarChart, Globe } from "lucide-react";
import { Link } from "react-router-dom";
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

export default function PreviewStorefront() {
    const [searchParams] = useSearchParams();
    const { isAdmin, loading: roleLoading } = useUserRole();
    const [branding, setBranding] = useState<BrandingData | null>(null);
    const [tenantName, setTenantName] = useState("Din Shop");
    const [isLoading, setIsLoading] = useState(true);

    const versionId = searchParams.get("versionId");
    const isDraft = searchParams.get("draft") === "1";

    useEffect(() => {
        async function loadBranding() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // If versionId is specified, load that specific version
                if (versionId) {
                    const { data: version } = await supabase
                        .from('branding_versions' as any)
                        .select('data')
                        .eq('id', versionId)
                        .single();

                    if (version) {
                        setBranding((version as any).data);
                    }
                } else {
                    // Load tenant's draft or published branding
                    const { data: tenant } = await supabase
                        .from('tenants' as any)
                        .select('id, name, settings')
                        .eq('owner_id', user.id)
                        .maybeSingle();

                    if (tenant) {
                        setTenantName((tenant as any).name || "Din Shop");
                        const brandingSettings = (tenant as any).settings?.branding || {};

                        // Use draft if preview mode, otherwise published
                        if (isDraft && brandingSettings.draft) {
                            setBranding(brandingSettings.draft);
                        } else if (brandingSettings.published) {
                            setBranding(brandingSettings.published);
                        } else {
                            // Legacy format - use branding directly
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
    }, [versionId, isDraft, roleLoading]);

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

    const fontsUrl = getGoogleFontsUrl([headingFont, bodyFont, branding?.fonts?.pricing || ""]);

    const cssVars = {
        "--primary": hexToHsl(primaryColor),
        "--background": hexToHsl(backgroundColor),
        "--card": hexToHsl(cardColor),
    } as React.CSSProperties;

    const hasHeroMedia = branding?.hero?.media && branding.hero.media.length > 0;

    return (
        <>
            {/* Load Google Fonts */}
            {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

            {/* Preview Banner */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 text-center text-sm font-medium">
                🔍 Preview Mode - {isDraft ? "Kladde" : versionId ? "Version" : "Publiceret"} branding
                <Link to="/admin/branding" className="ml-3 underline">
                    Tilbage til editor
                </Link>
            </div>

            {/* Storefront with applied branding */}
            <div
                className="min-h-screen flex flex-col pt-10"
                style={{
                    ...cssVars,
                    fontFamily: `'${bodyFont}', sans-serif`,
                }}
            >
                {/* We can't easily override the global Header, so we render a custom preview header */}
                <header
                    className="sticky top-10 z-40 bg-card shadow-sm border-b border-border"
                    style={{ background: `hsl(var(--card))` }}
                >
                    <div className="container mx-auto px-4">
                        <div className="flex items-center justify-between h-16">
                            {branding?.logo_url ? (
                                <img src={branding.logo_url} alt="Logo" className="h-10 w-auto object-contain" />
                            ) : (
                                <span
                                    className="text-xl font-bold"
                                    style={{ fontFamily: `'${headingFont}', sans-serif`, color: `hsl(var(--primary))` }}
                                >
                                    {tenantName}
                                </span>
                            )}
                            <nav className="hidden md:flex items-center gap-6 text-sm">
                                <span>Produkter</span>
                                <span>Kontakt</span>
                                <span>Om os</span>
                            </nav>
                        </div>
                    </div>
                </header>

                {/* Hero Section */}
                <section
                    className="relative flex-1 flex items-center justify-center pt-16 pb-12 overflow-hidden"
                    style={{
                        background: hasHeroMedia
                            ? `url(${branding?.hero?.media?.[0]}) center/cover`
                            : `linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--background)))`,
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
                                background: `hsl(var(--primary) / 0.1)`,
                                color: `hsl(var(--primary))`,
                            }}
                        >
                            Den komplette løsning til dit trykkeri
                        </span>
                        <h1
                            className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
                            style={{ fontFamily: `'${headingFont}', sans-serif` }}
                        >
                            {tenantName}
                        </h1>
                        <p
                            className="text-xl max-w-2xl mx-auto mb-8 opacity-80"
                            style={{ fontFamily: `'${bodyFont}', sans-serif` }}
                        >
                            Gør din trykkeri-ekspertise til en skalerbar online forretning.
                            Automatiseret prissætning, ordrehåndtering og kundeportaler i ét system.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Button
                                size="lg"
                                className="h-12 px-8 text-lg gap-2"
                                style={{ background: `hsl(var(--primary))` }}
                            >
                                Start gratis prøveperiode <ArrowRight className="w-4 h-4" />
                            </Button>
                            <Button size="lg" variant="outline" className="h-12 px-8 text-lg">
                                Se prisberegnere
                            </Button>
                        </div>
                    </div>
                </section>

                {/* Features Grid */}
                <section className="py-24" style={{ background: `hsl(var(--card))` }}>
                    <div className="container px-4 mx-auto">
                        <div className="text-center mb-16">
                            <h2
                                className="text-3xl font-bold mb-4"
                                style={{ fontFamily: `'${headingFont}', sans-serif` }}
                            >
                                Alt hvad du behøver for at drive dit trykkeri
                            </h2>
                            <p className="text-muted-foreground">Professionelle værktøjer bygget til trykkeribranchen.</p>
                        </div>

                        <div className="grid md:grid-cols-3 gap-8">
                            {[
                                { icon: <Globe className="w-6 h-6" />, title: "Whitelabel Webshop", desc: "Dit brand, dit domæne." },
                                { icon: <BarChart className="w-6 h-6" />, title: "Smart Prisberegning", desc: "Komplekse matrix-beregninger." },
                                { icon: <Check className="w-6 h-6" />, title: "Ordre Workflow", desc: "Strømlinet dashboard." },
                            ].map((feature, i) => (
                                <div
                                    key={i}
                                    className="p-6 rounded-2xl border bg-card hover:shadow-lg transition-shadow"
                                    style={{ background: `hsl(var(--background))` }}
                                >
                                    <div
                                        className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                                        style={{
                                            background: `hsl(var(--primary) / 0.1)`,
                                            color: `hsl(var(--primary))`,
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
