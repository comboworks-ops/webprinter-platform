/**
 * PlatformSlider - Image slider for the Platform landing page
 * 
 * Uses local images from /public/platform/slider/ via the PLATFORM_SLIDES config.
 * Does NOT query products or tenant data.
 * 
 * Features:
 * - NO LINKS - purely visual/decorative
 * - High-quality image rendering with srcset for retina displays
 * - WebP support with JPEG fallback
 * - Smooth animation without seam/crack artifacts
 * - Labels derived from config or filename
 */

import { PLATFORM_SLIDES, hasWebpSource, getSlideLabel, type PlatformSlide } from "@/lib/platform/sliderImages";

interface SlideImageProps {
    slide: PlatformSlide;
}

/**
 * Individual slide image with proper <picture> element for responsive images
 */
function SlideImage({ slide }: SlideImageProps) {
    const { sources, alt } = slide;
    const showWebp = hasWebpSource(slide);

    return (
        <picture>
            {/* WebP sources (if available) */}
            {showWebp && (
                <source
                    type="image/webp"
                    srcSet={`${sources.webp1x} 1x, ${sources.webp2x} 2x`}
                />
            )}
            {/* JPEG fallback (always present) */}
            <img
                src={sources.jpg1x}
                srcSet={`${sources.jpg1x} 1x, ${sources.jpg2x} 2x`}
                sizes="(max-width: 768px) 90vw, 1200px"
                alt={alt}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                style={{
                    display: 'block',
                    imageRendering: 'auto',
                }}
            />
        </picture>
    );
}

/**
 * Platform slider component - renders a marquee of platform feature images
 * NO LINKS - purely visual
 */
export function PlatformSlider() {
    // Duplicate slides for seamless infinite loop
    const displaySlides = [...PLATFORM_SLIDES, ...PLATFORM_SLIDES, ...PLATFORM_SLIDES];

    return (
        <div
            className="w-full overflow-hidden py-0 mb-12"
            style={{
                // Prevent visual artifacts during animation
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden',
            }}
        >
            <div
                className="flex animate-marquee hover:animate-marquee-pause"
                style={{
                    // Use translate3d for GPU acceleration and prevent seam cracks
                    willChange: 'transform',
                    gap: 0,
                }}
            >
                {displaySlides.map((slide, index) => {
                    const label = getSlideLabel(slide);

                    return (
                        <div
                            key={`${slide.key}-${index}`}
                            className="flex flex-col items-center justify-center mx-12 w-40 group flex-shrink-0"
                        >
                            <div
                                className="w-24 h-24 mb-2 flex items-center justify-center transition-transform group-hover:scale-110 duration-300 overflow-hidden rounded-lg"
                                style={{
                                    // Prevent subpixel rendering issues
                                    transform: 'translateZ(0)',
                                }}
                            >
                                <SlideImage slide={slide} />
                            </div>
                            {/* Label - no link, purely decorative */}
                            <span className="text-lg font-medium text-muted-foreground whitespace-nowrap group-hover:text-primary transition-colors">
                                {label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default PlatformSlider;
