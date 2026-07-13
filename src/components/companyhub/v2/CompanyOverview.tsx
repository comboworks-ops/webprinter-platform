import { useMemo, useState } from "react";
import { ArrowRight, Building2, MapPin, Package, ShoppingBag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanyAddress, CompanyCatalogCategory, CompanyOffice, HubItem } from "@/lib/company-hub";

interface CompanyOverviewProps {
  items: HubItem[];
  offices: CompanyOffice[];
  addresses: CompanyAddress[];
  categories?: CompanyCatalogCategory[];
  isLoading?: boolean;
  showAllProducts?: boolean;
  onOpenProduct: (item: HubItem) => void;
}

export function CompanyOverview({
  items,
  offices,
  addresses,
  categories = [],
  isLoading,
  showAllProducts = false,
  onOpenProduct,
}: CompanyOverviewProps) {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const visibleItems = useMemo(() => {
    const filtered = categoryFilter === "all"
      ? items
      : items.filter((item) => item.category_id === categoryFilter);
    if (showAllProducts) return filtered;
    return [...filtered].sort((left, right) => Number(right.is_featured) - Number(left.is_featured)).slice(0, 4);
  }, [categoryFilter, items, showAllProducts]);

  return (
    <div className="space-y-8 py-6">
      {!showAllProducts && (
        <section aria-labelledby="workspace-summary-heading">
          <h2 id="workspace-summary-heading" className="sr-only">Firmaoversigt</h2>
          <dl className="grid overflow-hidden rounded-md border bg-background sm:grid-cols-3">
            <div className="flex items-center gap-3 border-b px-4 py-4 sm:border-b-0 sm:border-r">
              <Package className="h-5 w-5 text-primary" aria-hidden="true" />
              <div>
                <dt className="text-xs text-muted-foreground">Godkendte produkter</dt>
                <dd className="text-lg font-semibold tabular-nums">{items.length}</dd>
              </div>
            </div>
            <div className="flex items-center gap-3 border-b px-4 py-4 sm:border-b-0 sm:border-r">
              <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
              <div>
                <dt className="text-xs text-muted-foreground">Kontorer</dt>
                <dd className="text-lg font-semibold tabular-nums">{offices.length}</dd>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-4">
              <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
              <div>
                <dt className="text-xs text-muted-foreground">Leveringsadresser</dt>
                <dd className="text-lg font-semibold tabular-nums">{addresses.length}</dd>
              </div>
            </div>
          </dl>
        </section>
      )}

      <section aria-labelledby="workspace-products-heading" className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {showAllProducts ? "Firmaets katalog" : "Hurtig bestilling"}
            </p>
            <h2 id="workspace-products-heading" className="text-lg font-semibold">
              {showAllProducts ? "Produkter" : "Ofte bestilte tryksager"}
            </h2>
          </div>
          {!showAllProducts && items.length > 4 && (
            <span className="text-sm text-muted-foreground">{items.length} produkter i alt</span>
          )}
        </div>

        {showAllProducts && categories.length > 0 && (
          <div className="flex gap-1 overflow-x-auto border-y py-2" aria-label="Filtrér produkter efter kategori">
            <Button size="sm" variant={categoryFilter === "all" ? "secondary" : "ghost"} onClick={() => setCategoryFilter("all")}>Alle</Button>
            {categories.map((category) => (
              <Button key={category.id} size="sm" variant={categoryFilter === category.id ? "secondary" : "ghost"} onClick={() => setCategoryFilter(category.id)}>{category.name}</Button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="aspect-[4/3] w-full rounded-md" />
            ))}
          </div>
        ) : visibleItems.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {visibleItems.map((item) => (
              <article key={item.id} className="group overflow-hidden rounded-md border bg-background">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden border-b bg-muted/30">
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt={item.title}
                      className="h-full w-full object-contain p-3 transition-transform duration-200 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <ShoppingBag className="h-9 w-9 text-muted-foreground/50" aria-hidden="true" />
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{item.title}</h3>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.short_description || item.product_name || "Tryksag"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => onOpenProduct(item)}
                    disabled={!item.product_slug || item.product_is_published === false}
                  >
                    {item.product_is_published === false ? "Midlertidigt utilgængelig" : "Vælg og bestil"}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="flex min-h-44 flex-col items-center justify-center rounded-md border border-dashed bg-muted/15 px-6 text-center">
            <Package className="mb-3 h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
            <h3 className="text-sm font-semibold">Ingen produkter endnu</h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Firmaets administrator kan tilføje godkendte produkter fra Webprinter-kataloget.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
