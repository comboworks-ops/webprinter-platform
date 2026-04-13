import type { CSSProperties } from "react";

import { Truck, Award, Phone, Shield, Clock, Star, Heart, Check } from "lucide-react";

import { useTheme } from "@/lib/themes";
import {
  mergeBrandingWithDefaults,
  type BrandingData,
  type USPItem,
  type USPStripSettings,
} from "@/hooks/useBrandingDraft";

const USP_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  truck: Truck,
  award: Award,
  phone: Phone,
  shield: Shield,
  clock: Clock,
  star: Star,
  heart: Heart,
  check: Check,
};

function getUSPAnimationName(animation?: USPStripSettings["animation"]) {
  switch (animation) {
    case "fade":
      return "usp-fade-in";
    case "slide-down":
      return "usp-slide-down";
    case "scale":
      return "usp-scale-in";
    case "blur":
      return "usp-blur-in";
    case "none":
      return "";
    case "slide-up":
    default:
      return "usp-slide-up";
  }
}

function getUSPItemStyle(settings: USPStripSettings | undefined, index: number): CSSProperties | undefined {
  if (!settings || settings.mode !== "animated") return undefined;

  const animationName = getUSPAnimationName(settings.animation);
  if (!animationName) return undefined;

  return {
    animation: `${animationName} 680ms ease both`,
    animationDelay: `${index * (settings.staggerMs || 120)}ms`,
  };
}

