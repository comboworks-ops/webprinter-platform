import { useMemo, useState } from "react";
import { Archive, Check, Package, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  CompanyCatalogCategory,
  CompanyCatalogStatus,
  CompanyOffice,
  CompanyOfficeScope,
  CompanyProductCandidate,
  CreateCompanyCatalogItemInput,
  CreateCompanyCategoryInput,
  HubItem,
  UpdateCompanyCatalogItemInput,
} from "@/lib/company-hub";

interface SaveCatalogItemPayload {
  itemId?: string;
  input: CreateCompanyCatalogItemInput | UpdateCompanyCatalogItemInput;
  officeIds: string[];
}

interface AdminCompanyCatalogProps {
  items: HubItem[];
  categories: CompanyCatalogCategory[];
  products: CompanyProductCandidate[];
  offices: CompanyOffice[];
  itemOfficeIds: Record<string, string[]>;
  isSaving: boolean;
  onCreateCategory: (input: CreateCompanyCategoryInput) => Promise<void>;
  onSaveItem: (payload: SaveCatalogItemPayload) => Promise<void>;
  onArchiveItem: (itemId: string) => Promise<void>;
}

interface CatalogFormState {
  productId: string;
  title: string;
  shortDescription: string;
  categoryId: string;
  thumbnailUrl: string;
  defaultQuantity: string;
  requiresApproval: boolean;
  isFeatured: boolean;
  officeScope: CompanyOfficeScope;
  status: CompanyCatalogStatus;
  officeIds: string[];
}

const emptyForm: CatalogFormState = {
  productId: "",
  title: "",
  shortDescription: "",
  categoryId: "none",
  thumbnailUrl: "",
  defaultQuantity: "100",
  requiresApproval: false,
  isFeatured: false,
  officeScope: "all",
  status: "draft",
  officeIds: [],
};

const statusLabels: Record<CompanyCatalogStatus, string> = {
  draft: "Klargøring",
  active: "Aktiv",
  archived: "Arkiveret",
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Firmaproduktet kunne ikke gemmes.";
}

