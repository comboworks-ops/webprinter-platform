import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

interface ConfigThumbUploadProps {
  productId: string;
  currentImageUrl: string | null;
  label: string;
  onImageUpdate: (url: string | null) => void;
  onUploadComplete: (url: string | null) => Promise<void>;
}

export function ConfigThumbUpload({
  productId,
  currentImageUrl,
  label,
  onImageUpdate,
  onUploadComplete,
}: ConfigThumbUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const inputId = `config-thumb-${productId}-${label.replace(/\s+/g, "-").toLowerCase()}`;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Kun billeder (JPG, PNG, WEBP) er tilladt");
      return;
    }

    if (file.size > 5242880) {
      toast.error("Billedet må højst være 5MB");
      return;
    }

    try {
      setUploading(true);

      if (currentImageUrl) {
        const oldPath = currentImageUrl.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("product-images").remove([oldPath]);
        }
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${productId}-config-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
      const publicUrl = data.publicUrl;

      await onUploadComplete(publicUrl);
      onImageUpdate(publicUrl);
      toast.success("Miniature uploadet");
    } catch (error) {
      console.error("Error uploading config thumb:", error);
      toast.error("Kunne ikke uploade miniature");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!currentImageUrl) return;

    try {
      setDeleting(true);
      const fileName = currentImageUrl.split("/").pop();
      if (fileName) {
        await supabase.storage.from("product-images").remove([fileName]);
      }

      await onUploadComplete(null);
      onImageUpdate(null);
      toast.success("Miniature slettet");
    } catch (error) {
      console.error("Error deleting config thumb:", error);
      toast.error("Kunne ikke slette miniature");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-md border bg-muted/30 flex items-center justify-center overflow-hidden">
          {currentImageUrl ? (
            <img src={currentImageUrl} alt={label} className="h-full w-full object-cover" />
          ) : (
            <ImagePlus className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1">
          <Input
            id={inputId}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileUpload}
            disabled={uploading}
            className="h-8 text-xs"
          />
        </div>
        {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
        {currentImageUrl && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDeleteImage}
            disabled={deleting}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
