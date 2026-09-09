import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useShopSettings } from "@/hooks/useShopSettings";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import {
  templateMatchesSelectedConfiguration,
  type ProductTemplateFile,
} from "@/lib/designer/productTemplateLinks";
import {
  ProductFormatGuideGraphic,
  type ProductFormatGuideData,
} from "@/components/product-price-page/ProductFormatGuide";
import {
  normalizeProductInfoGalleryLayout,
  normalizeProductInfoShowWhen,
  productInfoBlockMatchesSelection,
  type ProductInfoGalleryLayout,
  type ProductInfoSelectedSectionValues,
  type ProductInfoShowWhenCondition,
} from "@/lib/storefront/productInfoVisibility";

type TemplateFile = ProductTemplateFile;

type StaticProductInfoProps = {
  productId: string;
  selectedFormat?: string;
  selectedFormatLabel?: string;
  selectedOptionLabels?: string[];
  selectedSectionValues?: ProductInfoSelectedSectionValues;
  showTemplateDownloads?: boolean;
  formatGuide?: ProductFormatGuideData | null;
  productData?: {
    name?: string | null;
    slug?: string | null;
    about_title?: string | null;
    about_description?: string | null;
    about_image_url?: string | null;
    template_files?: ProductTemplateFile[] | null;
    technical_specs?: unknown;
  } | null;
};

type GalleryEffect = "fade" | "fade-zoom" | "fade-up";
type ProductInfoGallerySize = "compact" | "standard" | "large" | "full";

const normalizeProductInfoGallerySize = (value: unknown): ProductInfoGallerySize => {
  if (value === "compact" || value === "large" || value === "full") return value;
  return "standard";
};

type ProductInfoBlock = {
  id: string;
  type: "text" | "image" | "gallery" | "guide";
  title?: string;
  text?: string;
  imageUrl?: string;
  caption?: string;
  images?: string[];
  effect?: GalleryEffect;
  intervalMs?: number;
  format?: string;
  configuration?: string;
  placement?: "left" | "right";
  galleryLayout?: ProductInfoGalleryLayout;
  gallerySize?: ProductInfoGallerySize;
  showWhen?: ProductInfoShowWhenCondition[];
};

