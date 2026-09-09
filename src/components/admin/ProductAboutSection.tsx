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
import { Loader2, Save, Upload, X, Download, FileText, Plus, ArrowUp, ArrowDown, Trash2, ExternalLink, ScanLine } from "lucide-react";
import {
  inferTemplateConfiguration,
  inferTemplateFormat,
} from "@/lib/designer/productTemplateLinks";
import { MASTER_TENANT_ID, isAttributeTemplateType } from "@/lib/designer/templateLibrary";
import {
  normalizeProductInfoGalleryLayout,
  normalizeProductInfoShowWhen,
  type ProductInfoGalleryLayout,
  type ProductInfoShowWhenCondition,
} from "@/lib/storefront/productInfoVisibility";
import {
  buildOptimisticProductAboutUpdate,
  haveTemplateFilesChanged,
} from "./productAboutTemplatePersistence";


interface TemplateFile {
  [key: string]: Json | undefined;
  name: string;
  url: string;
  path: string;
  format?: string;
  configuration?: string | null;
  designerTemplateId?: string | null;
  widthMm?: number | null;
  heightMm?: number | null;
  bleedMm?: number | null;
  safeMm?: number | null;
  designerUrl?: string | null;
  designerLabel?: string | null;
  uploadedAt: string;
}

interface ProductAboutSectionProps {
  productId: string;
  tenantId: string;
  aboutTitle: string | null;
  aboutDescription: string | null;
  aboutImageUrl: string | null;

  templateFiles?: TemplateFile[];
  technicalSpecs?: Json | null;
  onUpdate: () => void;
}

type DesignerTemplateOption = {
  id: string;
  name: string;
  tenant_id: string;
  is_public: boolean;
  template_type: string | null;
  width_mm: number | null;
  height_mm: number | null;
  bleed_mm: number | null;
  safe_area_mm: number | null;
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
  imagePosition: "above" | "below";
  blocks: ProductInfoBlock[];
};

const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

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
      if (type !== "text" && type !== "image" && type !== "gallery" && type !== "guide") return null;
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

