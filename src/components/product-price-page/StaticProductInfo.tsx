import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText } from "lucide-react";

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

export function StaticProductInfo({ productId, selectedFormat }: StaticProductInfoProps) {
  const [aboutData, setAboutData] = useState<{
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    templates: TemplateFile[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAboutData() {
      setLoading(true);
      try {
        // Fetch by product slug (productId here is actually the slug from static metadata)
        const { data, error } = await supabase
          .from('products')
          .select('about_title, about_description, about_image_url, template_files')
          .eq('slug', productId)
          .maybeSingle();

        if (error) {
          console.error('Error fetching about data:', error);
          return;
        }

        if (data) {
          setAboutData({
            title: data.about_title,
            description: data.about_description,
            imageUrl: data.about_image_url,
            templates: (data.template_files as TemplateFile[]) || []
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

  // Don't render if no about data exists
  if (loading) {
    return null;
  }

  if (!aboutData?.title && !aboutData?.description && filteredTemplates.length === 0) {
    return null;
  }

  return (
    <Card className="mt-12">
      <CardHeader>
        <CardTitle>{aboutData?.title || "Om produktet"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {aboutData?.description && (
          <div className="prose prose-sm max-w-none">
            <p className="text-foreground/80 whitespace-pre-wrap">{aboutData.description}</p>
          </div>
        )}
        
        {aboutData?.imageUrl && (
          <div className="w-full max-w-2xl">
            <img
              src={aboutData.imageUrl}
              alt={aboutData.title || "Product image"}
              className="w-full h-auto rounded-lg object-contain"
            />
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
