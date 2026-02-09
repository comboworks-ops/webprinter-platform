/**
 * Glassmorphism Theme - Banner2 Component
 *
 * Floating glass cards with blur effects and gradient backgrounds.
 */

import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BANNER2_ICON_MAP } from '@/components/branding/banner2Icons';
import type { Banner2Props } from '@/lib/themes/types';

export function GlassBanner2({ branding, banner2 }: Banner2Props) {
    const [activeBannerSlide, setActiveBannerSlide] = useState(0);
    const primaryColor = branding?.colors?.primary || '#0EA5E9';

    const banner2Slides = useMemo(() => {
        if (!banner2?.slides) return [];
        return banner2.slides
            .filter((slide) => slide.enabled)
            .map((slide) => ({
                ...slide,
                items: (slide.items || []).filter((item) => item.enabled).slice(0, 4),
            }))
            .filter((slide) => slide.items.length > 0);
    }, [banner2]);

    useEffect(() => {
        if (activeBannerSlide >= banner2Slides.length) {
            setActiveBannerSlide(0);
        }
    }, [banner2Slides.length, activeBannerSlide]);

    // Auto-advance slides
    const banner2Settings = branding?.forside?.banner2;
    useEffect(() => {
        if (!banner2Settings?.autoPlay || banner2Slides.length <= 1) return;
        const interval = setInterval(() => {
            setActiveBannerSlide((prev) => (prev + 1) % banner2Slides.length);
        }, (banner2Settings.autoPlayInterval || 5) * 1000);
        return () => clearInterval(interval);
    }, [banner2Settings?.autoPlay, banner2Settings?.autoPlayInterval, banner2Slides.length]);

    if (!banner2?.enabled || banner2Slides.length === 0) return null;

    const slide = banner2Slides[activeBannerSlide] || banner2Slides[0];
    if (!slide) return null;

    return (
        <section
            className="py-20 relative overflow-hidden"
            style={{
                background: `linear-gradient(135deg, ${primaryColor}15 0%, ${primaryColor}05 100%)`,
            }}
            data-branding-id="banner2"
        >
            {/* Floating gradient orbs */}
            <div
                className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-30 pointer-events-none"
                style={{ backgroundColor: primaryColor }}
            />
            <div
                className="absolute bottom-0 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none"
                style={{ backgroundColor: primaryColor }}
            />

            <div className="container mx-auto px-4 relative z-10">
                {/* Slide Title in Glass Card */}
                {slide.title && (
                    <div className="text-center mb-12">
                        <h2
                            className="inline-block text-3xl font-bold px-8 py-4 rounded-2xl"
                            style={{
                                background: 'rgba(255, 255, 255, 0.8)',
                                backdropFilter: 'blur(12px)',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.5)',
                                color: primaryColor,
                            }}
                        >
                            {slide.title}
                        </h2>
                    </div>
                )}

                {/* Glass Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {slide.items?.map((item, index) => {
                        const IconComponent = item.icon ? BANNER2_ICON_MAP[item.icon] : null;
                        return (
                            <div
                                key={item.id}
                                className="group p-6 rounded-2xl transition-all duration-300 hover:scale-105 hover:-translate-y-1"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.7)',
                                    backdropFilter: 'blur(12px)',
                                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.5)',
                                    animationDelay: `${index * 100}ms`,
                                }}
                            >
                                {IconComponent && (
                                    <div
                                        className="w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                                        style={{
                                            background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}CC)`,
                                            boxShadow: `0 4px 20px ${primaryColor}40`,
                                        }}
                                    >
                                        <IconComponent className="w-7 h-7 text-white" />
                                    </div>
                                )}
                                <h3
                                    className="text-lg font-semibold mb-2 text-center"
                                    style={{ color: '#1e293b' }}
                                >
                                    {item.title}
                                </h3>
                                <p className="text-gray-600 text-center text-sm">
                                    {item.description}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Glass Navigation */}
                {banner2Slides.length > 1 && (
                    <>
                        <button
                            onClick={() => setActiveBannerSlide((prev) => (prev - 1 + banner2Slides.length) % banner2Slides.length)}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                            style={{
                                background: 'rgba(255, 255, 255, 0.8)',
                                backdropFilter: 'blur(12px)',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.5)',
                            }}
                        >
                            <ChevronLeft className="w-6 h-6" style={{ color: primaryColor }} />
                        </button>
                        <button
                            onClick={() => setActiveBannerSlide((prev) => (prev + 1) % banner2Slides.length)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                            style={{
                                background: 'rgba(255, 255, 255, 0.8)',
                                backdropFilter: 'blur(12px)',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                                border: '1px solid rgba(255, 255, 255, 0.5)',
                            }}
                        >
                            <ChevronRight className="w-6 h-6" style={{ color: primaryColor }} />
                        </button>

                        {/* Glass Dots */}
                        <div className="flex justify-center gap-3 mt-10">
                            {banner2Slides.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveBannerSlide(idx)}
                                    className="w-3 h-3 rounded-full transition-all"
                                    style={{
                                        backgroundColor: idx === activeBannerSlide ? primaryColor : 'rgba(0, 0, 0, 0.2)',
                                        boxShadow: idx === activeBannerSlide ? `0 2px 10px ${primaryColor}60` : 'none',
                                        transform: idx === activeBannerSlide ? 'scale(1.2)' : 'scale(1)',
                                    }}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}
