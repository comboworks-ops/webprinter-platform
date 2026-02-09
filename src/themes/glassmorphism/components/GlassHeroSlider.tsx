/**
 * Glassmorphism Theme - HeroSlider Component
 *
 * A modern hero section with glass overlay effects.
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ThemeComponentProps } from '@/lib/themes/types';
import { cn } from '@/lib/utils';

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
            <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
                <div
                    className="absolute inset-0 bg-gradient-to-br"
                    style={{
                        backgroundImage: `linear-gradient(135deg, ${primaryColor}20, ${primaryColor}05)`,
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