export function AdminCompanyCatalog({
  items,
  categories,
  products,
  offices,
  itemOfficeIds,
  isSaving,
  onCreateCategory,
  onSaveItem,
  onArchiveItem,
}: AdminCompanyCatalogProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<HubItem | null>(null);
  const [form, setForm] = useState<CatalogFormState>(emptyForm);
  const [productSearch, setProductSearch] = useState("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<HubItem | null>(null);

  const visibleItems = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("da-DK");
    return items.filter((item) => {
      const matchesSearch = !normalized
        || item.title.toLocaleLowerCase("da-DK").includes(normalized)
        || item.product_name?.toLocaleLowerCase("da-DK").includes(normalized);
      const matchesCategory = categoryFilter === "all" || item.category_id === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [categoryFilter, items, search]);

  const visibleProducts = useMemo(() => {
    const normalized = productSearch.trim().toLocaleLowerCase("da-DK");
    return products.filter((product) => !normalized
      || product.name.toLocaleLowerCase("da-DK").includes(normalized)
      || product.category?.toLocaleLowerCase("da-DK").includes(normalized));
  }, [productSearch, products]);

  const openNew = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setProductSearch("");
    setDialogOpen(true);
  };

  const openEdit = (item: HubItem) => {
    setEditingItem(item);
    setForm({
      productId: item.product_id || "",
      title: item.title,
      shortDescription: item.short_description || "",
      categoryId: item.category_id || "none",
      thumbnailUrl: item.thumbnail_url || "",
      defaultQuantity: String(item.default_quantity || 100),
      requiresApproval: item.requires_approval === true,
      isFeatured: item.is_featured === true,
      officeScope: item.office_scope || "all",
      status: item.status || "active",
      officeIds: itemOfficeIds[item.id] || [],
    });
    setDialogOpen(true);
  };

  const chooseProduct = (product: CompanyProductCandidate) => {
    setForm((current) => ({
      ...current,
      productId: product.id,
      title: current.title || product.name,
      shortDescription: current.shortDescription || product.description || "",
      thumbnailUrl: current.thumbnailUrl || product.image_url || "",
      defaultQuantity: String(product.default_quantity || 100),
    }));
  };

  const toggleOffice = (officeId: string, checked: boolean) => {
    setForm((current) => ({
      ...current,
      officeIds: checked
        ? [...new Set([...current.officeIds, officeId])]
        : current.officeIds.filter((id) => id !== officeId),
    }));
  };

  const saveItem = async () => {
    if (!editingItem && !form.productId) {
      toast.error("Vælg et produkt fra butikken.");
      return;
    }
    if (form.officeScope === "selected" && !form.officeIds.length) {
      toast.error("Vælg mindst ét kontor.");
      return;
    }

    const common = {
      title: form.title,
      shortDescription: form.shortDescription,
      categoryId: form.categoryId === "none" ? null : form.categoryId,
      thumbnailUrl: form.thumbnailUrl,
      defaultQuantity: Number(form.defaultQuantity),
      requiresApproval: form.requiresApproval,
      isFeatured: form.isFeatured,
      officeScope: form.officeScope,
      status: form.status,
    };

    try {
      await onSaveItem({
        itemId: editingItem?.id,
        input: editingItem ? common : { ...common, productId: form.productId },
        officeIds: form.officeIds,
      });
      toast.success(editingItem ? "Firmaproduktet er opdateret" : "Produktet er tilføjet til firmaet");
      setDialogOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const createCategory = async () => {
    try {
      await onCreateCategory({ name: categoryName });
      toast.success("Kategorien er oprettet");
      setCategoryName("");
      setCategoryDialogOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const archiveItem = async () => {
    if (!archiveTarget) return;
    try {
      await onArchiveItem(archiveTarget.id);
      toast.success("Firmaproduktet er arkiveret");
      setArchiveTarget(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <section aria-labelledby="admin-company-catalog-heading" className="py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Kundens udvalg</p>
          <h2 id="admin-company-catalog-heading" className="text-lg font-semibold">Visuelt produktkatalog</h2>
          <p className="mt-1 text-sm text-muted-foreground">Produkterne bruger altid butikkens aktuelle konfiguration og pris.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setCategoryDialogOpen(true)}>Ny kategori</Button>
          <Button size="sm" className="gap-2" onClick={openNew}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Tilføj produkt
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-y py-3 md:flex-row md:items-center">
        <div className="relative min-w-0 flex-1 md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Søg i firmaprodukter" className="pl-9" />
        </div>
        <div className="flex gap-1 overflow-x-auto" aria-label="Filtrér efter kategori">
          <Button size="sm" variant={categoryFilter === "all" ? "secondary" : "ghost"} onClick={() => setCategoryFilter("all")}>Alle</Button>
          {categories.map((category) => (
            <Button key={category.id} size="sm" variant={categoryFilter === category.id ? "secondary" : "ghost"} onClick={() => setCategoryFilter(category.id)}>{category.name}</Button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleItems.map((item) => {
          const category = categories.find((row) => row.id === item.category_id);
          return (
            <article key={item.id} className="overflow-hidden rounded-md border bg-background">
              <div className="flex aspect-[16/9] items-center justify-center overflow-hidden border-b bg-muted/20">
                {item.thumbnail_url ? (
                  <img src={item.thumbnail_url} alt={item.title} className="h-full w-full object-contain p-3" />
                ) : (
                  <Package className="h-9 w-9 text-muted-foreground/50" aria-hidden="true" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{item.title}</h3>
                    <p className="truncate text-xs text-muted-foreground">{category?.name || item.product_category || "Uden kategori"}</p>
                  </div>
                  <span className={`shrink-0 rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${
                    item.status === "active" ? "bg-emerald-50 text-emerald-800" : "bg-muted text-muted-foreground"
                  }`}>{statusLabels[item.status || "active"]}</span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">Aktuel pris ved bestilling</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="Rediger firmaprodukt">
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Rediger {item.title}</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => setArchiveTarget(item)} title="Arkivér firmaprodukt">
                      <Archive className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Arkivér {item.title}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!visibleItems.length && (
        <div className="flex min-h-48 flex-col items-center justify-center border-b text-center">
          <Package className="mb-3 h-9 w-9 text-muted-foreground/50" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Ingen firmaprodukter fundet</h3>
          <p className="mt-1 text-sm text-muted-foreground">Tilføj et eksisterende produkt fra butikkens katalog.</p>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Rediger firmaprodukt" : "Tilføj produkt"}</DialogTitle>
            <DialogDescription>Produktet forbliver forbundet til butikkens eksisterende pris og bestillingsflow.</DialogDescription>
          </DialogHeader>

          {!editingItem && (
            <div className="space-y-3 border-b pb-5">
              <Label>Vælg produkt</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Søg efter produkt eller kategori" className="pl-9" />
              </div>
              <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {visibleProducts.map((product) => {
                  const selected = form.productId === product.id;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      className={`flex min-w-0 items-center gap-3 rounded-md border p-3 text-left transition-colors ${selected ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}
                      onClick={() => chooseProduct(product)}
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                        {product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-contain" /> : <Package className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{product.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">{product.category || "Tryksag"}</span>
                      </span>
                      {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="catalog-title">Visningsnavn</Label>
              <Input id="catalog-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="catalog-description">Kort beskrivelse</Label>
              <Textarea id="catalog-description" value={form.shortDescription} onChange={(event) => setForm({ ...form, shortDescription: event.target.value })} rows={2} />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={form.categoryId} onValueChange={(categoryId) => setForm({ ...form, categoryId })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uden kategori</SelectItem>
                  {categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-quantity">Standardantal</Label>
              <Input id="catalog-quantity" type="number" min={1} step={1} value={form.defaultQuantity} onChange={(event) => setForm({ ...form, defaultQuantity: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(status) => setForm({ ...form, status: status as CompanyCatalogStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Klargøring</SelectItem>
                  <SelectItem value="active">Aktiv</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kontorer</Label>
              <Select value={form.officeScope} onValueChange={(officeScope) => setForm({ ...form, officeScope: officeScope as CompanyOfficeScope })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle kontorer</SelectItem>
                  <SelectItem value="selected">Udvalgte kontorer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.officeScope === "selected" && (
              <fieldset className="space-y-2 rounded-md border p-3 sm:col-span-2">
                <legend className="px-1 text-sm font-medium">Vælg kontorer</legend>
                {offices.map((office) => (
                  <label key={office.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.officeIds.includes(office.id)} onCheckedChange={(checked) => toggleOffice(office.id, checked === true)} />
                    {office.name}
                  </label>
                ))}
              </fieldset>
            )}
            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <Checkbox className="mt-0.5" checked={form.requiresApproval} onCheckedChange={(checked) => setForm({ ...form, requiresApproval: checked === true })} />
              <span><span className="block font-medium">Kræver godkendelse</span><span className="block text-xs text-muted-foreground">Bestillingen sendes til en godkender først.</span></span>
            </label>
            <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
              <Checkbox className="mt-0.5" checked={form.isFeatured} onCheckedChange={(checked) => setForm({ ...form, isFeatured: checked === true })} />
              <span><span className="block font-medium">Vis på overblik</span><span className="block text-xs text-muted-foreground">Produktet fremhæves i hurtig bestilling.</span></span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuller</Button>
            <Button onClick={saveItem} disabled={isSaving}>Gem firmaprodukt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ny kategori</DialogTitle>
            <DialogDescription>Kategorien gør produktudvalget lettere at finde rundt i.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="category-name">Navn</Label>
            <Input id="category-name" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Salgsmateriale" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>Annuller</Button>
            <Button onClick={createCategory} disabled={isSaving}>Opret kategori</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arkivér {archiveTarget?.title}?</AlertDialogTitle>
            <AlertDialogDescription>Produktet forsvinder fra kundens aktive katalog, mens historikken bevares.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuller</AlertDialogCancel>
            <AlertDialogAction onClick={archiveItem}>Arkivér</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
