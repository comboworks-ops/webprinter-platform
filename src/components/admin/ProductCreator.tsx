import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

export function ProductCreator() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    category: "tryksager" as "tryksager" | "storformat",
    pricingType: "matrix" as "matrix" | "rate" | "formula" | "fixed" | "custom-dimensions",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setCreating(true);
    try {
      // Fetch user's tenant id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: tenant } = await supabase
        .from('tenants' as any)
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();

      if (!tenant) throw new Error("No tenant found for user");

      const { error } = await supabase
        .from('products')
        .insert({
          name: formData.name,
          slug: formData.slug,
          description: formData.description,
          category: formData.category,
          pricing_type: formData.pricingType,
          is_published: false,
          tenant_id: (tenant as any).id
        });

      if (error) throw error;

      toast.success("Produkt oprettet succesfuldt!");
      navigate('/admin');
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error('Kunne ikke oprette produkt');
    } finally {
      setCreating(false);
    }
  };

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/æ/g, 'ae')
      .replace(/ø/g, 'oe')
      .replace(/å/g, 'aa')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    setFormData(prev => ({ ...prev, name, slug }));
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <a href="/admin" className="hover:text-foreground transition-colors flex items-center gap-1">
          ← Tilbage til Admin
        </a>
        <span>/</span>
        <span className="text-foreground font-medium">Opret Produkt</span>
      </nav>

      <div>
        <h1 className="text-3xl font-bold">Opret Nyt Produkt</h1>
        <p className="text-muted-foreground">Tilføj et nyt produkt til systemet</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Produktdetaljer</CardTitle>
          <CardDescription>
            Udfyld informationen nedenfor for at oprette et nyt produkt
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Produktnavn *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="F.eks. Flyers, Plakater, etc."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">URL-slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="Genereres automatisk fra navnet"
                required
              />
              <p className="text-sm text-muted-foreground">
                Dette vil være URL'en: /produkter/{formData.slug || "..."}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beskrivelse *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Kort beskrivelse af produktet"
                rows={3}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Kategori *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: "tryksager" | "storformat") =>
                    setFormData(prev => ({ ...prev, category: value }))
                  }
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tryksager">Tryksager</SelectItem>
                    <SelectItem value="storformat">Storformat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pricingType">Pristype *</Label>
                <Select
                  value={formData.pricingType}
                  onValueChange={(value: any) =>
                    setFormData(prev => ({ ...prev, pricingType: value }))
                  }
                >
                  <SelectTrigger id="pricingType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="matrix">Matrix</SelectItem>
                    <SelectItem value="rate">Takst</SelectItem>
                    <SelectItem value="formula">Formel</SelectItem>
                    <SelectItem value="fixed">Fast pris</SelectItem>
                    <SelectItem value="custom-dimensions">Brugerdefinerede dimensioner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setFormData({
                  name: "",
                  slug: "",
                  description: "",
                  category: "tryksager",
                  pricingType: "matrix",
                });
              }}>
                Nulstil
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Opret Produkt
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