type ProductInfoV2Config = {
  useSections: boolean;
  imagePosition: "above" | "below" | "left" | "right";
  blocks: ProductInfoBlock[];
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const readProductInfoV2 = (technicalSpecs: unknown): ProductInfoV2Config => {
  if (!isObjectRecord(technicalSpecs)) {
    return { useSections: false, imagePosition: "above", blocks: [] };
  }

  const raw = technicalSpecs.product_page_info_v2;
  if (!isObjectRecord(raw)) {
    return { useSections: false, imagePosition: "above", blocks: [] };
  }

  const rawBlocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const blocks: ProductInfoBlock[] = rawBlocks
    .map((item, index) => {
      if (!isObjectRecord(item)) return null;
      const type = item.type;
      if (type !== "text" && type !== "image" && type !== "gallery" && type !== "guide") return null;
      return {
        id: typeof item.id === "string" && item.id ? item.id : `block-${index + 1}`,
        type,
        title: typeof item.title === "string" ? item.title : "",
        text: typeof item.text === "string" ? item.text : "",
        imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : "",
        caption: typeof item.caption === "string" ? item.caption : "",
        images: Array.isArray(item.images)
          ? item.images.filter((url): url is string => typeof url === "string" && url.length > 0)
          : [],
        effect: item.effect === "fade-zoom" || item.effect === "fade-up" ? item.effect : "fade",
        intervalMs: typeof item.intervalMs === "number" && Number.isFinite(item.intervalMs)
          ? Math.max(2000, Math.min(12000, Math.round(item.intervalMs)))
          : 4500,
        format: typeof item.format === "string" ? item.format : "",
        configuration: typeof item.configuration === "string" ? item.configuration : "",
        placement: item.placement === "right" ? "right" : "left",
        galleryLayout: normalizeProductInfoGalleryLayout(item.galleryLayout),
        gallerySize: normalizeProductInfoGallerySize(item.gallerySize),
        showWhen: normalizeProductInfoShowWhen(item.showWhen),
      } as ProductInfoBlock;
    })
    .filter(Boolean) as ProductInfoBlock[];

  return {
    useSections: raw.useSections === true,
    imagePosition: raw.imagePosition === "below" ? "below" : "above",
    blocks,
  };
};

function ProductInfoGallery({
  images,
  effect,
  intervalMs,
  title,
  size,
}: {
  images: string[];
  effect: GalleryEffect;
  intervalMs: number;
  title: string;
  size: ProductInfoGallerySize;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [images]);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % images.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [images.length, intervalMs]);

  if (images.length === 0) return null;

  const containerClassName = {
    compact: "max-w-2xl",
    standard: "max-w-3xl",
    large: "max-w-5xl",
    full: "max-w-none",
  }[size];
  const frameClassName = {
    compact: "h-52 md:h-64",
    standard: "h-64 md:h-80",
    large: "h-72 md:h-96",
    full: "h-80 md:h-[30rem]",
  }[size];

  return (
    <div className={cn("mx-auto w-full min-w-0", containerClassName)} aria-label={title} role="region">
      <div className={cn("relative overflow-hidden bg-white", frameClassName)}>
        {images.map((url, index) => {
          const active = index === activeIndex;
          return (
            <img
              key={`${url}-${index}`}
              src={url}
              alt={`${title} – billede ${index + 1}`}
              aria-hidden={!active}
              loading={index === 0 ? "eager" : "lazy"}
              className={cn(
                "absolute inset-0 h-full w-full object-contain transition-all duration-700 ease-out motion-reduce:transition-none",
                active ? "opacity-100" : "opacity-0",
                effect === "fade-zoom" && (active ? "scale-100" : "scale-105"),
                effect === "fade-up" && (active ? "translate-y-0" : "translate-y-3")
              )}
            />
          );
        })}
      </div>
      {images.length > 1 && (
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {images.map((_, index) => (
            <span
              key={`dot-${index}`}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-all",
                index === activeIndex ? "bg-primary w-4" : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductInfoGalleryGrid({
  images,
  title,
  size,
}: {
  images: string[];
  title: string;
  size: ProductInfoGallerySize;
}) {
  if (images.length === 0) return null;

  const containerClassName = {
    compact: "max-w-3xl gap-2",
    standard: "max-w-5xl gap-3",
    large: "max-w-6xl gap-4",
    full: "max-w-none gap-5",
  }[size];
  const figurePaddingClassName = size === "compact" ? "p-1.5" : size === "full" ? "p-3" : "p-2";

  return (
    <div
      className={cn(
        "mx-auto grid w-full min-w-0 grid-cols-1 overflow-hidden sm:grid-cols-3",
        containerClassName,
      )}
      role="list"
      aria-label={title}
    >
      {images.map((url, index) => (
        <figure
          key={`${url}-${index}`}
          className={cn(
            "min-w-0 overflow-hidden rounded-md border border-border/60 bg-white",
            figurePaddingClassName,
          )}
          role="listitem"
        >
          <img
            src={url}
            alt={`${title} – eksempel ${index + 1}`}
            width={720}
            height={720}
            loading="lazy"
            className="aspect-square h-auto w-full bg-white object-contain"
          />
        </figure>
      ))}
    </div>
  );
}

export function StaticProductInfo({
  productId,
  selectedFormat,
  selectedFormatLabel,
  selectedOptionLabels = [],
  selectedSectionValues = {},
  showTemplateDownloads = true,
  formatGuide = null,
  productData = null,
}: StaticProductInfoProps) {
  const shopSettings = useShopSettings();
  const { branding: previewBranding, isPreviewMode } = usePreviewBranding();
  const activeBranding = (isPreviewMode && previewBranding) ? previewBranding : shopSettings.data?.branding;
  const infoStyle = (activeBranding as any)?.productPage?.infoSection ?? {};
  const globalColors = (activeBranding as any)?.colors ?? {};

  // Resolve styles with fallbacks
  const resolvedBg = infoStyle.bgColor || undefined;
  const resolvedBorderRadius = infoStyle.bgBorderRadius ?? 12;
  const resolvedBorderColor = infoStyle.borderColor || undefined;
  const resolvedBorderWidth = infoStyle.borderWidthPx ?? 0;
  const resolvedPadding = infoStyle.paddingPx ?? 24;
  const resolvedTitleFont = infoStyle.titleFont || undefined;
  const resolvedTitleColor = infoStyle.titleColor || globalColors.headingText || undefined;
  const resolvedTitleSize = infoStyle.titleSizePx ? `${infoStyle.titleSizePx}px` : undefined;
  const resolvedTitleWeight = infoStyle.titleWeight || "600";
  const resolvedTextFont = infoStyle.textFont || undefined;
  const resolvedTextColor = infoStyle.textColor || globalColors.bodyText || undefined;
  const resolvedTextSize = infoStyle.textSizePx ? `${infoStyle.textSizePx}px` : undefined;
  const resolvedLineHeight = infoStyle.lineHeight ?? 1.6;
  const imagePos: "above" | "below" | "left" | "right" | "corners" = infoStyle.imagePosition || "above";
  const imageWidthPct = infoStyle.imageWidthPct ?? 40;
  const imageCornerSizePx = infoStyle.imageCornerSizePx ?? 80;
  const imageBorderRadiusPx = infoStyle.imageBorderRadiusPx ?? 8;
  const galleryEnabled = infoStyle.galleryEnabled ?? false;
  const galleryPosition = infoStyle.galleryPosition || "bottom";
  const galleryHeightPx = infoStyle.galleryHeightPx ?? 200;
  const galleryBorderRadiusPx = infoStyle.galleryBorderRadiusPx ?? 8;
  const galleryImages = infoStyle.galleryImages || [];
  const galleryIntervalMs = infoStyle.galleryIntervalMs ?? 4500;
  const showHeader = infoStyle.showHeader ?? true;
  const headerText = infoStyle.headerText || "Om produktet";
  const descriptionText = infoStyle.descriptionText || "";
  const brandingImageUrl = infoStyle.imageUrl || "";

  const [aboutData, setAboutData] = useState<{
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    productName: string | null;
    slug: string | null;
    templates: TemplateFile[];
    infoV2: ProductInfoV2Config;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAboutData() {
      if (productData) {
        setAboutData({
          title: productData.about_title || null,
          description: productData.about_description || null,
          imageUrl: productData.about_image_url || null,
          productName: productData.name || null,
          slug: productData.slug || null,
          templates: Array.isArray(productData.template_files) ? productData.template_files : [],
          infoV2: readProductInfoV2(productData.technical_specs),
        });
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId);

        let query = supabase
          .from('products')
          .select('name, slug, about_title, about_description, about_image_url, template_files, technical_specs');

        query = isUuid
          ? query.eq('id', productId)
          : query.eq('slug', productId).limit(1);

        const { data, error } = await query.maybeSingle();

        if (error) {
          console.error('Error fetching about data:', error);
          return;
        }

        if (data) {
          const infoV2 = readProductInfoV2(data.technical_specs);
          setAboutData({
            title: data.about_title,
            description: data.about_description,
            imageUrl: data.about_image_url,
            productName: data.name,
            slug: data.slug,
            templates: (data.template_files as TemplateFile[]) || [],
            infoV2,
          });
        }
      } catch (error) {
        console.error('Error fetching about data:', error);
      } finally {
        setLoading(false);
      }
    }

    if (productId) {
      fetchAboutData();
    }
  }, [productData, productId]);

  const availableTemplates = aboutData?.templates || [];

  // Filter templates by format if selectedFormat is provided
  const filteredTemplates = availableTemplates.filter(template => {
    return templateMatchesSelectedConfiguration(
      template,
      selectedFormat,
      selectedFormatLabel,
      selectedOptionLabels,
    );
  });

  const visibleInfoBlocks = useMemo(() => {
    const blocks = aboutData?.infoV2?.blocks || [];
    const selectionMatchedBlocks = blocks.filter((block) => (
      productInfoBlockMatchesSelection(block.showWhen, selectedSectionValues)
    ));
    const matchingGuides = selectionMatchedBlocks.filter((block) => {
      if (block.type !== "guide") return false;
      return templateMatchesSelectedConfiguration(
        {
          name: block.title || "Filguide",
          url: block.imageUrl || "generated-guide",
          format: block.format || null,
          configuration: block.configuration || null,
        },
        selectedFormat,
        selectedFormatLabel,
        selectedOptionLabels,
      );
    });
    const hasSpecificGuide = matchingGuides.some((block) => Boolean(block.format || block.configuration));

    return selectionMatchedBlocks.filter((block) => {
      if (block.type !== "guide") return true;
      if (!matchingGuides.some((guide) => guide.id === block.id)) return false;
      return !hasSpecificGuide || Boolean(block.format || block.configuration);
    });
  }, [
    aboutData?.infoV2?.blocks,
    selectedFormat,
    selectedFormatLabel,
    selectedOptionLabels,
    selectedSectionValues,
  ]);

  const hasRenderableBlocks = useMemo(() => {
    if (!aboutData?.infoV2?.useSections) return false;
    return visibleInfoBlocks.some((block) => {
      if (block.type === "text") return !!(block.title || block.text);
      if (block.type === "image") return !!block.imageUrl;
      if (block.type === "gallery") return (block.images || []).length > 0;
      if (block.type === "guide") return !!(block.imageUrl || formatGuide);
      return false;
    });
  }, [aboutData?.infoV2?.useSections, formatGuide, visibleInfoBlocks]);

  // Don't render if no about data exists
  if (loading) {
    return null;
  }

  const hasGallery = galleryEnabled && galleryImages.length > 0;
  if (!aboutData?.title && !aboutData?.description && !descriptionText && !aboutData?.imageUrl && !brandingImageUrl && !hasRenderableBlocks && !hasGallery && filteredTemplates.length === 0) {
    return null;
  }

  const cardStyle: React.CSSProperties = {
    ...(resolvedBg ? { backgroundColor: resolvedBg } : {}),
    borderRadius: resolvedBorderRadius ? `${resolvedBorderRadius}px` : undefined,
    borderWidth: resolvedBorderWidth ? `${resolvedBorderWidth}px` : undefined,
    borderStyle: resolvedBorderWidth ? 'solid' : undefined,
    borderColor: resolvedBorderColor || undefined,
    padding: resolvedPadding,
  };

  const titleStyle: React.CSSProperties = {
    fontFamily: resolvedTitleFont || undefined,
    color: resolvedTitleColor || undefined,
    fontSize: resolvedTitleSize || undefined,
    fontWeight: resolvedTitleWeight,
  };

  const textStyle: React.CSSProperties = {
    fontFamily: resolvedTextFont || undefined,
    color: resolvedTextColor || undefined,
    fontSize: resolvedTextSize || undefined,
    lineHeight: resolvedLineHeight,
  };

  // Shared image renderer for the default (non-blocks) mode
  const renderImage = (src: string, alt: string, style?: React.CSSProperties) => (
    <img 
      src={src} 
      alt={alt} 
      className="object-contain"
      style={{
        width: '100%',
        height: 'auto',
        borderRadius: `${imageBorderRadiusPx}px`,
        ...style,
      }}
    />
  );

  // Wrapper for text+image in various layouts
  const renderTextWithImage = (text: string | null, imageUrl: string | null, title: string | null) => {
    const isHorizontal = imagePos === "left" || imagePos === "right";
    const isCorners = imagePos === "corners";
    const imageEl = imageUrl ? renderImage(imageUrl, title || "Produktbillede") : null;

    if (isCorners && imageEl) {
      return (
        <div className="relative">
          {/* Corner images */}
          <div
            className="absolute top-0 left-0 overflow-hidden"
            style={{ 
              width: imageCornerSizePx, 
              height: imageCornerSizePx,
              borderRadius: `${imageBorderRadiusPx}px`,
            }}
          >
            <img 
              src={imageUrl} 
              alt={title || "Produktbillede"}
              className="w-full h-full object-cover"
            />
          </div>
          <div
            className="absolute top-0 right-0 overflow-hidden"
            style={{ 
              width: imageCornerSizePx, 
              height: imageCornerSizePx,
              borderRadius: `${imageBorderRadiusPx}px`,
            }}
          >
            <img 
              src={imageUrl} 
              alt={title || "Produktbillede"}
              className="w-full h-full object-cover"
            />
          </div>
          {/* Text content with padding for corners */}
          <div style={{ 
            paddingLeft: imageCornerSizePx + 16, 
            paddingRight: imageCornerSizePx + 16,
            minHeight: imageCornerSizePx * 2,
          }}>
            {title && <h3 className="mb-2" style={{ ...titleStyle, fontSize: titleStyle.fontSize || "1.125rem" }}>{title}</h3>}
            {text && <p className="whitespace-pre-wrap" style={textStyle}>{text}</p>}
          </div>
        </div>
      );
    }

    if (isHorizontal && imageEl) {
      return (
        <div className={cn("flex gap-6 items-start", imagePos === "right" && "flex-row-reverse")}>
          <div className="flex-shrink-0" style={{ width: `${imageWidthPct}%` }}>
            {imageEl}
          </div>
          <div className="flex-1 min-w-0">
            {title && <h3 className="mb-2" style={{ ...titleStyle, fontSize: titleStyle.fontSize || "1.125rem" }}>{title}</h3>}
            {text && <p className="whitespace-pre-wrap" style={textStyle}>{text}</p>}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {imagePos !== "below" && imageEl && <div className="w-full max-w-2xl">{imageEl}</div>}
        {title && <h3 style={{ ...titleStyle, fontSize: titleStyle.fontSize || "1.125rem" }}>{title}</h3>}
        {text && <p className="whitespace-pre-wrap" style={textStyle}>{text}</p>}
        {imagePos === "below" && imageEl && <div className="w-full max-w-2xl">{imageEl}</div>}
      </div>
    );
  };

  // Gallery element renderer - returns just the gallery component
  const renderGalleryElement = () => {
    // Use block gallery if available, otherwise use branding gallery images
    const galleryBlock = visibleInfoBlocks.find((block) => block.type === "gallery");
    const images = galleryBlock?.images?.length ? galleryBlock.images : galleryImages;
    if (!images?.length) return null;
    const galleryTitle = galleryBlock?.title || "Produktgalleri";
    const isGrid = galleryBlock?.galleryLayout === "grid";

    return (
      <div 
        className={cn("w-full", !isGrid && "overflow-hidden")}
        style={{ 
          height: isGrid ? undefined : `${galleryHeightPx}px`,
          borderRadius: `${galleryBorderRadiusPx}px`,
        }}
      >
        {isGrid ? (
          <ProductInfoGalleryGrid
            images={images}
            title={galleryTitle}
            size={galleryBlock?.gallerySize || "standard"}
          />
        ) : (
          <ProductInfoGallery
            images={images}
            effect={galleryBlock?.effect || "fade"}
            intervalMs={galleryBlock?.intervalMs || galleryIntervalMs}
            title={galleryTitle}
            size={galleryBlock?.gallerySize || "standard"}
          />
        )}
      </div>
    );
  };

  return (
    <Card
      className="mt-12"
      style={cardStyle}
      data-branding-id="productPage.infoSection"
    >
      {showHeader && (
        <CardHeader style={{ paddingBottom: resolvedPadding / 2 }}>
          <CardTitle style={titleStyle}>{aboutData?.title || headerText}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="space-y-6" style={{ paddingTop: showHeader ? undefined : resolvedPadding }}>
        {/* Top positioned gallery */}
        {galleryEnabled && galleryPosition === "top" && renderGalleryElement()}
        
        {/* Left positioned gallery */}
        {galleryEnabled && galleryPosition === "left" && (
          <div className="flex gap-4">
            <div className="w-1/3">{renderGalleryElement()}</div>
            <div className="flex-1" />
          </div>
        )}
        
        {aboutData?.infoV2?.useSections && hasRenderableBlocks ? (
          <div className="space-y-8">
            {visibleInfoBlocks.map((block) => {
              if (block.type === "text" && (block.title || block.text)) {
                return (
                  <section key={block.id} className="space-y-2">
                    {block.title && <h3 className="font-semibold" style={{ ...titleStyle, fontSize: titleStyle.fontSize || "1.125rem" }}>{block.title}</h3>}
                    {block.text && <p className="whitespace-pre-wrap leading-relaxed" style={textStyle}>{block.text}</p>}
                  </section>
                );
              }

              if (block.type === "image" && block.imageUrl) {
                const isHorizontal = imagePos === "left" || imagePos === "right";
                return (
                  <section key={block.id} className="space-y-2">
                    {block.title && !isHorizontal && <h3 className="font-semibold" style={{ ...titleStyle, fontSize: titleStyle.fontSize || "1.125rem" }}>{block.title}</h3>}
                    {renderTextWithImage(null, block.imageUrl, block.title || null)}
                    {block.caption && <p className="text-sm whitespace-pre-wrap" style={{ color: resolvedTextColor || "var(--muted-foreground)" }}>{block.caption}</p>}
                  </section>
                );
              }

              if (block.type === "guide" && (block.imageUrl || formatGuide)) {
                const guideAlt = block.title
                  || (formatGuide ? `Filguide til ${formatGuide.formatLabel}` : "Filguide til produktet");
                return (
                  <section
                    key={block.id}
                    className={cn(
                      "flex flex-col gap-2",
                      block.placement === "right" ? "items-end" : "items-start",
                    )}
                  >
                    {block.title && (
                      <h3
                        className="font-semibold"
                        style={{ ...titleStyle, fontSize: titleStyle.fontSize || "1.125rem" }}
                      >
                        {block.title}
                      </h3>
                    )}
                    <figure className="w-full max-w-[360px] overflow-hidden rounded-md bg-muted/20 p-2">
                      {block.imageUrl ? (
                        <img
                          src={block.imageUrl}
                          alt={guideAlt}
                          width={720}
                          height={480}
                          loading="lazy"
                          className="h-auto max-h-[280px] w-full object-contain"
                        />
                      ) : formatGuide ? (
                        <ProductFormatGuideGraphic data={formatGuide} />
                      ) : null}
                    </figure>
                    {block.caption && (
                      <p
                        className="max-w-[360px] whitespace-pre-wrap text-sm"
                        style={{ color: resolvedTextColor || "var(--muted-foreground)" }}
                      >
                        {block.caption}
                      </p>
                    )}
                  </section>
                );
              }

              if (block.type === "gallery" && (block.images || []).length > 0) {
                const galleryTitle = block.title || "Produktgalleri";
                return (
                  <section key={block.id} className="space-y-3">
                    {block.title && <h3 className="font-semibold" style={{ ...titleStyle, fontSize: titleStyle.fontSize || "1.125rem" }}>{block.title}</h3>}
                    {block.galleryLayout === "grid" ? (
                      <ProductInfoGalleryGrid
                        images={block.images || []}
                        title={galleryTitle}
                        size={block.gallerySize || "standard"}
                      />
                    ) : (
                      <ProductInfoGallery
                        images={block.images || []}
                        effect={block.effect || "fade"}
                        intervalMs={block.intervalMs || 4500}
                        title={galleryTitle}
                        size={block.gallerySize || "standard"}
                      />
                    )}
                  </section>
                );
              }

              return null;
            })}
          </div>
        ) : (
          <div className="space-y-6">
            {renderTextWithImage(
              aboutData?.description || descriptionText || null,
              aboutData?.imageUrl || brandingImageUrl || null,
              null
            )}
          </div>
        )}

        {/* Template Downloads */}
        {showTemplateDownloads && filteredTemplates.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Download skabeloner</h3>
            <p className="text-sm text-muted-foreground">
              Download vores skabelonfiler for at sikre korrekt opsætning af dit design
            </p>
            <div className="flex flex-wrap gap-3">
              {filteredTemplates.map((template, index) => (
                <div key={`${template.url}-${index}`} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
                  <div className="flex min-w-[180px] items-center gap-2 px-1 text-sm font-medium">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{template.format ? `${template.name} (${template.format})` : template.name}</span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => window.open(template.url, '_blank')}
                    className="h-11 touch-manipulation gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Right positioned gallery */}
        {galleryEnabled && galleryPosition === "right" && (
          <div className="flex gap-4">
            <div className="flex-1" />
            <div className="w-1/3">{renderGalleryElement()}</div>
          </div>
        )}
        
        {/* Bottom positioned gallery */}
        {galleryEnabled && galleryPosition === "bottom" && renderGalleryElement()}
      </CardContent>
    </Card>
  );
}
