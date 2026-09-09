/** The original product illustrations, in a quiet, accessible continuous row. */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import { Pause, Play } from "lucide-react";
import { PLATFORM_SLIDES, getSlideLabel, type PlatformSlide } from "@/lib/platform/sliderImages";
import "./platformSlider.css";

const PIXELS_PER_SECOND = 45;

type SliderStyle = CSSProperties & {
    "--platform-product-loop-width": string;
    "--platform-product-loop-duration": string;
};

function SlideItem({ slide, eager }: { slide: PlatformSlide; eager: boolean }) {
    return (
        <li className="platform-product-slider__item">
            <picture className="platform-product-slider__picture">
                {slide.webpSrc && <source srcSet={slide.webpSrc} type="image/webp" />}
                <img
                    src={slide.src}
                    alt=""
                    width={112}
                    height={84}
                    loading={eager ? "eager" : "lazy"}
                    decoding="async"
                    draggable={false}
                />
            </picture>
            <span className="platform-product-slider__label">{getSlideLabel(slide)}</span>
        </li>
    );
}

export function PlatformSlider() {
    const sectionRef = useRef<HTMLElement>(null);
    const groupRef = useRef<HTMLUListElement>(null);
    const [loopWidth, setLoopWidth] = useState(0);
    const [isUserPaused, setIsUserPaused] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [isKeyboardFocusPaused, setIsKeyboardFocusPaused] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const [isTabVisible, setIsTabVisible] = useState(
        () => typeof document === "undefined" || document.visibilityState !== "hidden",
    );
    const shouldReduceMotion = useReducedMotion();

    useEffect(() => {
        const group = groupRef.current;
        if (!group) return;

        const measure = () => setLoopWidth(group.getBoundingClientRect().width);
        measure();
        if (typeof ResizeObserver === "undefined") return;
        const observer = new ResizeObserver(measure);
        observer.observe(group);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const section = sectionRef.current;
        if (!section) return;
        if (typeof IntersectionObserver === "undefined") {
            setIsInView(true);
            return;
        }
        const observer = new IntersectionObserver(([entry]) => {
            setIsInView(entry.isIntersecting);
        });
        observer.observe(section);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const updateVisibility = () => setIsTabVisible(document.visibilityState !== "hidden");
        document.addEventListener("visibilitychange", updateVisibility);
        return () => document.removeEventListener("visibilitychange", updateVisibility);
    }, []);

    const isControlPaused = isUserPaused || isKeyboardFocusPaused;
    const isPaused = isControlPaused || isHovering || !isInView || !isTabVisible || !loopWidth;
    const style: SliderStyle = {
        "--platform-product-loop-width": `${loopWidth}px`,
        "--platform-product-loop-duration": `${loopWidth / PIXELS_PER_SECOND}s`,
    };

    return (
        <section
            ref={sectionRef}
            className="platform-product-slider"
            aria-label="Eksempler på tryksager"
            data-reduced-motion={shouldReduceMotion ? "true" : "false"}
            style={style}
        >
            <div
                className="platform-product-slider__viewport"
                role="region"
                aria-label={shouldReduceMotion ? "Tryksager — rul vandret for at se flere" : "Tryksager"}
                tabIndex={shouldReduceMotion ? 0 : undefined}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
            >
                <div
                    className="platform-product-slider__track"
                    style={{ animationPlayState: isPaused ? "paused" : "running" }}
                >
                    <ul ref={groupRef} className="platform-product-slider__group">
                        {PLATFORM_SLIDES.map((slide, index) => (
                            <SlideItem key={slide.key} slide={slide} eager={index < 6} />
                        ))}
                    </ul>
                    <ul className="platform-product-slider__group platform-product-slider__copy" aria-hidden="true">
                        {PLATFORM_SLIDES.map((slide) => (
                            <SlideItem key={slide.key} slide={slide} eager={false} />
                        ))}
                    </ul>
                </div>
            </div>
            <div className="platform-product-slider__controls">
                <span className="platform-product-slider__scroll-hint">Rul for at se flere tryksager</span>
                <button
                    className="platform-product-slider__toggle"
                    type="button"
                    aria-label={isControlPaused ? "Afspil billedrækken" : "Sæt billedrækken på pause"}
                    onFocus={(event) => {
                        if (event.currentTarget.matches(":focus-visible")) setIsKeyboardFocusPaused(true);
                    }}
                    onBlur={() => setIsKeyboardFocusPaused(false)}
                    onClick={() => {
                        setIsUserPaused(!isControlPaused);
                        setIsKeyboardFocusPaused(false);
                    }}
                >
                    {isControlPaused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
                    {isControlPaused ? "Afspil" : "Sæt på pause"}
                </button>
            </div>
        </section>
    );
}

export default PlatformSlider;
