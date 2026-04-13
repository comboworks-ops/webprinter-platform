import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Package, ExternalLink, ChevronLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ConfigAttribute {
  name: string;
  values: Record<string, string>; // id -> name
}

interface ConfiguratorData {
  product_group_id?: number;
  attributes?: Record<string, ConfigAttribute>; // attribute_id -> {name, values}
  price?: {
    total?: number;
    currency?: string;
  };
}

interface ProductGroup {
  id: number;
  name: string;
  description?: string;
  description_html?: string;
  categories?: { id: number; name: string }[];
}

export function FlyerAlarmProductDetail() {
  const { productId } = useParams<{ productId: string }>();
  const [group, setGroup] = useState<ProductGroup | null>(null);
  const [config, setConfig] = useState<ConfiguratorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});


  useEffect(() => {
    fetchProductData();
  }, [productId]);

  const makeApiRequest = async (endpoint: string, method: string = "GET", body?: Record<string, unknown>) => {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pod3-flyeralarm-request`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ endpoint, method, country: "dk", body }),
      }
    );
    return res.json();
  };

  const fetchProductData = async () => {
    setLoading(true);
    
    try {
      // Get product groups
      const groupsData = await makeApiRequest("/catalog/groups", "GET");
      
      if (groupsData.data?.data) {
        const foundGroup = groupsData.data.data.find((g: ProductGroup) => 
          g.id.toString() === productId
        );
        
        if (foundGroup) {
          setGroup(foundGroup);
          // Fetch configurator for this group
          await fetchConfigurator(foundGroup.id, {});
        } else {
          toast.error("Product not found");
        }
      }
    } catch (error) {
      toast.error("Failed to load product");
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigurator = async (groupId: number, options: Record<string, string>) => {
    setConfigLoading(true);
    try {
      const data = await makeApiRequest(`/catalog/groups/${groupId}/configurator`, "POST", options);
      
      if (data.data?.attributes) {
        setConfig(data.data);
        if (data.data.price) {
          setPrice(data.data.price);
        }
      }
    } catch (error) {
      console.error("Failed to fetch configurator:", error);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleOptionSelect = (attributeId: string, valueId: string) => {
    const newOptions = { ...selectedOptions, [attributeId]: valueId };
    setSelectedOptions(newOptions);
    
    // Refetch configurator with new selection to get updated price/availability
    if (group) {
      fetchConfigurator(group.id, newOptions);
    }
  };

  // Convert attributes object to array for rendering
  const attributesArray = config?.attributes 
    ? Object.entries(config.attributes).map(([id, attr]) => ({ id, ...attr }))
    : [];

  const hasConfig = attributesArray.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading product...</span>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Product not found</h1>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <Button 
        variant="ghost" 
        className="mb-6 -ml-4"
        onClick={() => window.history.back()}
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back to products
      </Button>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Left - Image */}
        <div>
          <div className="aspect-square bg-gradient-to-br from-orange-50 to-muted rounded-lg flex items-center justify-center mb-4 border-2 border-orange-100">
            <Package className="h-32 w-32 text-orange-200" />
          </div>
          
          <div className="flex items-center gap-2 text-sm text-orange-600">
            <ExternalLink className="h-4 w-4" />
            <span>Powered by Flyer Alarm PRO</span>
          </div>
        </div>

        {/* Right - Product Info */}
        <div>
          <Badge variant="secondary" className="bg-orange-100 text-orange-700 mb-4">
            Flyer Alarm Product
          </Badge>
          
          <h1 className="text-3xl font-bold mb-4">{group.name}</h1>
          
          {group.categories && (
            <p className="text-sm text-muted-foreground mb-4">
              {group.categories.map(c => c.name).join(", ")}
            </p>
          )}

          {group.description && (
            <p className="text-muted-foreground mb-6">
              {group.description}
            </p>
          )}

          <Separator className="my-6" />

          {/* Configuration Panel */}
          <Card>
            <CardContent className="p-6 space-y-6">
              
              {configLoading && !hasConfig ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Indlæser konfiguration...</span>
                </div>
              ) : hasConfig ? (
                <div className="space-y-4">
                  {attributesArray.map((attr) => (
                    <div key={attr.id}>
                      <label className="text-sm font-medium mb-2 block">
                        {attr.name}
                      </label>
                      <Select
                        value={selectedOptions[attr.id]}
                        onValueChange={(val) => handleOptionSelect(attr.id, val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Vælg ${attr.name}`} />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(attr.values).map(([valueId, valueName]) => (
                            <SelectItem key={valueId} value={valueId}>
                              {valueName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-amber-900">Konfiguration ikke tilgængelig</h4>
                      <p className="text-sm text-amber-800 mt-1">
                        Dette produkt har ikke nogen online konfigurator. 
                        Kontakt os for at høre om tilgængelige materialer, formater og priser.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              {/* CTA Buttons */}
              <div className="space-y-2">
                <Button 
                  className="w-full bg-orange-600 hover:bg-orange-700"
                  size="lg"
                  onClick={() => window.location.href = '/kontakt'}
                >
                  Kontakt for tilbud
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => window.open(`https://startnow.flyeralarm.com`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Se på Flyer Alarm
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Via Flyer Alarm PRO - vælg indstillinger ovenfor og kontakt os for pris
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
