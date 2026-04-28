/**
 * PlatformSlider - image dock for the platform landing page.
 *
 * Uses local PNG images from /public/platform/slider/ via PLATFORM_SLIDES.
 * The track is decorative, but the motion is intentionally polished: a measured
 * Framer Motion loop prevents the visible reset that happens with fixed CSS
 * marquee distances, and MotionValues keep the dock magnification off the
 * React render path.
 */

import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
    animate,
    motion,
    useAnimationFrame,
    useMotionValue,
    useReducedMotion,
    useSpring,
    useTransform,
    type MotionValue,
} from "framer-motion";
import { PLATFORM_SLIDES, getSlideLabel, type PlatformSlide } from "@/lib/platform/sliderImages";

interface SlideImageProps {
    slide: PlatformSlide;
}

function SlideImage({ slide }: SlideImageProps) {
    return (
        <img
            src={slide.src}
            alt={slide.alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="h-full w-full select-none object-contain"
            style={{ display: "block", imageRendering: "auto" }}
        />
    );
}

const DOCK_CONFIG = {
    baseSize: 122,
    imageSize: 112,
    maxScale: 1.52,
    effectRadius: 210,
    spacing: 38,
    loopSeconds: 34,
};

const calculateScale = (distance: number): number => {
    if (distance > DOCK_CONFIG.effectRadius) return 1;
    const normalizedDistance = distance / DOCK_CONFIG.effectRadius;
    const eased = (1 + Math.cos(normalizedDistance * Math.PI)) / 2;
    return 1 + (DOCK_CONFIG.maxScale - 1) * eased;
};

interface SlideItemProps {
    slide: PlatformSlide;
    mouseX: MotionValue<number>;
    hoverTick: MotionValue<number>;
}

function SlideItem({ slide, mouseX, hoverTick }: SlideItemProps) {
    const itemRef = useRef<HTMLDivElement>(null);
    const rawScale = useTransform([mouseX, hoverTick], ([latestMouseX]) => {
        if (latestMouseX < 0 || !itemRef.current) return 1;
        const itemRect = itemRef.current.getBoundingClientRect();
        const itemCenterX = itemRect.left + itemRect.width / 2;
        return calculateScale(Math.abs(latestMouseX - itemCenterX));
    });
    const scale = useSpring(rawScale, { stiffness: 360, damping: 34, mass: 0.5 });
    const labelOpacity = useTransform(scale, [1, 1.16], [0.68, 1]);
    const labelY = useTransform(scale, [1, DOCK_CONFIG.maxScale], [0, -4]);
    const imageY = useTransform(scale, [1, DOCK_CONFIG.maxScale], [0, -10]);
    const labelScale = useTransform(scale, (value) => 1 / Math.max(value, 1));
    const label = getSlideLabel(slide);

    return (
        <motion.div
            ref={itemRef}
            className="group flex shrink-0 cursor-default flex-col items-center justify-end"
            style={{
                width: DOCK_CONFIG.baseSize,
                marginLeft: DOCK_CONFIG.spacing / 2,
                marginRight: DOCK_CONFIG.spacing / 2,
                scale,
                transformOrigin: "bottom center",
                willChange: "transform",
            }}
        >
            <motion.div
                className="mb-3 flex items-center justify-center"
                style={{
                    width: DOCK_CONFIG.imageSize,
                    height: DOCK_CONFIG.imageSize,
                    y: imageY,
                    filter: "drop-shadow(0 16px 24px rgba(15, 23, 42, 0.10))",
                    willChange: "transform",
                }}
            >
                <SlideImage slide={slide} />
            </motion.div>
            <motion.span
                className="whitespace-nowrap text-sm font-medium text-slate-600"
                style={{
                    opacity: labelOpacity,
                    y: labelY,
                    scale: labelScale,
                    transformOrigin: "top center",
                }}
            >
                {label}
            </motion.span>
        </motion.div>
    );
}

export function PlatformSlider() {
    const groupRef = useRef<HTMLDivElement>(null);
    const [loopWidth, setLoopWidth] = useState(0);
    const [isHovering, setIsHovering] = useState(false);
    const shouldReduceMotion = useReducedMotion();
    const x = useMotionValue(0);
    const mouseX = useMotionValue(-1);
    const hoverTick = useMotionValue(0);

    useEffect(() => {
        const group = groupRef.current;
        if (!group) return;

        const updateWidth = () => setLoopWidth(group.scrollWidth);
        updateWidth();

        const observer = new ResizeObserver(updateWidth);
        observer.observe(group);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!loopWidth || shouldReduceMotion) {
            x.set(0);
            return;
        }

        const controls = animate(x, -loopWidth, {
            duration: DOCK_CONFIG.loopSeconds,
            ease: "linear",
            repeat: Infinity,
            repeatType: "loop",
        });

        return () => controls.stop();
    }, [loopWidth, shouldReduceMotion, x]);

    useAnimationFrame((time) => {
        if (!isHovering) return;
        hoverTick.set(time);
    });

    const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
        mouseX.set(event.clientX);
        if (!isHovering) setIsHovering(true);
    };

    const handleMouseLeave = () => {
        setIsHovering(false);
        mouseX.set(-1);
    };

    return (
        <div
            className="relative mb-12 w-full overflow-hidden py-8"
            style={{
                ["--platform-slider-fade-left" as any]: "color-mix(in srgb, hsl(var(--primary)) 5%, hsl(var(--background)))",
                ["--platform-slider-fade-right" as any]: "color-mix(in srgb, hsl(var(--secondary)) 10%, hsl(var(--background)))",
            }}
        >
            <div
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24"
                style={{
                    backgroundImage:
                        "linear-gradient(to right, var(--platform-slider-fade-left), color-mix(in srgb, var(--platform-slider-fade-left) 82%, transparent), transparent)",
                }}
            />
            <div
                className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24"
                style={{
                    backgroundImage:
                        "linear-gradient(to left, var(--platform-slider-fade-right), color-mix(in srgb, var(--platform-slider-fade-right) 82%, transparent), transparent)",
                }}
            />

            <div
                className="w-full overflow-visible"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                <motion.div
                    className="flex w-max items-end"
                    style={{
                        x,
                        minHeight: DOCK_CONFIG.baseSize * DOCK_CONFIG.maxScale + 52,
                        willChange: shouldReduceMotion ? "auto" : "transform",
                        transform: "translateZ(0)",
                    }}
                >
                    <div ref={groupRef} className="flex items-end">
                        {PLATFORM_SLIDES.map((slide) => (
                            <SlideItem
                                key={`a-${slide.key}`}
                                slide={slide}
                                mouseX={mouseX}
                                hoverTick={hoverTick}
                            />
                        ))}
                    </div>
                    <div className="flex items-end" aria-hidden="true">
                        {PLATFORM_SLIDES.map((slide) => (
                            <SlideItem
                                key={`b-${slide.key}`}
                                slide={slide}
                                mouseX={mouseX}
                                hoverTick={hoverTick}
                            />
                        ))}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

export default PlatformSlider;
