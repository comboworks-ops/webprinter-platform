import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import { useShopSettings } from "@/hooks/useShopSettings";
import { appendStorefrontTenantContext } from "@/lib/storefrontTenantContext";
import {
  type HeroSettings,
  type HeroImage,
  type HeroVideo,
  type HeroButton,
  type HeroTextAnimation,
  type HeroSlideTransition,
  type HeroParallaxStyle,
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Helper to get button link
function getButtonLink(button: BannerButton): string {
  switch (button.linkType) {
    case 'ALL_PRODUCTS':
      return appendStorefrontTenantContext('/shop');
    case 'PRODUCT':
      return button.target?.productSlug
        ? appendStorefrontTenantContext(`/produkt/${button.target.productSlug}`)
        : appendStorefrontTenantContext('/shop');
    case 'INTERNAL_PAGE':
      return appendStorefrontTenantContext(button.target?.path || '/');
    case 'EXTERNAL_URL':
      return button.target?.url || '#';
    default:
      return appendStorefrontTenantContext('/shop');
  }
}

// Helper to convert hex color to rgba
function hexToRgba(hex: string, opacity: number): string {
  if (!hex || !hex.startsWith('#')) return hex;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function getColorLuminance(color?: string | null): number | null {
  const normalized = String(color || "").trim();
  const shortMatch = normalized.match(/^#([0-9a-f]{3})$/i);
  const longMatch = normalized.match(/^#([0-9a-f]{6})$/i);
  const rgbMatch = normalized.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  const channels = shortMatch || longMatch
    ? [0, 2, 4].map((index) => {
        const hex = shortMatch
          ? shortMatch[1].split("").map((part) => `${part}${part}`).join("")
          : longMatch![1];
        return parseInt(hex.slice(index, index + 2), 16);
      })
    : rgbMatch
      ? [Number(rgbMatch[1]), Number(rgbMatch[2]), Number(rgbMatch[3])]
      : null;

  if (!channels) return null;
  const linear = channels.map((channel) => {
    const value = Math.max(0, Math.min(255, channel)) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function ensureReadableTextColor(background: string, preferred = "#FFFFFF"): string {
  const bg = getColorLuminance(background);
  const text = getColorLuminance(preferred);
  if (bg === null || text === null) return preferred;
  const contrast = (Math.max(bg, text) + 0.05) / (Math.min(bg, text) + 0.05);
  if (contrast >= 4.5) return preferred;
  return bg > 0.48 ? "#0F172A" : "#FFFFFF";
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
  const { branding: previewBranding, isPreviewMode } = usePreviewBranding();
  const shopSettings = useShopSettings();
  const branding = (isPreviewMode && previewBranding)
    ? previewBranding
    : shopSettings.data?.branding;
  const [currentSlide, setCurrentSlide] = useState(0);
  const [scrollY, setScrollY] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  // Check if banner should be shown (from forside settings)
  const showBanner = branding?.forside?.showBanner ?? true;

  // Helper to get text animation classes
  const getTextAnimationClass = (animation: HeroTextAnimation | string, isActive: boolean) => {
    if (prefersReducedMotion) {
      return isActive ? "opacity-100" : "opacity-0";
    }

    const baseClasses = "transition-all duration-700 ease-out";

    if (animation === 'none') {
      return ""; // No transition classes
    }

    // Active state (showing)
    if (isActive) {
      return `${baseClasses} opacity-100 translate-y-0 scale-100 blur-none`;
    }

    // Inactive state (hidden) based on animation type
    switch (animation) {
      case 'fade':
        return `${baseClasses} opacity-0`;
      case 'slide-down':
        return `${baseClasses} opacity-0 -translate-y-8`;
      case 'scale':
        return `${baseClasses} opacity-0 scale-90`;
      case 'blur':
        return `${baseClasses} opacity-0 blur-sm`;
      case 'reveal-up':
        return `${baseClasses} opacity-0 translate-y-10 scale-[0.98]`;
      case 'soft-mask':
        return `${baseClasses} opacity-0 translate-y-4 blur-[1px]`;
      case 'stagger-rise':
        return `${baseClasses} opacity-0 translate-y-7 scale-[0.99]`;
      case 'cinematic':
        return `${baseClasses} opacity-0 scale-95 blur-[2px]`;
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
  const primaryHeroButton = (extendedOverlay.buttons || []).find((button) => button.variant === 'primary') || (extendedOverlay.buttons || [])[0];

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
    if (prefersReducedMotion || (!hero.parallax && !hero.videoSettings?.parallaxEnabled)) return;

    const handleScroll = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const scrollProgress = -rect.top / (rect.height + window.innerHeight);
        const intensity = clamp((hero.parallaxIntensity ?? 30) / 100, 0.1, 0.6);
        setScrollY(scrollProgress * intensity * rect.height);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hero.parallax, hero.videoSettings?.parallaxEnabled, hero.parallaxIntensity, prefersReducedMotion]);

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

  const getTransitionClass = (index: number) => {
    const isActive = index === currentSlide;
    return isActive ? 'z-10 pointer-events-auto' : 'z-0 pointer-events-none';
  };

  const getSlideTransitionStyle = (index: number): React.CSSProperties => {
    const isActive = index === currentSlide;
    const direction = index < currentSlide ? -1 : 1;
    const transition = (hero.slideshow?.transition || 'fade') as HeroSlideTransition;

    if (prefersReducedMotion) {
      return {
        opacity: isActive ? 1 : 0,
        transition: 'opacity 120ms ease-out',
      };
    }

    const baseTransition = 'opacity 900ms cubic-bezier(0.16, 1, 0.3, 1), transform 950ms cubic-bezier(0.16, 1, 0.3, 1), clip-path 950ms cubic-bezier(0.16, 1, 0.3, 1), filter 700ms ease-out';
    const common: React.CSSProperties = {
      opacity: isActive ? 1 : 0,
      transition: baseTransition,
      willChange: 'opacity, transform, clip-path, filter',
    };

    switch (transition) {
      case 'slide':
        return {
          ...common,
          transform: isActive ? 'translate3d(0,0,0)' : `translate3d(${direction * 100}%,0,0)`,
        };
      case 'zoom-fade':
        return {
          ...common,
          transform: isActive ? 'scale(1)' : 'scale(1.055)',
        };
      case 'cross-zoom':
        return {
          ...common,
          transform: isActive ? 'scale(1)' : `scale(${direction < 0 ? 0.985 : 1.045})`,
          filter: isActive ? 'blur(0px)' : 'blur(1.5px)',
        };
      case 'soft-wipe':
        return {
          ...common,
          clipPath: isActive
            ? 'inset(0 0 0 0)'
            : direction < 0
              ? 'inset(0 0 0 100%)'
              : 'inset(0 100% 0 0)',
        };
      case 'ken-burns':
        return {
          ...common,
          transform: isActive ? 'scale(1.035)' : 'scale(1)',
        };
      case 'fade':
      default:
        return common;
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
    if (!hero.parallax || prefersReducedMotion) return {};
    const style = (hero.parallaxStyle || 'classic') as HeroParallaxStyle;
    const scaleByStyle: Record<HeroParallaxStyle, number> = {
      'classic': 1.18,
      'soft-depth': 1.12,
      'slow-zoom': 1.08 + Math.min(Math.abs(scrollY) / 6000, 0.035),
      'fixed-focus': 1.06,
    };
    const movementByStyle: Record<HeroParallaxStyle, number> = {
      'classic': 1,
      'soft-depth': 0.62,
      'slow-zoom': 0.36,
      'fixed-focus': 0.18,
    };
    return {
      transform: `translate3d(0, ${scrollY * movementByStyle[style]}px, 0) scale(${scaleByStyle[style]})`,
      willChange: 'transform',
      transition: 'transform 120ms ease-out',
    };
  };

  // Video parallax style
  const getVideoParallaxStyle = () => {
    if (!hero.videoSettings?.parallaxEnabled || prefersReducedMotion) return {};
    const style = (hero.parallaxStyle || 'classic') as HeroParallaxStyle;
    const scaleByStyle: Record<HeroParallaxStyle, number> = {
      'classic': 1.16,
      'soft-depth': 1.1,
      'slow-zoom': 1.06 + Math.min(Math.abs(scrollY) / 7000, 0.03),
      'fixed-focus': 1.04,
    };
    const movementByStyle: Record<HeroParallaxStyle, number> = {
      'classic': 0.9,
      'soft-depth': 0.55,
      'slow-zoom': 0.28,
      'fixed-focus': 0.14,
    };
    return {
      transform: `translate3d(0, ${scrollY * movementByStyle[style]}px, 0) scale(${scaleByStyle[style]})`,
      willChange: 'transform',
      transition: 'transform 120ms ease-out',
    };
  };

  // Render button with custom colors
  const renderButton = (btn: BannerButton, isDefault = false, defaultCta?: string, defaultLink?: string) => {
    const bgColor = btn.bgColor || '#0EA5E9';
    const bgHoverColor = btn.bgHoverColor || (btn.bgColor ? darkenColor(btn.bgColor, 15) : '#0284C7');
    const readableTextColor = btn.bgColor
      ? ensureReadableTextColor(bgColor, btn.textColor || '#FFFFFF')
      : (btn.textColor || '#FFFFFF');
    const readableHoverTextColor = btn.bgColor
      ? ensureReadableTextColor(bgHoverColor, readableTextColor)
      : readableTextColor;

    const buttonStyle: React.CSSProperties = {
      '--btn-bg': btn.bgColor ? hexToRgba(btn.bgColor, btn.bgOpacity ?? 1) : undefined,
      '--btn-hover-bg': bgHoverColor,
      color: readableTextColor,
    } as React.CSSProperties;

    if (btn.bgColor) {
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
      if (btn.bgColor) {
        e.currentTarget.style.backgroundColor = bgHoverColor;
        e.currentTarget.style.color = readableHoverTextColor;
      }
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (btn.bgColor) {
        e.currentTarget.style.backgroundColor = hexToRgba(btn.bgColor, btn.bgOpacity ?? 1);
        e.currentTarget.style.color = readableTextColor;
      }
    };

    const ButtonContent = (
      <Button
        size="lg"
        variant={btn.variant === 'secondary' ? 'outline' : 'default'}
        data-branding-id="forside.hero.button"
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
      data-branding-id="forside.hero.media"
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
          style={getSlideTransitionStyle(index)}
        >
          <div
            data-branding-id="forside.hero.overlay"
            className="absolute inset-0 z-10"
            style={{
              backgroundColor: hero.overlay_color || '#000',
              opacity: hero.overlay_opacity ?? 0.3,
            }}
          />
          <div
            data-branding-id="forside.hero.media"
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
                  data-branding-id="forside.hero.title"
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
                  data-branding-id="forside.hero.subtitle"
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
          style={getSlideTransitionStyle(index)}
        >
          <div
            data-branding-id="forside.hero.overlay"
            className="absolute inset-0 z-10"
            style={getSlideOverlayStyles(index)}
          />
          <div
            data-branding-id="forside.hero.media"
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
                      data-branding-id="forside.hero.title"
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
                      data-branding-id="forside.hero.subtitle"
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
	                          {
	                            id: 'default',
	                            label: image.ctaText,
	                            variant: 'primary',
	                            linkType: 'INTERNAL_PAGE',
	                            target: {},
	                            textColor: primaryHeroButton?.textColor,
	                            bgColor: primaryHeroButton?.bgColor,
	                            bgHoverColor: primaryHeroButton?.bgHoverColor,
	                            bgOpacity: primaryHeroButton?.bgOpacity,
	                          } as any,
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
          style={getSlideTransitionStyle(index)}
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
                  data-branding-id="forside.hero.title"
                  className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4"
                  style={{ color: globalTitleColor, fontFamily: `'${globalTitleFontId}', sans-serif` }}
                >
                  {overlayTitle}
                </h1>
              )}
              {overlaySubtitle && (
                <p
                  data-branding-id="forside.hero.subtitle"
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
