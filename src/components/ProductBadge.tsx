/**
 * ProductBadge - A small animated badge that appears on product cards
 * 
 * Supports three animation effects:
 * 1. bounce - Gentle continuous bounce
 * 2. spin-fade - Rotates in and fades, then stays
 * 3. pulse - Gentle scale/glow pulse
 */

import { cn } from "@/lib/utils";

export type BadgeAnimation = "bounce" | "spin-fade" | "pulse";

export interface ProductBadgeConfig {
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
    "bounce": "animate-badge-bounce",
    "spin-fade": "animate-badge-spin-fade",
    "pulse": "animate-badge-pulse",
};

export function ProductBadge({ config, className }: ProductBadgeProps) {
    if (!config?.enabled || !config?.text) return null;

    const bgColor = config.bgColor || "hsl(var(--primary))";
    const textColor = config.textColor || "#FFFFFF";
    const animationClass = animationClasses[config.animation] || animationClasses.bounce;

    return (
        <div
            className={cn(
                // Positioning - top left corner, slightly outside the card
                "absolute -top-5 -left-5 z-20",
                // Shape - perfect circle (bigger)
                "flex items-center justify-center",
                "w-16 h-16",
                "rounded-full",
                // Typography
                "text-sm font-bold text-center leading-tight",
                // Shadow for depth
                "shadow-lg",
                // Animation class
                animationClass,
                className
            )}
            style={{
                backgroundColor: bgColor,
                color: textColor,
            }}
        >
            <span className="max-w-[70px] break-words">{config.text}</span>
        </div>
    );
}

export default ProductBadge;
