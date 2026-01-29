// POD v2 PDF preflight via Print.com Platform API
// Runs for POD products only and can auto-fix by overwriting the uploaded PDF in storage.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type PreflightRequest = {
  productId: string;
  pdfUrl: string;
  filePath?: string;
  specs?: {
    width_mm?: number;
    height_mm?: number;
    bleed_mm?: number;
  };
  autoFix?: boolean;
};

const DEFAULT_PROFILE = "GWG_SheetCmyk_2015 CMYK + RGB";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as PreflightRequest;
    const { productId, pdfUrl, filePath, specs, autoFix } = body;

    if (!productId || !pdfUrl) {
      return new Response(JSON.stringify({ error: "Missing productId or pdfUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: product, error: productError } = await serviceClient
      .from("products")
      .select("id, technical_specs")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const technicalSpecs = (product as any).technical_specs || {};
    const isPodProduct = Boolean(technicalSpecs.is_pod || technicalSpecs.is_pod_v2);
    if (!isPodProduct) {
      return new Response(JSON.stringify({ error: "Preflight is only available for POD products" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!technicalSpecs.pod_preflight_enabled) {
      return new Response(JSON.stringify({ status: "SKIPPED" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const widthMm = specs?.width_mm ?? technicalSpecs.width_mm;
    const heightMm = specs?.height_mm ?? technicalSpecs.height_mm;
    const bleedMm = specs?.bleed_mm ?? technicalSpecs.bleed_mm ?? 3;

    if (!widthMm || !heightMm) {
      return new Response(JSON.stringify({ error: "Missing width/height for preflight template" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const platformBaseUrl = Deno.env.get("PRINTCOM_PLATFORM_BASE_URL") ?? "https://platform.print.com";
    let apiKey = Deno.env.get("PRINTCOM_PLATFORM_API_KEY") ?? "";
    let authMode = Deno.env.get("PRINTCOM_PLATFORM_AUTH_MODE") ?? "authorization_bearer";
    let authHeaderName = Deno.env.get("PRINTCOM_PLATFORM_AUTH_HEADER_NAME") ?? "Authorization";
    let authHeaderPrefix = Deno.env.get("PRINTCOM_PLATFORM_AUTH_HEADER_PREFIX") ?? "Bearer";

    if (!apiKey) {
      let connection: any | null = null;
      const { data: pod2Connection } = await serviceClient
        .from("pod2_supplier_connections")
        .select("*")
        .eq("is_active", true)
        .limit(1)
        .single();
      connection = pod2Connection;

      if (!connection) {
        const { data: podConnection } = await serviceClient
          .from("pod_supplier_connections")
          .select("*")
          .eq("is_active", true)
          .limit(1)
          .single();
        connection = podConnection;
      }

      if (connection) {
        apiKey = connection.api_key_encrypted || "";
        authMode = connection.auth_header_mode || authMode;
        authHeaderName = connection.auth_header_name || authHeaderName;
        authHeaderPrefix = connection.auth_header_prefix || authHeaderPrefix;
      }
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Platform API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    switch (authMode) {
      case "authorization_bearer":
        headers["Authorization"] = `Bearer ${apiKey}`;
        break;
      case "x_api_key":
        headers["X-API-Key"] = apiKey;
        break;
      case "custom":
        if (authHeaderName) {
          headers[authHeaderName] = authHeaderPrefix ? `${authHeaderPrefix} ${apiKey}` : apiKey;
        }
        break;
      default:
        headers["Authorization"] = `Bearer ${apiKey}`;
        break;
    }

    const preflightBody = {
      url: pdfUrl,
      profile: technicalSpecs.pod_preflight_profile || DEFAULT_PROFILE,
      template: [{ width: widthMm, height: heightMm }],
      bleed: {
        left: bleedMm,
        right: bleedMm,
        top: bleedMm,
        bottom: bleedMm,
      },
    };

    const preflightResponse = await fetch(`${platformBaseUrl}/pdf/preflight`, {
      method: "POST",
      headers,
      body: JSON.stringify(preflightBody),
    });

    const preflightData = await preflightResponse.json().catch(() => ({}));
    if (!preflightResponse.ok || !preflightData?.id) {
      return new Response(JSON.stringify({
        error: "Preflight request failed",
        details: preflightData,
      }), {
        status: preflightResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jobId = preflightData.id as string;
    let result: any = null;
    let status = "PROCESSING";

    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await fetch(`${platformBaseUrl}/pdf/preflight/${jobId}`, {
        method: "GET",
        headers,
      });
      result = await res.json().catch(() => ({}));
      status = result?.status || "PROCESSING";
      if (status !== "PROCESSING") break;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const errors = (result?.errors || []).map((e: any) => e.message || String(e));
    const warnings = (result?.warnings || []).map((w: any) => w.message || String(w));
    const fixes = (result?.fixes || []).map((f: any) => f.message || String(f));

    let updatedFileUrl: string | undefined;
    const shouldAutoFix = autoFix ?? true;
    const downloadUrl = result?.["download-url"];

    if (shouldAutoFix && downloadUrl && filePath) {
      const pdfRes = await fetch(downloadUrl);
      if (pdfRes.ok) {
        const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
        const { error: uploadError } = await serviceClient.storage
          .from("order-files")
          .upload(filePath, pdfBytes, { contentType: "application/pdf", upsert: true });

        if (!uploadError) {
          const { data } = serviceClient.storage
            .from("order-files")
            .getPublicUrl(filePath);
          updatedFileUrl = data.publicUrl;
        }
      }
    }

    return new Response(JSON.stringify({
      status,
      jobId,
      errors,
      warnings,
      fixes,
      updatedFileUrl,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message || "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
