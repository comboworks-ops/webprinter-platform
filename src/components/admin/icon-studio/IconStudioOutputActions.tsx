import { useMemo, useState } from "react";
import { Download, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  applyIconStudioOutputToProduct,
  downloadIconStudioOutput,
} from "@/lib/icon-studio/service";
import type { IconStudioJobOutputRow, IconStudioProductTarget } from "@/lib/icon-studio/types";

interface IconStudioOutputActionsProps {
  tenantId: string;
  output: IconStudioJobOutputRow;
  products: IconStudioProductTarget[];
  onProductImageApplied: (productId: string, imageUrl: string) => void;
}

export function IconStudioOutputActions({
  tenantId,
  output,
  products,
  onProductImageApplied,
}: IconStudioOutputActionsProps) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [applying, setApplying] = useState(false);
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId],
  );

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadIconStudioOutput(output);
    } catch (error) {
      console.error("Could not download Icon Studio output", error);
      toast.error(error instanceof Error ? error.message : "Billedet kunne ikke downloades.");
    } finally {
      setDownloading(false);
    }
  };

  const handleApply = async () => {
    if (!selectedProduct) return;

    if (selectedProduct.image_url) {
      const confirmed = window.confirm(
        `Produktet "${selectedProduct.name}" har allerede et billede. Vil du erstatte det?`,
      );
      if (!confirmed) return;
    }

    setApplying(true);
    try {
      const imageUrl = await applyIconStudioOutputToProduct({
        tenantId,
        output,
        productId: selectedProduct.id,
      });
      onProductImageApplied(selectedProduct.id, imageUrl);
      toast.success(`Billedet bruges nu på ${selectedProduct.name}.`);
    } catch (error) {
      console.error("Could not apply Icon Studio output", error);
      toast.error(error instanceof Error ? error.message : "Billedet kunne ikke tilknyttes produktet.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-3 border-t pt-3">
      <Button variant="outline" size="sm" className="w-full" onClick={() => void handleDownload()} disabled={downloading}>
        {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        Download billede
      </Button>

      <div className="space-y-2">
        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
          <SelectTrigger aria-label="Vælg produkt">
            <SelectValue placeholder="Vælg et produkt" />
          </SelectTrigger>
          <SelectContent>
            {products.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.name}{product.image_url ? " · har billede" : " · mangler billede"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="w-full" onClick={() => void handleApply()} disabled={!selectedProduct || applying}>
          {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
          Brug som produktbillede
        </Button>
      </div>
    </div>
  );
}
