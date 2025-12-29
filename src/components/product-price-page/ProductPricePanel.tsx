import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { deliveryFee } from "@/utils/productPricing";
import { Download } from "lucide-react";
import jsPDF from "jspdf";

type ProductPricePanelProps = {
  productId: string;
  quantity: number;
  productPrice: number;
  extraPrice?: number;
  onShippingChange?: (type: string | null, cost: number) => void;
  summary?: string;
  optionSelections?: Record<string, { optionId: string; name: string; extraPrice: number; priceMode: "fixed" | "per_quantity" | "per_area" }>;
  selectedVariant?: string;
  productName?: string;
  productSlug: string;
  selectedFormat?: string;
};

export function ProductPricePanel({
  productId,
  quantity,
  productPrice,
  extraPrice = 0,
  onShippingChange,
  summary,
  optionSelections,
  selectedVariant,
  productName,
  productSlug,
  selectedFormat
}: ProductPricePanelProps) {
  const navigate = useNavigate();
  const [shippingSelected, setShippingSelected] = useState<string>("standard");

  const baseTotal = productPrice + extraPrice;
  const standardCost = deliveryFee(baseTotal, "standard");
  const expressCost = deliveryFee(baseTotal, "express");

  // Notify parent of shipping cost whenever it changes
  useEffect(() => {
    if (baseTotal > 0) {
      const cost = shippingSelected === "standard" ? standardCost : expressCost;
      onShippingChange?.(shippingSelected, cost);
    }
  }, [baseTotal, shippingSelected, standardCost, expressCost, onShippingChange]);

  const totalPrice = baseTotal + (baseTotal > 0 ? (shippingSelected === "standard" ? standardCost : expressCost) : 0);

  const generatePDF = () => {
    const doc = new jsPDF();

    // Colors (converted from HSL 199 79% 46%)
    const primaryBlue = [24, 144, 184]; // RGB
    const lightBlue = [210, 236, 245]; // Light blue background
    const darkGray = [34, 43, 54]; // Dark text

    // Header with blue background
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(0, 0, 210, 40, 'F');

    // Logo/Company name
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('Webprinter.dk', 20, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Professionel print til konkurrencedygtige priser', 20, 28);

    // Date in header
    doc.setFontSize(9);
    doc.text(`Dato: ${new Date().toLocaleDateString('da-DK')}`, 150, 35);

    // Reset text color
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);

    let yPos = 55;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.text('TILBUD', 20, yPos);
    yPos += 15;

    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);

    // Product info box
    doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.roundedRect(15, yPos - 5, 180, productName ? 15 : 10, 2, 2, 'F');

    if (productName) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`Produkt: ${productName}`, 20, yPos + 5);
      yPos += 20;
    } else {
      yPos += 15;
    }

    // Configuration section
    if (summary) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.text('Konfiguration', 20, yPos);
      yPos += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      const summaryLines = doc.splitTextToSize(summary, 170);
      summaryLines.forEach((line: string) => {
        doc.text(line, 20, yPos);
        yPos += 5;
      });
      yPos += 5;
    }

    // Variant
    if (selectedVariant) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Materiale/Variant: `, 20, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(selectedVariant, 60, yPos);
      yPos += 8;
    }

    // Options section
    if (optionSelections && Object.keys(optionSelections).length > 0) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.text('Tilvalg', 20, yPos);
      yPos += 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
      Object.values(optionSelections).forEach((option) => {
        doc.text(`✓ ${option.name}`, 25, yPos);
        doc.text(`${option.extraPrice} kr`, 180, yPos, { align: 'right' });
        yPos += 5;
      });
      yPos += 8;
    }

    // Price breakdown box
    doc.setFillColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.roundedRect(15, yPos - 3, 180, 40 + (extraPrice > 0 ? 5 : 0), 2, 2, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.text('Priser (ex. moms)', 20, yPos + 5);
    yPos += 12;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text('Produktpris:', 20, yPos);
    doc.text(`${productPrice} kr`, 180, yPos, { align: 'right' });
    yPos += 6;

    if (extraPrice > 0) {
      doc.text('Tilvalg i alt:', 20, yPos);
      doc.text(`${extraPrice} kr`, 180, yPos, { align: 'right' });
      yPos += 6;
    }

    doc.text(`Levering (${shippingSelected === "standard" ? "Standard: 6-9 arb. dage" : "Express: 3-5 arb. dage"}):`, 20, yPos);
    doc.text(`${shippingSelected === "standard" ? standardCost : expressCost} kr`, 180, yPos, { align: 'right' });
    yPos += 12;

    // Total in box
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.roundedRect(15, yPos - 3, 180, 12, 2, 2, 'F');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('TOTAL PRIS EX. MOMS:', 20, yPos + 6);
    doc.text(`${totalPrice} kr`, 180, yPos + 6, { align: 'right' });

    yPos += 20;

    // VAT info
    doc.setFontSize(9);
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.setFont('helvetica', 'italic');
    doc.text(`Pris inkl. 25% moms: ${Math.round(totalPrice * 1.25)} kr`, 20, yPos);

    // Footer
    doc.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.setLineWidth(0.5);
    doc.line(20, 270, 190, 270);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Dette tilbud er gyldigt i 30 dage. Alle priser er ex. moms.', 105, 278, { align: 'center' });
    doc.text('Webprinter.dk | info@webprinter.dk', 105, 283, { align: 'center' });

    // Download
    doc.save(`tilbud-${productName || 'webprinter'}-${new Date().getTime()}.pdf`);
  };

  const handleOrderClick = () => {
    navigate('/checkout/konfigurer', {
      state: {
        productId,
        quantity,
        productPrice,
        extraPrice,
        totalPrice,
        summary,
        optionSelections,
        selectedVariant,
        productName,
        productSlug,
        selectedFormat,
        shippingSelected,
        shippingCost: shippingSelected === "standard" ? standardCost : expressCost
      }
    });
  };

  return (
    <div className="sticky top-24 bg-primary/5 border-2 border-primary/20 rounded-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-heading font-semibold">Prisberegning</h3>
        {baseTotal > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={generatePDF}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Download tilbud
          </Button>
        )}
      </div>

      {/* Summary Section */}
      {(summary || (optionSelections && Object.keys(optionSelections).length > 0)) && (
        <div className="pb-4 mb-4 border-b border-primary/10">
          <p className="text-sm font-medium text-foreground mb-2">Valgt konfiguration:</p>
          {summary && (
            <p className="text-sm text-muted-foreground">{summary}</p>
          )}
          {optionSelections && Object.keys(optionSelections).length > 0 && (
            <div className="text-sm text-muted-foreground space-y-0.5 mt-1">
              {Object.values(optionSelections).map((option, idx) => (
                <p key={idx}>+ {option.name}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Product price */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Pris ex. moms</p>
            <p className="text-3xl font-heading font-bold text-primary">
              {baseTotal > 0 ? `${baseTotal} kr` : "-"}
            </p>
          </div>
          {baseTotal > 0 && (
            <Button
              size="lg"
              className="px-6 py-6 text-lg font-semibold"
              onClick={handleOrderClick}
            >
              Bestil nu!
            </Button>
          )}

          {/* Design Online Button */}
          {baseTotal > 0 && (
            <Button
              variant="outline"
              size="lg"
              className="w-full gap-2 py-5 border-dashed border-2"
              onClick={() => {
                const params = new URLSearchParams();
                params.set('productId', productId);
                if (selectedFormat) params.set('format', selectedFormat);
                if (selectedVariant) params.set('variant', selectedVariant);
                navigate(`/designer?${params.toString()}`);
              }}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
              Design online
            </Button>
          )}
        </div>
      </div>

      {/* Delivery options - Always Visible */}
      {baseTotal > 0 && (
        <div className="space-y-3 pt-4">
          <Label className="text-base font-semibold">Levering</Label>
          <RadioGroup value={shippingSelected} onValueChange={setShippingSelected} className="space-y-2">
            <div className={`flex items-center space-x-2 p-3 border rounded-md transition-colors ${shippingSelected === "standard" ? "bg-primary/5 border-primary" : "bg-background"}`}>
              <RadioGroupItem value="standard" id="standard" />
              <Label htmlFor="standard" className="cursor-pointer flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Standard levering: 6-9 arb. dage</span>
                  <span className="font-semibold text-primary text-sm">{standardCost} kr</span>
                </div>
              </Label>
            </div>
            <div className={`flex items-center space-x-2 p-3 border rounded-md transition-colors ${shippingSelected === "express" ? "bg-primary/5 border-primary" : "bg-background"}`}>
              <RadioGroupItem value="express" id="express" />
              <Label htmlFor="express" className="cursor-pointer flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Express levering: 3-5 arb. dage</span>
                  <span className="font-semibold text-primary text-sm">{expressCost} kr</span>
                </div>
              </Label>
            </div>
          </RadioGroup>

          <div className="flex justify-between items-end pt-4 border-t border-primary/20">
            <span className="text-sm text-muted-foreground">Samlet pris ex. moms:</span>
            <span className="text-3xl font-heading font-bold text-primary">{totalPrice} kr</span>
          </div>
        </div>
      )}

      {baseTotal === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Vælg en pris i matrixen for at se beregning
        </p>
      )}
    </div>
  );
}
