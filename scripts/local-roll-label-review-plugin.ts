import type { Plugin } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { brochurePreviewAccess } from './brochure-preview-access';
import { generateRollLabelSizeTemplate } from '../src/lib/designer/generateRollLabelSizeTemplate';
import type { RollLabelReviewFamily } from '../src/lib/products/rollLabelReview';
import {createHash} from 'node:crypto';
import {readRollLabelPriceSelection} from './roll-label-price-preview';
import {buildRollLabelLocalPricePreview,readRollLabelLocalPriceLedgers,rollLabelLocalPriceVersion,type RollLabelLocalPriceLedgers} from './roll-label-local-price-ledgers';
import {rollLabelPriceForSelection,type RollLabelPricePreview} from '../src/lib/products/rollLabelPricePreview';
import {buildRollLabelSystemProduct} from './roll-label-system-product';

const checksum=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');

/** Loopback, read-only, development-only review. Never serve supplier prices,
 * raw evidence or production documents through this endpoint. */
export function localRollLabelReview(): Plugin {
  return { name: 'local-roll-label-review', apply: 'serve', configureServer(server) {
    const base=path.join(server.config.root,'output/supplier-imports/roll-labels-catalogue-2026-10-06');
    let ledgerCache:{version:string;ledgers:RollLabelLocalPriceLedgers}|null=null;
    const previews=new Map<string,{familySha:string;packet:RollLabelPricePreview}>();
    const pricePreview=async(familyId:string,ruleKey:string)=>{
      const version=await rollLabelLocalPriceVersion(server.config.root);
      if(!ledgerCache||version!==ledgerCache.version){
        ledgerCache={version,ledgers:await readRollLabelLocalPriceLedgers(server.config.root)};previews.clear();
      }
      const bytes=await fs.readFile(path.join(base,'review/families',familyId+'.json')),familySha=checksum(bytes),key=familyId+':'+ruleKey;
      const family:RollLabelReviewFamily=JSON.parse(bytes.toString());
      if(family.familyId!==familyId)throw Error('Foreign family');
      let cached=previews.get(key);
      if(cached?.familySha!==familySha){cached={familySha,packet:buildRollLabelLocalPricePreview(family,ledgerCache.ledgers,ruleKey)};previews.set(key,cached);}
      return {family,packet:cached.packet};
    };
    server.middlewares.use(async (request, response, next) => {
      const pathname = (request.url || '').split('?')[0];
      if (!pathname.startsWith('/roll-label-review/')) return next();
      const access = brochurePreviewAccess({ host: request.headers.host, remoteAddress: request.socket.remoteAddress,
        origin: request.headers.origin, method: request.method, fetchSite: String(request.headers['sec-fetch-site'] || '') });
      if (access !== 200) { response.statusCode = access; if (access === 405) response.setHeader('Allow','GET, HEAD'); response.end(); return; }
      const productMatch=pathname.match(/^\/roll-label-review\/system-product\/([0-9]+)\.json$/);
      if(productMatch){
        response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
        try{
          if(new URL(request.url!,'http://127.0.0.1').search)throw Error('Unexpected query');
          const {family,packet}=await pricePreview(productMatch[1],'wmd_roll_labels_threshold_fx_7_6');
          const index=JSON.parse(await fs.readFile(path.join(base,'review/native-catalogue.json'),'utf8'));
          const entry=index.families.find((item:{familyId:string})=>item.familyId===family.familyId);
          const product=buildRollLabelSystemProduct(family,packet,entry?.slug);
          response.end(request.method==='HEAD'?undefined:JSON.stringify(product));
        }catch{response.statusCode=404;response.end(JSON.stringify({error:'Den lokale produktprøve kunne ikke åbnes.'}));}
        return;
      }
      const priceMatch=pathname.match(/^\/roll-label-review\/(prices|price)\/([0-9]+)\.json$/);
      if(priceMatch){
        response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');
        try{
          const url=new URL(request.url!,'http://127.0.0.1'),ruleKey=url.searchParams.get('rule')||'wmd_roll_labels_threshold_fx_7_6';
          if(url.searchParams.getAll('rule').length>1||[...url.searchParams.keys()].some(key=>!['rule','selection'].includes(key)))throw Error('Invalid query');
          const {family,packet}=await pricePreview(priceMatch[2],ruleKey);
          let result:unknown=packet;
          if(priceMatch[1]==='price'){
            const raw=url.searchParams.get('selection');
            if(!raw||raw.length>16384||url.searchParams.getAll('selection').length!==1){response.statusCode=400;response.end(JSON.stringify({error:'Vælg en gyldig konfiguration.'}));return;}
            const selection=readRollLabelPriceSelection(family,JSON.parse(raw));
            if(!selection){response.statusCode=400;response.end(JSON.stringify({error:'Konfigurationen kunne ikke kontrolleres.'}));return;}
            const point=rollLabelPriceForSelection(packet,selection);
            result={status:point?'captured_price_proposal':'not_captured',point,ruleKey,currency:'DKK',commercialApproved:false,orderReady:false};
          }else if(url.searchParams.has('selection'))throw Error('Invalid sample query');
          response.end(request.method==='HEAD'?undefined:JSON.stringify(result));
        }catch{response.statusCode=503;response.end(JSON.stringify({error:'Prisforslaget kunne ikke hentes.'}));}
        return;
      }
      const pdfMatch = pathname.match(/^\/roll-label-review\/dimension-template\/([0-9]+)\/([0-9]+)-([0-9]+)\.pdf$/);
      if (pdfMatch) {
        const url = new URL(request.url!, 'http://127.0.0.1');
        if (url.searchParams.size !== 3 || ['widthMm','heightMm','contract'].some(key=>url.searchParams.getAll(key).length!==1)) {
          response.statusCode=400;response.end();return;
        }
        try {
          const family:RollLabelReviewFamily = JSON.parse(await fs.readFile(path.join(server.config.root,
            'output/supplier-imports/roll-labels-catalogue-2026-10-06/review/families',pdfMatch[1]+'.json'),'utf8'));
          const profiles = family.profiles.filter(p=>p.key===pdfMatch[2]+':'+pdfMatch[3]
            && p.sizeGeometry?.sha256===url.searchParams.get('contract'));
          if (profiles.length!==1) throw Error('Unknown exact contract');
          const template = await generateRollLabelSizeTemplate(profiles[0],Number(url.searchParams.get('widthMm')),Number(url.searchParams.get('heightMm')));
          response.setHeader('Content-Type','application/pdf');response.setHeader('Cache-Control','no-store');
          response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Content-Disposition','attachment; filename="etiket-skabelon.pdf"');
          response.end(request.method==='HEAD'?undefined:Buffer.from(template.bytes));
        } catch {response.statusCode=422;response.end();}
        return;
      }
      const match = pathname.match(/^\/roll-label-review\/((?:native-)?catalogue\.json|families\/[0-9]+\.json)$/);
      if (!match) { response.statusCode = 404; response.end(); return; }
      try {
        let bytes = await fs.readFile(path.join(server.config.root, 'output/supplier-imports/roll-labels-catalogue-2026-10-06/review', match[1]));
        if(match[1].endsWith('catalogue.json')){
          const catalog=JSON.parse(bytes.toString());
          catalog.localPriceProposalsIncluded=true;
          for(const product of catalog.products){
            const {packet}=await pricePreview(String(product.technical_specs.local_review_family_id),'wmd_roll_labels_threshold_fx_7_6');
            if(packet.points.length)product.displayPrice='Prisforslag fra '+Math.min(...packet.points.map(point=>point.priceDkk)).toLocaleString('da-DK')+' kr.';
          }
          bytes=Buffer.from(JSON.stringify(catalog));
        }
        response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store');
        response.setHeader('X-Content-Type-Options', 'nosniff'); response.end(request.method === 'HEAD' ? undefined : bytes);
      } catch { response.statusCode = 404; response.end(JSON.stringify({ error: 'Den lokale produktprøve kunne ikke åbnes.' })); }
    });
  } };
}
