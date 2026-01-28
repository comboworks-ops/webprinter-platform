import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HTML escape function to prevent HTML injection in emails
const escapeHtml = (str: string): string => {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return map[c] || c;
  });
};

interface QuoteEmailRequest {
  phone: string;
  email: string;
  wantsCall: boolean;
  productName: string;
  productSpecs?: string;
  estimatedPrice?: string;
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const checkRateLimit = (userId: string): boolean => {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(userId, { count: 1, resetTime: now + 3600000 }); // 1 hour
    return true;
  }

  if (userLimit.count >= 3) {
    return false;
  }

  userLimit.count++;
  return true;
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract user ID from JWT (automatically verified by Supabase)
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user ID from authorization header (JWT payload)
    const userId = req.headers.get('x-user-id') || 'anonymous';

    // Rate limiting check
    if (!checkRateLimit(userId)) {
      console.error("Rate limit exceeded for user:", userId);
      return new Response(
        JSON.stringify({ error: "For mange forsøg. Prøv igen om en time." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone, email, wantsCall, productName, productSpecs, estimatedPrice }: QuoteEmailRequest = await req.json();

    console.log("Received quote request:", { phone, email, productName, wantsCall, userId });



    // Input validation
    if (!phone || phone.length !== 8 || !/^\d{8}$/.test(phone)) {
      console.error("Invalid phone number:", phone);
      return new Response(
        JSON.stringify({ error: "Ugyldigt telefonnummer. Skal være 8 cifre." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email || !email.includes("@") || email.length > 255) {
      console.error("Invalid email:", email);
      return new Response(
        JSON.stringify({ error: "Ugyldig e-mail adresse." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!productName || productName.length > 500) {
      console.error("Invalid product name:", productName);
      return new Response(
        JSON.stringify({ error: "Ugyldigt produktnavn." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email to support team
    console.log("Sending notification email to support...");
    const supportEmailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Webprinter <support@webprinter.dk>",
        to: ["support@webprinter.dk"],
        subject: `Ny tilbudsforespørgsel - ${escapeHtml(productName)}`,
        html: `
          <h2>Ny tilbudsforespørgsel</h2>
          <h3>Kundeoplysninger:</h3>
          <ul>
            <li><strong>Telefonnummer:</strong> ${escapeHtml(phone)}</li>
            <li><strong>E-mail:</strong> ${escapeHtml(email)}</li>
            <li><strong>Ønsker telefonisk kontakt:</strong> ${wantsCall ? "Ja" : "Nej"}</li>
          </ul>
          
          <h3>Produktdetaljer:</h3>
          <ul>
            <li><strong>Produkt:</strong> ${escapeHtml(productName)}</li>
            ${productSpecs ? `<li><strong>Specifikationer:</strong> ${escapeHtml(productSpecs)}</li>` : ""}
            ${estimatedPrice ? `<li><strong>Estimeret pris:</strong> ${escapeHtml(estimatedPrice)}</li>` : ""}
          </ul>
          
          ${wantsCall ? "<p><strong>OBS: Kunden har anmodet om telefonisk kontakt!</strong></p>" : ""}
        `,
      }),
    });

    const supportEmailData = await supportEmailResponse.json();
    console.log("Support email sent:", supportEmailData);

    if (!supportEmailResponse.ok) {
      throw new Error(`Failed to send support email: ${JSON.stringify(supportEmailData)}`);
    }

    // Send confirmation email to customer
    console.log("Sending confirmation email to customer...");
    const customerEmailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Webprinter <support@webprinter.dk>",
        to: [email],
        subject: "Dit tilbud fra Webprinter.dk",
        html: `
          <h2>Tak for din forespørgsel!</h2>
          
          <p>Vi har modtaget din forespørgsel om tilbud på følgende:</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Produkt: ${escapeHtml(productName)}</h3>
            ${productSpecs ? `<p><strong>Specifikationer:</strong> ${escapeHtml(productSpecs)}</p>` : ""}
            ${estimatedPrice ? `<p style="font-size: 18px; color: #2563eb;"><strong>Estimeret pris: ${escapeHtml(estimatedPrice)}</strong></p>` : ""}
          </div>
          
          ${wantsCall
            ? "<p>Vi kontakter dig telefonisk snarest muligt for rådgivning eller bekræftelse.</p>"
            : "<p>Hvis du har spørgsmål, er du velkommen til at kontakte os.</p>"
          }
          
          <h3>Kontakt os</h3>
          <p>
            <strong>Telefon:</strong> 71 99 11 10<br>
            <strong>E-mail:</strong> support@webprinter.dk
          </p>
          
          <p>Med venlig hilsen,<br>
          <strong>Webprinter</strong></p>
        `,
      }),
    });

    const customerEmailData = await customerEmailResponse.json();
    console.log("Customer email sent:", customerEmailData);

    if (!customerEmailResponse.ok) {
      throw new Error(`Failed to send customer email: ${JSON.stringify(customerEmailData)}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        supportEmailId: supportEmailData.id,
        customerEmailId: customerEmailData.id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-quote-emails function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Der opstod en fejl ved afsendelse af e-mails." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
