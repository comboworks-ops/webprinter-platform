import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse, optionsResponse } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";

const OPERATOR_ROLE_MAP: Record<string, "admin" | "master_admin"> = {
  "admin@webprinter.dk": "master_admin",
  "info@webprinter.dk": "master_admin",
  "result-admin@webprinter.dk": "admin",
  "online-trukserre@gmail.com": "admin",
};
const READ_PAGE_SIZE = 1000;

const numberOrNull = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

async function requireMasterAdmin(req: Request, serviceClient: any) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth;

  const { data: roles, error } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.user.id);

  if (error) {
    return { ok: false as const, response: jsonResponse({ error: "Could not verify role" }, 500) };
  }

  const roleNames = (roles || []).map((entry: any) => entry.role);
  const operatorRole = OPERATOR_ROLE_MAP[String(auth.user.email || "").toLowerCase()] || null;
  const isMasterAdmin = roleNames.includes("master_admin") || operatorRole === "master_admin";

  if (!isMasterAdmin) {
    return { ok: false as const, response: jsonResponse({ error: "Master admin access required" }, 403) };
  }

  return { ok: true as const, user: auth.user };
}

async function countProductRowsForIds(serviceClient: any, tableName: string, productIds: string[]) {
  const entries = await Promise.all(productIds.map(async (productId) => {
    const { count, error } = await serviceClient
      .from(tableName)
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);
    return [productId, error ? null : (count ?? 0)] as const;
  }));

  return entries.reduce((acc, [productId, count]) => {
    acc[productId] = count;
    return acc;
  }, {} as Record<string, number | null>);
}

