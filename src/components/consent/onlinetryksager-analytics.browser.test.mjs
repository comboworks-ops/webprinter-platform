import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const { build } = createRequire(import.meta.resolve('vite'))('esbuild');
const root = fileURLToPath(new URL('../../../', import.meta.url));
let browser, bundle;
const fixture = `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {BrowserRouter,useNavigate,useLocation} from 'react-router-dom';
import {CookieConsentProvider,useCookieConsent} from './src/components/consent/CookieConsentProvider.tsx';
import {CookieBanner} from './src/components/consent/CookieBanner.tsx';
import {OnlinetryksagerAnalytics} from './src/components/consent/OnlinetryksagerAnalytics.tsx';
function Controls(){const c=useCookieConsent();const n=useNavigate();const l=useLocation();return <>
<button onClick={()=>c.setCategories({preferences:false,statistics:true,marketing:false})}>Statistics only</button>
<button onClick={c.rejectAll}>Withdraw</button>
<button onClick={()=>n('/produkt/flyers?email=private@example.test#secret')}>Product</button>
<button onClick={()=>n('/admin?token=secret')}>Admin</button>
<button onClick={()=>n('/kontakt')}>Contact</button>
<button onClick={()=>n('/kontakt?email=private@example.test')}>Same page query</button>
<output id="path">{l.pathname}</output><output id="consent">{JSON.stringify(c.consent)}</output>
</>}
createRoot(document.getElementById('root')).render(<BrowserRouter><CookieConsentProvider><CookieBanner/><OnlinetryksagerAnalytics/><Controls/></CookieConsentProvider></BrowserRouter>);
`;
before(async()=>{
 const result=await build({absWorkingDir:root,stdin:{contents:fixture,resolveDir:root,loader:'jsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',alias:{'@':path.join(root,'src')},define:{'import.meta.env':'{}'}});
 bundle=result.outputFiles[0].text;
 browser=await chromium.launch({headless:true,executablePath:process.env.GA4_TEST_BROWSER_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
});
after(async()=>{await browser?.close();});
async function withPage(run,{host='www.onlinetryksager.dk',pathname='/',protocol='https:',cookie,slow=false,fail=false}={}){
 const context=await browser.newContext();const page=await context.newPage();const requests=[];const errors=[];let pending;
 try{
 page.on('pageerror',e=>errors.push(e.message));
 if(cookie)await context.addCookies([{name:'wp_consent_v1',value:encodeURIComponent(JSON.stringify(cookie)),url:`${protocol}//${host}`}]);
 await page.route(`${protocol}//${host}/**`,r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));
 await page.route('https://www.googletagmanager.com/**',async r=>{requests.push(r.request().url());if(slow){pending=r;return;}if(fail){await r.abort();return;}await r.fulfill({contentType:'application/javascript',body:'window.fixtureGoogleLoaded=true;'});});
 await page.goto(`${protocol}//${host}${pathname}`);await page.addScriptTag({content:bundle});await page.locator('#path').waitFor();
 const state=()=>page.evaluate(()=>({disabled:window['ga-disable-G-BKKZ1Q3ECQ'],commands:(window.dataLayer||[]).map(v=>Array.from(v)),scripts:document.querySelectorAll('script[src*="googletagmanager"]').length,cookie:document.cookie}));
 const pages=async()=> (await state()).commands.filter(c=>c[0]==='event'&&c[1]==='page_view');
 await run({page,context,requests,state,pages,release:async()=>{assert.ok(pending);await pending.fulfill({contentType:'application/javascript',body:'window.fixtureGoogleLoaded=true;'});}});
 assert.deepEqual(errors,[]);
 }finally{await context.close();}
}
const saved=statistics=>({v:1,necessary:true,preferences:false,statistics,marketing:false,updatedAt:new Date().toISOString()});
test('no Google script or page view before consent, including necessary-only choice',()=>withPage(async({page,requests,state,pages})=>{
 await page.getByRole('button',{name:'Kun nødvendige',exact:true}).click();await page.waitForTimeout(100);assert.equal(requests.length,0);assert.equal((await state()).scripts,0);assert.equal((await pages()).length,0);
}));
test('statistics alone initializes one tag, sanitizes URLs, disables ads and avoids duplicate SPA views',()=>withPage(async({page,requests,state,pages})=>{
 await page.getByText('Statistics only',{exact:true}).click();await page.waitForFunction(()=>window.dataLayer?.some(v=>v[0]==='event'));
 assert.equal(requests.length,1);assert.match(requests[0],/id=G-BKKZ1Q3ECQ$/);let commands=(await state()).commands;let config=commands.find(v=>v[0]==='config')[2];assert.equal(config.send_page_view,false);assert.equal(config.cookie_domain,'none');assert.equal(config.cookie_expires,15552000);assert.equal(config.allow_google_signals,false);assert.equal(config.allow_ad_personalization_signals,false);assert.equal(commands.find(v=>v[0]==='consent'&&v[1]==='default')[2].analytics_storage,'denied');assert.equal(commands.find(v=>v[0]==='consent'&&v[1]==='update')[2].ad_storage,'denied');
 await page.getByText('Product',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('#path').textContent==='/produkt/flyers');await page.getByText('Contact',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('#path').textContent==='/kontakt');await page.getByText('Same page query',{exact:true}).click();await page.waitForTimeout(100);
 const views=await pages();assert.equal(views.length,3);assert.equal(requests.length,1);assert.equal(views[1][2].page_location,'https://www.onlinetryksager.dk/produkt/flyers');assert.ok(!JSON.stringify(views).includes('private@example.test'));assert.ok(!JSON.stringify(views).includes('secret'));
}));
test('stored valid statistics consent initializes the tag without another choice',()=>withPage(async({page,requests,pages})=>{await page.waitForFunction(()=>window.dataLayer?.some(v=>v[0]==='event'));assert.equal(requests.length,1);assert.equal((await pages()).length,1);},{cookie:saved(true)}));
for(const value of [false,'false','true',1,null])test(`non-boolean or denied statistics ${JSON.stringify(value)} cannot load Google`,()=>withPage(async({page,requests})=>{await page.waitForTimeout(100);assert.equal(requests.length,0);},{cookie:saved(value)}));
for(const host of ['webprinter.dk','www.webprinter.dk','salgsmapper.dk','www.salgsmapper.dk','preview.vercel.app','onlinetryksager.dk.evil.test'])test(`no tag on unrelated host ${host}`,()=>withPage(async({page,requests,state})=>{await page.getByText('Statistics only',{exact:true}).click();await page.waitForTimeout(100);assert.equal(requests.length,0);assert.equal((await state()).scripts,0);},{host}));
test('apex host is supported',()=>withPage(async({page,requests})=>{await page.getByText('Statistics only',{exact:true}).click();await page.waitForFunction(()=>window.fixtureGoogleLoaded);assert.equal(requests.length,1);},{host:'onlinetryksager.dk'}));
for(const pathname of ['/admin','/auth','/checkout/konfigurer','/min-konto','/mine-ordrer','/designer','/preview','/company'])test(`no initialization on private/application path ${pathname}`,()=>withPage(async({page,requests})=>{await page.getByText('Statistics only',{exact:true}).click();await page.waitForTimeout(60);assert.equal(requests.length,0);},{pathname}));
test('withdrawal stops tracking and removes only this stream cookies; regrant starts a new observed page',()=>withPage(async({page,state,pages,requests})=>{
 await page.getByText('Statistics only',{exact:true}).click();await page.waitForFunction(()=>window.fixtureGoogleLoaded);await page.evaluate(()=>{document.cookie='_ga=fixture; Path=/';document.cookie='_ga_BKKZ1Q3ECQ=fixture; Path=/';document.cookie='unrelated=keep; Path=/';});await page.getByText('Withdraw',{exact:true}).click();await page.getByText('Contact',{exact:true}).click();await page.waitForTimeout(100);assert.equal((await state()).disabled,true);assert.equal((await pages()).length,1);assert.ok(!(await state()).cookie.includes('_ga='));assert.ok(!(await state()).cookie.includes('_ga_BKKZ1Q3ECQ='));assert.ok((await state()).cookie.includes('unrelated=keep'));await page.getByText('Statistics only',{exact:true}).click();await page.waitForTimeout(100);assert.equal((await state()).disabled,false);assert.equal((await pages()).length,2);assert.equal(requests.length,1);
}));
test('entering admin disables a loaded tag; returning to public page resumes only public measurement',()=>withPage(async({page,state,pages})=>{
 await page.getByText('Statistics only',{exact:true}).click();await page.waitForFunction(()=>window.fixtureGoogleLoaded);await page.getByText('Admin',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('#path').textContent==='/admin');assert.equal((await state()).disabled,true);assert.equal((await pages()).length,1);await page.getByText('Contact',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('#path').textContent==='/kontakt');assert.equal((await pages()).length,2);assert.ok(!JSON.stringify((await state()).commands).includes('token=secret'));
}));
test('withdrawal during script loading cannot flush an old page view',()=>withPage(async({page,requests,state,pages,release})=>{
 await page.getByText('Statistics only',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('script[src*="googletagmanager"]'));assert.equal(requests.length,1);await page.getByText('Withdraw',{exact:true}).click();await page.waitForTimeout(50);await release();await page.waitForTimeout(100);assert.equal((await state()).disabled,true);assert.equal((await pages()).length,0);assert.equal((await state()).scripts,0);
},{slow:true}));
test('blocked tag fails quietly without a page view or breaking the website',()=>withPage(async({page,state,pages})=>{await page.getByText('Statistics only',{exact:true}).click();await page.waitForTimeout(150);assert.equal((await pages()).length,0);assert.equal((await state()).disabled,true);await page.getByText('Contact',{exact:true}).click();await page.waitForFunction(()=>document.querySelector('#path').textContent==='/kontakt');},{fail:true}));
