import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BANNER2_ICON_MAP } from "@/components/branding/banner2Icons";
import type { Banner2Animation, Banner2Item, Banner2Settings } from "@/hooks/useBrandingDraft";

interface Banner2ShowcaseProps {
    banner2?: Banner2Settings | null;
}

function getAnimationClass(animation: Banner2Animation, isActive: boolean) {
    const base = "transition-all duration-700";
    if (animation === "none") return "";
    if (isActive) {
        return `${base} opacity-100 translate-y-0 scale-100 blur-none`;
    }

    switch (animation) {
        case "fade":
            return `${base} opacity-0`;
        case "slide-down":
            return `${base} opacity-0 -translate-y-6`;
        case "scale":
            return `${base} opacity-0 scale-95`;
        case "blur":
            return `${base} opacity-0 blur-sm`;
        case "slide-up":
        default:
            return `${base} opacity-0 translate-y-6`;
    }
}

function buildBackgroundStyle(banner2: Banner2Settings): React.CSSProperties {
    const background = banner2.background;
    if (background.animated) {
        return {
            backgroundImage: `linear-gradient(${background.gradientAngle}deg, ${background.animatedStart}, ${background.animatedMiddle}, ${background.animatedEnd})`,
            backgroundSize: "200% 200%",
            animation: `banner2-gradient-${background.animatedSpeed} ${background.animatedSpeed === "slow" ? 14 : 22}s ease infinite`,
        };
    }

    if (background.type === "gradient") {
        return {
            backgroundImage: `linear-gradient(${background.gradientAngle}deg, ${background.gradientStart}, ${background.gradientEnd})`,
        };
    }

    return {
        backgroundColor: background.color,
    };
}

function resolveVisibleItemCount(mode: Banner2Settings["mode"], itemsPerRow: number, totalItems: number) {
    const maxColumns = mode === "logo-showcase" ? 6 : 4;
    return Math.max(1, Math.min(itemsPerRow || 1, totalItems || 1, maxColumns));
}

