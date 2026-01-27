import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, ArrowLeft, Check, Globe, ChevronDown } from "lucide-react";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { ProductPresetSelector, PresetKey } from "./ProductPresetSelector";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

interface Category {
  id: string;
  name: string;
  slug: string;
  is_published?: boolean;
}

// Default categories (always shown)
const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: "Tryksager", slug: "tryksager", is_published: true },
  { name: "Storformat", slug: "storformat", is_published: true },
];

export function ProductCreator() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryPublished, setNewCategoryPublished] = useState(true);
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    category: "tryksager",
    presetKey: "custom" as PresetKey,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { tenantId } = await resolveAdminTenant();
      if (!tenantId) return;

      const { data, error } = await supabase
        .from('product_categories' as any)
        .select('id, name, slug, is_published')
        .eq('tenant_id', tenantId)
        .order('sort_order');

      if (error) throw error;

      const dbCategories = (data as unknown as Category[]) || [];
      const mergedCategories: Category[] = [...dbCategories];

      DEFAULT_CATEGORIES.forEach(defaultCat => {
        if (!mergedCategories.find(c => c.slug === defaultCat.slug)) {
          mergedCategories.push({ ...defaultCat, id: defaultCat.slug });
        }
      });

      setCategories(mergedCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories(DEFAULT_CATEGORIES.map(c => ({ ...c, id: c.slug })));
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    setAddingCategory(true);
    try {
      const { tenantId } = await resolveAdminTenant();
      if (!tenantId) throw new Error("No tenant");

      const slug = newCategoryName
        .toLowerCase()
        .replace(/æ/g, 'ae')
        .replace(/ø/g, 'oe')
        .replace(/å/g, 'aa')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const { data, error } = await supabase
        .from('product_categories' as any)
        .insert({
          tenant_id: tenantId,
          name: newCategoryName.trim(),
          slug,
          sort_order: categories.length + 1,
          is_published: newCategoryPublished
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error("Kategori med dette navn findes allerede");
        }
        throw error;
      }

      toast.success(`Kategori "${newCategoryName}" oprettet`);
      const newCat = data as unknown as Category;
      setCategories(prev => [...prev, newCat]);
      setFormData(prev => ({ ...prev, category: newCat.slug }));
      setNewCategoryName("");
      setNewCategoryPublished(true);
      setCategoryDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Kunne ikke oprette kategori");
    } finally {
      setAddingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error("Produktnavn skal udfyldes");
      return;
    }

    const finalSlug = formData.slug.trim() || formData.name
      .toLowerCase()
      .replace(/æ/g, 'ae')
      .replace(/ø/g, 'oe')
      .replace(/å/g, 'aa')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    setCreating(true);
    try {
      const { tenantId } = await resolveAdminTenant();
      if (!tenantId) throw new Error("Ingen tenant fundet for brugeren");

      const { error: productError } = await supabase
        .from('products')
        .insert({
          name: formData.name.trim(),
          icon_text: formData.name.trim(),
          slug: finalSlug,
          description: "",
          category: formData.category,
          pricing_type: "matrix",
          is_published: false,
          tenant_id: tenantId,
          preset_key: formData.presetKey,
          technical_specs: {
            width_mm: 210,
            height_mm: 297,
            bleed_mm: 3,
            min_dpi: 300,
            is_free_form: false,
            standard_format: "A4"
          }
        });

      if (productError) {
        if (productError.code === '23505') {
          throw new Error("URL-slug findes allerede. Vælg venligst et andet navn.");
        }
        throw productError;
      }

      toast.success("Produkt oprettet! Du kan nu konfigurere det.");
      navigate(`/admin/product/${finalSlug}`);
    } catch (error: any) {
      console.error('Error creating product:', error);
      toast.error(error.message || 'Kunne ikke oprette produkt.');
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

  // Count online categories
  const onlineCategories = categories.filter(c => c.is_published !== false);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Button
        variant="ghost"
        onClick={() => navigate('/admin/products')}
        className="mb-0"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Tilbage til Produkter
      </Button>

      <div>
        <h1 className="text-3xl font-bold">Opret Nyt Produkt</h1>
        <p className="text-muted-foreground">Vælg produkttype og tilføj grundlæggende oplysninger</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Preset Selection with Category Expansion */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vælg Produkttype</CardTitle>
            <CardDescription>
              Vælg den type produkt der passer bedst. Ved manuel opsætning vælger du kategori nedenfor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ProductPresetSelector
              value={formData.presetKey}
              onChange={(key) => setFormData(prev => ({ ...prev, presetKey: key }))}
            />

            {/* Category Selection - Expands when "custom" is selected */}
            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                formData.presetKey === "custom"
                  ? "max-h-[500px] opacity-100"
                  : "max-h-0 opacity-0"
              )}
            >
              <div className="pt-4 border-t space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      <ChevronDown className="h-4 w-4" />
                      Vælg Kategori
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Produktet placeres i denne kategori på butikken
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-green-500" />
                    <span className="text-muted-foreground">
                      {onlineCategories.length} kategori{onlineCategories.length !== 1 ? 'er' : ''} online
                    </span>
                  </div>
                </div>

                {/* Online Categories Info */}
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Globe className="h-4 w-4 text-green-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200">
                        Live kategorier på butikken
                      </p>
                      <p className="text-xs text-green-700 dark:text-green-300">
                        {onlineCategories.map(c => c.name).join(', ')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Category Buttons */}
                <div className="flex flex-wrap gap-3">
                  {loadingCategories ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Indlæser...
                    </div>
                  ) : (
                    <>
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, category: cat.slug }))}
                          className={cn(
                            "relative flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 transition-all",
                            "hover:border-primary/50 hover:bg-primary/5",
                            formData.category === cat.slug
                              ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                              : "border-border bg-card"
                          )}
                        >
                          {cat.is_published !== false && (
                            <Globe className="h-3.5 w-3.5 text-green-500" />
                          )}
                          <span className="font-medium">{cat.name}</span>
                          {formData.category === cat.slug && (
                            <Check className="h-4 w-4 text-primary ml-1" />
                          )}
                        </button>
                      ))}

                      {/* Add Category */}
                      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                        <DialogTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all"
                          >
                            <Plus className="h-4 w-4" />
                            <span>Ny kategori</span>
                          </button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Tilføj ny kategori</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="new-category">Kategorinavn</Label>
                              <Input
                                id="new-category"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="F.eks. Tekstil, Emballage..."
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddCategory();
                                  }
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label htmlFor="category-published">Vis på frontend</Label>
                                <p className="text-xs text-muted-foreground">Gør kategorien synlig i butikken</p>
                              </div>
                              <Switch
                                id="category-published"
                                checked={newCategoryPublished}
                                onCheckedChange={setNewCategoryPublished}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setCategoryDialogOpen(false)}
                            >
                              Annuller
                            </Button>
                            <Button
                              type="button"
                              onClick={handleAddCategory}
                              disabled={addingCategory || !newCategoryName.trim()}
                            >
                              {addingCategory && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Opret
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Produktdetaljer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <Label htmlFor="slug">URL-slug (valgfrit)</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="Genereres automatisk fra navnet"
              />
              <p className="text-xs text-muted-foreground">
                URL: /produkt/{formData.slug || "..."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/products')}
          >
            Annuller
          </Button>
          <Button type="submit" disabled={creating || !formData.name.trim()}>
            {creating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Opret Produkt
          </Button>
        </div>
      </form>
    </div>
  );
}
