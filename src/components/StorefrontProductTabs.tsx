import { useEffect, useMemo, useState } from "react";
import ProductGrid from "@/components/ProductGrid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStorefrontCatalog } from "@/hooks/useStorefrontCatalog";
import { cn } from "@/lib/utils";

type StorefrontProductTabsProps = {
  columns?: 3 | 4 | 5;
  buttonConfig?: {
    style?: "default" | "bar" | "center" | "hidden";
    bgColor?: string;
    hoverBgColor?: string;
    textColor?: string;
    hoverTextColor?: string;
    font?: string;
    animation?: "none" | "lift" | "glow" | "pulse";
  };
  layoutStyle?: "cards" | "flat" | "grouped" | "slim";
  backgroundConfig?: {
    type?: "solid" | "gradient";
    color?: string;
    gradientStart?: string;
    gradientEnd?: string;
    gradientAngle?: number;
    opacity?: number;
  };
  showCategoryTabs?: boolean;
  variant?: "default" | "glass";
};

export function StorefrontProductTabs({
  columns = 4,
  buttonConfig,
  layoutStyle = "cards",
  backgroundConfig,
  showCategoryTabs = true,
  variant = "default",
}: StorefrontProductTabsProps) {
  const { products, categories, loading, errorMessage, warningMessage } = useStorefrontCatalog();

  const visibleCategories = useMemo(() => {
    if (categories.length > 0) return categories;
    return [{ key: "tryksager", label: "Tryksager", sortOrder: 0 }];
  }, [categories]);

  const [selectedCategory, setSelectedCategory] = useState<string>(visibleCategories[0]?.key || "tryksager");

  useEffect(() => {
    if (!visibleCategories.length) return;
    const hasCurrent = visibleCategories.some((category) => category.key === selectedCategory);
    if (!hasCurrent) {
      const preferred = visibleCategories.find((category) => category.key === "tryksager") || visibleCategories[0];
      setSelectedCategory(preferred.key);
    }
  }, [selectedCategory, visibleCategories]);

  const shouldRenderTabs = showCategoryTabs && visibleCategories.length > 1;
  const firstCategory = visibleCategories[0]?.key || "tryksager";
  const tabsValue = selectedCategory || firstCategory;
  const gridProps = {
    products,
    loadingOverride: loading,
    errorMessageOverride: errorMessage,
    warningMessageOverride: warningMessage,
    columns,
    buttonConfig,
    layoutStyle,
    backgroundConfig,
  };

  if (!shouldRenderTabs) {
    return <ProductGrid category={firstCategory} {...gridProps} />;
  }

  const useCompactGrid = visibleCategories.length === 2 && variant === "default";

  return (
    <Tabs value={tabsValue} onValueChange={setSelectedCategory} className="w-full">
      {variant === "glass" ? (
        <div
          className="w-full max-w-4xl mx-auto mb-16 p-1.5 rounded-2xl"
          style={{
            background: "rgba(255, 255, 255, 0.7)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.5)",
          }}
        >
          <TabsList className="flex w-full flex-wrap justify-center gap-2 bg-transparent h-auto p-0">
            {visibleCategories.map((category) => (
              <TabsTrigger
                key={category.key}
                value={category.key}
                className="rounded-xl py-3 px-6 font-medium transition-all data-[state=active]:shadow-lg data-[state=active]:!bg-white data-[state=inactive]:!bg-transparent data-[state=active]:!text-gray-900 !text-gray-600"
              >
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      ) : (
        <TabsList
          className={cn(
            "mb-12 mx-auto h-auto",
            useCompactGrid
              ? "grid w-full max-w-md grid-cols-2"
              : "flex w-full max-w-4xl flex-wrap justify-center gap-2 bg-transparent p-0"
          )}
        >
          {visibleCategories.map((category) => (
            <TabsTrigger
              key={category.key}
              value={category.key}
              className={cn(!useCompactGrid && "rounded-full border px-4 py-2")}
            >
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>
      )}

      {visibleCategories.map((category) => (
        <TabsContent key={category.key} value={category.key} id={category.key}>
          <ProductGrid category={category.key} {...gridProps} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