async function fetchAllRows(makeQuery: () => any) {
  const rows: any[] = [];

  for (let from = 0; ; from += READ_PAGE_SIZE) {
    const { data, error } = await makeQuery().range(from, from + READ_PAGE_SIZE - 1);
    if (error) return { data: null, error };

    const pageRows = Array.isArray(data) ? data : [];
    rows.push(...pageRows);

    if (pageRows.length < READ_PAGE_SIZE) break;
  }

  return { data: rows, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const auth = await requireMasterAdmin(req, serviceClient);
    if (!auth.ok) return auth.response;

    const [
      supplierResult,
      productResult,
      importJobResult,
      deltaReviewResult,
      refreshJobResult,
    ] = await Promise.all([
      fetchAllRows(() => serviceClient
        .from("supplier_bank_suppliers")
        .select("id,name,slug,enabled,integration_type,country_code,currency,metadata")
        .order("name")),
      fetchAllRows(() => serviceClient
        .from("supplier_bank_products")
        .select("id,supplier_id,supplier_product_key,name_da,name_original,product_family,status,scrape_status,source_url,last_scraped_at,last_price_checked_at,raw_snapshot_path,normalized_attributes,normalized_pricing_summary,updated_at")
        .neq("status", "archived")
        .order("updated_at", { ascending: false })),
      fetchAllRows(() => serviceClient
        .from("supplier_bank_import_jobs")
        .select("id,bank_product_id,target_tenant_id,target_product_id,import_mode,status,import_summary,rollback_note,created_at")
        .order("created_at", { ascending: false })),
      fetchAllRows(() => serviceClient
        .from("supplier_bank_price_delta_reviews")
        .select("id,bank_product_id,new_price_snapshot_id,status,threshold_pct,change_summary,notes,created_at")
        .order("created_at", { ascending: false })),
      fetchAllRows(() => serviceClient
        .from("supplier_bank_refresh_jobs")
        .select("id,supplier_id,bank_product_id,mode,tool,status,request_summary,result_summary,error,queued_at,started_at,finished_at")
        .order("queued_at", { ascending: false })),
    ]);

    const firstError = supplierResult.error || productResult.error;
    if (firstError) {
      return jsonResponse({ error: firstError.message || "Supplier bank data could not be read" }, 500);
    }

    const products = productResult.data || [];
    const importJobs = importJobResult.error ? [] : (importJobResult.data || []);
    let snapshotStats: Record<string, {
      count: number;
      latestSnapshotId: string | null;
      latestCreatedAt: string | null;
      quantityMin: number | null;
      quantityMax: number | null;
      priceMinDkk: number | null;
      priceMaxDkk: number | null;
    }> = {};
    let importedTargetProductsById: Record<string, any> = {};
    let importedTargetRowCountsById: Record<string, any> = {};

    if (products.length > 0) {
      const { data: snapshotRows, error: snapshotError } = await fetchAllRows(() => serviceClient
        .from("supplier_bank_price_snapshots")
        .select("id,bank_product_id,created_at,quantity_min,quantity_max,price_min_dkk,price_max_dkk")
        .in("bank_product_id", products.map((product: any) => product.id))
        .order("created_at", { ascending: false }));

      if (!snapshotError) {
        snapshotStats = (snapshotRows || []).reduce((acc: any, row: any) => {
          const productId = row.bank_product_id as string | undefined;
          if (!productId) return acc;
          const current = acc[productId] || {
            count: 0,
            latestSnapshotId: null,
            latestCreatedAt: null,
            quantityMin: null,
            quantityMax: null,
            priceMinDkk: null,
            priceMaxDkk: null,
          };
          acc[productId] = {
            count: current.count + 1,
            latestSnapshotId: current.latestSnapshotId || row.id || null,
            latestCreatedAt: current.latestCreatedAt || row.created_at || null,
            quantityMin: current.quantityMin ?? numberOrNull(row.quantity_min),
            quantityMax: current.quantityMax ?? numberOrNull(row.quantity_max),
            priceMinDkk: current.priceMinDkk ?? numberOrNull(row.price_min_dkk),
            priceMaxDkk: current.priceMaxDkk ?? numberOrNull(row.price_max_dkk),
          };
          return acc;
        }, {});
      }
    }

    const targetProductIds = Array.from(new Set(
      importJobs
        .map((job: any) => job.target_product_id)
        .filter((id: any): id is string => typeof id === "string" && id.length > 0),
    ));

    if (targetProductIds.length > 0) {
      const { data: targetProducts, error: targetProductsError } = await serviceClient
        .from("products")
        .select("id,name,slug,pricing_type,is_published")
        .in("id", targetProductIds);

      if (!targetProductsError) {
        importedTargetProductsById = (targetProducts || []).reduce((acc: any, product: any) => {
          acc[product.id] = product;
          return acc;
        }, {});
      }

      const [
        genericPriceCounts,
        storformatMaterialCounts,
        storformatFinishCounts,
        storformatVariantCounts,
      ] = await Promise.all([
        countProductRowsForIds(serviceClient, "generic_product_prices", targetProductIds),
        countProductRowsForIds(serviceClient, "storformat_materials", targetProductIds),
        countProductRowsForIds(serviceClient, "storformat_finishes", targetProductIds),
        countProductRowsForIds(serviceClient, "storformat_products", targetProductIds),
      ]);

      importedTargetRowCountsById = targetProductIds.reduce((acc: any, productId) => {
        acc[productId] = {
          genericPrices: genericPriceCounts[productId] ?? null,
          storformatMaterials: storformatMaterialCounts[productId] ?? null,
          storformatFinishes: storformatFinishCounts[productId] ?? null,
          storformatVariants: storformatVariantCounts[productId] ?? null,
        };
        return acc;
      }, {});
    }

    return new Response(JSON.stringify({
      suppliers: supplierResult.data || [],
      products,
      importJobs,
      deltaReviews: deltaReviewResult.error ? [] : (deltaReviewResult.data || []),
      refreshJobs: refreshJobResult.error ? [] : (refreshJobResult.data || []),
      snapshotStatsByProductId: snapshotStats,
      importedTargetProductsById,
      importedTargetRowCountsById,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supplier bank admin read failed";
    return jsonResponse({ error: message }, 500);
  }
});
