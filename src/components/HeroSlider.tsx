import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import {
  type HeroSettings,
  type HeroImage,
  type HeroVideo,
  type HeroButton,
  DEFAULT_HERO
} from "@/hooks/useBrandingDraft";

// Extended button type with color settings (matching BannerEditor)
interface BannerButton extends HeroButton {
  textColor?: string;
  bgColor?: string;
  bgOpacity?: number;
}

// Extended overlay settings with text colors
interface ExtendedOverlay {
  title?: string;
  subtitle?: string;
  titleColor?: string;
  subtitleColor?: string;
  showButtons?: boolean;
  buttons?: BannerButton[];
}

// Fallback images (used when no branding images are configured)
import heroPrinting from "@/assets/hero-printing.jpg";
import heroBanners from "@/assets/hero-banners.jpg";
import heroFlyers from "@/assets/hero-flyers.jpg";

const DEFAULT_SLIDES = [
  {
    image: heroPrinting,
    headline: "Professionelt tryk – hurtig levering i hele Danmark",
    subline: "Flyers, foldere, plakater, bannere m.m. — beregn prisen direkte.",
    cta: "Se tryksager",
    link: "#tryksager",
  },
  {
    image: heroBanners,
    headline: "Storformat print i topkvalitet",
    subline: "Bannere, beachflag, skilte og messeudstyr – til konkurrencedygtige priser.",
    cta: "Se storformat",
    link: "#storformat",
  },
  {
    image: heroFlyers,
    headline: "Billige tryksager online",
    subline: "Bestil nemt og hurtigt – personlig service og dansk produktion.",
    cta: "Beregn pris",
    link: "/prisberegner",
  },
];

// Helper to get button link
function getButtonLink(button: BannerButton): string {
  switch (button.linkType) {
    case 'ALL_PRODUCTS':
      return '/shop';
    case 'PRODUCT':
      return button.target?.productSlug ? `/produkt/${button.target.productSlug}` : '/shop';
    case 'INTERNAL_PAGE':
      return button.target?.path || '/';
    case 'EXTERNAL_URL':
      return button.target?.url || '#';
    default:
      return '/shop';
  }
}

