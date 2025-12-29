import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PriceMatrix } from "@/components/product-price-page/PriceMatrix";
import { ProductPricePanel } from "@/components/product-price-page/ProductPricePanel";
import { ProductFilters } from "@/components/product-price-page/ProductFilters";
import { StaticProductInfo } from "@/components/product-price-page/StaticProductInfo";
import { CustomDimensionsCalculator } from "@/components/product-price-page/CustomDimensionsCalculator";
import { DynamicProductOptions } from "@/components/product-price-page/DynamicProductOptions";
import { MachineConfigurator } from "@/components/product-price-page/MachineConfigurator";
import { getProductBySlug } from "@/utils/productMetadata";
import { getProductImage } from "@/utils/productImages";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { ProductSchema, BreadcrumbSchema } from "@/components/ProductSchema";
import {
  type MatrixData
} from "@/utils/productPricing";
import {
  getFlyerMatrixDataFromDB,
  getFolderMatrixDataFromDB,
  getVisitkortMatrixDataFromDB,
  getPosterMatrixDataFromDB,
  getStickerMatrixDataFromDB,
  getBookletMatrixDataFromDB,
  getSalesfolderMatrixDataFromDB,
  getBeachflagMatrixDataFromDB,
  getBannerMatrixDataFromDB,
  getSignMatrixDataFromDB,
  getFoilMatrixDataFromDB,
  calculateFoilPrice,
  getGenericMatrixDataFromDB
} from "@/utils/pricingDatabase";
import { getDimensionsFromVariant } from "@/utils/formatStandards";

// List of products with specific pricing tables
const specificPricingProducts = ['flyers', 'foldere', 'visitkort', 'plakater', 'klistermærker', 'skilte', 'bannere', 'folie', 'beachflag', 'hæfter', 'salgsmapper'];

// Product configurations
const productConfigs: Record<string, {
  formats: { id: string; label: string }[];
  extraOptions?: { id: string; label: string }[];
  extraOptionsLabel?: string;
}> = {
  flyers: {
    formats: [
      { id: "A6", label: "A6" },
      { id: "M65", label: "M65" },
      { id: "A5", label: "A5" },
      { id: "A4", label: "A4" },
      { id: "A3", label: "A3" },
    ]
  },
  foldere: {
    formats: [
      { id: "A5", label: "A5" },
      { id: "M65", label: "M65" },
      { id: "A4", label: "A4" },
    ],
    extraOptions: [
      { id: "Midterfalset", label: "Midterfalset" },
      { id: "Rullefalset", label: "Rullefalset" },
      { id: "Zigzag", label: "Zigzag" },
    ],
    extraOptionsLabel: "Vælg falsetype"
  },
  visitkort: {
    formats: [{ id: "standard", label: "85×55 mm" }]
  },
  plakater: {
    formats: [
      { id: "A3", label: "A3 (297×420mm)" },
      { id: "A2", label: "A2 (420×594mm)" },
      { id: "A1", label: "A1 (594×841mm)" },
      { id: "A0", label: "A0 (841×1189mm)" },
    ]
  },
  klistermærker: {
    formats: [
      { id: "5x5", label: "5×5 cm" },
      { id: "10x10", label: "10×10 cm" },
      { id: "15x15", label: "15×15 cm" },
      { id: "20x20", label: "20×20 cm" },
    ]
  },
  hæfter: {
    formats: [
      { id: "A6", label: "A6" },
      { id: "A5", label: "A5" },
      { id: "A4", label: "A4" },
    ],
    extraOptions: [
      { id: "8", label: "8 sider" },
      { id: "16", label: "16 sider" },
      { id: "24", label: "24 sider" },
      { id: "32", label: "32 sider" },
    ],
    extraOptionsLabel: "Vælg sidetal"
  },
  salgsmapper: {
    formats: [
      { id: "M65", label: "M65" },
      { id: "A5", label: "A5" },
      { id: "A4", label: "A4" },
    ],
    extraOptions: [
      { id: "Kun forside", label: "Kun forside" },
      { id: "For og bagside", label: "For og bagside" },
    ],
    extraOptionsLabel: "Vælg tryk"
  },
  beachflag: {
    formats: [{ id: "all", label: "Alle størrelser" }]
  },
  bannere: {
    formats: [{ id: "preset", label: "Standardstørrelser (m²)" }]
  },
  skilte: {
    formats: [{ id: "preset", label: "Standardstørrelser (m²)" }]
  },
  folie: {
    formats: [{ id: "preset", label: "Standardstørrelser (m²)" }]
  }
};

