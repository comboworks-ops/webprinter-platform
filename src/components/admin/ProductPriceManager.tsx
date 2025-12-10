import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Save, Trash2, ArrowLeft } from "lucide-react";
import { ProductImageUpload } from "./ProductImageUpload";
import { AddPriceRow } from "./AddPriceRow";
import { ProductAboutSection } from "./ProductAboutSection";
import { MatrixDefaultSelector } from "./MatrixDefaultSelector";
import { BannerConfigEditor } from "./BannerConfigEditor";
import { CustomFieldsManager } from "./CustomFieldsManager";
import { BulkCSVImport } from "./BulkCSVImport";
import { BulkCSVExport } from "./BulkCSVExport";
import { ProductTooltipEditor } from "./ProductTooltipEditor";
import { PriceHierarchyFilter } from "./PriceHierarchyFilter";
import { OptionGroupManager } from "./OptionGroupManager";

interface BasePrice {
  id: string;
  price_dkk?: number;
  updated_at?: string;
  updated_by?: string;
}

interface FolderPrice extends BasePrice {
  format: string;
  paper: string;
  fold_type: string;
  quantity: number;
}

interface FlyerPrice extends BasePrice {
  format: string;
  paper: string;
  quantity: number;
  list_price_dkk: number;
}

interface VisitkortPrice extends BasePrice {
  paper: string;
  quantity: number;
}

interface RatePrice extends BasePrice {
  paper?: string;
  material?: string;
  price_per_sqm: number;
}

interface BeachflagPrice extends BasePrice {
  size: string;
  system: string;
  base_price: number;
}

function getPricingTypeLabel(type: string | undefined): string {
  if (!type) return 'Ukendt';
  const labels: Record<string, string> = {
    'matrix': 'Matrix',
    'rate': 'Takst',
    'formula': 'Formel',
    'fixed': 'Fast pris',
    'custom-dimensions': 'Brugerdefinerede dimensioner'
  };
  return labels[type] || type;
}

