import { loadEnv, type Plugin } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { brochureChecksum } from './product-import/shared/brochure-bank-draft.js';
import { brochurePreviewAccess } from './brochure-preview-access';
export function localBrochureQuote(): Plugin {
  return { name: 'local-brochure-quote', apply: 'serve', configureServer(server) {
    server.middlewares.use(async (request, response, next) => {
      const pathname = (request.url || '').split('?')[0];
      if(pathname==='/brochure/saved-product.json'){
        const access=brochurePreviewAccess({host:request.headers.host,remoteAddress:request.socket.remoteAddress,
          origin:request.headers.origin,method:request.method,fetchSite:String(request.headers['sec-fetch-site']||'')});
        if(access!==200){response.statusCode=access;if(access===405)response.setHeader('Allow','GET, HEAD');response.end();return;}
        try{
          const root=path.join(server.config.root,'output/brochure-2026-10-06/review/complete');
          const [receipt,plan]=await Promise.all(['product-draft-receipt.json','product-resolution-plan.json'].map(async name=>JSON.parse(await fs.readFile(path.join(root,name),'utf8'))));
          if(receipt.productId!==plan.proposedProductId||receipt.planChecksum!==brochureChecksum(plan)
            ||plan.tenantId!=='00000000-0000-0000-0000-000000000000')throw Error('Saved draft identity changed');
          const env=loadEnv(server.config.mode,server.config.root,'');
          const client=createClient(env.SUPABASE_URL||env.VITE_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
          const [product,groups]=await Promise.all([
            client.from('products').select('id,slug,tenant_id,name,description,image_url,category,pricing_type,pricing_structure,technical_specs,template_files,banner_config,is_published,is_ready,is_available_to_tenants')
              .eq('id',receipt.productId).eq('tenant_id',plan.tenantId).single(),
            client.from('product_attribute_groups').select('*,values:product_attribute_values(*)').eq('product_id',receipt.productId).eq('tenant_id',plan.tenantId).order('sort_order')
          ]);
          if(product.error||groups.error||!product.data||groups.data?.length!==6
            ||product.data.is_published||product.data.is_ready||product.data.is_available_to_tenants
            ||product.data.technical_specs?.importPlanChecksum!==receipt.planChecksum)throw Error('Saved unpublished draft unavailable');
          const values=groups.data.flatMap(group=>group.values);
          if(values.length!==plan.productValues.length||values.some(value=>value.tenant_id!==plan.tenantId||value.product_id!==receipt.productId)
            ||brochureChecksum(product.data.pricing_structure)!==brochureChecksum(plan.pricingStructure))throw Error('Saved draft options changed');
          const bytes=Buffer.from(JSON.stringify({product:product.data,sourceGroups:groups.data,completed:receipt.status==='verified_product_draft'&&receipt.postWriteManifestValidated===true,verifiedPriceRows:receipt.verifiedPriceRows}));
          response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
          response.end(request.method==='HEAD'?undefined:bytes);
        }catch{response.statusCode=503;response.end(JSON.stringify({error:'Den gemte produktkladde kunne ikke åbnes.'}));}
        return;
      }
      const preview = pathname.match(/^\/brochure\/(catalog\.json|articles\/[0-9]+\.json|product-resolution\.json)$/);
      if (preview) {
        if (!['GET','HEAD'].includes(request.method || '')) { response.statusCode=405;response.setHeader('Allow','GET, HEAD');response.end();return; }
        try {
          const filename = preview[1] === 'product-resolution.json'
            ? path.join(server.config.root, 'output/brochure-2026-10-06/review/complete/product-resolution-plan.json')
            : path.join(server.config.root,'output/brochure-2026-10-06/preview',preview[1]);
          const bytes=await fs.readFile(filename);
          response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
          response.end(request.method==='HEAD'?undefined:bytes);
        } catch { response.statusCode=404;response.end(JSON.stringify({error:'Produktkladden kunne ikke hentes.'})); }
        return;
      }
      if (pathname !== '/api/brochure-quote') return next();
      try {
        const { default: handler } = await server.ssrLoadModule('/api/brochure-quote.ts');
        const result: Response = await handler(new Request(`http://local${request.url}`, { method: request.method }));
        response.statusCode = result.status;
        result.headers.forEach((value, name) => response.setHeader(name, value));
        response.end(Buffer.from(await result.arrayBuffer()));
      } catch { response.statusCode = 500; response.end(JSON.stringify({ error: 'Brochureprisen kunne ikke hentes.' })); }
    });
  } };
}
