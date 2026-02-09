import type { CSSProperties } from "react";
import { Award, Users, Leaf, Clock, Star, Heart, Shield, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useShopSettings } from "@/hooks/useShopSettings";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import { DEFAULT_BRANDING, mergeBrandingWithDefaults } from "@/hooks/useBrandingDraft";
import { ContentBlocksRenderer } from "@/components/content/ContentBlocksRenderer";
import { LowerInfoRenderer } from "@/components/content/LowerInfoRenderer";
import { cn } from "@/lib/utils";

const ABOUT_ICON_MAP = {
    award: Award,
    users: Users,
    leaf: Leaf,
    clock: Clock,
    star: Star,
    heart: Heart,
    shield: Shield,
    sparkles: Sparkles,
};

export const AboutContent = () => {
    const { data: settings } = useShopSettings();
    const { branding: previewBranding } = usePreviewBranding();
    const mergedBranding = previewBranding || mergeBrandingWithDefaults(settings?.branding || null);
    const about = mergedBranding.aboutPage || DEFAULT_BRANDING.aboutPage;
    const extras = mergedBranding.pageExtras?.about;

    const titleFont = mergedBranding.fonts?.title || mergedBranding.fonts?.heading || "Poppins";
    const bodyFont = mergedBranding.fonts?.description || mergedBranding.fonts?.body || "Inter";
    const titleColor = mergedBranding.colors?.titleText || "#1F2937";
    const bodyColor = mergedBranding.colors?.bodyText || "#4B5563";

    const textAlignClass = about.textAlign === "left"
        ? "text-left"
        : about.textAlign === "right"
            ? "text-right"
            : "text-center";

    const hasSingleMedia = about.media.type === "single" && !!about.media.imageUrl;
    const hasGallery = about.media.type === "gallery" && (about.media.gallery || []).length > 0;
    const imageStyleClass = about.media.imageStyle === "plain"
        ? ""
        : about.media.imageStyle === "shadow"
            ? "rounded-lg shadow-lg"
            : about.media.imageStyle === "border"
                ? "rounded-lg border"
                : "rounded-lg";

    const galleryLayoutClass = about.media.galleryLayout === "masonry"
        ? "columns-1 sm:columns-2 lg:columns-3 gap-4"
        : about.media.galleryLayout === "carousel"
            ? "flex gap-4 overflow-x-auto snap-x"
            : about.media.galleryLayout === "stacked"
                ? "flex flex-col gap-4"
                : "grid grid-cols-1 sm:grid-cols-2 gap-4";

    const galleryItemClass = cn(
        "w-full object-cover",
        imageStyleClass,
        about.media.galleryLayout === "carousel" && "snap-start shrink-0 w-64",
        about.media.galleryLayout === "masonry" && "mb-4 break-inside-avoid"
    );

    const featureItems = (about.features.items || []).filter((item) => item.title || item.description);
    const featureGridClass = featureItems.length >= 4
        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        : featureItems.length === 3
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6";

    const cardStyleVars = {
        ["--about-card-bg" as any]: about.features.cardBackground,
        ["--about-card-text" as any]: about.features.cardTextColor,
        ["--about-card-hover-bg" as any]: about.features.hoverBackground,
        ["--about-card-hover-text" as any]: about.features.hoverTextColor,
    } as CSSProperties;

    const hoverClass = about.features.hoverEffect === "lift"
        ? "about-feature-card--lift"
        : about.features.hoverEffect === "shadow"
            ? "about-feature-card--shadow"
            : about.features.hoverEffect === "glow"
                ? "about-feature-card--glow"
                : "";

    return (
        <>
        <section className="py-16 bg-secondary/30">
            <div className="container mx-auto px-4 space-y-12">
                <div className={cn("max-w-4xl mx-auto", textAlignClass)}>
                    <div
                        className={cn(
                            "flex flex-col gap-8",
                            hasSingleMedia && (about.media.position === "left" || about.media.position === "right")
                                ? about.media.position === "right"
                                    ? "md:flex-row-reverse md:items-center"
                                    : "md:flex-row md:items-center"
                                : ""
                        )}
                    >
                        {hasSingleMedia && about.media.position === "above" && (
                            <img
                                src={about.media.imageUrl}
                                alt={about.title}
                                className={cn("w-full max-h-80 object-cover", imageStyleClass)}
                            />
                        )}

                        {(about.title || about.description) && (
                            <div className={cn(hasSingleMedia && about.media.position !== "above" ? "flex-1" : "")}>
                                {about.title && (
                                    <h1
                                        className="text-4xl md:text-5xl font-heading font-bold mb-6"
                                        style={{ fontFamily: `'${titleFont}', sans-serif`, color: titleColor }}
                                    >
                                        {about.title}
                                    </h1>
                                )}
                                {about.description && (
                                    <p
                                        className="text-lg leading-relaxed"
                                        style={{ fontFamily: `'${bodyFont}', sans-serif`, color: bodyColor }}
                                    >
                                        {about.description}
                                    </p>
                                )}
                            </div>
                        )}

                        {hasSingleMedia && about.media.position !== "above" && (
                            <img
                                src={about.media.imageUrl}
                                alt={about.title}
                                className={cn("w-full md:w-1/2 max-h-80 object-cover", imageStyleClass)}
                            />
                        )}
                    </div>
                </div>

                {hasGallery && (
                    <div className={galleryLayoutClass}>
                        {(about.media.gallery || []).map((url, idx) => (
                            <img
                                key={`about-gallery-${idx}`}
                                src={url}
                                alt={`${about.title || "Om os"} ${idx + 1}`}
                                className={galleryItemClass}
                            />
                        ))}
                    </div>
                )}

                {about.features.enabled && featureItems.length > 0 && (
                    <div className={featureGridClass}>
                        {featureItems.map((item) => {
                            const Icon = item.iconType === "icon"
                                ? ABOUT_ICON_MAP[item.iconName as keyof typeof ABOUT_ICON_MAP]
                                : null;

                            const card = (
                                <div
                                    className={cn(
                                        "about-feature-card p-6 text-center rounded-xl transition-all",
                                        hoverClass
                                    )}
                                    style={cardStyleVars}
                                >
                                    {item.iconType === "image" && item.imageUrl && (
                                        <img
                                            src={item.imageUrl}
                                            alt=""
                                            className="h-12 w-12 mx-auto mb-4 object-contain"
                                        />
                                    )}
                                    {item.iconType === "icon" && Icon && (
                                        <Icon className="h-12 w-12 mx-auto mb-4" />
                                    )}
                                    {item.title && (
                                        <h3 className="text-lg font-heading font-semibold mb-2">{item.title}</h3>
                                    )}
                                    {item.description && (
                                        <p className="text-sm opacity-90">{item.description}</p>
                                    )}
                                </div>
                            );

                            if (!item.linkUrl) return <div key={item.id}>{card}</div>;

                            const isInternal = item.linkUrl.startsWith("/");
                            return isInternal ? (
                                <Link key={item.id} to={item.linkUrl} className="block">
                                    {card}
                                </Link>
                            ) : (
                                <a
                                    key={item.id}
                                    href={item.linkUrl}
                                    target={item.openInNewTab ? "_blank" : undefined}
                                    rel={item.openInNewTab ? "noreferrer" : undefined}
                                    className="block"
                                >
                                    {card}
                                </a>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
        <ContentBlocksRenderer blocks={extras?.contentBlocks} placement="all" brandingSectionId="page-extras" />
        <LowerInfoRenderer lowerInfo={extras?.lowerInfo} sectionId="page-extras" />
        </>
    );
};