const ProductPrice = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();

  const staticProduct = slug ? getProductBySlug(slug) : null;

  // State
  const [selectedFormat, setSelectedFormat] = useState<string>("");
  const [selectedExtraOption, setSelectedExtraOption] = useState<string>("");
  const [matrixData, setMatrixData] = useState<MatrixData>({ rows: [], columns: [], cells: {} });
  const [selectedCell, setSelectedCell] = useState<{ row: string; column: number } | null>(null);
  const [productPrice, setProductPrice] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [customArea, setCustomArea] = useState<number>(1); // m² for area-based products
  const [customWidth, setCustomWidth] = useState<number>(100); // cm
  const [customHeight, setCustomHeight] = useState<number>(100); // cm
  const [basePricePerSqm, setBasePricePerSqm] = useState<Record<string, number>>({});
  const [optionExtraPrice, setOptionExtraPrice] = useState<number>(0);
  const [optionSelections, setOptionSelections] = useState<Record<string, { optionId: string; name: string; extraPrice: number; priceMode: "fixed" | "per_quantity" | "per_area" }>>({});

  // Debug: Track productPrice state changes
  useEffect(() => {
    console.log('[ProductPrice] productPrice state changed to:', productPrice);
  }, [productPrice]);;
  const [dbProductId, setDbProductId] = useState<string | null>(null);
  const [genericVariantNames, setGenericVariantNames] = useState<string[]>([]);
  const [selectedVariantName, setSelectedVariantName] = useState<string>("");
  const [dbProduct, setDbProduct] = useState<{
    id: string;
    name: string;
    description: string;
    image_url: string | null;
    technical_specs?: any;
  } | null>(null);
  const [mpaConfig, setMpaConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Use static product if available, otherwise fall back to database product
  const product = useMemo(() => staticProduct || (dbProduct ? {
    id: slug || '',
    name: dbProduct.name,
    slug: slug || '',
    description: dbProduct.description,
    hasMatrixPricing: false,
    pricingType: 'matrix' as const,
    category: 'tryksager' as const,
    image: dbProduct.image_url || '/placeholder.svg'
  } : null), [staticProduct, dbProduct, slug]);

  const config = product && staticProduct ? productConfigs[staticProduct.id] : null;
  const isGenericPricing = !staticProduct && dbProduct;

  // Fetch database product ID and data for dynamic options
  useEffect(() => {
    async function fetchDbProduct() {
      if (!slug) return;
      setLoading(true);
      console.log('[ProductPrice] Fetching product with slug:', slug);
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, image_url, technical_specs')
        .eq('slug', slug)
        .maybeSingle();

      console.log('[ProductPrice] Database result:', { data, error });

      if (data) {
        console.log('[ProductPrice] Setting dbProductId to:', data.id);
        setDbProductId(data.id);
        setDbProduct(data);

        // Fetch MPA Config if available
        const { data: cfg } = await supabase
          .from('product_pricing_configs' as any)
          .select('*')
          .eq('product_id', data.id)
          .eq('pricing_type', 'MACHINE_PRICED')
          .maybeSingle();

        if (cfg) setMpaConfig(cfg);
      } else {
        console.warn('[ProductPrice] No product found for slug:', slug);
      }
      setLoading(false);
    }
    fetchDbProduct();
  }, [slug]);

  // Scroll to top when landing on product page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  // Initialize format and extra options
  useEffect(() => {
    if (config && product) {
      // Initialize format
      const formatParam = searchParams.get("format");
      const initialFormat = formatParam || config.formats[0]?.id || "";
      setSelectedFormat(initialFormat);

      // Initialize extra option
      if (config.extraOptions) {
        const extraParam = searchParams.get("extra");
        const initialExtra = extraParam || config.extraOptions[0]?.id || "";
        setSelectedExtraOption(initialExtra);
      }
    }
  }, [product?.id]);

  // Fetch variant names for generic products
  useEffect(() => {
    if (!isGenericPricing || !dbProductId) return;

    const fetchVariantNames = async () => {
      const { matrixData, variantNames } = await getGenericMatrixDataFromDB(dbProductId, undefined);
      if (variantNames.length > 0) {
        setGenericVariantNames(variantNames);
        setSelectedVariantName(prev => prev || variantNames[0]);
      }
    };
    fetchVariantNames();
  }, [isGenericPricing, dbProductId]);

  // Update matrix data
  useEffect(() => {
    if (!product) return;

    // Skip for MPA products - MachineConfigurator handles pricing
    if (mpaConfig) return;

    if (isGenericPricing && (!dbProductId || !selectedVariantName)) return;
    if (!isGenericPricing && !selectedFormat) return;

    const loadMatrixData = async () => {
      let newMatrixData: MatrixData = { rows: [], columns: [], cells: {} };

      if (isGenericPricing && dbProductId && selectedVariantName) {
        console.log(`Loading generic matrix for product: ${product.id}, variant: ${selectedVariantName}`);
        const { matrixData } = await getGenericMatrixDataFromDB(dbProductId, selectedVariantName);
        newMatrixData = matrixData;
      } else {
        switch (product.id) {
          case "flyers":
            newMatrixData = await getFlyerMatrixDataFromDB(selectedFormat);
            break;
          case "foldere":
            if (selectedExtraOption) {
              newMatrixData = await getFolderMatrixDataFromDB(selectedFormat, selectedExtraOption);
            }
            break;
          case "visitkort":
            newMatrixData = await getVisitkortMatrixDataFromDB();
            break;
          case "plakater":
            newMatrixData = await getPosterMatrixDataFromDB(selectedFormat);
            break;
          case "klistermærker":
            newMatrixData = await getStickerMatrixDataFromDB(selectedFormat);
            break;
          case "hæfter":
            if (selectedExtraOption) {
              newMatrixData = await getBookletMatrixDataFromDB(selectedFormat, selectedExtraOption);
            }
            break;
          case "salgsmapper":
            if (selectedExtraOption) {
              newMatrixData = await getSalesfolderMatrixDataFromDB(selectedFormat, selectedExtraOption);
            }
            break;
          case "beachflag":
            newMatrixData = await getBeachflagMatrixDataFromDB();
            break;
          case "bannere":
            newMatrixData = await getBannerMatrixDataFromDB();
            if (newMatrixData.rows.length > 0 && newMatrixData.columns.includes(1)) {
              const prices: Record<string, number> = {};
              newMatrixData.rows.forEach(row => {
                prices[row] = newMatrixData.cells[row]?.[1] || 0;
              });
              setBasePricePerSqm(prices);
            }
            break;
          case "skilte":
            newMatrixData = await getSignMatrixDataFromDB();
            if (newMatrixData.rows.length > 0 && newMatrixData.columns.includes(1)) {
              const prices: Record<string, number> = {};
              newMatrixData.rows.forEach(row => {
                prices[row] = newMatrixData.cells[row]?.[1] || 0;
              });
              setBasePricePerSqm(prices);
            }
            break;
          case "folie":
            newMatrixData = await getFoilMatrixDataFromDB();
            if (newMatrixData.rows.length > 0 && newMatrixData.columns.includes(1)) {
              const prices: Record<string, number> = {};
              newMatrixData.rows.forEach(row => {
                prices[row] = newMatrixData.cells[row]?.[1] || 0;
              });
              setBasePricePerSqm(prices);
            }
            break;
        }
      }

      console.log(`Matrix updated with ${newMatrixData.rows.length} rows and ${newMatrixData.columns.length} columns`);
      setMatrixData(newMatrixData);

      // Deep linking & Selection preservation logic
      const qtyParam = searchParams.get("qty");
      const variantParam = searchParams.get("variant");

      if (qtyParam && variantParam) {
        const qty = parseInt(qtyParam);
        const row = newMatrixData.rows.find(r => r.toLowerCase().includes(variantParam.toLowerCase()));

        if (row && newMatrixData.columns.includes(qty)) {
          const price = newMatrixData.cells[row]?.[qty] || 0;
          setSelectedCell({ row, column: qty });
          setProductPrice(price);
        }
      } else if (selectedCell) {
        const { row: previousRow, column: selectedQty } = selectedCell;
        if (newMatrixData.columns.includes(selectedQty)) {
          let targetRow = newMatrixData.rows.includes(previousRow) ? previousRow : newMatrixData.rows[0];
          const newPrice = newMatrixData.cells[targetRow]?.[selectedQty] || 0;
          setSelectedCell({ row: targetRow, column: selectedQty });
          setProductPrice(newPrice);
        } else {
          setSelectedCell(null);
          setProductPrice(0);
        }
      } else {
        // Default to 500
        if (newMatrixData.rows.length > 0) {
          const defaultRow = newMatrixData.rows[0];
          const defaultQty = newMatrixData.columns.includes(500) ? 500 : (newMatrixData.columns[0] || 0);
          if (defaultQty > 0) {
            const price = newMatrixData.cells[defaultRow]?.[defaultQty] || 0;
            setSelectedCell({ row: defaultRow, column: defaultQty });
            setProductPrice(price);
          }
        }
      }
    };

    loadMatrixData();
  }, [product, selectedFormat, selectedExtraOption, searchParams, dbProductId, selectedVariantName, isGenericPricing]);

  const computeOptionExtras = useCallback((selections: Record<string, { optionId: string; name: string; extraPrice: number; priceMode: "fixed" | "per_quantity" | "per_area" }>, quantity: number, area: number) => {
    return Object.values(selections).reduce((sum, sel) => {
      if (sel.priceMode === "per_quantity") {
        return sum + sel.extraPrice * quantity;
      }
      if (sel.priceMode === "per_area") {
        return sum + sel.extraPrice * area * quantity;
      }
      return sum + sel.extraPrice;
    }, 0);
  }, []);

  const handleCellClick = async (_row: string, column: number, basePrice: number, displayPrice: number) => {
    setSelectedCell({ row: _row, column });
    // For all m²-based products, trust the matrix value (already includes any volume-based discount)
    setProductPrice(basePrice);
    const totalExtra = computeOptionExtras(optionSelections, column, customArea || 1);
    setOptionExtraPrice(totalExtra);
  };

  const handleAreaChange = useCallback(async (_area: number, width?: number, height?: number) => {
    // Keep matrix-selected price; do not reapply calculations in the side panel
    setCustomArea(_area);
    if (width !== undefined) setCustomWidth(width);
    if (height !== undefined) setCustomHeight(height);
  }, []);

  const handleShippingChange = (type: string | null, cost: number) => {
    setShippingCost(cost);
  };

  const handleOptionSelectionChange = useCallback((selections: Record<string, { optionId: string; name: string; extraPrice: number; priceMode: "fixed" | "per_quantity" | "per_area" }>) => {
    setOptionSelections(selections);
    const qty = selectedCell?.column ?? 1;
    const totalExtra = computeOptionExtras(selections, qty, customArea || 1);
    setOptionExtraPrice(totalExtra);
  }, [selectedCell, computeOptionExtras, customArea]);

  useEffect(() => {
    const qty = selectedCell?.column ?? 1;
    const totalExtra = computeOptionExtras(optionSelections, qty, customArea || 1);
    setOptionExtraPrice(totalExtra);
  }, [selectedCell, optionSelections, computeOptionExtras, customArea]);

  // Recalculate base price when area or selection changes for area-based products
  useEffect(() => {
    if (!selectedCell) return;
    // Skip for MPA products - MachineConfigurator handles pricing
    if (mpaConfig) return;

    const isAreaBased = product?.id === "bannere" || product?.id === "skilte" || product?.id === "folie";
    const qty = selectedCell.column;
    let base = matrixData.cells[selectedCell.row]?.[qty] || 0;

    if (isAreaBased && basePricePerSqm[selectedCell.row]) {
      base = Math.round((customArea || 1) * qty * basePricePerSqm[selectedCell.row]);
    }

    setProductPrice(base);
    const extra = computeOptionExtras(optionSelections, qty, customArea || 1);
    setOptionExtraPrice(extra);
  }, [selectedCell, customArea, basePricePerSqm, matrixData, product, computeOptionExtras, optionSelections, mpaConfig]);

  // Loading State
  // Determine current dimensions based on selection
  const currentDimensions = useMemo(() => {
    // 1. Try to get dimensions from the selected variant name (A4, A5, etc.)
    const variantDims = getDimensionsFromVariant(selectedFormat || selectedVariantName || "");
    if (variantDims) return { ...variantDims, bleed: parseFloat(dbProduct?.technical_specs?.bleed_mm) || 3 };

    // 2. Fall back to product-wide technical specs
    if (dbProduct?.technical_specs) {
      return {
        width: dbProduct.technical_specs.width_mm || 210,
        height: dbProduct.technical_specs.height_mm || 297,
        bleed: dbProduct.technical_specs.bleed_mm || 3
      };
    }

    // 3. Ultimate default
    return { width: 210, height: 297, bleed: 3 };
  }, [selectedFormat, selectedVariantName, dbProduct?.technical_specs]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-16 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </main>
        <Footer />
      </div>
    );
  }

  // Not Found State
  if (!product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-16">
          <h1 className="text-3xl font-heading font-bold text-center">Produkt ikke fundet</h1>
        </main>
        <Footer />
      </div>
    );
  }

  // Main Render
  const renderPricingInterface = () => {
    const isAreaBased = product.id === "bannere" || product.id === "skilte" || product.id === "folie";
    const optionsBlock = dbProductId ? (
      <div className="mb-6">
        <DynamicProductOptions
          productId={dbProductId}
          onSelectionChange={handleOptionSelectionChange}
        />
      </div>
    ) : null;

    return (
      <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* For non-area products, keep options above */}
            {!isAreaBased && optionsBlock}

            {isGenericPricing && genericVariantNames.length > 1 && (
              <div>
                <label className="text-base font-semibold mb-3 block">Vælg produkttype</label>
                <div className="flex flex-wrap gap-2">
                  {genericVariantNames.map((name) => (
                    <button
                      key={name}
                      onClick={() => setSelectedVariantName(name)}
                      className={`px-4 py-2 rounded-lg border-2 transition-all font-medium ${selectedVariantName === name
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                        }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {config && (
              <ProductFilters
                formats={config.formats}
                extraOptions={config.extraOptions}
                selectedFormat={selectedFormat}
                selectedExtraOption={selectedExtraOption}
                onFormatChange={setSelectedFormat}
                onExtraOptionChange={setSelectedExtraOption}
                extraOptionsLabel={config.extraOptionsLabel}
              />
            )}

            {isAreaBased && (
              <div>
                <CustomDimensionsCalculator onAreaChange={handleAreaChange} />
              </div>
            )}

            {/* For area-based products, show options below width/height calculator (e.g., lamination) */}
            {isAreaBased && optionsBlock}

            {mpaConfig ? (
              <MachineConfigurator
                productId={dbProductId || ""}
                width={0}
                height={0}
                onPriceUpdate={(data) => {
                  console.log('[ProductPrice] Received from MachineConfigurator:', data);
                  setProductPrice(data.totalPrice);
                  // Update selected cell mock to satisfy ProductPricePanel
                  setSelectedCell({ row: data.materialName || "Special", column: data.quantity });
                }}
              />
            ) : (
              <PriceMatrix
                rows={matrixData.rows}
                columns={matrixData.columns}
                cells={matrixData.cells}
                onCellClick={handleCellClick}
                selectedCell={selectedCell}
                columnUnit="stk"
                customArea={isAreaBased ? customArea : undefined}
                basePricePerSqm={isAreaBased ? basePricePerSqm : undefined}
                computeExtras={(qty, area) => computeOptionExtras(optionSelections, qty, area || 1)}
              />
            )}
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div>
              <ProductPricePanel
                productId={dbProductId || ""}
                quantity={selectedCell?.column || 0}
                productPrice={productPrice}
                extraPrice={optionExtraPrice}
                onShippingChange={handleShippingChange}
                optionSelections={optionSelections}
                selectedVariant={selectedCell?.row}
                productName={product.name}
                productSlug={slug || ""}
                selectedFormat={selectedFormat}
                summary={[
                  product.name,
                  // For area-based products, show custom dimensions instead of format
                  (product.id === "bannere" || product.id === "skilte" || product.id === "folie")
                    ? `${customWidth} x ${customHeight} cm`
                    : (selectedFormat ? config?.formats.find(f => f.id === selectedFormat)?.label : ""),
                  selectedCell ? selectedCell.row : "",
                  selectedExtraOption ? config?.extraOptions?.find(e => e.id === selectedExtraOption)?.label : "",
                  selectedCell ? `${selectedCell.column} stk` : ""
                ].filter(Boolean).join(" • ")}
              />
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title={`${product.name} - Bestil Online hos Webprinter`}
        description={product.description}
      />
      <ProductSchema
        name={product.name}
        description={product.description}
        price={productPrice || 99}
        image={dbProduct?.image_url || getProductImage(product.slug)}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Forside', url: '/' },
          { name: 'Produkter', url: '/produkter' },
          { name: product.name, url: `/produkt/${slug}` }
        ]}
      />
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-heading font-bold mb-2">{product.name}</h1>
            <p className="text-muted-foreground">{product.description}</p>
          </div>
          {product && (
            <div className="w-full md:w-48 h-48 flex-shrink-0">
              <img
                src={dbProduct?.image_url || getProductImage(product.slug)}
                alt={product.name}
                className="w-full h-full object-contain"
                style={{ filter: 'var(--product-filter)' }}
              />
            </div>
          )}
        </div>

        {renderPricingInterface()}

        <StaticProductInfo productId={product.slug || product.id} selectedFormat={selectedFormat} />
      </main>
      <Footer />
    </div>
  );
};

export default ProductPrice;