export function ProductAboutSection({
  productId,
  tenantId,
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
  const [designerTemplatesLoading, setDesignerTemplatesLoading] = useState(false);
  const [designerTemplates, setDesignerTemplates] = useState<DesignerTemplateOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedTemplateFormat, setSelectedTemplateFormat] = useState<string>("");
  const [selectedTemplateConfiguration, setSelectedTemplateConfiguration] = useState<string>("");
  const [selectedDesignerTemplateId, setSelectedDesignerTemplateId] = useState<string>("none");
  const templateFilesHaveChanged = useMemo(
    () => haveTemplateFilesChanged(templates, templateFiles),
    [templateFiles, templates],
  );

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

  useEffect(() => {
    if (!tenantId) return;

    let active = true;
    const loadDesignerTemplates = async () => {
      setDesignerTemplatesLoading(true);
      try {
        const { data, error } = await supabase
          // Generated database types do not yet include this established table.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .from("designer_templates" as any)
          .select("id, name, tenant_id, is_public, template_type, width_mm, height_mm, bleed_mm, safe_area_mm")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true });

        if (error) throw error;
        if (!active) return;

        const templateRows = (data || []) as unknown as DesignerTemplateOption[];
        setDesignerTemplates(templateRows.filter((template) => {
          if (isAttributeTemplateType(template.template_type)) return false;
          return template.tenant_id === tenantId
            || (template.tenant_id === MASTER_TENANT_ID && template.is_public);
        }) as DesignerTemplateOption[]);
      } catch (error) {
        console.error("[ProductAboutSection] Failed to load designer templates", error);
        if (active) setDesignerTemplates([]);
      } finally {
        if (active) setDesignerTemplatesLoading(false);
      }
    };

    void loadDesignerTemplates();
    return () => {
      active = false;
    };
  }, [tenantId]);


  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast.error('Venligst vælg en billedfil');
        return;
      }

      if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
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
      format: "",
      configuration: "",
      placement: "left",
      galleryLayout: "slideshow",
      gallerySize: "standard",
      showWhen: [],
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

      if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
        toast.error("Billedet må ikke være større end 5MB");
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

  const moveGalleryImage = (blockId: string, imageIndex: number, direction: "up" | "down") => {
    setContentBlocks((prev) => prev.map((block) => {
      if (block.id !== blockId) return block;
      const images = [...(block.images || [])];
      const targetIndex = direction === "up" ? imageIndex - 1 : imageIndex + 1;
      if (targetIndex < 0 || targetIndex >= images.length) return block;
      [images[imageIndex], images[targetIndex]] = [images[targetIndex], images[imageIndex]];
      return { ...block, images };
    }));
  };

  const addGalleryCondition = (blockId: string) => {
    setContentBlocks((prev) => prev.map((block) => (
      block.id === blockId
        ? {
            ...block,
            showWhen: [
              ...(block.showWhen || []),
              { sectionId: "", valueIds: [] },
            ],
          }
        : block
    )));
  };

  const updateGalleryCondition = (
    blockId: string,
    conditionIndex: number,
    patch: Partial<ProductInfoShowWhenCondition>,
  ) => {
    setContentBlocks((prev) => prev.map((block) => {
      if (block.id !== blockId) return block;
      return {
        ...block,
        showWhen: (block.showWhen || []).map((condition, index) => (
          index === conditionIndex ? { ...condition, ...patch } : condition
        )),
      };
    }));
  };

  const removeGalleryCondition = (blockId: string, conditionIndex: number) => {
    setContentBlocks((prev) => prev.map((block) => (
      block.id === blockId
        ? {
            ...block,
            showWhen: (block.showWhen || []).filter((_, index) => index !== conditionIndex),
          }
        : block
    )));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const technicalSpecsObject = isObjectRecord(technicalSpecs)
        ? { ...(technicalSpecs as Record<string, unknown>) }
        : {};
      const originalProductInfo = isObjectRecord(technicalSpecsObject.product_page_info_v2)
        ? technicalSpecsObject.product_page_info_v2
        : {};
      const originalBlockById = new Map(
        (Array.isArray(originalProductInfo.blocks) ? originalProductInfo.blocks : [])
          .filter(isObjectRecord)
          .filter((block) => typeof block.id === "string")
          .map((block) => [String(block.id), block]),
      );

      const normalizedBlocks = contentBlocks.map((block) => ({
        ...(originalBlockById.get(block.id) || {}),
        id: block.id,
        type: block.type,
        title: block.title || "",
        text: block.text || "",
        imageUrl: block.imageUrl || "",
        caption: block.caption || "",
        images: (block.images || []).filter((url) => typeof url === "string" && url.length > 0),
        effect: block.effect || "fade",
        intervalMs: typeof block.intervalMs === "number" ? Math.max(2000, Math.min(12000, Math.round(block.intervalMs))) : 4500,
        format: block.format || "",
        configuration: block.configuration || "",
        placement: block.placement || "left",
        ...(block.type === "gallery" ? {
          galleryLayout: normalizeProductInfoGalleryLayout(block.galleryLayout),
          gallerySize: normalizeProductInfoGallerySize(block.gallerySize),
          showWhen: normalizeProductInfoShowWhen(block.showWhen),
        } : {}),
      }));

      const productInfoV2: ProductInfoV2Config & Record<string, unknown> = {
        ...originalProductInfo,
        useSections: useSectionBlocks,
        imagePosition,
        blocks: normalizedBlocks,
      };

      const editedTechnicalSpecs = {
        ...technicalSpecsObject,
        product_page_info_v2: productInfoV2,
      };
      const { data: currentRow, error: currentRowError } = await supabase
        .from("products")
        .select("updated_at, about_title, about_description, about_image_url, technical_specs, template_files")
        .eq("id", productId)
        .maybeSingle();

      if (currentRowError) throw currentRowError;
      if (!currentRow) {
        toast.error("Kunne ikke gemme, fordi produktet ikke længere findes.");
        return;
      }

      const persistenceResult = buildOptimisticProductAboutUpdate({
        current: {
          updated_at: currentRow.updated_at,
          about_title: currentRow.about_title,
          about_description: currentRow.about_description,
          about_image_url: currentRow.about_image_url,
          technical_specs: currentRow.technical_specs,
          template_files: Array.isArray(currentRow.template_files) ? currentRow.template_files : [],
        },
        original: {
          about_title: aboutTitle || null,
          about_description: aboutDescription || null,
          about_image_url: aboutImageUrl || null,
          technical_specs: technicalSpecs,
          template_files: templateFiles || [],
        },
        edited: {
          about_title: title || null,
          about_description: description || null,
          about_image_url: imageUrl || null,
          technical_specs: editedTechnicalSpecs,
          template_files: templates,
        },
      });

      if (persistenceResult.status === "conflict") {
        const fieldLabel = persistenceResult.field === "product_page_info_v2"
          ? "galleriet eller produktinformationen"
          : persistenceResult.field === "template_files"
            ? "produktskabelonerne"
            : "produktteksten eller billedet";
        toast.error(
          `Kunne ikke gemme, fordi ${fieldLabel} er blevet ændret et andet sted. Genindlæs produktet og prøv igen.`,
        );
        return;
      }

      if (Object.keys(persistenceResult.payload).length === 0) {
        toast.success("Produktinfo er allerede opdateret");
        onUpdate();
        return;
      }

      const updatePayload = persistenceResult.payload as {
        about_title?: string | null;
        about_description?: string | null;
        about_image_url?: string | null;
        technical_specs?: Json;
        template_files?: Json;
      };
      let guardedUpdate = supabase
        .from("products")
        .update(updatePayload)
        .eq("id", productId);
      guardedUpdate = persistenceResult.expectedUpdatedAt
        ? guardedUpdate.eq("updated_at", persistenceResult.expectedUpdatedAt)
        : guardedUpdate.is("updated_at", null);

      const { data: updatedRow, error } = await guardedUpdate
        .select("id, updated_at")
        .maybeSingle();

      if (error) throw error;
      if (!updatedRow) {
        toast.error(
          "Kunne ikke gemme, fordi produktet blev ændret, mens du redigerede. Genindlæs produktet og prøv igen.",
        );
        return;
      }

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

      const linkedDesignerTemplate = designerTemplates.find((template) => (
        template.id === selectedDesignerTemplateId
      ));
      const newTemplate: TemplateFile = {
        name: file.name,
        url: publicUrl,
        path: filePath,
        format: selectedTemplateFormat || undefined,
        configuration: selectedTemplateConfiguration || null,
        designerTemplateId: selectedDesignerTemplateId === "none" ? null : selectedDesignerTemplateId,
        widthMm: linkedDesignerTemplate?.width_mm ?? null,
        heightMm: linkedDesignerTemplate?.height_mm ?? null,
        bleedMm: linkedDesignerTemplate?.bleed_mm ?? null,
        safeMm: linkedDesignerTemplate?.safe_area_mm ?? null,
        uploadedAt: new Date().toISOString()
      };

      setTemplates([...templates, newTemplate]);
      setSelectedTemplateFormat("");
      setSelectedTemplateConfiguration("");
      setSelectedDesignerTemplateId("none");
      toast.success('Skabelon uploadet');

      event.target.value = '';
    } catch (error) {
      console.error('Error uploading template:', error);
      toast.error('Kunne ikke uploade skabelon');
    } finally {
      setUploadingTemplate(false);
    }
  };

  const updateTemplate = (index: number, patch: Partial<TemplateFile>) => {
    setTemplates((current) => current.map((template, templateIndex) => (
      templateIndex === index ? { ...template, ...patch } : template
    )));
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
    templateFilesHaveChanged ||
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
                Byg produktside-information med tekstsektioner, billeder, filguider og gallerier.
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
            <Button type="button" size="sm" variant="outline" onClick={() => addBlock("guide")}>
              <ScanLine className="h-4 w-4 mr-1" />
              Tilføj guidebillede
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addBlock("gallery")}>
              <Plus className="h-4 w-4 mr-1" />
              Tilføj galleri
            </Button>
          </div>

          {contentBlocks.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Ingen sektioner endnu. Tilføj tekst, billeder, et guidebillede eller et galleri.
            </p>
          )}

          <div className="space-y-3">
            {contentBlocks.map((block, index) => (
              <div key={block.id} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {block.type === "text" && `Tekstsektion ${index + 1}`}
                    {block.type === "image" && `Billedsektion ${index + 1}`}
                    {block.type === "guide" && `Guidebillede ${index + 1}`}
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

                {block.type === "guide" && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Format (valgfri)</Label>
                      <Input
                        value={block.format || ""}
                        onChange={(e) => updateBlock(block.id, { format: e.target.value })}
                        placeholder="F.eks. A7"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Variant (valgfri)</Label>
                      <Input
                        value={block.configuration || ""}
                        onChange={(e) => updateBlock(block.id, { configuration: e.target.value })}
                        placeholder="F.eks. 6 sider"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Placering</Label>
                      <Select
                        value={block.placement || "left"}
                        onValueChange={(value) => updateBlock(block.id, { placement: value as "left" | "right" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Venstre</SelectItem>
                          <SelectItem value="right">Højre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {(block.type === "image" || block.type === "guide") && (
                  <div className="space-y-3">
                    {block.type === "guide" && (
                      <p className="text-xs leading-5 text-muted-foreground">
                        Uden upload vises den automatisk genererede formatguide. Et uploadet billede erstatter guiden for det valgte format og den valgte variant.
                      </p>
                    )}
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
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-2">
                        <Label>Visning</Label>
                        <Select
                          value={block.galleryLayout || "slideshow"}
                          onValueChange={(value) => updateBlock(block.id, {
                            galleryLayout: value as ProductInfoGalleryLayout,
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="slideshow">Slideshow</SelectItem>
                            <SelectItem value="grid">Billedgitter</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Visningsstørrelse</Label>
                        <Select
                          value={block.gallerySize || "standard"}
                          onValueChange={(value) => updateBlock(block.id, {
                            gallerySize: value as ProductInfoGallerySize,
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="compact">Kompakt</SelectItem>
                            <SelectItem value="standard">Standard</SelectItem>
                            <SelectItem value="large">Stor</SelectItem>
                            <SelectItem value="full">Fuld bredde</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
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

                    <div className="space-y-3 rounded-md border bg-muted/10 p-3">
                      <div>
                        <Label>Vis kun ved bestemte produktvalg</Label>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Alle betingelser skal passe. Uden betingelser vises galleriet som hidtil for alle valg.
                        </p>
                      </div>

                      {(block.showWhen || []).map((condition, conditionIndex) => (
                        <div
                          key={`${block.id}-condition-${conditionIndex}`}
                          className="grid gap-2 rounded-md border bg-background p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-end"
                        >
                          <div className="min-w-0 space-y-1.5">
                            <Label htmlFor={`${block.id}-condition-section-${conditionIndex}`}>
                              Sektions-id
                            </Label>
                            <Input
                              id={`${block.id}-condition-section-${conditionIndex}`}
                              value={condition.sectionId}
                              onChange={(event) => updateGalleryCondition(block.id, conditionIndex, {
                                sectionId: event.target.value,
                              })}
                              placeholder="F.eks. calendar-model"
                            />
                          </div>
                          <div className="min-w-0 space-y-1.5">
                            <Label htmlFor={`${block.id}-condition-values-${conditionIndex}`}>
                              Tilladte værdi-id'er
                            </Label>
                            <Input
                              id={`${block.id}-condition-values-${conditionIndex}`}
                              value={condition.valueIds.join(", ")}
                              onChange={(event) => updateGalleryCondition(block.id, conditionIndex, {
                                valueIds: [event.target.value],
                              })}
                              placeholder="model-a, model-b"
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-destructive"
                            onClick={() => removeGalleryCondition(block.id, conditionIndex)}
                            aria-label={`Fjern visningsbetingelse ${conditionIndex + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => addGalleryCondition(block.id)}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Tilføj betingelse
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Billeder i galleri</Label>
                      {(block.images || []).length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {(block.images || []).map((url, imageIndex) => (
                            <div key={`${block.id}-gallery-${imageIndex}`} className="relative rounded border overflow-hidden bg-muted/10">
                              <img src={url} alt={`Galleri ${imageIndex + 1}`} className="h-28 w-full bg-white object-contain" />
                              <div className="absolute left-1 top-1 flex gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="secondary"
                                  className="h-6 w-6"
                                  onClick={() => moveGalleryImage(block.id, imageIndex, "up")}
                                  disabled={imageIndex === 0}
                                  aria-label={`Flyt galleribillede ${imageIndex + 1} tidligere`}
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="secondary"
                                  className="h-6 w-6"
                                  onClick={() => moveGalleryImage(block.id, imageIndex, "down")}
                                  disabled={imageIndex === (block.images || []).length - 1}
                                  aria-label={`Flyt galleribillede ${imageIndex + 1} senere`}
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                              </div>
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Label className="text-base font-semibold">Produktskabeloner</Label>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
                Opret én række pr. rigtig produktkombination, f.eks. A4 + 5 mm ryg. Kunden får den samme PDF til download og i designeren. En skabelon uden præcis format- og variantmatch bruges ikke som tilfældig reserve.
              </p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="/admin/designer-templates" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Opret designer-template
              </a>
            </Button>
          </div>

          {templates.length > 0 && (
            <div className="overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Filnavn</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>Designer-template</TableHead>
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
                    <TableCell className="min-w-[150px]">
                      <Input
                        value={template.format || ""}
                        onChange={(event) => updateTemplate(index, { format: event.target.value || undefined })}
                        placeholder={inferTemplateFormat(template) || "Alle formater"}
                        aria-label={`Format for ${template.name}`}
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell className="min-w-[170px]">
                      <Input
                        value={template.configuration || ""}
                        onChange={(event) => updateTemplate(index, { configuration: event.target.value || null })}
                        placeholder={inferTemplateConfiguration(template) || "F.eks. 5 mm ryg"}
                        aria-label={`Variant for ${template.name}`}
                        className="h-9"
                      />
                    </TableCell>
                    <TableCell className="min-w-[280px]">
                      <Select
                        value={template.designerTemplateId || "none"}
                        onValueChange={(value) => {
                          const linkedDesignerTemplate = designerTemplates.find((item) => item.id === value);
                          updateTemplate(index, {
                            designerTemplateId: value === "none" ? null : value,
                            widthMm: linkedDesignerTemplate?.width_mm ?? null,
                            heightMm: linkedDesignerTemplate?.height_mm ?? null,
                            bleedMm: linkedDesignerTemplate?.bleed_mm ?? null,
                            safeMm: linkedDesignerTemplate?.safe_area_mm ?? null,
                          });
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Vælg designer-template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Kun download</SelectItem>
                          {designerTemplates.map((designerTemplate) => (
                            <SelectItem key={designerTemplate.id} value={designerTemplate.id}>
                              {designerTemplate.name}
                              {designerTemplate.width_mm && designerTemplate.height_mm
                                ? ` (${designerTemplate.width_mm}×${designerTemplate.height_mm} mm)`
                                : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!template.designerTemplateId ? (
                        <p className="mt-1 text-[11px] text-amber-700">
                          Vælg en template for korrekt artboard og hjælpelinjer.
                        </p>
                      ) : template.widthMm && template.heightMm ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Artboard: {template.widthMm} × {template.heightMm} mm
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" size="sm" onClick={() => window.open(template.url, '_blank')}>
                          <Download className="h-4 w-4" />
                        </Button>
                        {template.designerUrl && (
                          <Button variant="outline" size="sm" onClick={() => window.open(String(template.designerUrl), '_blank')}>
                            Design
                          </Button>
                        )}
                        <Button variant="destructive" size="sm" onClick={() => handleRemoveTemplate(index)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-[150px_170px_minmax(240px,1fr)_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="template-format">Format</Label>
              <Input
                id="template-format"
                value={selectedTemplateFormat}
                onChange={(event) => setSelectedTemplateFormat(event.target.value)}
                placeholder="F.eks. A4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-configuration">Variant</Label>
              <Input
                id="template-configuration"
                value={selectedTemplateConfiguration}
                onChange={(event) => setSelectedTemplateConfiguration(event.target.value)}
                placeholder="F.eks. 5 mm ryg"
              />
            </div>
            <div className="space-y-2">
              <Label>Designer-template</Label>
              <Select value={selectedDesignerTemplateId} onValueChange={setSelectedDesignerTemplateId}>
                <SelectTrigger disabled={designerTemplatesLoading}>
                  <SelectValue placeholder="Vælg designer-template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Kun download</SelectItem>
                  {designerTemplates.map((designerTemplate) => (
                    <SelectItem key={designerTemplate.id} value={designerTemplate.id}>
                      {designerTemplate.name}
                      {designerTemplate.width_mm && designerTemplate.height_mm
                        ? ` (${designerTemplate.width_mm}×${designerTemplate.height_mm} mm)`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
