// Temporary release safeguard. No database client, credentials or deletion calls.
Deno.serve((req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
  if (req.method === 'OPTIONS') return new Response('ok', {headers});
  return new Response(JSON.stringify({
    error: 'import_removal_temporarily_disabled',
    message: 'Sletning af importerede produkter er midlertidigt sat på pause. Ingen data er slettet.',
  }), {status: 409, headers});
});
