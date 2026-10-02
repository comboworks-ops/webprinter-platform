import { generateWideFormatTemplate } from '../src/lib/designer/generateWideFormatTemplate.js';
export const config = { runtime: 'edge' };
export default async function handler(request: Request): Promise<Response> {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  try {
    const bytes = await generateWideFormatTemplate(request.url);
    return new Response(request.method === 'HEAD' ? null : bytes.slice().buffer as ArrayBuffer, { headers: { 'content-type': 'application/pdf', 'cache-control': 'public, max-age=31536000, immutable', 'content-disposition': 'attachment; filename="Webprinter-skabelon.pdf"', 'x-content-type-options': 'nosniff' } });
  } catch { return new Response('Ugyldig størrelse eller form til skabelonen.', { status: 400 }); }
}