function Banner2ItemCard({
    item,
    isActive,
    mode,
    animationDelayMs,
}: {
    item: Banner2Item;
    isActive: boolean;
    mode: Banner2Settings["mode"];
    animationDelayMs: number;
}) {
    const IconComponent = item.iconName ? BANNER2_ICON_MAP[item.iconName as keyof typeof BANNER2_ICON_MAP] : null;
    const iconAnimationClass = getAnimationClass(item.iconAnimation, isActive);
    const titleAnimationClass = getAnimationClass(item.titleAnimation, isActive);
    const descriptionAnimationClass = getAnimationClass(item.descriptionAnimation, isActive);
    const groupAnimationClass = getAnimationClass(item.groupAnimation, isActive);
    const showText = Boolean(item.title || item.description);
    const isLogoShowcase = mode === "logo-showcase";

    return (
        <div
            data-branding-id={`forside.banner2.item.${item.id}`}
            className={cn(
                "rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm",
                isLogoShowcase ? "text-center" : "text-left",
                groupAnimationClass,
            )}
            style={{ transitionDelay: `${animationDelayMs}ms` }}
        >
            {item.iconType !== "none" && (
                <div
                    data-branding-id={`forside.banner2.item.${item.id}.image`}
                    className={cn(
                        "flex items-center justify-center",
                        isLogoShowcase ? "min-h-[88px] mb-3" : "mb-4 h-12 w-12 rounded-xl bg-white/10"
                    )}
                    style={{ transitionDelay: `${animationDelayMs + 40}ms` }}
                >
                    {item.iconType === "image" && item.iconUrl ? (
                        <img
                            src={item.iconUrl}
                            alt={item.title || "Banner billede"}
                            className={cn(
                                "object-contain",
                                isLogoShowcase ? "max-h-14 w-auto max-w-full" : "h-10 w-10"
                            )}
                        />
                    ) : IconComponent ? (
                        <IconComponent className={cn("text-white", iconAnimationClass, isLogoShowcase ? "h-10 w-10" : "h-6 w-6")} />
                    ) : null}
                </div>
            )}

            {showText && (
                <div className={cn("space-y-2", isLogoShowcase && "space-y-1.5")}>
                    {item.title && (
                        <p
                            data-branding-id={`forside.banner2.item.${item.id}.title`}
                            className={cn(
                                isLogoShowcase ? "text-sm font-medium" : "text-lg font-semibold",
                                titleAnimationClass
                            )}
                            style={{
                                color: item.titleColor,
                                fontFamily: `'${item.titleFont}', sans-serif`,
                                transitionDelay: `${animationDelayMs + 80}ms`,
                            }}
                        >
                            {item.title}
                        </p>
                    )}
                    {item.description && (
                        <p
                            data-branding-id={`forside.banner2.item.${item.id}.description`}
                            className={cn(
                                isLogoShowcase ? "text-xs leading-5 opacity-90" : "text-sm leading-6 opacity-90",
                                descriptionAnimationClass
                            )}
                            style={{
                                color: item.descriptionColor,
                                fontFamily: `'${item.descriptionFont}', sans-serif`,
                                transitionDelay: `${animationDelayMs + 120}ms`,
                            }}
                        >
                            {item.description}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

export function Banner2Showcase({ banner2 }: Banner2ShowcaseProps) {
    const slides = useMemo(
        () => (banner2?.slides || []).filter((slide) => slide.enabled && slide.items.some((item) => item.enabled)),
        [banner2?.slides]
    );
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        if (currentSlide >= slides.length) {
            setCurrentSlide(0);
        }
    }, [currentSlide, slides.length]);

    useEffect(() => {
        if (!banner2?.enabled || !banner2.autoPlay || slides.length <= 1) {
            return;
        }

        const slide = slides[currentSlide];
        const timeout = window.setTimeout(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, Math.max(2, slide?.durationSeconds || 5) * 1000);

        return () => window.clearTimeout(timeout);
    }, [banner2?.enabled, banner2?.autoPlay, currentSlide, slides]);

    if (!banner2?.enabled || slides.length === 0) {
        return null;
    }

    const current = slides[currentSlide];
    const enabledItems = current.items.filter((item) => item.enabled);
    const columns = resolveVisibleItemCount(banner2.mode, banner2.itemsPerRow, enabledItems.length);
    const sectionStyle = buildBackgroundStyle(banner2);

    return (
        <section
            data-branding-id="forside.banner2"
            className="py-14"
            style={sectionStyle}
        >
            <style>{`
                @keyframes banner2-gradient-slow {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                @keyframes banner2-gradient-slower {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `}</style>
            <div className="container mx-auto px-4">
                <div className="mx-auto max-w-6xl rounded-[32px] border border-white/10 bg-black/10 p-6 shadow-2xl backdrop-blur-sm md:p-8">
                    {(banner2.heading || banner2.subtitle) && (
                        <div className="mb-8 text-center">
                            {banner2.heading && (
                                <h2
                                    data-branding-id="forside.banner2.heading"
                                    className="text-2xl font-semibold md:text-4xl"
                                    style={{
                                        color: banner2.headingColor,
                                        fontFamily: `'${banner2.headingFont}', sans-serif`,
                                    }}
                                >
                                    {banner2.heading}
                                </h2>
                            )}
                            {banner2.subtitle && (
                                <p
                                    data-branding-id="forside.banner2.subtitle"
                                    className="mx-auto mt-3 max-w-3xl text-sm md:text-base"
                                    style={{
                                        color: banner2.subtitleColor,
                                        fontFamily: `'${banner2.subtitleFont}', sans-serif`,
                                    }}
                                >
                                    {banner2.subtitle}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="relative">
                        <div
                            className="grid gap-4 md:gap-5"
                            style={{
                                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                            }}
                        >
                            {enabledItems.map((item, index) => (
                                <Banner2ItemCard
                                    key={item.id}
                                    item={item}
                                    isActive
                                    mode={banner2.mode}
                                    animationDelayMs={index * 70}
                                />
                            ))}
                        </div>

                        {slides.length > 1 && banner2.showArrows && (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="absolute -left-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border-white/20 bg-black/30 text-white hover:bg-black/40"
                                    onClick={() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)}
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="absolute -right-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full border-white/20 bg-black/30 text-white hover:bg-black/40"
                                    onClick={() => setCurrentSlide((prev) => (prev + 1) % slides.length)}
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                            </>
                        )}
                    </div>

                    {slides.length > 1 && banner2.showDots && (
                        <div className="mt-6 flex items-center justify-center gap-2">
                            {slides.map((slide, index) => (
                                <button
                                    key={slide.id}
                                    type="button"
                                    aria-label={`Gå til slide ${index + 1}`}
                                    className={cn(
                                        "h-2.5 rounded-full transition-all",
                                        index === currentSlide ? "w-8 bg-white" : "w-2.5 bg-white/40 hover:bg-white/60"
                                    )}
                                    onClick={() => setCurrentSlide(index)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

export default Banner2Showcase;
