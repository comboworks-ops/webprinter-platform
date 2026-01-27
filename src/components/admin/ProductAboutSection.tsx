import { useState, useEffect } from "react";
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
import { Loader2, Save, Upload, X, Download, FileText } from "lucide-react";


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

export function ProductAboutSection({
  productId,
  productSlug,
  aboutTitle,
  aboutDescription,
  aboutImageUrl,

  templateFiles,
  onUpdate
}: ProductAboutSectionProps) {
  const [title, setTitle] = useState(aboutTitle || "");
  const [description, setDescription] = useState(aboutDescription || "");
  const [imageUrl, setImageUrl] = useState(aboutImageUrl || "");

  const [templates, setTemplates] = useState<TemplateFile[]>(templateFiles || []);
  const [uploading, setUploading] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTemplateFormat, setSelectedTemplateFormat] = useState<string>("");

  const availableFormats = productSlug ? formatOptions[productSlug] || [] : [];

  useEffect(() => {
    setTemplates(templateFiles || []);
  }, [templateFiles]);

  // Update local state if props change (e.g. after fetch)


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

      const { error } = await supabase
        .from('products')
        .update({
          about_title: title || null,
          about_description: description || null,
          about_image_url: imageUrl || null,
          template_files: templatesForStorage as any,

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

    JSON.stringify(templates) !== JSON.stringify(templateFiles || []);

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
