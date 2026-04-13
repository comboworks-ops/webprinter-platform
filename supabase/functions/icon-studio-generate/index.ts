import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MASTER_TENANT_ID = "00000000-0000-0000-0000-000000000000";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type ProviderPreference = "auto" | "mock" | "gemini" | "openai";
type ResolvedProviderKey = "gemini-image-v1" | "openai-image-v1";

type GenerationPayload = {
  productKey: string;
  styleKey: string;
  variantKey: string;
  tenantId: string;
  brandOverlay: {
    enabled: boolean;
    assetId: string | null;
    placementPreset: string | null;
    finishKey: string;
  };
  references: {
    referenceAssetIds: string[];
    maxAssets: number;
  };
  output: {
    background: "transparent";
    format: "png" | "svg";
    size: number;
  };
};

type ReferenceAssetHint = {
  id: string;
  name: string;
  productKey: string;
  styleKey: string | null;
  variantKey: string | null;
  finishKey: string | null;
  usageTags: string[];
  priority: number;
};

type ReferenceImageInput = {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
};

type EdgeDraft = {
  label: string;
  extension: "png";
  contentType: "image/png";
  base64Data: string;
  width: number;
  height: number;
  metadata: Record<string, unknown>;
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function getOpenAiModel() {
  return Deno.env.get("ICON_STUDIO_OPENAI_MODEL") || "gpt-image-1.5";
}

function getGeminiModel() {
  return Deno.env.get("ICON_STUDIO_GEMINI_MODEL") || "gemini-3.1-flash-image-preview";
}

function resolveRequestedProvider(preference: ProviderPreference): ResolvedProviderKey {
  const hasGemini = Boolean(Deno.env.get("GEMINI_API_KEY"));
  const hasOpenAi = Boolean(Deno.env.get("OPENAI_API_KEY"));

  if (preference === "gemini") {
    if (!hasGemini) throw new Error("GEMINI_API_KEY is not configured for Icon Studio.");
    return "gemini-image-v1";
  }

  if (preference === "openai") {
    if (!hasOpenAi) throw new Error("OPENAI_API_KEY is not configured for Icon Studio.");
    return "openai-image-v1";
  }

  if (hasOpenAi) return "openai-image-v1";
  if (hasGemini) return "gemini-image-v1";

  throw new Error("No server-side Icon Studio provider is configured.");
}

function buildReferenceHints(referenceAssets: ReferenceAssetHint[]) {
  if (!referenceAssets.length) {
    return "No tagged reference assets matched this request.";
  }

  return referenceAssets
    .slice(0, 5)
    .map((asset, index) => {
      const parts = [
        asset.name,
        asset.productKey,
        asset.styleKey || "any-style",
        asset.variantKey || "any-variant",
        asset.finishKey || "any-finish",
        asset.usageTags.length ? asset.usageTags.join("|") : "no-tags",
      ];
      return `${index + 1}. ${parts.join(" / ")}`;
    })
    .join("\n");
}

function buildPlacementHint(payload: GenerationPayload) {
  if (!payload.brandOverlay.enabled || !payload.brandOverlay.placementPreset) {
    return "No reserved logo zone required.";
  }

  return `Reserve clean negative space for a later deterministic brand overlay near ${payload.brandOverlay.placementPreset}. Do not render any logo, letters, or brand mark in that reserved zone.`;
}

function buildDraftPrompt(
  providerKey: ResolvedProviderKey,
  payload: GenerationPayload,
  referenceAssets: ReferenceAssetHint[],
  label: string,
) {
  const variationHintByLabel: Record<string, string> = {
    "Udkast A": "Prioritize the cleanest silhouette and strongest product readability.",
    "Udkast B": "Prioritize slightly richer material cues and depth while keeping the silhouette simple.",
    "Udkast C": "Prioritize a premium catalog feel with subtly more dramatic angle and lighting.",
  };

  const backgroundInstruction = providerKey === "openai-image-v1"
    ? "Output must be centered, square, transparent background, catalog-safe, premium, and reusable."
    : "Output must be centered, square, on a pure white seamless background with no scene, no environment, and no cast shadow extending into the frame. The white background will be removed after generation.";
  const referenceInstruction = referenceAssets.length > 0
    ? `Use the provided curated style-bank references as the authoritative visual language. Keep the same overall presentation family, simplification level, material feel, edge treatment, lighting logic, and commercial catalog consistency across this bank. ${referenceAssets.length} matched bank reference(s) are attached to this request.`
    : "No visual bank references are attached, so rely only on the controlled style and product instructions.";

  return [
    "Generate a single isolated print-product icon draft for an internal admin icon studio.",
    `Product key: ${payload.productKey}.`,
    `Style key: ${payload.styleKey}.`,
    `Variant key: ${payload.variantKey}.`,
    "The subject must be a print product only, never apparel, t-shirts, people, rooms, tables, hands, or lifestyle scenes.",
    backgroundInstruction,
    "Do not include any text, letters, watermark, logotype, or random symbols in the image.",
    referenceInstruction,
    buildPlacementHint(payload),
    `Brand finish preset for later deterministic overlay: ${payload.brandOverlay.finishKey}.`,
    "Reference hints from the curated admin library:",
    buildReferenceHints(referenceAssets),
    variationHintByLabel[label] || "Keep the output controlled and commercially clean.",
  ].join("\n");
}

function parseOpenAiError(payload: any) {
  return payload?.error?.message || payload?.message || "OpenAI image generation failed.";
}

function dataUrlToBlob(dataUrl: string, fallbackMimeType = "image/png") {
  const matches = dataUrl.match(/^data:([^;,]+)?;base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid reference image payload.");
  }

  const mimeType = matches[1] || fallbackMimeType;
  const binary = atob(matches[2]);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

function dataUrlToGeminiInlineData(dataUrl: string, fallbackMimeType = "image/png") {
  const matches = dataUrl.match(/^data:([^;,]+)?;base64,(.+)$/);
  if (!matches) {
    throw new Error("Invalid reference image payload.");
  }

  return {
    mimeType: matches[1] || fallbackMimeType,
    data: matches[2],
  };
}

async function generateWithOpenAi(prompt: string, referenceImages: ReferenceImageInput[]): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured for Icon Studio.");
  }

  const useReferenceEditMode = referenceImages.length > 0;
  const response = useReferenceEditMode
    ? await (async () => {
      const formData = new FormData();
      formData.append("model", getOpenAiModel());
      formData.append("prompt", prompt);
      formData.append("size", "1024x1024");
      formData.append("quality", "high");
      formData.append("background", "transparent");
      formData.append("output_format", "png");
      formData.append("input_fidelity", "high");

      referenceImages.slice(0, 5).forEach((asset, index) => {
        formData.append(
          "image[]",
          dataUrlToBlob(asset.dataUrl, asset.mimeType),
          `${asset.name || `reference-${index + 1}`}.png`,
        );
      });

      return fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });
    })()
    : await fetch("https://api.openai.com/v1/images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getOpenAiModel(),
        prompt,
        size: "1024x1024",
        background: "transparent",
        output_format: "png",
        quality: "high",
      }),
    });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(parseOpenAiError(payload));
  }

  const base64Data = payload?.data?.[0]?.b64_json;
  if (!base64Data) {
    throw new Error("OpenAI did not return image data for Icon Studio.");
  }

  return base64Data;
}

