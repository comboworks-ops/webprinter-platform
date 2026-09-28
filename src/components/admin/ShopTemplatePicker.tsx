import { Check, LayoutTemplate, Menu } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SHOP_NAVIGATION_OPTIONS,
  SHOP_TEMPLATES,
  type ShopNavigationPreset,
  type ShopTemplateDefinition,
  type ShopTemplateId,
  type StorefrontSectionId,
} from "@/lib/storefront/shopTemplates";

interface ShopTemplatePickerProps {
  selectedTemplateId: ShopTemplateId;
  selectedNavigationPreset: ShopNavigationPreset;
  onSelect: (template: ShopTemplateDefinition) => void;
  onNavigationPresetChange: (preset: ShopNavigationPreset) => void;
  onClose?: () => void;
}

const SECTION_PREVIEW_STYLES: Record<
  StorefrontSectionId,
  { height: string; background: string }
> = {
  hero: { height: "34%", background: "var(--primary)" },
  products: { height: "24%", background: "var(--foreground)" },
  usp: { height: "10%", background: "var(--secondary)" },
  banner2: { height: "15%", background: "var(--muted-foreground)" },
  content: { height: "18%", background: "var(--muted)" },
  seo: { height: "8%", background: "var(--border)" },
};

function TemplateMiniature({ template }: { template: ShopTemplateDefinition }) {
  const visibleSections = template.layout.sectionOrder.slice(0, 4);
  const productColumns = template.recipe.productCollection === "rapid-list"
    || template.recipe.productCollection === "menu-list"
    ? 2
    : template.recipe.productCollection === "market-grid"
      ? 5
      : template.recipe.productCollection === "campaign-grid"
        ? 4
        : 3;

  return (
    <div
      className="h-[82px] overflow-hidden rounded-md border bg-background"
      aria-hidden="true"
    >
      <div
        className={`flex h-3 items-center gap-1 border-b bg-card px-1.5 ${
          template.recipe.header.alignment === "center" ? "justify-center" : ""
        }`}
      >
        <span className="h-1 w-4 rounded-full bg-foreground/75" />
        <span className={template.recipe.header.alignment === "center" ? "h-1 w-2.5 rounded-full bg-muted-foreground/45" : "ml-auto h-1 w-2.5 rounded-full bg-muted-foreground/45"} />
        <span className="h-1 w-2.5 rounded-full bg-muted-foreground/45" />
      </div>
      <div
        className={`flex h-[69px] flex-col gap-px p-1 ${
          template.layout.heroTreatment === "inset" ? "px-2" : ""
        }`}
      >
        {visibleSections.map((sectionId) => {
          const style = SECTION_PREVIEW_STYLES[sectionId];
          if (sectionId === "products") {
            return (
              <span
                key={sectionId}
                className="grid min-h-[18px] gap-px"
                style={{ gridTemplateColumns: `repeat(${productColumns}, minmax(0, 1fr))` }}
              >
                {Array.from({ length: productColumns }).map((_, index) => (
                  <i
                    key={index}
                    className={`block border border-foreground/20 bg-card ${
                      template.recipe.productCard === "editorial"
                      || template.recipe.productCard === "gallery"
                        ? "border-x-0 border-b-0"
                        : "rounded-[1px]"
                    }`}
                  >
                    <b className="mx-auto mt-0.5 block h-1.5 w-3/4 bg-muted" />
                    <b className="mx-0.5 mt-0.5 block h-0.5 bg-foreground/50" />
                  </i>
                ))}
              </span>
            );
          }
          return (
            <span
              key={sectionId}
              className={`block min-h-1 opacity-80 ${
                sectionId === "hero" && template.layout.heroTreatment === "framed"
                  ? "rounded-sm border-2 border-background ring-1 ring-border"
                  : "rounded-[2px]"
              }`}
              style={{
                height: style.height,
                background: style.background,
              }}
              title={sectionId}
            />
          );
        })}
      </div>
    </div>
  );
}

export function ShopTemplatePicker({
  selectedTemplateId,
  selectedNavigationPreset,
  onSelect,
  onNavigationPresetChange,
  onClose,
}: ShopTemplatePickerProps) {
  return (
    <div className="space-y-3 px-3 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Shopdesign</h3>
          <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
            Vælg en samlet butiksoplevelse. Produkter, priser og brandindhold bevares.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <LayoutTemplate className="h-4 w-4 text-primary" />
          {onClose ? (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClose}>
              Luk
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SHOP_TEMPLATES.map((template) => {
          const isSelected = selectedTemplateId === template.id;

          return (
            <button
              key={template.id}
              type="button"
              aria-pressed={isSelected}
              className={`min-w-0 cursor-pointer rounded-md border p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                isSelected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border/70 bg-card hover:border-primary/50 hover:bg-muted/30"
              }`}
              onClick={() => onSelect(template)}
            >
              <TemplateMiniature template={template} />

              <div className="mt-2 flex min-w-0 items-start gap-1">
                <span className="min-w-0 flex-1 text-[11px] font-semibold leading-4">
                  {template.name}
                </span>
                {isSelected ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                ) : null}
              </div>

              <Badge
                variant="outline"
                className="mt-1 h-4 max-w-full rounded-sm px-1 text-[9px] font-medium"
              >
                {template.category}
              </Badge>

              <p className="mt-1.5 line-clamp-3 text-[10px] leading-[1.35] text-muted-foreground">
                {template.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="space-y-2 rounded-md border bg-muted/25 p-2.5">
        <div className="flex items-center gap-2">
          <Menu className="h-3.5 w-3.5 text-muted-foreground" />
          <Label htmlFor="shop-navigation-preset" className="text-[11px] font-semibold">
            Produktmenu
          </Label>
        </div>
        <Select
          value={selectedNavigationPreset}
          onValueChange={(value) => onNavigationPresetChange(value as ShopNavigationPreset)}
        >
          <SelectTrigger id="shop-navigation-preset" className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {!SHOP_NAVIGATION_OPTIONS.some(option => option.id === selectedNavigationPreset) && (
              <SelectItem value={selectedNavigationPreset}>Nuværende menu · {selectedNavigationPreset}</SelectItem>
            )}
            {SHOP_NAVIGATION_OPTIONS.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] leading-4 text-muted-foreground">
          {SHOP_NAVIGATION_OPTIONS.find((option) => option.id === selectedNavigationPreset)?.description}
        </p>
      </div>

      <div className="rounded-md border bg-muted/25 p-2.5 text-[10px] leading-4 text-muted-foreground">
        Shopdesign styrer katalog, produktside, bestilling, checkout og footer. Produktmenuen
        vælges separat og bevares, når du skifter shopdesign. Temaet styrer farver og typografi.
      </div>
    </div>
  );
}
