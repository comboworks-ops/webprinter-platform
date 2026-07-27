// POD2X Print.com Proxy Edge Function
// Isolated from POD v2 - completely separate system

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { requireRole } from "../_shared/auth.ts";
import { MASTER_TENANT_ID } from "../_shared/pod2PrintcomSafety.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    const auth = await requireRole(req, ["master_admin"], MASTER_TENANT_ID);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : "";
    const productId = typeof body?.productId === "string"
      ? body.productId.trim()
      : "";
    if (!productId || productId.length > 200) {
      return new Response(
        JSON.stringify({ error: "A valid productId is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // For now, return mock data since we don't have real Print.com API access
    // This shows the structure the skill expects

    if (action === "analyzeProduct") {
      return new Response(
        JSON.stringify({
          product: {
            id: productId,
            name: "Printed Letterheads",
            description: "Professional letterheads printing",
          },
          quantities: {
            min: 50,
            max: 10000,
            step: 1,
            suggested: [50, 100, 250, 500, 1000, 2500, 5000],
          },
          deliveryOptions: [
            { id: "eco", name: "Eco Delivery", days: 7, price: 0 },
            { id: "standard", name: "Standard", days: 5, price: 25 },
            { id: "express", name: "Express", days: 3, price: 45 },
            { id: "priority", name: "Priority", days: 2, price: 75 },
            { id: "urgent", name: "Urgent", days: 1, price: 120 },
          ],
          finishes: [
            { id: "tube", name: "Truck Tube", price: 25 },
            { id: "lam-matte", name: "Lamination Matte", price: 15 },
            { id: "lam-gloss", name: "Lamination Gloss", price: 15 },
          ],
          printMethods: [
            { id: "offset", name: "Offset" },
            { id: "inkjet", name: "Inkjet" },
            { id: "hp-indigo", name: "HP Indigo" },
          ],
          designs: {
            supportsMultiple: true,
            max: 10,
          },
          recommendations: {
            cheap: { id: "eco", name: "Eco Delivery", days: 7 },
            normal: { id: "standard", name: "Standard", days: 5 },
            fast: { id: "priority", name: "Priority", days: 2 },
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "POD2X request failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
