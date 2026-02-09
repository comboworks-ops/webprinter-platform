import type { CSSProperties } from "react";
import type { LowerInfoSettings } from "@/hooks/useBrandingDraft";
import { cn } from "@/lib/utils";

interface LowerInfoRendererProps {
    lowerInfo?: LowerInfoSettings;
    sectionId?: string;
}

export const LowerInfoRenderer = ({ lowerInfo, sectionId = "lower-info" }: LowerInfoRendererProps) => {
    if (!lowerInfo?.enabled || !lowerInfo.items || lowerInfo.items.length === 0) return null;
    const items = lowerInfo.items.filter((item) => item.enabled);
    if (items.length === 0) return null;

    const bgType = lowerInfo.background?.type || "solid";
    const bgStyle: CSSProperties = bgType === "solid"
        ? { backgroundColor: lowerInfo.background?.color || "#F8FAFC" }
        : {
            backgroundImage: `linear-gradient(${lowerInfo.background?.gradientAngle ?? 135}deg, ${lowerInfo.background?.gradientStart || "#F8FAFC"}, ${lowerInfo.background?.gradientEnd || "#E2E8F0"})`,
        };

    const layout = lowerInfo.layout || "grid";
    const gridClass = layout === "stacked"
        ? "grid grid-cols-1 gap-8"
        : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8";

    return (
        <section className="py-16" style={bgStyle} data-branding-id={sectionId}>
            <div className="container mx-auto px-4">
                <div className={gridClass}>
                    {items.map((item) => {
                        const hasMedia =
                            (item.mediaType === "single" && !!item.imageUrl) ||
                            (item.mediaType === "gallery" && (item.gallery || []).length > 0);
                        const isSideBySide = hasMedia && item.mediaAlign !== "center";
                        const mediaAlign =
                            item.mediaAlign === "left"
                                ? "justify-start"
                                : item.mediaAlign === "right"
                                    ? "justify-end"
                                    : "justify-center";
                        const textAlignClass =
                            item.textAlign === "left"
                                ? "text-left"
                                : item.textAlign === "right"
                                    ? "text-right"
                                    : "text-center";

                        return (
                            <div
                                key={item.id}
                                className={cn(
                                    "w-full max-w-full min-w-0 overflow-hidden",
                                    isSideBySide ? "flex flex-col md:flex-row md:items-start gap-4" : "flex flex-col gap-4"
                                )}
                            >
                                {hasMedia && (
                                    <div
                                        className={cn(
                                            "w-full flex",
                                            isSideBySide ? "md:w-1/3" : "",
                                            isSideBySide && item.mediaAlign === "right" ? "md:order-2" : "",
                                            mediaAlign
                                        )}
                                    >
                                        {item.mediaType === "single" && item.imageUrl && (
                                            <img
                                                src={item.imageUrl}
                                                alt=""
                                                className="rounded-lg max-h-40 object-cover max-w-full"
                                            />
                                        )}
                                        {item.mediaType === "gallery" && (item.gallery || []).length > 0 && (
                                            <div className={cn("grid gap-2", (item.gallery || []).length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                                                {(item.gallery || []).map((url: string, idx: number) => (
                                                    <img
                                                        key={`${item.id}-gallery-${idx}`}
                                                        src={url}
                                                        alt=""
                                                        className="rounded-lg max-h-40 object-cover max-w-full"
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {(item.title || item.description) && (
                                    <div className={cn("flex-1 min-w-0 space-y-1", textAlignClass)}>
                                        {item.title && (
                                            <h3
                                                className="text-lg font-semibold break-words"
                                                style={{
                                                    fontFamily: `'${item.titleFont || "Poppins"}', sans-serif`,
                                                    color: item.titleColor || "#1F2937",
                                                }}
                                            >
                                                {item.title}
                                            </h3>
                                        )}
                                        {item.description && (
                                            <p
                                                className="text-sm leading-relaxed break-words"
                                                style={{
                                                    fontFamily: `'${item.descriptionFont || "Inter"}', sans-serif`,
                                                    color: item.descriptionColor || "#4B5563",
                                                }}
                                            >
                                                {item.description}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};
