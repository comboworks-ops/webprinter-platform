import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { usePreviewBranding } from "@/contexts/PreviewBrandingContext";
import ProductGrid from "@/components/ProductGrid";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { useStorefrontCatalog, type StorefrontProduct } from "@/hooks/useStorefrontCatalog";
import { isCategoryLandingProduct } from "@/lib/catalog/categoryLanding";
import { cn } from "@/lib/utils";
import {
  normalizeProductCategoryKey,
  normalizeProductOverviewKey,
  type ProductCategoryRecord,
  type ProductOverviewRecord,
} from "@/utils/productCategories";

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
  categoryTabsConfig?: {
    font?: string;
    borderRadiusPx?: number;
    textColor?: string;
    hoverTextColor?: string;
    activeTextColor?: string;
    bgColor?: string;
    hoverBgColor?: string;
    activeBgColor?: string;
    borderColor?: string;
    activeBorderColor?: string;
  };
  showCategoryTabs?: boolean;
  variant?: "default" | "glass";
  hiddenProductIds?: string[];
};

const FALLBACK_OVERVIEW_ID = "__default_overview__";
const FALLBACK_OVERVIEW_NAME = "Produkter";
const ALL_OVERVIEWS_ID = "__all_overviews__";
const DEFAULT_CATEGORY_TABS_CONFIG = {
  font: "Inter",
  borderRadiusPx: 100,
  textColor: "#1F2937",
  hoverTextColor: "#1F2937",
  activeTextColor: "#FFFFFF",
  bgColor: "#FFFFFF",
  hoverBgColor: "#F8FAFC",
  activeBgColor: "#0EA5E9",
  borderColor: "#E2E8F0",
  activeBorderColor: "#0EA5E9",
};

type TaxonomyCategory = ProductCategoryRecord & {
  id: string;
  overview_id: string;
  navigation_mode: "all_in_one" | "submenu";
  sort_order: number;
};

const buildFallbackOverview = (): ProductOverviewRecord => ({
  id: FALLBACK_OVERVIEW_ID,
  name: FALLBACK_OVERVIEW_NAME,
  slug: "produkter",
  sort_order: 0,
});

const withCategoryLandingTarget = (
  product: StorefrontProduct,
  overview: ProductOverviewRecord | undefined,
  category: TaxonomyCategory | undefined,
  subcategory?: TaxonomyCategory | undefined,
): StorefrontProduct => ({
  ...product,
  technical_specs: {
    ...(product.technical_specs || {}),
    category_landing: {
      enabled: true,
      overviewId: overview?.id || null,
      overviewSlug: overview?.slug || normalizeProductOverviewKey(overview?.name || ""),
      categoryId: category?.id || null,
      categorySlug: category?.slug || normalizeProductCategoryKey(category?.name || ""),
      subcategoryId: subcategory?.id || null,
      subcategorySlug: subcategory?.slug || normalizeProductCategoryKey(subcategory?.name || ""),
    },
  },
});

