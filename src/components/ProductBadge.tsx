/**
 * ProductBadge - A small animated badge that appears on product cards
 *
 * Supports three animation effects:
 * 1. bounce - Gentle continuous bounce
 * 2. spin-fade - Rotates in and fades, then stays
 * 3. pulse - Gentle scale/glow pulse
 */

import "@/styles/productPresentationEffects.css";
import { safePresentationUrl } from "@/lib/products/productPresentation";
import { cn } from "@/lib/utils";

export type BadgeAnimation = "none" | "bounce" | "spin-fade" | "pulse" | "spin" | "float";

export interface ProductBadgeConfig {
    imageUrl?: string;
    size?: number;
    position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    duration?: number;
    enabled: boolean;
    text: string;
    animation: BadgeAnimation;
    bgColor?: string;  // default: primary color
    textColor?: string; // default: white
    showOnHover?: boolean; // if true, badge only appears on card hover
}

interface ProductBadgeProps {
    config: ProductBadgeConfig;
    className?: string;
}

const animationClasses: Record<BadgeAnimation, string> = {
    none: "", spin: "product-badge-spin", float: "product-badge-float",
    "bounce": "animate-badge-bounce",
    "spin-fade": "animate-badge-spin-fade",
    "pulse": "animate-badge-pulse",
};

export function ProductBadge({ config, className }: ProductBadgeProps) {
    if (!config?.enabled || (!config?.text && !safePresentationUrl(config.imageUrl))) return null;

    const bgColor = config.bgColor || "hsl(var(--primary))";
    const textColor = config.textColor || "#FFFFFF";
    const animationClass = animationClasses[config.animation] || animationClasses.bounce;

    const imageUrl = safePresentationUrl(config.imageUrl);
    const size = Math.max(32, Math.min(160, Number(config.size) || 64));
    const position = config.position || "top-left";
    return (
        <div
            data-hover-only={config.showOnHover || undefined}
            className={cn(
                // Positioning - top left corner, slightly outside the card
                "product-custom-badge",
                // Shape - perfect circle (bigger)
                "flex items-center justify-center",

                !imageUrl && "rounded-full",
                // Typography
                "text-sm font-bold text-center leading-tight",
                // Shadow for depth
                !imageUrl && "shadow-lg",
                // Animation class
                animationClass,
                className
            )}
            style={{
                backgroundColor: imageUrl ? "transparent" : bgColor,
                width: size, height: size,
                ...(position.startsWith("top") ? { top: -12 } : { bottom: -12 }),
                ...(position.endsWith("left") ? { left: -12 } : { right: -12 }),
                animationDuration: `${Math.max(1, Math.min(20, Number(config.duration) || 4))}s`,
                color: textColor,
            }}
        >
            {imageUrl ? <img src={imageUrl} alt={config.text || "Produktbadge"} /> : <span className="max-w-[90%] break-words">{config.text}</span>}
        </div>
    );
}

export default ProductBadge;
