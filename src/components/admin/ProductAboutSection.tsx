import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Loader2, Save, Upload, X, Download, FileText, Plus, ArrowUp, ArrowDown, Trash2 } from "lucide-react";


interface TemplateFile {
  name: string;
  url: string;
  path: string;
  format?: string;
  uploadedAt: string;
}

interface ProductAboutSectionProps {
  productId: string;
  productSlug?: string;
  aboutTitle: string | null;
  aboutDescription: string | null;
  aboutImageUrl: string | null;

  templateFiles?: TemplateFile[];
  technicalSpecs?: Json | null;
  onUpdate: () => void;
}

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

// Available formats for different product types
const formatOptions: Record<string, string[]> = {
  flyers: ['A6', 'M65', 'A5', 'A4', 'A3'],
  foldere: ['A5', 'M65', 'A4'],
  plakater: ['A3', 'A2', 'A1', 'A0'],
  haefter: ['A6', 'A5', 'A4'],
  hæfter: ['A6', 'A5', 'A4'],
  salgsmapper: ['M65', 'A5', 'A4'],
  visitkort: ['Standard (85x55mm)'],
  klistermærker: ['5x5cm', '10x10cm', '15x15cm', '20x20cm'],
};

const createBlockId = () => `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const getProductInfoV2FromSpecs = (specs: Json | null | undefined): ProductInfoV2Config => {
  if (!isObjectRecord(specs)) {
    return {
      useSections: false,
      imagePosition: "above",
      blocks: [],
    };
  }

  const raw = (specs as Record<string, unknown>).product_page_info_v2;
  if (!isObjectRecord(raw)) {
    return {
      useSections: false,
      imagePosition: "above",
      blocks: [],
    };
  }

  const rawBlocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const blocks: ProductInfoBlock[] = rawBlocks
    .map((item) => {
      if (!isObjectRecord(item)) return null;
      const type = item.type;
      if (type !== "text" && type !== "image" && type !== "gallery") return null;
      return {
        id: typeof item.id === "string" && item.id ? item.id : createBlockId(),
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

export function ProductAboutSection({
  productId,
  productSlug,
  aboutTitle,
  aboutDescription,
  aboutImageUrl,

  templateFiles,
  technicalSpecs,
  onUpdate
}: ProductAboutSectionProps) {
  const initialInfoConfig = useMemo(() => getProductInfoV2FromSpecs(technicalSpecs), [technicalSpecs]);
  const [title, setTitle] = useState(aboutTitle || "");
  const [description, setDescription] = useState(aboutDescription || "");
  const [imageUrl, setImageUrl] = useState(aboutImageUrl || "");
  const [useSectionBlocks, setUseSectionBlocks] = useState(initialInfoConfig.useSections);
  const [imagePosition, setImagePosition] = useState<"above" | "below">(initialInfoConfig.imagePosition);
  const [contentBlocks, setContentBlocks] = useState<ProductInfoBlock[]>(initialInfoConfig.blocks);

  const [templates, setTemplates] = useState<TemplateFile[]>(templateFiles || []);
  const [uploading, setUploading] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTemplateFormat, setSelectedTemplateFormat] = useState<string>("");

  const availableFormats = productSlug ? formatOptions[productSlug] || [] : [];

  useEffect(() => {
    setTemplates(templateFiles || []);
  }, [templateFiles]);

  useEffect(() => {
    setTitle(aboutTitle || "");
    setDescription(aboutDescription || "");
    setImageUrl(aboutImageUrl || "");
  }, [aboutTitle, aboutDescription, aboutImageUrl]);

  useEffect(() => {
    setUseSectionBlocks(initialInfoConfig.useSections);
    setImagePosition(initialInfoConfig.imagePosition);
    setContentBlocks(initialInfoConfig.blocks);
  }, [initialInfoConfig]);


  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast.error('Venligst vælg en billedfil');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('Billedet må ikke være større end 5MB');
        return;
      }

      setUploading(true);

      // Delete old image if exists
      if (aboutImageUrl) {
        const oldPath = aboutImageUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('product-images')
            .remove([`about/${oldPath}`]);
        }
      }

      // Upload new image
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}-about-${Date.now()}.${fileExt}`;
      const filePath = `about/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
      toast.success('Billede uploadet');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Kunne ikke uploade billede');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!aboutImageUrl) return;

    try {
      const oldPath = aboutImageUrl.split('/').pop();
      if (oldPath) {
        await supabase.storage
          .from('product-images')
          .remove([`about/${oldPath}`]);
      }
      setImageUrl("");
      toast.success('Billede fjernet');
    } catch (error) {
      console.error('Error removing image:', error);
      toast.error('Kunne ikke fjerne billede');
    }
  };

  const addBlock = (type: ProductInfoBlock["type"]) => {
    const newBlock: ProductInfoBlock = {
      id: createBlockId(),
      type,
      title: "",
      text: "",
      imageUrl: "",
      caption: "",
      images: [],
      effect: "fade",
      intervalMs: 4500,
    };
    setContentBlocks((prev) => [...prev, newBlock]);
    setUseSectionBlocks(true);
  };

  const updateBlock = (blockId: string, updates: Partial<ProductInfoBlock>) => {
    setContentBlocks((prev) =>
      prev.map((block) => (block.id === blockId ? { ...block, ...updates } : block))
    );
  };

  const removeBlock = (blockId: string) => {
    setContentBlocks((prev) => prev.filter((block) => block.id !== blockId));
  };

  const moveBlock = (blockId: string, direction: "up" | "down") => {
    setContentBlocks((prev) => {
      const index = prev.findIndex((block) => block.id === blockId);
      if (index === -1) return prev;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const uploadBlockImage = async (blockId: string, file: File, mode: "single" | "gallery") => {
    try {
      if (!file.type.startsWith("image/")) {
        toast.error("Venligst vælg en billedfil");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast.error("Billedet må ikke være større end 10MB");
        return;
      }

      setUploading(true);
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `${productId}-about-${blockId}-${Date.now()}.${fileExt}`;
      const filePath = `about/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      if (mode === "single") {
        updateBlock(blockId, { imageUrl: publicUrl });
      } else {
        setContentBlocks((prev) =>
          prev.map((block) =>
            block.id === blockId
              ? { ...block, images: [...(block.images || []), publicUrl] }
              : block
          )
        );
      }

      toast.success("Billede uploadet");
    } catch (error) {
      console.error("Error uploading section image:", error);
      toast.error("Kunne ikke uploade billedet");
    } finally {
      setUploading(false);
    }
  };

  const removeGalleryImage = (blockId: string, index: number) => {
    setContentBlocks((prev) =>
      prev.map((block) =>
        block.id === blockId
          ? { ...block, images: (block.images || []).filter((_, i) => i !== index) }
          : block
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const templatesForStorage = templates.map(t => ({
        name: t.name,
        url: t.url,
        path: t.path,
        format: t.format || null,
        uploadedAt: t.uploadedAt
      }));

      const technicalSpecsObject = isObjectRecord(technicalSpecs)
        ? { ...(technicalSpecs as Record<string, unknown>) }
        : {};

      const normalizedBlocks = contentBlocks.map((block) => ({
        id: block.id,
        type: block.type,
        title: block.title || "",
        text: block.text || "",
        imageUrl: block.imageUrl || "",
        caption: block.caption || "",
        images: (block.images || []).filter((url) => typeof url === "string" && url.length > 0),
        effect: block.effect || "fade",
        intervalMs: typeof block.intervalMs === "number" ? Math.max(2000, Math.min(12000, Math.round(block.intervalMs))) : 4500,
      }));

      const productInfoV2: ProductInfoV2Config = {
        useSections: useSectionBlocks,
        imagePosition,
        blocks: normalizedBlocks,
      };

      const { error } = await supabase
        .from('products')
        .update({
          about_title: title || null,
          about_description: description || null,
          about_image_url: imageUrl || null,
          template_files: templatesForStorage as any,
          technical_specs: {
            ...technicalSpecsObject,
            product_page_info_v2: productInfoV2,
          } as any,
        })
        .eq('id', productId);

      if (error) throw error;

      toast.success('Produktinfo opdateret');
      onUpdate();
    } catch (error) {
      console.error('Error updating about section:', error);
      toast.error('Kunne ikke opdatere produktinfo');
    } finally {
      setSaving(false);
    }
  };

  const handleTemplateUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const allowedExtensions = ['pdf', 'indd', 'idml', 'zip'];

      if (!allowedExtensions.includes(fileExt || '')) {
        toast.error('Kun PDF, InDesign (INDD, IDML), og ZIP filer er tilladt');
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        toast.error('Filen må ikke være større end 50MB');
        return;
      }

      setUploadingTemplate(true);

      const formatSuffix = selectedTemplateFormat ? `-${selectedTemplateFormat}` : '';
      const fileName = `${productId}-template${formatSuffix}-${Date.now()}.${fileExt}`;
      const filePath = `templates/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-templates')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-templates')
        .getPublicUrl(filePath);

      const newTemplate: TemplateFile = {
        name: file.name,
        url: publicUrl,
        path: filePath,
        format: selectedTemplateFormat || undefined,
        uploadedAt: new Date().toISOString()
      };

      setTemplates([...templates, newTemplate]);
      setSelectedTemplateFormat("");
      toast.success('Skabelon uploadet');

      event.target.value = '';
    } catch (error) {
      console.error('Error uploading template:', error);
      toast.error('Kunne ikke uploade skabelon');
    } finally {
      setUploadingTemplate(false);
    }
  };

  const handleRemoveTemplate = async (index: number) => {
    try {
      const template = templates[index];
      if (template.path) {
        await supabase.storage
          .from('product-templates')
          .remove([template.path]);
      }

      const newTemplates = templates.filter((_, i) => i !== index);
      setTemplates(newTemplates);
      toast.success('Skabelon fjernet');
    } catch (error) {
      console.error('Error removing template:', error);
      toast.error('Kunne ikke fjerne skabelon');
    }
  };

  const hasChanges =
    title !== (aboutTitle || "") ||
    description !== (aboutDescription || "") ||
    imageUrl !== (aboutImageUrl || "") ||
    JSON.stringify(templates) !== JSON.stringify(templateFiles || []) ||
    useSectionBlocks !== initialInfoConfig.useSections ||
    imagePosition !== initialInfoConfig.imagePosition ||
    JSON.stringify(contentBlocks) !== JSON.stringify(initialInfoConfig.blocks);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Produktside Information</CardTitle>
        <CardDescription className="text-xs">
          Information om produktet, som vises på selve produktsiden (når kunden har klikket på produktet).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="about-title">Titel</Label>
          <Input
            id="about-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="F.eks. Om Flyers"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="about-description">Beskrivelse</Label>
          <Textarea
            id="about-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detaljeret beskrivelse af produktet..."
            rows={4}
            className="text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label>Billede</Label>
          {imageUrl ? (
            <div className="space-y-2">
              <div className="relative w-full h-32 border rounded-lg overflow-hidden">
                <img src={imageUrl} alt="About section" className="w-full h-full object-contain" />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleRemoveImage} disabled={uploading}>
                  <X className="h-4 w-4 mr-2" />
                  Fjern billede
                </Button>
                <Label htmlFor="about-image-upload" className="flex-1">
                  <Button variant="outline" size="sm" disabled={uploading} asChild className="w-full">
                    <span>
                      {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      Udskift billede
                    </span>
                  </Button>
                </Label>
                <input id="about-image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="about-image-upload">
                <Button variant="outline" disabled={uploading} asChild>
                  <span>
                    {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Upload billede
                  </span>
                </Button>
              </Label>
              <input id="about-image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>
          )}
        </div>

        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-base font-semibold">Avanceret sektion-opbygning</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Byg produktside-information med tekstsektioner, billeder og gallerier.
              </p>
            </div>
            <Button
              type="button"
              variant={useSectionBlocks ? "default" : "outline"}
              size="sm"
              onClick={() => setUseSectionBlocks((prev) => !prev)}
            >
              {useSectionBlocks ? "Sektioner aktiv" : "Brug sektioner"}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Billedplacering i klassisk layout</Label>
            <Select value={imagePosition} onValueChange={(value) => setImagePosition(value as "above" | "below")}>
              <SelectTrigger className="w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="above">Billede over tekst</SelectItem>
                <SelectItem value="below">Billede under tekst</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => addBlock("text")}>
              <Plus className="h-4 w-4 mr-1" />
              Tilføj tekstsektion
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addBlock("image")}>
              <Plus className="h-4 w-4 mr-1" />
              Tilføj billedsektion
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addBlock("gallery")}>
              <Plus className="h-4 w-4 mr-1" />
              Tilføj galleri
            </Button>
          </div>

          {contentBlocks.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Ingen sektioner endnu. Tilføj en tekstsektion, billedsektion eller et galleri.
            </p>
          )}

          <div className="space-y-3">
            {contentBlocks.map((block, index) => (
              <div key={block.id} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {block.type === "text" && `Tekstsektion ${index + 1}`}
                    {block.type === "image" && `Billedsektion ${index + 1}`}
                    {block.type === "gallery" && `Galleri ${index + 1}`}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => moveBlock(block.id, "up")}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => moveBlock(block.id, "down")}
                      disabled={index === contentBlocks.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeBlock(block.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Titel (valgfri)</Label>
                  <Input
                    value={block.title || ""}
                    onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                    placeholder="Sektionstitel"
                  />
                </div>

                {block.type === "text" && (
                  <div className="space-y-2">
                    <Label>Tekst</Label>
                    <Textarea
                      value={block.text || ""}
                      onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                      placeholder="Skriv tekst til denne sektion..."
                      rows={4}
                      className="text-sm"
                    />
                  </div>
                )}

                {block.type === "image" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Billede</Label>
                      {block.imageUrl ? (
                        <div className="space-y-2">
                          <div className="relative w-full h-36 border rounded-lg overflow-hidden bg-muted/10">
                            <img src={block.imageUrl} alt={block.title || "Sektion billede"} className="w-full h-full object-contain" />
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => updateBlock(block.id, { imageUrl: "" })}>
                              <X className="h-4 w-4 mr-2" />
                              Fjern billede
                            </Button>
                            <Label htmlFor={`block-image-${block.id}`} className="flex-1">
                              <Button type="button" variant="outline" size="sm" disabled={uploading} asChild className="w-full">
                                <span>
                                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                                  Udskift billede
                                </span>
                              </Button>
                            </Label>
                            <input
                              id={`block-image-${block.id}`}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) uploadBlockImage(block.id, file, "single");
                                e.currentTarget.value = "";
                              }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <Label htmlFor={`block-image-${block.id}`}>
                            <Button type="button" variant="outline" disabled={uploading} asChild>
                              <span>
                                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                                Upload billede
                              </span>
                            </Button>
                          </Label>
                          <input
                            id={`block-image-${block.id}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadBlockImage(block.id, file, "single");
                              e.currentTarget.value = "";
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Tekst under billede (valgfri)</Label>
                      <Textarea
                        value={block.caption || ""}
                        onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                        placeholder="Kort billedtekst..."
                        rows={2}
                      />
                    </div>
                  </div>
                )}

                {block.type === "gallery" && (
                  <div className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Fade-effekt</Label>
                        <Select value={block.effect || "fade"} onValueChange={(value) => updateBlock(block.id, { effect: value as GalleryEffect })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fade">Fade</SelectItem>
                            <SelectItem value="fade-zoom">Fade + Zoom</SelectItem>
                            <SelectItem value="fade-up">Fade + Op</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Skift-interval (ms)</Label>
                        <Input
                          type="number"
                          min={2000}
                          max={12000}
                          step={100}
                          value={block.intervalMs || 4500}
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            updateBlock(block.id, {
                              intervalMs: Number.isFinite(value) ? Math.max(2000, Math.min(12000, value)) : 4500
                            });
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Billeder i galleri</Label>
                      {(block.images || []).length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {(block.images || []).map((url, imageIndex) => (
                            <div key={`${block.id}-gallery-${imageIndex}`} className="relative rounded border overflow-hidden bg-muted/10">
                              <img src={url} alt={`Galleri ${imageIndex + 1}`} className="w-full h-28 object-cover" />
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="absolute top-1 right-1 h-6 w-6"
                                onClick={() => removeGalleryImage(block.id, imageIndex)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Ingen billeder endnu i galleriet.</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor={`gallery-upload-${block.id}`}>
                        <Button type="button" variant="outline" disabled={uploading} asChild>
                          <span>
                            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                            Upload galleri-billeder
                          </span>
                        </Button>
                      </Label>
                      <input
                        id={`gallery-upload-${block.id}`}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          for (const file of files) {
                            await uploadBlockImage(block.id, file, "gallery");
                          }
                          e.currentTarget.value = "";
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 border-t pt-3">
          <div>
            <Label className="text-base font-semibold">Skabelonfiler (download links til kunder)</Label>
          </div>

          {templates.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filnavn</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead className="text-right">Handlinger</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template, index) => (
                  <TableRow key={index}>
                    <TableCell className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {template.name}
                    </TableCell>
                    <TableCell>{template.format || "Alle"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(template.url, '_blank')}>
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleRemoveTemplate(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex gap-3 items-end">
            {availableFormats.length > 0 && (
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={selectedTemplateFormat || "all"} onValueChange={(val) => setSelectedTemplateFormat(val === "all" ? "" : val)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Alle formater" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle formater</SelectItem>
                    {availableFormats.map(format => <SelectItem key={format} value={format}>{format}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Label htmlFor="template-upload">
              <Button variant="outline" disabled={uploadingTemplate} asChild>
                <span>
                  {uploadingTemplate ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Upload Skabelon
                </span>
              </Button>
            </Label>
            <input id="template-upload" type="file" accept=".pdf,.indd,.idml,.zip" onChange={handleTemplateUpload} className="hidden" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Gem Produktinfo
        </Button>
      </CardContent>
    </Card>
  );
}