function getUSPGridStyle(settings: USPStripSettings | undefined, itemCount: number): CSSProperties | undefined {
  if (!settings || settings.mode !== "animated") return undefined;

  const minWidth = itemCount >= 16 ? 72 : itemCount >= 10 ? 88 : 116;
  return {
    gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`,
  };
}

function getUSPGridClassName(settings?: USPStripSettings) {
  if (settings?.mode === "animated") {
    return "grid gap-4 md:gap-5 items-start text-center";
  }

  return "grid grid-cols-1 md:grid-cols-3 gap-8 text-center";
}

function getUSPItemClassName(settings?: USPStripSettings) {
  if (settings?.mode === "animated") {
    return "flex flex-col items-center justify-start text-center transition-transform duration-300 hover:-translate-y-0.5";
  }

  return "flex flex-col items-center";
}

function buildUSPGroundCSS(settings?: USPStripSettings): CSSProperties {
  if (!settings) {
    return { backgroundColor: "#0EA5E9" };
  }
  if (settings.useGradient && settings.gradientFrom && settings.gradientTo) {
    const direction = settings.gradientDirection || "to-r";
    return {
      background: `linear-gradient(${direction.replace("to-", "to ").replace("-", " ")}, ${settings.gradientFrom}, ${settings.gradientTo})`,
    };
  }
  return {
    backgroundColor: settings.backgroundColor || "#0EA5E9",
  };
}

interface StorefrontHomeContentProps {
  branding?: Partial<BrandingData> | null;
  tenantName?: string | null;
  isPreviewMode?: boolean;
}

export function StorefrontHomeContent({
  branding,
  tenantName,
  isPreviewMode = false,
}: StorefrontHomeContentProps) {
  const { components: Theme } = useTheme();
  const resolvedBranding = mergeBrandingWithDefaults(branding || {});
  const resolvedTenantName = String(
    resolvedBranding.shop_name || tenantName || "Din Shop",
  ).trim() || "Din Shop";

  const productsSection = resolvedBranding.forside?.productsSection;
  const banner2 = resolvedBranding.forside?.banner2;
  const uspItems = resolvedBranding.uspStrip?.items?.filter((item: USPItem) => item.enabled) || [];
  const showProducts = productsSection?.enabled ?? true;
  const productColumns = productsSection?.columns ?? 4;
  const productButtonConfig = productsSection?.button;
  const productBackgroundConfig = productsSection?.background;
  const productLayoutStyle = productsSection?.layoutStyle;
  const showStorformatTab = productsSection?.showStorformatTab ?? true;
  const featuredProductConfig = productsSection?.featuredProductConfig;

  const headerSettings = resolvedBranding.header || {};
  const transparentOverHero = headerSettings.transparentOverHero ?? true;
  const headerHeight = headerSettings.height === "sm" ? 56 : headerSettings.height === "lg" ? 96 : 72;
  const mainMargin = transparentOverHero ? -headerHeight : 0;

  return (
    <main className="flex-1" style={{ marginTop: mainMargin }}>
      <Theme.HeroSlider
        branding={resolvedBranding}
        tenantName={resolvedTenantName}
        isPreviewMode={isPreviewMode}
      />

      <Theme.Banner2
        branding={resolvedBranding}
        tenantName={resolvedTenantName}
        isPreviewMode={isPreviewMode}
        banner2={banner2 || null}
      />

      <Theme.ProductsSection
        branding={resolvedBranding}
        tenantName={resolvedTenantName}
        isPreviewMode={isPreviewMode}
        showProducts={showProducts}
        showStorformatTab={showStorformatTab}
        productColumns={productColumns}
        productButtonConfig={productButtonConfig}
        productBackgroundConfig={productBackgroundConfig}
        productLayoutStyle={productLayoutStyle}
        featuredProductConfig={featuredProductConfig}
      />

      {resolvedBranding.forside?.contentBlocks?.filter((block) => block.enabled).map((block) => (
        <section
          key={block.id}
          data-branding-id={`content:${block.id}`}
          className="bg-secondary py-8"
        >
          <div
            className={`container mx-auto px-4 ${block.textAlign === "center" ? "text-center" : block.textAlign === "right" ? "text-right" : "text-left"}`}
          >
            <div
              className={`flex flex-col ${block.imageUrl ? (block.imagePosition === "right" ? "md:flex-row" : "md:flex-row-reverse") : ""} gap-8 items-center`}
            >
              <div className={`flex-1 ${block.imageUrl ? "" : "w-full"}`}>
                {block.heading && (
                  <h2
                    className="text-2xl md:text-3xl font-semibold"
                    data-branding-id={`content:${block.id}:heading`}
                    style={{
                      fontFamily: `'${block.headingFont || "Poppins"}', sans-serif`,
                      color: block.headingColor || "#1F2937",
                    }}
                  >
                    {block.heading}
                  </h2>
                )}
                {block.text && (
                  <p
                    className="mt-4"
                    data-branding-id={`content:${block.id}:text`}
                    style={{
                      fontFamily: `'${block.textFont || "Inter"}', sans-serif`,
                      color: block.textColor || "#4B5563",
                    }}
                  >
                    {block.text}
                  </p>
                )}
              </div>

              {block.imageUrl && (
                <div className="flex-1" data-branding-id={`content:${block.id}:image`}>
                  <img
                    src={block.imageUrl}
                    alt={block.heading || "Content image"}
                    className="rounded-lg max-h-64 object-cover mx-auto"
                  />
                </div>
              )}
            </div>
          </div>
        </section>
      ))}

      {resolvedBranding.uspStrip?.enabled !== false && (
        <section
          data-branding-id="usp-strip"
          className="py-12"
          style={{
            ...buildUSPGroundCSS(resolvedBranding.uspStrip),
            color: resolvedBranding.uspStrip?.textColor || "var(--primary-foreground)",
          }}
        >
          {resolvedBranding.uspStrip?.mode === "animated" && (
            <style>{`
              @keyframes usp-fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes usp-slide-up {
                from { opacity: 0; transform: translateY(24px); }
                to { opacity: 1; transform: translateY(0); }
              }
              @keyframes usp-slide-down {
                from { opacity: 0; transform: translateY(-24px); }
                to { opacity: 1; transform: translateY(0); }
              }
              @keyframes usp-scale-in {
                from { opacity: 0; transform: scale(0.94); }
                to { opacity: 1; transform: scale(1); }
              }
              @keyframes usp-blur-in {
                from { opacity: 0; filter: blur(10px); transform: translateY(12px); }
                to { opacity: 1; filter: blur(0); transform: translateY(0); }
              }
            `}</style>
          )}
          <div className="container mx-auto px-4">
            <div
              className={getUSPGridClassName(resolvedBranding.uspStrip)}
              style={getUSPGridStyle(resolvedBranding.uspStrip, uspItems.length)}
            >
              {uspItems.map((item: USPItem, index: number) => {
                const isAnimated = resolvedBranding.uspStrip?.mode === "animated";
                const IconComponent = USP_ICON_MAP[item.icon];
                const hasCustomIcon = item.icon === "custom" && item.customIconUrl;

                return (
                  <div
                    key={item.id}
                    className={getUSPItemClassName(resolvedBranding.uspStrip)}
                    data-branding-id={`usp-strip.item.${item.id}`}
                    style={getUSPItemStyle(resolvedBranding.uspStrip, index)}
                  >
                    <div
                      data-branding-id={`usp-strip.item.${item.id}.icon`}
                      className={isAnimated ? "mb-2 flex min-h-[40px] items-center justify-center" : "mb-4"}
                      style={{ color: resolvedBranding.uspStrip?.iconColor || resolvedBranding.uspStrip?.textColor || "var(--primary-foreground)" }}
                    >
                      {hasCustomIcon ? (
                        <img
                          src={item.customIconUrl}
                          alt={item.title}
                          className={isAnimated ? "h-8 w-auto max-w-full object-contain" : "h-12 w-12 object-contain"}
                        />
                      ) : IconComponent ? (
                        <IconComponent className={isAnimated ? "h-8 w-8" : "h-12 w-12"} />
                      ) : null}
                    </div>

                    {item.title && (
                      <h3
                        data-branding-id={`usp-strip.item.${item.id}.title`}
                        className={isAnimated ? "mb-1 text-sm font-semibold leading-tight" : "text-lg font-semibold mb-2"}
                        style={{
                          fontFamily: resolvedBranding.uspStrip?.titleFont || "inherit",
                          color: resolvedBranding.uspStrip?.titleColor || resolvedBranding.uspStrip?.textColor || "var(--primary-foreground)",
                        }}
                      >
                        {item.title}
                      </h3>
                    )}

                    {item.description && (
                      <p
                        data-branding-id={`usp-strip.item.${item.id}.description`}
                        className={isAnimated ? "text-[11px] leading-snug opacity-90" : "text-sm opacity-90"}
                        style={{
                          fontFamily: resolvedBranding.uspStrip?.descriptionFont || "inherit",
                          color: resolvedBranding.uspStrip?.descriptionColor || resolvedBranding.uspStrip?.textColor || "var(--primary-foreground)",
                        }}
                      >
                        {item.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {resolvedBranding.seoContent?.enabled !== false && (
        <section
          data-branding-id="seo-content"
          className="py-16"
          style={{
            backgroundColor: resolvedBranding.seoContent?.backgroundColor || "var(--secondary)",
          }}
        >
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto space-y-8">
              {resolvedBranding.seoContent?.items?.filter((item: any) => item.enabled).map((item: any) => (
                <div key={item.id} data-branding-id={`seo-content.item.${item.id}`}>
                  <h2
                    data-branding-id={`seo-content.item.${item.id}.heading`}
                    className="text-xl font-heading font-semibold mb-3"
                  >
                    {item.heading}
                  </h2>
                  <p
                    data-branding-id={`seo-content.item.${item.id}.text`}
                    className="text-muted-foreground leading-relaxed"
                  >
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