function parseGeminiError(payload: any) {
  return payload?.error?.message || payload?.message || "Gemini image generation failed.";
}

function getGeminiImageSize(outputSize: number) {
  if (outputSize >= 1536) return "2K";
  return "1K";
}

async function generateWithGemini(
  prompt: string,
  outputSize: number,
  referenceImages: ReferenceImageInput[],
): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured for Icon Studio.");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiModel()}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              ...referenceImages.slice(0, 5).map((asset) => ({
                inlineData: dataUrlToGeminiInlineData(asset.dataUrl, asset.mimeType),
              })),
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: getGeminiImageSize(outputSize),
          },
        },
      }),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(parseGeminiError(payload));
  }

  const candidates = payload?.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];
    for (const part of parts) {
      if (part?.inlineData?.data) {
        return part.inlineData.data as string;
      }
    }
  }

  throw new Error("Gemini did not return image data for Icon Studio.");
}

async function generateDrafts(
  providerKey: ResolvedProviderKey,
  payload: GenerationPayload,
  referenceAssets: ReferenceAssetHint[],
  referenceImages: ReferenceImageInput[],
): Promise<EdgeDraft[]> {
  const labels = ["Udkast A", "Udkast B", "Udkast C"];

  return Promise.all(
    labels.map(async (label) => {
      const prompt = buildDraftPrompt(providerKey, payload, referenceAssets, label);
      const base64Data = providerKey === "openai-image-v1"
        ? await generateWithOpenAi(prompt, referenceImages)
        : await generateWithGemini(prompt, payload.output.size, referenceImages);

      return {
        label,
        extension: "png",
        contentType: "image/png",
        base64Data,
        width: 1024,
        height: 1024,
        metadata: {
          promptProfile: "icon-studio-controlled-v1",
          providerKey,
          requestedOutputSize: payload.output.size,
          referenceHintCount: referenceAssets.length,
          referenceImageCount: referenceImages.length,
        },
      };
    }),
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) {
      return jsonResponse(401, { success: false, error: "Unauthorized" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const authedClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await authedClient.auth.getUser();
    if (userError || !user) {
      return jsonResponse(401, { success: false, error: "Unauthorized" });
    }

    const { tenantId, providerPreference, payload, referenceAssets, referenceImages } = await req.json() as {
      tenantId?: string;
      providerPreference?: ProviderPreference;
      payload?: GenerationPayload;
      referenceAssets?: ReferenceAssetHint[];
      referenceImages?: ReferenceImageInput[];
    };

    if (!tenantId || !payload) {
      return jsonResponse(400, { success: false, error: "tenantId and payload are required." });
    }

    if ((providerPreference || "auto") === "mock") {
      return jsonResponse(400, { success: false, error: "Mock provider should run client-side only." });
    }

    if (payload.output.format !== "png") {
      return jsonResponse(400, { success: false, error: "AI providers currently support PNG output only." });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const [
      { data: masterRole },
      { data: tenantRole },
      { data: tenantRow },
      { data: moduleRow },
    ] = await Promise.all([
      serviceClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "master_admin")
        .maybeSingle(),
      serviceClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("tenant_id", tenantId)
        .in("role", ["admin", "staff"])
        .maybeSingle(),
      serviceClient
        .from("tenants")
        .select("id, owner_id")
        .eq("id", tenantId)
        .maybeSingle(),
      serviceClient
        .from("tenant_module_access")
        .select("has_access, is_enabled")
        .eq("tenant_id", tenantId)
        .eq("module_id", "icon-studio")
        .maybeSingle(),
    ]);

    const isMasterAdmin = Boolean(masterRole);
    const hasTenantAccess = isMasterAdmin
      || Boolean(tenantRole)
      || tenantRow?.owner_id === user.id;

    if (!hasTenantAccess) {
      return jsonResponse(403, { success: false, error: "Access denied for this tenant." });
    }

    const hasModuleAccess = (isMasterAdmin && tenantId === MASTER_TENANT_ID)
      || Boolean(moduleRow?.has_access && moduleRow?.is_enabled);

    if (!hasModuleAccess) {
      return jsonResponse(403, { success: false, error: "Icon Studio is not enabled for this tenant." });
    }

    const resolvedProvider = resolveRequestedProvider(providerPreference || "auto");
    const drafts = await generateDrafts(
      resolvedProvider,
      payload,
      referenceAssets || [],
      referenceImages || [],
    );

    return jsonResponse(200, {
      success: true,
      providerKey: resolvedProvider,
      drafts,
    });
  } catch (error: any) {
    console.error("[icon-studio-generate]", error);
    return jsonResponse(500, {
      success: false,
      error: error?.message || "Icon Studio generation failed.",
    });
  }
});
