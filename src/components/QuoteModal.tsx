import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

interface QuoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productName: string;
  productSpecs?: string;
  estimatedPrice?: string;
}

const QuoteModal = ({ open, onOpenChange, productName, productSpecs, estimatedPrice }: QuoteModalProps) => {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [wantsCall, setWantsCall] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({
        title: t("loginRequired"),
        description: t("loginRequiredDescription"),
        variant: "destructive",
      });
      onOpenChange(false);
      return;
    }

    // Validation
    if (!phone || phone.length !== 8) {
      toast({
        title: "Fejl",
        description: "Indtast et gyldigt 8-cifret telefonnummer.",
        variant: "destructive",
      });
      return;
    }

    if (!email || !email.includes("@")) {
      toast({
        title: "Fejl",
        description: "Indtast en gyldig e-mail adresse.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-quote-emails', {
        body: {
          phone,
          email,
          wantsCall,
          productName,
          productSpecs,
          estimatedPrice,
        },
      });

      if (error) {
        console.error("Error sending emails:", error);
        throw error;
      }

      console.log("Emails sent successfully:", data);

      toast({
        title: "Tak for din forespørgsel!",
        description: "Vi har sendt dig en mail med dit tilbud og de valgte specifikationer. Kontakt os på 71 99 11 10 eller support@webprinter.dk ved spørgsmål.",
      });

      // Reset and close
      setPhone("");
      setEmail("");
      setWantsCall(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Failed to send emails:", error);
      toast({
        title: "Der opstod en fejl",
        description: "Vi kunne ikke sende din forespørgsel. Prøv venligst igen eller kontakt os direkte på 71 99 11 10.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send forespørgsel / få tilbud</DialogTitle>
          <DialogDescription>
            Indtast dine kontaktoplysninger – du modtager straks dit tilbud på e-mail.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Telefonnummer *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="12345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 8))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail *</Label>
            <Input
              id="email"
              type="email"
              placeholder="din@email.dk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="wantsCall"
              checked={wantsCall}
              onCheckedChange={(checked) => setWantsCall(checked as boolean)}
            />
            <Label
              htmlFor="wantsCall"
              className="text-sm font-normal cursor-pointer"
            >
              Jeg ønsker, at I kontakter mig telefonisk.
            </Label>
          </div>

          <p className="text-sm text-muted-foreground">
            Du modtager automatisk dit tilbud pr. mail. Hvis du har afkrydset feltet,
            vil vi kontakte dig for rådgivning eller bekræftelse.
          </p>

          {estimatedPrice && (
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium">Produkt: {productName}</p>
              {productSpecs && <p className="text-sm text-muted-foreground">{productSpecs}</p>}
              <p className="text-lg font-heading font-semibold text-primary mt-2">
                Estimeret pris: {estimatedPrice}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={isLoading}>
              Annuller
            </Button>
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? "Sender..." : "Send forespørgsel"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default QuoteModal;
