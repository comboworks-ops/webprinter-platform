/**
 * PlatformSlider - Image slider for the Platform landing page
 * 
 * Uses local PNG images from /public/platform/slider/ via the PLATFORM_SLIDES config.
 * Features Mac Dock-style magnifying effect on hover.
 * 
 * Features:
 * - NO LINKS - purely visual/decorative (for now)
 * - PNG images with labels derived from filename
 * - Smooth marquee animation (pauses on hover)
 * - Mac Dock magnifying effect - items scale based on mouse proximity
 * - Clean floating design - no borders, shadows, or containers
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { PLATFORM_SLIDES, getSlideLabel, type PlatformSlide } from "@/lib/platform/sliderImages";

interface SlideImageProps {
    slide: PlatformSlide;
}

/**
 * Individual slide image
 */
function SlideImage({ slide }: SlideImageProps) {
    return (
        <img
            src={slide.src}
            alt={slide.alt}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain"
            style={{
                display: 'block',
                imageRendering: 'auto',
            }}
        />
    );
}

// Configuration for the dock magnification effect
const DOCK_CONFIG = {
    baseSize: 120,       // Bigger base size of icons in pixels
    maxScale: 1.5,       // Maximum scale when hovered
    effectRadius: 180,   // Pixel radius of the magnification effect
    spacing: 48,         // Spacing between items in pixels
};

/**
 * Calculate scale based on distance from mouse
 */
function calculateScale(distance: number): number {
    if (distance > DOCK_CONFIG.effectRadius) return 1;

    // Smooth cosine interpolation for natural dock feel
    const normalizedDistance = distance / DOCK_CONFIG.effectRadius;
    const scale = 1 + (DOCK_CONFIG.maxScale - 1) * Math.cos(normalizedDistance * Math.PI / 2);

    return scale;
}

interface SlideItemProps {
    slide: PlatformSlide;
    index: number;
    mouseX: number | null;
    containerRef: React.RefObject<HTMLDivElement>;
}

function SlideItem({ slide, index, mouseX, containerRef }: SlideItemProps) {
    const itemRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useEffect(() => {
        if (mouseX === null || !itemRef.current || !containerRef.current) {
            setScale(1);
            return;
        }

        const itemRect = itemRef.current.getBoundingClientRect();

        // Calculate center of item relative to viewport
        const itemCenterX = itemRect.left + itemRect.width / 2;

        // Distance from mouse to item center
        const distance = Math.abs(mouseX - itemCenterX);

        const newScale = calculateScale(distance);
        setScale(newScale);
    }, [mouseX, containerRef]);

    const label = getSlideLabel(slide);

    return (
        <div
            ref={itemRef}
            className="flex flex-col items-center justify-end flex-shrink-0"
            style={{
                width: `${DOCK_CONFIG.baseSize}px`,
                marginLeft: `${DOCK_CONFIG.spacing / 2}px`,
                marginRight: `${DOCK_CONFIG.spacing / 2}px`,
                transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: `scale(${scale})`,
                transformOrigin: 'bottom center',
            }}
        >
            {/* Image - clean, no background or shadow */}
            <div
                className="w-28 h-28 mb-3 flex items-center justify-center"
                style={{
                    transform: 'translateZ(0)',
                }}
            >
                <SlideImage slide={slide} />
            </div>
            {/* Label */}
            <span
                className="text-sm font-medium text-muted-foreground whitespace-nowrap transition-all duration-200"
                style={{
                    opacity: scale > 1.1 ? 1 : 0.7,
                    transform: `scale(${1 / scale})`, // Counter-scale to keep text readable
                }}
            >
                {label}
            </span>
        </div>
    );
}

/**
 * Platform slider component - renders a marquee of platform feature images
 * with Mac Dock magnifying effect - clean floating design
 */
export function PlatformSlider() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [mouseX, setMouseX] = useState<number | null>(null);

    // Duplicate slides for seamless infinite loop
    const displaySlides = [...PLATFORM_SLIDES, ...PLATFORM_SLIDES, ...PLATFORM_SLIDES];

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        setMouseX(e.clientX);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setMouseX(null);
    }, []);

    return (
        <div
            className="w-full overflow-hidden py-6 mb-12"
            style={{
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden',
            }}
        >
            {/* Clean container - no background, no border, no shadow */}
            <div
                ref={containerRef}
                className="w-full"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                <div
                    className="flex items-end animate-marquee"
                    style={{
                        willChange: 'transform',
                        minHeight: `${DOCK_CONFIG.baseSize * DOCK_CONFIG.maxScale + 50}px`,
                        alignItems: 'flex-end',
                    }}
                >
                    {displaySlides.map((slide, index) => (
                        <SlideItem
                            key={`${slide.key}-${index}`}
                            slide={slide}
                            index={index}
                            mouseX={mouseX}
                            containerRef={containerRef}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

export default PlatformSlider;
