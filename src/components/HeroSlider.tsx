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
  type HeroTextAnimation,
  DEFAULT_HERO
} from "@/hooks/useBrandingDraft";

// Extended button type with color settings (matching BannerEditor)
interface BannerButton extends HeroButton {
  textColor?: string;
  bgColor?: string;
  bgOpacity?: number;
}

// Extended overlay settings with text colors and fonts
interface ExtendedOverlay {
  title?: string;
  subtitle?: string;
  titleColor?: string;
  subtitleColor?: string;
  titleFontId?: string;       // Font for banner title
  subtitleFontId?: string;    // Font for banner subtitle
  usePerBannerStyling?: boolean; // When true, use per-slide font/color
  showButtons?: boolean;
  buttons?: BannerButton[];
}

// Fallback images (used when no branding images are configured)
const heroPrinting = "/hero-print.jpg";
const heroBanners = "/hero-banner.jpg";
const heroFlyers = "/hero-flyer.jpg";

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

// Helper to darken a hex color by a percentage
function darkenColor(hex: string, percent: number): string {
  if (!hex || !hex.startsWith('#')) return hex;

  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - Math.round(255 * (percent / 100)));
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - Math.round(255 * (percent / 100)));
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - Math.round(255 * (percent / 100)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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

  // Check if banner should be shown (from forside settings)
  const showBanner = branding?.forside?.showBanner ?? true;

  // Helper to get text animation classes
  const getTextAnimationClass = (animation: HeroTextAnimation | string, isActive: boolean) => {
    const baseClasses = "transition-all duration-700";

    if (animation === 'none') {
      return ""; // No transition classes
    }

    // Active state (showing)
    if (isActive) {
      return `${baseClasses} opacity-100 translate-y-0 scale-100 blur-none`;
    }

    // Inactive state (hidden) based on animation type
    console.log('Animation:', animation);
    switch (animation) {
      case 'fade':
        return `${baseClasses} opacity-0`;
      case 'slide-down':
        return `${baseClasses} opacity-0 -translate-y-8`;
      case 'scale':
        return `${baseClasses} opacity-0 scale-90`;
      case 'blur':
        return `${baseClasses} opacity-0 blur-sm`;
      case 'slide-up':
      default:
        return `${baseClasses} opacity-0 translate-y-8`;
    }
  };

  // Get hero settings from props, branding context, or defaults
  const hero: HeroSettings = heroSettings || (branding?.hero as HeroSettings) || DEFAULT_HERO;

  // Get header settings to check transparentOverHero
  const headerSettings = (branding?.header || {}) as { transparentOverHero?: boolean; height?: string };
  const transparentOverHero = headerSettings.transparentOverHero ?? true;

  // Calculate top margin when header is NOT transparent over hero
  const headerHeight = headerSettings.height === 'sm' ? 56 : headerSettings.height === 'lg' ? 96 : 72;

  // Get extended overlay settings
  const extendedOverlay = (hero.overlay || {}) as ExtendedOverlay;

  // Important: We only use defaults if the configuration is missing (undefined).
  // An empty array [] is treated as an intentional empty state.
  const isVideoMode = hero.mediaType === 'video';

  // Use defaults ONLY if neither images nor media nor videos is defined at all
  const useDefaults = !isVideoMode &&
    hero.images === undefined &&
    (hero.media === undefined || hero.media.length === 0) &&
    (hero.videos === undefined || hero.videos.length === 0);

  const images: HeroImage[] = isVideoMode ? [] : (hero.images || (hero.media || []).map((url, i) => ({ id: `legacy-${i}`, url, sortOrder: i })));
  const videos: HeroVideo[] = hero.videos || [];

  const mediaItems = isVideoMode ? videos : images;
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

  // Overlay title and subtitle with colors and fonts
  const overlayTitle = extendedOverlay.title;
  const overlaySubtitle = extendedOverlay.subtitle;
  const usePerBannerStyling = extendedOverlay.usePerBannerStyling || false;

  // Global styling (used when per-banner is OFF or as fallback)
  const globalTitleColor = extendedOverlay.titleColor || '#FFFFFF';
  const globalSubtitleColor = extendedOverlay.subtitleColor || 'rgba(255, 255, 255, 0.9)';
  const globalTitleFontId = extendedOverlay.titleFontId || 'Poppins';
  const globalSubtitleFontId = extendedOverlay.subtitleFontId || 'Inter';

  // Helper functions to get per-slide or global styling
  const getSlideStyles = (slideIndex: number) => {
    const slide = images[slideIndex] as any;
    if (usePerBannerStyling && slide) {
      return {
        titleColor: slide.titleColor || globalTitleColor,
        subtitleColor: slide.subtitleColor || globalSubtitleColor,
        titleFontId: slide.titleFontId || globalTitleFontId,
        subtitleFontId: slide.subtitleFontId || globalSubtitleFontId,
      };
    }
    return {
      titleColor: globalTitleColor,
      subtitleColor: globalSubtitleColor,
      titleFontId: globalTitleFontId,
      subtitleFontId: globalSubtitleFontId,
    };
  };

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
    const bgColor = btn.bgColor || '#0EA5E9';
    const bgHoverColor = btn.bgHoverColor || (btn.bgColor ? darkenColor(btn.bgColor, 15) : '#0284C7');

    const buttonStyle: React.CSSProperties = {
      '--btn-bg': !isDefault && btn.bgColor ? hexToRgba(btn.bgColor, btn.bgOpacity ?? 1) : undefined,
      '--btn-hover-bg': !isDefault ? bgHoverColor : undefined,
    } as React.CSSProperties;

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

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDefault && btn.bgColor) {
        e.currentTarget.style.backgroundColor = bgHoverColor;
      }
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (!isDefault && btn.bgColor) {
        e.currentTarget.style.backgroundColor = hexToRgba(btn.bgColor, btn.bgOpacity ?? 1);
      }
    };

    const ButtonContent = (
      <Button
        size="lg"
        variant={btn.variant === 'secondary' ? 'outline' : 'default'}
        style={buttonStyle}
        className={btn.variant === 'secondary' && !btn.bgColor ? 'hover:bg-white/20' : ''}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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

  // Overlay rendering logic
  const usePerBannerOverlay = (hero as any).usePerBannerOverlay || false;

  const getSlideOverlayStyles = (slideIndex: number) => {
    const slide = images[slideIndex] as any;
    if (usePerBannerOverlay && slide) {
      return {
        backgroundColor: slide.overlayColor || hero.overlay_color || '#000',
        opacity: slide.overlayOpacity ?? hero.overlay_opacity ?? 0.3
      };
    }
    return {
      backgroundColor: hero.overlay_color || '#000',
      opacity: hero.overlay_opacity ?? 0.3
    };
  };

  // If banner is hidden, render nothing (after all hooks are called)
  if (!showBanner) {
    return null;
  }

  // If no slides are configured and we are not in defaults mode, return null
  if (!useDefaults && totalSlides === 0) {
    return null;
  }

  return (
    <section
      ref={containerRef}
      data-branding-id="forside.hero"
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
                  className={`text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 transition-all duration-700 ${index === currentSlide
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-8'
                    }`}
                  style={{
                    color: getSlideStyles(index).titleColor,
                    fontFamily: `'${getSlideStyles(index).titleFontId}', sans-serif`,
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
                    color: getSlideStyles(index).subtitleColor,
                    fontFamily: `'${getSlideStyles(index).subtitleFontId}', sans-serif`,
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
            style={getSlideOverlayStyles(index)}
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
                  {/* Title with animation */}
                  {image.headline && (
                    <h1
                      className={`text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 ${getTextAnimationClass(image.textAnimation || 'slide-up', index === currentSlide)
                        }`}
                      style={{
                        color: getSlideStyles(index).titleColor,
                        fontFamily: `'${getSlideStyles(index).titleFontId}', sans-serif`,
                        transitionDelay: index === currentSlide ? '200ms' : '0ms'
                      }}
                    >
                      {image.headline}
                    </h1>
                  )}
                  {/* Subtitle with animation (delayed) */}
                  {image.subline && (
                    <p
                      className={`text-xl md:text-2xl mb-8 ${getTextAnimationClass(image.textAnimation || 'slide-up', index === currentSlide)
                        }`}
                      style={{
                        color: getSlideStyles(index).subtitleColor,
                        fontFamily: `'${getSlideStyles(index).subtitleFontId}', sans-serif`,
                        transitionDelay: index === currentSlide ? '400ms' : '0ms'
                      }}
                    >
                      {image.subline}
                    </p>
                  )}
                  {/* CTA Buttons with animation (more delayed) */}
                  {showButtons && (image.buttons !== undefined ? image.buttons.length > 0 : image.ctaText) && (
                    <div
                      className={`flex flex-wrap gap-4 ${getTextAnimationClass(image.textAnimation || 'slide-up', index === currentSlide)
                        }`}
                      style={{ transitionDelay: index === currentSlide ? '600ms' : '0ms' }}
                    >
                      {/* Render buttons array if it exists (even if empty, don't fallback) */}
                      {image.buttons !== undefined ? (
                        image.buttons.map(btn => renderButton(btn))
                      ) : image.ctaText ? (
                        /* Legacy fallback only if buttons array is undefined */
                        renderButton(
                          { id: 'default', label: image.ctaText, variant: 'primary', linkType: 'INTERNAL_PAGE', target: {} } as any,
                          true,
                          image.ctaText,
                          image.ctaLink
                        )
                      ) : null}
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
                  className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4"
                  style={{ color: globalTitleColor, fontFamily: `'${globalTitleFontId}', sans-serif` }}
                >
                  {overlayTitle}
                </h1>
              )}
              {overlaySubtitle && (
                <p
                  className="text-xl md:text-2xl mb-8"
                  style={{ color: globalSubtitleColor, fontFamily: `'${globalSubtitleFontId}', sans-serif` }}
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
