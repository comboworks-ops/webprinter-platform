import { useState, useEffect } from "react";

interface FlyerAlarmProduct {
  id: number;
  name: string;
  description?: string;
  categories?: { id: number; name: string }[];
  orderable?: boolean;
  hasConfigurator?: boolean; // Added after checking API
}

interface UseFlyerAlarmProductsOptions {
  enabled?: boolean;
  limit?: number;
  filterWorking?: boolean; // Only show products with working configurators
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function makeApiRequest(endpoint: string, method: string = "GET", body?: Record<string, unknown>) {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/pod3-flyeralarm-request`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        endpoint,
        method,
        country: "dk",
        body
      }),
    }
  );
  return res.json();
}

// Test if a product group has working configurator
async function checkProductConfigurator(groupId: number): Promise<boolean> {
  try {
    // Group-level configurator is the main way to check
    const groupConfigData = await makeApiRequest(`/catalog/groups/${groupId}/configurator`, "POST", {});
    if (groupConfigData.success && groupConfigData.data?.attributes && Object.keys(groupConfigData.data.attributes).length > 0) {
      return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

export function useFlyerAlarmProducts(options: UseFlyerAlarmProductsOptions = {}) {
  const { enabled = true, limit = 3, filterWorking = true } = options;
  const [products, setProducts] = useState<FlyerAlarmProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    async function fetchProducts() {
      setLoading(true);
      setError(null);

      try {
        // Get all product groups
        const data = await makeApiRequest("/catalog/groups", "GET");
        
        if (data.success && data.data?.data) {
          let allProducts: FlyerAlarmProduct[] = data.data.data;
          
          // Filter to working products if requested
          if (filterWorking) {
            // Test first 20 products to find working ones
            const testBatch = allProducts.slice(0, 20);
            const workingProducts: FlyerAlarmProduct[] = [];
            
            for (const product of testBatch) {
              const hasConfigurator = await checkProductConfigurator(product.id);
              if (hasConfigurator) {
                workingProducts.push({ ...product, hasConfigurator: true });
                if (workingProducts.length >= limit) break;
              }
            }
            
            setProducts(workingProducts);
          } else {
            setProducts(allProducts.slice(0, limit));
          }
        } else {
          setError("Failed to load products");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [enabled, limit, filterWorking]);

  return { products, loading, error };
}