export function ProductPriceManager() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [prices, setPrices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [editedListPrices, setEditedListPrices] = useState<Record<string, number>>({});
  const [editedPricePerUnit, setEditedPricePerUnit] = useState<Record<string, number>>({});
  const [editedVariantNames, setEditedVariantNames] = useState<Record<string, string>>({});
  const [editedVariantValues, setEditedVariantValues] = useState<Record<string, string>>({});
  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({});
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [hasProductEdits, setHasProductEdits] = useState(false);
  const [filteredPrices, setFilteredPrices] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("details");

  useEffect(() => {
    fetchProduct();
  }, [slug]);

  useEffect(() => {
    if (product) {
      fetchPrices();
      setEditedName(product.name);
      setEditedDescription(product.description);
    }
  }, [product]);

  const fetchProduct = async () => {
    if (!slug) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;
      setProduct(data);
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error('Kunne ikke hente produkt');
    }
  };

  const getTableName = (slug: string): string => {
    const tableMap: Record<string, string> = {
      'foldere': 'folder_prices',
      'flyers': 'print_flyers',
      'visitkort': 'visitkort_prices',
      'plakater': 'poster_prices',
      'klistermærker': 'sticker_rates',
      'skilte': 'sign_prices',
      'bannere': 'banner_prices',
      'folie': 'foil_prices',
      'beachflag': 'beachflag_prices',
      'haefter': 'booklet_rates',
      'hæfter': 'booklet_rates',
      'salgsmapper': 'salesfolder_rates'
    };
    // Return specific table or fallback to generic
    return tableMap[slug] || 'generic_product_prices';
  };

  const isGenericPricing = (slug: string): boolean => {
    const specificTables = ['foldere', 'flyers', 'visitkort', 'plakater', 'klistermærker', 'skilte', 'bannere', 'folie', 'beachflag', 'hæfter', 'haefter', 'salgsmapper'];
    return !specificTables.includes(slug);
  };

  const fetchPrices = async () => {
    if (!product) return;

    try {
      setLoading(true);
      const tableName = getTableName(product.slug);
      const useGeneric = isGenericPricing(product.slug);

      let query = supabase.from(tableName as any).select('*');

      // For generic pricing, filter by product_id
      if (useGeneric) {
        query = query.eq('product_id', product.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Sort by quantity for products that have it, otherwise keep original order
      const sortedData = (data as any[] || []).sort((a, b) => {
        if (a.quantity !== undefined && b.quantity !== undefined) {
          return a.quantity - b.quantity;
        }
        return 0;
      });

      setPrices(sortedData);
      setFilteredPrices(sortedData);
    } catch (error) {
      console.error('Error fetching prices:', error);
      toast.error('Kunne ikke hente priser');
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (id: string, newPrice: string) => {
    const numPrice = parseFloat(newPrice);
    if (!isNaN(numPrice)) {
      setEditedPrices(prev => ({ ...prev, [id]: numPrice }));
    }
  };

  const handleListPriceChange = (id: string, newPrice: string) => {
    const numPrice = parseFloat(newPrice);
    if (!isNaN(numPrice)) {
      setEditedListPrices(prev => ({ ...prev, [id]: numPrice }));
    }
  };

  const handlePricePerUnitChange = (id: string, newPrice: string) => {
    const numPrice = parseFloat(newPrice);
    if (!isNaN(numPrice)) {
      setEditedPricePerUnit(prev => ({ ...prev, [id]: numPrice }));
    }
  };

  const handleVariantNameChange = (id: string, value: string) => {
    setEditedVariantNames(prev => ({ ...prev, [id]: value }));
  };

  const handleVariantValueChange = (id: string, value: string) => {
    setEditedVariantValues(prev => ({ ...prev, [id]: value }));
  };

  const handleQuantityChange = (id: string, value: string) => {
    const numQty = parseInt(value);
    if (!isNaN(numQty)) {
      setEditedQuantities(prev => ({ ...prev, [id]: numQty }));
    }
  };

  const handleProductNameChange = (value: string) => {
    setEditedName(value);
    setHasProductEdits(value !== product?.name || editedDescription !== product?.description);
  };

  const handleProductDescriptionChange = (value: string) => {
    setEditedDescription(value);
    setHasProductEdits(editedName !== product?.name || value !== product?.description);
  };

  const handleImageUpdate = (newImageUrl: string) => {
    setProduct({ ...product, image_url: newImageUrl });
  };

  const handleFilterChange = useCallback((filtered: any[]) => {
    setFilteredPrices(filtered);
  }, []);

  const handleSaveProductDetails = async () => {
    if (!product || !hasProductEdits) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('products')
        .update({
          name: editedName,
          description: editedDescription
        })
        .eq('id', product.id);

      if (error) throw error;

      toast.success('Produktdetaljer opdateret');
      setHasProductEdits(false);
      await fetchProduct();
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Kunne ikke opdatere produktdetaljer');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePrice = async (priceId: string) => {
    if (!confirm('Er du sikker på, at du vil slette denne pris?')) return;

    try {
      const tableName = getTableName(product!.slug);
      if (!tableName) return;

      const { error } = await supabase
        .from(tableName as any)
        .delete()
        .eq('id', priceId);

      if (error) throw error;

      toast.success('Pris slettet');
      await fetchPrices();
    } catch (error) {
      console.error('Error deleting price:', error);
      toast.error('Kunne ikke slette pris');
    }
  };

  const handleSave = async (priceId: string) => {
    const hasAnyEdit = (priceId in editedPrices) || (priceId in editedListPrices) || (priceId in editedPricePerUnit) || (priceId in editedVariantNames) || (priceId in editedVariantValues) || (priceId in editedQuantities);
    if (!hasAnyEdit) return;

    setSaving(true);
    try {
      const tableName = getTableName(product!.slug);
      if (!tableName) return;

      const updates: any = {};

      if (priceId in editedPrices) {
        const isRateTable = ['poster_rates', 'sign_prices', 'banner_prices', 'foil_prices'].includes(tableName);
        const isBeachflag = tableName === 'beachflag_prices';
        const isBooklet = tableName === 'booklet_rates';
        const isSalesFolder = tableName === 'salesfolder_rates';

        if (isRateTable) {
          updates.price_per_sqm = editedPrices[priceId];
        } else if (isBeachflag || isBooklet || isSalesFolder) {
          updates.base_price = editedPrices[priceId];
        } else {
          updates.price_dkk = editedPrices[priceId];
        }
      }
      if (priceId in editedListPrices) {
        updates.list_price_dkk = editedListPrices[priceId];
      }
      if (priceId in editedPricePerUnit) {
        const isTieredAreaPricing = ['sign_prices', 'banner_prices', 'foil_prices'].includes(tableName);
        const isFormulaProduct = ['booklet_rates', 'salesfolder_rates'].includes(tableName);
        if (isTieredAreaPricing) {
          updates.discount_percent = editedPricePerUnit[priceId];
        } else if (isFormulaProduct) {
          updates.price_per_unit = editedPricePerUnit[priceId];
        } else {
          updates.price_per_unit = editedPricePerUnit[priceId];
        }
      }

      // Generic product field updates
      if (priceId in editedVariantNames) {
        updates.variant_name = editedVariantNames[priceId];
      }
      if (priceId in editedVariantValues) {
        updates.variant_value = editedVariantValues[priceId];
      }
      if (priceId in editedQuantities) {
        updates.quantity = editedQuantities[priceId];
      }

      const { error } = await supabase
        .from(tableName as any)
        .update(updates)
        .eq('id', priceId);

      if (error) throw error;

      toast.success('Pris opdateret');
      setEditedPrices(prev => {
        const newEdited = { ...prev };
        delete newEdited[priceId];
        return newEdited;
      });
      setEditedListPrices(prev => {
        const newEdited = { ...prev };
        delete newEdited[priceId];
        return newEdited;
      });
      setEditedPricePerUnit(prev => {
        const newEdited = { ...prev };
        delete newEdited[priceId];
        return newEdited;
      });
      setEditedVariantNames(prev => {
        const newEdited = { ...prev };
        delete newEdited[priceId];
        return newEdited;
      });
      setEditedVariantValues(prev => {
        const newEdited = { ...prev };
        delete newEdited[priceId];
        return newEdited;
      });
      setEditedQuantities(prev => {
        const newEdited = { ...prev };
        delete newEdited[priceId];
        return newEdited;
      });
      await fetchPrices();
    } catch (error) {
      console.error('Error updating price:', error);
      toast.error('Kunne ikke opdatere pris');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    const hasEdits = Object.keys(editedPrices).length > 0 || Object.keys(editedListPrices).length > 0 || Object.keys(editedPricePerUnit).length > 0;
    if (!hasEdits) return;

    setSaving(true);
    try {
      const tableName = getTableName(product!.slug);
      if (!tableName) return;

      const isRateTable = ['poster_rates', 'sign_prices', 'banner_prices', 'foil_prices'].includes(tableName);
      const isTieredAreaPricing = ['sign_prices', 'banner_prices', 'foil_prices'].includes(tableName);
      const isBeachflag = tableName === 'beachflag_prices';
      const isBooklet = tableName === 'booklet_rates';
      const isSalesFolder = tableName === 'salesfolder_rates';
      const allIds = [...new Set([...Object.keys(editedPrices), ...Object.keys(editedListPrices), ...Object.keys(editedPricePerUnit)])];

      const updates = allIds.map(id => {
        const updateData: any = {};

        if (id in editedPrices) {
          if (isRateTable) {
            updateData.price_per_sqm = editedPrices[id];
          } else if (isBeachflag || isBooklet || isSalesFolder) {
            updateData.base_price = editedPrices[id];
          } else {
            updateData.price_dkk = editedPrices[id];
          }
        }
        if (id in editedListPrices) updateData.list_price_dkk = editedListPrices[id];
        if (id in editedPricePerUnit) {
          if (isTieredAreaPricing) {
            updateData.discount_percent = editedPricePerUnit[id];
          } else {
            updateData.price_per_unit = editedPricePerUnit[id];
          }
        }

        return supabase
          .from(tableName as any)
          .update(updateData)
          .eq('id', id);
      });

      await Promise.all(updates);
      toast.success(`Opdaterede ${updates.length} priser`);
      setEditedPrices({});
      setEditedListPrices({});
      setEditedPricePerUnit({});
      await fetchPrices();
    } catch (error) {
      console.error('Error updating prices:', error);
      toast.error('Kunne ikke opdatere priser');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Produkt ikke fundet</CardTitle>
          <CardDescription>Det valgte produkt kunne ikke findes.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const hasEdits = Object.keys(editedPrices).length > 0 || Object.keys(editedListPrices).length > 0 || Object.keys(editedPricePerUnit).length > 0 || Object.keys(editedVariantNames).length > 0 || Object.keys(editedVariantValues).length > 0 || Object.keys(editedQuantities).length > 0;

  return (
    <div className="space-y-6">
      {/* Sticky back button */}
      <div className="sticky top-0 z-30 bg-background py-3 border-b">
        <Button
          variant="outline"
          onClick={() => navigate('/admin')}
          className="mb-0"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tilbage til Produktoversigt
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold">{product.name}</h1>
        <p className="text-muted-foreground">{product.description}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="details">Detaljer</TabsTrigger>
          <TabsTrigger value="pricing">Priser</TabsTrigger>
          <TabsTrigger value="options">Valgmuligheder</TabsTrigger>
          <TabsTrigger value="custom-fields">Felter</TabsTrigger>
          <TabsTrigger value="tooltips">Tooltips</TabsTrigger>
          <TabsTrigger value="about">Om</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Produktdetaljer</CardTitle>
              <CardDescription>Rediger navn, beskrivelse og billede - synkroniseres til forsiden</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="product-name">Produktnavn</Label>
                <Input
                  id="product-name"
                  value={editedName}
                  onChange={(e) => handleProductNameChange(e.target.value)}
                  placeholder="Indtast produktnavn"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product-description">Beskrivelse</Label>
                <Textarea
                  id="product-description"
                  value={editedDescription}
                  onChange={(e) => handleProductDescriptionChange(e.target.value)}
                  placeholder="Indtast produktbeskrivelse"
                  rows={3}
                />
              </div>
              <ProductImageUpload
                productId={product.id}
                currentImageUrl={product.image_url}
                onImageUpdate={handleImageUpdate}
              />
              <Button
                onClick={handleSaveProductDetails}
                disabled={!hasProductEdits || saving}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Gem Produktdetaljer
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Priser for {product.name}</h2>
              <p className="text-muted-foreground">
                {prices.length > 0 ? `${prices.length} priser i alt` : "Ingen priser oprettet endnu"}
              </p>
            </div>
            <Button
              onClick={handleSaveAll}
              disabled={!hasEdits || saving}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Gem Alle Priser ({Object.keys(editedPrices).length + Object.keys(editedListPrices).length + Object.keys(editedPricePerUnit).length})
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Prisliste</CardTitle>
              <CardDescription>
                Administrer priser for dette produkt
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 mb-4">
                <BulkCSVExport
                  tableName={getTableName(product.slug)}
                  productSlug={product.slug}
                  productName={product.name}
                  productId={product.id}
                />
                <BulkCSVImport
                  tableName={getTableName(product.slug)}
                  productSlug={product.slug}
                  productId={product.id}
                  onImportComplete={fetchPrices}
                />
              </div>
              <AddPriceRow
                productId={product.id}
                productSlug={product.slug}
                tableName={getTableName(product.slug)}
                onPriceAdded={fetchPrices}
                existingPrice={prices[0]}
                isGeneric={isGenericPricing(product.slug)}
              />
              {prices.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <div className="text-muted-foreground">
                    <p className="font-medium">
                      Ingen priser oprettet endnu. Klik "Tilføj ny pris" for at starte.
                      {product.pricing_type && ` Pristype: ${getPricingTypeLabel(product.pricing_type).toLowerCase()}.`}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <PriceHierarchyFilter
                    prices={prices}
                    productSlug={product.slug}
                    onFilterChange={handleFilterChange}
                  />
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {/* Generic pricing columns */}
                          {isGenericPricing(product.slug) && <TableHead>Variant navn</TableHead>}
                          {isGenericPricing(product.slug) && <TableHead>Variant værdi</TableHead>}

                          {/* Specific product columns */}
                          {(product.slug === "foldere" || product.slug === "flyers" || product.slug === "hæfter" || product.slug === "haefter" || product.slug === "klistermærker" || product.slug === "plakater" || product.slug === "salgsmapper") && <TableHead>Format</TableHead>}
                          {(product.slug === "foldere" || product.slug === "flyers" || product.slug === "visitkort" || product.slug === "plakater" || product.slug === "hæfter" || product.slug === "haefter" || product.slug === "salgsmapper") && <TableHead>Papir</TableHead>}
                          {(product.slug === "klistermærker" || product.slug === "skilte" || product.slug === "bannere" || product.slug === "folie") && <TableHead>Material</TableHead>}
                          {(product.slug === "skilte" || product.slug === "bannere" || product.slug === "folie") && <TableHead>Fra m²</TableHead>}
                          {(product.slug === "skilte" || product.slug === "bannere" || product.slug === "folie") && <TableHead>Til m²</TableHead>}
                          {product.slug === "foldere" && <TableHead>Falsetype</TableHead>}
                          {(product.slug === "hæfter" || product.slug === "haefter") && <TableHead>Antal sider</TableHead>}
                          {product.slug === "salgsmapper" && <TableHead>Sidetype</TableHead>}
                          {product.slug === "beachflag" && <TableHead>Størrelse</TableHead>}
                          {product.slug === "beachflag" && <TableHead>System</TableHead>}
                          {(isGenericPricing(product.slug) || product.slug === "foldere" || product.slug === "flyers" || product.slug === "visitkort" || product.slug === "klistermærker" || product.slug === "plakater" || product.slug === "beachflag") && <TableHead>Antal</TableHead>}
                          <TableHead>Pris (DKK)</TableHead>
                          {(product.slug === "skilte" || product.slug === "bannere" || product.slug === "folie") && <TableHead>Rabat %</TableHead>}
                          {product.slug === "flyers" && <TableHead>Listepris (DKK)</TableHead>}
                          {(product.slug === "hæfter" || product.slug === "haefter" || product.slug === "salgsmapper") && <TableHead>Pris per enhed (DKK)</TableHead>}
                          <TableHead className="text-right">Handlinger</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPrices.map((price: any) => {
                          const isTieredAreaPricing = ['skilte', 'bannere', 'folie'].includes(product.slug);
                          const isBooklet = product.slug === 'hæfter' || product.slug === 'haefter';
                          const isSalgsmappe = product.slug === 'salgsmapper';
                          const useGeneric = isGenericPricing(product.slug);
                          const priceValue = useGeneric ? price.price_dkk : (isTieredAreaPricing ? price.price_per_sqm : (product.slug === 'beachflag' ? price.base_price : (isBooklet || isSalgsmappe ? price.base_price : price.price_dkk)));

                          return (
                            <TableRow key={price.id}>
                              {/* Generic pricing cells - editable */}
                              {useGeneric && (
                                <TableCell>
                                  <Input
                                    type="text"
                                    defaultValue={price.variant_name}
                                    onChange={(e) => handleVariantNameChange(price.id, e.target.value)}
                                    className="w-32"
                                  />
                                </TableCell>
                              )}
                              {useGeneric && (
                                <TableCell>
                                  <Input
                                    type="text"
                                    defaultValue={price.variant_value}
                                    onChange={(e) => handleVariantValueChange(price.id, e.target.value)}
                                    className="w-32"
                                  />
                                </TableCell>
                              )}

                              {/* Specific product cells */}
                              {(product.slug === "foldere" || product.slug === "flyers" || product.slug === "hæfter" || product.slug === "haefter" || product.slug === "klistermærker" || product.slug === "plakater" || product.slug === "salgsmapper") && <TableCell>{price.format}</TableCell>}
                              {(product.slug === "foldere" || product.slug === "flyers" || product.slug === "visitkort" || product.slug === "plakater" || product.slug === "hæfter" || product.slug === "haefter" || product.slug === "salgsmapper") && <TableCell>{price.paper}</TableCell>}
                              {(product.slug === "klistermærker" || product.slug === "skilte" || product.slug === "bannere" || product.slug === "folie") && <TableCell>{price.material}</TableCell>}
                              {(product.slug === "skilte" || product.slug === "bannere" || product.slug === "folie") && <TableCell>{price.from_sqm}</TableCell>}
                              {(product.slug === "skilte" || product.slug === "bannere" || product.slug === "folie") && <TableCell>{price.to_sqm}</TableCell>}
                              {product.slug === "foldere" && <TableCell>{price.fold_type}</TableCell>}
                              {(product.slug === "hæfter" || product.slug === "haefter") && <TableCell>{price.pages}</TableCell>}
                              {product.slug === "salgsmapper" && <TableCell>{price.side_type}</TableCell>}
                              {product.slug === "beachflag" && <TableCell>{price.size}</TableCell>}
                              {product.slug === "beachflag" && <TableCell>{price.system}</TableCell>}
                              {/* Quantity - editable for generic, display-only for others */}
                              {useGeneric && (
                                <TableCell>
                                  <Input
                                    type="number"
                                    defaultValue={price.quantity}
                                    onChange={(e) => handleQuantityChange(price.id, e.target.value)}
                                    className="w-20"
                                  />
                                </TableCell>
                              )}
                              {(!useGeneric && (product.slug === "foldere" || product.slug === "flyers" || product.slug === "visitkort" || product.slug === "klistermærker" || product.slug === "plakater" || product.slug === "beachflag")) && <TableCell>{price.quantity}</TableCell>}
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  defaultValue={priceValue}
                                  onChange={(e) => handlePriceChange(price.id, e.target.value)}
                                  className="w-24"
                                />
                              </TableCell>
                              {(product.slug === "skilte" || product.slug === "bannere" || product.slug === "folie") && (
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    defaultValue={price.discount_percent || 0}
                                    onChange={(e) => handlePricePerUnitChange(price.id, e.target.value)}
                                    className="w-20"
                                  />
                                </TableCell>
                              )}
                              {product.slug === "flyers" && (
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    defaultValue={price.list_price_dkk}
                                    onChange={(e) => handleListPriceChange(price.id, e.target.value)}
                                    className="w-24"
                                  />
                                </TableCell>
                              )}
                              {(product.slug === "hæfter" || product.slug === "haefter" || product.slug === "salgsmapper") && (
                                <TableCell>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    defaultValue={price.price_per_unit}
                                    onChange={(e) => handlePricePerUnitChange(price.id, e.target.value)}
                                    className="w-24"
                                  />
                                </TableCell>
                              )}
                              <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSave(price.id)}
                                    disabled={!(price.id in editedPrices) && !(price.id in editedListPrices) && !(price.id in editedPricePerUnit) && !(price.id in editedVariantNames) && !(price.id in editedVariantValues) && !(price.id in editedQuantities) || saving}
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeletePrice(price.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="options" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Valgmuligheder</CardTitle>
              <CardDescription>
                Opret og administrer valgmuligheder som vises på produktsiden. Disse kan have ekstra pris og ikon.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OptionGroupManager productId={product.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom-fields" className="space-y-6">
          <CustomFieldsManager
            productId={product.id}
            onFieldsUpdate={fetchPrices}
          />
        </TabsContent>

        <TabsContent value="tooltips" className="space-y-6">
          <ProductTooltipEditor
            productId={product.id}
            tooltipProduct={product.tooltip_product}
            tooltipPrice={product.tooltip_price}
            tooltipQuickTilbud={product.tooltip_quick_tilbud}
            onUpdate={fetchProduct}
          />
        </TabsContent>

        <TabsContent value="about" className="space-y-6">
          <ProductAboutSection
            productId={product.id}
            productSlug={product.slug}
            aboutTitle={product.about_title}
            aboutDescription={product.about_description}
            aboutImageUrl={product.about_image_url}
            templateFiles={product.template_files}
            onUpdate={fetchProduct}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