export function StorefrontProductTabs({
  columns = 4,
  buttonConfig,
  layoutStyle = "cards",
  backgroundConfig,
  categoryTabsConfig,
  showCategoryTabs = true,
  variant = "default",
  hiddenProductIds = [],
}: StorefrontProductTabsProps) {
  const {
    products,
    categories,
    categoryRecords,
    overviews,
    loading,
    errorMessage,
    warningMessage,
  } = useStorefrontCatalog();
  const location = useLocation();
  const { isPreviewMode, previewPath } = usePreviewBranding();
  const [searchParams, setSearchParams] = useSearchParams();
  const pathname = isPreviewMode && previewPath ? previewPath : location.pathname;
  const isCategoryRoute = pathname === "/produkter";
  const resolvedCategoryTabsConfig = {
    ...DEFAULT_CATEGORY_TABS_CONFIG,
    ...(categoryTabsConfig || {}),
  };
  const categoryTabRadius = Math.max(0, Math.min(100, resolvedCategoryTabsConfig.borderRadiusPx ?? 100));
  const overviewParam = searchParams.get("overview");
  const categoryParam = searchParams.get("category");
  const subcategoryParam = searchParams.get("subcategory");
  const hiddenProductIdSet = useMemo(() => new Set(hiddenProductIds.filter(Boolean)), [hiddenProductIds]);
  const visibleProducts = useMemo(() => {
    const baseProducts = hiddenProductIdSet.size
      ? products.filter((product) => !hiddenProductIdSet.has(product.id))
      : products;

    if (!isCategoryRoute) return baseProducts;
    return baseProducts.filter((product) => !isCategoryLandingProduct(product));
  }, [products, hiddenProductIdSet, isCategoryRoute]);

  const normalizedOverviews = useMemo<ProductOverviewRecord[]>(() => {
    const base = overviews.length > 0 ? overviews : [buildFallbackOverview()];
    return [...base].sort((a, b) => {
      const orderA = a.sort_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, "da");
    });
  }, [overviews]);

  const normalizedCategories = useMemo<TaxonomyCategory[]>(() => {
    return categoryRecords
      .filter((category): category is TaxonomyCategory & { id: string } => Boolean(category.id))
      .map((category) => ({
        ...category,
        id: category.id as string,
        overview_id: category.overview_id || FALLBACK_OVERVIEW_ID,
        navigation_mode: category.navigation_mode || "all_in_one",
        sort_order: category.sort_order ?? Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.name.localeCompare(b.name, "da");
      });
  }, [categoryRecords]);

  const hierarchyEnabled = normalizedCategories.length > 0;

  const categoryById = useMemo(
    () => new Map(normalizedCategories.map((category) => [category.id, category])),
    [normalizedCategories],
  );
  const productById = useMemo(
    () => new Map(visibleProducts.map((product) => [product.id, product])),
    [visibleProducts],
  );

  const childrenByParentId = useMemo(() => {
    const map = new Map<string, TaxonomyCategory[]>();
    normalizedCategories.forEach((category) => {
      const parentId = category.parent_category_id || "__root__";
      const existing = map.get(parentId) || [];
      existing.push(category);
      map.set(parentId, existing);
    });
    return map;
  }, [normalizedCategories]);

  const descendantIdsByCategoryId = useMemo(() => {
    const map = new Map<string, string[]>();

    const walk = (categoryId: string): string[] => {
      const children = childrenByParentId.get(categoryId) || [];
      const descendants = [categoryId];
      children.forEach((child) => {
        descendants.push(...walk(child.id));
      });
      map.set(categoryId, descendants);
      return descendants;
    };

    normalizedCategories.forEach((category) => {
      if (!map.has(category.id)) {
        walk(category.id);
      }
    });

    return map;
  }, [childrenByParentId, normalizedCategories]);

  const directProductCountByCategoryId = useMemo(() => {
    const map = new Map<string, number>();
    visibleProducts.forEach((product) => {
      if (!product.categoryId) return;
      map.set(product.categoryId, (map.get(product.categoryId) || 0) + 1);
    });
    return map;
  }, [visibleProducts]);

  const branchProductCountByCategoryId = useMemo(() => {
    const map = new Map<string, number>();
    normalizedCategories.forEach((category) => {
      const descendants = descendantIdsByCategoryId.get(category.id) || [category.id];
      const total = descendants.reduce((sum, id) => sum + (directProductCountByCategoryId.get(id) || 0), 0);
      map.set(category.id, total);
    });
    return map;
  }, [descendantIdsByCategoryId, directProductCountByCategoryId, normalizedCategories]);

  const visibleOverviews = useMemo(() => {
    if (!hierarchyEnabled) return [];
    const overviewIdsWithProducts = new Set(
      normalizedCategories
        .filter((category) => (branchProductCountByCategoryId.get(category.id) || 0) > 0)
        .map((category) => category.overview_id),
    );

    const matched = normalizedOverviews.filter((overview) => overviewIdsWithProducts.has(overview.id));
    return matched.length > 0 ? matched : [buildFallbackOverview()];
  }, [branchProductCountByCategoryId, hierarchyEnabled, normalizedCategories, normalizedOverviews]);

  const [selectedOverviewId, setSelectedOverviewId] = useState<string>(ALL_OVERVIEWS_ID);
  const [selectedRootCategoryId, setSelectedRootCategoryId] = useState<string>("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string>("");

  useEffect(() => {
    if (!hierarchyEnabled) return;
    if (visibleOverviews.length === 0) return;

    if (!isCategoryRoute) {
      const hasCurrent = selectedOverviewId === ALL_OVERVIEWS_ID
        || visibleOverviews.some((overview) => overview.id === selectedOverviewId);
      if (!hasCurrent) {
        setSelectedOverviewId(ALL_OVERVIEWS_ID);
      }
      return;
    }

    const matchFromQuery = isCategoryRoute && overviewParam
      ? visibleOverviews.find((overview) => normalizeProductOverviewKey(overview.slug || overview.name) === normalizeProductOverviewKey(overviewParam))
      : null;
    if (matchFromQuery) {
      if (matchFromQuery.id !== selectedOverviewId) {
        setSelectedOverviewId(matchFromQuery.id);
      }
      return;
    }

    const hasCurrent = visibleOverviews.some((overview) => overview.id === selectedOverviewId);
    if (!hasCurrent) {
      const fallback = visibleOverviews[0];
      if (fallback && fallback.id !== selectedOverviewId) {
        setSelectedOverviewId(fallback.id);
      }
    }
  }, [hierarchyEnabled, isCategoryRoute, overviewParam, selectedOverviewId, visibleOverviews]);

  const rootCategories = useMemo(() => {
    if (!hierarchyEnabled) return [];
    if (selectedOverviewId === ALL_OVERVIEWS_ID) return [];
    return normalizedCategories.filter(
      (category) =>
        category.overview_id === selectedOverviewId
        && !category.parent_category_id
        && (branchProductCountByCategoryId.get(category.id) || 0) > 0,
    );
  }, [branchProductCountByCategoryId, hierarchyEnabled, normalizedCategories, selectedOverviewId]);

  useEffect(() => {
    if (!hierarchyEnabled) return;
    const matchFromQuery = isCategoryRoute && categoryParam
      ? rootCategories.find((category) => normalizeProductCategoryKey(category.slug || category.name) === normalizeProductCategoryKey(categoryParam))
      : null;
    const hasCurrent = rootCategories.some((category) => category.id === selectedRootCategoryId);
    if (matchFromQuery) {
      if (matchFromQuery.id !== selectedRootCategoryId) {
        setSelectedRootCategoryId(matchFromQuery.id);
      }
      return;
    }
    if (!hasCurrent) {
      setSelectedRootCategoryId("");
    }
  }, [categoryParam, hierarchyEnabled, isCategoryRoute, rootCategories, selectedRootCategoryId]);

  const selectedRootCategory = useMemo(
    () => rootCategories.find((category) => category.id === selectedRootCategoryId) || null,
    [rootCategories, selectedRootCategoryId],
  );

  const childCategories = useMemo(() => {
    if (!selectedRootCategory) return [];
    return (childrenByParentId.get(selectedRootCategory.id) || []).filter(
      (category) => (branchProductCountByCategoryId.get(category.id) || 0) > 0,
    );
  }, [branchProductCountByCategoryId, childrenByParentId, selectedRootCategory]);
  const selectedOverview = useMemo(
    () => visibleOverviews.find((overview) => overview.id === selectedOverviewId),
    [selectedOverviewId, visibleOverviews],
  );
  const rootCategoryLeadProducts = useMemo(() => {
    if (!hierarchyEnabled || !selectedOverview) return [];

    return rootCategories
      .map((category) => {
        if (!category.frontend_product_id) return null;
        const product = productById.get(category.frontend_product_id);
        if (!product) return null;
        return withCategoryLandingTarget(product, selectedOverview, category);
      })
      .filter((product): product is StorefrontProduct => Boolean(product));
  }, [hierarchyEnabled, productById, rootCategories, selectedOverview]);
  const childCategoryLeadProducts = useMemo(() => {
    if (!selectedOverview || !selectedRootCategory || childCategories.length === 0) return [];

    return childCategories
      .map((category) => {
        if (!category.frontend_product_id) return null;
        const product = productById.get(category.frontend_product_id);
        if (!product) return null;
        return withCategoryLandingTarget(product, selectedOverview, selectedRootCategory, category);
      })
      .filter((product): product is StorefrontProduct => Boolean(product));
  }, [childCategories, productById, selectedOverview, selectedRootCategory]);

  useEffect(() => {
    if (!selectedRootCategory) {
      if (selectedSubcategoryId) setSelectedSubcategoryId("");
      return;
    }
    const matchFromQuery = isCategoryRoute && subcategoryParam
      ? childCategories.find((category) => normalizeProductCategoryKey(category.slug || category.name) === normalizeProductCategoryKey(subcategoryParam))
      : null;
    const hasCurrent = childCategories.some((category) => category.id === selectedSubcategoryId);
    if (matchFromQuery) {
      if (matchFromQuery.id !== selectedSubcategoryId) {
        setSelectedSubcategoryId(matchFromQuery.id);
      }
      return;
    }
    if (!hasCurrent) {
      setSelectedSubcategoryId("");
    }
  }, [childCategories, isCategoryRoute, selectedRootCategory, selectedSubcategoryId, subcategoryParam]);

  useEffect(() => {
    if (!isCategoryRoute || !hierarchyEnabled) return;
    const matchedOverviewFromRoute = overviewParam
      ? visibleOverviews.find((overview) => normalizeProductOverviewKey(overview.slug || overview.name) === normalizeProductOverviewKey(overviewParam))
      : null;
    const matchedCategoryFromRoute = categoryParam
      ? rootCategories.find((category) => normalizeProductCategoryKey(category.slug || category.name) === normalizeProductCategoryKey(categoryParam))
      : null;
    const matchedSubcategoryFromRoute = subcategoryParam
      ? childCategories.find((category) => normalizeProductCategoryKey(category.slug || category.name) === normalizeProductCategoryKey(subcategoryParam))
      : null;

    const routeOverviewNeedsHydration = Boolean(
      matchedOverviewFromRoute && matchedOverviewFromRoute.id !== selectedOverviewId,
    );
    const routeCategoryNeedsHydration = Boolean(
      matchedCategoryFromRoute && matchedCategoryFromRoute.id !== selectedRootCategory?.id,
    );
    const routeSubcategoryNeedsHydration = Boolean(
      matchedSubcategoryFromRoute && matchedSubcategoryFromRoute.id !== selectedSubcategoryId,
    );

    if (routeOverviewNeedsHydration || routeCategoryNeedsHydration || routeSubcategoryNeedsHydration) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    const selectedOverview = visibleOverviews.find((overview) => overview.id === selectedOverviewId);
    if (selectedOverview) {
      next.set("overview", selectedOverview.slug || normalizeProductOverviewKey(selectedOverview.name));
    } else {
      next.delete("overview");
    }

    if (selectedRootCategory) {
      next.set("category", selectedRootCategory.slug || normalizeProductCategoryKey(selectedRootCategory.name));
    } else {
      next.delete("category");
      next.delete("subcategory");
    }

    if (selectedSubcategoryId) {
      const selectedChild = childCategories.find((category) => category.id === selectedSubcategoryId);
      if (selectedChild) {
        next.set("subcategory", selectedChild.slug || normalizeProductCategoryKey(selectedChild.name));
      }
    } else {
      next.delete("subcategory");
    }

    const current = searchParams.toString();
    const upcoming = next.toString();
    if (current !== upcoming) {
      setSearchParams(next, { replace: true });
    }
  }, [
    categoryParam,
    childCategories,
    hierarchyEnabled,
    isCategoryRoute,
    overviewParam,
    rootCategories,
    searchParams,
    selectedOverviewId,
    selectedRootCategory,
    selectedSubcategoryId,
    setSearchParams,
    subcategoryParam,
    visibleOverviews,
  ]);

  const gridProps = {
    loadingOverride: loading,
    errorMessageOverride: errorMessage,
    warningMessageOverride: warningMessage,
    columns,
    buttonConfig,
    layoutStyle,
    backgroundConfig,
  };

  const categoryTabStyleVars = useMemo(() => ({
    "--category-tab-bg": resolvedCategoryTabsConfig.bgColor,
    "--category-tab-text": resolvedCategoryTabsConfig.textColor,
    "--category-tab-hover-bg": resolvedCategoryTabsConfig.hoverBgColor,
    "--category-tab-hover-text": resolvedCategoryTabsConfig.hoverTextColor,
    "--category-tab-active-bg": resolvedCategoryTabsConfig.activeBgColor,
    "--category-tab-active-text": resolvedCategoryTabsConfig.activeTextColor,
    "--category-tab-border": resolvedCategoryTabsConfig.borderColor,
    "--category-tab-active-border": resolvedCategoryTabsConfig.activeBorderColor,
    fontFamily: `'${resolvedCategoryTabsConfig.font}', sans-serif`,
    borderRadius: `${categoryTabRadius}px`,
  }) as CSSProperties, [categoryTabRadius, resolvedCategoryTabsConfig]);

  const categoryTabGroupStyle = useMemo(() => ({
    borderRadius: `${categoryTabRadius}px`,
  }) as CSSProperties, [categoryTabRadius]);

  const categoryTabBaseClassName = cn(
    "border px-4 py-2 text-sm transition-colors duration-200",
    "bg-[var(--category-tab-bg)] text-[var(--category-tab-text)] border-[var(--category-tab-border)]",
    "hover:bg-[var(--category-tab-hover-bg)] hover:text-[var(--category-tab-hover-text)]",
  );

  const categoryTabActiveClassName = "bg-[var(--category-tab-active-bg)] text-[var(--category-tab-active-text)] border-[var(--category-tab-active-border)] hover:bg-[var(--category-tab-active-bg)] hover:text-[var(--category-tab-active-text)]";

  const productsForBranch = useMemo(() => {
    if (!hierarchyEnabled) return visibleProducts;

    const overviewProducts = selectedOverviewId === ALL_OVERVIEWS_ID
      ? visibleProducts
      : visibleProducts.filter((product) => {
        const overviewId = product.categoryOverviewId || FALLBACK_OVERVIEW_ID;
        return overviewId === selectedOverviewId;
      });

    if (!selectedRootCategory) return overviewProducts;

    if (selectedSubcategoryId) {
      const validIds = new Set(descendantIdsByCategoryId.get(selectedSubcategoryId) || [selectedSubcategoryId]);
      return overviewProducts.filter((product) => product.categoryId && validIds.has(product.categoryId));
    }

    if (childCategories.length > 0 && selectedRootCategory.navigation_mode === "submenu") {
      return [];
    }

    const validIds = new Set(descendantIdsByCategoryId.get(selectedRootCategory.id) || [selectedRootCategory.id]);
    return overviewProducts.filter((product) => product.categoryId && validIds.has(product.categoryId));
  }, [
    childCategories.length,
    descendantIdsByCategoryId,
    hierarchyEnabled,
    selectedOverviewId,
    selectedRootCategory,
    selectedSubcategoryId,
    visibleOverviews,
    visibleProducts,
  ]);

  const legacyVisibleCategories = useMemo(() => {
    const categoriesWithProducts = categories.filter((category) =>
      visibleProducts.some((product) => product.categoryKey === category.key),
    );
    if (categoriesWithProducts.length > 0) return categoriesWithProducts;
    return [{ key: "tryksager", label: "Tryksager", sortOrder: 0 }];
  }, [categories, visibleProducts]);

  const [legacySelectedCategory, setLegacySelectedCategory] = useState<string>(legacyVisibleCategories[0]?.key || "tryksager");

  useEffect(() => {
    if (hierarchyEnabled) return;
    if (!legacyVisibleCategories.length) return;
    const hasCurrent = legacyVisibleCategories.some((category) => category.key === legacySelectedCategory);
    if (!hasCurrent) {
      const preferred = legacyVisibleCategories.find((category) => category.key === "tryksager") || legacyVisibleCategories[0];
      setLegacySelectedCategory(preferred.key);
    }
  }, [hierarchyEnabled, legacySelectedCategory, legacyVisibleCategories]);

  const overviewTabs = useMemo(() => {
    if (!showCategoryTabs) return [];
    if (visibleOverviews.length === 0) return [];
    if (isCategoryRoute) return visibleOverviews;
    return [
      { id: ALL_OVERVIEWS_ID, name: "Alle produkter", slug: "alle-produkter", sort_order: -1 },
      ...visibleOverviews,
    ];
  }, [isCategoryRoute, showCategoryTabs, visibleOverviews]);

  const renderOverviewTabs = (overviewOptions: ProductOverviewRecord[], value: string, onChange: (value: string) => void) => {
    const useCompactGrid = overviewOptions.length === 2 && variant === "default";
    return (
      <Tabs value={value} onValueChange={onChange} className="w-full" data-branding-id="forside.products.categories">
        {variant === "glass" ? (
          <div
            className="w-full max-w-4xl mx-auto mb-10 p-1.5"
            style={{
              background: "rgba(255, 255, 255, 0.7)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.5)",
              ...categoryTabGroupStyle,
            }}
          >
            <TabsList className="flex w-full flex-wrap justify-center gap-2 bg-transparent h-auto p-0">
              {overviewOptions.map((overview) => (
                <TabsTrigger
                  key={overview.id}
                  value={overview.id}
                  data-branding-id="forside.products.categories.button"
                  style={categoryTabStyleVars}
                  className={cn(
                    categoryTabBaseClassName,
                    "py-3 px-6 font-medium transition-all data-[state=active]:shadow-lg",
                    "data-[state=active]:bg-[var(--category-tab-active-bg)] data-[state=active]:text-[var(--category-tab-active-text)] data-[state=active]:border-[var(--category-tab-active-border)]",
                  )}
                >
                  {overview.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        ) : (
          <TabsList
            data-branding-id="forside.products.categories"
            style={useCompactGrid ? categoryTabGroupStyle : undefined}
            className={cn(
              "mb-8 mx-auto h-auto flex w-full flex-wrap justify-center gap-2 bg-transparent p-0",
              useCompactGrid
                ? "max-w-md"
                : "max-w-4xl",
            )}
          >
            {overviewOptions.map((overview) => (
              <TabsTrigger
                key={overview.id}
                value={overview.id}
                data-branding-id="forside.products.categories.button"
                style={categoryTabStyleVars}
                className={cn(
                  categoryTabBaseClassName,
                  useCompactGrid && "min-w-[180px] flex-1",
                  "data-[state=active]:bg-[var(--category-tab-active-bg)] data-[state=active]:text-[var(--category-tab-active-text)] data-[state=active]:border-[var(--category-tab-active-border)]",
                )}
              >
                {overview.name}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
      </Tabs>
    );
  };

  if (!hierarchyEnabled) {
    const shouldRenderTabs = showCategoryTabs && legacyVisibleCategories.length > 1;
    const firstCategory = legacyVisibleCategories[0]?.key || "tryksager";

    if (!shouldRenderTabs) {
      return <ProductGrid category={firstCategory} products={visibleProducts} {...gridProps} />;
    }

    return (
      <div className="w-full">
        {renderOverviewTabs(
          legacyVisibleCategories.map((category) => ({
            id: category.key,
            name: category.label,
            slug: category.key,
            sort_order: category.sortOrder,
          })),
          legacySelectedCategory || firstCategory,
          setLegacySelectedCategory,
        )}
        <ProductGrid category={legacySelectedCategory || firstCategory} products={visibleProducts} {...gridProps} />
      </div>
    );
  }

  const shouldRenderOverviewTabs = overviewTabs.length > 1;
  const showRootCategoryCards = !selectedRootCategory && rootCategoryLeadProducts.length > 0;
  const showRootCategoryNav = rootCategories.length > 0;
  const childNavMode = selectedRootCategory?.navigation_mode || "all_in_one";
  const showChildCategoryCards = Boolean(
    selectedRootCategory
    && childNavMode === "submenu"
    && !selectedSubcategoryId
    && childCategoryLeadProducts.length > 0,
  );
  const showChildCategoryNav = Boolean(selectedRootCategory && childCategories.length > 0);

  return (
    <div className="space-y-6">
      {shouldRenderOverviewTabs && renderOverviewTabs(overviewTabs, selectedOverviewId, (nextOverviewId) => {
        setSelectedOverviewId(nextOverviewId);
        setSelectedRootCategoryId("");
        setSelectedSubcategoryId("");
      })}

      {showRootCategoryNav && (
        <div className="flex flex-wrap items-center gap-2" data-branding-id="forside.products.categories">
          <button
            type="button"
            onClick={() => {
              setSelectedRootCategoryId("");
              setSelectedSubcategoryId("");
            }}
            data-branding-id="forside.products.categories.button"
            style={categoryTabStyleVars}
            className={cn(
              categoryTabBaseClassName,
              !selectedRootCategory && categoryTabActiveClassName,
            )}
          >
            Alle produkter
          </button>
          {rootCategories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                setSelectedRootCategoryId(category.id);
                setSelectedSubcategoryId("");
              }}
              data-branding-id="forside.products.categories.button"
              style={categoryTabStyleVars}
              className={cn(
                categoryTabBaseClassName,
                selectedRootCategory?.id === category.id && categoryTabActiveClassName,
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      {showRootCategoryCards && (
        <ProductGrid category="__all__" products={rootCategoryLeadProducts} {...gridProps} />
      )}

      {showChildCategoryNav && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2" data-branding-id="forside.products.categories">
            <button
                type="button"
                onClick={() => setSelectedSubcategoryId("")}
                data-branding-id="forside.products.categories.button"
                style={categoryTabStyleVars}
                className={cn(
                  "border px-3 py-1.5 text-xs transition-colors",
                  "bg-[var(--category-tab-bg)] text-[var(--category-tab-text)] border-[var(--category-tab-border)]",
                  "hover:bg-[var(--category-tab-hover-bg)] hover:text-[var(--category-tab-hover-text)]",
                  !selectedSubcategoryId && "bg-[var(--category-tab-active-bg)] text-[var(--category-tab-active-text)] border-[var(--category-tab-active-border)] hover:bg-[var(--category-tab-active-bg)] hover:text-[var(--category-tab-active-text)]",
                )}
            >
              {childNavMode === "submenu" ? "Vælg underkategori" : "Alle i kategorien"}
            </button>
            {childCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedSubcategoryId(category.id)}
                data-branding-id="forside.products.categories.button"
                style={categoryTabStyleVars}
                className={cn(
                  "border px-3 py-1.5 text-xs transition-colors",
                  "bg-[var(--category-tab-bg)] text-[var(--category-tab-text)] border-[var(--category-tab-border)]",
                  "hover:bg-[var(--category-tab-hover-bg)] hover:text-[var(--category-tab-hover-text)]",
                  selectedSubcategoryId === category.id && "bg-[var(--category-tab-active-bg)] text-[var(--category-tab-active-text)] border-[var(--category-tab-active-border)] hover:bg-[var(--category-tab-active-bg)] hover:text-[var(--category-tab-active-text)]",
                )}
              >
                {category.name}
              </button>
            ))}
          </div>

          {!selectedSubcategoryId && childNavMode === "submenu" && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {childCategories.map((category) => (
                <Card
                  key={category.id}
                  className="cursor-pointer border hover:border-primary transition-colors"
                  onClick={() => setSelectedSubcategoryId(category.id)}
                >
                  <CardContent className="p-5">
                    <p className="font-medium">{category.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {branchProductCountByCategoryId.get(category.id) || 0} produkter
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {showChildCategoryCards && (
        <ProductGrid category="__all__" products={childCategoryLeadProducts} {...gridProps} />
      )}

      {!showRootCategoryCards && !showChildCategoryCards && (childNavMode !== "submenu" || selectedSubcategoryId || !showChildCategoryNav) && (
        <ProductGrid category="__all__" products={productsForBranch} {...gridProps} />
      )}
    </div>
  );
}
