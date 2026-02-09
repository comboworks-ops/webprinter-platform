/**
 * Classic Theme - ContentBlock Component
 *
 * Renders individual content blocks.
 */

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentBlockProps } from '@/lib/themes/types';

export function ClassicContentBlock({ block }: ContentBlockProps) {
    const [currentSlide, setCurrentSlide] = useState(0);

    const mediaType = (block as any).mediaType || ((block as any).gallery?.length ? 'gallery' : 'single');
    const gallery: string[] = (block as any).gallery || [];
    const hasGallery = mediaType === 'gallery' && gallery.length > 0;
    const hasImage = mediaType === 'single' && !!block.imageUrl;
    const showMedia = hasGallery || hasImage;
    const cta = (block as any).cta || {};
    const ctaLabel = (cta.label || '').trim();
    const ctaHref = (cta.href || '').trim();
    const showCta = cta.enabled && ctaLabel.length > 0;
    const ctaAlign = block.alignment === 'center'
        ? 'justify-center'
        : block.alignment === 'right'
            ? 'justify-end'
            : 'justify-start';
    const ctaSizeClass = cta.size === 'sm'
        ? 'px-3 py-1.5 text-sm'
        : cta.size === 'lg'
            ? 'px-6 py-3 text-base'
            : 'px-4 py-2 text-sm';

    // Gallery auto-advance
    useEffect(() => {
        if (!hasGallery || gallery.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % gallery.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [hasGallery, gallery.length]);

    const imagePosition = block.imagePosition || 'left';
    const isReverse = imagePosition === 'right';
    const textAlign = block.alignment || 'left';
    const textAlignClass = textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left';

    // Background handling
    const bgConfig = (block as any).background || {};
    let bgStyle: React.CSSProperties = {};
    if (bgConfig.type === 'gradient') {
        bgStyle = {
            backgroundImage: `linear-gradient(${bgConfig.gradientAngle || 135}deg, ${bgConfig.gradientStart || '#ffffff'}, ${bgConfig.gradientEnd || '#f8fafc'})`,
        };
    } else if (bgConfig.type === 'image' && bgConfig.imageUrl) {
        bgStyle = {
            backgroundImage: `url(${bgConfig.imageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
        };
    } else if (block.backgroundColor) {
        bgStyle = { backgroundColor: block.backgroundColor };
    }

    return (
        <section
            key={block.id}
            className="py-16"
            style={bgStyle}
            data-branding-id={`content-block-${block.id}`}
        >
            <div className="container mx-auto px-4">
                <div
                    className={cn(
                        'grid gap-8 items-center',
                        showMedia ? 'md:grid-cols-2' : 'md:grid-cols-1',
                        isReverse && showMedia ? 'md:[&>*:first-child]:order-2' : ''
                    )}
                >
                    {/* Media */}
                    {showMedia && (
                        <div className="relative">
                            {hasGallery ? (
                                <div className="relative aspect-[4/3] rounded-xl overflow-hidden">
                                    {gallery.map((img, idx) => (
                                        <img
                                            key={idx}
                                            src={img}
                                            alt=""
                                            className={cn(
                                                'absolute inset-0 w-full h-full object-cover transition-opacity duration-500',
                                                idx === currentSlide ? 'opacity-100' : 'opacity-0'
                                            )}
                                        />
                                    ))}
                                    {gallery.length > 1 && (
                                        <>
                                            <button
                                                onClick={() => setCurrentSlide((prev) => (prev - 1 + gallery.length) % gallery.length)}
                                                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center"
                                            >
                                                <ChevronLeft className="w-5 h-5 text-white" />
                                            </button>
                                            <button
                                                onClick={() => setCurrentSlide((prev) => (prev + 1) % gallery.length)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center"
                                            >
                                                <ChevronRight className="w-5 h-5 text-white" />
                                            </button>
                                            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                                {gallery.map((_, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setCurrentSlide(idx)}
                                                        className={cn(
                                                            'w-2 h-2 rounded-full transition-colors',
                                                            idx === currentSlide ? 'bg-white' : 'bg-white/50'
                                                        )}
                                                    />
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : hasImage ? (
                                <img
                                    src={block.imageUrl}
                                    alt={block.title || ''}
                                    className="w-full rounded-xl object-cover aspect-[4/3]"
                                />
                            ) : null}
                        </div>
                    )}

                    {/* Content */}
                    <div className={textAlignClass}>
                        {block.title && (
                            <h2
                                className="text-3xl font-bold mb-4"
                                style={{ color: block.textColor }}
                            >
                                {block.title}
                            </h2>
                        )}
                        {block.subtitle && (
                            <p
                                className="text-xl text-gray-600 mb-4"
                                style={{ color: block.textColor ? `${block.textColor}CC` : undefined }}
                            >
                                {block.subtitle}
                            </p>
                        )}
                        {block.content && (
                            <div
                                className="prose max-w-none"
                                style={{ color: block.textColor }}
                                dangerouslySetInnerHTML={{ __html: block.content }}
                            />
                        )}
                        {showCta && (
                            <div className={`mt-6 flex ${ctaAlign}`}>
                                <a
                                    href={ctaHref}
                                    className={cn(
                                        'inline-flex items-center rounded-lg font-medium transition-colors',
                                        ctaSizeClass
                                    )}
                                    style={{
                                        backgroundColor: cta.bgColor || '#0EA5E9',
                                        color: cta.textColor || '#FFFFFF',
                                    }}
                                >
                                    {ctaLabel}
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