// Helper to convert hex color to rgba
function hexToRgba(hex: string, opacity: number): string {
  if (!hex || !hex.startsWith('#')) return `rgba(0, 0, 0, ${opacity})`;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

interface HeroSliderProps {
  /** Optional hero settings override (for preview mode) */
  heroSettings?: HeroSettings;
}

const HeroSlider = ({ heroSettings }: HeroSliderProps) => {
  const { branding, isPreviewMode } = usePreviewBranding();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get hero settings from props, branding context, or defaults
  const hero: HeroSettings = heroSettings || (branding?.hero as HeroSettings) || DEFAULT_HERO;

  // Get extended overlay settings
  const extendedOverlay = (hero.overlay || {}) as ExtendedOverlay;

  // Get media items based on type
  const isVideoMode = hero.mediaType === 'video';
  const images: HeroImage[] = hero.images?.length > 0
    ? hero.images
    : (hero.media || []).map((url, i) => ({ id: `legacy-${i}`, url, sortOrder: i }));
  const videos: HeroVideo[] = hero.videos || [];

  // Use defaults if no media configured
  const useDefaults = !isVideoMode && images.length === 0;
  const mediaItems = isVideoMode ? videos : (useDefaults ? [] : images);
  const totalSlides = useDefaults ? DEFAULT_SLIDES.length : mediaItems.length;

  // Parallax scroll handler
  useEffect(() => {
    if (!hero.parallax && !hero.videoSettings?.parallaxEnabled) return;

    const handleScroll = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const scrollProgress = -rect.top / (rect.height + window.innerHeight);
        // Smooth parallax: move image up by 30% of scroll progress
        setScrollY(scrollProgress * 0.3 * rect.height);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hero.parallax, hero.videoSettings?.parallaxEnabled]);

  // Slideshow autoplay
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (hero.slideshow?.autoplay && totalSlides > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % totalSlides);
      }, hero.slideshow.intervalMs || 5000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [hero.slideshow?.autoplay, hero.slideshow?.intervalMs, totalSlides]);

  // Handle video autoplay
  useEffect(() => {
    if (isVideoMode && videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay blocked - this is fine
      });
    }
  }, [isVideoMode, currentSlide]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % totalSlides);
  const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);

  // Transition classes
  const getTransitionClass = (index: number) => {
    const isActive = index === currentSlide;
    // Force fade transition if parallax is enabled to prevent conflicts
    const isParallaxActive = hero.parallax || (isVideoMode && hero.videoSettings?.parallaxEnabled);
    const transition = isParallaxActive ? 'fade' : (hero.slideshow?.transition || 'fade');

    if (transition === 'fade') {
      return `transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-0'}`;
    } else {
      // Slide transition
      return `transition-transform duration-700 ${isActive ? 'translate-x-0' : index < currentSlide ? '-translate-x-full' : 'translate-x-full'
        }`;
    }
  };

  // Overlay title and subtitle with colors
  const overlayTitle = extendedOverlay.title;
  const overlaySubtitle = extendedOverlay.subtitle;
  const titleColor = extendedOverlay.titleColor || '#FFFFFF';
  const subtitleColor = extendedOverlay.subtitleColor || 'rgba(255, 255, 255, 0.9)';
  const showButtons = extendedOverlay.showButtons ?? true;
  const buttons = (extendedOverlay.buttons || []) as BannerButton[];

  // Parallax style for images
  const getParallaxStyle = () => {
    if (!hero.parallax) return {};
    return {
      transform: `translateY(${scrollY}px) scale(1.2)`, // Scale to prevent gaps
      willChange: 'transform',
    };
  };

  // Video parallax style
  const getVideoParallaxStyle = () => {
    if (!hero.videoSettings?.parallaxEnabled) return {};
    return {
      transform: `translateY(${scrollY}px) scale(1.2)`,
      willChange: 'transform',
    };
  };

  // Render button with custom colors
  const renderButton = (btn: BannerButton, isDefault = false, defaultCta?: string, defaultLink?: string) => {
    const buttonStyle: React.CSSProperties = {};

    if (!isDefault && btn.textColor) {
      buttonStyle.color = btn.textColor;
    }

    if (!isDefault && btn.bgColor) {
      buttonStyle.backgroundColor = hexToRgba(btn.bgColor, btn.bgOpacity ?? 1);
      buttonStyle.borderColor = btn.bgColor;
    }

    if (btn.variant === 'secondary' && !btn.bgColor) {
      // Default secondary style with transparency
      buttonStyle.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      buttonStyle.borderColor = '#FFFFFF';
      buttonStyle.color = btn.textColor || '#FFFFFF';
    }

    const ButtonContent = (
      <Button
        size="lg"
        variant={btn.variant === 'secondary' ? 'outline' : 'default'}
        style={buttonStyle}
        className={btn.variant === 'secondary' && !btn.bgColor ? 'hover:bg-white/20' : ''}
      >
        {isDefault ? defaultCta : btn.label}
      </Button>
    );

    if (isDefault) {
      return (
        <a key="default" href={defaultLink}>
          {ButtonContent}
        </a>
      );
    }

    if (btn.linkType === 'EXTERNAL_URL') {
      return (
        <a key={btn.id} href={getButtonLink(btn)} target="_blank" rel="noopener noreferrer">
          {ButtonContent}
        </a>
      );
    }

    return (
      <Link key={btn.id} to={getButtonLink(btn)}>
        {ButtonContent}
      </Link>
    );
  };

  return (
    <section
      ref={containerRef}
      className="relative h-[500px] md:h-[600px] overflow-hidden"
      style={{
        backgroundColor: hero.overlay_color || '#000',
      }}
    >
      {/* Default slides (fallback) */}
      {useDefaults && DEFAULT_SLIDES.map((slide, index) => (
        <div
          key={`default-${index}`}
          className={`absolute inset-0 ${getTransitionClass(index)}`}
        >
          <div
            className="absolute inset-0 z-10"
            style={{
              backgroundColor: hero.overlay_color || '#000',
              opacity: hero.overlay_opacity ?? 0.3,
            }}
          />
          <div
            className="absolute inset-0"
            style={hero.parallax ? getParallaxStyle() : {}}
          >
            <img
              src={slide.image}
              alt={slide.headline}
              className="w-full h-full object-cover"
              style={{
                objectFit: 'cover',
                objectPosition: 'center',
              }}
              loading={index === 0 ? "eager" : "lazy"}
            />
          </div>
          {/* Per-slide content with entrance animations */}
          <div className="absolute inset-0 z-20 flex items-center">
            <div className="container mx-auto px-4 md:px-8 lg:px-16">
              {/* Content wrapper with margin for spacing from edges */}
              <div className="max-w-2xl ml-4 md:ml-8 lg:ml-12 mt-16 md:mt-20">
                {/* Title with fade-up animation */}
                <h1
                  className={`text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 transition-all duration-700 ${index === currentSlide
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-8'
                    }`}
                  style={{
                    color: titleColor,
                    transitionDelay: index === currentSlide ? '200ms' : '0ms'
                  }}
                >
                  {slide.headline}
                </h1>
                {/* Subtitle with fade-up animation (delayed) */}
                <p
                  className={`text-xl md:text-2xl mb-8 transition-all duration-700 ${index === currentSlide
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-8'
                    }`}
                  style={{
                    color: subtitleColor,
                    transitionDelay: index === currentSlide ? '400ms' : '0ms'
                  }}
                >
                  {slide.subline}
                </p>
                {/* CTA Button with fade-up animation (more delayed) */}
                <div
                  className={`flex flex-wrap gap-4 transition-all duration-700 ${index === currentSlide
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-8'
                    }`}
                  style={{ transitionDelay: index === currentSlide ? '600ms' : '0ms' }}
                >
                  {renderButton(
                    { id: 'default', label: slide.cta, variant: 'primary', linkType: 'INTERNAL_PAGE', target: {} } as BannerButton,
                    true,
                    slide.cta,
                    slide.link
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Image slides */}
      {!isVideoMode && !useDefaults && images.map((image, index) => (
        <div
          key={image.id}
          className={`absolute inset-0 ${getTransitionClass(index)}`}
        >
          <div
            className="absolute inset-0 z-10"
            style={{
              backgroundColor: hero.overlay_color || '#000',
              opacity: hero.overlay_opacity ?? 0.3,
            }}
          />
          <div
            className="absolute inset-0"
            style={hero.parallax ? getParallaxStyle() : {}}
          >
            <img
              src={image.url}
              alt={image.alt || `Slide ${index + 1}`}
              className="w-full h-full"
              style={{
                objectFit: 'cover',
                objectPosition: 'center',
                width: '100%',
                height: '100%',
              }}
              loading={index === 0 ? "eager" : "lazy"}
            />
          </div>
          {/* Per-slide text content with animations */}
          {(image.headline || image.subline) && (
            <div className="absolute inset-0 z-20 flex items-center">
              <div className="container mx-auto px-4 md:px-8 lg:px-16">
                <div className="max-w-2xl ml-4 md:ml-8 lg:ml-12 mt-16 md:mt-20">
                  {/* Title with fade-up animation */}
                  {image.headline && (
                    <h1
                      className={`text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4 transition-all duration-700 ${index === currentSlide
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-8'
                        }`}
                      style={{
                        color: titleColor,
                        transitionDelay: index === currentSlide ? '200ms' : '0ms'
                      }}
                    >
                      {image.headline}
                    </h1>
                  )}
                  {/* Subtitle with fade-up animation (delayed) */}
                  {image.subline && (
                    <p
                      className={`text-xl md:text-2xl mb-8 transition-all duration-700 ${index === currentSlide
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-8'
                        }`}
                      style={{
                        color: subtitleColor,
                        transitionDelay: index === currentSlide ? '400ms' : '0ms'
                      }}
                    >
                      {image.subline}
                    </p>
                  )}
                  {/* CTA Button with fade-up animation (more delayed) */}
                  {image.ctaText && (
                    <div
                      className={`flex flex-wrap gap-4 transition-all duration-700 ${index === currentSlide
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-8'
                        }`}
                      style={{ transitionDelay: index === currentSlide ? '600ms' : '0ms' }}
                    >
                      <a href={image.ctaLink || '#'}>
                        <Button size="lg" variant="default">
                          {image.ctaText}
                        </Button>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Video slides */}
      {isVideoMode && videos.map((video, index) => (
        <div
          key={video.id}
          className={`absolute inset-0 ${getTransitionClass(index)}`}
        >
          <div
            className="absolute inset-0 z-10"
            style={{
              backgroundColor: hero.overlay_color || '#000',
              opacity: hero.overlay_opacity ?? 0.3,
            }}
          />
          <div
            className="absolute inset-0"
            style={hero.videoSettings?.parallaxEnabled ? getVideoParallaxStyle() : {}}
          >
            <video
              ref={index === currentSlide ? videoRef : null}
              src={video.url}
              poster={video.posterUrl}
              className="w-full h-full"
              style={{
                objectFit: hero.videoSettings?.fitMode || 'cover',
                objectPosition: 'center',
              }}
              muted={hero.videoSettings?.muted ?? true}
              loop={hero.videoSettings?.loop ?? true}
              playsInline
              autoPlay
            />
          </div>
        </div>
      ))}

      {/* Overlay content (only when using configured media WITHOUT per-slide text) */}
      {/* This allows for a global overlay when images don't have individual headlines */}
      {!useDefaults && !images.some(img => img.headline || img.subline) && (overlayTitle || overlaySubtitle || buttons.length > 0) && (
        <div className="absolute inset-0 z-20 flex items-center">
          <div className="container mx-auto px-4 md:px-8 lg:px-16">
            {/* Content wrapper with margin for spacing from edges */}
            <div className="max-w-2xl ml-4 md:ml-8 lg:ml-12 mt-16 md:mt-20">
              {overlayTitle && (
                <h1
                  className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold mb-4"
                  style={{ color: titleColor }}
                >
                  {overlayTitle}
                </h1>
              )}
              {overlaySubtitle && (
                <p
                  className="text-xl md:text-2xl mb-8"
                  style={{ color: subtitleColor }}
                >
                  {overlaySubtitle}
                </p>
              )}
              {showButtons && buttons.length > 0 && (
                <div className="flex flex-wrap gap-4">
                  {buttons.map((btn) => renderButton(btn))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Arrows */}
      {totalSlides > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2 transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-2 transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight className="h-6 w-6 text-white" />
          </button>
        </>
      )}

      {/* Dots */}
      {totalSlides > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-2 h-2 rounded-full transition-all ${index === currentSlide ? "bg-white w-8" : "bg-white/50"
                }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default HeroSlider;
