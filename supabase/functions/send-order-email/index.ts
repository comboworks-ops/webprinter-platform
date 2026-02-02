// Supabase Edge Function for sending order status emails
// Deploy with: supabase functions deploy send-order-email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderEmailPayload {
  type: "status_change" | "order_confirmation" | "problem_notification";
  order: {
    order_number: string;
    product_name: string;
    quantity: number;
    total_price: number;
    status: string;
    tracking_number?: string;
    estimated_delivery?: string;
    problem_description?: string;
  };
  customer: {
    email: string;
    name: string;
  };
}

const statusLabels: Record<string, string> = {
  pending: "Modtaget",
  processing: "Behandles",
  production: "Under produktion",
  shipped: "Afsendt",
  delivered: "Leveret",
  cancelled: "Annulleret",
  problem: "Problem med ordre",
};

function getEmailSubject(payload: OrderEmailPayload): string {
  switch (payload.type) {
    case "order_confirmation":
      return `Ordrebekræftelse - ${payload.order.order_number}`;
    case "status_change":
      return `Ordre ${payload.order.order_number} - ${statusLabels[payload.order.status] || payload.order.status}`;
    case "problem_notification":
      return `Handling påkrævet - Ordre ${payload.order.order_number}`;
    default:
      return `Opdatering - Ordre ${payload.order.order_number}`;
  }
}

function getEmailHtml(payload: OrderEmailPayload): string {
  const { order, customer, type } = payload;

  const baseStyles = `
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
  `;

  const buttonStyle = `
    display: inline-block;
    padding: 12px 24px;
    background-color: #2563eb;
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
  `;

  let content = "";

  if (type === "order_confirmation") {
    content = `
      <h1 style="color: #16a34a;">✓ Tak for din ordre!</h1>
      <p>Hej ${customer.name},</p>
      <p>Vi har modtaget din ordre og går straks i gang med at behandle den.</p>
    `;
  } else if (type === "status_change") {
    const statusEmoji = {
      processing: "⚙️",
      production: "🏭",
      shipped: "📦",
      delivered: "✅",
      cancelled: "❌",
    }[order.status] || "📋";

    content = `
      <h1>${statusEmoji} Ordre opdateret</h1>
      <p>Hej ${customer.name},</p>
      <p>Status på din ordre er nu: <strong>${statusLabels[order.status] || order.status}</strong></p>
      ${order.status === "shipped" && order.tracking_number ? `
        <p><strong>Tracking nummer:</strong> ${order.tracking_number}</p>
        ${order.estimated_delivery ? `<p><strong>Forventet levering:</strong> ${order.estimated_delivery}</p>` : ""}
      ` : ""}
    `;
  } else if (type === "problem_notification") {
    content = `
      <h1 style="color: #dc2626;">⚠️ Handling påkrævet</h1>
      <p>Hej ${customer.name},</p>
      <p>Der er desværre opstået et problem med din ordre.</p>
      ${order.problem_description ? `<p><strong>Beskrivelse:</strong> ${order.problem_description}</p>` : ""}
      <p>Log ind på din konto for at se detaljer og uploade eventuelle nye filer.</p>
      <p style="margin-top: 20px;">
        <a href="https://yoursite.dk/mine-ordrer" style="${buttonStyle}">Se din ordre</a>
      </p>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="${baseStyles} background-color: #f5f5f5; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 30px; text-align: center;">
          <h2 style="color: white; margin: 0;">WebPrint Danmark</h2>
        </div>
        
        <!-- Content -->
        <div style="padding: 30px;">
          ${content}
          
          <!-- Order Summary -->
          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #666;">Ordredetaljer</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Ordrenummer:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${order.order_number}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Produkt:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${order.product_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;"><strong>Antal:</strong></td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${order.quantity}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0;"><strong>Total:</strong></td>
                <td style="padding: 8px 0; text-align: right; font-size: 18px; color: #2563eb;"><strong>${order.total_price.toLocaleString('da-DK')} DKK</strong></td>
              </tr>
            </table>
          </div>
          
          <p style="margin-top: 30px;">
            <a href="https://yoursite.dk/mine-ordrer" style="${buttonStyle}">Se din ordre</a>
          </p>
        </div>
        
        <!-- Footer -->
        <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
          <p style="margin: 0; color: #666; font-size: 14px;">
            Har du spørgsmål? Kontakt os på <a href="mailto:info@webprint.dk">info@webprint.dk</a>
          </p>
          <p style="margin: 10px 0 0; color: #999; font-size: 12px;">
            © ${new Date().getFullYear()} WebPrint Danmark. Alle rettigheder forbeholdes.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: OrderEmailPayload = await req.json();

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        // Using Resend's test domain for development - change to your verified domain for production
        from: "WebPrint <onboarding@resend.dev>",
        to: [payload.customer.email],
        subject: getEmailSubject(payload),
        html: getEmailHtml(payload),
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const data = await res.json();

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
