import type { ContentBlock } from "@/hooks/useBrandingDraft";

interface ContentBlocksRendererProps {
    blocks?: ContentBlock[];
    placement?: "above_products" | "below_products" | "all";
    brandingSectionId?: string;
}

export const ContentBlocksRenderer = ({ blocks, placement = "all", brandingSectionId }: ContentBlocksRendererProps) => {
    const visibleBlocks = (blocks || []).filter((block) => block.enabled);
    const filteredBlocks = placement === "all"
        ? visibleBlocks
        : visibleBlocks.filter((block) => (block.placement || "below_products") === placement);

    if (filteredBlocks.length === 0) return null;

    return (
        <>
            {filteredBlocks.map((block) => {
                const mediaType = block.mediaType || (block.gallery?.length ? "gallery" : "single");
                const gallery: string[] = block.gallery || [];
                const hasGallery = mediaType === "gallery" && gallery.length > 0;
                const hasImage = mediaType === "single" && !!block.imageUrl;
                const showMedia = hasGallery || hasImage;
                const cta = block.cta || {};
                const ctaLabel = (cta.label || "").trim();
                const ctaHref = (cta.href || "").trim();
                const showCta = cta.enabled && ctaLabel.length > 0;
                const ctaAlign = block.textAlign === "center"
                    ? "justify-center"
                    : block.textAlign === "right"
                        ? "justify-end"
                        : "justify-start";
                const ctaSizeClass = cta.size === "sm"
                    ? "px-3 py-1.5 text-sm"
                    : cta.size === "lg"
                        ? "px-6 py-3 text-base"
                        : "px-4 py-2 text-sm";

                return (
                    <section
                        key={block.id}
                        data-branding-id={brandingSectionId || block.id}
                        className="bg-secondary py-8"
                    >
                        <div
                            className={`container mx-auto px-4 ${block.textAlign === "center"
                                ? "text-center"
                                : block.textAlign === "right"
                                    ? "text-right"
                                    : "text-left"
                                }`}
                        >
                            <div className={`flex flex-col ${showMedia ? (block.imagePosition === "right" ? "md:flex-row" : "md:flex-row-reverse") : ""} gap-8 items-center`}>
                                <div className={`flex-1 ${showMedia ? "" : "w-full"}`}>
                                    {block.heading && (
                                        <h2
                                            className="text-2xl md:text-3xl font-semibold"
                                            style={{
                                                fontFamily: `'${block.headingFont || "Poppins"}', sans-serif`,
                                                color: block.headingColor || "#1F2937",
                                            }}
                                        >
                                            {block.heading}
                                        </h2>
                                    )}
                                    {block.text && (
                                        <p
                                            className="mt-4"
                                            style={{
                                                fontFamily: `'${block.textFont || "Inter"}', sans-serif`,
                                                color: block.textColor || "#4B5563",
                                            }}
                                        >
                                            {block.text}
                                        </p>
                                    )}
                                    {showCta && (
                                        <div className={`mt-6 flex ${ctaAlign}`}>
                                            <a
                                                href={ctaHref || "#"}
                                                aria-disabled={!ctaHref}
                                                onClick={(e) => {
                                                    if (!ctaHref) e.preventDefault();
                                                }}
                                                className={`content-block-cta no-link-color ${cta.style === "outline" ? "content-block-cta-outline" : ""} ${ctaSizeClass}`}
                                                style={{
                                                    ["--cta-bg" as any]: cta.bgColor || "#0EA5E9",
                                                    ["--cta-text" as any]: cta.textColor || "#FFFFFF",
                                                    ["--cta-hover-bg" as any]: cta.hoverBgColor || "#0284C7",
                                                    ["--cta-hover-text" as any]: cta.hoverTextColor || "#FFFFFF",
                                                    ["--cta-border" as any]: cta.bgColor || "#0EA5E9",
                                                    fontFamily: `'${cta.font || "Poppins"}', sans-serif`,
                                                }}
                                            >
                                                {ctaLabel}
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {showMedia && (
                                    <div className="flex-1">
                                        {hasGallery ? (
                                            <div className={`grid gap-3 ${gallery.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                                                {gallery.map((url: string, idx: number) => (
                                                    <img
                                                        key={`${block.id}-img-${idx}`}
                                                        src={url}
                                                        alt={block.heading || "Content image"}
                                                        className="rounded-lg max-h-64 object-cover mx-auto w-full"
                                                    />
                                                ))}
                                            </div>
                                        ) : (
                                            <img
                                                src={block.imageUrl}
                                                alt={block.heading || "Content image"}
                                                className="rounded-lg max-h-64 object-cover mx-auto"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>
                );
            })}
        </>
    );
};
