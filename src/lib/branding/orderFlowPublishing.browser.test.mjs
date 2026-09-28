// Real editor, preview iframe, storage adapter and customer pages; synthetic backend only.
// All remote traffic and same-origin APIs are intercepted before transmission.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.ORDER_FLOW_TEST_URL || 'http://127.0.0.1:8111';
const output = 'tmp/order-flow-publish-20260920';
await mkdir(output, { recursive: true });
const shop = '11111111-1111-4111-8111-111111111111';
const pairs = [['calculator',2,1],['checkout',6,4],['proof',7,9],['designer',12,11],['payment',13,15],['confirmation',16,18]];
const report = { assertions: [], widths: [], pageErrors: [], consoleErrors: [], blockedRequests: [] };
const client = `
const shop = '${shop}';
const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'operator@example.test', user_metadata: {} };
const initial = { company: { name: 'Example company' }, branding: { published: { shop_name: 'Layout test shop', themeId: 'print-familiar', themeSettings: { orderFlowDesigns: { calculator:2,checkout:6,proof:7,designer:12,payment:13,confirmation:16 } } } } };
function settings() { return JSON.parse(localStorage.getItem('__flow_settings') || JSON.stringify(initial)); }
function record(value) { const calls=JSON.parse(localStorage.getItem('__flow_calls')||'[]'); calls.push(value);localStorage.setItem('__flow_calls',JSON.stringify(calls)); }
const tenant = () => ({ id:shop,name:'Layout test shop',domain:'example.test',settings:settings() });
const product = { id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',tenant_id:shop,slug:'flyers',name:'Example flyers',description:'Synthetic product for layout verification',is_published:true,pricing_type:'matrix',technical_specs:{width_mm:210,height_mm:297,bleed_mm:3},template_files:[],banner_config:{},image_url:'/design-presets/order-flow/sample-artwork.webp' };
function query(table) { let single=false; const q=new Proxy({}, { get(_, key) {
  if(key==='then') return resolve => { let data=[];
    if(table==='tenants') data=[tenant()];
    if(table==='products') data=[product];
    if(table==='user_roles') data=[{role:'admin'}];
    if(table==='tenant_payment_settings') data=[{status:'active',charges_enabled:true,stripe_account_id:null}];
    if(table==='profiles') data=[{first_name:'Example',last_name:'Customer'}];
    if(table==='generic_product_prices') data=[{id:'price-a',product_id:product.id,variant_name:'A4',quantity:100,price:400}];
    return Promise.resolve({data:single ? data[0]||null:data,error:null,count:data.length}).then(resolve);
  };
  return (...args) => { if(['single','maybeSingle'].includes(key)) single=true;
    if(['insert','update','upsert','delete'].includes(key)) throw new Error('Unexpected fixture write: '+table+':'+key);
    return q;
  };
} });return q; }
export const supabase = {
  from:query,
  auth:{getSession:async()=>({data:{session:{user}},error:null}),getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  rpc(name,args){record({name});if(name!=='tenant_branding_settings_compare_and_swap') throw new Error('Unexpected RPC '+name);
    const matches=args.p_tenant_id===shop && JSON.stringify(args.p_expected_settings)===JSON.stringify(settings());
    if(matches)localStorage.setItem('__flow_settings',JSON.stringify({...settings(),...args.p_branding_patch}));
    return {maybeSingle:async()=>({data:matches?{id:shop}:null,error:null})};
  },
  functions:{invoke:async(name,options)=>{
    record({name});
    if(name==='verify-admin')return {data:{isAdmin:true,isMasterAdmin:false},error:null};
    if(name==='tenant-context-read')return {data:{success:true,tenant:{...tenant(),isMasterTenant:false},auth:{isAuthenticated:true,userId:user.id,role:'admin',isMasterAdmin:false,hasTenantAccess:true}},error:null};
    if(name==='catalog-read')return {data:{success:true,products:[product],categories:[]},error:null};
    if(name==='product-detail-read')return {data:{success:true,product,prices:[],options:[]},error:null};
    if(/stripe|order|upload|email|submit|delete/.test(name)) throw new Error('Unexpected side effect '+name);
    return {data:[],error:null};
  }},
  channel:()=>({on(){return this;},subscribe(){return this;}}),removeChannel:async()=>{},
  storage:{from:()=>({getPublicUrl:path=>({data:{publicUrl:path}})})}
};`;
const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {HelmetProvider} from 'react-helmet-async';
import {TooltipProvider} from '/src/components/ui/tooltip.tsx';
import {Toaster} from '/src/components/ui/sonner.tsx';
import {SiteDesignEditorV2} from '/src/components/admin/SiteDesignEditorV2.tsx';
import {createTenantAdapter} from '/src/lib/branding/tenant-adapter.ts';
import {TENANT_CAPABILITIES} from '/src/lib/branding/types.ts';
import '/src/index.css';
const editor=React.createElement(SiteDesignEditorV2,{adapter:createTenantAdapter('${shop}','Layout test shop'),capabilities:TENANT_CAPABILITIES});
createRoot(document.getElementById('root')).render(React.createElement(HelmetProvider,null,React.createElement(QueryClientProvider,{client:new QueryClient({defaultOptions:{queries:{retry:false}}})},React.createElement(BrowserRouter,null,React.createElement(TooltipProvider,null,editor,React.createElement(Toaster))))));`;
await writeFile(output+'/entry.tsx',entry);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width:1440,height:1000 },serviceWorkers:'block' });
// Hold startup branding retries until after a user selection, reproducing a slow iframe boot.
await context.addInitScript(() => {
  if (location.pathname !== '/__order-flow-qa') return;
  const schedule = window.setTimeout.bind(window);
  const retries = [];
  window.setTimeout = (callback, delay, ...args) => {
    if (typeof callback === 'function' && [100,500].includes(delay) && String(callback).includes('BRANDING_UPDATE')) {
      retries.push(() => callback(...args));
      return 0;
    }
    return schedule(callback, delay, ...args);
  };
  window.__flushBrandingRetries = () => { window.setTimeout = schedule; retries.splice(0).forEach(retry => retry()); };
});
await context.route('**/*', async route => {
  const u = new URL(route.request().url());
  if(u.origin===base && u.pathname==='/src/integrations/supabase/client.ts') return route.fulfill({contentType:'text/javascript',body:client});
  if(u.origin===base && u.pathname==='/__order-flow-qa') {
    // Retain Vite's actual React-refresh preamble and transformed entry HTML.
    const response=await route.fetch({url:base+'/'});
    return route.fulfill({response,body:(await response.text()).replace('/src/main.tsx','/'+output+'/entry.tsx')});
  }
  if(u.origin===base && !u.pathname.startsWith('/api/') && route.request().method()==='GET') return route.continue();
  report.blockedRequests.push({method:route.request().method(),url:u.origin+u.pathname});
  return route.fulfill({contentType:u.pathname.endsWith('.css')?'text/css':'application/json',body:u.pathname.endsWith('.css')?'':'[]'});
});
context.on('page', page => {
  page.on('response',response=>{if(response.status()>=400)report.consoleErrors.push(response.status()+' '+new URL(response.url()).pathname);});
  page.on('pageerror',error=>report.pageErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push(message.text());});
});
const page=await context.newPage();
page.setDefaultTimeout(20000);
try {
  await page.goto(base+'/__order-flow-qa');
  await page.getByRole('button',{name:'Bestillingsflow',exact:true}).click();
  const select=page.locator('#sd-order-step');
  await select.waitFor();
  const frame=page.frameLocator('iframe').first();
  await page.getByRole('button',{name:'1 · Alternativ',exact:false}).click();
  await frame.locator('.product-calculator-layout[data-calculator-design="1"]').waitFor();
  await page.getByRole('button',{name:'2 · Standard',exact:false}).click();
  await frame.locator('.product-calculator-layout[data-calculator-design="2"]').waitFor();
  await page.evaluate(() => window.__flushBrandingRetries());
  await page.waitForTimeout(150);
  assert.equal(await frame.locator('.product-calculator-layout').first().getAttribute('data-calculator-design'),'2');
  report.assertions.push('Delayed startup retries preserve the newest layout selection.');
  for(const [step,standard,alternative] of pairs){
    await select.selectOption(step);
    for(const [design,label] of [[alternative,'Alternativ'],[standard,'Standard'],[alternative,'Alternativ']]){
      await page.getByRole('button',{name:design+' · '+label,exact:false}).click();
      const surface=step==='calculator'?frame.locator('.product-calculator-layout[data-calculator-design="'+design+'"]'):frame.locator('[data-preview-order-step="'+step+'"][data-order-design="'+design+'"]');
      await surface.waitFor();
      await surface.getAttribute(step==='calculator'?'data-calculator-design':'data-order-design').then(actual=>assert.equal(actual,String(design)));
    }
    await page.screenshot({path:output+'/editor-'+step+'.png'});
    report.assertions.push('Editor selects and immediately previews both '+step+' layouts.');
    console.log('Verified editor step:',step);
  }
  // Both navigation controls select the same step and keep the inspector synchronized.
  for(const [step,label] of [['checkout','Checkout'],['proof','Filkorrektur'],['designer','Designer'],['payment','Betaling'],['confirmation','Bekræftelse']]){
    await page.getByRole('combobox',{name:'Vælg side eller produkt til preview'}).click();
    await page.getByRole('option',{name:label,exact:true}).click();
    await frame.locator('[data-preview-order-step="'+step+'"]').waitFor();
    assert.equal(await select.inputValue(),step);
    assert.equal(await page.getByRole('combobox',{name:'Vælg side eller produkt til preview'}).textContent(),label);
  }
  report.assertions.push('The preview destination selector opens every order step and stays synchronized with the inspector.');
  // State survives changing only the designer layout in place.
  await select.selectOption('designer');
  await frame.getByLabel('Eksempeltekst').fill('Preserved preview text');
  await page.getByRole('button',{name:'12 · Standard',exact:false}).click();
  assert.equal(await frame.getByLabel('Eksempeltekst').inputValue(),'Preserved preview text');
  await page.getByRole('button',{name:'11 · Alternativ',exact:false}).click();
  report.assertions.push('Designer example state survives layout switching.');
  await page.getByRole('button',{name:'Gem kladde',exact:true}).click();
  await page.getByText('Kladde gemt (ikke live endnu)',{exact:true}).waitFor();
  let settings=await page.evaluate(()=>JSON.parse(localStorage.getItem('__flow_settings')));
  assert.deepEqual(Object.values(settings.branding.draft.themeSettings.orderFlowDesigns),pairs.map(item=>item[2]));
  assert.equal(settings.branding.published.themeSettings.orderFlowDesigns.checkout,6);
  await page.reload();
  await page.getByRole('button',{name:'Bestillingsflow',exact:true}).click();
  for(const [step,,alternative] of pairs){
    await select.selectOption(step);
    assert.equal(await page.getByRole('button',{name:alternative+' · Alternativ',exact:false}).getAttribute('aria-pressed'),'true');
  }
  report.assertions.push('Saving and reloading the real editor retains all six alternatives without publishing them.');
  await page.getByRole('button',{name:/^Public[eé]r$/}).click();
  assert.equal(await page.getByRole('region',{name:'Layouts der publiceres'}).locator('dt').count(),6);
  await page.getByRole('alertdialog').getByRole('button',{name:/Public[eé]r/}).click();
  await page.getByText('Branding publiceret (live opdateret)',{exact:true}).waitFor();
  settings=await page.evaluate(()=>JSON.parse(localStorage.getItem('__flow_settings')));
  assert.deepEqual(settings.branding.published.themeSettings.orderFlowDesigns,settings.branding.draft.themeSettings.orderFlowDesigns);
  report.assertions.push('Real Publish button and adapter publish all six choices to the synthetic backend.');
  const customer=await context.newPage();
  await customer.addInitScript(() => {
    if(location.pathname==='/checkout/konfigurer') sessionStorage.setItem('wp_site_checkout_session',JSON.stringify({
      productId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',productSlug:'flyers',productName:'Example flyers',
      quantity:100,totalPrice:400,productPrice:400,selectedFormat:'A4',designWidthMm:210,designHeightMm:297,designBleedMm:3,
      pricingQuote:{productId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',quantity:100},
    }));
  });
  await customer.goto(base+'/produkt/flyers?tenantId='+shop);
  await customer.locator('.product-calculator-layout[data-calculator-design="1"]').waitFor();
  await customer.goto(base+'/checkout/konfigurer?tenantId='+shop);
  await customer.locator('[data-order-design="4"] .order-checkout-grid').waitFor();
  await customer.goto(base+'/designer?tenantId='+shop+'&widthMm=210&heightMm=297&bleedMm=3&format=A4');
  await customer.locator('.order-designer[data-order-design="11"] .order-designer-workspace').waitFor();
  report.assertions.push('Actual customer product, checkout and designer routes read published choices without preview URL overrides.');
  await customer.close();
  // Verify the actual PreviewShop route at responsive viewport sizes.
  // The editor broadcasts its draft across tabs; close it before testing stored snapshots.
  await page.close();
  const preview=await context.newPage();
  await preview.goto(base+'/');
  for(const [step,standard,alternative] of pairs.filter(item=>item[0]!=='calculator')){
    const routes={checkout:'/checkout',proof:'/checkout/korrektur',designer:'/designer',payment:'/checkout/betaling',confirmation:'/checkout/bekraeftelse'};
    for(const design of [standard,alternative]){
      // Fixture publication only; no application globals or hosted writes.
      await preview.evaluate(({step,design})=>{const s=JSON.parse(localStorage.getItem('__flow_settings'));s.branding.draft.themeSettings.orderFlowDesigns[step]=design;localStorage.setItem('__flow_settings',JSON.stringify(s));},{step,design});
      await preview.goto(base+'/preview-shop?draft=1&preview_mode=1&tenantId='+shop+'&page='+encodeURIComponent(routes[step]));
      await preview.locator('[data-preview-order-step="'+step+'"][data-order-design="'+design+'"]').waitFor();
      for(const width of [1440,1280,1024,768,701,700,390,320]){
        await preview.setViewportSize({width,height:1000});
        // Responsive headers measure their groups on animation frames after resize.
        await preview.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth+1,null,{timeout:3000}).catch(()=>{});
        const measure=await preview.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth}));
        report.widths.push({step,design,width,...measure});
        assert.ok(measure.document<=width+1,step+' '+design+' overflows at '+width+': '+measure.document);
        if(width===1280 || width===390)await preview.screenshot({path:output+'/'+step+'-'+design+'-'+width+'.png'});
      }
    }
  }
  assert.equal(report.pageErrors.length,0,report.pageErrors.join('\n'));
  report.assertions.push('Both designs on all five new previews fit all eight widths.');
  console.log(JSON.stringify({assertions:report.assertions,widthChecks:report.widths.length,pageErrors:report.pageErrors,consoleErrors:report.consoleErrors},null,2));
} catch(error){
  report.failure=String(error);
  await context.pages().at(-1)?.screenshot({path:output+'/failure.png'});
  console.error(error);
  process.exitCode=1;
} finally {
  await writeFile(output+'/browser-report.json',JSON.stringify(report,null,2));
  await browser.close();
}
