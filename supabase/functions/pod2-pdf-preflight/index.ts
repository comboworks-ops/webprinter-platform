// POD v2 PDF preflight via Print.com Platform API
// Runs for POD products only and can auto-fix by overwriting the uploaded PDF in storage.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonResponse, methodNotAllowed, optionsResponse } from "../_shared/http.ts";
import { requireUser } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

type PreflightRequest = {
  productId: string;
  pdfUrl?: string;
  storageBucket?: string;
  filePath?: string;
  specs?: {
    width_mm?: number;
    height_mm?: number;
    bleed_mm?: number;
  };
  autoFix?: boolean;
};

const DEFAULT_PROFILE = "GWG_SheetCmyk_2015 CMYK + RGB";
const MAX_FIXED_PDF_BYTES = 50 * 1024 * 1024;
const ORDER_FILES_BUCKET = "order-files";

class RequestError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const isPrivateIpv4 = (host: string) => {
  const match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return false;
  const [a, b] = match.slice(1).map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
};

const assertSafeRemoteUrl = (rawUrl: string, label: string) => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new RequestError(`Invalid ${label}`);
  }

  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:") {
    throw new RequestError(`${label} must use HTTPS`);
  }
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "::1" ||
    hostname === "[::1]" ||
    isPrivateIpv4(hostname)
  ) {
    throw new RequestError(`${label} cannot point to a private or local host`);
  }
};

const assertSafeStoragePath = (path: string) => {
  if (
    path.startsWith("/") ||
    path.includes("..") ||
    path.includes("\\") ||
    !path.toLowerCase().endsWith(".pdf")
  ) {
    throw new RequestError("Invalid filePath for PDF auto-fix upload");
  }
};

const userCanAccessTenant = async (
  serviceClient: ReturnType<typeof createClient>,
  userId: string,
  tenantId: string | null,
) => {
  const { data: roles, error: rolesError } = await serviceClient
    .from("user_roles")
    .select("role, tenant_id")
    .eq("user_id", userId);

  if (rolesError) throw new Error("Could not verify tenant access");

  const normalizedRoles = (roles || []) as Array<{ role: string; tenant_id: string | null }>;
  if (normalizedRoles.some((entry) => entry.role === "master_admin")) return true;

  const isMasterTenant = tenantId === "00000000-0000-0000-0000-000000000000";
  if (isMasterTenant && normalizedRoles.some((entry) => entry.role === "admin")) return true;
  if (tenantId && normalizedRoles.some((entry) => entry.tenant_id === tenantId)) return true;

  if (tenantId) {
    const { data: ownedTenant, error: ownerError } = await serviceClient
      .from("tenants")
      .select("id")
      .eq("id", tenantId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (ownerError) throw new Error("Could not verify tenant ownership");
    if (ownedTenant) return true;
  }

  return false;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return optionsResponse();
  }

  if (req.method !== "POST") {
    return methodNotAllowed();
  }

  const rateLimited = checkRateLimit(req, {
    keyPrefix: "pod2-pdf-preflight",
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  try {
    const auth = await requireUser(req);
    if (!auth.ok) return auth.response;

    const body = (await req.json()) as PreflightRequest;
    const { productId, pdfUrl, filePath, specs, autoFix } = body;

    if (!productId || (!pdfUrl && !filePath)) {
      return jsonResponse({ error: "Missing productId and PDF storage path" }, 400);
    }

    if (pdfUrl) assertSafeRemoteUrl(pdfUrl, "pdfUrl");
    if (filePath) assertSafeStoragePath(filePath);

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: product, error: productError } = await serviceClient
      .from("products")
      .select("id, tenant_id, technical_specs")
      .eq("id", productId)
      .single();

    if (productError || !product) {
      return jsonResponse({ error: "Product not found" }, 404);
    }

    const tenantId = ((product as any).tenant_id || null) as string | null;
    const canAccessTenant = await userCanAccessTenant(serviceClient, auth.user.id, tenantId);
    if (!canAccessTenant) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const technicalSpecs = (product as any).technical_specs || {};
    const isPodProduct = Boolean(technicalSpecs.is_pod || technicalSpecs.is_pod_v2);
    if (!isPodProduct) {
      return jsonResponse({ error: "Preflight is only available for POD products" }, 403);
    }

    if (!technicalSpecs.pod_preflight_enabled) {
      return jsonResponse({ status: "SKIPPED" });
    }

    const widthMm = specs?.width_mm ?? technicalSpecs.width_mm;
    const heightMm = specs?.height_mm ?? technicalSpecs.height_mm;
    const bleedMm = specs?.bleed_mm ?? technicalSpecs.bleed_mm ?? 3;

    if (!widthMm || !heightMm) {
      return jsonResponse({ error: "Missing width/height for preflight template" }, 400);
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
      return jsonResponse({ error: "Platform API key not configured" }, 500);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept": "application/json",
    };

    switch (authMode) {
      case "authorization_bearer":
        headers["Authorization"] = `Bearer ${apiKey}`;
        break;
      case "authorization_printapikey":
        // Print.com's real auth scheme, matches pod2-order-submit.
        headers["Authorization"] = `PrintApiKey ${apiKey}`;
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

    let preflightPdfUrl = pdfUrl || "";
    if (!preflightPdfUrl && filePath) {
      const bucket = body.storageBucket || ORDER_FILES_BUCKET;
      if (bucket !== ORDER_FILES_BUCKET) {
        throw new RequestError("Unsupported storageBucket for POD2 preflight");
      }
      const { data: signedUrlData, error: signedUrlError } = await serviceClient.storage
        .from(bucket)
        .createSignedUrl(filePath, 10 * 60);
      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new RequestError("Could not create signed PDF URL for preflight", 500);
      }
      preflightPdfUrl = signedUrlData.signedUrl;
    }

    assertSafeRemoteUrl(preflightPdfUrl, "preflightPdfUrl");

    const preflightBody = {
      url: preflightPdfUrl,
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
      return jsonResponse({
        error: "Preflight request failed",
        details: preflightData,
      }, preflightResponse.status);
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
      assertSafeRemoteUrl(downloadUrl, "downloadUrl");
      const pdfRes = await fetch(downloadUrl);
      if (pdfRes.ok) {
        const contentLength = pdfRes.headers.get("content-length");
        if (contentLength && Number(contentLength) > MAX_FIXED_PDF_BYTES) {
          throw new RequestError(`Fixed PDF exceeds the ${MAX_FIXED_PDF_BYTES / 1024 / 1024} MB limit`, 413);
        }
        const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
        if (pdfBytes.byteLength > MAX_FIXED_PDF_BYTES) {
          throw new RequestError(`Fixed PDF exceeds the ${MAX_FIXED_PDF_BYTES / 1024 / 1024} MB limit`, 413);
        }
        const pdfHeader = new TextDecoder().decode(pdfBytes.slice(0, 5));
        if (pdfHeader !== "%PDF-") {
          throw new RequestError("Auto-fix download did not return a PDF");
        }

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

    return jsonResponse({
      status,
      jobId,
      errors,
      warnings,
      fixes,
      updatedFileUrl,
    });
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Unexpected error" },
      error instanceof RequestError ? error.status : 500,
    );
  }
});
