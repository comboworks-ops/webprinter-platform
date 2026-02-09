/**
 * Classic Theme - Banner2 Component
 *
 * Secondary banner section with icon cards and slides.
 */

import { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BANNER2_ICON_MAP } from '@/components/branding/banner2Icons';
import type { Banner2Props } from '@/lib/themes/types';

export function ClassicBanner2({ branding, banner2 }: Banner2Props) {
    const [activeBannerSlide, setActiveBannerSlide] = useState(0);

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

    const bgType = banner2Settings?.background?.type || 'solid';
    const isAnimated = banner2Settings?.background?.animated;
    const gradient = isAnimated
        ? `linear-gradient(${banner2Settings?.background?.gradientAngle ?? 135}deg, ${banner2Settings?.background?.animatedStart || '#0EA5E9'}, ${banner2Settings?.background?.animatedMiddle || '#38BDF8'}, ${banner2Settings?.background?.animatedEnd || '#0284C7'})`
        : `linear-gradient(${banner2Settings?.background?.gradientAngle ?? 135}deg, ${banner2Settings?.background?.gradientStart || '#0EA5E9'}, ${banner2Settings?.background?.gradientEnd || '#0284C7'})`;

    const bgStyle: CSSProperties = bgType === 'solid'
        ? { backgroundColor: banner2Settings?.background?.color || '#0EA5E9' }
        : {
            backgroundImage: gradient,
            backgroundSize: isAnimated ? '200% 200%' : undefined,
        };

    const speedClass = banner2Settings?.background?.animatedSpeed === 'slower' ? 'banner2-gradient-slower' : 'banner2-gradient-slow';

    return (
        <section
            className={`py-16 relative overflow-hidden ${isAnimated ? speedClass : ''}`}
            style={bgStyle}
            data-branding-id="banner2"
        >
            <div className="container mx-auto px-4">
                {/* Slide Title */}
                {slide.title && (
                    <h2 className="text-3xl font-bold text-center text-white mb-12">
                        {slide.title}
                    </h2>
                )}

                {/* Items Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {slide.items?.map((item) => {
                        const IconComponent = item.icon ? BANNER2_ICON_MAP[item.icon] : null;
                        return (
                            <div key={item.id} className="text-center text-white">
                                {IconComponent && (
                                    <div className="w-16 h-16 mx-auto mb-4 bg-white/20 rounded-full flex items-center justify-center">
                                        <IconComponent className="w-8 h-8" />
                                    </div>
                                )}
                                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                                <p className="text-white/80">{item.description}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Navigation Arrows */}
                {banner2Slides.length > 1 && (
                    <>
                        <button
                            onClick={() => setActiveBannerSlide((prev) => (prev - 1 + banner2Slides.length) % banner2Slides.length)}
                            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                        >
                            <ChevronLeft className="w-6 h-6 text-white" />
                        </button>
                        <button
                            onClick={() => setActiveBannerSlide((prev) => (prev + 1) % banner2Slides.length)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
                        >
                            <ChevronRight className="w-6 h-6 text-white" />
                        </button>

                        {/* Dots */}
                        <div className="flex justify-center gap-2 mt-8">
                            {banner2Slides.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveBannerSlide(idx)}
                                    className={`w-3 h-3 rounded-full transition-colors ${
                                        idx === activeBannerSlide ? 'bg-white' : 'bg-white/40 hover:bg-white/60'
                                    }`}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}
