/**
 * Glassmorphism Theme - HeroSlider Component
 *
 * A modern hero section with glass overlay effects and animated background.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ThemeComponentProps } from '@/lib/themes/types';
import { cn } from '@/lib/utils';

/**
 * Animated Glassmorphism Background
 * Slowly moving, blurred gradient orbs for a soft glass effect
 */
function AnimatedGlassBackground({ primaryColor }: { primaryColor: string }) {
    return (
        <>
            {/* CSS Keyframes for smooth animation */}
            <style>{`
                @keyframes float-slow-1 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    25% { transform: translate(5%, 10%) scale(1.05); }
                    50% { transform: translate(-5%, 5%) scale(0.95); }
                    75% { transform: translate(10%, -5%) scale(1.02); }
                }
                @keyframes float-slow-2 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(-10%, 8%) scale(1.08); }
                    66% { transform: translate(8%, -10%) scale(0.92); }
                }
                @keyframes float-slow-3 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    20% { transform: translate(12%, 5%) scale(0.98); }
                    40% { transform: translate(-8%, 12%) scale(1.04); }
                    60% { transform: translate(5%, -8%) scale(1.06); }
                    80% { transform: translate(-5%, 3%) scale(0.96); }
                }
                @keyframes float-slow-4 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(-15%, -10%) scale(1.1); }
                }
            `}</style>

            {/* Animated gradient orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Large soft blue orb - top left */}
                <div
                    className="absolute -top-20 -left-20 w-[500px] h-[500px] rounded-full opacity-[0.15]"
                    style={{
                        background: `radial-gradient(circle, rgba(147, 197, 253, 0.8) 0%, rgba(147, 197, 253, 0) 70%)`,
                        filter: 'blur(60px)',
                        animation: 'float-slow-1 25s ease-in-out infinite',
                    }}
                />

                {/* Medium cyan orb - top right */}
                <div
                    className="absolute -top-10 right-0 w-[400px] h-[400px] rounded-full opacity-[0.12]"
                    style={{
                        background: `radial-gradient(circle, rgba(165, 243, 252, 0.8) 0%, rgba(165, 243, 252, 0) 70%)`,
                        filter: 'blur(50px)',
                        animation: 'float-slow-2 30s ease-in-out infinite',
                    }}
                />

                {/* Large primary color tinted orb - center */}
                <div
                    className="absolute top-1/3 left-1/3 w-[600px] h-[600px] rounded-full opacity-[0.08]"
                    style={{
                        background: `radial-gradient(circle, ${primaryColor}60 0%, transparent 70%)`,
                        filter: 'blur(80px)',
                        animation: 'float-slow-3 35s ease-in-out infinite',
                    }}
                />

                {/* Small accent orb - bottom left */}
                <div
                    className="absolute bottom-10 left-1/4 w-[300px] h-[300px] rounded-full opacity-[0.1]"
                    style={{
                        background: `radial-gradient(circle, rgba(186, 230, 253, 0.9) 0%, rgba(186, 230, 253, 0) 70%)`,
                        filter: 'blur(40px)',
                        animation: 'float-slow-4 20s ease-in-out infinite',
                    }}
                />

                {/* Medium purple-blue orb - bottom right */}
                <div
                    className="absolute -bottom-20 -right-10 w-[450px] h-[450px] rounded-full opacity-[0.1]"
                    style={{
                        background: `radial-gradient(circle, rgba(196, 181, 253, 0.7) 0%, rgba(196, 181, 253, 0) 70%)`,
                        filter: 'blur(55px)',
                        animation: 'float-slow-1 28s ease-in-out infinite reverse',
                    }}
                />
            </div>
        </>
    );
}

