import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Loader2, Trash2 } from "lucide-react";

interface ProductImageUploadProps {
  productId: string;
  currentImageUrl: string | null;
  onImageUpdate: (newImageUrl: string) => void;
  label?: string;
  onUploadComplete?: (url: string | null) => Promise<void>;
}

export function ProductImageUpload({
  productId,
  currentImageUrl,
  onImageUpdate,
  label = "Produktbillede",
  onUploadComplete
}: ProductImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Kun billeder (JPG, PNG, WEBP) er tilladt');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5242880) {
      toast.error('Billedet må højst være 5MB');
      return;
    }

    try {
      setUploading(true);

      // Delete old image if exists
      if (currentImageUrl) {
        const oldPath = currentImageUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('product-images').remove([oldPath]);
        }
      }

      // Upload new image
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      const publicUrl = data.publicUrl;

      // Update database
      if (onUploadComplete) {
        await onUploadComplete(publicUrl);
      } else {
        const { error: updateError } = await supabase
          .from('products')
          .update({ image_url: publicUrl })
          .eq('id', productId);

        if (updateError) throw updateError;
      }

      toast.success('Billede uploadet');
      onImageUpdate(publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Kunne ikke uploade billede');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!currentImageUrl) return;

    try {
      setDeleting(true);

      // Delete from storage
      const fileName = currentImageUrl.split('/').pop();
      if (fileName) {
        await supabase.storage.from('product-images').remove([fileName]);
      }

      // Update database
      if (onUploadComplete) {
        await onUploadComplete(null);
      } else {
        const { error } = await supabase
          .from('products')
          .update({ image_url: null })
          .eq('id', productId);

        if (error) throw error;
      }

      toast.success('Billede slettet');
      onImageUpdate('');
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Kunne ikke slette billede');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Label htmlFor={`product-image-${label.replace(/\s+/g, '-')}`}>{label}</Label>
          <Input
            id={`product-image-${label.replace(/\s+/g, '-')}`}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileUpload}
            disabled={uploading}
            className="mt-2"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Maks 5MB. Format: JPG, PNG, WEBP
          </p>
        </div>
        {uploading && <Loader2 className="h-5 w-5 animate-spin" />}
      </div>

      {currentImageUrl && (
        <div className="space-y-2">
          <Label>Nuværende billede</Label>
          <div className="flex items-start gap-4">
            <img
              src={currentImageUrl}
              alt="Product"
              className="w-32 h-32 object-cover rounded border"
            />
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteImage}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Slet billede
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
