/**
 * Glassmorphism Theme - ContentBlock Component
 *
 * Content blocks with glass morphism effects.
 */

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentBlockProps } from '@/lib/themes/types';

export function GlassContentBlock({ branding, block }: ContentBlockProps) {
    const [currentSlide, setCurrentSlide] = useState(0);
    const primaryColor = branding?.colors?.primary || '#0EA5E9';

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

    return (
        <section
            key={block.id}
            className="py-20 relative overflow-hidden"
            data-branding-id={`content-block-${block.id}`}
        >
            {/* Background gradient based on content position */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    background: isReverse
                        ? `linear-gradient(90deg, transparent 0%, ${primaryColor}08 100%)`
                        : `linear-gradient(90deg, ${primaryColor}08 0%, transparent 100%)`,
                }}
            />

            <div className="container mx-auto px-4 relative z-10">
                <div
                    className={cn(
                        'grid gap-12 items-center',
                        showMedia ? 'md:grid-cols-2' : 'md:grid-cols-1',
                        isReverse && showMedia ? 'md:[&>*:first-child]:order-2' : ''
                    )}
                >
                    {/* Media with glass frame */}
                    {showMedia && (
                        <div className="relative">
                            {/* Decorative gradient behind image */}
                            <div
                                className="absolute -inset-4 rounded-3xl blur-2xl opacity-30 pointer-events-none"
                                style={{ backgroundColor: primaryColor }}
                            />

                            <div
                                className="relative rounded-2xl overflow-hidden"
                                style={{
                                    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
                                    border: '1px solid rgba(255, 255, 255, 0.3)',
                                }}
                            >
                                {hasGallery ? (
                                    <div className="relative aspect-[4/3]">
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
                                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                                                    style={{
                                                        background: 'rgba(255, 255, 255, 0.9)',
                                                        backdropFilter: 'blur(8px)',
                                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                                    }}
                                                >
                                                    <ChevronLeft className="w-5 h-5" style={{ color: primaryColor }} />
                                                </button>
                                                <button
                                                    onClick={() => setCurrentSlide((prev) => (prev + 1) % gallery.length)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-110"
                                                    style={{
                                                        background: 'rgba(255, 255, 255, 0.9)',
                                                        backdropFilter: 'blur(8px)',
                                                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                                    }}
                                                >
                                                    <ChevronRight className="w-5 h-5" style={{ color: primaryColor }} />
                                                </button>
                                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                                                    {gallery.map((_, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => setCurrentSlide(idx)}
                                                            className="w-2 h-2 rounded-full transition-all"
                                                            style={{
                                                                backgroundColor: idx === currentSlide ? 'white' : 'rgba(255, 255, 255, 0.5)',
                                                                transform: idx === currentSlide ? 'scale(1.3)' : 'scale(1)',
                                                            }}
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
                                        className="w-full object-cover aspect-[4/3]"
                                    />
                                ) : null}
                            </div>
                        </div>
                    )}

                    {/* Content in glass card */}
                    <div
                        className={cn('p-8 rounded-2xl', textAlignClass)}
                        style={{
                            background: 'rgba(255, 255, 255, 0.5)',
                            backdropFilter: 'blur(12px)',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.6)',
                        }}
                    >
                        {block.title && (
                            <h2
                                className="text-4xl font-bold mb-4"
                                style={{ color: block.textColor || '#1e293b' }}
                            >
                                {block.title}
                            </h2>
                        )}
                        {block.subtitle && (
                            <p
                                className="text-xl mb-4"
                                style={{ color: block.textColor ? `${block.textColor}BB` : '#64748b' }}
                            >
                                {block.subtitle}
                            </p>
                        )}
                        {block.content && (
                            <div
                                className="prose max-w-none"
                                style={{ color: block.textColor || '#475569' }}
                                dangerouslySetInnerHTML={{ __html: block.content }}
                            />
                        )}
                        {showCta && (
                            <div className={`mt-8 flex ${ctaAlign}`}>
                                <a
                                    href={ctaHref}
                                    className="inline-flex items-center px-6 py-3 rounded-xl font-semibold transition-all hover:scale-105 hover:-translate-y-0.5"
                                    style={{
                                        background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}DD)`,
                                        color: '#FFFFFF',
                                        boxShadow: `0 8px 24px ${primaryColor}40`,
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
