import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type TemplateFile = {
  name: string;
  url: string;
  format?: string; // Optional format association (e.g., "A4", "A5")
  uploadedAt: string;
};

type StaticProductInfoProps = {
  productId: string;
  selectedFormat?: string;
};

type GalleryEffect = "fade" | "fade-zoom" | "fade-up";

type ProductInfoBlock = {
  id: string;
  type: "text" | "image" | "gallery";
  title?: string;
  text?: string;
  imageUrl?: string;
  caption?: string;
  images?: string[];
  effect?: GalleryEffect;
  intervalMs?: number;
};

type ProductInfoV2Config = {
  useSections: boolean;
  imagePosition: "above" | "below";
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
      if (type !== "text" && type !== "image" && type !== "gallery") return null;
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
}: {
  images: string[];
  effect: GalleryEffect;
  intervalMs: number;
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

  return (
    <div className="w-full max-w-3xl">
      <div className="relative h-64 md:h-80 overflow-hidden bg-muted/10">
        {images.map((url, index) => {
          const active = index === activeIndex;
          return (
            <img
              key={`${url}-${index}`}
              src={url}
              alt={`Galleri ${index + 1}`}
              className={cn(
                "absolute inset-0 h-full w-full object-contain transition-all duration-700 ease-out",
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

export function StaticProductInfo({ productId, selectedFormat }: StaticProductInfoProps) {
  const [aboutData, setAboutData] = useState<{
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    templates: TemplateFile[];
    infoV2: ProductInfoV2Config;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAboutData() {
      setLoading(true);
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId);

        let query = supabase
          .from('products')
          .select('about_title, about_description, about_image_url, template_files, technical_specs');

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
  }, [productId]);

  // Filter templates by format if selectedFormat is provided
  const filteredTemplates = aboutData?.templates.filter(template => {
    if (!selectedFormat) return true;
    if (!template.format) return true; // Show templates without format association
    return template.format === selectedFormat;
  }) || [];

  const hasRenderableBlocks = useMemo(() => {
    if (!aboutData?.infoV2?.useSections) return false;
    return aboutData.infoV2.blocks.some((block) => {
      if (block.type === "text") return !!(block.title || block.text);
      if (block.type === "image") return !!block.imageUrl;
      if (block.type === "gallery") return (block.images || []).length > 0;
      return false;
    });
  }, [aboutData?.infoV2]);

  // Don't render if no about data exists
  if (loading) {
    return null;
  }

  if (!aboutData?.title && !aboutData?.description && !aboutData?.imageUrl && !hasRenderableBlocks && filteredTemplates.length === 0) {
    return null;
  }

  return (
    <Card className="mt-12">
      <CardHeader>
        <CardTitle>{aboutData?.title || "Om produktet"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {aboutData?.infoV2?.useSections && hasRenderableBlocks ? (
          <div className="space-y-8">
            {aboutData.infoV2.blocks.map((block) => {
              if (block.type === "text" && (block.title || block.text)) {
                return (
                  <section key={block.id} className="space-y-2">
                    {block.title && <h3 className="text-lg font-semibold">{block.title}</h3>}
                    {block.text && (
                      <p className="text-foreground/80 whitespace-pre-wrap">{block.text}</p>
                    )}
                  </section>
                );
              }

              if (block.type === "image" && block.imageUrl) {
                return (
                  <section key={block.id} className="space-y-2">
                    {block.title && <h3 className="text-lg font-semibold">{block.title}</h3>}
                    <div className="w-full max-w-3xl">
                      <img
                        src={block.imageUrl}
                        alt={block.title || "Produktbillede"}
                        className="w-full h-auto rounded-lg object-contain"
                      />
                    </div>
                    {block.caption && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{block.caption}</p>}
                  </section>
                );
              }

              if (block.type === "gallery" && (block.images || []).length > 0) {
                return (
                  <section key={block.id} className="space-y-3">
                    {block.title && <h3 className="text-lg font-semibold">{block.title}</h3>}
                    <ProductInfoGallery
                      images={block.images || []}
                      effect={block.effect || "fade"}
                      intervalMs={block.intervalMs || 4500}
                    />
                  </section>
                );
              }

              return null;
            })}
          </div>
        ) : (
          <div className="space-y-6">
            {aboutData?.infoV2?.imagePosition !== "below" && aboutData?.imageUrl && (
              <div className="w-full max-w-2xl">
                <img
                  src={aboutData.imageUrl}
                  alt={aboutData.title || "Product image"}
                  className="w-full h-auto rounded-lg object-contain"
                />
              </div>
            )}

            {aboutData?.description && (
              <div className="prose prose-sm max-w-none">
                <p className="text-foreground/80 whitespace-pre-wrap">{aboutData.description}</p>
              </div>
            )}

            {aboutData?.infoV2?.imagePosition === "below" && aboutData?.imageUrl && (
              <div className="w-full max-w-2xl">
                <img
                  src={aboutData.imageUrl}
                  alt={aboutData.title || "Product image"}
                  className="w-full h-auto rounded-lg object-contain"
                />
              </div>
            )}
          </div>
        )}

        {/* Template Downloads */}
        {filteredTemplates.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">Download skabeloner</h3>
            <p className="text-sm text-muted-foreground">
              Download vores skabelonfiler for at sikre korrekt opsætning af dit design
            </p>
            <div className="flex flex-wrap gap-3">
              {filteredTemplates.map((template, index) => (
                <Button
                  key={index}
                  variant="outline"
                  onClick={() => window.open(template.url, '_blank')}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  {template.format ? `${template.name} (${template.format})` : template.name}
                  <Download className="h-4 w-4" />
                </Button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
