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
import { resolveAdminTenant } from "@/lib/adminTenant";
import { Switch } from "@/components/ui/switch";
import { STANDARD_FORMATS } from "@/utils/formatStandards";

export function ProductCreator() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    description: "",
    category: "tryksager" as "tryksager" | "storformat",
    pricingType: "matrix" as "matrix" | "rate" | "formula" | "fixed" | "custom-dimensions" | "machine-priced",
    width: "210",
    height: "297",
    bleed: "3",
    minDpi: "300",
    isFreeForm: false,
    standardFormat: "A4",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.slug) {
      toast.error("Navn og URL-slug skal udfyldes");
      return;
    }

    setCreating(true);
    try {
      const { tenantId } = await resolveAdminTenant();
      if (!tenantId) throw new Error("Ingen tenant fundet for brugeren");

      // 1. Insert the product
      const { data: productData, error: productError } = await supabase
        .from('products')
        .insert({
          name: formData.name,
          slug: formData.slug,
          description: formData.description,
          category: formData.category,
          pricing_type: formData.pricingType === 'machine-priced' ? 'matrix' : formData.pricingType,
          is_published: false,
          tenant_id: tenantId,
          technical_specs: {
            width_mm: parseFloat(formData.width) || null,
            height_mm: parseFloat(formData.height) || null,
            bleed_mm: parseFloat(formData.bleed) || null,
            min_dpi: parseInt(formData.minDpi) || null,
            is_free_form: formData.isFreeForm,
            standard_format: formData.standardFormat
          }
        })
        .select()
        .single();

      if (productError) {
        if (productError.code === '23505') {
          throw new Error("URL-slug findes allerede. Vælg venligst et andet navn eller slug.");
        }
        throw productError;
      }

      // 2. If machine-priced, initialize the config
      if (formData.pricingType === 'machine-priced' && productData) {
        const { error: mpaError } = await supabase
          .from('product_pricing_configs' as any)
          .insert({
            product_id: productData.id,
            tenant_id: tenantId,
            pricing_type: 'MACHINE_PRICED',
            allowed_sides: '4+0_AND_4+4',
            quantities: [50, 100, 250, 500, 1000],
            bleed_mm: parseFloat(formData.bleed) || 3,
            gap_mm: 2
          });

        if (mpaError) {
          console.error('Error creating MPA config:', mpaError);
          toast.warning("Produkt oprettet, men kunne ikke initialisere maskin-beregning. Du kan gøre det manuelt i pris-styring.");
        }
      }

      toast.success("Produkt oprettet succesfuldt!");
      navigate(`/admin/produkter/${formData.slug}`);
    } catch (error: any) {
      console.error('Error creating product:', error);
      toast.error(error.message || 'Kunne ikke oprette produkt. Prøv venligst igen.');
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
                <Label htmlFor="pricingType">Pristype (Beregningsmetode) *</Label>
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
                    <SelectItem value="machine-priced">Maskin-beregning (MPA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 border-t pt-6 mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold text-primary">Preflight & Format (3mm Bleed)</Label>
                  <p className="text-sm text-muted-foreground">Sæt standardmål og beskæring for dette produkt.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="free-form" className="text-sm font-medium">Fripas / Fri format</Label>
                  <Switch
                    id="free-form"
                    checked={formData.isFreeForm}
                    onCheckedChange={(checked) => setFormData(prev => ({
                      ...prev,
                      isFreeForm: checked,
                      standardFormat: checked ? "" : prev.standardFormat
                    }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="standard-format">Vælg Standard Størrelse (A4, A5 osv.)</Label>
                    <Select
                      value={formData.standardFormat}
                      onValueChange={(value) => {
                        const format = STANDARD_FORMATS.find(f => f.id === value);
                        if (format && value !== 'custom') {
                          setFormData(prev => ({
                            ...prev,
                            standardFormat: value,
                            width: format.width.toString(),
                            height: format.height.toString()
                          }));
                        } else if (value === 'custom') {
                          setFormData(prev => ({
                            ...prev,
                            standardFormat: 'custom',
                            isFreeForm: true
                          }));
                        }
                      }}
                    >
                      <SelectTrigger id="standard-format">
                        <SelectValue placeholder="Vælg format..." />
                      </SelectTrigger>
                      <SelectContent>
                        {STANDARD_FORMATS.map(f => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="width">Bredde (mm)</Label>
                      <Input
                        id="width"
                        type="number"
                        value={formData.width}
                        onChange={(e) => setFormData(prev => ({ ...prev, width: e.target.value, standardFormat: "" }))}
                        placeholder="210"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="height">Højde (mm)</Label>
                      <Input
                        id="height"
                        type="number"
                        value={formData.height}
                        onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value, standardFormat: "" }))}
                        placeholder="297"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="bleed">Bleed (mm)</Label>
                      <Input
                        id="bleed"
                        type="number"
                        value={formData.bleed}
                        onChange={(e) => setFormData(prev => ({ ...prev, bleed: e.target.value }))}
                        placeholder="3"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minDpi">Min. DPI</Label>
                      <Input
                        id="minDpi"
                        type="number"
                        value={formData.minDpi}
                        onChange={(e) => setFormData(prev => ({ ...prev, minDpi: e.target.value }))}
                        placeholder="300"
                      />
                    </div>
                  </div>
                </div>

                {/* Visual Preview */}
                <div className="bg-slate-50 p-6 rounded-xl border flex items-center justify-center min-h-[200px]">
                  <div className="text-center w-full">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-4">Visuel Preflight Guide</p>
                    <div
                      className="relative bg-white border shadow-sm mx-auto flex items-center justify-center transition-all duration-300"
                      style={{
                        width: '120px',
                        height: `${(parseFloat(formData.height) / parseFloat(formData.width)) * 120 || 160}px`,
                        maxHeight: '200px'
                      }}
                    >
                      {/* Bleed line */}
                      <div
                        className="absolute border border-red-500 border-dashed pointer-events-none"
                        style={{
                          top: `${(parseFloat(formData.bleed) / (parseFloat(formData.height) + parseFloat(formData.bleed) * 2)) * 100}%`,
                          bottom: `${(parseFloat(formData.bleed) / (parseFloat(formData.height) + parseFloat(formData.bleed) * 2)) * 100}%`,
                          left: `${(parseFloat(formData.bleed) / (parseFloat(formData.width) + parseFloat(formData.bleed) * 2)) * 100}%`,
                          right: `${(parseFloat(formData.bleed) / (parseFloat(formData.width) + parseFloat(formData.bleed) * 2)) * 100}%`,
                        }}
                      />
                      <div className="text-[8px] text-slate-400 font-medium">Design Område</div>
                    </div>
                    <p className="text-[10px] text-red-500 font-bold mt-2">Rød linje = Beskæring (Bleed)</p>
                    {!formData.isFreeForm && formData.standardFormat && (
                      <p className="text-[10px] text-slate-500 font-medium mt-1">Valgt: {STANDARD_FORMATS.find(f => f.id === formData.standardFormat)?.name}</p>
                    )}
                  </div>
                </div>
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
                  width: "210",
                  height: "297",
                  bleed: "3",
                  minDpi: "300",
                  isFreeForm: false,
                  standardFormat: "A4",
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
