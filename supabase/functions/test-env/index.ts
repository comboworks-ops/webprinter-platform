import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  try {
    const allEnv = Deno.env.toObject();
    
    // Find token-related env vars
    const tokenKeys = Object.keys(allEnv).filter(k => 
      k.toLowerCase().includes('flyer') || 
      k.toLowerCase().includes('alarm') || 
      k.toLowerCase().includes('token')
    );
    
    const token = allEnv["FLYERALARM_DEMO_TOKEN"] || "";
    
    return new Response(
      JSON.stringify({
        token_found: !!token,
        token_length: token.length,
        token_preview: token ? token.substring(0, 50) + "..." : null,
        token_keys: tokenKeys,
        all_keys_count: Object.keys(allEnv).length,
      }, null, 2),
      { headers }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers, status: 500 }
    );
  }
});