export function GlassHeroSlider({ branding, tenantName }: ThemeComponentProps) {
    const heroSettings = branding?.hero || {};
    const images = heroSettings.images || [];
    const slideshow = heroSettings.slideshow || { autoplay: true, intervalMs: 5000 };
    const overlay = heroSettings.overlay || {};
    const primaryColor = branding?.colors?.primary || '#0EA5E9';

    const [currentSlide, setCurrentSlide] = useState(0);

    // Auto-advance slides
    useEffect(() => {
        if (!slideshow.autoplay || images.length <= 1) return;

        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % images.length);
        }, slideshow.intervalMs || 5000);

        return () => clearInterval(timer);
    }, [slideshow.autoplay, slideshow.intervalMs, images.length]);

    if (images.length === 0) {
        // Default hero when no images
        return (
            <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 to-white">
                {/* Animated glassmorphism background */}
                <AnimatedGlassBackground primaryColor={primaryColor} />

                {/* Subtle base gradient */}
                <div
                    className="absolute inset-0 bg-gradient-to-br pointer-events-none"
                    style={{
                        backgroundImage: `linear-gradient(135deg, ${primaryColor}10, transparent 50%, ${primaryColor}05)`,
                    }}
                />
                <div className="relative z-10 text-center px-4">
                    <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-4">
                        {overlay.title || `Velkommen til ${tenantName}`}
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        {overlay.subtitle || 'Kvalitetsprodukter til konkurrencedygtige priser'}
                    </p>
                </div>
            </section>
        );
    }

    const currentImage = images[currentSlide];

    return (
        <section className="relative min-h-[80vh] flex items-center overflow-hidden">
            {/* Animated glassmorphism background (behind image) */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white">
                <AnimatedGlassBackground primaryColor={primaryColor} />
            </div>

            {/* Background Image */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-700"
                style={{ backgroundImage: `url(${currentImage?.url})` }}
            />

            {/* Glass Overlay */}
            <div
                className="absolute inset-0"
                style={{
                    background: `linear-gradient(135deg, ${heroSettings.overlay_color || '#000000'}${Math.round((heroSettings.overlay_opacity || 0.4) * 255).toString(16).padStart(2, '0')}, transparent)`,
                }}
            />

            {/* Content */}
            <div className="relative z-10 container mx-auto px-4">
                <div className="max-w-2xl">
                    {/* Glass Card */}
                    <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-8 border border-white/30 shadow-2xl">
                        <h1
                            className="text-4xl md:text-5xl font-bold mb-4"
                            style={{ color: overlay.titleColor || '#FFFFFF' }}
                        >
                            {currentImage?.headline || overlay.title || `Velkommen til ${tenantName}`}
                        </h1>
                        <p
                            className="text-lg md:text-xl mb-6"
                            style={{ color: overlay.subtitleColor || 'rgba(255,255,255,0.9)' }}
                        >
                            {currentImage?.subline || overlay.subtitle || 'Kvalitetsprodukter til konkurrencedygtige priser'}
                        </p>

                        {/* Buttons */}
                        {currentImage?.buttons && currentImage.buttons.length > 0 ? (
                            <div className="flex flex-wrap gap-3">
                                {currentImage.buttons.slice(0, 2).map((button: any) => (
                                    <Link
                                        key={button.id}
                                        to={button.target?.path || button.target?.url || '/shop'}
                                        className={cn(
                                            "px-6 py-3 rounded-full font-medium transition-all",
                                            "hover:scale-105 hover:shadow-lg",
                                            button.variant === 'secondary'
                                                ? "bg-white/20 backdrop-blur text-white border border-white/30"
                                                : "text-white shadow-lg"
                                        )}
                                        style={button.variant !== 'secondary' ? {
                                            background: `linear-gradient(135deg, ${button.bgColor || primaryColor}, ${button.bgColor || primaryColor}cc)`,
                                        } : undefined}
                                    >
                                        {button.label}
                                    </Link>
                                ))}
                            </div>
                        ) : overlay.showButtons && overlay.buttons?.length > 0 ? (
                            <div className="flex flex-wrap gap-3">
                                {overlay.buttons.slice(0, 2).map((button: any) => (
                                    <Link
                                        key={button.id}
                                        to={button.target?.path || '/shop'}
                                        className={cn(
                                            "px-6 py-3 rounded-full font-medium transition-all",
                                            "hover:scale-105 hover:shadow-lg",
                                            button.variant === 'secondary'
                                                ? "bg-white/20 backdrop-blur text-white border border-white/30"
                                                : "text-white shadow-lg"
                                        )}
                                        style={button.variant !== 'secondary' ? {
                                            background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)`,
                                        } : undefined}
                                    >
                                        {button.label}
                                    </Link>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* Navigation Arrows */}
            {images.length > 1 && (
                <>
                    <button
                        onClick={() => setCurrentSlide((prev) => (prev - 1 + images.length) % images.length)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all"
                    >
                        <ChevronLeft className="h-6 w-6" />
                    </button>
                    <button
                        onClick={() => setCurrentSlide((prev) => (prev + 1) % images.length)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all"
                    >
                        <ChevronRight className="h-6 w-6" />
                    </button>
                </>
            )}

            {/* Dots */}
            {images.length > 1 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                    {images.map((_: any, idx: number) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentSlide(idx)}
                            className={cn(
                                "w-2 h-2 rounded-full transition-all",
                                idx === currentSlide
                                    ? "w-8 bg-white"
                                    : "bg-white/50 hover:bg-white/70"
                            )}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
