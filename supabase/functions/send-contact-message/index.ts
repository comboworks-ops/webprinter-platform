import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const PLATFORM_CONTACT_EMAIL = Deno.env.get("PLATFORM_CONTACT_EMAIL") ?? "info@webprinter.dk";
const DEFAULT_FROM_EMAIL = Deno.env.get("CONTACT_EMAIL_FROM") ?? "info@webprinter.dk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ContactMessageRequest = {
  mode?: "platform" | "tenant";
  tenantId?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  senderPhone?: string | null;
  company?: string | null;
  subject?: string | null;
  message?: string | null;
  hostname?: string | null;
  pathname?: string | null;
};

type TenantRow = {
  id: string;
  name: string;
  domain: string | null;
  settings: Record<string, unknown> | null;
};

type RecipientInfo = {
  email: string;
  shopName: string;
  domain: string | null;
};

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeText(value: string | null | undefined, maxLength: number): string {
  return String(value || "").trim().slice(0, maxLength);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getClientKey(req: Request, mode: string, tenantId: string | null): string {
  const forwardedFor = req.headers.get("x-forwarded-for") || "";
  const ip = forwardedFor.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
  return `${ip}:${mode}:${tenantId || "platform"}`;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const current = rateLimitStore.get(key);

  if (!current || now > current.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }

  if (current.count >= 5) {
    return false;
  }

  current.count += 1;
  return true;
}

async function resolveRecipient(
  serviceClient: ReturnType<typeof createClient>,
  mode: "platform" | "tenant",
  tenantId: string | null,
): Promise<RecipientInfo> {
  if (mode === "platform") {
    return {
      email: PLATFORM_CONTACT_EMAIL,
      shopName: "Webprinter",
      domain: "webprinter.dk",
    };
  }

  if (!tenantId) {
    throw new Error("tenantId is required for tenant contact messages");
  }

  const { data, error } = await serviceClient
    .from("tenants")
    .select("id, name, domain, settings")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Tenant not found");

  const tenant = data as TenantRow;
  const settings = tenant.settings || {};
  const company = (settings.company || {}) as Record<string, unknown>;
  const email = normalizeText(String(company.email || ""), 255);
  const shopName = normalizeText(String(company.name || tenant.name || "Webprinter"), 120);

  if (!email || !isValidEmail(email)) {
    throw new Error("Shop contact email is not configured");
  }

  return {
    email,
    shopName: shopName || tenant.name || "Webprinter",
    domain: tenant.domain,
  };
}

async function sendEmail(payload: {
  from: string;
  to: string[];
  replyTo?: string;
  subject: string;
  html: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: payload.from,
      to: payload.to,
      reply_to: payload.replyTo,
      subject: payload.subject,
      html: payload.html,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Resend API error: ${responseText}`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return { raw: responseText };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const body = (await req.json()) as ContactMessageRequest;
    const mode = body.mode === "tenant" ? "tenant" : "platform";
    const tenantId = normalizeText(body.tenantId, 64) || null;
    const senderName = normalizeText(body.senderName, 120);
    const senderEmail = normalizeText(body.senderEmail, 255).toLowerCase();
    const senderPhone = normalizeText(body.senderPhone, 40);
    const senderCompany = normalizeText(body.company, 160);
    const senderSubject = normalizeText(body.subject, 160) || "Ny henvendelse";
    const senderMessage = normalizeText(body.message, 5000);
    const hostname = normalizeText(body.hostname, 255);
    const pathname = normalizeText(body.pathname, 255);

    if (!senderName || senderName.length < 2) {
      return jsonResponse(400, { error: "Navn mangler eller er for kort." });
    }

    if (!senderEmail || !isValidEmail(senderEmail)) {
      return jsonResponse(400, { error: "Ugyldig e-mail adresse." });
    }

    if (!senderMessage || senderMessage.length < 10) {
      return jsonResponse(400, { error: "Beskeden er for kort." });
    }

    const rateLimitKey = getClientKey(req, mode, tenantId);
    if (!checkRateLimit(rateLimitKey)) {
      return jsonResponse(429, { error: "For mange forsøg. Prøv igen senere." });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const recipient = await resolveRecipient(serviceClient, mode, tenantId);
    const fromAddress = DEFAULT_FROM_EMAIL.includes("<")
      ? DEFAULT_FROM_EMAIL
      : `${recipient.shopName} <${DEFAULT_FROM_EMAIL}>`;

    const supportSubject = `[Kontakt] ${recipient.shopName}: ${escapeHtml(senderSubject)}`;
    const supportHtml = `
      <h2>Ny kontaktbesked</h2>
      <p><strong>Shop:</strong> ${escapeHtml(recipient.shopName)}</p>
      ${recipient.domain ? `<p><strong>Domæne:</strong> ${escapeHtml(recipient.domain)}</p>` : ""}
      ${hostname ? `<p><strong>Hostname:</strong> ${escapeHtml(hostname)}</p>` : ""}
      ${pathname ? `<p><strong>Side:</strong> ${escapeHtml(pathname)}</p>` : ""}
      <hr />
      <p><strong>Navn:</strong> ${escapeHtml(senderName)}</p>
      <p><strong>E-mail:</strong> ${escapeHtml(senderEmail)}</p>
      ${senderPhone ? `<p><strong>Telefon:</strong> ${escapeHtml(senderPhone)}</p>` : ""}
      ${senderCompany ? `<p><strong>Virksomhed:</strong> ${escapeHtml(senderCompany)}</p>` : ""}
      <p><strong>Emne:</strong> ${escapeHtml(senderSubject)}</p>
      <p><strong>Besked:</strong></p>
      <div style="white-space: pre-wrap; font-family: Arial, sans-serif;">${escapeHtml(senderMessage)}</div>
    `;

    const customerHtml = `
      <h2>Tak for din henvendelse</h2>
      <p>Vi har modtaget din besked hos ${escapeHtml(recipient.shopName)}.</p>
      <p><strong>Emne:</strong> ${escapeHtml(senderSubject)}</p>
      <div style="white-space: pre-wrap; font-family: Arial, sans-serif; background: #f8fafc; padding: 16px; border-radius: 8px;">${escapeHtml(senderMessage)}</div>
      <p>Vi vender tilbage hurtigst muligt.</p>
      <p>Med venlig hilsen<br /><strong>${escapeHtml(recipient.shopName)}</strong></p>
    `;

    const [supportEmail, customerEmail] = await Promise.all([
      sendEmail({
        from: fromAddress,
        to: [recipient.email],
        replyTo: senderEmail,
        subject: supportSubject,
        html: supportHtml,
      }),
      sendEmail({
        from: fromAddress,
        to: [senderEmail],
        replyTo: recipient.email,
        subject: `Tak for din henvendelse til ${recipient.shopName}`,
        html: customerHtml,
      }),
    ]);

    return jsonResponse(200, {
      success: true,
      mode,
      recipient: recipient.email,
      supportEmailId: supportEmail?.id ?? null,
      customerEmailId: customerEmail?.id ?? null,
    });
  } catch (error) {
    console.error("send-contact-message error:", error);
    return jsonResponse(500, {
      error: error instanceof Error ? error.message : "Ukendt fejl ved afsendelse af kontaktbesked.",
    });
  }
});
