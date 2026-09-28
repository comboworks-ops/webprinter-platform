import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { standardUpload } from "@/lib/storage/standardUpload";
import { saveProductImageReference } from "@/lib/storage/productImageReference";
import { readLocalImage } from "@/lib/storage/readLocalImage";

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
  const busy = useRef(false);
  const [progress, setProgress] = useState(0);
  const [preparing, setPreparing] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || busy.current) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Kun billeder (JPG, PNG, WEBP) er tilladt');
      input.value = '';
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5242880) {
      toast.error('Billedet må højst være 5MB');
      input.value = '';
      return;
    }

    try {
      busy.current = true;
      setUploading(true);
      setProgress(0);
      setPreparing(true);

      const localFile = await readLocalImage(file);

      // Keep the current image until the new upload and product update both succeed.
      const fileExt = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
      const fileName = `${productId}-${crypto.randomUUID()}.${fileExt}`;
      const {data: sessionData, error: sessionError} = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error('Log ind igen for at ændre produktbilledet.');
      setPreparing(false);
      await standardUpload({
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        bucket: 'product-images', path: fileName, file: localFile,
        headers: {apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${sessionData.session.access_token}`},
        onProgress: ({loaded, total}) => setProgress(Math.round(loaded / total * 100)),
      });

      const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
      const publicUrl = data.publicUrl;

      // Update database
      if (onUploadComplete) {
        await onUploadComplete(publicUrl);
      } else {
        await saveProductImageReference(supabase, productId, publicUrl);
      }

      onImageUpdate(publicUrl);
      toast.success('Billede uploadet');
    } catch (error) {
      console.error('Error uploading image:', error);
      const message = error instanceof Error ? error.message : '';
      toast.error(message.startsWith('Filen kan ikke læses') ? message
        : /timeout|temporarily paused|failed to fetch/i.test(message)
          ? 'Billedlageret svarer ikke. Dit nuværende billede er bevaret. Prøv igen om lidt.'
          : 'Kunne ikke uploade billede. Dit nuværende billede er bevaret.');
    } finally {
      input.value = '';
      setUploading(false);
      setPreparing(false);
      busy.current = false;
    }
  };

  const handleDeleteImage = async () => {
    if (!currentImageUrl || busy.current) return;

    try {
      busy.current = true;
      setDeleting(true);

      // Detach first. Cloned products may share the same asset; never delete it
      // before the product update or make this action depend on storage uptime.
      // Update database
      if (onUploadComplete) {
        await onUploadComplete(null);
      } else {
        await saveProductImageReference(supabase, productId, null);
      }

      toast.success('Billede slettet');
      onImageUpdate('');
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Kunne ikke slette billede');
    } finally {
      setDeleting(false);
      busy.current = false;
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
            disabled={uploading || deleting}
            className="mt-2"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Maks 5MB. Format: JPG, PNG, WEBP
          </p>
        </div>
        {uploading && <span role="status" className="flex items-center gap-2 text-sm tabular-nums"><Loader2 className="h-5 w-5 motion-safe:animate-spin" />{preparing ? 'Klargør fil…' : `${progress}%`}</span>}
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
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteImage}
              disabled={uploading || deleting}
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
